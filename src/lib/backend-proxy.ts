/**
 * Proxy Next.js API routes to the Elysia backend during migration.
 * Set API_INTERNAL_URL (server-only) e.g. http://localhost:3001
 */

import { NextRequest, NextResponse } from 'next/server';

export function shouldProxyToBackend(): boolean {
  return Boolean(process.env.API_INTERNAL_URL?.trim());
}

export async function proxyToBackend(request: NextRequest): Promise<NextResponse> {
  const base = process.env.API_INTERNAL_URL?.replace(/\/$/, '');
  if (!base) {
    return NextResponse.json(
      { status: 'error', message: 'API backend not configured' },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const target = `${base}${url.pathname}${url.search}`;

  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('connection');

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const body = hasBody ? await request.arrayBuffer() : undefined;

  const res = await fetch(target, {
    method: request.method,
    headers,
    body,
  });

  const responseHeaders = new Headers(res.headers);
  responseHeaders.delete('transfer-encoding');

  return new NextResponse(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: responseHeaders,
  });
}

type RouteHandler = (req: NextRequest, ...args: unknown[]) => Promise<NextResponse> | NextResponse;

/** Wrap a route handler — forwards to Elysia when API_INTERNAL_URL is set. */
export function withBackendProxy(handler: RouteHandler): RouteHandler {
  return async (req: NextRequest, ...args: unknown[]) => {
    if (shouldProxyToBackend()) return proxyToBackend(req);
    return handler(req, ...args);
  };
}
