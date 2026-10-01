import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireEquipe, isGestion } from '../lib/auth.js';

/** Suivi des apprenants par l'équipe.
 *  ADMIN / GESTIONNAIRE : tous les apprenants.
 *  FORMATEUR : uniquement les apprenants inscrits à ses formations. */
export const learnersRouter = Router();
learnersRouter.use(requireAuth, requireEquipe);

function learnerScope(req: { user?: { id: string; role: string } }) {
  // Le formateur ne voit que les inscriptions aux formations qui lui sont assignées
  const formateurOnly = req.user!.role === 'FORMATEUR';
  return {
    formateurOnly,
    enrollmentWhere: formateurOnly
      ? { formation: { instructors: { some: { id: req.user!.id } } } }
      : undefined,
  };
}

// Liste des apprenants (avec recherche nom/email)
learnersRouter.get('/', async (req, res) => {
  const { formateurOnly, enrollmentWhere } = learnerScope(req);
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

  const learners = await prisma.user.findMany({
    where: {
      role: 'APPRENANT',
      ...(formateurOnly ? { enrollments: { some: enrollmentWhere! } } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      enrollments: {
        ...(enrollmentWhere ? { where: enrollmentWhere } : {}),
        select: { formation: { select: { id: true, title: true } } },
        orderBy: { grantedAt: 'desc' },
      },
      _count: { select: { progresses: true } },
    },
  });

  // Leçons réellement terminées par apprenant (progresses compte les lignes, pas les complétions)
  const completed = await prisma.lessonProgress.groupBy({
    by: ['userId'],
    where: { completed: true, userId: { in: learners.map((l) => l.id) } },
    _count: { _all: true },
  });
  const completedByUser = new Map(completed.map((c) => [c.userId, c._count._all]));

  res.json({
    learners: learners.map((l) => ({
      id: l.id,
      name: l.name,
      email: l.email,
      createdAt: l.createdAt,
      formations: l.enrollments.map((e) => e.formation),
      completedLessons: completedByUser.get(l.id) ?? 0,
      startedLessons: l._count.progresses,
    })),
  });
});

// Détail d'un apprenant : inscriptions avec progression, quiz, sessions
learnersRouter.get('/:id', async (req, res) => {
  const { formateurOnly, enrollmentWhere } = learnerScope(req);

  const learner = await prisma.user.findFirst({
    where: { id: (req.params.id as string), role: 'APPRENANT' },
    select: { id: true, name: true, email: true, createdAt: true },
  });
  if (!learner) return res.status(404).json({ error: 'Apprenant introuvable' });

  const enrollments = await prisma.enrollment.findMany({
    where: { userId: learner.id, ...(enrollmentWhere ? enrollmentWhere : {}) },
    include: {
      formation: {
        include: { sections: { include: { lessons: { select: { id: true } } } } },
      },
      grantedBy: { select: { name: true } },
    },
    orderBy: { grantedAt: 'desc' },
  });
  // Un formateur ne doit voir un apprenant que s'il partage au moins une formation
  if (formateurOnly && enrollments.length === 0) {
    return res.status(403).json({ error: 'Cet apprenant ne suit aucune de vos formations' });
  }

  const formations = [];
  for (const e of enrollments) {
    const lessonIds = e.formation.sections.flatMap((s) => s.lessons.map((l) => l.id));
    const done = lessonIds.length
      ? await prisma.lessonProgress.count({
          where: { userId: learner.id, lessonId: { in: lessonIds }, completed: true },
        })
      : 0;
    formations.push({
      id: e.formation.id,
      title: e.formation.title,
      mode: e.formation.mode,
      grantedAt: e.grantedAt,
      grantedByName: e.grantedBy?.name ?? null,
      selfEnrolled: e.grantedById === null,
      totalLessons: lessonIds.length,
      completedLessons: done,
      percent: lessonIds.length ? Math.round((done / lessonIds.length) * 100) : 0,
    });
  }

  const attempts = await prisma.quizAttempt.findMany({
    where: {
      userId: learner.id,
      ...(enrollmentWhere ? { lesson: { section: { formation: enrollmentWhere.formation } } } : {}),
    },
    include: {
      lesson: {
        select: {
          title: true,
          section: { select: { formation: { select: { title: true } } } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  const participations = await prisma.sessionParticipant.findMany({
    where: { userId: learner.id },
    include: {
      session: {
        include: { formation: { select: { title: true } } },
      },
    },
    orderBy: { session: { startAt: 'asc' } },
  });

  res.json({
    learner: {
      id: learner.id,
      name: learner.name,
      email: learner.email,
      createdAt: learner.createdAt,
    },
    formations,
    quizAttempts: attempts.map((a) => ({
      id: a.id,
      score: a.score,
      total: a.total,
      createdAt: a.createdAt,
      lessonTitle: a.lesson.title,
      formationTitle: a.lesson.section.formation.title,
    })),
    sessions: participations.map((p) => ({
      id: p.session.id,
      title: p.session.title,
      startAt: p.session.startAt,
      endAt: p.session.endAt,
      attended: p.attended,
      formationTitle: p.session.formation.title,
    })),
  });
});

// Vue kanban de la progression : une carte par inscription (apprenant × formation)
learnersRouter.get('/progression/kanban', async (req, res) => {
  const { formateurOnly, enrollmentWhere } = learnerScope(req);
  const formationId = typeof req.query.formationId === 'string' ? req.query.formationId : '';

  const enrollments = await prisma.enrollment.findMany({
    where: {
      ...(formationId ? { formationId } : {}),
      ...(enrollmentWhere ? enrollmentWhere : {}),
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
      formation: {
        select: {
          id: true,
          title: true,
          sections: { select: { lessons: { select: { id: true } } } },
        },
      },
    },
    orderBy: { grantedAt: 'desc' },
  });

  const totalsByFormation = new Map<string, number>();
  for (const e of enrollments) {
    if (!totalsByFormation.has(e.formation.id)) {
      totalsByFormation.set(
        e.formation.id,
        e.formation.sections.reduce((n, s) => n + s.lessons.length, 0)
      );
    }
  }

  const progressRows = enrollments.length
    ? await prisma.lessonProgress.findMany({
        where: {
          userId: { in: [...new Set(enrollments.map((e) => e.user.id))] },
          lesson: { section: { formationId: { in: [...totalsByFormation.keys()] } } },
        },
        select: {
          userId: true,
          completed: true,
          lesson: { select: { section: { select: { formationId: true } } } },
        },
      })
    : [];

  const cards = enrollments.map((e) => {
    const total = totalsByFormation.get(e.formation.id) ?? 0;
    let completed = 0;
    for (const p of progressRows) {
      if (
        p.userId === e.user.id &&
        p.completed &&
        p.lesson.section.formationId === e.formation.id
      ) {
        completed += 1;
      }
    }
    const percent = total ? Math.round((completed / total) * 100) : 0;
    const bucket =
      total === 0 || completed === 0 ? 'NOT_STARTED' : completed >= total ? 'DONE' : 'IN_PROGRESS';
    return {
      enrollmentId: e.id,
      user: { id: e.user.id, name: e.user.name, email: e.user.email },
      formation: { id: e.formation.id, title: e.formation.title },
      grantedAt: e.grantedAt,
      selfEnrolled: e.grantedById === null,
      totalLessons: total,
      completedLessons: completed,
      percent,
      bucket,
    };
  });

  res.json({
    // isGestion n'est utilisé que côté client ; ici on renvoie simplement les cartes
    cards,
    gestion: isGestion(req.user!.role),
  });
});
