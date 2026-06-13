/**
 * Read NextAuth JWT session from an incoming Request (Workers / Elysia / App Router).
 */
import { getToken } from 'next-auth/jwt';
import type { Session } from 'next-auth';
import {
  getNextAuthSessionCookieName,
  getSessionCookieNamesForRead,
} from '@/lib/nextauth-cookie-names';

type GetTokenReq = NonNullable<Parameters<typeof getToken>[0]>['req'];

/** Build req shape that next-auth getToken() reads reliably (NextRequest jar + Cookie header). */
export function buildGetTokenReq(request: Request): GetTokenReq {
  let cookieHeader = request.headers.get('cookie') ?? '';

  const withCookies = request as Request & {
    cookies?: { getAll?: () => Array<{ name: string; value: string }> };
  };
  if (!cookieHeader && typeof withCookies.cookies?.getAll === 'function') {
    const all = withCookies.cookies.getAll();
    if (all.length > 0) {
      cookieHeader = all.map((c) => `${c.name}=${c.value}`).join('; ');
    }
  }

  const cookies: Record<string, string> = {};
  if (cookieHeader) {
    for (const part of cookieHeader.split(';')) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      cookies[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
    }
  }

  return {
    headers: cookieHeader ? { cookie: cookieHeader } : {},
    cookies,
  } as GetTokenReq;
}

function tokenOptions(cookieName?: string) {
  return {
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie: process.env.NODE_ENV === 'production',
    cookieName: cookieName || getNextAuthSessionCookieName(),
  };
}

async function readTokenFromRequest(request: Request) {
  if (!process.env.NEXTAUTH_SECRET) {
    console.error('[session] NEXTAUTH_SECRET is not configured');
    return null;
  }

  const getTokenReq = buildGetTokenReq(request);

  for (const cookieName of getSessionCookieNamesForRead()) {
    const token = await getToken({
      req: getTokenReq,
      ...tokenOptions(cookieName),
    });
    if (token) return token;
  }
  return null;
}

export async function getSessionFromRequest(request: Request): Promise<Session | null> {
  const token = await readTokenFromRequest(request);
  if (!token) return null;

  const userFromToken = token.user as Session['user'] | undefined;
  const expSeconds = typeof token.exp === 'number' ? token.exp : undefined;
  return {
    user: userFromToken ?? {
      id: token.sub,
      name: (token.name as string | null | undefined) ?? null,
      email: (token.email as string | null | undefined) ?? null,
      image: (token.picture as string | null | undefined) ?? null,
    },
    expires: expSeconds
      ? new Date(expSeconds * 1000).toISOString()
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    accessToken: token.accessToken as string | undefined,
    error: token.error as string | undefined,
  };
}

/** App Router route handlers — read session from next/headers cookies(). */
export async function getSessionFromAppRouter(): Promise<Session | null> {
  try {
    const { cookies: nextCookies } = await import('next/headers');
    const store = await nextCookies();
    const all = store.getAll();
    if (all.length === 0) return null;
    const cookieHeader = all.map((c) => `${c.name}=${c.value}`).join('; ');
    return getSessionFromRequest(
      new Request('https://session.local/', { headers: { cookie: cookieHeader } }),
    );
  } catch {
    return null;
  }
}

export async function getEmailFromRequest(request: Request): Promise<string | null> {
  const session = await getSessionFromRequest(request);
  return session?.user?.email ?? null;
}
