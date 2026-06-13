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
