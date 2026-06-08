// src/lib/rate-limit-supabase.ts
// Rate limiting with Drizzle ORM persistence for production use

import { db } from './db';
import { rateLimits, blockedIps } from '../db/schema';
import { eq, lt, gt, and, desc } from 'drizzle-orm';

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
  api: { maxRequests: 100, windowSeconds: 60, prefix: 'api' },
  auth: { maxRequests: 10, windowSeconds: 60, prefix: 'auth' },
  order: { maxRequests: 5, windowSeconds: 60, prefix: 'order' },
  payment: { maxRequests: 10, windowSeconds: 60, prefix: 'payment' },
  upload: { maxRequests: 100, windowSeconds: 60, prefix: 'upload' },
  admin: { maxRequests: 30, windowSeconds: 60, prefix: 'admin' },
  strict: { maxRequests: 3, windowSeconds: 60, prefix: 'strict' },
  critical: { maxRequests: 1, windowSeconds: 60, prefix: 'critical' },
} as const;

// ==================== IN-MEMORY CACHE ====================

interface CachedEntry {
  count: number;
  resetTime: number;
  syncedToDb: boolean;
}

const localCache = new Map<string, CachedEntry>();

// ==================== DATABASE FUNCTIONS ====================

export async function checkRateLimitSupabase(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const key = config.prefix ? `${config.prefix}:${identifier}` : identifier;
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;
  const resetTime = now + windowMs;
  
  try {
    const rows = await db.select()
      .from(rateLimits)
      .where(eq(rateLimits.identifier, key))
      .limit(1);
    const existing = rows[0];
    
    if (existing && new Date(existing.resetAt).getTime() > now) {
      const newCount = existing.count + 1;
      
      await db.update(rateLimits)
        .set({ count: newCount })
        .where(eq(rateLimits.identifier, key));
      
      const remaining = Math.max(0, config.maxRequests - newCount);
      const allowed = newCount <= config.maxRequests;
      
      return {
        allowed,
        remaining,
        resetTime: new Date(existing.resetAt).getTime(),
        retryAfter: allowed ? undefined : Math.ceil((new Date(existing.resetAt).getTime() - now) / 1000),
      };
    } else {
      await db.insert(rateLimits)
        .values({
          identifier: key,
          count: 1,
          resetAt: new Date(resetTime),
        })
        .onConflictDoUpdate({
          target: rateLimits.identifier,
          set: { count: 1, resetAt: new Date(resetTime) },
        });
      
      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetTime,
      };
    }
  } catch (error) {
    console.error('[RateLimit] Drizzle error, using fallback:', error);
    return checkRateLimitLocal(identifier, config);
  }
}

export function checkRateLimitLocal(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const key = config.prefix ? `${config.prefix}:${identifier}` : identifier;
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;
  
  let entry = localCache.get(key);
  
  if (!entry || now > entry.resetTime) {
    entry = { count: 0, resetTime: now + windowMs, syncedToDb: false };
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

export function getClientIP(request: Request): string {
  const cfIP = request.headers.get('cf-connecting-ip');
  if (cfIP) return cfIP;
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  const realIP = request.headers.get('x-real-ip');
  if (realIP) return realIP;
  return 'unknown';
}

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

export async function cleanupExpiredRateLimits(): Promise<number> {
  try {
    const result = await db.delete(rateLimits)
      .where(lt(rateLimits.resetAt, new Date()))
      .returning();
    return result.length;
  } catch (error) {
    console.error('[RateLimit] Cleanup error:', error);
    return 0;
  }
}

export async function blockIP(ip: string, reason: string, durationHours: number = 24): Promise<void> {
  const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000);
  await db.insert(blockedIps)
    .values({
      ipAddress: ip,
      reason,
      expiresAt,
      blockedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: blockedIps.ipAddress,
      set: { reason, expiresAt, blockedAt: new Date() },
    });
}

export async function isIPBlocked(ip: string): Promise<boolean> {
  try {
    const rows = await db.select()
      .from(blockedIps)
      .where(and(eq(blockedIps.ipAddress, ip), gt(blockedIps.expiresAt, new Date())))
      .limit(1);
    return rows.length > 0;
  } catch {
    return false;
  }
}

export async function unblockIP(ip: string): Promise<void> {
  await db.delete(blockedIps)
    .where(eq(blockedIps.ipAddress, ip));
}

export async function getBlockedIPs(): Promise<Array<{
  ip: string;
  reason: string;
  blockedAt: string;
  expiresAt: string;
}>> {
  const data = await db.select()
    .from(blockedIps)
    .where(gt(blockedIps.expiresAt, new Date()))
    .orderBy(desc(blockedIps.blockedAt));
  
  return data.map((row: any) => ({
    ip: row.ipAddress,
    reason: row.reason,
    blockedAt: row.blockedAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
  }));
}
