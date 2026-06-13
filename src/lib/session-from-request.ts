/**
 * Read NextAuth JWT session from an incoming Request (Workers / Elysia bridge).
 */
import { getToken } from 'next-auth/jwt';
import type { Session } from 'next-auth';

export function nextAuthTokenOptions(request: Request) {
  const useSecureCookies = process.env.NODE_ENV === 'production';
  const cookiePrefix = useSecureCookies ? '__Secure-' : '';
  return {
    req: request as Parameters<typeof getToken>[0]['req'],
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie: useSecureCookies,
    cookieName: `${cookiePrefix}next-auth.session-token`,
  };
}

export async function getSessionFromRequest(request: Request): Promise<Session | null> {
  const token = await getToken(nextAuthTokenOptions(request));
  if (!token) return null;

  const userFromToken = token.user as Session['user'] | undefined;
  return {
    user: userFromToken ?? {
      id: token.sub,
      name: (token.name as string | null | undefined) ?? null,
      email: (token.email as string | null | undefined) ?? null,
      image: (token.picture as string | null | undefined) ?? null,
    },
    expires: token.exp
      ? new Date(token.exp * 1000).toISOString()
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    accessToken: token.accessToken as string | undefined,
    error: token.error as string | undefined,
  };
}

export async function getEmailFromRequest(request: Request): Promise<string | null> {
  const session = await getSessionFromRequest(request);
  return session?.user?.email ?? null;
}
