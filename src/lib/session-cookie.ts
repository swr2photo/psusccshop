/* eslint-disable react-hooks/rules-of-hooks */
/**
 * Shared NextAuth session cookie policy for Vercel + Workers JWT reads.
 */

import { getSharedCookieDomain } from '@/lib/cookie-domain';

/** 30 days — keep in sync with authOptions.session.maxAge and sync-cookie. */
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export function useSecureAuthCookies(): boolean {
  return process.env.NODE_ENV === 'production';
}

/** Canonical Set-Cookie options for the JWT session token. */
export function getSessionTokenCookieOptions(overrides?: {
  domain?: string | undefined;
  httpOnly?: boolean;
}): {
  httpOnly: boolean;
  sameSite: 'lax';
  path: string;
  secure: boolean;
  maxAge: number;
  domain?: string;
} {
  const domain = overrides?.domain !== undefined ? overrides.domain : getSharedCookieDomain();
  return {
    httpOnly: overrides?.httpOnly !== false,
    sameSite: 'lax',
    path: '/',
    secure: useSecureAuthCookies(),
    maxAge: SESSION_MAX_AGE_SECONDS,
    ...(domain ? { domain } : {}),
  };
}

export function getCallbackUrlCookieOptions() {
  return getSessionTokenCookieOptions({ httpOnly: false });
}

/** CSRF stays host-only (__Host- in production) — Domain attribute forbidden. */
export function getCsrfCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    secure: useSecureAuthCookies(),
  };
}
