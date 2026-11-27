import type { Request, Response } from 'express';
import { env } from '../config/env.js';

export const ACCESS_COOKIE_NAME = 'cw_access_token';
export const REFRESH_COOKIE_NAME = 'cw_refresh_token';
export const CSRF_COOKIE_NAME = 'cw_csrf_token';

export function parseCookies(reqOrHeader?: Request | string): Record<string, string> {
  const header =
    typeof reqOrHeader === 'string'
      ? reqOrHeader
      : reqOrHeader && typeof reqOrHeader === 'object'
        ? reqOrHeader.headers?.cookie
        : undefined;
  if (!header) return {};
  const result: Record<string, string> = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    try {
      result[key] = decodeURIComponent(val);
    } catch {
      result[key] = val;
    }
  }
  return result;
}

export function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken: string,
  csrfToken: string
): void {
  const isProd = env.nodeEnv === 'production';
  const secure = env.cookieSecure || isProd;
  const sameSite = isProd ? ('strict' as const) : ('lax' as const);

  res.cookie(ACCESS_COOKIE_NAME, accessToken, {
    httpOnly: true,
    secure,
    sameSite,
    path: '/',
    maxAge: 15 * 60 * 1000,
  });

  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure,
    sameSite,
    path: '/api/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.cookie(CSRF_COOKIE_NAME, csrfToken, {
    httpOnly: false,
    secure,
    sameSite,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function clearAuthCookies(res: Response): void {
  const isProd = env.nodeEnv === 'production';
  const secure = env.cookieSecure || isProd;
  const sameSite = isProd ? ('strict' as const) : ('lax' as const);

  res.clearCookie(ACCESS_COOKIE_NAME, { httpOnly: true, secure, sameSite, path: '/' });
  res.clearCookie(REFRESH_COOKIE_NAME, { httpOnly: true, secure, sameSite, path: '/api/auth' });
  res.clearCookie(CSRF_COOKIE_NAME, { httpOnly: false, secure, sameSite, path: '/' });
}
