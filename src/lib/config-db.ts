import { eq } from 'drizzle-orm';
import { config } from '@/db/schema';
import { db, resetDbConnection } from '@/lib/db';
import { withDbTimeout } from '@/lib/db-timeout';
import { isCloudflareWorkersRuntime } from '@/lib/runtime-env';
import { CACHE_TTL, getCached, invalidateCacheKey } from '@/lib/server-cache';

export const configCacheKey = (key: string) => `json:config:${key}`;

export function formatDbError(error: unknown): string {
  if (error instanceof Error) {
    const cause = (error as Error & { cause?: unknown }).cause;
    if (cause instanceof Error) {
      return `${error.message} | cause: ${cause.message}`;
    }
    return error.message;
  }
  return String(error);
}

/** Read one row from config with retry + connection reset on Workers. */
export async function fetchConfigValue<T = unknown>(key: string): Promise<T | null> {
  const maxAttempts = isCloudflareWorkersRuntime() ? 3 : 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const rows = await withDbTimeout(
        db.select().from(config).where(eq(config.key, key)).limit(1),
        8_000,
        `config:${key}`,
      );
      return (rows[0]?.value as T) ?? null;
    } catch (error) {
      console.error(
        `[config-db] fetch "${key}" attempt ${attempt}/${maxAttempts}:`,
        formatDbError(error),
      );
      if (attempt < maxAttempts) {
        await resetDbConnection();
        await new Promise((resolve) => setTimeout(resolve, 150 * attempt));
        continue;
      }
      throw error;
    }
  }

  return null;
}

export async function getConfigValueCached<T = unknown>(
  key: string,
  ttlMs = CACHE_TTL.config,
): Promise<T | null> {
  return getCached(configCacheKey(key), ttlMs, () => fetchConfigValue<T>(key));
}

export function invalidateConfigCache(key: string): void {
  invalidateCacheKey(configCacheKey(key));
}
