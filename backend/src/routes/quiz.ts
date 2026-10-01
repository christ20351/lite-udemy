import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth, isEquipe, canManageLesson } from '../lib/auth.js';

export const quizStaffRouter = Router();
export const quizLearnerRouter = Router();

quizStaffRouter.use(requireAuth);

const questionSchema = z.object({
  text: z.string().min(1),
  choices: z
    .array(z.object({ text: z.string().min(1), correct: z.boolean() }))
    .min(2)
    .max(6),
  order: z.number().int().default(0),
});

const quizSchema = z.object({
  questions: z.array(questionSchema).min(1).max(20),
});

/** Sauvegarde complète du quiz d'une leçon (remplace tout).
 *  Un formateur ne peut modifier que les quiz de ses formations. */
quizStaffRouter.put('/lessons/:lessonId/quiz', async (req, res) => {
  const parsed = quizSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Au moins une question avec 2+ choix requise' });
  }
  if (!(await canManageLesson(req.user!, (req.params.lessonId as string)))) {
    return res.status(403).json({ error: 'Formation non assignée' });
  }
  const lesson = await prisma.lesson.findUnique({ where: { id: (req.params.lessonId as string) } });
  if (!lesson) return res.status(404).json({ error: 'Leçon introuvable' });

  await prisma.$transaction(async (tx) => {
    await tx.quiz.deleteMany({ where: { lessonId: lesson.id } });
    const quiz = await tx.quiz.create({ data: { lessonId: lesson.id } });
    for (const [i, q] of parsed.data.questions.entries()) {
      await tx.quizQuestion.create({
        data: {
          quizId: quiz.id,
          text: q.text,
          choices: q.choices,
          order: q.order ?? i,
        },
      });
    }
  });

  const quiz = await prisma.quiz.findUnique({
    where: { lessonId: lesson.id },
    include: { questions: { orderBy: { order: 'asc' } } },
  });
  res.json({ quiz });
});

/** Le quiz avec réponses + stats de scores (équipe, scoping formateur) */
quizStaffRouter.get('/lessons/:lessonId/quiz', async (req, res) => {
  if (!(await canManageLesson(req.user!, (req.params.lessonId as string)))) {
    return res.status(403).json({ error: 'Formation non assignée' });
  }
  const quiz = await prisma.quiz.findUnique({
    where: { lessonId: (req.params.lessonId as string) },
    include: { questions: { orderBy: { order: 'asc' } } },
  });
  const attempts = await prisma.quizAttempt.findMany({
    where: { lessonId: (req.params.lessonId as string) },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  res.json({ quiz, attempts });
});

// ── Côté apprenant ────────────────────────────────────────────────────

quizLearnerRouter.use(requireAuth);

/** Le quiz SANS les indications de bonne réponse */
quizLearnerRouter.get('/lessons/:lessonId/quiz', async (req, res) => {
  const lesson = await prisma.lesson.findUnique({
    where: { id: (req.params.lessonId as string) },
    include: {
      section: { include: { formation: { select: { id: true, status: true } } } },
      quiz: { include: { questions: { orderBy: { order: 'asc' } } } },
    },
  });
  if (!lesson || !lesson.quiz) return res.status(404).json({ error: 'Aucun quiz sur cette leçon' });
  if (lesson.section.formation.status !== 'PUBLISHED') {
    return res.status(403).json({ error: 'Formation non publiée' });
  }
  if (!isEquipe(req.user!.role)) {
    const access = await prisma.enrollment.findUnique({
      where: {
        userId_formationId: {
          userId: req.user!.id,
          formationId: lesson.section.formation.id,
        },
      },
    });
    if (!access) return res.status(403).json({ error: "Vous n'avez pas accès à cette leçon" });
  }

  const attempt = await prisma.quizAttempt.findUnique({
    where: { userId_lessonId: { userId: req.user!.id, lessonId: lesson.id } },
  });

  res.json({
    quiz: {
      lessonId: lesson.id,
      questions: lesson.quiz.questions.map((q) => ({
        id: q.id,
        text: q.text,
        choices: (q.choices as Array<{ text: string }>).map((c) => ({ text: c.text })),
      })),
    },
    bestAttempt: attempt ? { score: attempt.score, total: attempt.total } : null,
  });
});

const attemptSchema = z.object({
  answers: z.array(z.array(z.number().int()).min(1)).min(1), // indices des choix cochés par question
});

/** Soumettre ses réponses : correction côté serveur + score conservé */
quizLearnerRouter.post('/lessons/:lessonId/quiz/attempt', async (req, res) => {
  const parsed = attemptSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Réponses requises' });

  const quiz = await prisma.quiz.findUnique({
    where: { lessonId: (req.params.lessonId as string) },
    include: {
      questions: { orderBy: { order: 'asc' } },
      lesson: {
        include: { section: { include: { formation: { select: { id: true, status: true } } } } },
      },
    },
  });
  if (!quiz) return res.status(404).json({ error: 'Aucun quiz sur cette leçon' });
  const formation = quiz.lesson.section.formation;
  if (formation.status !== 'PUBLISHED') {
    return res.status(403).json({ error: 'Formation non publiée' });
  }
  if (!isEquipe(req.user!.role)) {
    const access = await prisma.enrollment.findUnique({
      where: { userId_formationId: { userId: req.user!.id, formationId: formation.id } },
    });
    if (!access) return res.status(403).json({ error: "Vous n'avez pas accès à cette leçon" });
  }

  const questions = quiz.questions;
  if (parsed.data.answers.length !== questions.length) {
    return res.status(400).json({ error: 'Répondez à toutes les questions' });
  }

  let score = 0;
  const correction = questions.map((q, i) => {
    const choices = q.choices as Array<{ text: string; correct: boolean }>;
    const picked = [...new Set(parsed.data.answers[i])].sort().join(',');
    const expected = choices
      .map((c, idx) => (c.correct ? idx : -1))
      .filter((x) => x >= 0)
      .sort()
      .join(',');
    const ok = picked === expected;
    if (ok) score += 1;
    return {
      question: q.text,
      ok,
      correctIndices: choices.map((c, idx) => (c.correct ? idx : -1)).filter((x) => x >= 0),
      pickedIndices: [...new Set(parsed.data.answers[i])],
    };
  });

  // Meilleur score conservé
  const existing = await prisma.quizAttempt.findUnique({
    where: { userId_lessonId: { userId: req.user!.id, lessonId: (req.params.lessonId as string) } },
  });
  const best = Math.max(existing?.score ?? -1, score);
  if (existing) {
    await prisma.quizAttempt.update({
      where: { id: existing.id },
      data: { score: best, total: questions.length },
    });
  } else {
    await prisma.quizAttempt.create({
      data: {
        userId: req.user!.id,
        lessonId: (req.params.lessonId as string),
        quizId: quiz.id,
        score: best,
        total: questions.length,
      },
    });
  }

  res.json({ score, total: questions.length, correction });
});
