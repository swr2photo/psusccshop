/**
 * Read NextAuth JWT session from an incoming Request (Workers / Elysia bridge).
 */
import { getToken } from 'next-auth/jwt';
import type { Session } from 'next-auth';
import {
  getNextAuthSessionCookieName,
  getSessionCookieNamesForRead,
} from '@/lib/nextauth-cookie-names';

export function nextAuthTokenOptions(request: Request, cookieName?: string) {
  const useSecureCookies = process.env.NODE_ENV === 'production';
  return {
    req: request as Parameters<typeof getToken>[0]['req'],
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie: useSecureCookies,
    cookieName: cookieName || getNextAuthSessionCookieName(),
  };
}

async function readTokenFromRequest(request: Request) {
  if (!process.env.NEXTAUTH_SECRET) {
    console.error('[session] NEXTAUTH_SECRET is not configured');
    return null;
  }

  for (const cookieName of getSessionCookieNamesForRead()) {
    const token = await getToken(nextAuthTokenOptions(request, cookieName));
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

export async function getEmailFromRequest(request: Request): Promise<string | null> {
  const session = await getSessionFromRequest(request);
  return session?.user?.email ?? null;
}
