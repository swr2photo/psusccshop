/** Fail fast when a DB call hangs (common with misconfigured pg on Workers). */
export async function withDbTimeout<T>(
  promise: Promise<T>,
  ms = 8_000,
  label = 'database query',
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} timed out after ${ms}ms`)),
          ms,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
