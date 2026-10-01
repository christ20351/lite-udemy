import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { optionalAuth, requireAuth } from '../lib/auth.js';

export const catalogueRouter = Router();
export const enrollRouter = Router();

const JOURS_NOUVEAU = 30;

function estNouveau(createdAt: Date) {
  return Date.now() - createdAt.getTime() < JOURS_NOUVEAU * 24 * 3600 * 1000;
}

// Catalogue public : toutes les formations publiées (consultable sans compte)
catalogueRouter.get('/', async (req, res) => {
  const formations = await prisma.formation.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      category: true,
      mode: true,
      price: true,
      thumbnailUrl: true,
      createdAt: true,
      sections: { include: { lessons: { select: { id: true } } } },
      enrollments: req.user ? { where: { userId: req.user.id }, select: { id: true } } : false,
    },
  });

  res.json({
    catalogue: formations.map((f) => ({
      id: f.id,
      title: f.title,
      slug: f.slug,
      description: f.description,
      category: f.category,
      mode: f.mode,
      price: f.price,
      thumbnailUrl: f.thumbnailUrl,
      isNew: estNouveau(f.createdAt),
      lessonCount: f.sections.reduce((n, s) => n + s.lessons.length, 0),
      enrolled: Array.isArray(f.enrollments) ? f.enrollments.length > 0 : false,
    })),
  });
});

// Auto-inscription d'un apprenant à une formation GRATUITE publiée
enrollRouter.post('/', async (req, res) => {
  if (req.user!.role !== 'APPRENANT') {
    return res.status(403).json({ error: "Réservé aux comptes apprenants" });
  }
  const parsed = z.object({ formationId: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'formationId requis' });

  const formation = await prisma.formation.findUnique({
    where: { id: parsed.data.formationId },
  });
  if (!formation || formation.status !== 'PUBLISHED') {
    return res.status(404).json({ error: 'Formation introuvable ou non publiée' });
  }
  if (formation.price !== null) {
    return res.status(400).json({
      error:
        'Cette formation est payante — l\'inscription se fait auprès de l\'organisme (paiement hors ligne)',
    });
  }

  const already = await prisma.enrollment.findUnique({
    where: { userId_formationId: { userId: req.user!.id, formationId: formation.id } },
  });
  if (already) return res.status(409).json({ error: 'Vous suivez déjà cette formation' });

  await prisma.enrollment.create({
    data: { userId: req.user!.id, formationId: formation.id },
  });
  res.status(201).json({ ok: true });
});
