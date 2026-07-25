'use client';

import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useRef } from 'react';
import { shouldSyncAuthCookieInBrowser } from '@/lib/cookie-domain';

const SYNC_KEY = 'scc_auth_cookie_synced_v2';

/**
 * Keep NextAuth session cookie on shared Domain (.psuscc.club) with full maxAge.
 * Auto-runs on shop hosts; set NEXT_PUBLIC_AUTH_COOKIE_SYNC=0 to disable.
 */
export function AuthCookieSync() {
  const { status } = useSession();
  const syncing = useRef(false);

  const syncCookie = useCallback(async (force = false) => {
    if (!shouldSyncAuthCookieInBrowser() || syncing.current) return;
    if (!force) {
      try {
        if (sessionStorage.getItem(SYNC_KEY) === '1') return;
      } catch {
        /* private mode */
      }
    }

    syncing.current = true;
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) {
          await new Promise((r) => setTimeout(r, 350 * attempt));
        }
        const res = await fetch('/api/auth/sync-cookie', {
          method: 'POST',
          credentials: 'include',
          cache: 'no-store',
        });
        if (res.ok) {
          try {
            sessionStorage.setItem(SYNC_KEY, '1');
          } catch {
            /* ignore */
          }
          return;
        }
        if (res.status !== 401) return;
      }
    } catch {
      /* retry later */
    } finally {
      syncing.current = false;
    }
  }, []);

  useEffect(() => {
    if (status !== 'authenticated') {
      try {
        sessionStorage.removeItem(SYNC_KEY);
      } catch {
        /* ignore */
      }
      return;
    }
    const timer = setTimeout(() => void syncCookie(false), 300);
    return () => clearTimeout(timer);
  }, [status, syncCookie]);

  useEffect(() => {
    if (status !== 'authenticated' || !shouldSyncAuthCookieInBrowser()) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') void syncCookie(true);
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [status, syncCookie]);

  return null;
}
