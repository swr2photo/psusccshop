'use client';

import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useRef } from 'react';
import { getSharedCookieDomain } from '@/lib/cookie-domain';
import { signOutUser } from '@/lib/sign-out-client';

/** Sync host-only cookie to COOKIE_DOMAIN when split deploy uses shared domain. */
function needsCrossSubdomainCookieSync(): boolean {
  return typeof window !== 'undefined' && Boolean(getSharedCookieDomain());
}

/** Upgrade host-only NextAuth cookie to COOKIE_DOMAIN after login (split API). */
export function AuthCookieSync() {
  const { status } = useSession();
  const syncing = useRef(false);

  const syncCookie = useCallback(async () => {
    if (!needsCrossSubdomainCookieSync() || !getSharedCookieDomain() || syncing.current) return;
    syncing.current = true;
    try {
      const res = await fetch('/api/auth/sync-cookie', {
        method: 'POST',
        credentials: 'include',
      });
      if (res.status === 401) {
        await signOutUser();
      }
    } catch {
      /* retry on next focus */
    } finally {
      syncing.current = false;
    }
  }, []);

  useEffect(() => {
    if (status !== 'authenticated') return;
    void syncCookie();
  }, [status, syncCookie]);

  useEffect(() => {
    if (status !== 'authenticated' || !needsCrossSubdomainCookieSync() || !getSharedCookieDomain()) return;
    const onFocus = () => void syncCookie();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [status, syncCookie]);

  return null;
}
