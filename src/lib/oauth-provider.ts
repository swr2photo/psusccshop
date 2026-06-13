/** CJS default export interop for next-auth providers (Cloudflare Workers bundle). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function oauthProvider(mod: unknown): any {
  let current: unknown = mod;

  for (let depth = 0; depth < 5; depth++) {
    if (typeof current === 'function') return current;
    if (!current || typeof current !== 'object' || !('default' in current)) break;

    const next = (current as { default: unknown }).default;
    if (next === current) break;
    current = next;
  }

  throw new Error('Invalid OAuth provider module');
}
