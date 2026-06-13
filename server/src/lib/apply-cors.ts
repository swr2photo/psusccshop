import { isBrowserOriginAllowed } from './cors-origins.js';

/** Ensure browser credentialed responses include CORS headers (errors/security blocks). */
export function applyBrowserCorsHeaders(
  headers: Record<string, string | number | undefined>,
  request: Request,
): Record<string, string | number | undefined> {
  const origin = request.headers.get('origin');
  if (!origin || !isBrowserOriginAllowed(origin)) return headers;
  return {
    ...headers,
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    Vary: 'Origin',
  };
}

/** Attach CORS headers to a Response (next-bridge errors, proxy 404, etc.). */
export function withBrowserCors(response: Response, request: Request): Response {
  const origin = request.headers.get('origin');
  if (!origin || !isBrowserOriginAllowed(origin)) return response;

  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Credentials', 'true');
  headers.append('Vary', 'Origin');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
