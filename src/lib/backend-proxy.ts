/**
 * Proxy Next.js API routes to the Elysia/Workers backend.
 * Set API_INTERNAL_URL (server-only) e.g. http://localhost:3001
 *
 * Option B: set API_PROXY_ALL=1 on Vercel AFTER Workers is redeployed with
 * matching route handlers + NEXTAUTH_SECRET. Until then, keep hot/session
 * routes on Vercel (Option A) to avoid 401s from stale Workers bundles.
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
 * True NextAuth writers + session-bound admin/commerce stay on Vercel.
 * Workers JWT auth is used for other proxied routes; these stay local so a
 * secret/cookie mismatch (or stale Workers auth) cannot 500 the UI.
 */
const ALWAYS_ON_VERCEL_PREFIXES = [
  '/api/auth',
  '/api/admin',
  '/api/shops',
  '/api/profile',
  '/api/cart',
  '/api/orders',
  '/api/payment-info',
  '/api/payment/create-charge',
  '/api/payment/verify',
  '/api/payment/stripe',
  '/api/payment/config',
  '/api/invoice',
  '/api/support-chat',
  '/api/refund',
  // Session-gated storage writes — Workers hop loses NextAuth request scope
  '/api/upload',
  '/api/push-subscription',
];

/** Full Option B cutover — auth + session-bound routes stay on Vercel. */
const KEEP_WHEN_PROXY_ALL = ALWAYS_ON_VERCEL_PREFIXES;

/**
 * Safe default (Option A): session + storefront stay on Vercel.
 * Avoids Workers hop for hot paths and tolerates older Workers deploys.
 */
const KEEP_SAFE_DEFAULT = [
  ...ALWAYS_ON_VERCEL_PREFIXES,
  '/api/shipping',
  '/api/stock-alert',
  '/api/privacy',
  '/api/gas',
  '/api/pickup',
  '/api/reviews',
  '/api/config',
  '/api/live',
  '/api/inventory',
  '/api/chatbot',
  '/api/image',
];

function isProxyAllEnabled(): boolean {
  return process.env.API_PROXY_ALL === '1' || process.env.API_PROXY_ALL === 'true';
}

export function shouldKeepApiOnVercel(pathname: string): boolean {
  if (!pathname.startsWith('/api/')) return false;

  if (!isProxyAllEnabled()) {
    if (pathname.startsWith('/api/payment/webhook')) return false;
    if (pathname.startsWith('/api/cron')) return false;
  }

  const prefixes = isProxyAllEnabled() ? KEEP_WHEN_PROXY_ALL : KEEP_SAFE_DEFAULT;
  return prefixes.some((prefix) => pathname.startsWith(prefix));
}

export function shouldProxyApiRoute(pathname: string, method = 'GET'): boolean {
  if (!shouldProxyToBackend()) return false;
  if (!pathname.startsWith('/api/')) return false;
  if (shouldKeepApiOnVercel(pathname)) return false;

  if (isProxyAllEnabled()) {
    return true;
  }

  // Option A: only proxy GET/HEAD (plus webhook/cron writes)
  const verb = method.toUpperCase();
  if (verb !== 'GET' && verb !== 'HEAD') {
    return (
      pathname.startsWith('/api/payment/webhook') ||
      pathname.startsWith('/api/cron')
    );
  }
  return true;
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
