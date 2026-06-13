/** Run before any `next/*` import on Cloudflare Workers. */
(globalThis as typeof globalThis & { __dirname?: string; __filename?: string }).__dirname ??= '/';
(globalThis as typeof globalThis & { __dirname?: string; __filename?: string }).__filename ??= '/worker.js';
