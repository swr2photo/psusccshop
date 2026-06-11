/**

 * TTL cache for read-heavy DB paths.

 * L1: process-local Map (fast, per serverless instance)

 * L2: Upstash Redis when configured (shared across Vercel instances)

 * Pair with HTTP Cache-Control for CDN edge caching where appropriate.

 */



import { getRedisClient } from '@/lib/redis';



type CacheEntry<T> = {

  value: T;

  expiresAt: number;

};



const store = new Map<string, CacheEntry<unknown>>();

const MAX_ENTRIES = 500;

const REDIS_PREFIX = 'sc:';



function pruneIfNeeded() {

  if (store.size <= MAX_ENTRIES) return;

  const now = Date.now();

  for (const [key, entry] of store.entries()) {

    if (entry.expiresAt <= now) store.delete(key);

  }

  if (store.size > MAX_ENTRIES) {

    const overflow = store.size - MAX_ENTRIES;

    const keys = store.keys();

    for (let i = 0; i < overflow; i++) {

      const next = keys.next();

      if (next.done) break;

      store.delete(next.value);

    }

  }

}



function redisKey(key: string) {

  return `${REDIS_PREFIX}${key}`;

}



async function redisGet<T>(key: string): Promise<T | null> {

  const redis = getRedisClient();

  if (!redis) return null;

  try {

    return (await redis.get<T>(redisKey(key))) ?? null;

  } catch {

    return null;

  }

}



async function redisSet<T>(key: string, value: T, ttlMs: number): Promise<void> {

  const redis = getRedisClient();

  if (!redis) return;

  try {

    await redis.set(redisKey(key), value, { px: ttlMs });

  } catch {

    // Redis optional — L1 still works

  }

}



async function redisDeleteKey(key: string): Promise<void> {

  const redis = getRedisClient();

  if (!redis) return;

  try {

    await redis.del(redisKey(key));

  } catch {}

}



async function redisDeletePrefix(prefix: string): Promise<void> {

  const redis = getRedisClient();

  if (!redis) return;

  try {

    const keys = await redis.keys(`${REDIS_PREFIX}${prefix}*`);

    if (keys.length > 0) await redis.del(...keys);

  } catch {}

}



export async function getCached<T>(

  key: string,

  ttlMs: number,

  fetcher: () => Promise<T>

): Promise<T> {

  const now = Date.now();

  const hit = store.get(key) as CacheEntry<T> | undefined;

  if (hit && hit.expiresAt > now) {

    return hit.value;

  }



  const fromRedis = await redisGet<T>(key);

  if (fromRedis !== null) {

    store.set(key, { value: fromRedis, expiresAt: now + ttlMs });

    return fromRedis;

  }



  const value = await fetcher();

  store.set(key, { value, expiresAt: now + ttlMs });

  pruneIfNeeded();

  void redisSet(key, value, ttlMs);

  return value;

}



export function peekCached<T>(key: string): T | undefined {

  const hit = store.get(key) as CacheEntry<T> | undefined;

  if (!hit || hit.expiresAt <= Date.now()) return undefined;

  return hit.value;

}



export function setCached<T>(key: string, value: T, ttlMs: number) {

  store.set(key, { value, expiresAt: Date.now() + ttlMs });

  pruneIfNeeded();

  void redisSet(key, value, ttlMs);

}



export function invalidateCacheKey(key: string) {

  store.delete(key);

  void redisDeleteKey(key);

}



export function invalidateCachePrefix(prefix: string) {

  for (const key of store.keys()) {

    if (key.startsWith(prefix)) store.delete(key);

  }

  void redisDeletePrefix(prefix);

}



export function invalidateAllCache() {

  store.clear();

  void redisDeletePrefix('');

}



/** Common TTL presets (ms) */

export const CACHE_TTL = {

  config: 30_000,

  catalog: 120_000,

  reviews: 120_000,

  inventory: 60_000,

  chatSettings: 120_000,

  live: 15_000,

  typing: 1_500,

} as const;



export const PUBLIC_CONFIG_CACHE_KEY = 'config:public';

export const LIVE_CACHE_KEY = 'live:public';


