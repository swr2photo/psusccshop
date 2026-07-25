/**
 * NextAuth-compatible session cookie chunking (mirrors next-auth/core/lib/cookie.js).
 * sync-cookie must use this — a single Set-Cookie over ~4KB is dropped by browsers
 * after host-only clears, which surfaces as random /api/* 401s.
 */

const ALLOWED_COOKIE_SIZE = 4096;
const ESTIMATED_EMPTY_COOKIE_SIZE = 163;
export const SESSION_COOKIE_CHUNK_SIZE = ALLOWED_COOKIE_SIZE - ESTIMATED_EMPTY_COOKIE_SIZE;

export type SessionCookieChunk = {
  name: string;
  value: string;
};

/** Split a JWT into name / name.0 / name.1 … chunks under the browser limit. */
export function chunkSessionCookieValue(
  cookieName: string,
  value: string,
): SessionCookieChunk[] {
  if (!value) return [{ name: cookieName, value: '' }];
  const chunkCount = Math.ceil(value.length / SESSION_COOKIE_CHUNK_SIZE);
  if (chunkCount <= 1) {
    return [{ name: cookieName, value }];
  }
  const chunks: SessionCookieChunk[] = [];
  for (let i = 0; i < chunkCount; i++) {
    chunks.push({
      name: `${cookieName}.${i}`,
      value: value.slice(i * SESSION_COOKIE_CHUNK_SIZE, (i + 1) * SESSION_COOKIE_CHUNK_SIZE),
    });
  }
  return chunks;
}

/** Cookie names to expire when replacing a (possibly chunked) session token. */
export function sessionCookieNamesToClear(cookieName: string, maxChunks = 8): string[] {
  const names = [cookieName];
  for (let i = 0; i < maxChunks; i++) {
    names.push(`${cookieName}.${i}`);
  }
  return names;
}
