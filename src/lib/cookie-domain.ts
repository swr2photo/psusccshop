/** Shared cookie domain for cross-subdomain API (sccshop → api.psuscc.club). */
export function getSharedCookieDomain(): string | undefined {
  const explicit = process.env.COOKIE_DOMAIN?.trim();
  if (explicit) return explicit;

  const splitApi =
    Boolean(process.env.NEXT_PUBLIC_API_URL?.trim()) ||
    Boolean(process.env.API_INTERNAL_URL?.trim());

  if (process.env.NODE_ENV === 'production' && splitApi) {
    return '.psuscc.club';
  }

  return undefined;
}
