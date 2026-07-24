import { NextRequest, NextResponse } from 'next/server';
import {
  checkCombinedRateLimitAsync,
  getRateLimitHeaders,
  type RateLimitConfig,
} from '@/lib/rate-limit';

/** Shared Cache-Control values for public GET endpoints */
export const API_CACHE = {
  short: 'public, max-age=0, s-maxage=30, stale-while-revalidate=60',
  medium: 'public, max-age=0, s-maxage=120, stale-while-revalidate=300',
  config: 'public, max-age=0, s-maxage=10, stale-while-revalidate=30',
  private: 'private, no-store, max-age=0',
} as const;

/** Extra headers so Cloudflare CDN / Cache API can store public API responses */
export const API_CDN_HEADERS = {
  short: { 'CDN-Cache-Control': 'public, max-age=30' },
  medium: { 'CDN-Cache-Control': 'public, max-age=120' },
  config: { 'CDN-Cache-Control': 'public, max-age=10' },
} as const;

/**
 * Return 429 response when rate limit exceeded, otherwise null.
 */
export async function rateLimitOrNull(
  request: NextRequest,
  config: RateLimitConfig
): Promise<NextResponse | null> {
  const result = await checkCombinedRateLimitAsync(request, config);
  if (!result.allowed) {
    return NextResponse.json(
      { status: 'error', message: 'Too many requests. Please try again later.' },
      { status: 429, headers: getRateLimitHeaders(result) }
    );
  }
  return null;
}

/**
 * Protect internal-only endpoints (cron workers, server-side jobs).
 * Uses CRON_SECRET via Authorization: Bearer header.
 */
export function requireInternalSecret(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Internal API not configured' }, { status: 503 });
  }

  const authHeader = request.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (token !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

/**
 * Fail closed when webhook secret is missing (all environments).
 */
export function webhookSecretMissingResponse(envVar: string): NextResponse | null {
  if (!process.env[envVar]) {
    console.error(`[Webhook] ${envVar} is required`);
    return NextResponse.json(
      { success: false, error: 'Webhook not configured' },
      { status: 503 }
    );
  }
  return null;
}
