// src/app/api/auth/[...nextauth]/route.ts
import NextAuth from 'next-auth';
import type { NextRequest } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { appendAuthCookieClearHeaders } from '@/lib/auth-cookies';

const handler = NextAuth(authOptions);

type RouteContext = { params: Promise<{ nextauth?: string[] }> };

function shouldClearStaleHostOnlyCookies(pathname: string): boolean {
  return pathname.startsWith('/api/auth/callback/') || pathname.startsWith('/api/auth/signin/');
}

function shouldFullyClearAuthCookies(pathname: string): boolean {
  return pathname === '/api/auth/signout';
}

async function wrappedHandler(req: NextRequest, context: RouteContext) {
  const response = await handler(req, context);
  const pathname = req.nextUrl.pathname;

  if (shouldFullyClearAuthCookies(pathname)) {
    return appendAuthCookieClearHeaders(response, 'full');
  }
  if (shouldClearStaleHostOnlyCookies(pathname)) {
    return appendAuthCookieClearHeaders(response, 'stale-host-only');
  }
  return response;
}

export { wrappedHandler as GET, wrappedHandler as POST };
