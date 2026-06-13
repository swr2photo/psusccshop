/**
 * Clear NextAuth cookies that may survive signOut when COOKIE_DOMAIN is set.
 */
import {
  getAllCallbackCookieNames,
  getAllSessionCookieNames,
  getNextAuthCsrfCookieName,
} from '@/lib/nextauth-cookie-names';

import { getSharedCookieDomain } from '@/lib/cookie-domain';

const useSecureCookies = process.env.NODE_ENV === 'production';
const sharedCookieDomain = getSharedCookieDomain();

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
  const names: Array<{ name: string; httpOnly: boolean }> = [
    ...getAllSessionCookieNames().map((name) => ({ name, httpOnly: true })),
    ...getAllCallbackCookieNames().map((name) => ({ name, httpOnly: false })),
    { name: getNextAuthCsrfCookieName(), httpOnly: true },
  ];
  return names;
}

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
  const headers = new Headers(response.headers);
  const clears = mode === 'full' ? getFullAuthCookieClearHeaders() : getStaleHostOnlyAuthCookieClearHeaders();
  for (const cookie of clears) {
    headers.append('Set-Cookie', cookie);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
