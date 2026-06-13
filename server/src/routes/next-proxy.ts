import { Elysia } from 'elysia';
import { invokeNextRoute } from '../lib/next-bridge.js';
import { resolveApiRoute } from '../lib/router.js';
import { jsonBody } from '../lib/json.js';
import { withBrowserCors } from '../lib/apply-cors.js';

/**
 * Catch-all — delegates to existing Next.js route handlers via dynamic import.
 * Auth routes (/api/auth/*) are excluded in registry and stay on Next.js.
 */
export const nextProxyRoutes = new Elysia()
  .all('/*', async ({ request }) => {
    const url = new URL(request.url);
    const match = resolveApiRoute(url.pathname);

    if (!match) {
      return withBrowserCors(
        jsonBody({ status: 'error', message: 'Not Found' }, { status: 404 }),
        request,
      );
    }

    return invokeNextRoute(match.module, request, match.params);
  });
