// Bridge standard Request → Next.js App Router route handlers.
// Reuses existing src/app/api route modules without duplication.

import { NextRequest } from 'next/server';

type NextRouteHandler = (
  req: NextRequest,
  ctx: { params: Promise<Record<string, string>> },
) => Promise<Response> | Response;

type NextRouteModule = Partial<Record<'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS', NextRouteHandler>>;

const moduleCache = new Map<string, NextRouteModule>();

async function loadRouteModule(moduleId: string): Promise<NextRouteModule> {
  const cached = moduleCache.get(moduleId);
  if (cached) return cached;
  const mod = (await import(moduleId)) as NextRouteModule;
  moduleCache.set(moduleId, mod);
  return mod;
}

export async function invokeNextRoute(
  moduleId: string,
  request: Request,
  params: Record<string, string> = {},
): Promise<Response> {
  const mod = await loadRouteModule(moduleId);
  const method = request.method.toUpperCase() as keyof NextRouteModule;
  const handler = mod[method];

  if (!handler) {
    return Response.json({ status: 'error', message: 'Method Not Allowed' }, { status: 405 });
  }

  // Clone incoming Request — avoids Next.js RequestInit signal type mismatch
  const nextReq = new NextRequest(request);
  const ctx = { params: Promise.resolve(params) };

  try {
    return await handler(nextReq, ctx);
  } catch (error) {
    console.error(`[next-bridge] ${moduleId} ${method} failed:`, error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return Response.json({ status: 'error', message }, { status: 500 });
  }
}
