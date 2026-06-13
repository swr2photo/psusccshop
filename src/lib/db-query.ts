import { db, resetDbConnection } from '@/lib/db';
import { withDbTimeout } from '@/lib/db-timeout';
import { isCloudflareWorkersRuntime } from '@/lib/runtime-env';

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

/** Run a DB query with timeout + retry (Workers and Vercel). */
export async function withDbRetry<T>(
  label: string,
  fn: () => Promise<T>,
  options?: { maxAttempts?: number; timeoutMs?: number },
): Promise<T> {
  const maxAttempts =
    options?.maxAttempts ?? (isCloudflareWorkersRuntime() ? 3 : 2);
  const timeoutMs = options?.timeoutMs ?? 8_000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await withDbTimeout(fn(), timeoutMs, label);
    } catch (error) {
      console.error(
        `[db-query] ${label} attempt ${attempt}/${maxAttempts}:`,
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

  throw new Error(`${label} failed`);
}

/** Re-export for callers that only need the shared db handle. */
export { db };
