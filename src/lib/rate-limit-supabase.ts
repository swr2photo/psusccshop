// src/lib/rate-limit-supabase.ts
// Rate limiting with Supabase persistence for production use

import { getSupabaseAdmin } from './supabase';

// ==================== TYPES ====================

export interface RateLimitEntry {
  identifier: string;
  count: number;
  reset_at: string;
  created_at: string;
}

export interface RateLimitConfig {
  maxRequests: number;
  windowSeconds: number;
  prefix?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

// ==================== DEFAULT CONFIGS ====================

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
  
  // Very strict - 1 per minute (for key rotation, etc.)
  critical: { maxRequests: 1, windowSeconds: 60, prefix: 'critical' },
} as const;

// ==================== IN-MEMORY CACHE ====================
// Use local cache first, sync to Supabase for distributed rate limiting

interface CachedEntry {
  count: number;
  resetTime: number;
  syncedToDb: boolean;
}

const localCache = new Map<string, CachedEntry>();

// ==================== SUPABASE FUNCTIONS ====================

/**
 * Check rate limit using Supabase (distributed)
 */
export async function checkRateLimitSupabase(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const key = config.prefix ? `${config.prefix}:${identifier}` : identifier;
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;
  const resetTime = now + windowMs;
  
  try {
    const db = getSupabaseAdmin();
    if (!db) {
      // Fallback to in-memory if DB not available
      return checkRateLimitLocal(identifier, config);
    }
    
    // Get or create rate limit entry
    const { data: existing } = await db
      .from('rate_limits')
      .select('*')
      .eq('identifier', key)
      .single();
    
    if (existing && new Date(existing.reset_at).getTime() > now) {
      // Entry exists and not expired
      const newCount = existing.count + 1;
      
      await db
        .from('rate_limits')
        .update({ count: newCount })
        .eq('identifier', key);
      
      const remaining = Math.max(0, config.maxRequests - newCount);
      const allowed = newCount <= config.maxRequests;
      
      return {
        allowed,
        remaining,
        resetTime: new Date(existing.reset_at).getTime(),
        retryAfter: allowed ? undefined : Math.ceil((new Date(existing.reset_at).getTime() - now) / 1000),
      };
    } else {
      // Create new entry or reset expired one
      await db
        .from('rate_limits')
        .upsert({
          identifier: key,
          count: 1,
          reset_at: new Date(resetTime).toISOString(),
        }, {
          onConflict: 'identifier',
        });
      
      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetTime,
      };
    }
  } catch (error) {
    console.error('[RateLimit] Supabase error, using fallback:', error);
    // Fallback to in-memory if DB fails
    return checkRateLimitLocal(identifier, config);
  }
}

/**
 * In-memory rate limit (fallback)
 */
export function checkRateLimitLocal(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const key = config.prefix ? `${config.prefix}:${identifier}` : identifier;
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;
  
  let entry = localCache.get(key);
  
  if (!entry || now > entry.resetTime) {
    entry = {
      count: 0,
      resetTime: now + windowMs,
      syncedToDb: false,
    };
  }
  
  entry.count += 1;
  localCache.set(key, entry);
  
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
 * Get client IP from request
 */
export function getClientIP(request: Request): string {
  // Cloudflare
  const cfIP = request.headers.get('cf-connecting-ip');
  if (cfIP) return cfIP;
  
  // X-Forwarded-For
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  
  // X-Real-IP
  const realIP = request.headers.get('x-real-ip');
  if (realIP) return realIP;
  
  return 'unknown';
}

/**
 * Create rate limit headers
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
 * Clean up expired rate limit entries
 */
export async function cleanupExpiredRateLimits(): Promise<number> {
  try {
    const db = getSupabaseAdmin();
    if (!db) return 0;
    const { data, error } = await db
      .from('rate_limits')
      .delete()
      .lt('reset_at', new Date().toISOString())
      .select('identifier');
    
    if (error) throw error;
    return data?.length || 0;
  } catch (error) {
    console.error('[RateLimit] Cleanup error:', error);
    return 0;
  }
}

/**
 * Block an IP address
 */
export async function blockIP(ip: string, reason: string, durationHours: number = 24): Promise<void> {
  const db = getSupabaseAdmin();
  if (!db) throw new Error('Database not available');
  const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000);
  
  await db.from('blocked_ips').upsert({
    ip_address: ip,
    reason,
    expires_at: expiresAt.toISOString(),
    blocked_at: new Date().toISOString(),
  }, {
    onConflict: 'ip_address',
  });
}

/**
 * Check if IP is blocked
 */
export async function isIPBlocked(ip: string): Promise<boolean> {
  try {
    const db = getSupabaseAdmin();
    if (!db) return false;
    const { data } = await db
      .from('blocked_ips')
      .select('*')
      .eq('ip_address', ip)
      .gt('expires_at', new Date().toISOString())
      .single();
    
    return !!data;
  } catch {
    return false;
  }
}

/**
 * Unblock an IP address
 */
export async function unblockIP(ip: string): Promise<void> {
  const db = getSupabaseAdmin();
  if (!db) throw new Error('Database not available');
  await db.from('blocked_ips').delete().eq('ip_address', ip);
}

/**
 * Get blocked IPs list
 */
export async function getBlockedIPs(): Promise<Array<{
  ip: string;
  reason: string;
  blockedAt: string;
  expiresAt: string;
}>> {
  const db = getSupabaseAdmin();
  if (!db) return [];
  const { data } = await db
    .from('blocked_ips')
    .select('*')
    .gt('expires_at', new Date().toISOString())
    .order('blocked_at', { ascending: false });
  
  return (data || []).map(row => ({
    ip: row.ip_address,
    reason: row.reason,
    blockedAt: row.blocked_at,
    expiresAt: row.expires_at,
  }));
}
