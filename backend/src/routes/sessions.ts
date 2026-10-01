import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireStaff } from '../lib/auth.js';

export const sessionsRouter = Router();
sessionsRouter.use(requireAuth, requireStaff);

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

sessionsRouter.get('/', async (req, res) => {
  const { formationId } = req.query as { formationId?: string };
  const sessions = await prisma.session.findMany({
    where: formationId ? { formationId } : undefined,
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
  const { startAt, endAt, trainerId, ...rest } = parsed.data;
  if (new Date(startAt) >= new Date(endAt)) {
    return res.status(400).json({ error: 'La date de fin doit être après la date de début' });
  }
  const session = await prisma.session.create({
    data: {
      ...rest,
      startAt: new Date(startAt),
      endAt: new Date(endAt),
      trainerId: trainerId || null,
      formationId: formation.id,
    },
    include: { formation: { select: { title: true } }, trainer: { select: { name: true } } },
  });
  res.status(201).json({ session });
});

sessionsRouter.patch('/:id', async (req, res) => {
  const parsed = sessionUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Données invalides' });
  try {
    const { startAt, endAt, trainerId, ...rest } = parsed.data;
    const session = await prisma.session.update({
      where: { id: req.params.id },
      data: {
        ...rest,
        ...(startAt ? { startAt: new Date(startAt) } : {}),
        ...(endAt ? { endAt: new Date(endAt) } : {}),
        ...(trainerId !== undefined ? { trainerId: trainerId || null } : {}),
      },
    });
    res.json({ session });
  } catch {
    res.status(404).json({ error: 'Session introuvable' });
  }
});

sessionsRouter.delete('/:id', async (req, res) => {
  try {
    await prisma.session.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: 'Session introuvable' });
  }
});

// Inscrire des contacts à une session (avec contrôle de capacité)
sessionsRouter.post('/:id/participants', async (req, res) => {
  const schema = z.object({ userIds: z.array(z.string()).min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'userIds requis' });
  const session = await prisma.session.findUnique({
    where: { id: req.params.id },
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
sessionsRouter.patch('/:id/participants/:userId', async (req, res) => {
  const schema = z.object({ attended: z.boolean() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'attended (booléen) requis' });
  try {
    const participant = await prisma.sessionParticipant.update({
      where: { sessionId_userId: { sessionId: req.params.id, userId: req.params.userId } },
      data: { attended: parsed.data.attended },
    });
    res.json({ participant });
  } catch {
    res.status(404).json({ error: 'Participant introuvable' });
  }
});

sessionsRouter.delete('/:id/participants/:userId', async (req, res) => {
  try {
    await prisma.sessionParticipant.delete({
      where: { sessionId_userId: { sessionId: req.params.id, userId: req.params.userId } },
    });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: 'Participant introuvable' });
  }
});
