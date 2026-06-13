'use client';

import { signOut } from 'next-auth/react';

let isSigningOut = false;

/** Sign out and redirect home — clears stale client caches where possible. */
export async function signOutUser(): Promise<void> {
  if (isSigningOut) return;
  isSigningOut = true;
  try {
    sessionStorage.removeItem('shopConfigCache');
    sessionStorage.removeItem('announcementDismissed');
  } catch {
    /* ignore */
  }

  try {
    await signOut({
      callbackUrl: typeof window !== 'undefined' ? `${window.location.origin}/` : '/',
    });
  } finally {
    isSigningOut = false;
  }
}
