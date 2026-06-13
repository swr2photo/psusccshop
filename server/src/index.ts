/**
 * Bun runtime entry — local dev & Docker.
 * Cloudflare Workers use src/worker.ts instead.
 */

import { createApiApp } from './app.js';
import { getApiCorsOrigins, resolveApiPort } from './lib/cors-origins.js';

const PORT = resolveApiPort();
const allowedOrigins = getApiCorsOrigins();

const app = createApiApp();
app.listen({ port: PORT, hostname: '0.0.0.0' });

console.log(`🚀 SCC Shop API (Elysia/Bun) listening on http://0.0.0.0:${PORT}/api/health`);
console.log(`   CORS origins: ${allowedOrigins.join(', ') || '(all in dev)'}`);

export type App = typeof app;
