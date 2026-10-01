import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireStaff } from '../lib/auth.js';

export const dealsRouter = Router();
dealsRouter.use(requireAuth, requireStaff);

const dealSchema = z.object({
  title: z.string().min(2),
  amount: z.number().nonnegative().nullish(),
  clientId: z.string().nullish(),
  formationId: z.string().nullish(),
  notes: z.string().nullish(),
});

const STAGES = ['NEW', 'QUALIFIED', 'QUOTE', 'NEGOTIATION', 'WON', 'LOST'] as const;

// Toutes les opportunités, groupées côté client par étape
dealsRouter.get('/', async (_req, res) => {
  const deals = await prisma.deal.findMany({
    orderBy: { updatedAt: 'desc' },
    include: {
      client: { select: { id: true, name: true } },
      formation: { select: { id: true, title: true } },
      owner: { select: { name: true } },
    },
  });
  const kanban: Record<string, typeof deals> = {};
  for (const stage of STAGES) {
    kanban[stage] = deals.filter((d) => d.stage === stage);
  }
  const totals = Object.fromEntries(
    STAGES.map((s) => [
      s,
      kanban[s].reduce((sum, d) => sum + (d.amount ?? 0), 0),
    ])
  );
  res.json({ kanban, totals });
});

dealsRouter.post('/', async (req, res) => {
  const parsed = dealSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Titre requis (2+ caractères)' });
  const { clientId, formationId, ...rest } = parsed.data;
  const deal = await prisma.deal.create({
    data: {
      ...rest,
      clientId: clientId || null,
      formationId: formationId || null,
      ownerId: req.user!.id,
    },
    include: {
      client: { select: { name: true } },
      formation: { select: { title: true } },
    },
  });
  res.status(201).json({ deal });
});

dealsRouter.patch('/:id', async (req, res) => {
  const schema = dealSchema.partial().extend({
    stage: z.enum(STAGES).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Données invalides' });
  try {
    const { clientId, formationId, ...rest } = parsed.data;
    const deal = await prisma.deal.update({
      where: { id: req.params.id },
      data: {
        ...rest,
        ...(clientId !== undefined ? { clientId: clientId || null } : {}),
        ...(formationId !== undefined ? { formationId: formationId || null } : {}),
      },
      include: {
        client: { select: { name: true } },
        formation: { select: { title: true } },
      },
    });
    res.json({ deal });
  } catch {
    res.status(404).json({ error: 'Opportunité introuvable' });
  }
});

dealsRouter.delete('/:id', async (req, res) => {
  try {
    await prisma.deal.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: 'Opportunité introuvable' });
  }
});
