/**
 * Clear NextAuth cookies that may survive signOut when COOKIE_DOMAIN is set.
 * Browsers can hold both host-only and Domain=.psuscc.club cookies with the same name;
 * NextAuth only clears the configured variant.
 */

const useSecureCookies = process.env.NODE_ENV === 'production';
const cookiePrefix = useSecureCookies ? '__Secure-' : '';
const sharedCookieDomain = process.env.COOKIE_DOMAIN?.trim() || undefined;

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

/** Cookie names that may exist after login / failed logout. */
function authCookieNames(): Array<{ name: string; httpOnly: boolean }> {
  const names: Array<{ name: string; httpOnly: boolean }> = [
    { name: `${cookiePrefix}next-auth.session-token`, httpOnly: true },
    { name: `${cookiePrefix}next-auth.callback-url`, httpOnly: false },
    { name: useSecureCookies ? '__Host-next-auth.csrf-token' : 'next-auth.csrf-token', httpOnly: true },
  ];

  if (useSecureCookies) {
    names.push(
      { name: 'next-auth.session-token', httpOnly: true },
      { name: 'next-auth.callback-url', httpOnly: false },
    );
  }

  return names;
}

/** Host-only clears — safe after OAuth callback (won't remove Domain= cookie). */
export function getStaleHostOnlyAuthCookieClearHeaders(): string[] {
  const headers: string[] = [];
  for (const { name, httpOnly } of authCookieNames()) {
    if (name.startsWith('__Host-')) continue;
    headers.push(buildClearCookie(name, { httpOnly }));
  }
  return headers;
}

/** Clear every auth cookie variant (host-only + shared domain + legacy names). */
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
