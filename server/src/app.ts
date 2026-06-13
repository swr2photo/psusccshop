import type { ElysiaAdapter } from 'elysia';
import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { isBrowserOriginAllowed } from './lib/cors-origins.js';
import { applyBrowserCorsHeaders } from './lib/apply-cors.js';
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
    .use(apiSecurityPlugin())
    .onError(({ error, set, request }) => {
      console.error('[API] Unhandled error:', error);
      set.status = 500;
      set.headers = applyBrowserCorsHeaders(
        {
          ...set.headers,
          'Content-Type': 'application/json; charset=utf-8',
        },
        request,
      );
      return {
        status: 'error',
        message: safeApiErrorMessage(error),
      };
    })
    .use(healthRoutes)
    .use(nextProxyRoutes);
}

export type ApiApp = ReturnType<typeof createApiApp>;
