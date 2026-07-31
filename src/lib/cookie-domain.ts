/**
 * Shared cookie domain for cross-subdomain JWT (sccshop ↔ api.psuscc.club).
 * Prefer explicit COOKIE_DOMAIN; otherwise infer from NEXTAUTH_URL / host.
 */

function domainFromHostname(host: string): string | undefined {
  const h = host.trim().toLowerCase().replace(/\.$/, '');
  if (!h) return undefined;
  if (h === 'psuscc.club' || h.endsWith('.psuscc.club')) return '.psuscc.club';
  if (h === 'psuscc.club' || h.endsWith('.psuscc.club')) return '.psuscc.club';
  return undefined;
}

function domainFromUrl(url?: string | null): string | undefined {
  if (!url?.trim()) return undefined;
  try {
    return domainFromHostname(new URL(url.trim()).hostname);
  } catch {
    return undefined;
  }
}

function hasSplitApiSignals(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
      process.env.API_INTERNAL_URL?.trim() ||
      process.env.NEXT_PUBLIC_SPLIT_API?.trim() ||
      process.env.VERCEL === '1',
  );
}

/** Shared cookie Domain value (leading dot) or undefined for host-only. */
export function getSharedCookieDomain(): string | undefined {
  const explicit =
    process.env.COOKIE_DOMAIN?.trim() ||
    process.env.NEXT_PUBLIC_COOKIE_DOMAIN?.trim();
  if (explicit) {
    return `.${explicit.replace(/^\./, '')}`;
  }

  if (typeof window !== 'undefined') {
    const fromHost = domainFromHostname(window.location.hostname);
    if (fromHost) return fromHost;
  }

  const fromAuthUrl =
    domainFromUrl(process.env.NEXTAUTH_URL) ||
    domainFromUrl(process.env.AUTH_URL) ||
    domainFromUrl(
      process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : undefined,
    );
  if (fromAuthUrl) return fromAuthUrl;

  // Production shop + API split — default to parent domain
  if (process.env.NODE_ENV === 'production' && hasSplitApiSignals()) {
    return '.psuscc.club';
  }

  return undefined;
}

/** True when browser should refresh/upgrade session cookie to shared Domain. */
export function shouldSyncAuthCookieInBrowser(): boolean {
  if (typeof window === 'undefined') return false;
  if (process.env.NEXT_PUBLIC_AUTH_COOKIE_SYNC === '0') return false;
  if (process.env.NEXT_PUBLIC_AUTH_COOKIE_SYNC === '1') return true;
  // Auto on production shop hosts (fixes host-only leftovers after Domain rollout)
  return Boolean(domainFromHostname(window.location.hostname));
}
