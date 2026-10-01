import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth, isEquipe } from '../lib/auth.js';

export const meRouter = Router();
meRouter.use(requireAuth);

// Synthèse du tableau de bord apprenant
meRouter.get('/overview', async (req, res) => {
  const accesses = await prisma.enrollment.findMany({
    where: { userId: req.user!.id },
    include: {
      formation: {
        include: { sections: { include: { lessons: { select: { id: true } } } } },
      },
    },
  });

  let totalLessons = 0;
  let completedLessons = 0;
  const byFormation: Array<{
    slug: string; title: string; percent: number; completed: number; total: number;
  }> = [];

  for (const a of accesses) {
    const lessonIds = a.formation.sections.flatMap((s) => s.lessons.map((l) => l.id));
    const done = lessonIds.length
      ? await prisma.lessonProgress.count({
          where: { userId: req.user!.id, lessonId: { in: lessonIds }, completed: true },
        })
      : 0;
    totalLessons += lessonIds.length;
    completedLessons += done;
    byFormation.push({
      slug: a.formation.slug,
      title: a.formation.title,
      total: lessonIds.length,
      completed: done,
      percent: lessonIds.length ? Math.round((done / lessonIds.length) * 100) : 0,
    });
  }
  byFormation.sort((a, b) => a.title.localeCompare(b.title));

  // Dernière leçon "en cours" (progression récente non terminée) → Reprendre
  const lastProgress = await prisma.lessonProgress.findFirst({
    where: { userId: req.user!.id, completed: false },
    orderBy: { updatedAt: 'desc' },
    include: {
      lesson: {
        select: {
          id: true, title: true,
          section: { select: { formation: { select: { slug: true, title: true } } } },
        },
      },
    },
  });
  const resume =
    lastProgress && lastProgress.lastPosition > 0
      ? {
          lessonId: lastProgress.lesson.id,
          lessonTitle: lastProgress.lesson.title,
          formationSlug: lastProgress.lesson.section.formation.slug,
          formationTitle: lastProgress.lesson.section.formation.title,
        }
      : null;

  // Prochaine session présentielle
  const nextPart = await prisma.sessionParticipant.findFirst({
    where: { userId: req.user!.id, session: { endAt: { gte: new Date() } } },
    orderBy: { session: { startAt: 'asc' } },
    include: {
      session: {
        select: {
          title: true, startAt: true, location: true,
          formation: { select: { title: true } },
        },
      },
    },
  });
  const nextSession = nextPart
    ? {
        title: nextPart.session.title,
        startAt: nextPart.session.startAt,
        location: nextPart.session.location,
        formationTitle: nextPart.session.formation.title,
      }
    : null;

  res.json({
    stats: {
      formations: accesses.length,
      totalLessons,
      completedLessons,
      percent: totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0,
    },
    byFormation,
    resume,
    nextSession,
  });
});

async function hasAccess(userId: string, formationId: string) {
  const access = await prisma.enrollment.findUnique({
    where: { userId_formationId: { userId, formationId } },
  });
  return Boolean(access);
}

// Mes formations (filtrées par accès) + pourcentage de progression
meRouter.get('/formations', async (req, res) => {
  const accesses = await prisma.enrollment.findMany({
    where: { userId: req.user!.id },
    include: {
      formation: {
        include: {
          sections: { include: { lessons: { select: { id: true } } } },
        },
      },
    },
  });
  const formations = [];
  for (const a of accesses) {
    const lessonIds = a.formation.sections.flatMap((s) => s.lessons.map((l) => l.id));
    const completed = lessonIds.length
      ? await prisma.lessonProgress.count({
          where: { userId: req.user!.id, lessonId: { in: lessonIds }, completed: true },
        })
      : 0;
    formations.push({
      id: a.formation.id,
      title: a.formation.title,
      slug: a.formation.slug,
      description: a.formation.description,
      mode: a.formation.mode,
      thumbnailUrl: a.formation.thumbnailUrl,
      price: a.formation.price,
      createdAt: a.formation.createdAt,
      isNew: Date.now() - a.formation.createdAt.getTime() < 30 * 24 * 3600 * 1000,
      grantedAt: a.grantedAt,
      totalLessons: lessonIds.length,
      completedLessons: completed,
      percent: lessonIds.length ? Math.round((completed / lessonIds.length) * 100) : 0,
    });
  }
  formations.sort((a, b) => a.title.localeCompare(b.title));
  res.json({ formations });
});

// Détail d'une formation accessible : curriculum + progression + sessions
meRouter.get('/formations/:slug', async (req, res) => {
  const formation = await prisma.formation.findUnique({
    where: { slug: req.params.slug },
    include: {
      sections: {
        orderBy: { position: 'asc' },
        include: { lessons: { orderBy: { position: 'asc' } } },
      },
      sessions: {
        orderBy: { startAt: 'asc' },
        include: {
          trainer: { select: { name: true } },
          participants: { where: { userId: req.user!.id }, select: { id: true } },
        },
      },
    },
  });
  if (!formation) return res.status(404).json({ error: 'Formation introuvable' });
  if (formation.status !== 'PUBLISHED') {
    return res.status(403).json({ error: 'Formation non publiée' });
  }
  if (!(await hasAccess(req.user!.id, formation.id))) {
    return res.status(403).json({ error: "Vous n'avez pas accès à cette formation" });
  }

  const progresses = await prisma.lessonProgress.findMany({
    where: { userId: req.user!.id, lesson: { section: { formationId: formation.id } } },
  });
  const progressByLesson = new Map(progresses.map((p) => [p.lessonId, p]));

  const sections = formation.sections.map((s) => ({
    id: s.id,
    title: s.title,
    position: s.position,
    lessons: s.lessons.map((l) => ({
      id: l.id,
      title: l.title,
      duration: l.duration,
      position: l.position,
      isPreview: l.isPreview,
      hasVideo: Boolean(l.videoPath),
      hasContent: Boolean(l.content),
      completed: progressByLesson.get(l.id)?.completed ?? false,
    })),
  }));

  res.json({
    formation: {
      id: formation.id,
      title: formation.title,
      slug: formation.slug,
      description: formation.description,
      mode: formation.mode,
    },
    sections,
    mySessions: formation.sessions.map((s) => ({
      id: s.id,
      title: s.title,
      startAt: s.startAt,
      endAt: s.endAt,
      location: s.location,
      trainer: s.trainer?.name ?? null,
      registered: s.participants.length > 0,
    })),
  });
});

// Clôturer une formation : possible uniquement depuis la dernière leçon,
// et seulement si toutes les leçons précédentes sont réellement terminées.
meRouter.post('/formations/:slug/complete', async (req, res) => {
  const formation = await prisma.formation.findUnique({
    where: { slug: req.params.slug },
    include: {
      sections: {
        orderBy: { position: 'asc' },
        include: { lessons: { orderBy: { position: 'asc' }, select: { id: true } } },
      },
    },
  });
  if (!formation) return res.status(404).json({ error: 'Formation introuvable' });
  if (formation.status !== 'PUBLISHED') {
    return res.status(403).json({ error: 'Formation non publiée' });
  }
  if (!isEquipe(req.user!.role) && !(await hasAccess(req.user!.id, formation.id))) {
    return res.status(403).json({ error: "Vous n'avez pas accès à cette formation" });
  }

  const lessonIds = formation.sections.flatMap((s) => s.lessons.map((l) => l.id));
  if (lessonIds.length === 0) {
    return res.status(400).json({ error: 'Cette formation ne contient aucune leçon' });
  }

  const others = lessonIds.slice(0, -1);
  const doneOthers = others.length
    ? await prisma.lessonProgress.count({
        where: { userId: req.user!.id, lessonId: { in: others }, completed: true },
      })
    : 0;
  if (doneOthers < others.length) {
    return res.status(409).json({
      error: `Impossible de terminer la formation : ${others.length - doneOthers} leçon(s) restante(s) à terminer.`,
    });
  }

  // Toutes les leçons précédentes sont terminées : on clôture la dernière.
  const lastLessonId = lessonIds[lessonIds.length - 1];
  await prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId: req.user!.id, lessonId: lastLessonId } },
    update: { completed: true, updatedAt: new Date() },
    create: { userId: req.user!.id, lessonId: lastLessonId, completed: true, lastPosition: 0 },
  });

  await prisma.notification.create({
    data: {
      userId: req.user!.id,
      type: 'FORMATION_COMPLETED',
      title: 'Formation terminée 🎉',
      body: `Bravo, vous avez terminé « ${formation.title} » !`,
      link: '/mes-formations',
    },
  });

  res.json({ ok: true, formation: { slug: formation.slug, title: formation.title } });
});

// Contenu d'une leçon (protégé) + position de reprise
meRouter.get('/lessons/:lessonId', async (req, res) => {
  const lesson = await prisma.lesson.findUnique({
    where: { id: (req.params.lessonId as string) },
    include: {
      section: {
        include: { formation: { select: { id: true, title: true, slug: true, status: true } } },
      },
      quiz: { select: { id: true } },
    },
  });
  if (!lesson) return res.status(404).json({ error: 'Leçon introuvable' });
  const formation = lesson.section.formation;
  if (formation.status !== 'PUBLISHED') {
    return res.status(403).json({ error: 'Formation non publiée' });
  }
  // Staff : accès complet. Contact : accès requis (ou leçon preview).
  if (!isEquipe(req.user!.role)) {
    const allowed = lesson.isPreview || (await hasAccess(req.user!.id, formation.id));
    if (!allowed) return res.status(403).json({ error: "Vous n'avez pas accès à cette leçon" });
  }

  const progress = await prisma.lessonProgress.findUnique({
    where: { userId_lessonId: { userId: req.user!.id, lessonId: lesson.id } },
  });

  // Leçons voisines pour la navigation
  const siblings = await prisma.lesson.findMany({
    where: { section: { formationId: formation.id } },
    orderBy: [{ section: { position: 'asc' } }, { position: 'asc' }],
    select: { id: true, title: true },
  });
  const idx = siblings.findIndex((l) => l.id === lesson.id);

  const bestAttempt = await prisma.quizAttempt.findUnique({
    where: { userId_lessonId: { userId: req.user!.id, lessonId: lesson.id } },
  });

  // Progression globale de la formation (pour autoriser la clôture)
  const totalLessons = siblings.length;
  const completedLessons = totalLessons
    ? await prisma.lessonProgress.count({
        where: { userId: req.user!.id, lessonId: { in: siblings.map((l) => l.id) }, completed: true },
      })
    : 0;

  res.json({
    lesson: {
      id: lesson.id,
      title: lesson.title,
      content: lesson.content,
      blocks: (lesson.blocks as Array<Record<string, unknown>> | null) ?? null,
      videoPath: lesson.videoPath,
      duration: lesson.duration,
      isPreview: lesson.isPreview,
      hasQuiz: Boolean(lesson.quiz),
    },
    formation: { id: formation.id, title: formation.title, slug: formation.slug },
    lastPosition: progress?.lastPosition ?? 0,
    completed: progress?.completed ?? false,
    isLast: totalLessons > 0 && idx === totalLessons - 1,
    formationProgress: { totalLessons, completedLessons },
    bestQuizScore: bestAttempt ? { score: bestAttempt.score, total: bestAttempt.total } : null,
    prev: idx > 0 ? siblings[idx - 1] : null,
    next: idx < siblings.length - 1 ? siblings[idx + 1] : null,
  });
});

const progressSchema = z.object({
  lastPosition: z.number().int().min(0).optional(),
  completed: z.boolean().optional(),
});

// Mettre à jour la progression d'une leçon
meRouter.put('/lessons/:lessonId/progress', async (req, res) => {
  const parsed = progressSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Données invalides' });
  const lesson = await prisma.lesson.findUnique({
    where: { id: (req.params.lessonId as string) },
    include: { section: { include: { formation: { select: { id: true, status: true } } } } },
  });
  if (!lesson) return res.status(404).json({ error: 'Leçon introuvable' });
  if (lesson.section.formation.status !== 'PUBLISHED') {
    return res.status(403).json({ error: 'Formation non publiée' });
  }
  if (!isEquipe(req.user!.role) && !(await hasAccess(req.user!.id, lesson.section.formationId))) {
    return res.status(403).json({ error: "Vous n'avez pas accès à cette formation" });
  }

  const data = {
    ...(parsed.data.lastPosition !== undefined ? { lastPosition: parsed.data.lastPosition } : {}),
    ...(parsed.data.completed !== undefined ? { completed: parsed.data.completed } : {}),
  };
  const progress = await prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId: req.user!.id, lessonId: lesson.id } },
    update: { ...data, updatedAt: new Date() },
    create: {
      userId: req.user!.id,
      lessonId: lesson.id,
      lastPosition: parsed.data.lastPosition ?? 0,
      completed: parsed.data.completed ?? false,
    },
  });
  res.json({ progress });
});

// Mes sessions présentielles à venir
meRouter.get('/sessions', async (req, res) => {
  const participations = await prisma.sessionParticipant.findMany({
    where: { userId: req.user!.id },
    include: {
      session: {
        include: {
          formation: { select: { title: true, slug: true } },
          trainer: { select: { name: true } },
        },
      },
    },
  });
  const sessions = participations
    .map((p) => ({
      id: p.session.id,
      title: p.session.title,
      startAt: p.session.startAt,
      endAt: p.session.endAt,
      location: p.session.location,
      attended: p.attended,
      formationTitle: p.session.formation.title,
      trainer: p.session.trainer?.name ?? null,
    }))
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  res.json({ sessions });
});

// ── Notifications internes ────────────────────────────────────────────

meRouter.get('/notifications', async (req, res) => {
  const [notifications, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
    prisma.notification.count({ where: { userId: req.user!.id, read: false } }),
  ]);
  res.json({ notifications, unread });
});

meRouter.patch('/notifications/:id/read', async (req, res) => {
  const notification = await prisma.notification.findUnique({
    where: { id: (req.params.id as string) },
  });
  if (!notification || notification.userId !== req.user!.id) {
    return res.status(404).json({ error: 'Notification introuvable' });
  }
  const updated = await prisma.notification.update({
    where: { id: notification.id },
    data: { read: true },
  });
  res.json({ notification: updated });
});

meRouter.post('/notifications/read-all', async (req, res) => {
  await prisma.notification.updateMany({
    where: { userId: req.user!.id, read: false },
    data: { read: true },
  });
  res.json({ ok: true });
});
