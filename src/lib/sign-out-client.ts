'use client';

import { signOut } from 'next-auth/react';

/** Sign out and redirect home — clears stale client caches where possible. */
export async function signOutUser(): Promise<void> {
  try {
    sessionStorage.removeItem('shopConfigCache');
    sessionStorage.removeItem('announcementDismissed');
  } catch {
    /* ignore */
  }

  await signOut({
    callbackUrl: typeof window !== 'undefined' ? `${window.location.origin}/` : '/',
  });
}
