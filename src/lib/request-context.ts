/**
 * Request scope for API routes invoked outside Next.js App Router (Elysia / Workers).
 */
import { AsyncLocalStorage } from 'node:async_hooks';

const storage = new AsyncLocalStorage<{ request: Request }>();

export function runWithRequest<T>(request: Request, fn: () => T | Promise<T>): T | Promise<T> {
  return storage.run({ request }, fn);
}

export function getCurrentRequest(): Request | undefined {
  return storage.getStore()?.request;
}
