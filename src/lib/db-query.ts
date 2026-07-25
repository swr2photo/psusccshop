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

function isPoolExhaustedError(error: unknown): boolean {
  const msg = formatDbError(error).toLowerCase();
  return (
    msg.includes('emaxconnsession') ||
    msg.includes('max clients reached') ||
    msg.includes('too many clients') ||
    msg.includes('remaining connection slots') ||
    msg.includes('maxclientsinsessionmode')
  );
}

/** Run a DB query with timeout + retry (Workers and Vercel). */
export async function withDbRetry<T>(
  label: string,
  fn: () => Promise<T>,
  options?: { maxAttempts?: number; timeoutMs?: number },
): Promise<T> {
  let maxAttempts =
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
      if (isPoolExhaustedError(error) && maxAttempts < 4) {
        maxAttempts = 4;
      }
      if (attempt < maxAttempts) {
        await resetDbConnection();
        const delayMs = isPoolExhaustedError(error)
          ? 250 * attempt * attempt
          : 150 * attempt;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      throw error;
    }
  }

  throw new Error(`${label} failed`);
}

/** Re-export for callers that only need the shared db handle. */
export { db };
