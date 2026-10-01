import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireEquipe, isGestion, canManageFormation } from '../lib/auth.js';

export const sessionsRouter = Router();
sessionsRouter.use(requireAuth, requireEquipe);

const ISO_DATETIME = z.string().datetime({ offset: true });

const sessionSchema = z.object({
  formationId: z.string().min(1),
  title: z.string().min(2),
  startAt: ISO_DATETIME,
  endAt: ISO_DATETIME,
  location: z.string().nullish(),
  capacity: z.number().int().positive().default(10),
  modality: z.enum(['PRESENTIEL', 'ONLINE']).default('PRESENTIEL'),
  meetingUrl: z.string().url().nullish(),
  trainerId: z.string().nullish(),
});

const sessionUpdateSchema = sessionSchema.omit({ formationId: true }).extend({
  startAt: ISO_DATETIME.optional(),
  endAt: ISO_DATETIME.optional(),
});

/** Un formateur ne gère que les sessions de ses formations (ou celles
 *  où il est le formateur) ; ADMIN et GESTIONNAIRE gèrent tout. */
async function canManageSession(
  user: { id: string; role: string },
  sessionId: string
): Promise<boolean> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { trainerId: true, formationId: true },
  });
  if (!session) return false;
  if (isGestion(user.role) || session.trainerId === user.id) return true;
  return canManageFormation(user as never, session.formationId);
}

sessionsRouter.get('/', async (req, res) => {
  const { formationId } = req.query as { formationId?: string };
  const formateurOnly = req.user!.role === 'FORMATEUR';
  const sessions = await prisma.session.findMany({
    where: {
      ...(formationId ? { formationId } : {}),
      ...(formateurOnly
        ? {
            OR: [
              { trainerId: req.user!.id },
              { formation: { instructors: { some: { id: req.user!.id } } } },
            ],
          }
        : {}),
    },
    orderBy: { startAt: 'asc' },
    include: {
      formation: { select: { id: true, title: true } },
      trainer: { select: { id: true, name: true } },
      participants: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
    },
  });
  res.json({ sessions });
});

sessionsRouter.post('/', async (req, res) => {
  const parsed = sessionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Titre, formation, dates début/fin requis' });
  }
  const formation = await prisma.formation.findUnique({ where: { id: parsed.data.formationId } });
  if (!formation) return res.status(404).json({ error: 'Formation introuvable' });
  if (!(await canManageFormation(req.user!, formation.id))) {
    return res.status(403).json({ error: 'Formation non assignée' });
  }
  const { startAt, endAt, trainerId, ...rest } = parsed.data;
  if (new Date(startAt) >= new Date(endAt)) {
    return res.status(400).json({ error: 'La date de fin doit être après la date de début' });
  }
  // Un formateur anime lui-même les sessions de ses formations
  const effectiveTrainerId = req.user!.role === 'FORMATEUR' ? req.user!.id : trainerId || null;
  if (effectiveTrainerId) {
    const trainer = await prisma.user.findUnique({ where: { id: effectiveTrainerId } });
    if (!trainer || trainer.role !== 'FORMATEUR') {
      return res.status(400).json({ error: 'Le formateur désigné est introuvable' });
    }
  }
  const session = await prisma.session.create({
    data: {
      ...rest,
      startAt: new Date(startAt),
      endAt: new Date(endAt),
      trainerId: effectiveTrainerId,
      formationId: formation.id,
    },
    include: { formation: { select: { title: true } }, trainer: { select: { name: true } } },
  });
  res.status(201).json({ session });
});

sessionsRouter.patch('/:id', async (req, res) => {
  const parsed = sessionUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Données invalides' });
  if (!(await canManageSession(req.user!, (req.params.id as string)))) {
    return res.status(403).json({ error: 'Session non assignée' });
  }
  // État avant modification : indispensable pour notifier si les dates bougent
  const beforeSession = await prisma.session.findUnique({
    where: { id: req.params.id as string },
    select: { title: true, startAt: true, endAt: true, trainerId: true, formationId: true },
  });
  if (!beforeSession) return res.status(404).json({ error: 'Session introuvable' });

  const { startAt, endAt, trainerId, ...rest } = parsed.data;
  if (trainerId !== undefined && trainerId) {
    const trainer = await prisma.user.findUnique({ where: { id: trainerId } });
    if (!trainer || trainer.role !== 'FORMATEUR') {
      return res.status(400).json({ error: 'Le formateur désigné est introuvable' });
    }
  }
  try {
    const session = await prisma.session.update({
      where: { id: (req.params.id as string) },
      data: {
        ...rest,
        ...(startAt ? { startAt: new Date(startAt) } : {}),
        ...(endAt ? { endAt: new Date(endAt) } : {}),
        ...(trainerId !== undefined && req.user!.role !== 'FORMATEUR'
          ? { trainerId: trainerId || null }
          : {}),
      },
    });

    // Créneau modifié ? → notification automatique (inscrits + formateurs)
    const notified = await notifySessionMoved(
      req.user!,
      { title: beforeSession.title, startAt: beforeSession.startAt, endAt: beforeSession.endAt,
        trainerId: beforeSession.trainerId, formationId: beforeSession.formationId },
      { startAt: new Date(session.startAt), endAt: new Date(session.endAt) }
    );

    res.json({ session, notified });
  } catch {
    res.status(404).json({ error: 'Session introuvable' });
  }
});

sessionsRouter.delete('/:id', async (req, res) => {
  if (!(await canManageSession(req.user!, (req.params.id as string)))) {
    return res.status(403).json({ error: 'Session non assignée' });
  }
  try {
    await prisma.session.delete({ where: { id: (req.params.id as string) } });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: 'Session introuvable' });
  }
});

// Inscrire des apprenants à une session (avec contrôle de capacité)
sessionsRouter.post('/:id/participants', async (req, res) => {
  const schema = z.object({ userIds: z.array(z.string()).min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'userIds requis' });
  if (!(await canManageSession(req.user!, (req.params.id as string)))) {
    return res.status(403).json({ error: 'Session non assignée' });
  }
  const session = await prisma.session.findUnique({
    where: { id: (req.params.id as string) },
    include: { _count: { select: { participants: true } } },
  });
  if (!session) return res.status(404).json({ error: 'Session introuvable' });

  const existing = await prisma.sessionParticipant.findMany({
    where: { sessionId: session.id, userId: { in: parsed.data.userIds } },
  });
  const newIds = parsed.data.userIds.filter(
    (id) => !existing.some((p) => p.userId === id)
  );
  if (session._count.participants + newIds.length > session.capacity) {
    return res.status(400).json({
      error: `Capacité atteinte (${session._count.participants}/${session.capacity} inscrits)`,
    });
  }
  await prisma.sessionParticipant.createMany({
    data: newIds.map((userId) => ({ sessionId: session.id, userId })),
    skipDuplicates: true,
  });
  const participants = await prisma.sessionParticipant.findMany({
    where: { sessionId: session.id },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  res.status(201).json({ participants });
});

// Marquer présence / absences
/** Notifie les apprenants inscrits à la formation + les formateurs assignés
 *  (et le formateur de la session) après TOUT changement de date/horaire.
 *  Compare l'ancien et le nouveau créneau, adapte le message, exclut
 *  l'auteur du changement. Retourne le nombre de personnes notifiées. */
async function notifySessionMoved(
  actor: { id: string },
  before: { title: string; startAt: Date; endAt: Date; trainerId: string | null; formationId: string },
  after: { startAt: Date; endAt: Date }
): Promise<number> {
  const dateChanged = before.startAt.getTime() !== after.startAt.getTime();
  const timeChanged = before.startAt.getHours() !== after.startAt.getHours() ||
    before.startAt.getMinutes() !== after.startAt.getMinutes();
  if (!dateChanged && !timeChanged) return 0;

  const formation = await prisma.formation.findUnique({
    where: { id: before.formationId },
    select: {
      instructors: { select: { id: true } },
      enrollments: { select: { userId: true } },
    },
  });
  if (!formation) return 0;

  const destinataires = new Map<string, 'APPRENANT' | 'EQUIPE'>();
  for (const e of formation.enrollments) {
    if (e.userId !== actor.id) destinataires.set(e.userId, 'APPRENANT');
  }
  for (const i of formation.instructors) {
    if (i.id !== actor.id) destinataires.set(i.id, 'EQUIPE');
  }
  if (before.trainerId && before.trainerId !== actor.id) {
    destinataires.set(before.trainerId, 'EQUIPE');
  }

  const memeJour =
    before.startAt.getFullYear() === after.startAt.getFullYear() &&
    before.startAt.getMonth() === after.startAt.getMonth() &&
    before.startAt.getDate() === after.startAt.getDate();

  const quand = `${dateFR(after.startAt)} à ${heureFR(after.startAt)}`;
  const body = memeJour
    ? `L'horaire a changé : ${heureFR(before.startAt)} → ${heureFR(after.startAt)} le ${quand}.`
    : `La session passe du ${dateFR(before.startAt)} (${heureFR(before.startAt)}) au ${quand}.`;

  const data = [...destinataires.entries()].map(([userId, kind]) => ({
    userId,
    type: 'SESSION_RESCHEDULED',
    title: `Session modifiée : « ${before.title} »`,
    body,
    link: kind === 'APPRENANT' ? '/mes-sessions' : '/backoffice/calendar',
  }));
  if (data.length > 0) {
    await prisma.notification.createMany({ data });
  }
  return data.length;
}

const dateFR = (d: Date) =>
  d.toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
const heureFR = (d: Date) =>
  d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

/** Reporter une session : décale début/fin (durée conservée) et notifie
 *  automatiquement les apprenants inscrits à la formation ainsi que les
 *  formateurs assignés à celle-ci (formateur de la session inclus). */
sessionsRouter.post('/:id/reschedule', async (req, res) => {
  const schema = z.object({ startAt: ISO_DATETIME });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'startAt requis' });
  if (!(await canManageSession(req.user!, req.params.id as string))) {
    return res.status(403).json({ error: 'Session non assignée' });
  }

  const session = await prisma.session.findUnique({
    where: { id: req.params.id as string },
    include: { formation: { select: { id: true, title: true } } },
  });
  if (!session) return res.status(404).json({ error: 'Session introuvable' });

  const newStart = new Date(parsed.data.startAt);
  const duration = session.endAt.getTime() - session.startAt.getTime();
  const newEnd = new Date(newStart.getTime() + duration);
  const before = {
    title: session.title, startAt: new Date(session.startAt),
    endAt: new Date(session.endAt), trainerId: session.trainerId,
    formationId: session.formationId,
  };

  const updated = await prisma.session.update({
    where: { id: session.id },
    data: { startAt: newStart, endAt: newEnd },
  });

  const notified = await notifySessionMoved(
    req.user!, before,
    { startAt: new Date(updated.startAt), endAt: new Date(updated.endAt) }
  );

  res.json({ session: updated, notified, newStartAt: updated.startAt });
});

sessionsRouter.patch('/:id/participants/:userId', async (req, res) => {
  const schema = z.object({ attended: z.boolean() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'attended (booléen) requis' });
  if (!(await canManageSession(req.user!, (req.params.id as string)))) {
    return res.status(403).json({ error: 'Session non assignée' });
  }
  try {
    const participant = await prisma.sessionParticipant.update({
      where: { sessionId_userId: { sessionId: (req.params.id as string), userId: (req.params.userId as string) } },
      data: { attended: parsed.data.attended },
    });
    res.json({ participant });
  } catch {
    res.status(404).json({ error: 'Participant introuvable' });
  }
});

sessionsRouter.delete('/:id/participants/:userId', async (req, res) => {
  if (!(await canManageSession(req.user!, (req.params.id as string)))) {
    return res.status(403).json({ error: 'Session non assignée' });
  }
  try {
    await prisma.sessionParticipant.delete({
      where: { sessionId_userId: { sessionId: (req.params.id as string), userId: (req.params.userId as string) } },
    });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: 'Participant introuvable' });
  }
});
