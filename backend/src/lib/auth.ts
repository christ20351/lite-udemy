import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from './prisma.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
export const COOKIE_NAME = 'token';

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: 'STAFF' | 'CONTACT';
  clientId: string | null;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser & { client?: { id: string; name: string } | null };
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

export function publicUser(u: {
  id: string;
  email: string;
  name: string;
  role: string;
  clientId: string | null;
  client?: { id: string; name: string } | null;
}) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    clientId: u.clientId,
    client: u.client ? { id: u.client.id, name: u.client.name } : null,
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

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'Non authentifié' });
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string; role: string };
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { client: { select: { id: true, name: true } } },
    });
    if (!user) return res.status(401).json({ error: 'Compte introuvable' });
    // Le rôle embarqué dans le token doit correspondre au rôle en base :
    // un token périmé (rôle changé entre-temps) est rejeté, forçant une
    // nouvelle connexion. Empêche toute escalation via un ancien token.
    if (payload.role !== user.role) {
      return res.status(401).json({ error: 'Session invalide — reconnectez-vous' });
    }
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Session invalide ou expirée' });
  }
}

export function requireStaff(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== 'STAFF') {
    return res.status(403).json({ error: 'Accès réservé au staff' });
  }
  next();
}

/// Peuple req.user si un cookie valide existe, sinon continue sans erreur
/// (utilisé pour le streaming vidéo : les aperçus sont publics).
export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET) as { sub: string; role: string };
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        include: { client: { select: { id: true, name: true } } },
      });
      // rôle du token vs base : en cas de divergence on traite comme anonyme
      if (user && payload.role === user.role) req.user = user;
    } catch {
      // token invalide : on continue en tant qu'anonyme
    }
  }
  next();
}
