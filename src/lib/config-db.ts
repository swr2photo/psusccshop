import { eq } from 'drizzle-orm';
import { config } from '@/db/schema';
import { db, resetDbConnection } from '@/lib/db';
import { formatDbError, withDbRetry } from '@/lib/db-query';
import { CACHE_TTL, getCached, invalidateCacheKey } from '@/lib/server-cache';

export { formatDbError };

export const configCacheKey = (key: string) => `json:config:${key}`;

/** Read one row from config with retry + connection reset. Returns null on failure. */
export async function fetchConfigValue<T = unknown>(key: string): Promise<T | null> {
  try {
    const rows = await withDbRetry(`config:${key}`, () =>
      db.select().from(config).where(eq(config.key, key)).limit(1),
    );
    return (rows[0]?.value as T) ?? null;
  } catch (error) {
    console.error(`[config-db] fetch "${key}" failed:`, formatDbError(error));
    return null;
  }
}

export async function getConfigValueCached<T = unknown>(
  key: string,
  ttlMs: number = CACHE_TTL.config,
): Promise<T | null> {
  return getCached(configCacheKey(key), ttlMs, () => fetchConfigValue<T>(key));
}

export function invalidateConfigCache(key: string): void {
  invalidateCacheKey(configCacheKey(key));
}

// resetDbConnection re-export for backward compatibility
export { resetDbConnection };
