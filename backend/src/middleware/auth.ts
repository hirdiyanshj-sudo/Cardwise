import type { Request, Response, NextFunction } from 'express';
import { getDb } from '../db/index.js';
import { verifyJwt } from '../utils/crypto.js';
import { ACCESS_COOKIE_NAME, parseCookies } from '../utils/cookies.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: 'user' | 'admin';
  jti: string;
  fullName: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const cookies = parseCookies(req.headers.cookie);
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  const token = cookies[ACCESS_COOKIE_NAME] || bearerToken;

  if (!token) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }

  const payload = verifyJwt(token);
  if (!payload || payload.mfaPending) {
    res.status(401).json({ error: 'Invalid or expired access token.' });
    return;
  }

  const db = getDb();
  const session = await db.queryOne<{
    id: string;
    is_revoked: number | boolean;
    expires_at: string;
  }>(
    `SELECT id, is_revoked, expires_at FROM user_sessions WHERE token_jti = $1 AND user_id = $2`,
    [payload.jti, payload.sub]
  );

  if (!session || Boolean(session.is_revoked) || new Date(session.expires_at) < new Date()) {
    res.status(401).json({ error: 'Session has been revoked or expired.' });
    return;
  }

  const user = await db.queryOne<{
    id: string;
    email: string;
    role: 'user' | 'admin';
    full_name: string;
    is_active: number | boolean;
  }>(`SELECT id, email, role, full_name, is_active FROM users WHERE id = $1`, [payload.sub]);

  if (!user || !user.is_active) {
    res.status(401).json({ error: 'Account is inactive or deleted.' });
    return;
  }

  await db.execute(`UPDATE user_sessions SET last_active_at = NOW() WHERE id = $1`, [session.id]);

  req.user = {
    id: user.id,
    email: user.email,
    role: user.role,
    jti: payload.jti,
    fullName: user.full_name,
  };
  next();
}

export function requireRole(role: 'admin' | 'user') {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    if (role === 'admin' && req.user.role !== 'admin') {
      res.status(403).json({ error: 'Administrator privileges required.' });
      return;
    }
    next();
  };
}
