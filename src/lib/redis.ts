import { Redis } from '@upstash/redis';

let _redis: Redis | null = null;

/**
 * Circuit breaker: when Upstash answers with an error (e.g. "database has been
 * temporarily rate-limited") the REST client does NOT always throw — commands
 * resolve to undefined. Callers that detect that call markRedisUnavailable(),
 * and for a short while every caller gets `null` and uses its own fallback
 * (in-memory rate limit, DB stock, DB order status) instead of hammering Redis.
 */
let unavailableUntil = 0;
const DEFAULT_COOLDOWN_MS = 60_000;

export function markRedisUnavailable(reason?: unknown, cooldownMs = DEFAULT_COOLDOWN_MS): void {
  const wasUp = Date.now() >= unavailableUntil;
  unavailableUntil = Date.now() + cooldownMs;
  if (wasUp) {
    console.warn(`[Redis] unavailable — using fallbacks for ${Math.round(cooldownMs / 1000)}s:`, reason ?? '');
  }
}

export function isRedisTemporarilyUnavailable(): boolean {
  return Date.now() < unavailableUntil;
}

/**
 * Lazy initializer for Upstash Redis client.
 * Returns null if Redis credentials are missing/placeholder, or while the
 * circuit breaker is open after Redis reported an error.
 */
export function getRedisClient(): Redis | null {
  if (isRedisTemporarilyUnavailable()) return null;
  if (_redis) return _redis;
  let url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token || url.includes('placeholder') || token.includes('placeholder')) {
    return null;
  }

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }

  _redis = new Redis({ url, token });
  return _redis;
}
