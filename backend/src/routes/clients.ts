import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireStaff } from '../lib/auth.js';

export const clientsRouter = Router();
clientsRouter.use(requireAuth, requireStaff);

const clientSchema = z.object({
  name: z.string().min(2),
  type: z.enum(['COMPANY', 'INDIVIDUAL']).default('COMPANY'),
  status: z.enum(['LEAD', 'PROSPECT', 'CLIENT', 'INACTIVE']).default('LEAD'),
  email: z.email().nullish(),
  phone: z.string().nullish(),
  address: z.string().nullish(),
  notes: z.string().nullish(),
});

const contactSchema = z.object({
  name: z.string().min(2),
  email: z.email(),
  password: z.string().min(6),
});

const interactionSchema = z.object({
  type: z.enum(['CALL', 'EMAIL', 'MEETING', 'NOTE']).default('NOTE'),
  content: z.string().min(1),
});

// Liste globale des contacts apprenants (tous clients confondus)
clientsRouter.get('/contacts/all', async (req, res) => {
  const { search } = req.query as { search?: string };
  const where: Record<string, unknown> = { role: 'CONTACT' };
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' as const } },
      { email: { contains: search, mode: 'insensitive' as const } },
    ];
  }
  const contacts = await prisma.user.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, name: true, email: true, createdAt: true,
      client: { select: { id: true, name: true, status: true } },
      accesses: { include: { formation: { select: { title: true } } } },
      _count: { select: { progresses: { where: { completed: true } } } },
    },
  });
  res.json({ contacts });
});

// Liste + recherche
clientsRouter.get('/', async (req, res) => {
  const { search, status } = req.query as { search?: string; status?: string };
  const where: Record<string, unknown> = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' as const } },
      { email: { contains: search, mode: 'insensitive' as const } },
    ];
  }
  if (status) where.status = status;
  const clients = await prisma.client.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { users: true, subscriptions: true } } },
  });
  res.json({ clients });
});

clientsRouter.post('/', async (req, res) => {
  const parsed = clientSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Données client invalides' });
  const client = await prisma.client.create({ data: parsed.data });
  res.status(201).json({ client });
});

// Fiche complète : contacts, souscriptions, historique
clientsRouter.get('/:id', async (req, res) => {
  const client = await prisma.client.findUnique({
    where: { id: req.params.id },
    include: {
      users: {
        where: { role: 'CONTACT' },
        select: {
          id: true, name: true, email: true, createdAt: true,
          accesses: { include: { formation: { select: { id: true, title: true } } } },
        },
      },
      subscriptions: {
        include: { formation: { select: { id: true, title: true, slug: true, mode: true, status: true } } },
        orderBy: { startedAt: 'desc' },
      },
      interactions: {
        include: { author: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
  if (!client) return res.status(404).json({ error: 'Client introuvable' });
  res.json({ client });
});

clientsRouter.patch('/:id', async (req, res) => {
  const parsed = clientSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Données invalides' });
  try {
    const client = await prisma.client.update({ where: { id: req.params.id }, data: parsed.data });
    res.json({ client });
  } catch {
    res.status(404).json({ error: 'Client introuvable' });
  }
});

clientsRouter.delete('/:id', async (req, res) => {
  try {
    await prisma.client.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: 'Client introuvable' });
  }
});

// Créer un contact apprenant (avec accès portail)
clientsRouter.post('/:id/contacts', async (req, res) => {
  const parsed = contactSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Nom, email valide et mot de passe (6+ caractères) requis' });
  }
  const client = await prisma.client.findUnique({ where: { id: req.params.id } });
  if (!client) return res.status(404).json({ error: 'Client introuvable' });
  const { name, email, password } = parsed.data;
  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) return res.status(409).json({ error: 'Cet email est déjà utilisé' });
  const contact = await prisma.user.create({
    data: {
      name,
      email: email.toLowerCase(),
      passwordHash: await bcrypt.hash(password, 10),
      role: 'CONTACT',
      clientId: client.id,
    },
    select: { id: true, name: true, email: true, createdAt: true },
  });
  res.status(201).json({ contact });
});

// Logger une interaction CRM
clientsRouter.post('/:id/interactions', async (req, res) => {
  const parsed = interactionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Contenu requis' });
  const client = await prisma.client.findUnique({ where: { id: req.params.id } });
  if (!client) return res.status(404).json({ error: 'Client introuvable' });
  const interaction = await prisma.interaction.create({
    data: {
      clientId: client.id,
      authorId: req.user!.id,
      type: parsed.data.type,
      content: parsed.data.content,
    },
    include: { author: { select: { name: true } } },
  });
  res.status(201).json({ interaction });
});
