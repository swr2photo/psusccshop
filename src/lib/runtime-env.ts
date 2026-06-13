/** True when running inside Cloudflare Workers (Hyperdrive binding on globalThis). */
export function isCloudflareWorkersRuntime(): boolean {
  return Boolean((globalThis as { __CF_ENV__?: unknown }).__CF_ENV__);
}
