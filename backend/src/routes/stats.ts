import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireGestion } from '../lib/auth.js';

export const statsRouter = Router();
statsRouter.use(requireAuth, requireGestion);

// Tableau de bord : toutes les agrégations en un appel
statsRouter.get('/dashboard', async (_req, res) => {
  const now = new Date();
  const d30 = new Date(Date.now() - 30 * 24 * 3600 * 1000);

  const [
    learnersTotal,
    formationsByStatus,
    formationsByMode,
    lessonsTotal,
    lessonsWithVideo,
    enrollmentsTotal,
    enrollments30d,
    sessionsUpcoming,
    sessionsPast,
    participantsTotal,
    participantsAttended,
    completedLessons,
    activeLearners,
    recentEnrollments,
    recentFormations,
  ] = await Promise.all([
    prisma.user.count({ where: { role: 'APPRENANT' } }),
    prisma.formation.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.formation.groupBy({ by: ['mode'], _count: { _all: true } }),
    prisma.lesson.count(),
    prisma.lesson.count({ where: { videoPath: { not: null } } }),
    prisma.enrollment.count(),
    prisma.enrollment.count({ where: { grantedAt: { gte: d30 } } }),
    prisma.session.count({ where: { endAt: { gte: now } } }),
    prisma.session.count({ where: { endAt: { lt: now } } }),
    prisma.sessionParticipant.count(),
    prisma.sessionParticipant.count({ where: { attended: true } }),
    prisma.lessonProgress.count({ where: { completed: true } }),
    prisma.lessonProgress.findMany({
      where: { updatedAt: { gte: d30 } },
      distinct: ['userId'],
      select: { userId: true },
    }),
    prisma.enrollment.findMany({
      take: 5,
      orderBy: { grantedAt: 'desc' },
      include: {
        user: { select: { id: true, name: true } },
        formation: { select: { id: true, title: true } },
        grantedBy: { select: { name: true } },
      },
    }),
    prisma.formation.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, title: true, status: true, mode: true, createdAt: true,
        _count: { select: { sections: true, enrollments: true } },
      },
    }),
  ]);

  const byKey = (rows: Array<Record<string, any>>, key: string) =>
    Object.fromEntries(rows.map((r) => [r[key], r._count._all as number]));

  const sumValues = (obj: Record<string, number>) =>
    Object.values(obj).reduce((a, b) => a + b, 0);

  res.json({
    learnersTotal,
    formations: {
      total: sumValues(byKey(formationsByStatus, 'status')),
      byStatus: byKey(formationsByStatus, 'status'),
      byMode: byKey(formationsByMode, 'mode'),
    },
    lessons: { total: lessonsTotal, withVideo: lessonsWithVideo },
    enrollments: { total: enrollmentsTotal, last30d: enrollments30d },
    activeLearners30d: activeLearners.length,
    sessions: {
      upcoming: sessionsUpcoming,
      past: sessionsPast,
      participantsTotal,
      participantsAttended,
    },
    completedLessons,
    recentEnrollments: recentEnrollments.map((e) => ({
      id: e.id,
      grantedAt: e.grantedAt,
      selfEnrolled: e.grantedById === null,
      learner: e.user,
      formation: e.formation,
      grantedByName: e.grantedBy?.name ?? null,
    })),
    recentFormations,
  });
});

// ── Analytics pédagogiques ────────────────────────────────────────────

statsRouter.get('/pedagogique', async (_req, res) => {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);
  const d30 = new Date(Date.now() - 30 * 24 * 3600 * 1000);

  // Inscriptions par mois (6 derniers mois)
  const enrollments = await prisma.enrollment.findMany({
    where: { grantedAt: { gte: sixMonthsAgo } },
    select: { grantedAt: true, grantedById: true },
  });
  const enrollmentsByMonth: Record<string, number> = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    enrollmentsByMonth[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`] = 0;
  }
  for (const e of enrollments) {
    const key = `${e.grantedAt.getFullYear()}-${String(e.grantedAt.getMonth() + 1).padStart(2, '0')}`;
    if (key in enrollmentsByMonth) enrollmentsByMonth[key] += 1;
  }
  const selfEnrolled = enrollments.filter((e) => e.grantedById === null).length;

  // Top formations : inscrits + complétion moyenne
  const formations = await prisma.formation.findMany({
    where: { status: 'PUBLISHED' },
    select: {
      id: true, title: true,
      _count: { select: { enrollments: true, sections: true } },
      sections: { include: { lessons: { select: { id: true } } } },
    },
  });
  const topFormations = [];
  for (const f of formations) {
    const lessonIds = f.sections.flatMap((s) => s.lessons.map((l) => l.id));
    const completed = lessonIds.length
      ? await prisma.lessonProgress.count({
          where: { lessonId: { in: lessonIds }, completed: true },
        })
      : 0;
    topFormations.push({
      id: f.id,
      title: f.title,
      learners: f._count.enrollments,
      avgCompletion: lessonIds.length
        ? Math.round((completed / (lessonIds.length * Math.max(f._count.enrollments, 1))) * 100)
        : 0,
    });
  }
  topFormations.sort((a, b) => b.learners - a.learners);

  // Quiz : moyenne des scores par formation
  const attempts = await prisma.quizAttempt.findMany({
    include: {
      lesson: {
        select: { section: { select: { formation: { select: { id: true, title: true } } } } },
      },
    },
  });
  const quizByFormation: Record<string, { title: string; scores: number[] }> = {};
  for (const a of attempts) {
    const f = a.lesson.section.formation;
    quizByFormation[f.id] ??= { title: f.title, scores: [] };
    quizByFormation[f.id].scores.push(a.total ? (a.score / a.total) * 100 : 0);
  }
  const quizAverages = Object.entries(quizByFormation).map(([id, v]) => ({
    id,
    title: v.title,
    avgScore: Math.round(v.scores.reduce((s, x) => s + x, 0) / v.scores.length),
    attempts: v.scores.length,
  }));

  // Engagement : apprenants actifs sur 30 jours
  const activeLearners = await prisma.lessonProgress.findMany({
    where: { updatedAt: { gte: d30 } },
    distinct: ['userId'],
    select: { userId: true },
  });

  res.json({
    enrollmentsByMonth,
    selfEnrolled,
    grantedEnrollments: enrollments.length - selfEnrolled,
    activeLearners30d: activeLearners.length,
    topFormations: topFormations.slice(0, 5),
    quizAverages,
  });
});
