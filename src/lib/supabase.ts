// src/lib/supabase.ts
// Database operations using Drizzle ORM + Supabase Storage
// Migrated from Prisma to Drizzle for all database queries

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getRedisClient } from './redis';
import { db } from './db';
import { orders, config, carts, profiles, emailLogs, userLogs, dataRequests, keyValueStore, adminPermissions, securityAuditLog } from '../db/schema';
import { eq, lt, gt, and, desc, inArray, like, or, count } from 'drizzle-orm';
import { getCached, invalidateCacheKey, CACHE_TTL } from './server-cache';

// ==================== CONFIGURATION ====================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL2 || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY2 || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY2 || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Public client (for client-side, uses anon key with RLS)
// ใช้เฉพาะสำหรับ read public config เท่านั้น
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  realtime: {
    params: { eventsPerSecond: 2 },
  },
  global: {
    fetch(url, options = {}) {
      return fetch(url, { ...options, cache: 'no-store' as any });
    },
  },
});

// Admin client (for server-side ONLY, bypasses RLS)
// ยังคงใช้สำหรับ Storage เท่านั้น
let _supabaseAdmin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient | null {
  if (_supabaseAdmin) return _supabaseAdmin;
  const storageUrl = process.env.NEXT_PUBLIC_SUPABASE_URL2 || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  if (!storageUrl || !supabaseServiceKey) {
    console.warn('[supabase] Missing NEXT_PUBLIC_SUPABASE_URL/URL2 or SERVICE_ROLE_KEY');
    return null;
  }
  _supabaseAdmin = createClient(storageUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    db: {
      schema: 'public',
    },
    global: {
      fetch(url, options = {}) {
        return fetch(url, { ...options, cache: 'no-store' as any });
      },
    },
  });
  return _supabaseAdmin;
}

// ==================== DATABASE TYPES ====================

export interface DBOrder {
  id: string;
  ref: string;
  date: string;
  status: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_address: string;
  customer_instagram?: string;
  cart: any[];
  total_amount: number;
  notes?: string;
  slip_data?: any;
  payment_verified_at?: string;
  payment_method?: string;
  created_at: string;
  updated_at: string;
}

export interface DBConfig {
  id: string;
  key: string;
  value: any;
  created_at: string;
  updated_at: string;
}

export interface DBCart {
  id: string;
  email_hash: string;
  cart_data: any[];
  created_at: string;
  updated_at: string;
}

export interface DBProfile {
  id: string;
  email_hash: string;
  name: string;
  phone: string;
  address: string;
  instagram?: string;
  created_at: string;
  updated_at: string;
}

export interface DBEmailLog {
  id: string;
  order_ref?: string;
  to_email: string;
  from_email: string;
  subject: string;
  body: string;
  email_type: string;
  status: string;
  sent_at?: string;
  error?: string;
  created_at: string;
}

export interface DBUserLog {
  id: string;
  email: string;
  name?: string;
  action: string;
  details?: string;
  metadata?: any;
  ip?: string;
  user_agent?: string;
  created_at: string;
}

export interface DBDataRequest {
  id: string;
  email: string;
  request_type: string;
  status: string;
  details?: any;
  processed_at?: string;
  created_at: string;
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Generic JSON storage helper - compatible with old filebase API
 * Maps key patterns to appropriate tables
 */
export async function getJson<T = any>(key: string): Promise<T | null> {
  try {
    // Route based on key pattern
    if (key.startsWith('orders/index/')) {
      const emailHashValue = key.replace('orders/index/', '').replace('.json', '');
      const data = await db.select()
        .from(orders)
        .where(eq(orders.emailHash, emailHashValue))
        .orderBy(desc(orders.createdAt))
        .limit(500);
      return (data?.map(transformDBOrderToLegacy) || []) as T;
    }
    
    if (key.startsWith('orders/')) {
      const refVal = key.split('/').pop()?.replace('.json', '');
      if (!refVal) return null;
      const data = await db.select().from(orders).where(eq(orders.ref, refVal)).limit(1);
      return data[0] ? (transformDBOrderToLegacy(data[0]) as T) : null;
    }
    
    if (key.startsWith('config/')) {
      const configKey = key.replace('config/', '').replace('.json', '');
      const cacheKey = `json:config:${configKey}`;
      return getCached(cacheKey, CACHE_TTL.config, async () => {
        const data = await db.select().from(config).where(eq(config.key, configKey)).limit(1);
        return (data[0]?.value as T) || null;
      });
    }
    
    if (key.startsWith('carts/')) {
      const emailHashValue = key.replace('carts/', '').replace('.json', '');
      const data = await db.select().from(carts).where(eq(carts.emailHash, emailHashValue)).limit(1);
      return (data[0]?.cartData as T) || null;
    }
    
    if (key.startsWith('users/')) {
      const emailHashValue = key.replace('users/', '').replace('.json', '');
      const data = await db.select().from(profiles).where(eq(profiles.emailHash, emailHashValue)).limit(1);
      return data[0] ? (transformDBProfileToLegacy(data[0]) as T) : null;
    }
    
    if (key.startsWith('email-logs/')) {
      const logId = key.replace('email-logs/', '').replace('.json', '');
      const data = await db.select().from(emailLogs).where(eq(emailLogs.id, logId)).limit(1);
      return data[0] ? (transformDBEmailLogToLegacy(data[0]) as T) : null;
    }
    
    if (key.startsWith('user-logs/')) {
      const logId = key.replace('user-logs/', '').replace('.json', '');
      const data = await db.select().from(userLogs).where(eq(userLogs.id, logId)).limit(1);
      return data[0] ? (transformDBUserLogToLegacy(data[0]) as T) : null;
    }
    
    if (key.startsWith('data-requests/')) {
      const requestId = key.replace('data-requests/', '').replace('.json', '');
      const data = await db.select().from(dataRequests).where(eq(dataRequests.id, requestId)).limit(1);
      return (data[0] as T) || null;
    }
    
    // Generic key-value fallback
    const data = await db.select().from(keyValueStore).where(eq(keyValueStore.key, key)).limit(1);
    return (data[0]?.value as T) || null;
    
  } catch (error: any) {
    console.error('[drizzle] getJson error', key, error);
    throw error;
  }
}

/**
 * Store JSON data
 */
export async function putJson(key: string, data: any): Promise<void> {
  try {
    if (key.startsWith('orders/index/')) {
      // Order indexes are maintained automatically
      return;
    }
    
    if (key.startsWith('orders/')) {
      const refVal = key.split('/').pop()?.replace('.json', '');
      if (!refVal) throw new Error('Invalid order key');
      const dbOrder = transformLegacyToDBOrder(data);
      await db.insert(orders)
        .values({ ...dbOrder, ref: refVal })
        .onConflictDoUpdate({
          target: orders.ref,
          set: { ...dbOrder, updatedAt: new Date() },
        });
      return;
    }
    
    if (key.startsWith('config/')) {
      const configKey = key.replace('config/', '').replace('.json', '');
      await db.insert(config)
        .values({ key: configKey, value: data })
        .onConflictDoUpdate({
          target: config.key,
          set: { value: data, updatedAt: new Date() },
        });
      invalidateCacheKey(`json:config:${configKey}`);
      // Bump the lightweight realtime signal row so clients refetch the
      // sanitized config immediately (the full row is too large / unsafe
      // to broadcast via postgres_changes).
      if (configKey === 'shop-settings') {
        try {
          const versionValue = {
            updatedAt: new Date().toISOString(),
            isOpen: typeof data?.isOpen === 'boolean' ? data.isOpen : null,
          };
          await db.insert(config)
            .values({ key: 'config-version', value: versionValue })
            .onConflictDoUpdate({
              target: config.key,
              set: { value: versionValue, updatedAt: new Date() },
            });
        } catch (versionError) {
          console.error('[drizzle] Failed to bump config-version signal:', versionError);
        }
      }
      return;
    }
    
    if (key.startsWith('carts/')) {
      const emailHashValue = key.replace('carts/', '').replace('.json', '');
      await db.insert(carts)
        .values({ emailHash: emailHashValue, cartData: data })
        .onConflictDoUpdate({
          target: carts.emailHash,
          set: { cartData: data, updatedAt: new Date() },
        });
      return;
    }
    
    if (key.startsWith('users/')) {
      const emailHashValue = key.replace('users/', '').replace('.json', '');
      const dbProfile = transformLegacyToDBProfile(emailHashValue, data);
      await db.insert(profiles)
        .values(dbProfile)
        .onConflictDoUpdate({
          target: profiles.emailHash,
          set: { ...dbProfile, updatedAt: new Date() },
        });
      return;
    }
    
    const isUuid = (str: any) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);

    if (key.startsWith('email-logs/')) {
      const dbLog = transformLegacyToDBEmailLog(data);
      const hasValidId = dbLog.id && isUuid(dbLog.id);
      if (!hasValidId) {
        delete dbLog.id;
        await db.insert(emailLogs).values(dbLog);
      } else {
        await db.insert(emailLogs)
          .values(dbLog)
          .onConflictDoUpdate({
            target: emailLogs.id,
            set: dbLog,
          });
      }
      return;
    }
    
    if (key.startsWith('user-logs/')) {
      const dbLog = transformLegacyToDBUserLog(data);
      if (dbLog.id && !isUuid(dbLog.id)) {
        delete dbLog.id;
      }
      await db.insert(userLogs).values(dbLog);
      return;
    }
    
    if (key.startsWith('data-requests/')) {
      const dbData = { ...data };
      const hasValidId = dbData.id && isUuid(dbData.id);
      if (!hasValidId) {
        delete dbData.id;
        await db.insert(dataRequests).values(dbData);
      } else {
        await db.insert(dataRequests)
          .values(dbData)
          .onConflictDoUpdate({
            target: dataRequests.id,
            set: dbData,
          });
      }
      return;
    }
    
    // Generic key-value fallback
    await db.insert(keyValueStore)
      .values({ key, value: data })
      .onConflictDoUpdate({
        target: keyValueStore.key,
        set: { value: data, updatedAt: new Date() },
      });
    
  } catch (error: any) {
    console.error('[drizzle] putJson error', key, error);
    throw error;
  }
}

/**
 * List keys with prefix (simulates S3 listKeys)
 */
export async function listKeys(prefix: string): Promise<string[]> {
  try {
    if (prefix.startsWith('orders/') && !prefix.includes('index')) {
      const data = await db.select({ ref: orders.ref, createdAt: orders.createdAt })
        .from(orders)
        .orderBy(desc(orders.createdAt));
      return (data || []).map((order: any) => {
        const date = new Date(order.createdAt);
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        return `orders/${yyyy}-${mm}/${order.ref}.json`;
      });
    }
    
    if (prefix.startsWith('email-logs/')) {
      const data = await db.select({ id: emailLogs.id })
        .from(emailLogs)
        .orderBy(desc(emailLogs.createdAt));
      return (data || []).map((log: any) => `email-logs/${log.id}.json`);
    }
    
    if (prefix.startsWith('user-logs/')) {
      const data = await db.select({ id: userLogs.id })
        .from(userLogs)
        .orderBy(desc(userLogs.createdAt));
      return (data || []).map((log: any) => `user-logs/${log.id}.json`);
    }
    
    if (prefix.startsWith('data-requests/')) {
      const data = await db.select({ id: dataRequests.id })
        .from(dataRequests)
        .orderBy(desc(dataRequests.createdAt));
      return (data || []).map((req: any) => `data-requests/${req.id}.json`);
    }
    
    // Generic key-value store fallback
    const data = await db.select({ key: keyValueStore.key })
      .from(keyValueStore)
      .where(like(keyValueStore.key, `${prefix}%`));
    return (data || []).map((item: any) => item.key);
    
  } catch (error: any) {
    console.error('[drizzle] listKeys error', prefix, error);
    throw error;
  }
}

/**
 * Delete an object
 */
export async function deleteObject(key: string): Promise<void> {
  try {
    if (key.startsWith('orders/')) {
      const refVal = key.split('/').pop()?.replace('.json', '');
      if (!refVal) return;
      await db.delete(orders).where(eq(orders.ref, refVal)).catch(() => {});
      return;
    }
    
    if (key.startsWith('carts/')) {
      const emailHashValue = key.replace('carts/', '').replace('.json', '');
      await db.delete(carts).where(eq(carts.emailHash, emailHashValue)).catch(() => {});
      return;
    }
    
    if (key.startsWith('users/')) {
      const emailHashValue = key.replace('users/', '').replace('.json', '');
      await db.delete(profiles).where(eq(profiles.emailHash, emailHashValue)).catch(() => {});
      return;
    }
    
    // Generic key-value store fallback
    await db.delete(keyValueStore).where(eq(keyValueStore.key, key)).catch(() => {});
    
  } catch (error: any) {
    console.error('[drizzle] deleteObject error', key, error);
    throw error;
  }
}

// ==================== TRANSFORM FUNCTIONS ====================

import crypto from 'crypto';

const normalizeEmail = (email?: string | null) => (email || '').trim().toLowerCase();
const emailHash = (email: string) => crypto.createHash('sha256').update(normalizeEmail(email)).digest('hex');

function transformDBOrderToLegacy(dbOrder: any): any {
  return {
    ref: dbOrder.ref,
    date: dbOrder.date || dbOrder.createdAt,
    status: dbOrder.status,
    customerName: dbOrder.customerName,
    customerEmail: dbOrder.customerEmail,
    customerPhone: dbOrder.customerPhone,
    customerAddress: dbOrder.customerAddress,
    customerInstagram: dbOrder.customerInstagram,
    cart: dbOrder.cart || [],
    totalAmount: dbOrder.totalAmount,
    amount: dbOrder.totalAmount,
    notes: dbOrder.notes,
    slip: dbOrder.slipData,
    slipData: dbOrder.slipData,
    paymentVerifiedAt: dbOrder.paymentVerifiedAt,
    paymentMethod: dbOrder.paymentMethod,
    shippingOption: dbOrder.shippingOption,
    trackingNumber: dbOrder.trackingNumber,
    shippingProvider: dbOrder.shippingProvider,
    trackingStatus: dbOrder.trackingStatus,
    trackingLastChecked: dbOrder.trackingLastChecked,
    shippedAt: dbOrder.shippedAt,
    receivedAt: dbOrder.receivedAt,
    refundStatus: dbOrder.refundStatus,
    refundReason: dbOrder.refundReason,
    refundDetails: dbOrder.refundDetails,
    refundBankName: dbOrder.refundBankName,
    refundBankAccount: dbOrder.refundBankAccount,
    refundAccountName: dbOrder.refundAccountName,
    refundAmount: dbOrder.refundAmount,
    refundRequestedAt: dbOrder.refundRequestedAt,
    refundReviewedAt: dbOrder.refundReviewedAt,
    refundReviewedBy: dbOrder.refundReviewedBy,
    refundAdminNote: dbOrder.refundAdminNote,
    pickup: dbOrder.pickupData || undefined,
    shopId: dbOrder.shopId || null,
    shopSlug: dbOrder.shopSlug || null,
    createdAt: dbOrder.createdAt,
    updatedAt: dbOrder.updatedAt,
    _key: `orders/${new Date(dbOrder.createdAt).getFullYear()}-${String(new Date(dbOrder.createdAt).getMonth() + 1).padStart(2, '0')}/${dbOrder.ref}.json`,
  };
}

function transformLegacyToDBOrder(legacyOrder: any): any {
  const email = legacyOrder.customerEmail || legacyOrder.email || '';
  const shippingOpt = legacyOrder.shippingOption || legacyOrder.shippingOptionId || null;
  
  return {
    ref: legacyOrder.ref,
    date: legacyOrder.date,
    status: legacyOrder.status || 'WAITING_PAYMENT',
    customerName: legacyOrder.customerName || legacyOrder.name || '',
    customerEmail: email,
    emailHash: emailHash(email),
    customerPhone: legacyOrder.customerPhone || legacyOrder.phone || '',
    customerAddress: legacyOrder.customerAddress || legacyOrder.address || '',
    customerInstagram: legacyOrder.customerInstagram || legacyOrder.instagram || null,
    cart: legacyOrder.cart || [],
    totalAmount: legacyOrder.totalAmount || legacyOrder.amount || 0,
    notes: legacyOrder.notes || null,
    slipData: legacyOrder.slip || legacyOrder.slipData || null,
    paymentVerifiedAt: legacyOrder.paymentVerifiedAt || legacyOrder.verifiedAt || null,
    paymentMethod: legacyOrder.paymentMethod || null,
    shippingOption: shippingOpt,
    trackingNumber: legacyOrder.trackingNumber || null,
    shippingProvider: legacyOrder.shippingProvider || null,
    trackingStatus: legacyOrder.trackingStatus || null,
    trackingLastChecked: legacyOrder.trackingLastChecked || null,
    shippedAt: legacyOrder.shippedAt || null,
    receivedAt: legacyOrder.receivedAt || null,
    pickupData: legacyOrder.pickup || null,
    shopId: legacyOrder.shopId || null,
    shopSlug: legacyOrder.shopSlug || null,
    updatedAt: new Date(),
  };
}

function transformDBProfileToLegacy(dbProfile: any): any {
  return {
    name: dbProfile.name,
    phone: dbProfile.phone,
    address: dbProfile.address,
    instagram: dbProfile.instagram,
  };
}

function transformLegacyToDBProfile(hash: string, data: any): any {
  return {
    emailHash: hash,
    name: data.name || '',
    phone: data.phone || '',
    address: data.address || '',
    instagram: data.instagram || null,
    updatedAt: new Date(),
  };
}

function transformDBEmailLogToLegacy(dbLog: any): any {
  return {
    id: dbLog.id,
    orderRef: dbLog.orderRef,
    to: dbLog.toEmail,
    from: dbLog.fromEmail,
    subject: dbLog.subject,
    body: dbLog.body,
    type: dbLog.emailType,
    status: dbLog.status,
    sentAt: dbLog.sentAt,
    error: dbLog.error,
    timestamp: dbLog.createdAt,
  };
}

function transformLegacyToDBEmailLog(data: any): any {
  const isUuid = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
  const defaultFrom = process.env.EMAIL_FROM?.trim() || 'SCC Shop <no_reply@psuscc.club>';
  const dbLog: any = {
    orderRef: data.orderRef || null,
    toEmail: data.to || '',
    fromEmail: data.from || defaultFrom,
    subject: data.subject || '',
    body: data.body || data.html || data.text || '',
    emailType: data.type || 'custom',
    status: data.status || 'pending',
    sentAt: data.sentAt || null,
    error: data.error || null,
    createdAt: data.timestamp ? new Date(data.timestamp) : new Date(),
  };
  if (data.id && isUuid(data.id)) {
    dbLog.id = data.id;
  }
  return dbLog;
}

function transformDBUserLogToLegacy(dbLog: any): any {
  return {
    id: dbLog.id,
    email: dbLog.email,
    name: dbLog.name,
    action: dbLog.action,
    details: dbLog.details,
    metadata: dbLog.metadata,
    ip: dbLog.ip,
    userAgent: dbLog.userAgent,
    timestamp: dbLog.createdAt,
  };
}

function transformLegacyToDBUserLog(data: any): any {
  const isUuid = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
  const dbLog: any = {
    email: data.email || '',
    name: data.name || null,
    action: data.action || '',
    details: data.details || null,
    metadata: data.metadata || null,
    ip: data.ip || null,
    userAgent: data.userAgent || null,
    createdAt: data.timestamp ? new Date(data.timestamp) : new Date(),
  };
  if (data.id && isUuid(data.id)) {
    dbLog.id = data.id;
  }
  return dbLog;
}

// ==================== DIRECT DATABASE QUERIES ====================

/**
 * Get orders by email with pagination (optimized for Drizzle)
 */
export async function getOrdersByEmail(
  email: string, 
  options: { limit?: number; offset?: number; status?: string[]; shopSlug?: string } = {}
): Promise<{ orders: any[]; total: number }> {
  const { limit = 50, offset = 0, status, shopSlug } = options;
  const hash = emailHash(email);
  
  const conditions = [eq(orders.emailHash, hash)];
  if (status && status.length > 0) conditions.push(inArray(orders.status, status));
  if (shopSlug) conditions.push(eq(orders.shopSlug, shopSlug));
  
  const whereClause = and(...conditions);
  
  const [data, totalResult] = await Promise.all([
    db.select()
      .from(orders)
      .where(whereClause)
      .orderBy(desc(orders.createdAt))
      .offset(offset)
      .limit(limit),
    db.select({ value: count() })
      .from(orders)
      .where(whereClause),
  ]);
  
  return {
    orders: (data || []).map(transformDBOrderToLegacy),
    total: totalResult[0]?.value || 0,
  };
}

/**
 * Get all orders (admin) with pagination
 */
export async function getAllOrders(
  options: { limit?: number; offset?: number; status?: string[]; search?: string } = {}
): Promise<{ orders: any[]; total: number }> {
  const { limit = 100, offset = 0, status, search } = options;
  
  const conditions = [];
  if (status && status.length > 0) conditions.push(inArray(orders.status, status));
  if (search) {
    conditions.push(or(
      like(orders.ref, `%${search}%`),
      like(orders.customerName, `%${search}%`),
      like(orders.customerEmail, `%${search}%`)
    ));
  }
  
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  let selectQuery = db.select().from(orders);
  let countQuery = db.select({ value: count() }).from(orders);
  
  if (whereClause) {
    selectQuery = selectQuery.where(whereClause) as any;
    countQuery = countQuery.where(whereClause) as any;
  }
  
  const [data, totalResult] = await Promise.all([
    selectQuery
      .orderBy(desc(orders.createdAt))
      .offset(offset)
      .limit(limit),
    countQuery,
  ]);
  
  return {
    orders: (data || []).map(transformDBOrderToLegacy),
    total: totalResult[0]?.value || 0,
  };
}

/**
 * Get order by ref
 */
export async function getOrderByRef(ref: string): Promise<any | null> {
  const data = await db.select().from(orders).where(eq(orders.ref, ref)).limit(1);
  return data[0] ? transformDBOrderToLegacy(data[0]) : null;
}

/**
 * Update order by ref
 */
export async function updateOrderByRef(ref: string, updates: Partial<any>): Promise<any> {
  const dbUpdates: any = { updatedAt: new Date() };
  
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.customerName !== undefined) dbUpdates.customerName = updates.customerName;
  if (updates.customerPhone !== undefined) dbUpdates.customerPhone = updates.customerPhone;
  if (updates.customerAddress !== undefined) dbUpdates.customerAddress = updates.customerAddress;
  if (updates.customerInstagram !== undefined) dbUpdates.customerInstagram = updates.customerInstagram;
  if (updates.cart !== undefined) dbUpdates.cart = updates.cart;
  if (updates.totalAmount !== undefined) dbUpdates.totalAmount = updates.totalAmount;
  if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
  if (updates.slipData !== undefined) dbUpdates.slipData = updates.slipData;
  if (updates.paymentVerifiedAt !== undefined) dbUpdates.paymentVerifiedAt = updates.paymentVerifiedAt;
  if (updates.paymentMethod !== undefined) dbUpdates.paymentMethod = updates.paymentMethod;
  if (updates.shippingOption !== undefined) dbUpdates.shippingOption = updates.shippingOption;
  if (updates.shippingOptionId !== undefined) dbUpdates.shippingOption = updates.shippingOptionId;
  if (updates.trackingNumber !== undefined) dbUpdates.trackingNumber = updates.trackingNumber;
  if (updates.shippingProvider !== undefined) dbUpdates.shippingProvider = updates.shippingProvider;
  if (updates.trackingStatus !== undefined) dbUpdates.trackingStatus = updates.trackingStatus;
  if (updates.trackingLastChecked !== undefined) dbUpdates.trackingLastChecked = updates.trackingLastChecked;
  if (updates.shippedAt !== undefined) dbUpdates.shippedAt = updates.shippedAt;
  if (updates.receivedAt !== undefined) dbUpdates.receivedAt = updates.receivedAt;
  if (updates.refundStatus !== undefined) dbUpdates.refundStatus = updates.refundStatus;
  if (updates.refundReason !== undefined) dbUpdates.refundReason = updates.refundReason;
  if (updates.refundDetails !== undefined) dbUpdates.refundDetails = updates.refundDetails;
  if (updates.refundBankName !== undefined) dbUpdates.refundBankName = updates.refundBankName;
  if (updates.refundBankAccount !== undefined) dbUpdates.refundBankAccount = updates.refundBankAccount;
  if (updates.refundAccountName !== undefined) dbUpdates.refundAccountName = updates.refundAccountName;
  if (updates.refundAmount !== undefined) dbUpdates.refundAmount = updates.refundAmount;
  if (updates.refundRequestedAt !== undefined) dbUpdates.refundRequestedAt = updates.refundRequestedAt;
  if (updates.refundReviewedAt !== undefined) dbUpdates.refundReviewedAt = updates.refundReviewedAt;
  if (updates.refundReviewedBy !== undefined) dbUpdates.refundReviewedBy = updates.refundReviewedBy;
  if (updates.refundAdminNote !== undefined) dbUpdates.refundAdminNote = updates.refundAdminNote;
  if (updates.pickup !== undefined) dbUpdates.pickupData = updates.pickup;
  
  const data = await db.update(orders)
    .set(dbUpdates)
    .where(eq(orders.ref, ref))
    .returning();
    
  return transformDBOrderToLegacy(data[0]);
}

/**
 * Get expired unpaid orders (for cron job)
 */
export async function getExpiredUnpaidOrders(expiryHours: number = 24): Promise<any[]> {
  const expiryDate = new Date(Date.now() - expiryHours * 60 * 60 * 1000);
  
  const data = await db.select()
    .from(orders)
    .where(and(
      inArray(orders.status, ['PENDING', 'WAITING_PAYMENT', 'AWAITING_PAYMENT', 'UNPAID', 'DRAFT']),
      lt(orders.createdAt, expiryDate)
    ));
  
  return (data || []).map(transformDBOrderToLegacy);
}

/**
 * Get shop config
 */
export async function getShopConfig(): Promise<any | null> {
  return getJson('config/shop-settings.json');
}

/**
 * Update shop config
 */
export async function updateShopConfig(configData: any): Promise<void> {
  return putJson('config/shop-settings.json', configData);
}

export { getRedisClient } from './redis';

/**
 * Sync the isOpen status directly to Upstash Redis cache key 'is_order_open'.
 */
export async function syncShopOpenStatusToRedis(isOpen: boolean): Promise<boolean> {
  try {
    const redis = getRedisClient();
    if (!redis) {
      console.warn('[Redis] Cannot sync status: Redis client not configured');
      return false;
    }
    await redis.set('is_order_open', isOpen);
    console.log(`[Redis] Synced is_order_open to ${isOpen}`);
    return true;
  } catch (error) {
    console.error('[Redis] Failed to sync status to Redis:', error);
    return false;
  }
}

/**
 * Consistent helper to update shop open status in S3/Postgres first,
 * and then synchronize that update to the Redis cache.
 */
export async function updateShopOpenStatus(isOpen: boolean): Promise<void> {
  const currentConfig = await getShopConfig();
  const updatedConfig = {
    ...(currentConfig || {}),
    isOpen,
  };
  
  // Save updated config to Postgres/S3 (throws on failure)
  await updateShopConfig(updatedConfig);
  
  // Sync to Redis cache (fail-open: log and proceed even if Redis fails)
  try {
    await syncShopOpenStatusToRedis(isOpen);
  } catch (redisError) {
    console.error('[Redis] Failed to update Redis cache for shop status:', redisError);
  }
}


// ==================== SECURITY AUDIT ====================

/**
 * Log security event for audit trail
 */
export async function logSecurityEvent(event: {
  eventType: string;
  userEmail?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, any>;
}): Promise<void> {
  try {
    await db.insert(securityAuditLog)
      .values({
        eventType: event.eventType,
        userEmail: event.userEmail || null,
        ipAddress: event.ipAddress || null,
        userAgent: event.userAgent || null,
        details: event.details || null,
      });
  } catch (error) {
    console.error('[Security Audit] Failed to log event:', error);
  }
}

/**
 * Get security audit logs (admin only)
 */
export async function getSecurityAuditLogs(options: {
  limit?: number;
  offset?: number;
  eventType?: string;
  userEmail?: string;
} = {}): Promise<{ logs: any[]; total: number }> {
  const { limit = 100, offset = 0, eventType, userEmail } = options;
  
  const conditions = [];
  if (eventType) conditions.push(eq(securityAuditLog.eventType, eventType));
  if (userEmail) conditions.push(eq(securityAuditLog.userEmail, userEmail));
  
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  let selectQuery = db.select().from(securityAuditLog);
  let countQuery = db.select({ value: count() }).from(securityAuditLog);
  
  if (whereClause) {
    selectQuery = selectQuery.where(whereClause) as any;
    countQuery = countQuery.where(whereClause) as any;
  }
  
  const [data, totalResult] = await Promise.all([
    selectQuery
      .orderBy(desc(securityAuditLog.createdAt))
      .offset(offset)
      .limit(limit),
    countQuery,
  ]);
  
  return { logs: data || [], total: totalResult[0]?.value || 0 };
}

/**
 * Clean up old data for PDPA compliance
 */
export async function cleanupOldData(retentionDays: number = 365): Promise<{
  deletedOrders: number;
  deletedLogs: number;
  deletedAudit: number;
}> {
  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  
  const [ordersResult, logsResult, auditResult] = await Promise.all([
    db.delete(orders).where(lt(orders.createdAt, cutoffDate)).returning(),
    db.delete(userLogs).where(lt(userLogs.createdAt, cutoffDate)).returning(),
    db.delete(securityAuditLog).where(lt(securityAuditLog.createdAt, cutoffDate)).returning(),
  ]);
  
  return {
    deletedOrders: ordersResult.length,
    deletedLogs: logsResult.length,
    deletedAudit: auditResult.length,
  };
}

// ==================== SUPABASE STORAGE FOR IMAGES ====================

const STORAGE_BUCKET = 'images';

/**
 * Upload image to Supabase Storage
 * Returns public URL that never expires
 */
export async function uploadImageToStorage(
  buffer: Buffer,
  filename: string,
  contentType: string
): Promise<{ url: string; path: string }> {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const ext = filename.split('.').pop()?.toLowerCase() || 'png';
  const uniqueName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
  const path = `${yearMonth}/${uniqueName}`;
  
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, buffer, {
      contentType,
      cacheControl: '31536000',
      upsert: false,
    });
  
  if (error) {
    console.error('[Supabase Storage] Upload error:', error);
    throw new Error(`Failed to upload image: ${error.message}`);
  }
  
  const { data: urlData } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(path);
  
  return {
    url: urlData.publicUrl,
    path: data.path,
  };
}

/**
 * Delete image from Supabase Storage
 */
export async function deleteImageFromStorage(path: string): Promise<boolean> {
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .remove([path]);
  
  if (error) {
    console.error('[Supabase Storage] Delete error:', error);
    return false;
  }
  
  return true;
}

/**
 * Get public URL for an image path
 */
export function getImagePublicUrl(path: string): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL2 || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  return `${supabaseUrl}/storage/v1/object/public/${STORAGE_BUCKET}/${path}`;
}

/**
 * Check if URL is a Supabase Storage URL
 */
export function isSupabaseStorageUrl(url: string): boolean {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL2 || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  return url.includes(`${supabaseUrl}/storage/`) || url.includes('supabase.co/storage/');
}

// ==================== ADMIN PERMISSIONS ====================

/** DB column names → camelCase mapping */
const DB_PERM_COLUMNS = [
  'canManageShop', 'canManageSheet', 'canManageShipping', 'canManagePayment',
  'canManageProducts', 'canManageOrders', 'canManagePickup', 'canManageTracking',
  'canManageRefunds', 'canManageAnnouncement', 'canManageEvents', 'canManagePromoCodes',
  'canManageSupport', 'canSendEmail', 'canManageLiveStream',
] as const;

/** Convert DB row → AdminPermissions object */
function dbRowToPerms(row: Record<string, any>): Record<string, boolean> {
  const perms: Record<string, boolean> = {};
  for (const col of DB_PERM_COLUMNS) {
    perms[col] = Boolean(row[col]);
  }
  return perms;
}

/** Convert AdminPermissions object → DB columns */
function permsToDbRow(email: string, perms: Record<string, boolean>): Record<string, any> {
  const row: Record<string, any> = { email: email.trim().toLowerCase() };
  for (const col of DB_PERM_COLUMNS) {
    row[col] = Boolean(perms[col]);
  }
  return row;
}

/**
 * Get admin permissions from DB for a specific email
 */
export async function getAdminPermissionsFromDB(email: string): Promise<Record<string, boolean> | null> {
  try {
    const data = await db.select()
      .from(adminPermissions)
      .where(eq(adminPermissions.email, email.trim().toLowerCase()))
      .limit(1);
    return data[0] ? dbRowToPerms(data[0] as any) : null;
  } catch (error) {
    console.error('[drizzle] getAdminPermissionsFromDB error:', error);
    return null;
  }
}

/**
 * Get all admin permissions from DB
 */
export async function getAllAdminPermissionsFromDB(): Promise<Record<string, Record<string, boolean>>> {
  try {
    const data = await db.select().from(adminPermissions);
    const result: Record<string, Record<string, boolean>> = {};
    for (const row of (data || [])) {
      result[row.email] = dbRowToPerms(row as any);
    }
    return result;
  } catch (error) {
    console.error('[drizzle] getAllAdminPermissionsFromDB error:', error);
    return {};
  }
}

/**
 * Save admin permissions to DB (upsert)
 */
export async function saveAdminPermissionsToDB(
  email: string, 
  perms: Record<string, boolean>
): Promise<boolean> {
  try {
    const row = permsToDbRow(email, perms);
    const normalizedEmail = email.trim().toLowerCase();
    await db.insert(adminPermissions)
      .values({ ...row, email: normalizedEmail })
      .onConflictDoUpdate({
        target: adminPermissions.email,
        set: { ...row, updatedAt: new Date() },
      });
    return true;
  } catch (error) {
    console.error('[drizzle] saveAdminPermissionsToDB error:', error);
    return false;
  }
}

/**
 * Save all admin permissions to DB (batch upsert)
 */
export async function saveAllAdminPermissionsToDB(
  allPerms: Record<string, Record<string, boolean>>
): Promise<boolean> {
  try {
    const entries = Object.entries(allPerms);
    if (entries.length === 0) return true;
    
    await db.transaction(async (tx: any) => {
      for (const [email, perms] of entries) {
        const row = permsToDbRow(email, perms);
        const normalizedEmail = email.trim().toLowerCase();
        await tx.insert(adminPermissions)
          .values({ ...row, email: normalizedEmail })
          .onConflictDoUpdate({
            target: adminPermissions.email,
            set: { ...row, updatedAt: new Date() },
          });
      }
    });
    return true;
  } catch (error) {
    console.error('[drizzle] saveAllAdminPermissionsToDB error:', error);
    return false;
  }
}

/**
 * Delete admin permissions from DB
 */
export async function deleteAdminPermissionsFromDB(email: string): Promise<boolean> {
  try {
    await db.delete(adminPermissions)
      .where(eq(adminPermissions.email, email.trim().toLowerCase()));
    return true;
  } catch (error) {
    console.error('[drizzle] deleteAdminPermissionsFromDB error:', error);
    return false;
  }
}
