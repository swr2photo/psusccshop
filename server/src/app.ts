import type { ElysiaAdapter } from 'elysia';
import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { isBrowserOriginAllowed } from './lib/cors-origins.js';
import { apiSecurityPlugin, isServerToServerPath, safeApiErrorMessage } from './lib/api-security.js';
import { healthRoutes } from './routes/health.js';
import { nextProxyRoutes } from './routes/next-proxy.js';

type CreateApiAppOptions = {
  adapter?: ElysiaAdapter;
};

/** Shared Elysia app — used by Bun (index.ts) and Cloudflare Workers (worker.ts). */
export function createApiApp(options: CreateApiAppOptions = {}) {
  const isProd = process.env.NODE_ENV === 'production';

  return new Elysia({
    prefix: '/api',
    ...(options.adapter ? { adapter: options.adapter } : {}),
  })
    .use(apiSecurityPlugin())
    .use(
      cors({
        origin:
          !isProd
            ? true
            : (request) => {
                const origin = request.headers.get('origin');
                const pathname = new URL(request.url).pathname;
                if (!origin) {
                  return isServerToServerPath(pathname);
                }
                return isBrowserOriginAllowed(origin);
              },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'X-Requested-With'],
      }),
    )
    .onError(({ error, set }) => {
      console.error('[API] Unhandled error:', error);
      set.status = 500;
      set.headers = {
        ...set.headers,
        'Content-Type': 'application/json; charset=utf-8',
      };
      return {
        status: 'error',
        message: safeApiErrorMessage(error),
      };
    })
    .use(healthRoutes)
    .use(nextProxyRoutes);
}

export type ApiApp = ReturnType<typeof createApiApp>;
