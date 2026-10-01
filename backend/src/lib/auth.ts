import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from './prisma.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
export const COOKIE_NAME = 'token';

export type Role = 'ADMIN' | 'GESTIONNAIRE' | 'FORMATEUR' | 'APPRENANT';

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

/** Membres de l'équipe : accès au back-office (tout sauf APPRENANT). */
export function isEquipe(role: string): boolean {
  return role === 'ADMIN' || role === 'GESTIONNAIRE' || role === 'FORMATEUR';
}

/** ADMIN et GESTIONNAIRE : pilotent le catalogue et les apprenants. */
export function isGestion(role: string): boolean {
  return role === 'ADMIN' || role === 'GESTIONNAIRE';
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(user: { id: string; role: string }) {
  return jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
}

export function setAuthCookie(res: Response, token: string) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 3600 * 1000,
  });
}

export function clearAuthCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

export function publicUser(u: { id: string; email: string; name: string; role: string }) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
  };
}

/** Token depuis le cookie de session OU l'entête Authorization: Bearer
 *  (le header Cookie étant interdit aux clients HTTP comme Postman). */
function extractToken(req: Request): string | null {
  if (req.cookies?.[COOKIE_NAME]) return req.cookies[COOKIE_NAME];
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return null;
}

async function userFromToken(token: string) {
  const payload = jwt.verify(token, JWT_SECRET) as { sub: string; role: string };
  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  // Le rôle embarqué dans le token doit correspondre au rôle en base :
  // un token périmé (rôle changé entre-temps) est rejeté, forçant une
  // nouvelle connexion. Empêche toute escalation via un ancien token.
  if (!user || payload.role !== user.role) return null;
  return user;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'Non authentifié' });
  try {
    const user = await userFromToken(token);
    if (!user) return res.status(401).json({ error: 'Session invalide — reconnectez-vous' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Session invalide ou expirée' });
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Accès non autorisé pour ce rôle' });
    }
    next();
  };
}

export const requireEquipe = requireRole('ADMIN', 'GESTIONNAIRE', 'FORMATEUR');
export const requireGestion = requireRole('ADMIN', 'GESTIONNAIRE');

/// Peuple req.user si un cookie valide existe, sinon continue sans erreur
/// (utilisé pour le streaming vidéo : les aperçus sont publics).
export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (token) {
    try {
      const user = await userFromToken(token);
      if (user) req.user = user;
    } catch {
      // token invalide : on continue en tant qu'anonyme
    }
  }
  next();
}

// ── Périmètre formateur ───────────────────────────────────────────────
// Un FORMATEUR ne gère que les formations qui lui sont assignées
// (relation Formation.instructors). ADMIN et GESTIONNAIRE voient tout.

export async function canManageFormation(user: AuthUser, formationId: string): Promise<boolean> {
  if (isGestion(user.role)) return true;
  if (user.role !== 'FORMATEUR') return false;
  const n = await prisma.formation.count({
    where: { id: formationId, instructors: { some: { id: user.id } } },
  });
  return n > 0;
}

export async function canManageSection(user: AuthUser, sectionId: string): Promise<boolean> {
  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    select: { formationId: true },
  });
  if (!section) return false;
  return canManageFormation(user, section.formationId);
}

export async function canManageLesson(user: AuthUser, lessonId: string): Promise<boolean> {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { section: { select: { formationId: true } } },
  });
  if (!lesson) return false;
  return canManageFormation(user, lesson.section.formationId);
}
