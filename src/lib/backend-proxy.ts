/**
 * Proxy Next.js API routes to the Elysia backend during migration.
 * Set API_INTERNAL_URL (server-only) e.g. http://localhost:3001
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
 * Session-bound routes stay on Vercel (NextAuth getServerSession).
 * Workers only validate JWT when NEXTAUTH_SECRET is synced — avoid 401 on profile/cart/orders.
 */
export function shouldKeepApiOnVercel(pathname: string): boolean {
  if (!pathname.startsWith('/api/')) return false;
  if (pathname.startsWith('/api/auth')) return true;

  if (pathname.startsWith('/api/support-chat/settings/public')) return false;
  if (pathname.startsWith('/api/payment/webhook')) return false;
  if (pathname.startsWith('/api/cron')) return false;

  const sessionPrefixes = [
    '/api/profile',
    '/api/cart',
    '/api/orders',
    '/api/admin',
    '/api/upload',
    '/api/push-subscription',
    '/api/support-chat',
    '/api/shipping/track',
    '/api/stock-alert',
    '/api/refund',
    '/api/privacy',
    '/api/invoice',
    '/api/gas',
    '/api/pickup',
    '/api/payment-info',
    '/api/payment/create-charge',
    '/api/payment/verify',
    '/api/payment/stripe',
    '/api/payment/config',
    '/api/shops',
    '/api/reviews',
  ];

  return sessionPrefixes.some((prefix) => pathname.startsWith(prefix));
}

/** Stateless writes that are safe to run on Workers (no NextAuth session). */
const PROXY_WRITE_PREFIXES = [
  '/api/payment/webhook',
  '/api/cron',
];

export function shouldProxyApiRoute(pathname: string, method = 'GET'): boolean {
  if (!shouldProxyToBackend()) return false;
  if (!pathname.startsWith('/api/')) return false;
  if (pathname.startsWith('/api/auth')) return false;
  if (shouldKeepApiOnVercel(pathname)) return false;

  const verb = method.toUpperCase();
  if (verb !== 'GET' && verb !== 'HEAD') {
    return PROXY_WRITE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
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
