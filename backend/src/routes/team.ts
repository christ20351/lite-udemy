import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole, publicUser } from '../lib/auth.js';

/** Gestion de l'équipe interne (ADMIN, GESTIONNAIRE, FORMATEUR).
 *  Réservée à l'ADMIN : créer des comptes, changer les rôles,
 *  réinitialiser un mot de passe, supprimer un compte. */
export const teamRouter = Router();
teamRouter.use(requireAuth, requireRole('ADMIN'));

const teamRoles = z.enum(['ADMIN', 'GESTIONNAIRE', 'FORMATEUR']);

const createSchema = z.object({
  name: z.string().min(2),
  email: z.email(),
  password: z.string().min(6),
  role: teamRoles,
});

teamRouter.get('/', async (_req, res) => {
  const members = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'GESTIONNAIRE', 'FORMATEUR'] } },
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      _count: { select: { formationsTaught: true, sessionsTrained: true } },
    },
  });
  res.json({ members });
});

teamRouter.post('/', async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Nom, email valide, mot de passe (6+ caractères) et rôle requis',
    });
  }
  const { email, password, name, role } = parsed.data;
  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) return res.status(409).json({ error: 'Cet email est déjà utilisé' });

  const passwordHash = await bcrypt.hash(password, 10);
  const member = await prisma.user.create({
    data: { email: email.toLowerCase(), passwordHash, name, role },
  });
  res.status(201).json({ member: publicUser(member) });
});

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  role: teamRoles.optional(),
  password: z.string().min(6).optional(),
});

teamRouter.patch('/:id', async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Données invalides' });

  const target = await prisma.user.findUnique({ where: { id: (req.params.id as string) } });
  if (!target || target.role === 'APPRENANT') {
    return res.status(404).json({ error: 'Membre de l\'équipe introuvable' });
  }
  // Sécurité : un admin ne peut pas retirer son propre rôle admin
  // (sinon plus personne ne gère l'équipe).
  if (target.id === req.user!.id && parsed.data.role && parsed.data.role !== 'ADMIN') {
    return res.status(400).json({ error: 'Vous ne pouvez pas retirer votre propre rôle admin' });
  }
  // Ne pas laisser l'équipe sans aucun admin
  if (target.role === 'ADMIN' && parsed.data.role && parsed.data.role !== 'ADMIN') {
    const otherAdmins = await prisma.user.count({
      where: { role: 'ADMIN', id: { not: target.id } },
    });
    if (otherAdmins === 0) {
      return res.status(400).json({ error: 'Il doit rester au moins un admin' });
    }
  }

  const { name, role, password } = parsed.data;
  const member = await prisma.user.update({
    where: { id: target.id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(role !== undefined ? { role } : {}),
      ...(password !== undefined ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
    },
  });
  res.json({ member: publicUser(member) });
});

teamRouter.delete('/:id', async (req, res) => {
  const target = await prisma.user.findUnique({ where: { id: (req.params.id as string) } });
  if (!target || target.role === 'APPRENANT') {
    return res.status(404).json({ error: 'Membre de l\'équipe introuvable' });
  }
  if (target.id === req.user!.id) {
    return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte' });
  }
  if (target.role === 'ADMIN') {
    const otherAdmins = await prisma.user.count({
      where: { role: 'ADMIN', id: { not: target.id } },
    });
    if (otherAdmins === 0) {
      return res.status(400).json({ error: 'Il doit rester au moins un admin' });
    }
  }
  await prisma.user.delete({ where: { id: target.id } });
  res.json({ ok: true });
});
