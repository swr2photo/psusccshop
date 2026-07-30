import { Redis } from '@upstash/redis';

let _redis: Redis | null = null;

/**
 * Lazy initializer for Upstash Redis client.
 * Returns null if Redis credentials are missing or set to placeholder values.
 */
export function getRedisClient(): Redis | null {
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
