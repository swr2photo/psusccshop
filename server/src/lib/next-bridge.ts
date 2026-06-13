// Bridge standard Request → Next.js App Router route handlers.
// Reuses existing src/app/api route modules without duplication.

import { NextRequest } from 'next/server';
import { runWithRequest } from '@/lib/request-context';
import { withBrowserCors } from './apply-cors.js';
import { ROUTE_MODULES } from '../routes/route-modules.js';

type NextRouteHandler = (
  req: NextRequest,
  ctx: { params: Promise<Record<string, string>> },
) => Promise<Response> | Response;

type NextRouteModule = Partial<Record<'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS', NextRouteHandler>>;

const moduleCache = new Map<string, NextRouteModule>();

async function loadRouteModule(moduleId: string): Promise<NextRouteModule> {
  const cached = moduleCache.get(moduleId);
  if (cached) return cached;

  const staticMod = ROUTE_MODULES[moduleId];
  if (staticMod) {
    moduleCache.set(moduleId, staticMod);
    return staticMod;
  }

  const mod = (await import(moduleId)) as NextRouteModule;
  moduleCache.set(moduleId, mod);
  return mod;
}

export async function invokeNextRoute(
  moduleId: string,
  request: Request,
  params: Record<string, string> = {},
): Promise<Response> {
  const method = request.method.toUpperCase() as keyof NextRouteModule;

  let mod: NextRouteModule;
  try {
    mod = await loadRouteModule(moduleId);
  } catch (error) {
    console.error(`[next-bridge] failed to load ${moduleId}:`, error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return withBrowserCors(
      Response.json({ status: 'error', message }, { status: 500 }),
      request,
    );
  }

  const handler = mod[method];

  if (!handler) {
    return withBrowserCors(
      Response.json({ status: 'error', message: 'Method Not Allowed' }, { status: 405 }),
      request,
    );
  }

  // Clone incoming Request — avoids Next.js RequestInit signal type mismatch
  const nextReq = new NextRequest(request);
  const ctx = { params: Promise.resolve(params) };

  try {
    const response = await runWithRequest(request, () => handler(nextReq, ctx));
    return withBrowserCors(response instanceof Response ? response : Response.json(response), request);
  } catch (error) {
    console.error(`[next-bridge] ${moduleId} ${method} failed:`, error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return withBrowserCors(
      Response.json({ status: 'error', message }, { status: 500 }),
      request,
    );
  }
}
