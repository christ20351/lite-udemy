import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireStaff } from '../lib/auth.js';

export const formationsRouter = Router();
formationsRouter.use(requireAuth, requireStaff);

const formationSchema = z.object({
  title: z.string().min(3),
  description: z.string().nullish(),
  category: z.string().nullish(),
  mode: z.enum(['ONLINE', 'ONSITE', 'HYBRID']).default('ONLINE'),
  thumbnailUrl: z.string().nullish(),
  /// null/absent = gratuite
  price: z.number().nonnegative().nullish(),
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

formationsRouter.get('/', async (_req, res) => {
  const formations = await prisma.formation.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { sections: true, sessions: true, accesses: true } },
    },
  });
  res.json({ formations });
});

formationsRouter.post('/', async (req, res) => {
  const parsed = formationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Titre requis (3+ caractères)' });
  const { title, ...rest } = parsed.data;
  const formation = await prisma.formation.create({
    data: { title, slug: await uniqueSlug(slugify(title)), ...rest },
  });
  res.status(201).json({ formation });
});

formationsRouter.get('/:id', async (req, res) => {
  const formation = await prisma.formation.findUnique({
    where: { id: req.params.id },
    include: {
      sections: { orderBy: { position: 'asc' }, include: { lessons: { orderBy: { position: 'asc' } } } },
      sessions: { orderBy: { startAt: 'asc' }, include: { _count: { select: { participants: true } } } },
    },
  });
  if (!formation) return res.status(404).json({ error: 'Formation introuvable' });
  res.json({ formation });
});

formationsRouter.patch('/:id', async (req, res) => {
  const parsed = formationSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Données invalides' });
  try {
    const formation = await prisma.formation.update({ where: { id: req.params.id }, data: parsed.data });
    res.json({ formation });
  } catch {
    res.status(404).json({ error: 'Formation introuvable' });
  }
});

formationsRouter.delete('/:id', async (req, res) => {
  try {
    await prisma.formation.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: 'Formation introuvable' });
  }
});

formationsRouter.post('/:id/publish', async (req, res) => {
  const lessonCount = await prisma.lesson.count({
    where: { section: { formationId: req.params.id } },
  });
  if (lessonCount === 0) {
    return res.status(400).json({ error: 'Ajoutez au moins une leçon avant de publier' });
  }
  const formation = await prisma.formation.update({
    where: { id: req.params.id },
    data: { status: 'PUBLISHED' },
  });
  res.json({ formation });
});

formationsRouter.post('/:id/unpublish', async (req, res) => {
  const formation = await prisma.formation.update({
    where: { id: req.params.id },
    data: { status: 'DRAFT' },
  });
  res.json({ formation });
});

// Contacts ayant accès à la formation (pour inscrire aux sessions)
formationsRouter.get('/:id/accesses', async (req, res) => {
  const accesses = await prisma.access.findMany({
    where: { formationId: req.params.id },
    include: {
      user: {
        select: { id: true, name: true, email: true, client: { select: { name: true } } },
      },
    },
  });
  res.json({ accesses });
});

// ── Curriculum : sections ─────────────────────────────────────────────

formationsRouter.post('/:id/sections', async (req, res) => {
  const parsed = sectionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Titre requis' });
  const formation = await prisma.formation.findUnique({ where: { id: req.params.id } });
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
  try {
    const section = await prisma.section.update({
      where: { id: req.params.sectionId },
      data: parsed.data,
    });
    res.json({ section });
  } catch {
    res.status(404).json({ error: 'Section introuvable' });
  }
});

formationsRouter.delete('/sections/:sectionId', async (req, res) => {
  try {
    await prisma.section.delete({ where: { id: req.params.sectionId } });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: 'Section introuvable' });
  }
});

// ── Curriculum : leçons ───────────────────────────────────────────────

formationsRouter.post('/sections/:sectionId/lessons', async (req, res) => {
  const parsed = lessonSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Titre requis' });
  const section = await prisma.section.findUnique({ where: { id: req.params.sectionId } });
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
  try {
    const { blocks, ...rest } = parsed.data;
    const lesson = await prisma.lesson.update({
      where: { id: req.params.lessonId },
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
  try {
    await prisma.lesson.delete({ where: { id: req.params.lessonId } });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: 'Leçon introuvable' });
  }
});
