/**
 * Cloudflare Workers entry — deploy with `wrangler deploy`.
 */

import './polyfill-node-globals.js';
import { CloudflareAdapter } from 'elysia/adapter/cloudflare-worker';
import { createApiApp } from './app.js';

export interface Env {
  /** Cloudflare Hyperdrive binding for PostgreSQL (required for pg on Workers). */
  HYPERDRIVE?: { connectionString: string };
  [key: string]: unknown;
}

const app = createApiApp({ adapter: CloudflareAdapter }).compile();

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    (globalThis as typeof globalThis & { __CF_ENV__?: Env }).__CF_ENV__ = env;
    return app.fetch(request);
  },
};
