import type { Request, Response, NextFunction } from 'express';

interface Bucket {
  count: number;
  resetAt: number;
}

export function createRateLimiter(
  maxRequests: number,
  windowMs: number,
  keyFn?: (req: Request) => string
) {
  const store = new Map<string, Bucket>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = keyFn ? keyFn(req) : `${req.ip || 'local'}:${req.baseUrl}`;
    const now = Date.now();
    const bucket = store.get(key);

    if (!bucket || bucket.resetAt <= now) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (bucket.count >= maxRequests) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({
        error: 'Too many requests. Please wait before trying again.',
        retryAfterSeconds: retryAfter,
      });
      return;
    }

    bucket.count += 1;
    next();
  };
}
