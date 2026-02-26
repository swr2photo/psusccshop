// src/lib/supabase.ts
// Database operations using Prisma ORM + Supabase Storage
// Migrated from Supabase client to Prisma for all database queries

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { prisma } from './prisma';

// ==================== CONFIGURATION ====================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
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
  if (!supabaseUrl || !supabaseServiceKey) {
    console.warn('[supabase] Missing SUPABASE_URL or SERVICE_ROLE_KEY');
    return null;
  }
  _supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
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
      const emailHash = key.replace('orders/index/', '').replace('.json', '');
      const data = await prisma.order.findMany({
        where: { email_hash: emailHash },
        orderBy: { created_at: 'desc' },
        take: 500,
      });
      return (data?.map(transformDBOrderToLegacy) || []) as T;
    }
    
    if (key.startsWith('orders/')) {
      const ref = key.split('/').pop()?.replace('.json', '');
      if (!ref) return null;
      const data = await prisma.order.findUnique({ where: { ref } });
      return data ? (transformDBOrderToLegacy(data) as T) : null;
    }
    
    if (key.startsWith('config/')) {
      const configKey = key.replace('config/', '').replace('.json', '');
      const data = await prisma.config.findUnique({ where: { key: configKey } });
      return (data?.value as T) || null;
    }
    
    if (key.startsWith('carts/')) {
      const emailHash = key.replace('carts/', '').replace('.json', '');
      const data = await prisma.cart.findUnique({ where: { email_hash: emailHash } });
      return (data?.cart_data as T) || null;
    }
    
    if (key.startsWith('users/')) {
      const emailHash = key.replace('users/', '').replace('.json', '');
      const data = await prisma.profile.findUnique({ where: { email_hash: emailHash } });
      return data ? (transformDBProfileToLegacy(data) as T) : null;
    }
    
    if (key.startsWith('email-logs/')) {
      const logId = key.replace('email-logs/', '').replace('.json', '');
      const data = await prisma.emailLog.findUnique({ where: { id: logId } });
      return data ? (transformDBEmailLogToLegacy(data) as T) : null;
    }
    
    if (key.startsWith('user-logs/')) {
      const logId = key.replace('user-logs/', '').replace('.json', '');
      const data = await prisma.userLog.findUnique({ where: { id: logId } });
      return data ? (transformDBUserLogToLegacy(data) as T) : null;
    }
    
    if (key.startsWith('data-requests/')) {
      const requestId = key.replace('data-requests/', '').replace('.json', '');
      const data = await prisma.dataRequest.findUnique({ where: { id: requestId } });
      return (data as T) || null;
    }
    
    // Generic key-value fallback
    const data = await prisma.keyValueStore.findUnique({ where: { key } });
    return (data?.value as T) || null;
    
  } catch (error: any) {
    console.error('[prisma] getJson error', key, error);
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
      const ref = key.split('/').pop()?.replace('.json', '');
      if (!ref) throw new Error('Invalid order key');
      const dbOrder = transformLegacyToDBOrder(data);
      await prisma.order.upsert({
        where: { ref },
        update: dbOrder,
        create: { ...dbOrder, ref },
      });
      return;
    }
    
    if (key.startsWith('config/')) {
      const configKey = key.replace('config/', '').replace('.json', '');
      await prisma.config.upsert({
        where: { key: configKey },
        update: { value: data },
        create: { key: configKey, value: data },
      });
      return;
    }
    
    if (key.startsWith('carts/')) {
      const emailHash = key.replace('carts/', '').replace('.json', '');
      await prisma.cart.upsert({
        where: { email_hash: emailHash },
        update: { cart_data: data },
        create: { email_hash: emailHash, cart_data: data },
      });
      return;
    }
    
    if (key.startsWith('users/')) {
      const emailHash = key.replace('users/', '').replace('.json', '');
      const dbProfile = transformLegacyToDBProfile(emailHash, data);
      await prisma.profile.upsert({
        where: { email_hash: emailHash },
        update: dbProfile,
        create: dbProfile,
      });
      return;
    }
    
    if (key.startsWith('email-logs/')) {
      const dbLog = transformLegacyToDBEmailLog(data);
      await prisma.emailLog.upsert({
        where: { id: dbLog.id },
        update: dbLog,
        create: dbLog,
      });
      return;
    }
    
    if (key.startsWith('user-logs/')) {
      const dbLog = transformLegacyToDBUserLog(data);
      await prisma.userLog.create({ data: dbLog });
      return;
    }
    
    if (key.startsWith('data-requests/')) {
      await prisma.dataRequest.upsert({
        where: { id: data.id },
        update: data,
        create: data,
      });
      return;
    }
    
    // Generic key-value fallback
    await prisma.keyValueStore.upsert({
      where: { key },
      update: { value: data },
      create: { key, value: data },
    });
    
  } catch (error: any) {
    console.error('[prisma] putJson error', key, error);
    throw error;
  }
}

/**
 * List keys with prefix (simulates S3 listKeys)
 */
export async function listKeys(prefix: string): Promise<string[]> {
  try {
    if (prefix.startsWith('orders/') && !prefix.includes('index')) {
      const data = await prisma.order.findMany({
        select: { ref: true, created_at: true },
        orderBy: { created_at: 'desc' },
      });
      return (data || []).map(order => {
        const date = new Date(order.created_at);
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        return `orders/${yyyy}-${mm}/${order.ref}.json`;
      });
    }
    
    if (prefix.startsWith('email-logs/')) {
      const data = await prisma.emailLog.findMany({
        select: { id: true },
        orderBy: { created_at: 'desc' },
      });
      return (data || []).map(log => `email-logs/${log.id}.json`);
    }
    
    if (prefix.startsWith('user-logs/')) {
      const data = await prisma.userLog.findMany({
        select: { id: true },
        orderBy: { created_at: 'desc' },
      });
      return (data || []).map(log => `user-logs/${log.id}.json`);
    }
    
    if (prefix.startsWith('data-requests/')) {
      const data = await prisma.dataRequest.findMany({
        select: { id: true },
        orderBy: { created_at: 'desc' },
      });
      return (data || []).map(req => `data-requests/${req.id}.json`);
    }
    
    // Generic key-value store fallback
    const data = await prisma.keyValueStore.findMany({
      where: { key: { startsWith: prefix } },
      select: { key: true },
    });
    return (data || []).map(item => item.key);
    
  } catch (error: any) {
    console.error('[prisma] listKeys error', prefix, error);
    throw error;
  }
}

/**
 * Delete an object
 */
export async function deleteObject(key: string): Promise<void> {
  try {
    if (key.startsWith('orders/')) {
      const ref = key.split('/').pop()?.replace('.json', '');
      if (!ref) return;
      await prisma.order.delete({ where: { ref } }).catch(() => {});
      return;
    }
    
    if (key.startsWith('carts/')) {
      const emailHash = key.replace('carts/', '').replace('.json', '');
      await prisma.cart.delete({ where: { email_hash: emailHash } }).catch(() => {});
      return;
    }
    
    if (key.startsWith('users/')) {
      const emailHash = key.replace('users/', '').replace('.json', '');
      await prisma.profile.delete({ where: { email_hash: emailHash } }).catch(() => {});
      return;
    }
    
    // Generic key-value store fallback
    await prisma.keyValueStore.delete({ where: { key } }).catch(() => {});
    
  } catch (error: any) {
    console.error('[prisma] deleteObject error', key, error);
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
    date: dbOrder.date || dbOrder.created_at,
    status: dbOrder.status,
    customerName: dbOrder.customer_name,
    customerEmail: dbOrder.customer_email,
    customerPhone: dbOrder.customer_phone,
    customerAddress: dbOrder.customer_address,
    customerInstagram: dbOrder.customer_instagram,
    cart: dbOrder.cart || [],
    totalAmount: dbOrder.total_amount,
    amount: dbOrder.total_amount,
    notes: dbOrder.notes,
    slip: dbOrder.slip_data,
    slipData: dbOrder.slip_data,
    paymentVerifiedAt: dbOrder.payment_verified_at,
    paymentMethod: dbOrder.payment_method,
    shippingOption: dbOrder.shipping_option,
    trackingNumber: dbOrder.tracking_number,
    shippingProvider: dbOrder.shipping_provider,
    trackingStatus: dbOrder.tracking_status,
    trackingLastChecked: dbOrder.tracking_last_checked,
    shippedAt: dbOrder.shipped_at,
    receivedAt: dbOrder.received_at,
    refundStatus: dbOrder.refund_status,
    refundReason: dbOrder.refund_reason,
    refundDetails: dbOrder.refund_details,
    refundBankName: dbOrder.refund_bank_name,
    refundBankAccount: dbOrder.refund_bank_account,
    refundAccountName: dbOrder.refund_account_name,
    refundAmount: dbOrder.refund_amount,
    refundRequestedAt: dbOrder.refund_requested_at,
    refundReviewedAt: dbOrder.refund_reviewed_at,
    refundReviewedBy: dbOrder.refund_reviewed_by,
    refundAdminNote: dbOrder.refund_admin_note,
    shopId: dbOrder.shop_id || null,
    shopSlug: dbOrder.shop_slug || null,
    createdAt: dbOrder.created_at,
    updatedAt: dbOrder.updated_at,
    _key: `orders/${new Date(dbOrder.created_at).getFullYear()}-${String(new Date(dbOrder.created_at).getMonth() + 1).padStart(2, '0')}/${dbOrder.ref}.json`,
  };
}

function transformLegacyToDBOrder(legacyOrder: any): any {
  const email = legacyOrder.customerEmail || legacyOrder.email || '';
  const shippingOpt = legacyOrder.shippingOption || legacyOrder.shippingOptionId || null;
  
  return {
    ref: legacyOrder.ref,
    date: legacyOrder.date,
    status: legacyOrder.status || 'WAITING_PAYMENT',
    customer_name: legacyOrder.customerName || legacyOrder.name || '',
    customer_email: email,
    email_hash: emailHash(email),
    customer_phone: legacyOrder.customerPhone || legacyOrder.phone || '',
    customer_address: legacyOrder.customerAddress || legacyOrder.address || '',
    customer_instagram: legacyOrder.customerInstagram || legacyOrder.instagram || null,
    cart: legacyOrder.cart || [],
    total_amount: legacyOrder.totalAmount || legacyOrder.amount || 0,
    notes: legacyOrder.notes || null,
    slip_data: legacyOrder.slip || legacyOrder.slipData || null,
    payment_verified_at: legacyOrder.paymentVerifiedAt || legacyOrder.verifiedAt || null,
    payment_method: legacyOrder.paymentMethod || null,
    shipping_option: shippingOpt,
    tracking_number: legacyOrder.trackingNumber || null,
    shipping_provider: legacyOrder.shippingProvider || null,
    tracking_status: legacyOrder.trackingStatus || null,
    tracking_last_checked: legacyOrder.trackingLastChecked || null,
    shipped_at: legacyOrder.shippedAt || null,
    received_at: legacyOrder.receivedAt || null,
    ...(legacyOrder.shopId ? { shop_id: legacyOrder.shopId } : {}),
    ...(legacyOrder.shopSlug ? { shop_slug: legacyOrder.shopSlug } : {}),
    updated_at: new Date(),
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
    email_hash: hash,
    name: data.name || '',
    phone: data.phone || '',
    address: data.address || '',
    instagram: data.instagram || null,
  };
}

function transformDBEmailLogToLegacy(dbLog: any): any {
  return {
    id: dbLog.id,
    orderRef: dbLog.order_ref,
    to: dbLog.to_email,
    from: dbLog.from_email,
    subject: dbLog.subject,
    body: dbLog.body,
    type: dbLog.email_type,
    status: dbLog.status,
    sentAt: dbLog.sent_at,
    error: dbLog.error,
    timestamp: dbLog.created_at,
  };
}

function transformLegacyToDBEmailLog(data: any): any {
  const id = data.id || `email-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  return {
    id,
    order_ref: data.orderRef || null,
    to_email: data.to || '',
    from_email: data.from || '',
    subject: data.subject || '',
    body: data.body || '',
    email_type: data.type || 'custom',
    status: data.status || 'pending',
    sent_at: data.sentAt || null,
    error: data.error || null,
    created_at: data.timestamp ? new Date(data.timestamp) : new Date(),
  };
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
    userAgent: dbLog.user_agent,
    timestamp: dbLog.created_at,
  };
}

function transformLegacyToDBUserLog(data: any): any {
  return {
    id: data.id,
    email: data.email || '',
    name: data.name || null,
    action: data.action || '',
    details: data.details || null,
    metadata: data.metadata || null,
    ip: data.ip || null,
    user_agent: data.userAgent || null,
    created_at: data.timestamp ? new Date(data.timestamp) : new Date(),
  };
}

// ==================== DIRECT DATABASE QUERIES ====================

/**
 * Get orders by email with pagination (optimized for Prisma)
 */
export async function getOrdersByEmail(
  email: string, 
  options: { limit?: number; offset?: number; status?: string[]; shopSlug?: string } = {}
): Promise<{ orders: any[]; total: number }> {
  const { limit = 50, offset = 0, status, shopSlug } = options;
  const hash = emailHash(email);
  
  const where: any = { email_hash: hash };
  if (status && status.length > 0) where.status = { in: status };
  if (shopSlug) where.shop_slug = shopSlug;
  
  const [data, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: offset,
      take: limit,
    }),
    prisma.order.count({ where }),
  ]);
  
  return {
    orders: (data || []).map(transformDBOrderToLegacy),
    total,
  };
}

/**
 * Get all orders (admin) with pagination
 */
export async function getAllOrders(
  options: { limit?: number; offset?: number; status?: string[]; search?: string } = {}
): Promise<{ orders: any[]; total: number }> {
  const { limit = 100, offset = 0, status, search } = options;
  
  const where: any = {};
  if (status && status.length > 0) where.status = { in: status };
  if (search) {
    where.OR = [
      { ref: { contains: search, mode: 'insensitive' } },
      { customer_name: { contains: search, mode: 'insensitive' } },
      { customer_email: { contains: search, mode: 'insensitive' } },
    ];
  }
  
  const [data, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: offset,
      take: limit,
    }),
    prisma.order.count({ where }),
  ]);
  
  return {
    orders: (data || []).map(transformDBOrderToLegacy),
    total,
  };
}

/**
 * Get order by ref
 */
export async function getOrderByRef(ref: string): Promise<any | null> {
  const data = await prisma.order.findUnique({ where: { ref } });
  return data ? transformDBOrderToLegacy(data) : null;
}

/**
 * Update order by ref
 */
export async function updateOrderByRef(ref: string, updates: Partial<any>): Promise<any> {
  const dbUpdates: any = { updated_at: new Date() };
  
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.customerName !== undefined) dbUpdates.customer_name = updates.customerName;
  if (updates.customerPhone !== undefined) dbUpdates.customer_phone = updates.customerPhone;
  if (updates.customerAddress !== undefined) dbUpdates.customer_address = updates.customerAddress;
  if (updates.customerInstagram !== undefined) dbUpdates.customer_instagram = updates.customerInstagram;
  if (updates.cart !== undefined) dbUpdates.cart = updates.cart;
  if (updates.totalAmount !== undefined) dbUpdates.total_amount = updates.totalAmount;
  if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
  if (updates.slipData !== undefined) dbUpdates.slip_data = updates.slipData;
  if (updates.paymentVerifiedAt !== undefined) dbUpdates.payment_verified_at = updates.paymentVerifiedAt;
  if (updates.paymentMethod !== undefined) dbUpdates.payment_method = updates.paymentMethod;
  if (updates.shippingOption !== undefined) dbUpdates.shipping_option = updates.shippingOption;
  if (updates.shippingOptionId !== undefined) dbUpdates.shipping_option = updates.shippingOptionId;
  if (updates.trackingNumber !== undefined) dbUpdates.tracking_number = updates.trackingNumber;
  if (updates.shippingProvider !== undefined) dbUpdates.shipping_provider = updates.shippingProvider;
  if (updates.trackingStatus !== undefined) dbUpdates.tracking_status = updates.trackingStatus;
  if (updates.trackingLastChecked !== undefined) dbUpdates.tracking_last_checked = updates.trackingLastChecked;
  if (updates.shippedAt !== undefined) dbUpdates.shipped_at = updates.shippedAt;
  if (updates.receivedAt !== undefined) dbUpdates.received_at = updates.receivedAt;
  if (updates.refundStatus !== undefined) dbUpdates.refund_status = updates.refundStatus;
  if (updates.refundReason !== undefined) dbUpdates.refund_reason = updates.refundReason;
  if (updates.refundDetails !== undefined) dbUpdates.refund_details = updates.refundDetails;
  if (updates.refundBankName !== undefined) dbUpdates.refund_bank_name = updates.refundBankName;
  if (updates.refundBankAccount !== undefined) dbUpdates.refund_bank_account = updates.refundBankAccount;
  if (updates.refundAccountName !== undefined) dbUpdates.refund_account_name = updates.refundAccountName;
  if (updates.refundAmount !== undefined) dbUpdates.refund_amount = updates.refundAmount;
  if (updates.refundRequestedAt !== undefined) dbUpdates.refund_requested_at = updates.refundRequestedAt;
  if (updates.refundReviewedAt !== undefined) dbUpdates.refund_reviewed_at = updates.refundReviewedAt;
  if (updates.refundReviewedBy !== undefined) dbUpdates.refund_reviewed_by = updates.refundReviewedBy;
  if (updates.refundAdminNote !== undefined) dbUpdates.refund_admin_note = updates.refundAdminNote;
  
  const data = await prisma.order.update({
    where: { ref },
    data: dbUpdates,
  });
  
  return transformDBOrderToLegacy(data);
}

/**
 * Get expired unpaid orders (for cron job)
 */
export async function getExpiredUnpaidOrders(expiryHours: number = 24): Promise<any[]> {
  const expiryDate = new Date(Date.now() - expiryHours * 60 * 60 * 1000);
  
  const data = await prisma.order.findMany({
    where: {
      status: { in: ['PENDING', 'WAITING_PAYMENT', 'AWAITING_PAYMENT', 'UNPAID', 'DRAFT'] },
      created_at: { lt: expiryDate },
    },
  });
  
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
export async function updateShopConfig(config: any): Promise<void> {
  return putJson('config/shop-settings.json', config);
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
    await prisma.securityAuditLog.create({
      data: {
        event_type: event.eventType,
        user_email: event.userEmail,
        ip_address: event.ipAddress,
        user_agent: event.userAgent,
        details: event.details,
      },
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
  
  const where: any = {};
  if (eventType) where.event_type = eventType;
  if (userEmail) where.user_email = userEmail;
  
  const [data, total] = await Promise.all([
    prisma.securityAuditLog.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: offset,
      take: limit,
    }),
    prisma.securityAuditLog.count({ where }),
  ]);
  
  return { logs: data || [], total };
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
  
  const [deletedOrders, deletedLogs, deletedAudit] = await Promise.all([
    prisma.order.deleteMany({ where: { created_at: { lt: cutoffDate } } }),
    prisma.userLog.deleteMany({ where: { created_at: { lt: cutoffDate } } }),
    prisma.securityAuditLog.deleteMany({ where: { created_at: { lt: cutoffDate } } }),
  ]);
  
  return {
    deletedOrders: deletedOrders.count,
    deletedLogs: deletedLogs.count,
    deletedAudit: deletedAudit.count,
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
  const db = getSupabaseAdmin();
  if (!db) throw new Error('Database not available');
  
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const ext = filename.split('.').pop()?.toLowerCase() || 'png';
  const uniqueName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
  const path = `${yearMonth}/${uniqueName}`;
  
  const { data, error } = await db.storage
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
  
  const { data: urlData } = db.storage
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
  const db = getSupabaseAdmin();
  if (!db) return false;
  
  const { error } = await db.storage
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
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  return `${supabaseUrl}/storage/v1/object/public/${STORAGE_BUCKET}/${path}`;
}

/**
 * Check if URL is a Supabase Storage URL
 */
export function isSupabaseStorageUrl(url: string): boolean {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  return url.includes(`${supabaseUrl}/storage/`) || url.includes('supabase.co/storage/');
}

// ==================== ADMIN PERMISSIONS ====================

/** DB column names → camelCase mapping */
const DB_PERM_COLUMNS = [
  'can_manage_shop', 'can_manage_sheet', 'can_manage_shipping', 'can_manage_payment',
  'can_manage_products', 'can_manage_orders', 'can_manage_pickup', 'can_manage_tracking',
  'can_manage_refunds', 'can_manage_announcement', 'can_manage_events', 'can_manage_promo_codes',
  'can_manage_support', 'can_send_email', 'can_manage_live_stream',
] as const;

function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function camelToSnake(s: string): string {
  return s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

/** Convert DB row → AdminPermissions object */
function dbRowToPerms(row: Record<string, any>): Record<string, boolean> {
  const perms: Record<string, boolean> = {};
  for (const col of DB_PERM_COLUMNS) {
    perms[snakeToCamel(col)] = Boolean(row[col]);
  }
  return perms;
}

/** Convert AdminPermissions object → DB columns */
function permsToDbRow(email: string, perms: Record<string, boolean>): Record<string, any> {
  const row: Record<string, any> = { email: email.trim().toLowerCase() };
  for (const [key, value] of Object.entries(perms)) {
    const col = camelToSnake(key);
    if (DB_PERM_COLUMNS.includes(col as any)) {
      row[col] = Boolean(value);
    }
  }
  return row;
}

/**
 * Get admin permissions from DB for a specific email
 */
export async function getAdminPermissionsFromDB(email: string): Promise<Record<string, boolean> | null> {
  try {
    const data = await prisma.adminPermission.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    return data ? dbRowToPerms(data as any) : null;
  } catch (error) {
    console.error('[prisma] getAdminPermissionsFromDB error:', error);
    return null;
  }
}

/**
 * Get all admin permissions from DB
 */
export async function getAllAdminPermissionsFromDB(): Promise<Record<string, Record<string, boolean>>> {
  try {
    const data = await prisma.adminPermission.findMany();
    const result: Record<string, Record<string, boolean>> = {};
    for (const row of (data || [])) {
      result[row.email] = dbRowToPerms(row as any);
    }
    return result;
  } catch (error) {
    console.error('[prisma] getAllAdminPermissionsFromDB error:', error);
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
    await prisma.adminPermission.upsert({
      where: { email: normalizedEmail },
      update: row,
      create: row as any,
    });
    return true;
  } catch (error) {
    console.error('[prisma] saveAdminPermissionsToDB error:', error);
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
    
    // Use transaction for batch operations
    await prisma.$transaction(
      entries.map(([email, perms]) => {
        const row = permsToDbRow(email, perms);
        const normalizedEmail = email.trim().toLowerCase();
        return prisma.adminPermission.upsert({
          where: { email: normalizedEmail },
          update: row,
          create: row as any,
        });
      })
    );
    return true;
  } catch (error) {
    console.error('[prisma] saveAllAdminPermissionsToDB error:', error);
    return false;
  }
}

/**
 * Delete admin permissions from DB
 */
export async function deleteAdminPermissionsFromDB(email: string): Promise<boolean> {
  try {
    await prisma.adminPermission.delete({
      where: { email: email.trim().toLowerCase() },
    }).catch(() => {});
    return true;
  } catch (error) {
    console.error('[prisma] deleteAdminPermissionsFromDB error:', error);
    return false;
  }
}
