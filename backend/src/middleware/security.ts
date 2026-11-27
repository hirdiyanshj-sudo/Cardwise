import type { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import type { DbClient } from '../db/index.js';
import {
  ACCESS_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  parseCookies,
} from '../utils/cookies.js';

export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self' https://accounts.google.com;"
  );
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
}

const CSRF_EXEMPT_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/demo-login',
  '/api/auth/google',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/verify-email',
  '/api/auth/mfa/verify-login',
]);

export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    next();
    return;
  }

  if (CSRF_EXEMPT_PATHS.has(req.path)) {
    next();
    return;
  }

  const cookies = parseCookies(req.headers.cookie);
  const usingCookieAuth = Boolean(cookies[ACCESS_COOKIE_NAME] || cookies[REFRESH_COOKIE_NAME]);
  if (!usingCookieAuth) {
    next();
    return;
  }

  const csrfCookie = cookies[CSRF_COOKIE_NAME];
  const csrfHeader = String(req.headers['x-csrf-token'] || '');
  if (!csrfCookie || !csrfHeader) {
    res.status(403).json({ error: 'CSRF token missing or invalid.' });
    return;
  }

  const a = Buffer.from(csrfCookie);
  const b = Buffer.from(csrfHeader);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    res.status(403).json({ error: 'CSRF validation failed.' });
    return;
  }

  next();
}

export function sanitizeString(val: string): string {
  return val
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/[<>]/g, '')
    .trim();
}

function sanitizeValue(v: unknown): unknown {
  if (typeof v === 'string') return sanitizeString(v);
  if (Array.isArray(v)) return v.map(sanitizeValue);
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v)) {
      out[k] = sanitizeValue(val);
    }
    return out;
  }
  return v;
}

export function sanitizeBody(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeValue(req.body);
  }
  next();
}

const FORBIDDEN_SECRET_KEYS = new Set([
  'cvv',
  'cvc',
  'pin',
  'atm_pin',
  'atmpin',
  'otp',
  'netbanking_password',
  'card_number',
  'full_card_number',
  'cardnumber',
]);

export function rejectForbiddenCardSecrets(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (req.body && typeof req.body === 'object') {
    for (const [k, v] of Object.entries(req.body)) {
      const lower = k.toLowerCase();
      if (FORBIDDEN_SECRET_KEYS.has(lower)) {
        res.status(400).json({
          error: `Security policy violation: '${k}' must never be submitted or stored in CardWise.`,
        });
        return;
      }
      if (
        (lower.includes('last_four') || lower.includes('last4') || lower.includes('card')) &&
        typeof v === 'string' &&
        /^\d{12,19}$/.test(v.replace(/[\s-]/g, ''))
      ) {
        res.status(400).json({
          error:
            'Security policy violation: Complete credit card numbers are never stored. Provide only the last 4 digits.',
        });
        return;
      }
    }
  }
  next();
}

export async function writeAuditLog(
  db: DbClient,
  userId: string | null,
  action: string,
  resourceType: string,
  resourceId: string | null,
  req: Request,
  details?: Record<string, unknown>
): Promise<void> {
  try {
    await db.execute(
      `INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, ip_address, user_agent, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        crypto.randomUUID(),
        userId,
        action,
        resourceType,
        resourceId,
        req.ip || req.socket.remoteAddress || 'unknown',
        (req.headers['user-agent'] || '').slice(0, 200),
        details ? JSON.stringify(details) : null,
      ]
    );
  } catch {
    // Non-blocking audit log failure
  }
}
