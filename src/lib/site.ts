/** Canonical public site URL (no trailing slash). */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_BASE_URL || 'https://sccshop.psusci.club'
).replace(/\/$/, '');

export function absoluteUrl(path = '/'): string {
  if (path.startsWith('http')) return path;
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
