/* eslint-disable react-hooks/rules-of-hooks */
/**
 * Clear NextAuth cookies that may survive signOut when COOKIE_DOMAIN is set.
 */
import {
  getAllCallbackCookieNames,
  getAllSessionCookieNames,
  getNextAuthCsrfCookieName,
} from '@/lib/nextauth-cookie-names';

import { getSharedCookieDomain } from '@/lib/cookie-domain';
import { useSecureAuthCookies } from '@/lib/session-cookie';

const useSecureCookies = useSecureAuthCookies();
const sharedCookieDomain = getSharedCookieDomain();

/** NextAuth splits large JWTs into name.0, name.1, ... — must clear those too. */
function withChunkedNames(names: string[], maxChunks = 5): string[] {
  const out = new Set<string>();
  for (const name of names) {
    out.add(name);
    for (let i = 0; i < maxChunks; i++) {
      out.add(`${name}.${i}`);
    }
  }
  return [...out];
}

function buildClearCookie(name: string, options: { httpOnly?: boolean; domain?: string } = {}): string {
  const parts = [
    `${name}=`,
    'Path=/',
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    'SameSite=Lax',
  ];
  if (useSecureCookies) parts.push('Secure');
  if (options.httpOnly !== false) parts.push('HttpOnly');
  if (options.domain) parts.push(`Domain=${options.domain}`);
  return parts.join('; ');
}

function authCookieNames(): Array<{ name: string; httpOnly: boolean }> {
  const sessionNames = withChunkedNames(getAllSessionCookieNames());
  const callbackNames = getAllCallbackCookieNames();
  return [
    ...sessionNames.map((name) => ({ name, httpOnly: true })),
    ...callbackNames.map((name) => ({ name, httpOnly: false })),
    { name: getNextAuthCsrfCookieName(), httpOnly: true },
  ];
}

/** Host-only clears only (no Domain=) — safe to run alongside a new Domain cookie. */
export function getStaleHostOnlyAuthCookieClearHeaders(): string[] {
  const headers: string[] = [];
  for (const { name, httpOnly } of authCookieNames()) {
    if (name.startsWith('__Host-')) continue;
    headers.push(buildClearCookie(name, { httpOnly }));
  }
  return headers;
}

export function getFullAuthCookieClearHeaders(): string[] {
  const headers = getStaleHostOnlyAuthCookieClearHeaders();
  if (!sharedCookieDomain) return headers;

  for (const { name, httpOnly } of authCookieNames()) {
    if (name.startsWith('__Host-')) continue;
    headers.push(buildClearCookie(name, { httpOnly, domain: sharedCookieDomain }));
  }
  return headers;
}

export function appendAuthCookieClearHeaders(response: Response, mode: 'full' | 'stale-host-only' = 'full'): Response {
  const clears = mode === 'full' ? getFullAuthCookieClearHeaders() : getStaleHostOnlyAuthCookieClearHeaders();
  const headers = new Headers();

  // stale-host-only: emit clears BEFORE NextAuth Set-Cookie so the new session token wins
  if (mode === 'stale-host-only') {
    for (const cookie of clears) {
      headers.append('Set-Cookie', cookie);
    }
  }

  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') {
      headers.append(key, value);
    } else {
      headers.set(key, value);
    }
  });

  // full sign-out: clears last so nothing survives NextAuth's own Set-Cookie
  if (mode === 'full') {
    for (const cookie of clears) {
      headers.append('Set-Cookie', cookie);
    }
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
