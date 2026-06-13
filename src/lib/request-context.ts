/**
 * Request scope for API routes invoked outside Next.js App Router (Elysia / Workers).
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import { isCloudflareWorkersRuntime } from '@/lib/runtime-env';
import { runWithWorkersDb } from '@/lib/db-workers-scope';

const storage = new AsyncLocalStorage<{ request: Request }>();

export function runWithRequest<T>(request: Request, fn: () => T | Promise<T>): T | Promise<T> {
  const run = () => storage.run({ request }, fn);

  if (isCloudflareWorkersRuntime()) {
    return runWithWorkersDb(run);
  }

  return run();
}

export function getCurrentRequest(): Request | undefined {
  return storage.getStore()?.request;
}
