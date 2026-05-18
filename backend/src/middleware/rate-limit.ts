import type { NextFunction, Request, Response } from 'express';
import { Logger } from '../utils/logger';

const logger = new Logger('RateLimit');

export const RATE_LIMITS = {
  USER: { limit: 30, window: 60 },
  IP: { limit: 100, window: 60 },
};

type Bucket = { count: number; resetAt: number };
const memoryStore = new Map<string, Bucket>();

type RedisLike = {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  del(key: string): Promise<number>;
};

let redis: RedisLike | null = null;

async function getRedis(): Promise<RedisLike | null> {
  if (redis) return redis;
  const url = process.env.REDIS_URL;
  if (!url) return null;
  try {
    const { default: Redis } = await import('ioredis');
    const client = new Redis(url, { maxRetriesPerRequest: 1, lazyConnect: true });
    await client.connect();
    redis = client;
    return redis;
  } catch {
    return null;
  }
}

async function increment(key: string, windowSec: number): Promise<number> {
  const r = await getRedis();
  if (r) {
    const count = await r.incr(key);
    if (count === 1) await r.expire(key, windowSec);
    return count;
  }
  const now = Date.now();
  let bucket = memoryStore.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowSec * 1000 };
    memoryStore.set(key, bucket);
  }
  bucket.count += 1;
  return bucket.count;
}

export async function rateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId =
      (req as Request & { user?: { id?: string } }).user?.id ||
      (req.headers['x-user-id'] as string | undefined) ||
      'anonymous';
    const ip =
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
      req.ip ||
      'unknown';

    const userCount = await increment(`rate:user:${userId}`, RATE_LIMITS.USER.window);
    const ipCount = await increment(`rate:ip:${ip}`, RATE_LIMITS.IP.window);

    res.setHeader('X-RateLimit-Limit-User', String(RATE_LIMITS.USER.limit));
    res.setHeader('X-RateLimit-Remaining-User', String(Math.max(0, RATE_LIMITS.USER.limit - userCount)));
    res.setHeader('X-RateLimit-Limit-IP', String(RATE_LIMITS.IP.limit));
    res.setHeader('X-RateLimit-Remaining-IP', String(Math.max(0, RATE_LIMITS.IP.limit - ipCount)));

    if (userCount > RATE_LIMITS.USER.limit) {
      logger.warn(`Rate limit exceeded for user: ${userId}`);
      res.status(429).json({
        error: 'Rate limit exceeded',
        message: `Maximum ${RATE_LIMITS.USER.limit} requests per minute`,
        retry_after: RATE_LIMITS.USER.window,
      });
      return;
    }

    if (ipCount > RATE_LIMITS.IP.limit) {
      logger.warn(`Rate limit exceeded for IP: ${ip}`);
      res.status(429).json({
        error: 'IP rate limit exceeded',
        message: `Maximum ${RATE_LIMITS.IP.limit} requests per minute from this IP`,
        retry_after: RATE_LIMITS.IP.window,
      });
      return;
    }

    next();
  } catch (err) {
    logger.error('Rate limit middleware error', err);
    next();
  }
}

export async function resetUserRateLimit(userId: string): Promise<void> {
  const r = await getRedis();
  if (r) await r.del(`rate:user:${userId}`);
  memoryStore.delete(`rate:user:${userId}`);
}

export async function resetIpRateLimit(ip: string): Promise<void> {
  const r = await getRedis();
  if (r) await r.del(`rate:ip:${ip}`);
  memoryStore.delete(`rate:ip:${ip}`);
}

export const rateLimitMiddlewareSync = rateLimitMiddleware;
