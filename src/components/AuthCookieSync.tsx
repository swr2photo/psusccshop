'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useRef } from 'react';
import { getPublicApiBaseUrl } from '@/lib/api-client';
import { signOutUser } from '@/lib/sign-out-client';

/** Upgrade host-only NextAuth cookie to COOKIE_DOMAIN after login (split API). */
export function AuthCookieSync() {
  const { status } = useSession();
  const synced = useRef(false);

  useEffect(() => {
    if (status !== 'authenticated') {
      synced.current = false;
      return;
    }
    if (!getPublicApiBaseUrl() || synced.current) return;

    synced.current = true;
    fetch('/api/auth/sync-cookie', { method: 'POST', credentials: 'include' })
      .then(async (res) => {
        if (res.status === 401) {
          synced.current = false;
          await signOutUser();
        }
      })
      .catch(() => {
        synced.current = false;
      });
  }, [status]);

  return null;
}
