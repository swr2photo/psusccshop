// src/lib/profile-utils.ts
// Helper to get profile display name (Thai name) for a user

import crypto from 'crypto';
import { getJson } from '@/lib/filebase';

const emailHash = (email: string) =>
  crypto.createHash('sha256').update(email.toLowerCase()).digest('hex');

/**
 * Get the profile display name for a user.
 * Returns the profile `name` field (Thai name set by user) if available,
 * otherwise returns null so caller can fall back to OAuth name.
 */
export async function getProfileName(email: string): Promise<string | null> {
  try {
    const key = `users/${emailHash(email)}.json`;
    const profile = await getJson<{ name?: string }>(key);
    return profile?.name?.trim() || null;
  } catch {
    return null;
  }
}
