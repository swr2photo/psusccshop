/** Production CORS + request hardening for the Elysia API (Workers/Bun). */
import { Elysia } from 'elysia';
import {
  checkRateLimitSupabase,
  getClientIP,
  getRateLimitHeaders,
  isIPBlocked,
} from '@/lib/rate-limit-supabase';

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

/** Routes callable without browser Origin (webhooks, cron, image proxy). */
const NO_ORIGIN_PREFIXES = [
  '/api/payment/webhook/',
  '/api/cron/',
  '/api/image/',
];

const NAVIGABLE_PREFIXES = ['/api/invoice'];

const BOT_PROTECTED_PREFIXES = [
  '/api/orders',
  '/api/payment',
  '/api/cart',
  '/api/profile',
];

const STRICT_PREFIXES = ['/api/payment', '/api/upload', '/api/auto-email', '/api/gas'];
const MODERATE_PREFIXES = ['/api/admin'];

const ALLOWED_BOTS = ['googlebot', 'bingbot', 'slurp', 'duckduckbot', 'facebookexternalhit'];

function isSuspiciousUserAgent(userAgent: string | null): boolean {
  if (!userAgent) return true;
  const ua = userAgent.toLowerCase();
  if (ua.includes('mozilla') || ua.includes('chrome') || ua.includes('safari') || ua.includes('firefox') || ua.includes('edge')) {
    return false;
  }
  for (const allowed of ALLOWED_BOTS) {
    if (ua.includes(allowed)) return false;
  }
  const suspicious = ['bot', 'crawler', 'spider', 'scraper', 'curl', 'wget', 'python-requests', 'httpclient'];
  return suspicious.some((p) => ua.includes(p));
}

function rateLimitConfig(pathname: string, method: string): { maxRequests: number; windowSeconds: number; prefix: string } {
  if (STRICT_PREFIXES.some((p) => pathname.startsWith(p))) {
    return { maxRequests: 30, windowSeconds: 60, prefix: 'strict' };
  }
  if (MODERATE_PREFIXES.some((p) => pathname.startsWith(p))) {
    return { maxRequests: 60, windowSeconds: 60, prefix: 'moderate' };
  }
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method) && pathname.startsWith('/api/')) {
    return { maxRequests: 60, windowSeconds: 60, prefix: 'write' };
  }
  const max = Number(process.env.API_RATE_LIMIT_MAX) || 200;
  const windowSeconds = Number(process.env.API_RATE_LIMIT_WINDOW_MS) / 1000 || 60;
  return { maxRequests: max, windowSeconds: windowSeconds > 0 ? windowSeconds : 60, prefix: 'normal' };
}

function deny(set: { status?: number | string; headers?: Record<string, string> }, status: number, message: string, extraHeaders?: Record<string, string>) {
  set.status = status;
  set.headers = { ...SECURITY_HEADERS, ...extraHeaders, 'Content-Type': 'application/json; charset=utf-8' };
  return { status: 'error', message };
}

/** Global security hooks — mirrors Vercel middleware for direct Workers access. */
export function apiSecurityPlugin() {
  return new Elysia({ name: 'api-security' })
    .onBeforeHandle(async ({ request, set }) => {
      const url = new URL(request.url);
      const pathname = url.pathname;
      const method = request.method.toUpperCase();

      for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
        set.headers[k] = v;
      }

      const ip = getClientIP(request);
      if (await isIPBlocked(ip)) {
        return deny(set, 403, 'Access denied');
      }

      const secFetchMode = request.headers.get('sec-fetch-mode');
      const secFetchDest = request.headers.get('sec-fetch-dest');
      if (secFetchMode === 'navigate' || secFetchDest === 'document') {
        const ok =
          NO_ORIGIN_PREFIXES.some((p) => pathname.startsWith(p)) ||
          NAVIGABLE_PREFIXES.some((p) => pathname.startsWith(p));
        if (!ok && pathname.startsWith('/api/')) {
          return deny(set, 403, 'Direct API access is not allowed');
        }
      }

      const userAgent = request.headers.get('user-agent');
      if (BOT_PROTECTED_PREFIXES.some((p) => pathname.startsWith(p)) && isSuspiciousUserAgent(userAgent)) {
        console.warn(`[Security] Blocked suspicious client: ${ip} ${pathname}`);
        return deny(set, 403, 'Access denied');
      }

      const cfg = rateLimitConfig(pathname, method);
      const result = await checkRateLimitSupabase(`${ip}:${cfg.prefix}`, cfg);
      if (!result.allowed) {
        return deny(set, 429, 'Too many requests. Please try again later.', getRateLimitHeaders(result));
      }

      set.headers['X-RateLimit-Remaining'] = String(result.remaining);
      set.headers['X-RateLimit-Reset'] = String(Math.floor(result.resetTime / 1000));
    });
}

export function isServerToServerPath(pathname: string): boolean {
  return NO_ORIGIN_PREFIXES.some((p) => pathname.startsWith(p));
}

export function safeApiErrorMessage(error: unknown): string {
  if (process.env.NODE_ENV !== 'production') {
    return error instanceof Error ? error.message : 'Internal server error';
  }
  return 'Internal server error';
}
