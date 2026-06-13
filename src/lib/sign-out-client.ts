'use client';

import { signOut } from 'next-auth/react';

let isSigningOut = false;

/** True when NextAuth session cookie is still valid (same-origin /api/auth/session). */
export async function hasActiveNextAuthSession(): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/session', { credentials: 'include', cache: 'no-store' });
    if (!res.ok) return false;
    const data = (await res.json()) as { user?: { email?: string | null } | null };
    return Boolean(data?.user?.email);
  } catch {
    return false;
  }
}

async function hasActiveNextAuthSessionWithRetry(
  attempts = 3,
  delayMs = 400,
): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    if (await hasActiveNextAuthSession()) return true;
    if (i < attempts - 1) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return false;
}

/**
 * Sign out only when NextAuth confirms the session is gone (after retries).
 * Avoids logout loops when a proxied Workers route returns 401 but Vercel auth is fine.
 */
export async function signOutIfSessionExpired(): Promise<void> {
  if (await hasActiveNextAuthSessionWithRetry()) return;
  await signOutUser();
}

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
