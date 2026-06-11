import { Redis } from '@upstash/redis';

let _redis: Redis | null = null;

/**
 * Lazy initializer for Upstash Redis client.
 * Returns null if Redis credentials are missing or set to placeholder values.
 */
export function getRedisClient(): Redis | null {
  if (_redis) return _redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token || url.includes('placeholder') || token.includes('placeholder')) {
    return null;
  }
  _redis = new Redis({ url, token });
  return _redis;
}
