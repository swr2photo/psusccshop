import type { ElysiaAdapter } from 'elysia';
import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { getApiCorsOrigins } from './lib/cors-origins.js';
import { healthRoutes } from './routes/health.js';
import { nextProxyRoutes } from './routes/next-proxy.js';

type CreateApiAppOptions = {
  adapter?: ElysiaAdapter;
};

/** Shared Elysia app — used by Bun (index.ts) and Cloudflare Workers (worker.ts). */
export function createApiApp(options: CreateApiAppOptions = {}) {
  const allowedOrigins = getApiCorsOrigins();

  return new Elysia({
    prefix: '/api',
    ...(options.adapter ? { adapter: options.adapter } : {}),
  })
    .use(
      cors({
        origin:
          process.env.NODE_ENV !== 'production'
            ? true
            : (request) => {
                const origin = request.headers.get('origin');
                if (!origin) return true;
                if (allowedOrigins.includes(origin)) return true;
                if (origin.endsWith('.psuscc.club') || origin.endsWith('.psusci.club')) return true;
                if (
                  origin.startsWith('http://localhost:') ||
                  origin.startsWith('http://127.0.0.1:')
                ) {
                  return true;
                }
                return false;
              },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'X-Requested-With'],
      }),
    )
    .onError(({ error, set }) => {
      console.error('[API] Unhandled error:', error);
      set.status = 500;
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Internal server error',
      };
    })
    .use(healthRoutes)
    .use(nextProxyRoutes);
}

export type ApiApp = ReturnType<typeof createApiApp>;
