/**
 * Re-issue session cookie with shared Domain + maxAge, and drop stale host-only
 * duplicates so browsers don't send the wrong JWT to /api/*.
 */
import { NextRequest, NextResponse } from 'next/server';
import { encode, getToken } from 'next-auth/jwt';
import {
  getNextAuthSessionCookieName,
  getSessionCookieNamesForRead,
} from '@/lib/nextauth-cookie-names';
import { buildGetTokenReq } from '@/lib/session-from-request';
import { getSharedCookieDomain } from '@/lib/cookie-domain';
import { SESSION_MAX_AGE_SECONDS, getSessionTokenCookieOptions } from '@/lib/session-cookie';
import { getStaleHostOnlyAuthCookieClearHeaders } from '@/lib/auth-cookies';

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

  const sessionToken = await encode({
    token,
    secret,
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  const response = NextResponse.json({
    status: 'success',
    domain: sharedCookieDomain || null,
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  const opts = getSessionTokenCookieOptions();
  response.cookies.set(sessionCookieName, sessionToken, opts);

  // After a successful domain (or host) re-issue, clear stale host-only duplicates
  // so the jar doesn't keep an older host-only JWT that some browsers prefer.
  if (sharedCookieDomain) {
    for (const clear of getStaleHostOnlyAuthCookieClearHeaders()) {
      // Only clear session-token variants (keep callback/csrf host behavior intact)
      if (!clear.includes('session-token')) continue;
      response.headers.append('Set-Cookie', clear);
    }
  }

  return response;
}
