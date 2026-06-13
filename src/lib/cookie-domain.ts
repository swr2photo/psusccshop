/** Shared cookie domain for cross-subdomain API (sccshop → api.psuscc.club). */
export function getSharedCookieDomain(): string | undefined {
  const explicit =
    process.env.NEXT_PUBLIC_COOKIE_DOMAIN?.trim() ||
    process.env.COOKIE_DOMAIN?.trim();
  if (explicit) return explicit;

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host.endsWith('.psuscc.club') || host === 'psuscc.club') return '.psuscc.club';
    if (host.endsWith('.psusci.club') || host === 'psusci.club') return '.psusci.club';
  }

  const splitApi =
    Boolean(process.env.NEXT_PUBLIC_API_URL?.trim()) ||
    Boolean(process.env.API_INTERNAL_URL?.trim()) ||
    Boolean(process.env.NEXT_PUBLIC_SPLIT_API?.trim());

  if (process.env.NODE_ENV === 'production' && splitApi) {
    return '.psuscc.club';
  }

  return undefined;
}
