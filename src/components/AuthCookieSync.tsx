'use client';

import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useRef } from 'react';

/**
 * Legacy: upgrade host-only NextAuth cookie to COOKIE_DOMAIN.
 * Disabled by default — login already sets domain cookie when COOKIE_DOMAIN is on Vercel.
 * Enable only for one-time migration: NEXT_PUBLIC_AUTH_COOKIE_SYNC=1
 */
function needsCrossSubdomainCookieSync(): boolean {
  if (process.env.NEXT_PUBLIC_AUTH_COOKIE_SYNC !== '1') return false;
  return typeof window !== 'undefined';
}

export function AuthCookieSync() {
  const { status } = useSession();
  const syncing = useRef(false);

  const syncCookie = useCallback(async () => {
    if (!needsCrossSubdomainCookieSync() || syncing.current) return;
    syncing.current = true;
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) {
          await new Promise((r) => setTimeout(r, 400 * attempt));
        }
        const res = await fetch('/api/auth/sync-cookie', {
          method: 'POST',
          credentials: 'include',
        });
        if (res.ok) return;
        if (res.status !== 401) return;
      }
    } catch {
      /* retry on next focus */
    } finally {
      syncing.current = false;
    }
  }, []);

  useEffect(() => {
    if (status !== 'authenticated') return;
    const timer = setTimeout(() => void syncCookie(), 500);
    return () => clearTimeout(timer);
  }, [status, syncCookie]);

  useEffect(() => {
    if (status !== 'authenticated' || !needsCrossSubdomainCookieSync()) return;
    const onFocus = () => void syncCookie();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [status, syncCookie]);

  return null;
}
