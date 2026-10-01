import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireEquipe, canManageFormation } from '../lib/auth.js';

/** Inscriptions accordées par l'équipe : utile pour les formations
 *  payantes (paiement hors ligne en v1) ou toute inscription manuelle.
 *  Les formations gratuites s'auto-inscrivent via POST /api/me/enroll. */
export const enrollmentsRouter = Router();
enrollmentsRouter.use(requireAuth, requireEquipe);

const grantSchema = z.object({
  userId: z.string().min(1),
  formationId: z.string().min(1),
});

// Inscrire un apprenant à une formation
enrollmentsRouter.post('/', async (req, res) => {
  const parsed = grantSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'userId et formationId requis' });
  const { userId, formationId } = parsed.data;

  if (!(await canManageFormation(req.user!, formationId))) {
    return res.status(403).json({ error: "Vous n'avez pas accès à cette formation" });
  }
  const learner = await prisma.user.findUnique({ where: { id: userId } });
  if (!learner || learner.role !== 'APPRENANT') {
    return res.status(404).json({ error: 'Apprenant introuvable' });
  }
  const formation = await prisma.formation.findUnique({ where: { id: formationId } });
  if (!formation) return res.status(404).json({ error: 'Formation introuvable' });

  const already = await prisma.enrollment.findUnique({
    where: { userId_formationId: { userId, formationId } },
  });
  if (already) return res.status(409).json({ error: 'Cet apprenant est déjà inscrit' });

  const enrollment = await prisma.enrollment.create({
    data: { userId, formationId, grantedById: req.user!.id },
    include: {
      user: { select: { id: true, name: true, email: true } },
      formation: { select: { id: true, title: true } },
      grantedBy: { select: { name: true } },
    },
  });
  res.status(201).json({ enrollment });
});

// Révoquer une inscription
enrollmentsRouter.delete('/:id', async (req, res) => {
  const enrollment = await prisma.enrollment.findUnique({ where: { id: (req.params.id as string) } });
  if (!enrollment) return res.status(404).json({ error: 'Inscription introuvable' });
  if (!(await canManageFormation(req.user!, enrollment.formationId))) {
    return res.status(403).json({ error: "Vous n'avez pas accès à cette formation" });
  }
  await prisma.enrollment.delete({ where: { id: enrollment.id } });
  res.json({ ok: true });
});
