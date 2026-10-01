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

// Bootstrap : permet de créer le PREMIER compte admin, puis se verrouille.
// Les autres comptes de l'équipe sont créés par l'admin (POST /api/team).
authRouter.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Nom, email valide et mot de passe requis' });
  }
  const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
  if (adminCount > 0) {
    return res.status(403).json({ error: 'Un compte admin existe déjà (inscription fermée)' });
  }
  const { email, password, name } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email: email.toLowerCase(), passwordHash, name, role: 'ADMIN' },
  });
  setAuthCookie(res, signToken(user));
  res.status(201).json({ user: publicUser(user) });
});

// Inscription libre d'un apprenant (rôle APPRENANT).
// Il peut s'auto-inscrire aux formations gratuites ; les formations
// payantes sont accordées par l'équipe (paiement hors ligne en v1).
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
    data: { email: email.toLowerCase(), passwordHash, name, role: 'APPRENANT' },
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
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
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
