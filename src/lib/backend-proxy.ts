/**
 * Proxy Next.js API routes to the Elysia/Workers backend.
 * Set API_INTERNAL_URL (server-only) e.g. http://localhost:3001
 *
 * Production always uses same-origin /api/*; middleware may forward to
 * https://api.psuscc.club. Session/NextAuth routes MUST stay on Vercel —
 * Workers auth is unreliable with Domain cookies + stale bundles.
 *
 * API_PROXY_ALL=1 → only PROXY_ALLOWLIST goes to Workers (safe default: rest on Vercel).
 * Without it (Option A) → proxy public GETs + webhook/cron writes, keep session routes local.
 */

import { NextRequest, NextResponse } from 'next/server';
import { isCloudflareWorkersRuntime } from '@/lib/runtime-env';

const PRODUCTION_WORKERS_API = 'https://api.psuscc.club';

/** Backend URL for middleware / route proxy (empty = handle locally). */
export function getBackendProxyUrl(): string {
  // Never proxy from Workers — we ARE the backend.
  if (isCloudflareWorkersRuntime()) return '';

  const configured = process.env.API_INTERNAL_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');

  // Vercel production split deploy — proxy even if API_INTERNAL_URL env is missing
  if (process.env.VERCEL === '1' && process.env.NODE_ENV === 'production') {
    return PRODUCTION_WORKERS_API;
  }

  return '';
}

export function shouldProxyToBackend(): boolean {
  return Boolean(getBackendProxyUrl());
}

/**
 * Routes that read/write NextAuth session cookies.
 * Never proxy these — Workers hop → 401/500 (กรุณาเข้าสู่ระบบ).
 */
export const SESSION_BOUND_API_PREFIXES = [
  '/api/auth',
  '/api/admin',
  '/api/shops',
  '/api/profile',
  '/api/cart',
  '/api/orders',
  '/api/config',
  '/api/upload',
  '/api/push-subscription',
  '/api/invoice',
  '/api/support-chat',
  '/api/refund',
  '/api/payment-info',
  '/api/payment/create-charge',
  '/api/payment/verify',
  '/api/payment/stripe',
  '/api/payment/webhook',
  '/api/payment/config',
  '/api/shipping',
  '/api/stock-alert',
  '/api/privacy',
  '/api/gas',
  '/api/pickup',
  '/api/reviews',
  '/api/inventory',
  '/api/live',
  '/api/chatbot',
  '/api/promo',
  '/api/slip',
  '/api/auto-email',
] as const;

/**
 * Stateless / public / cron routes safe on Workers when API_PROXY_ALL=1.
 * Everything else stays on Vercel (fail-closed for session safety).
 */
export const WORKERS_PROXY_ALLOWLIST = [
  '/api/health',
  '/api/time',
  '/api/image',
  '/api/cron',
  // Public catalog reads (also under /api/shops which is session-bound —
  // session-bound wins; listed for documentation / future split)
  '/api/shops/catalog',
] as const;

/**
 * Option A (no API_PROXY_ALL): keep session + storefront on Vercel;
 * proxy remaining public GETs to Workers.
 */
const KEEP_SAFE_DEFAULT = [
  ...SESSION_BOUND_API_PREFIXES,
  '/api/image',
] as const;

function isProxyAllEnabled(): boolean {
  return process.env.API_PROXY_ALL === '1' || process.env.API_PROXY_ALL === 'true';
}

/** Exact path or nested under prefix/ — avoids /api/config matching /api/configuration */
function matchesPrefix(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/** True when this API path must be handled on Vercel (NextAuth / session). */
export function shouldKeepApiOnVercel(pathname: string): boolean {
  if (!pathname.startsWith('/api/')) return false;

  // Session-bound always stays local
  if (matchesPrefix(pathname, SESSION_BOUND_API_PREFIXES)) return true;

  if (!isProxyAllEnabled()) {
    // Option A: also keep storefront helpers that were historically local
    if (matchesPrefix(pathname, KEEP_SAFE_DEFAULT)) return true;
    // Cron intentionally leaves Vercel even in Option A
    if (pathname.startsWith('/api/cron')) return false;
  }

  return false;
}

/**
 * Decide whether middleware / withBackendProxy should forward to Workers.
 *
 * API_PROXY_ALL=1: allowlist only (fail-closed).
 * Otherwise: proxy GET/HEAD for non-kept paths + webhook/cron writes.
 */
export function shouldProxyApiRoute(pathname: string, method = 'GET'): boolean {
  if (!shouldProxyToBackend()) return false;
  if (!pathname.startsWith('/api/')) return false;
  if (shouldKeepApiOnVercel(pathname)) return false;

  if (isProxyAllEnabled()) {
    return matchesPrefix(pathname, WORKERS_PROXY_ALLOWLIST);
  }

  // Option A: only proxy GET/HEAD (plus webhook/cron writes)
  const verb = method.toUpperCase();
  if (verb !== 'GET' && verb !== 'HEAD') {
    return pathname.startsWith('/api/cron');
  }
  return true;
}

/** Dev/test helper — where a path would run under current env flags. */
export function resolveApiRuntime(
  pathname: string,
  method = 'GET',
): 'vercel' | 'workers' | 'local' {
  if (!pathname.startsWith('/api/')) return 'local';
  if (!shouldProxyToBackend()) return 'vercel';
  return shouldProxyApiRoute(pathname, method) ? 'workers' : 'vercel';
}

function buildProxyRequestHeaders(request: NextRequest): Headers {
  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('connection');

  // Edge middleware: merge request.cookies into Cookie header for subrequests
  const jarCookies = request.cookies.getAll();
  if (jarCookies.length > 0) {
    const merged = new Map<string, string>();
    for (const part of (headers.get('cookie') ?? '').split(';')) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      merged.set(trimmed.slice(0, eq), trimmed.slice(eq + 1));
    }
    for (const { name, value } of jarCookies) {
      merged.set(name, value);
    }
    headers.set(
      'cookie',
      [...merged.entries()].map(([name, value]) => `${name}=${value}`).join('; '),
    );
  }

  return headers;
}

export async function proxyToBackend(request: NextRequest): Promise<NextResponse> {
  const base = getBackendProxyUrl();
  if (!base) {
    return NextResponse.json(
      { status: 'error', message: 'API backend not configured' },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const target = `${base}${url.pathname}${url.search}`;

  const headers = buildProxyRequestHeaders(request);

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const body = hasBody ? await request.arrayBuffer() : undefined;

  try {
    const res = await fetch(target, {
      method: request.method,
      headers,
      body,
      // Avoid serving stale empty/error responses from edge cache
      cache: 'no-store',
    });

    const responseHeaders = new Headers(res.headers);
    responseHeaders.delete('transfer-encoding');

    return new NextResponse(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('[backend-proxy] fetch failed:', target, error);
    return NextResponse.json(
      { status: 'error', message: 'API backend unreachable' },
      { status: 502 },
    );
  }
}

type RouteHandler = (req: NextRequest, ...args: unknown[]) => Promise<NextResponse> | NextResponse;

/** Wrap a route handler — forwards to Elysia when backend proxy URL is configured. */
export function withBackendProxy(handler: RouteHandler): RouteHandler {
  return async (req: NextRequest, ...args: unknown[]) => {
    const pathname = new URL(req.url).pathname;
    if (shouldProxyApiRoute(pathname, req.method)) return proxyToBackend(req);
    return handler(req, ...args);
  };
}
