/**
 * Cloudflare Cache API helpers for public, cookie-agnostic GET responses.
 * Workers do not inherit Vercel CDN — without this, every hit can cold-start + query DB (~1–2s).
 */

const CACHEABLE_PREFIXES = [
  '/api/config',
  '/api/live',
  '/api/shops/catalog',
  '/api/reviews',
  '/api/inventory',
  '/api/chatbot',
  '/api/shipping/options',
  '/api/support-chat/settings/public',
  '/api/image/',
];

export function isEdgeCacheableRequest(request: Request): boolean {
  if (request.method !== 'GET' && request.method !== 'HEAD') return false;
  // Auth cookies must not key shared public cache
  if (request.headers.has('authorization')) return false;

  const pathname = new URL(request.url).pathname;
  if (CACHEABLE_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true;
  return /^\/api\/shops\/[^/]+\/(public|products)$/.test(pathname);
}

/** Cache key ignores Cookie / Authorization so public responses can be shared. */
export function edgeCacheKey(request: Request): Request {
  const url = new URL(request.url);
  return new Request(url.toString(), { method: 'GET' });
}

export async function matchEdgeCache(request: Request): Promise<Response | undefined> {
  try {
    // @ts-expect-error caches.default is provided by Cloudflare Workers runtime
    const cache = caches.default as Cache;
    return (await cache.match(edgeCacheKey(request))) ?? undefined;
  } catch {
    return undefined;
  }
}

export async function putEdgeCache(request: Request, response: Response): Promise<void> {
  if (!response.ok) return;
  try {
    // @ts-expect-error caches.default is provided by Cloudflare Workers runtime
    const cache = caches.default as Cache;
    const headers = new Headers(response.headers);
    if (!headers.has('Cache-Control')) {
      headers.set('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=300');
    }
    // Explicit CF CDN directive (zone/proxy caching)
    if (!headers.has('CDN-Cache-Control')) {
      headers.set('CDN-Cache-Control', 'public, max-age=120');
    }
    headers.set('X-Edge-Cache', 'stored');
    const body = await response.arrayBuffer();
    await cache.put(
      edgeCacheKey(request),
      new Response(body, { status: response.status, statusText: response.statusText, headers }),
    );
  } catch (error) {
    console.warn('[edge-cache] put failed:', error);
  }
}
