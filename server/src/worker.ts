/**
 * Cloudflare Workers entry — deploy with `wrangler deploy`.
 */

import './polyfill-node-globals.js';
import { CloudflareAdapter } from 'elysia/adapter/cloudflare-worker';
import { createApiApp } from './app.js';
import { applyBrowserCorsHeaders } from './lib/apply-cors.js';

export interface Env {
  /** Cloudflare Hyperdrive binding for PostgreSQL (required for pg on Workers). */
  HYPERDRIVE?: { connectionString: string };
  [key: string]: unknown;
}

const app = createApiApp({ adapter: CloudflareAdapter }).compile();

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    (globalThis as typeof globalThis & { __CF_ENV__?: Env }).__CF_ENV__ = env;
    
    // Copy all env bindings to process.env for standard libraries (NextAuth, etc.)
    if (env && typeof env === 'object') {
      process.env ??= {};
      for (const [key, value] of Object.entries(env)) {
        if (typeof value === 'string') {
          process.env[key] = value;
        }
      }
    }

    try {
      return await app.fetch(request);
    } catch (error) {
      console.error('[worker] Unhandled fetch error:', error);
      const headers = applyBrowserCorsHeaders(
        { 'Content-Type': 'application/json; charset=utf-8' },
        request,
      );
      return new Response(
        JSON.stringify({ status: 'error', message: 'Internal server error' }),
        { status: 500, headers: headers as HeadersInit },
      );
    }
  },
};
