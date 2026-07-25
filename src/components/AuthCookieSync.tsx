'use client';

import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useRef } from 'react';
import { shouldSyncAuthCookieInBrowser } from '@/lib/cookie-domain';

const SYNC_KEY = 'scc_auth_cookie_synced_v2';
const SYNC_AT_KEY = 'scc_auth_cookie_synced_at_v2';

/**
 * Keep NextAuth session cookie on shared Domain (.psuscc.club) with full maxAge.
 * Runs once per browser tab session after login — avoids re-clear/re-set storms
 * that can look like a "cookie reset" bug.
 *
 * Set NEXT_PUBLIC_AUTH_COOKIE_SYNC=0 to disable.
 */
export function AuthCookieSync() {
  const { status } = useSession();
  const syncing = useRef(false);

  const syncCookie = useCallback(async () => {
    if (!shouldSyncAuthCookieInBrowser() || syncing.current) return;
    try {
      if (sessionStorage.getItem(SYNC_KEY) === '1') return;
    } catch {
      /* private mode */
    }

    syncing.current = true;
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        if (attempt > 0) {
          await new Promise((r) => setTimeout(r, 400));
        }
        const res = await fetch('/api/auth/sync-cookie', {
          method: 'POST',
          credentials: 'include',
          cache: 'no-store',
        });
        if (res.ok) {
          try {
            sessionStorage.setItem(SYNC_KEY, '1');
            sessionStorage.setItem(SYNC_AT_KEY, String(Date.now()));
          } catch {
            /* ignore */
          }
          return;
        }
        // 401 = no readable session yet; retry once then stop (don't loop)
        if (res.status !== 401) return;
      }
    } catch {
      /* retry on next full page load */
    } finally {
      syncing.current = false;
    }
  }, []);

  useEffect(() => {
    if (status === 'unauthenticated') {
      try {
        sessionStorage.removeItem(SYNC_KEY);
        sessionStorage.removeItem(SYNC_AT_KEY);
      } catch {
        /* ignore */
      }
      return;
    }
    if (status !== 'authenticated') return;
    const timer = setTimeout(() => void syncCookie(), 400);
    return () => clearTimeout(timer);
  }, [status, syncCookie]);

  return null;
}
