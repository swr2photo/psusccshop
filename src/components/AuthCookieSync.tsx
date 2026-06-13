'use client';

import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useRef } from 'react';
import { getPublicApiBaseUrl } from '@/lib/api-client';
import { signOutUser } from '@/lib/sign-out-client';

/** Upgrade host-only NextAuth cookie to COOKIE_DOMAIN after login (split API). */
export function AuthCookieSync() {
  const { status } = useSession();
  const syncing = useRef(false);

  const syncCookie = useCallback(async () => {
    if (!getPublicApiBaseUrl() || syncing.current) return;
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
    if (status !== 'authenticated' || !getPublicApiBaseUrl()) return;
    const onFocus = () => void syncCookie();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [status, syncCookie]);

  return null;
}
