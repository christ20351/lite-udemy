import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireStaff } from '../lib/auth.js';

export const statsRouter = Router();
statsRouter.use(requireAuth, requireStaff);

// Tableau de bord staff : toutes les agrégations en un appel
statsRouter.get('/dashboard', async (_req, res) => {
  const now = new Date();

  const [
    clientsByStatus,
    contactsTotal,
    formationsByStatus,
    formationsByMode,
    lessonsTotal,
    lessonsWithVideo,
    subsByStatus,
    subsSeats,
    accessesTotal,
    sessionsUpcoming,
    sessionsPast,
    participantsTotal,
    participantsAttended,
    completedLessons,
    recentInteractions,
    recentFormations,
  ] = await Promise.all([
    prisma.client.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.user.count({ where: { role: 'CONTACT' } }),
    prisma.formation.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.formation.groupBy({ by: ['mode'], _count: { _all: true } }),
    prisma.lesson.count(),
    prisma.lesson.count({ where: { videoPath: { not: null } } }),
    prisma.subscription.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.subscription.aggregate({ _sum: { seats: true } }),
    prisma.access.count(),
    prisma.session.count({ where: { endAt: { gte: now } } }),
    prisma.session.count({ where: { endAt: { lt: now } } }),
    prisma.sessionParticipant.count(),
    prisma.sessionParticipant.count({ where: { attended: true } }),
    prisma.lessonProgress.count({ where: { completed: true } }),
    prisma.interaction.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        client: { select: { id: true, name: true } },
        author: { select: { name: true } },
      },
    }),
    prisma.formation.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, title: true, status: true, mode: true, createdAt: true,
        _count: { select: { sections: true, accesses: true } },
      },
    }),
  ]);

  const byKey = (rows: Array<Record<string, any>>, key: string) =>
    Object.fromEntries(rows.map((r) => [r[key], r._count._all as number]));

  const sumValues = (obj: Record<string, number>) =>
    Object.values(obj).reduce((a, b) => a + b, 0);

  res.json({
    clients: {
      total: sumValues(byKey(clientsByStatus, 'status')),
      byStatus: byKey(clientsByStatus, 'status'),
    },
    contactsTotal,
    formations: {
      total: sumValues(byKey(formationsByStatus, 'status')),
      byStatus: byKey(formationsByStatus, 'status'),
      byMode: byKey(formationsByMode, 'mode'),
    },
    lessons: { total: lessonsTotal, withVideo: lessonsWithVideo },
    subscriptions: {
      byStatus: byKey(subsByStatus, 'status'),
      seatsTotal: subsSeats._sum.seats ?? 0,
    },
    accessesTotal,
    sessions: {
      upcoming: sessionsUpcoming,
      past: sessionsPast,
      participantsTotal,
      participantsAttended,
    },
    completedLessons,
    recentInteractions,
    recentFormations,
  });
});

// ── Analytics commerciales ────────────────────────────────────────────

/** CA gagné par mois (deals WON, 6 derniers mois) */
statsRouter.get('/commercial', async (_req, res) => {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const wonDeals = await prisma.deal.findMany({
    where: { stage: 'WON', updatedAt: { gte: sixMonthsAgo } },
    select: { amount: true, updatedAt: true },
  });

  // CA par mois (clé "YYYY-MM")
  const revenueByMonth: Record<string, number> = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    revenueByMonth[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`] = 0;
  }
  for (const d of wonDeals) {
    const dt = d.updatedAt;
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    if (key in revenueByMonth) revenueByMonth[key] += d.amount ?? 0;
  }

  // Entonnoir : deals par étape
  const funnel = await prisma.deal.groupBy({ by: ['stage'], _count: { _all: true } });
  const funnelByStage = Object.fromEntries(
    funnel.map((f) => [f.stage, f._count._all])
  );

  // Top formations par accès + complétion moyenne
  const formations = await prisma.formation.findMany({
    where: { status: 'PUBLISHED' },
    select: {
      id: true, title: true,
      _count: { select: { accesses: true, sections: true } },
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
      learners: f._count.accesses,
      avgCompletion: lessonIds.length
        ? Math.round((completed / (lessonIds.length * Math.max(f._count.accesses, 1))) * 100)
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

  // Pipeline global
  const pipeline = await prisma.deal.groupBy({ by: ['stage'], _sum: { amount: true } });
  const pipelineByStage = Object.fromEntries(
    pipeline.map((p) => [p.stage, p._sum.amount ?? 0])
  );

  res.json({
    revenueByMonth,
    funnel: funnelByStage,
    pipelineByStage,
    topFormations: topFormations.slice(0, 5),
    quizAverages,
  });
});
