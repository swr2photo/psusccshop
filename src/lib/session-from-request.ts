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
  const merged = new Map<string, string>();

  const cookieHeader = request.headers.get('cookie') ?? '';
  if (cookieHeader) {
    for (const part of cookieHeader.split(';')) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      merged.set(trimmed.slice(0, eq), trimmed.slice(eq + 1));
    }
  }

  // Always merge NextRequest cookie jar — chunked session tokens may only appear here
  const withCookies = request as Request & {
    cookies?: { getAll?: () => Array<{ name: string; value: string }> };
  };
  if (typeof withCookies.cookies?.getAll === 'function') {
    for (const { name, value } of withCookies.cookies.getAll()) {
      merged.set(name, value);
    }
  }

  const cookies: Record<string, string> = Object.fromEntries(merged);
  const rebuiltHeader = [...merged.entries()]
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');

  return {
    headers: rebuiltHeader ? { cookie: rebuiltHeader } : {},
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
  // NextRequest itself is accepted by getToken; try it first for chunk assembly
  const reqCandidates: GetTokenReq[] = [getTokenReq];
  const maybeNext = request as Request & { cookies?: { getAll?: () => unknown } };
  if (typeof maybeNext.cookies?.getAll === 'function') {
    reqCandidates.unshift(request as unknown as GetTokenReq);
  }

  for (const req of reqCandidates) {
    for (const cookieName of getSessionCookieNamesForRead()) {
      const token = await getToken({
        req,
        ...tokenOptions(cookieName),
      });
      if (token) return token;
    }
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
