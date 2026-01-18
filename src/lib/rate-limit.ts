// src/lib/rate-limit.ts
// Rate limiting utilities for API protection

/**
 * Simple in-memory rate limiter
 * Note: In production with multiple instances, use Redis or similar
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store (reset on server restart)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupOldEntries() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  
  lastCleanup = now;
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

export interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  maxRequests: number;
  /** Time window in seconds */
  windowSeconds: number;
  /** Identifier prefix (e.g., 'api', 'auth', 'order') */
  prefix?: string;
}

export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Remaining requests in current window */
  remaining: number;
  /** Unix timestamp when the limit resets */
  resetTime: number;
  /** Time in seconds until reset */
  retryAfter?: number;
}

/**
 * Default rate limit configurations for different endpoints
 */
export const RATE_LIMITS = {
  // General API - 100 requests per minute
  api: { maxRequests: 100, windowSeconds: 60, prefix: 'api' },
  
  // Authentication - 10 requests per minute
  auth: { maxRequests: 10, windowSeconds: 60, prefix: 'auth' },
  
  // Order submission - 5 per minute
  order: { maxRequests: 5, windowSeconds: 60, prefix: 'order' },
  
  // Payment verification - 10 per minute
  payment: { maxRequests: 10, windowSeconds: 60, prefix: 'payment' },
  
  // File upload - 10 per minute
  upload: { maxRequests: 10, windowSeconds: 60, prefix: 'upload' },
  
  // Admin operations - 30 per minute
  admin: { maxRequests: 30, windowSeconds: 60, prefix: 'admin' },
  
  // Strict - 3 per minute (for sensitive operations)
  strict: { maxRequests: 3, windowSeconds: 60, prefix: 'strict' },
} as const;

/**
 * Check rate limit for a given identifier
 * @param identifier - Unique identifier (usually IP + endpoint)
 * @param config - Rate limit configuration
 * @returns Rate limit result
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  cleanupOldEntries();
  
  const key = config.prefix ? `${config.prefix}:${identifier}` : identifier;
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;
  
  let entry = rateLimitStore.get(key);
  
  // Create new entry if doesn't exist or window expired
  if (!entry || now > entry.resetTime) {
    entry = {
      count: 0,
      resetTime: now + windowMs,
    };
  }
  
  // Increment count
  entry.count += 1;
  rateLimitStore.set(key, entry);
  
  const remaining = Math.max(0, config.maxRequests - entry.count);
  const allowed = entry.count <= config.maxRequests;
  
  return {
    allowed,
    remaining,
    resetTime: entry.resetTime,
    retryAfter: allowed ? undefined : Math.ceil((entry.resetTime - now) / 1000),
  };
}

/**
 * Create rate limit headers for response
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.floor(result.resetTime / 1000)),
  };
  
  if (result.retryAfter !== undefined) {
    headers['Retry-After'] = String(result.retryAfter);
  }
  
  return headers;
}

/**
 * Get identifier for rate limiting from request
 */
export function getRateLimitIdentifier(request: Request, suffix?: string): string {
  // Try Cloudflare IP first
  const cfIP = request.headers.get('cf-connecting-ip');
  if (cfIP) {
    return suffix ? `${cfIP}:${suffix}` : cfIP;
  }
  
  // Try X-Forwarded-For
  const xForwardedFor = request.headers.get('x-forwarded-for');
  if (xForwardedFor) {
    const ip = xForwardedFor.split(',')[0].trim();
    return suffix ? `${ip}:${suffix}` : ip;
  }
  
  // Try X-Real-IP
  const xRealIP = request.headers.get('x-real-ip');
  if (xRealIP) {
    return suffix ? `${xRealIP}:${suffix}` : xRealIP;
  }
  
  // Fallback to a hash of headers (not ideal but better than nothing)
  const userAgent = request.headers.get('user-agent') || 'unknown';
  const fallback = `unknown:${userAgent.slice(0, 50)}`;
  return suffix ? `${fallback}:${suffix}` : fallback;
}

/**
 * Combined rate limit check with multiple tiers
 * Checks both global and endpoint-specific limits
 */
export function checkCombinedRateLimit(
  request: Request,
  endpointConfig: RateLimitConfig
): RateLimitResult {
  const ip = getRateLimitIdentifier(request);
  
  // Check global rate limit first (stricter)
  const globalResult = checkRateLimit(ip, RATE_LIMITS.api);
  if (!globalResult.allowed) {
    return globalResult;
  }
  
  // Check endpoint-specific rate limit
  const endpointId = getRateLimitIdentifier(request, endpointConfig.prefix);
  return checkRateLimit(endpointId, endpointConfig);
}
