/**
 * Re-issue session cookie with COOKIE_DOMAIN so api.psuscc.club can read JWT.
 * Vercel same-origin only — upgrades host-only cookies from before domain was configured.
 */
import { NextRequest, NextResponse } from 'next/server';
import { encode, getToken } from 'next-auth/jwt';
import {
  getNextAuthSessionCookieName,
  getSessionCookieNamesForRead,
} from '@/lib/nextauth-cookie-names';
import { buildGetTokenReq } from '@/lib/session-from-request';
import { getSharedCookieDomain } from '@/lib/cookie-domain';

const useSecureCookies = process.env.NODE_ENV === 'production';
const sessionCookieName = getNextAuthSessionCookieName();
const sharedCookieDomain = getSharedCookieDomain();

export async function POST(req: NextRequest) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    return NextResponse.json({ status: 'error', message: 'misconfigured' }, { status: 500 });
  }

  let token = null;
  const getTokenReq = buildGetTokenReq(req);
  for (const cookieName of getSessionCookieNamesForRead()) {
    token = await getToken({
      req: getTokenReq,
      secret,
      secureCookie: useSecureCookies,
      cookieName,
    });
    if (token) break;
  }

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

  // Do not clear host-only cookies here — can race with login and wipe the only valid session.
  return response;
}
