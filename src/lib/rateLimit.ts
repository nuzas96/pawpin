import "server-only";

/**
 * Lightweight in-memory sliding-window rate limiter for sensitive server
 * actions (reporting, matching decisions, comments, moderation flags).
 *
 * SCOPE / HONEST LIMITATION: this limiter lives in the Node process memory,
 * so on a serverless/multi-instance deployment (e.g. Vercel) it is enforced
 * *per instance*, not globally — it meaningfully throttles a single abusive
 * client hitting one warm instance, but is not a distributed guarantee. The
 * documented production upgrade is a Supabase/Postgres-backed counter (a
 * table keyed by `(actor, action, window)` with a short TTL) or an edge
 * rate-limit service. This implementation is deliberately dependency-free so
 * it never blocks the local demo or a clean build. See
 * `docs/security-report.md`.
 */

type Bucket = { timestamps: number[] };

// Keyed by `${action}:${identity}`. Bounded cleanup keeps memory flat.
const buckets = new Map<string, Bucket>();

export type RateLimitRule = {
  /** Max allowed events within the window. */
  limit: number;
  /** Sliding window length in milliseconds. */
  windowMs: number;
};

/** Sensible defaults per sensitive action. */
export const RATE_LIMITS = {
  report: { limit: 8, windowMs: 60_000 }, // 8 reports / minute
  matchDecision: { limit: 20, windowMs: 60_000 }, // linking/creating from review
  comment: { limit: 10, windowMs: 60_000 },
  flag: { limit: 6, windowMs: 60_000 },
  ai: { limit: 10, windowMs: 60_000 }, // AI vision suggestions (external API cost)
} as const;

export type RateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; retryAfterMs: number };

/**
 * Records an event for `(action, identity)` and returns whether it is within
 * the rule. `identity` should be a stable per-user id (auth uid) — fall back
 * to an IP or "anon" when no user is available.
 */
export function checkRateLimit(
  action: keyof typeof RATE_LIMITS | string,
  identity: string,
  rule: RateLimitRule
): RateLimitResult {
  const now = Date.now();
  const key = `${action}:${identity}`;
  const bucket = buckets.get(key) ?? { timestamps: [] };

  // Drop timestamps outside the window.
  const windowStart = now - rule.windowMs;
  bucket.timestamps = bucket.timestamps.filter((t) => t > windowStart);

  if (bucket.timestamps.length >= rule.limit) {
    const oldest = bucket.timestamps[0];
    buckets.set(key, bucket);
    return { ok: false, retryAfterMs: Math.max(0, oldest + rule.windowMs - now) };
  }

  bucket.timestamps.push(now);
  buckets.set(key, bucket);

  // Opportunistic cleanup so the map doesn't grow unbounded across many keys.
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) {
      if (b.timestamps.length === 0 || b.timestamps[b.timestamps.length - 1] < windowStart) {
        buckets.delete(k);
      }
    }
  }

  return { ok: true, remaining: rule.limit - bucket.timestamps.length };
}

/** Standard friendly message for a throttled action. */
export const RATE_LIMIT_MESSAGE =
  "Too many requests. Please wait a moment before trying again.";

/** Test-only helper to reset all buckets between test cases. */
export function __resetRateLimitsForTest(): void {
  buckets.clear();
}
