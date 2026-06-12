/**
 * Client-side API URL resolver for split frontend/backend deployment.
 *
 * - NEXT_PUBLIC_API_URL unset → same-origin /api/* (Next.js or proxy)
 * - NEXT_PUBLIC_API_URL set   → direct calls to Elysia (e.g. https://api.example.com)
 */

const API_PREFIX = '/api';

function normalizePath(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const withSlash = path.startsWith('/') ? path : `/${path}`;
  return withSlash.startsWith(API_PREFIX) ? withSlash : `${API_PREFIX}${withSlash}`;
}

/** Base URL for browser API calls (empty string = same origin). */
export function getPublicApiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return (
      process.env.API_INTERNAL_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      ''
    ).replace(/\/$/, '');
  }
  return (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
}

/** Resolve a path to a full API URL. */
export function apiUrl(path: string): string {
  const normalized = normalizePath(path);
  const base = getPublicApiBaseUrl();
  return base ? `${base}${normalized}` : normalized;
}

/** fetch() wrapper — uses apiUrl + sends cookies for cross-origin when configured. */
export async function apiFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const url = apiUrl(path);
  const useCredentials = Boolean(getPublicApiBaseUrl());

  return fetch(url, {
    ...init,
    credentials: useCredentials ? 'include' : init?.credentials ?? 'same-origin',
  });
}
