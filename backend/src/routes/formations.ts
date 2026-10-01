import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import {
  requireAuth,
  requireGestion,
  canManageFormation,
  canManageSection,
  canManageLesson,
} from '../lib/auth.js';

export const formationsRouter = Router();
formationsRouter.use(requireAuth);

const formationSchema = z.object({
  title: z.string().min(3),
  description: z.string().nullish(),
  category: z.string().nullish(),
  mode: z.enum(['ONLINE', 'ONSITE', 'HYBRID']).default('ONLINE'),
  thumbnailUrl: z.string().nullish(),
  /// null/absent = gratuite
  price: z.number().nonnegative().nullish(),
  /// Formateur chargé du contenu, lié dès la création
  instructorId: z.string().min(1).nullish(),
});

const sectionSchema = z.object({ title: z.string().min(1), position: z.number().int().optional() });

const blockSchema = z.object({
  type: z.enum(['text', 'image', 'code', 'callout']),
  text: z.string().nullish(),
  url: z.string().nullish(),
  caption: z.string().nullish(),
});

const lessonSchema = z.object({
  title: z.string().min(1),
  content: z.string().nullish(),
  blocks: z.array(blockSchema).nullish(),
  videoPath: z.string().nullish(),
  duration: z.number().int().nullish(),
  position: z.number().int().optional(),
  isPreview: z.boolean().default(false),
});

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

async function uniqueSlug(base: string) {
  let slug = base || 'formation';
  let i = 1;
  while (await prisma.formation.findUnique({ where: { slug } })) {
    i += 1;
    slug = `${base}-${i}`;
  }
  return slug;
}

// ── CRUD formation ────────────────────────────────────────────────────

// L'équipe voit le catalogue back-office ; un formateur ne voit que
// les formations qui lui sont assignées.
formationsRouter.get('/', async (req, res) => {
  const formations = await prisma.formation.findMany({
    where:
      req.user!.role === 'FORMATEUR'
        ? { instructors: { some: { id: req.user!.id } } }
        : undefined,
    orderBy: { createdAt: 'desc' },
    include: {
      instructors: { select: { id: true, name: true } },
      _count: { select: { sections: true, sessions: true, enrollments: true } },
    },
  });
  res.json({ formations });
});

/** Notifie un formateur qu'une formation lui est assignée. */
async function notifierAssignation(
  formateurId: string,
  formation: { id: string; title: string },
  byName: string
) {
  await prisma.notification.create({
    data: {
      userId: formateurId,
      type: 'FORMATION_ASSIGNED',
      title: `Nouvelle formation assignée : « ${formation.title} »`,
      body: `${byName} vous a confié cette formation. Construisez son contenu (sections, leçons, quiz) puis la gestion la publiera.`,
      link: `/backoffice/formations/${formation.id}`,
    },
  });
}

// Seuls ADMIN et GESTIONNAIRE créent une formation (coquille) en la liant
// directement à un formateur qui construira le contenu.
formationsRouter.post('/', requireGestion, async (req, res) => {
  const parsed = formationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Titre requis (3+ caractères)' });
  const { title, instructorId, ...rest } = parsed.data;

  let connectInstructor: { id: string } | undefined;
  if (instructorId) {
    const formateur = await prisma.user.findUnique({ where: { id: instructorId } });
    if (!formateur || formateur.role !== 'FORMATEUR') {
      return res.status(400).json({ error: 'Formateur introuvable (rôle FORMATEUR requis)' });
    }
    connectInstructor = { id: formateur.id };
  }

  const formation = await prisma.formation.create({
    data: {
      title,
      slug: await uniqueSlug(slugify(title)),
      ...rest,
      ...(connectInstructor ? { instructors: { connect: connectInstructor } } : {}),
    },
  });
  if (connectInstructor) {
    await notifierAssignation(connectInstructor.id, formation, req.user!.name);
  }
  res.status(201).json({ formation });
});

formationsRouter.get('/:id', async (req, res) => {
  const formation = await prisma.formation.findUnique({
    where: { id: (req.params.id as string) },
    include: {
      instructors: { select: { id: true, name: true, email: true } },
      sections: { orderBy: { position: 'asc' }, include: { lessons: { orderBy: { position: 'asc' } } } },
      sessions: { orderBy: { startAt: 'asc' }, include: { _count: { select: { participants: true } } } },
    },
  });
  if (!formation) return res.status(404).json({ error: 'Formation introuvable' });
  if (!(await canManageFormation(req.user!, formation.id))) {
    return res.status(403).json({ error: 'Formation non assignée' });
  }
  res.json({ formation });
});

// Métadonnées (titre, prix, description…) : ADMIN et GESTIONNAIRE.
// Le contenu pédagogique appartient au formateur.
formationsRouter.patch('/:id', requireGestion, async (req, res) => {
  const parsed = formationSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Données invalides' });
  try {
    const formation = await prisma.formation.update({ where: { id: (req.params.id as string) }, data: parsed.data });
    res.json({ formation });
  } catch {
    res.status(404).json({ error: 'Formation introuvable' });
  }
});

formationsRouter.delete('/:id', requireGestion, async (req, res) => {
  try {
    await prisma.formation.delete({ where: { id: (req.params.id as string) } });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: 'Formation introuvable' });
  }
});

// La publication décide de ce que voient les apprenants : réservé à la gestion.
formationsRouter.post('/:id/publish', requireGestion, async (req, res) => {
  const lessonCount = await prisma.lesson.count({
    where: { section: { formationId: (req.params.id as string) } },
  });
  if (lessonCount === 0) {
    return res.status(400).json({ error: 'Ajoutez au moins une leçon avant de publier' });
  }
  const formation = await prisma.formation.update({
    where: { id: (req.params.id as string) },
    data: { status: 'PUBLISHED' },
  });
  res.json({ formation });
});

formationsRouter.post('/:id/unpublish', requireGestion, async (req, res) => {
  const formation = await prisma.formation.update({
    where: { id: (req.params.id as string) },
    data: { status: 'DRAFT' },
  });
  res.json({ formation });
});

// Le formateur signale à la gestion que le contenu est prêt (ou vient d'être
// mis à jour) : chaque ADMIN / GESTIONNAIRE reçoit une notification cliquable.
formationsRouter.post('/:id/notify-ready', async (req, res) => {
  const formation = await prisma.formation.findUnique({
    where: { id: (req.params.id as string) },
    select: { id: true, title: true, status: true },
  });
  if (!formation) return res.status(404).json({ error: 'Formation introuvable' });
  if (!(await canManageFormation(req.user!, formation.id))) {
    return res.status(403).json({ error: 'Formation non assignée' });
  }

  const lessonCount = await prisma.lesson.count({
    where: { section: { formationId: formation.id } },
  });
  if (lessonCount === 0) {
    return res.status(400).json({ error: "Ajoutez d'abord au moins une leçon à cette formation" });
  }

  const message =
    typeof (req.body as { message?: unknown }).message === 'string'
      ? (req.body as { message: string }).message.trim().slice(0, 300)
      : '';

  const destinataires = await prisma.user.findMany({
    where: {
      role: { in: ['ADMIN', 'GESTIONNAIRE'] },
      id: { not: req.user!.id },
    },
    select: { id: true },
  });
  if (destinataires.length > 0) {
    await prisma.notification.createMany({
      data: destinataires.map((u) => ({
        userId: u.id,
        type: 'FORMATION_READY',
        title: `« ${formation.title} » : contenu ${formation.status === 'PUBLISHED' ? 'mis à jour' : 'prêt à relire'}`,
        body: `${req.user!.name} — ${lessonCount} leçon${lessonCount > 1 ? 's' : ''} en place.${message ? ` Message : ${message}` : ''}`,
        link: `/backoffice/formations/${formation.id}`,
      })),
    });
  }
  res.json({ ok: true, notified: destinataires.length });
});

// ── Assignation des formateurs ────────────────────────────────────────

// Formateurs assignables (pour le sélecteur de la gestion)
formationsRouter.get('/formateurs/options', requireGestion, async (_req, res) => {
  const formateurs = await prisma.user.findMany({
    where: { role: 'FORMATEUR' },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, email: true },
  });
  res.json({ formateurs });
});

formationsRouter.get('/:id/instructors', requireGestion, async (req, res) => {
  const formation = await prisma.formation.findUnique({
    where: { id: (req.params.id as string) },
    include: { instructors: { select: { id: true, name: true, email: true } } },
  });
  if (!formation) return res.status(404).json({ error: 'Formation introuvable' });
  res.json({ instructors: formation.instructors });
});

formationsRouter.post('/:id/instructors', requireGestion, async (req, res) => {
  const parsed = z.object({ userId: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'userId requis' });
  const formation = await prisma.formation.findUnique({ where: { id: (req.params.id as string) } });
  if (!formation) return res.status(404).json({ error: 'Formation introuvable' });
  const formateur = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  if (!formateur || formateur.role !== 'FORMATEUR') {
    return res.status(404).json({ error: 'Formateur introuvable (rôle FORMATEUR requis)' });
  }
  await prisma.formation.update({
    where: { id: formation.id },
    data: { instructors: { connect: { id: formateur.id } } },
  });
  await notifierAssignation(formateur.id, formation, req.user!.name);
  res.json({ ok: true });
});

formationsRouter.delete('/:id/instructors/:userId', requireGestion, async (req, res) => {
  const formation = await prisma.formation.findUnique({ where: { id: (req.params.id as string) } });
  if (!formation) return res.status(404).json({ error: 'Formation introuvable' });
  await prisma.formation.update({
    where: { id: formation.id },
    data: { instructors: { disconnect: { id: (req.params.userId as string) } } },
  });
  res.json({ ok: true });
});

// ── Inscriptions à la formation ───────────────────────────────────────

// Apprenants inscrits (pour suivre l'audience, inscrire aux sessions…)
formationsRouter.get('/:id/enrollments', async (req, res) => {
  if (!(await canManageFormation(req.user!, (req.params.id as string)))) {
    return res.status(403).json({ error: 'Formation non assignée' });
  }
  const enrollments = await prisma.enrollment.findMany({
    where: { formationId: (req.params.id as string) },
    include: {
      user: { select: { id: true, name: true, email: true } },
      grantedBy: { select: { name: true } },
    },
    orderBy: { grantedAt: 'desc' },
  });
  res.json({ enrollments });
});

// ── Curriculum : sections ─────────────────────────────────────────────

formationsRouter.post('/:id/sections', async (req, res) => {
  const parsed = sectionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Titre requis' });
  if (!(await canManageFormation(req.user!, (req.params.id as string)))) {
    return res.status(403).json({ error: 'Formation non assignée' });
  }
  const formation = await prisma.formation.findUnique({ where: { id: (req.params.id as string) } });
  if (!formation) return res.status(404).json({ error: 'Formation introuvable' });
  const last = await prisma.section.findFirst({
    where: { formationId: formation.id },
    orderBy: { position: 'desc' },
  });
  const section = await prisma.section.create({
    data: {
      title: parsed.data.title,
      formationId: formation.id,
      position: parsed.data.position ?? (last ? last.position + 1 : 1),
    },
  });
  res.status(201).json({ section });
});

formationsRouter.patch('/sections/:sectionId', async (req, res) => {
  const parsed = sectionSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Données invalides' });
  if (!(await canManageSection(req.user!, (req.params.sectionId as string)))) {
    return res.status(403).json({ error: 'Formation non assignée' });
  }
  try {
    const section = await prisma.section.update({
      where: { id: (req.params.sectionId as string) },
      data: parsed.data,
    });
    res.json({ section });
  } catch {
    res.status(404).json({ error: 'Section introuvable' });
  }
});

formationsRouter.delete('/sections/:sectionId', async (req, res) => {
  if (!(await canManageSection(req.user!, (req.params.sectionId as string)))) {
    return res.status(403).json({ error: 'Formation non assignée' });
  }
  try {
    await prisma.section.delete({ where: { id: (req.params.sectionId as string) } });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: 'Section introuvable' });
  }
});

// ── Curriculum : leçons ───────────────────────────────────────────────

formationsRouter.post('/sections/:sectionId/lessons', async (req, res) => {
  const parsed = lessonSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Titre requis' });
  if (!(await canManageSection(req.user!, (req.params.sectionId as string)))) {
    return res.status(403).json({ error: 'Formation non assignée' });
  }
  const section = await prisma.section.findUnique({ where: { id: (req.params.sectionId as string) } });
  if (!section) return res.status(404).json({ error: 'Section introuvable' });
  const last = await prisma.lesson.findFirst({
    where: { sectionId: section.id },
    orderBy: { position: 'desc' },
  });
  const lesson = await prisma.lesson.create({
    data: {
      title: parsed.data.title,
      content: parsed.data.content ?? null,
      videoPath: parsed.data.videoPath ?? null,
      duration: parsed.data.duration ?? null,
      isPreview: parsed.data.isPreview,
      sectionId: section.id,
      position: parsed.data.position ?? (last ? last.position + 1 : 1),
    },
  });
  res.status(201).json({ lesson });
});

formationsRouter.patch('/lessons/:lessonId', async (req, res) => {
  const parsed = lessonSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Données invalides' });
  if (!(await canManageLesson(req.user!, (req.params.lessonId as string)))) {
    return res.status(403).json({ error: 'Formation non assignée' });
  }
  try {
    const { blocks, ...rest } = parsed.data;
    const lesson = await prisma.lesson.update({
      where: { id: (req.params.lessonId as string) },
      data: {
        ...rest,
        // Json nullable : Prisma exige DbNull plutôt que null
        ...(blocks !== undefined
          ? { blocks: blocks === null ? Prisma.DbNull : blocks }
          : {}),
      },
    });
    res.json({ lesson });
  } catch (e) {
    console.error(e);
    res.status(404).json({ error: 'Leçon introuvable' });
  }
});

formationsRouter.delete('/lessons/:lessonId', async (req, res) => {
  if (!(await canManageLesson(req.user!, (req.params.lessonId as string)))) {
    return res.status(403).json({ error: 'Formation non assignée' });
  }
  try {
    await prisma.lesson.delete({ where: { id: (req.params.lessonId as string) } });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: 'Leçon introuvable' });
  }
});
