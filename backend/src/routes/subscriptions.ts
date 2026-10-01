import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireStaff } from '../lib/auth.js';

export const subscriptionsRouter = Router();
export const accessRouter = Router();

subscriptionsRouter.use(requireAuth, requireStaff);
accessRouter.use(requireAuth, requireStaff);

const subscriptionSchema = z.object({
  clientId: z.string().min(1),
  formationId: z.string().min(1),
  seats: z.number().int().positive().default(1),
  endsAt: z.string().datetime().nullish(),
});

// Souscrire un client à une formation
subscriptionsRouter.post('/', async (req, res) => {
  const parsed = subscriptionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'clientId, formationId et seats requis' });
  }
  const client = await prisma.client.findUnique({ where: { id: parsed.data.clientId } });
  if (!client) return res.status(404).json({ error: 'Client introuvable' });
  const formation = await prisma.formation.findUnique({ where: { id: parsed.data.formationId } });
  if (!formation) return res.status(404).json({ error: 'Formation introuvable' });

  const existing = await prisma.subscription.findUnique({
    where: {
      clientId_formationId: {
        clientId: client.id,
        formationId: formation.id,
      },
    },
  });
  if (existing) {
    return res.status(409).json({ error: 'Ce client a déjà une souscription à cette formation' });
  }

  const subscription = await prisma.subscription.create({
    data: {
      clientId: client.id,
      formationId: formation.id,
      seats: parsed.data.seats,
      endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
    },
    include: { formation: { select: { id: true, title: true, mode: true } } },
  });
  res.status(201).json({ subscription });
});

// Modifier / résilier une souscription
subscriptionsRouter.patch('/:id', async (req, res) => {
  const schema = z.object({
    status: z.enum(['ACTIVE', 'EXPIRED']).optional(),
    seats: z.number().int().positive().optional(),
    endsAt: z.string().datetime().nullish(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Données invalides' });
  try {
    const { endsAt, ...rest } = parsed.data;
    const subscription = await prisma.subscription.update({
      where: { id: req.params.id },
      data: { ...rest, ...(endsAt !== undefined ? { endsAt: endsAt ? new Date(endsAt) : null } : {}) },
    });
    res.json({ subscription });
  } catch {
    res.status(404).json({ error: 'Souscription introuvable' });
  }
});

subscriptionsRouter.delete('/:id', async (req, res) => {
  try {
    await prisma.subscription.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: 'Souscription introuvable' });
  }
});

const grantSchema = z.object({ userId: z.string().min(1) });

// Attribuer l'accès d'une formation à un contact
accessRouter.post('/', async (req, res) => {
  const schema = z.object({ userId: z.string().min(1), formationId: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'userId et formationId requis' });
  const { userId, formationId } = parsed.data;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.role !== 'CONTACT') {
    return res.status(404).json({ error: 'Contact introuvable' });
  }
  const formation = await prisma.formation.findUnique({ where: { id: formationId } });
  if (!formation) return res.status(404).json({ error: 'Formation introuvable' });

  // Règle métier : le client du contact doit avoir une souscription active
  const subscription = await prisma.subscription.findUnique({
    where: { clientId_formationId: { clientId: user.clientId!, formationId } },
  });
  if (!subscription || subscription.status !== 'ACTIVE') {
    return res.status(400).json({
      error: "Aucune souscription active de ce client pour cette formation (créez-la d'abord)",
    });
  }

  const already = await prisma.access.findUnique({
    where: { userId_formationId: { userId, formationId } },
  });
  if (already) return res.status(409).json({ error: 'Cet accès existe déjà' });

  const access = await prisma.access.create({
    data: { userId, formationId, grantedById: req.user!.id },
    include: {
      user: { select: { id: true, name: true, email: true } },
      formation: { select: { id: true, title: true } },
      grantedBy: { select: { name: true } },
    },
  });
  res.status(201).json({ access });
});

// Révoquer un accès
accessRouter.delete('/:id', async (req, res) => {
  try {
    await prisma.access.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: 'Accès introuvable' });
  }
});
