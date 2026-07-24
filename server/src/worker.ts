/**
 * Cloudflare Workers entry — deploy with `wrangler deploy`.
 */

import './polyfill-node-globals.js';
import { CloudflareAdapter } from 'elysia/adapter/cloudflare-worker';
import { createApiApp } from './app.js';
import { applyBrowserCorsHeaders } from './lib/apply-cors.js';
import {
  isEdgeCacheableRequest,
  matchEdgeCache,
  putEdgeCache,
} from './lib/edge-cache.js';

export interface Env {
  /** Cloudflare Hyperdrive binding for PostgreSQL (required for pg on Workers). */
  HYPERDRIVE?: { connectionString: string };
  [key: string]: unknown;
}

const app = createApiApp({ adapter: CloudflareAdapter }).compile();

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: { waitUntil: (promise: Promise<unknown>) => void },
  ): Promise<Response> {
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
      if (isEdgeCacheableRequest(request)) {
        const cached = await matchEdgeCache(request);
        if (cached) {
          const headers = new Headers(cached.headers);
          headers.set('X-Edge-Cache', 'HIT');
          return new Response(cached.body, {
            status: cached.status,
            statusText: cached.statusText,
            headers,
          });
        }
      }

      const response = await app.fetch(request);

      if (isEdgeCacheableRequest(request) && response.ok) {
        const headers = new Headers(response.headers);
        headers.set('X-Edge-Cache', 'MISS');
        const missResponse = new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
        ctx.waitUntil(putEdgeCache(request, missResponse.clone()));
        return missResponse;
      }

      return response;
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
