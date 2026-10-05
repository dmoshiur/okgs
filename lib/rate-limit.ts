/**
 * A tiny fixed-window limiter for the credential endpoints.
 *
 * This is deliberately process-local: it stops password spraying and reset-mail
 * flooding on a single instance, which is what the school deployment runs. If the
 * app is ever scaled across instances, back it with the database (the
 * `password_resets` table already records reset requests per address).
 */
interface Bucket {
  count: number;
  resetAt: number;
}

const store = globalThis as unknown as { okgsRateLimits?: Map<string, Bucket> };

function buckets() {
  if (!store.okgsRateLimits) store.okgsRateLimits = new Map();
  return store.okgsRateLimits;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function rateLimit(key: string, options: { max: number; windowMs: number }): RateLimitResult {
  const map = buckets();
  const now = Date.now();
  const bucket = map.get(key);

  if (!bucket || bucket.resetAt <= now) {
    map.set(key, { count: 1, resetAt: now + options.windowMs });
    return { ok: true, remaining: options.max - 1, retryAfterSeconds: 0 };
  }

  bucket.count += 1;
  if (bucket.count > options.max) {
    return { ok: false, remaining: 0, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  return { ok: true, remaining: options.max - bucket.count, retryAfterSeconds: 0 };
}

export function clearRateLimit(key: string) {
  buckets().delete(key);
}

/** Housekeeping so a long-running process never grows the map forever. */
export function pruneRateLimits() {
  const map = buckets();
  const now = Date.now();
  for (const [key, bucket] of map) {
    if (bucket.resetAt <= now) map.delete(key);
  }
}
