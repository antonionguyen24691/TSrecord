import type { Request, Response, NextFunction } from 'express';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

type Bucket = {
  count: number;
  resetAt: number;
};

type LimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

const parsePositiveInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

const WINDOW_MS = parsePositiveInt(process.env.RATE_LIMIT_WINDOW_MS, 60_000);
const GENERAL_MAX = parsePositiveInt(process.env.RATE_LIMIT_MAX, 120);
const PROXY_MAX = parsePositiveInt(process.env.RATE_LIMIT_PROXY_MAX, 20);
const WEBHOOK_MAX = parsePositiveInt(process.env.RATE_LIMIT_WEBHOOK_MAX, 300);

const windowLabel = (): `${number} ms` => `${WINDOW_MS} ms`;

type LimitKind = 'general' | 'proxy' | 'webhook';

const getUpstashRedis = (): Redis | null => {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  return new Redis({ url, token });
};

const createUpstashLimiters = (redis: Redis): Record<LimitKind, Ratelimit> => ({
  general: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(GENERAL_MAX, windowLabel()),
    prefix: 'tsr:rl:general',
  }),
  proxy: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(PROXY_MAX, windowLabel()),
    prefix: 'tsr:rl:proxy',
  }),
  webhook: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(WEBHOOK_MAX, windowLabel()),
    prefix: 'tsr:rl:webhook',
  }),
});

const upstashRedis = getUpstashRedis();
const upstashLimiters = upstashRedis ? createUpstashLimiters(upstashRedis) : null;

export const rateLimitBackend = upstashLimiters ? 'upstash' : 'memory';

const getClientIp = (req: Request): string => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0]?.trim() || 'unknown';
  }
  return req.socket.remoteAddress || 'unknown';
};

const getLimitKind = (path: string): LimitKind => {
  if (path.startsWith('/api/webhooks') || path.startsWith('/api/v2/webhooks')) {
    return 'webhook';
  }
  if (path.includes('/proxy/')) {
    return 'proxy';
  }
  return 'general';
};

const getLimitForKind = (kind: LimitKind): number => {
  if (kind === 'webhook') return WEBHOOK_MAX;
  if (kind === 'proxy') return PROXY_MAX;
  return GENERAL_MAX;
};

const consumeMemory = (key: string, limit: number): LimitResult => {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    const resetAt = now + WINDOW_MS;
    buckets.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  if (bucket.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: bucket.resetAt };
  }

  bucket.count += 1;
  return { allowed: true, remaining: limit - bucket.count, resetAt: bucket.resetAt };
};

const consumeUpstash = async (key: string, kind: LimitKind): Promise<LimitResult> => {
  const limiter = upstashLimiters?.[kind];
  if (!limiter) {
    return consumeMemory(key, getLimitForKind(kind));
  }

  const result = await limiter.limit(key);
  return {
    allowed: result.success,
    remaining: result.remaining,
    resetAt: result.reset,
  };
};

const applyRateLimitHeaders = (res: Response, limit: number, result: LimitResult): void => {
  res.setHeader('X-RateLimit-Limit', String(limit));
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, result.remaining)));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)));
  res.setHeader('X-RateLimit-Backend', rateLimitBackend);
};

export const rateLimitMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (process.env.RATE_LIMIT_DISABLED === 'true') {
    next();
    return;
  }

  const kind = getLimitKind(req.path);
  const limit = getLimitForKind(kind);
  const key = `${getClientIp(req)}:${req.path.split('/').slice(0, 4).join('/')}`;

  const finish = (result: LimitResult) => {
    applyRateLimitHeaders(res, limit, result);
    if (!result.allowed) {
      const retryAfterSec = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      res.status(429).json({
        error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.',
        retryAfterSeconds: retryAfterSec,
      });
      return;
    }
    next();
  };

  if (upstashLimiters) {
    consumeUpstash(key, kind)
      .then(finish)
      .catch(() => finish(consumeMemory(key, limit)));
    return;
  }

  finish(consumeMemory(key, limit));
};
