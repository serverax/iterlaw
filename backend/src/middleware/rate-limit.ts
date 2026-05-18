import type { NextFunction, Request, Response } from 'express';

type Bucket = { count: number; resetAt: number };

const ipBuckets = new Map<string, Bucket>();
const userBuckets = new Map<string, Bucket>();

export type RateLimitOptions = {
  windowMs?: number;
  maxPerIp?: number;
  maxPerUser?: number;
};

const DEFAULTS: Required<RateLimitOptions> = {
  windowMs: 60_000,
  maxPerIp: 120,
  maxPerUser: 60,
};

function hit(
  buckets: Map<string, Bucket>,
  key: string,
  max: number,
  windowMs: number
): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  if (bucket.count > max) {
    return {
      allowed: false,
      retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }
  return { allowed: true, retryAfterSec: 0 };
}

export function createRateLimitMiddleware(options: RateLimitOptions = {}) {
  const { windowMs, maxPerIp, maxPerUser } = { ...DEFAULTS, ...options };

  return function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const userId =
      (req.headers['x-user-id'] as string | undefined) ||
      (req.body as { user_id?: string } | undefined)?.user_id ||
      'anonymous';

    const ipResult = hit(ipBuckets, ip, maxPerIp, windowMs);
    if (!ipResult.allowed) {
      res.setHeader('Retry-After', String(ipResult.retryAfterSec));
      res.status(429).json({ ok: false, error: { code: 'RATE_LIMIT_IP', message: 'Too many requests' } });
      return;
    }

    const userResult = hit(userBuckets, userId, maxPerUser, windowMs);
    if (!userResult.allowed) {
      res.setHeader('Retry-After', String(userResult.retryAfterSec));
      res.status(429).json({ ok: false, error: { code: 'RATE_LIMIT_USER', message: 'Too many requests' } });
      return;
    }

    next();
  };
}

export const rateLimitMiddleware = createRateLimitMiddleware();
