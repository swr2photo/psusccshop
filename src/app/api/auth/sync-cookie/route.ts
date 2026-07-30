/**
 * Re-issue session cookie with shared Domain + maxAge, and drop stale host-only
 * duplicates so browsers don't send the wrong JWT to /api/*.
 *
 * IMPORTANT: must chunk large JWTs (NextAuth does). A single oversized Set-Cookie
 * is silently dropped by browsers — especially after we clear the old host-only token.
 */
import { NextRequest, NextResponse } from 'next/server';
import { encode, getToken } from 'next-auth/jwt';
import type { JWT } from 'next-auth/jwt';
import {
  getNextAuthSessionCookieName,
  getSessionCookieNamesForRead,
} from '@/lib/nextauth-cookie-names';
import { buildGetTokenReq } from '@/lib/session-from-request';
import { getSharedCookieDomain } from '@/lib/cookie-domain';
import { SESSION_MAX_AGE_SECONDS, getSessionTokenCookieOptions } from '@/lib/session-cookie';
import { secureJsonRequest, secureJsonResponse } from '@/lib/payload-crypto';
import {
  chunkSessionCookieValue,
  sessionCookieNamesToClear,
} from '@/lib/session-cookie-chunks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const useSecureCookies = process.env.NODE_ENV === 'production';
const sessionCookieName = getNextAuthSessionCookieName();
const sharedCookieDomain = getSharedCookieDomain();

/** Keep cookie small — OAuth access/refresh tokens are not needed for API auth. */
function slimTokenForCookie(token: JWT): JWT {
  const user = token.user as { id?: string; name?: string | null; email?: string | null; image?: string | null } | undefined;
  return {
    sub: token.sub,
    name: token.name ?? user?.name ?? null,
    email: token.email ?? user?.email ?? null,
    picture: token.picture ?? user?.image ?? null,
    user: user ?? {
      id: token.sub,
      name: (token.name as string | null | undefined) ?? null,
      email: (token.email as string | null | undefined) ?? null,
      image: (token.picture as string | null | undefined) ?? null,
    },
    provider: token.provider,
    // Preserve NextAuth expiry fields when present
    iat: token.iat,
    exp: token.exp,
    jti: token.jti,
  } as JWT;
}

function buildClearCookie(name: string, domain?: string): string {
  const parts = [
    `${name}=`,
    'Path=/',
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    'SameSite=Lax',
  ];
  if (useSecureCookies) parts.push('Secure');
  parts.push('HttpOnly');
  if (domain) parts.push(`Domain=${domain}`);
  return parts.join('; ');
}

export async function POST(req: NextRequest) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    return await secureJsonResponse({ status: 'error', message: 'misconfigured' }, { status: 500 });
  }

  let token: JWT | null = null;
  const getTokenReq = buildGetTokenReq(req);
  for (const cookieName of getSessionCookieNamesForRead()) {
    try {
      token = await getToken({
        req: getTokenReq,
        secret,
        secureCookie: useSecureCookies,
        cookieName,
      });
    } catch {
      token = null;
    }
    if (token) break;
  }

  if (!token) {
    return await secureJsonResponse({ status: 'error', message: 'no session' }, { status: 401 });
  }

  const email =
    (typeof token.email === 'string' && token.email) ||
    (token.user as { email?: string } | undefined)?.email;
  if (!email) {
    return await secureJsonResponse({ status: 'error', message: 'no email in session' }, { status: 401 });
  }

  const sessionToken = await encode({
    token: slimTokenForCookie(token),
    secret,
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  const chunks = chunkSessionCookieValue(sessionCookieName, sessionToken);
  const opts = getSessionTokenCookieOptions();

  const response = await secureJsonResponse({
    status: 'success',
    domain: sharedCookieDomain || null,
    maxAge: SESSION_MAX_AGE_SECONDS,
    chunks: chunks.length,
  });

  // Expire previous session token variants (host-only + Domain, including old chunks)
  // BEFORE setting the new ones so leftover .1/.2 chunks cannot reassemble a stale JWT.
  const namesToClear = new Set<string>();
  for (const base of getSessionCookieNamesForRead()) {
    for (const n of sessionCookieNamesToClear(base)) namesToClear.add(n);
  }
  for (const name of namesToClear) {
    response.headers.append('Set-Cookie', buildClearCookie(name));
    if (sharedCookieDomain) {
      response.headers.append('Set-Cookie', buildClearCookie(name, sharedCookieDomain));
    }
  }

  for (const chunk of chunks) {
    response.cookies.set(chunk.name, chunk.value, opts);
  }

  return response;
}
