/** Shared NextAuth session cookie naming (frontend + Workers API). */
const useSecureCookies = process.env.NODE_ENV === 'production';
const cookiePrefix = useSecureCookies ? '__Secure-' : '';

/** Bump to force global re-login (cookie name change). Production default: 2. */
export const AUTH_SESSION_VERSION = (
  process.env.AUTH_SESSION_VERSION ||
  (useSecureCookies ? '2' : '1')
).trim();

function versionSuffix(version: string): string {
  return version && version !== '1' ? `.v${version}` : '';
}

export function getNextAuthSessionCookieName(version = AUTH_SESSION_VERSION): string {
  return `${cookiePrefix}next-auth.session-token${versionSuffix(version)}`;
}

export function getNextAuthCallbackCookieName(version = AUTH_SESSION_VERSION): string {
  return `${cookiePrefix}next-auth.callback-url${versionSuffix(version)}`;
}

/** All session cookie names to clear on signOut (current + legacy). */
export function getAllSessionCookieNames(): string[] {
  const names = new Set<string>([
    getNextAuthSessionCookieName('2'),
    getNextAuthSessionCookieName('1'),
    `${cookiePrefix}next-auth.session-token`,
    'next-auth.session-token',
  ]);
  return [...names];
}

export function getAllCallbackCookieNames(): string[] {
  const names = new Set<string>([
    getNextAuthCallbackCookieName('2'),
    getNextAuthCallbackCookieName('1'),
    `${cookiePrefix}next-auth.callback-url`,
    'next-auth.callback-url',
  ]);
  return [...names];
}

/** Cookie names to try when reading an existing session (newest first). */
export function getSessionCookieNamesForRead(): string[] {
  return [
    getNextAuthSessionCookieName('2'),
    getNextAuthSessionCookieName('1'),
    `${cookiePrefix}next-auth.session-token`,
    'next-auth.session-token',
  ];
}

export function getNextAuthCsrfCookieName(): string {
  return useSecureCookies ? '__Host-next-auth.csrf-token' : 'next-auth.csrf-token';
}
