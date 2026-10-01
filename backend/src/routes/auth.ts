import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import {
  signToken,
  setAuthCookie,
  clearAuthCookie,
  requireAuth,
  publicUser,
} from '../lib/auth.js';

export const authRouter = Router();

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

const registerSchema = loginSchema.extend({
  name: z.string().min(2),
});

// Bootstrap : permet de créer le PREMIER compte staff, puis se verrouille.
authRouter.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Nom, email valide et mot de passe requis' });
  }
  const staffCount = await prisma.user.count({ where: { role: 'STAFF' } });
  if (staffCount > 0) {
    return res.status(403).json({ error: 'Un compte staff existe déjà (inscription fermée)' });
  }
  const { email, password, name } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email: email.toLowerCase(), passwordHash, name, role: 'STAFF' },
  });
  setAuthCookie(res, signToken(user));
  res.status(201).json({ user: publicUser(user) });
});

// Inscription libre d'un apprenant (sans rattachement client).
// Il pourra s'inscrire aux formations gratuites du catalogue ; les
// formations payantes passent par l'organisme (devis → souscription).
authRouter.post('/signup', async (req, res) => {
  const signupSchema = z.object({
    name: z.string().min(2),
    email: z.email(),
    password: z.string().min(6),
  });
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Nom, email valide et mot de passe (6+ caractères) requis' });
  }
  const { email, password, name } = parsed.data;
  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) return res.status(409).json({ error: 'Cet email est déjà utilisé' });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email: email.toLowerCase(), passwordHash, name, role: 'CONTACT' },
  });
  setAuthCookie(res, signToken(user));
  res.status(201).json({ user: publicUser(user) });
});

authRouter.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Email et mot de passe requis' });
  }
  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: { client: { select: { id: true, name: true } } },
  });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Identifiants incorrects' });
  }
  setAuthCookie(res, signToken(user));
  res.json({ user: publicUser(user) });
});

authRouter.post('/logout', (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user!) });
});
