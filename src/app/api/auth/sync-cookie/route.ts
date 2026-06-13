/**
 * Re-issue session cookie with COOKIE_DOMAIN so api.psuscc.club can read JWT.
 * Vercel same-origin only — upgrades host-only cookies from before domain was configured.
 */
import { NextRequest, NextResponse } from 'next/server';
import { encode, getToken } from 'next-auth/jwt';
import { getStaleHostOnlyAuthCookieClearHeaders } from '@/lib/auth-cookies';

const useSecureCookies = process.env.NODE_ENV === 'production';
const cookiePrefix = useSecureCookies ? '__Secure-' : '';
const sessionCookieName = `${cookiePrefix}next-auth.session-token`;
const sharedCookieDomain = process.env.COOKIE_DOMAIN?.trim() || undefined;

export async function POST(req: NextRequest) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    return NextResponse.json({ status: 'error', message: 'misconfigured' }, { status: 500 });
  }

  const token = await getToken({
    req,
    secret,
    secureCookie: useSecureCookies,
    cookieName: sessionCookieName,
  });

  if (!token) {
    return NextResponse.json({ status: 'error', message: 'no session' }, { status: 401 });
  }

  if (!sharedCookieDomain) {
    return NextResponse.json({ status: 'success', message: 'no domain sync needed' });
  }

  const sessionToken = await encode({ token, secret, maxAge: 30 * 24 * 60 * 60 });
  const response = NextResponse.json({ status: 'success' });

  response.cookies.set(sessionCookieName, sessionToken, {
    httpOnly: true,
    secure: useSecureCookies,
    sameSite: 'lax',
    path: '/',
    domain: sharedCookieDomain,
    maxAge: 30 * 24 * 60 * 60,
  });

  for (const header of getStaleHostOnlyAuthCookieClearHeaders()) {
    response.headers.append('Set-Cookie', header);
  }

  return response;
}
