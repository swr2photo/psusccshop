/**
 * SCC Shop API — ElysiaJS backend (Bun runtime)
 *
 * Run: bun run dev  (from server/) or npm run dev:api (from root)
 * Port: API_PORT (default 3001)
 */

import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { healthRoutes } from './routes/health.js';
import { nextProxyRoutes } from './routes/next-proxy.js';

const PORT = Number(process.env.API_PORT || 3001);

const allowedOrigins = [
  process.env.NEXT_PUBLIC_BASE_URL,
  process.env.NEXT_PUBLIC_APP_URL,
  'http://localhost:3000',
  'http://127.0.0.1:3000',
].filter(Boolean) as string[];

const app = new Elysia({ prefix: '/api' })
  .use(
    cors({
      origin:
        process.env.NODE_ENV !== 'production'
          ? true
          : allowedOrigins.length > 0
            ? allowedOrigins
            : true,
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
  .use(nextProxyRoutes)
  .listen(PORT);

console.log(`🚀 SCC Shop API (Elysia/Bun) listening on http://localhost:${PORT}/api/health`);

export type App = typeof app;
