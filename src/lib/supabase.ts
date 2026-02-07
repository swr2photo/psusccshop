// src/lib/supabase.ts
// Supabase client configuration and helper functions

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ==================== CONFIGURATION ====================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl) {
  console.warn('[supabase] NEXT_PUBLIC_SUPABASE_URL is not set');
}

// ==================== SECURITY CHECK ====================
// ตรวจสอบว่า service key ไม่ถูก expose ใน client-side
if (typeof window !== 'undefined' && supabaseServiceKey) {
  console.error('[SECURITY] SUPABASE_SERVICE_ROLE_KEY should NEVER be exposed to client-side!');
}

// ==================== CLIENTS ====================

// Public client (for client-side, uses anon key with RLS)
// ใช้เฉพาะสำหรับ read public config เท่านั้น
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Admin client (for server-side ONLY, bypasses RLS)
// ห้ามใช้ใน client components!
let _supabaseAdmin: SupabaseClient | null = null;
export const getSupabaseAdmin = () => {
  // ป้องกันการเรียกใช้จาก client-side
  if (typeof window !== 'undefined') {
    console.error('[SECURITY] getSupabaseAdmin() should NEVER be called from client-side!');
    throw new Error('Server-only function called from client');
  }
  
  if (!_supabaseAdmin && supabaseServiceKey) {
    // Validate service key format (should be JWT)
    if (!supabaseServiceKey.startsWith('eyJ')) {
      console.error('[supabase] Invalid SUPABASE_SERVICE_ROLE_KEY format. Should be a JWT token starting with "eyJ"');
      console.error('[supabase] Get the correct key from: https://supabase.com/dashboard/project/YOUR_PROJECT/settings/api');
      return null;
    }
    
    _supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  
  if (!_supabaseAdmin) {
    console.warn('[supabase] Admin client not available. SUPABASE_SERVICE_ROLE_KEY may not be set.');
  }
  
  return _supabaseAdmin;
};

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
  const db = getSupabaseAdmin();
  if (!db) throw new Error('Database not available');
  
  try {
    // Route based on key pattern
    if (key.startsWith('orders/index/')) {
      // Order index by email hash
      const emailHash = key.replace('orders/index/', '').replace('.json', '');
      const { data, error } = await db
        .from('orders')
        .select('*')
        .eq('email_hash', emailHash)
        .order('created_at', { ascending: false })
        .limit(500);
      
      if (error) throw error;
      return (data?.map(transformDBOrderToLegacy) || []) as T;
    }
    
    if (key.startsWith('orders/')) {
      // Single order by key (orders/YYYY-MM/REF.json)
      const ref = key.split('/').pop()?.replace('.json', '');
      if (!ref) return null;
      
      const { data, error } = await db
        .from('orders')
        .select('*')
        .eq('ref', ref)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data ? (transformDBOrderToLegacy(data) as T) : null;
    }
    
    if (key.startsWith('config/')) {
      // Config storage
      const configKey = key.replace('config/', '').replace('.json', '');
      const { data, error } = await db
        .from('config')
        .select('value')
        .eq('key', configKey)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data?.value as T || null;
    }
    
    if (key.startsWith('carts/')) {
      // Cart by email hash
      const emailHash = key.replace('carts/', '').replace('.json', '');
      const { data, error } = await db
        .from('carts')
        .select('cart_data')
        .eq('email_hash', emailHash)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data?.cart_data as T || null;
    }
    
    if (key.startsWith('users/')) {
      // Profile by email hash
      const emailHash = key.replace('users/', '').replace('.json', '');
      const { data, error } = await db
        .from('profiles')
        .select('*')
        .eq('email_hash', emailHash)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data ? (transformDBProfileToLegacy(data) as T) : null;
    }
    
    if (key.startsWith('email-logs/')) {
      // Email log by ID
      const logId = key.replace('email-logs/', '').replace('.json', '');
      const { data, error } = await db
        .from('email_logs')
        .select('*')
        .eq('id', logId)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data ? (transformDBEmailLogToLegacy(data) as T) : null;
    }
    
    if (key.startsWith('user-logs/')) {
      // User log by ID
      const logId = key.replace('user-logs/', '').replace('.json', '');
      const { data, error } = await db
        .from('user_logs')
        .select('*')
        .eq('id', logId)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data ? (transformDBUserLogToLegacy(data) as T) : null;
    }
    
    if (key.startsWith('data-requests/')) {
      // Data request by ID
      const requestId = key.replace('data-requests/', '').replace('.json', '');
      const { data, error } = await db
        .from('data_requests')
        .select('*')
        .eq('id', requestId)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data as T || null;
    }
    
    // Generic key-value fallback
    const { data, error } = await db
      .from('key_value_store')
      .select('value')
      .eq('key', key)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data?.value as T || null;
    
  } catch (error: any) {
    console.error('[supabase] getJson error', key, error);
    throw error;
  }
}

/**
 * Store JSON data
 */
export async function putJson(key: string, data: any): Promise<void> {
  const db = getSupabaseAdmin();
  if (!db) throw new Error('Database not available');
  
  try {
    // Route based on key pattern
    if (key.startsWith('orders/index/')) {
      // Order indexes are maintained automatically via triggers
      // No need to update manually
      return;
    }
    
    if (key.startsWith('orders/')) {
      // Single order
      const ref = key.split('/').pop()?.replace('.json', '');
      if (!ref) throw new Error('Invalid order key');
      
      const dbOrder = transformLegacyToDBOrder(data);
      
      // Check if order already exists
      const { data: existing } = await db
        .from('orders')
        .select('ref')
        .eq('ref', ref)
        .single();
      
      if (existing) {
        // Update existing order - only update provided fields
        const { error } = await db
          .from('orders')
          .update(dbOrder)
          .eq('ref', ref);
        
        if (error) throw error;
      } else {
        // Insert new order
        const { error } = await db
          .from('orders')
          .insert(dbOrder);
        
        if (error) throw error;
      }
      return;
    }
    
    if (key.startsWith('config/')) {
      const configKey = key.replace('config/', '').replace('.json', '');
      const { error } = await db
        .from('config')
        .upsert({ 
          key: configKey, 
          value: data,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
      
      if (error) throw error;
      return;
    }
    
    if (key.startsWith('carts/')) {
      const emailHash = key.replace('carts/', '').replace('.json', '');
      const { error } = await db
        .from('carts')
        .upsert({ 
          email_hash: emailHash, 
          cart_data: data,
          updated_at: new Date().toISOString()
        }, { onConflict: 'email_hash' });
      
      if (error) throw error;
      return;
    }
    
    if (key.startsWith('users/')) {
      const emailHash = key.replace('users/', '').replace('.json', '');
      const dbProfile = transformLegacyToDBProfile(emailHash, data);
      const { error } = await db
        .from('profiles')
        .upsert(dbProfile, { onConflict: 'email_hash' });
      
      if (error) throw error;
      return;
    }
    
    if (key.startsWith('email-logs/')) {
      const dbLog = transformLegacyToDBEmailLog(data);
      const { error } = await db
        .from('email_logs')
        .upsert(dbLog, { onConflict: 'id' });
      
      if (error) throw error;
      return;
    }
    
    if (key.startsWith('user-logs/')) {
      const dbLog = transformLegacyToDBUserLog(data);
      const { error } = await db
        .from('user_logs')
        .insert(dbLog);
      
      if (error) throw error;
      return;
    }
    
    if (key.startsWith('data-requests/')) {
      const { error } = await db
        .from('data_requests')
        .upsert(data, { onConflict: 'id' });
      
      if (error) throw error;
      return;
    }
    
    // Generic key-value fallback
    const { error } = await db
      .from('key_value_store')
      .upsert({ 
        key, 
        value: data,
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' });
    
    if (error) throw error;
    
  } catch (error: any) {
    console.error('[supabase] putJson error', key, error);
    throw error;
  }
}

/**
 * List keys with prefix (simulates S3 listKeys)
 */
export async function listKeys(prefix: string): Promise<string[]> {
  const db = getSupabaseAdmin();
  if (!db) throw new Error('Database not available');
  
  try {
    if (prefix.startsWith('orders/') && !prefix.includes('index')) {
      // List all order keys
      const { data, error } = await db
        .from('orders')
        .select('ref, created_at')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Convert to file-like keys
      return (data || []).map(order => {
        const date = new Date(order.created_at);
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        return `orders/${yyyy}-${mm}/${order.ref}.json`;
      });
    }
    
    if (prefix.startsWith('email-logs/')) {
      const { data, error } = await db
        .from('email_logs')
        .select('id')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []).map(log => `email-logs/${log.id}.json`);
    }
    
    if (prefix.startsWith('user-logs/')) {
      const { data, error } = await db
        .from('user_logs')
        .select('id')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []).map(log => `user-logs/${log.id}.json`);
    }
    
    if (prefix.startsWith('data-requests/')) {
      const { data, error } = await db
        .from('data_requests')
        .select('id')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []).map(req => `data-requests/${req.id}.json`);
    }
    
    // Generic key-value store fallback
    const { data, error } = await db
      .from('key_value_store')
      .select('key')
      .like('key', `${prefix}%`);
    
    if (error) throw error;
    return (data || []).map(item => item.key);
    
  } catch (error: any) {
    console.error('[supabase] listKeys error', prefix, error);
    throw error;
  }
}

/**
 * Delete an object
 */
export async function deleteObject(key: string): Promise<void> {
  const db = getSupabaseAdmin();
  if (!db) throw new Error('Database not available');
  
  try {
    if (key.startsWith('orders/')) {
      const ref = key.split('/').pop()?.replace('.json', '');
      if (!ref) return;
      
      const { error } = await db
        .from('orders')
        .delete()
        .eq('ref', ref);
      
      if (error) throw error;
      return;
    }
    
    if (key.startsWith('carts/')) {
      const emailHash = key.replace('carts/', '').replace('.json', '');
      const { error } = await db
        .from('carts')
        .delete()
        .eq('email_hash', emailHash);
      
      if (error) throw error;
      return;
    }
    
    if (key.startsWith('users/')) {
      const emailHash = key.replace('users/', '').replace('.json', '');
      const { error } = await db
        .from('profiles')
        .delete()
        .eq('email_hash', emailHash);
      
      if (error) throw error;
      return;
    }
    
    // Generic key-value store fallback
    const { error } = await db
      .from('key_value_store')
      .delete()
      .eq('key', key);
    
    if (error) throw error;
    
  } catch (error: any) {
    console.error('[supabase] deleteObject error', key, error);
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
    // Map slip_data to both 'slip' and 'slipData' for backward compatibility
    slip: dbOrder.slip_data,
    slipData: dbOrder.slip_data,
    paymentVerifiedAt: dbOrder.payment_verified_at,
    paymentMethod: dbOrder.payment_method,
    // Shipping option (pickup, delivery, etc.)
    shippingOption: dbOrder.shipping_option,
    // Tracking fields
    trackingNumber: dbOrder.tracking_number,
    shippingProvider: dbOrder.shipping_provider,
    trackingStatus: dbOrder.tracking_status,
    trackingLastChecked: dbOrder.tracking_last_checked,
    shippedAt: dbOrder.shipped_at,
    receivedAt: dbOrder.received_at,
    // Refund fields
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
    // Support both 'slip' (from payment verify) and 'slipData' fields
    slip_data: legacyOrder.slip || legacyOrder.slipData || null,
    payment_verified_at: legacyOrder.paymentVerifiedAt || legacyOrder.verifiedAt || null,
    payment_method: legacyOrder.paymentMethod || null,
    // Shipping option (support both shippingOption and shippingOptionId from frontend)
    shipping_option: shippingOpt,
    // Tracking fields
    tracking_number: legacyOrder.trackingNumber || null,
    shipping_provider: legacyOrder.shippingProvider || null,
    tracking_status: legacyOrder.trackingStatus || null,
    tracking_last_checked: legacyOrder.trackingLastChecked || null,
    shipped_at: legacyOrder.shippedAt || null,
    received_at: legacyOrder.receivedAt || null,
    updated_at: new Date().toISOString(),
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
    updated_at: new Date().toISOString(),
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
  // Ensure id is always present - generate one if missing
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
    created_at: data.timestamp || new Date().toISOString(),
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
    created_at: data.timestamp || new Date().toISOString(),
  };
}

// ==================== DIRECT DATABASE QUERIES ====================

/**
 * Get orders by email with pagination (optimized for Supabase)
 */
export async function getOrdersByEmail(
  email: string, 
  options: { limit?: number; offset?: number; status?: string[] } = {}
): Promise<{ orders: any[]; total: number }> {
  const db = getSupabaseAdmin();
  if (!db) throw new Error('Database not available');
  const { limit = 50, offset = 0, status } = options;
  const hash = emailHash(email);
  
  let query = db
    .from('orders')
    .select('*', { count: 'exact' })
    .eq('email_hash', hash)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  
  if (status && status.length > 0) {
    query = query.in('status', status);
  }
  
  const { data, error, count } = await query;
  
  if (error) throw error;
  
  return {
    orders: (data || []).map(transformDBOrderToLegacy),
    total: count || 0,
  };
}

/**
 * Get all orders (admin) with pagination
 */
export async function getAllOrders(
  options: { limit?: number; offset?: number; status?: string[]; search?: string } = {}
): Promise<{ orders: any[]; total: number }> {
  const db = getSupabaseAdmin();
  if (!db) throw new Error('Database not available');
  const { limit = 100, offset = 0, status, search } = options;
  
  let query = db
    .from('orders')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  
  if (status && status.length > 0) {
    query = query.in('status', status);
  }
  
  if (search) {
    query = query.or(`ref.ilike.%${search}%,customer_name.ilike.%${search}%,customer_email.ilike.%${search}%`);
  }
  
  const { data, error, count } = await query;
  
  if (error) throw error;
  
  return {
    orders: (data || []).map(transformDBOrderToLegacy),
    total: count || 0,
  };
}

/**
 * Get order by ref
 */
export async function getOrderByRef(ref: string): Promise<any | null> {
  const db = getSupabaseAdmin();
  if (!db) throw new Error('Database not available');
  
  const { data, error } = await db
    .from('orders')
    .select('*')
    .eq('ref', ref)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data ? transformDBOrderToLegacy(data) : null;
}

/**
 * Update order by ref
 */
export async function updateOrderByRef(ref: string, updates: Partial<any>): Promise<any> {
  const db = getSupabaseAdmin();
  if (!db) throw new Error('Database not available');
  
  const dbUpdates: any = { updated_at: new Date().toISOString() };
  
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
  // Shipping option
  if (updates.shippingOption !== undefined) dbUpdates.shipping_option = updates.shippingOption;
  if (updates.shippingOptionId !== undefined) dbUpdates.shipping_option = updates.shippingOptionId;
  // Tracking fields
  if (updates.trackingNumber !== undefined) dbUpdates.tracking_number = updates.trackingNumber;
  if (updates.shippingProvider !== undefined) dbUpdates.shipping_provider = updates.shippingProvider;
  if (updates.trackingStatus !== undefined) dbUpdates.tracking_status = updates.trackingStatus;
  if (updates.trackingLastChecked !== undefined) dbUpdates.tracking_last_checked = updates.trackingLastChecked;
  if (updates.shippedAt !== undefined) dbUpdates.shipped_at = updates.shippedAt;
  if (updates.receivedAt !== undefined) dbUpdates.received_at = updates.receivedAt;
  // Refund fields
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
  
  const { data, error } = await db
    .from('orders')
    .update(dbUpdates)
    .eq('ref', ref)
    .select()
    .single();
  
  if (error) throw error;
  return transformDBOrderToLegacy(data);
}

/**
 * Get expired unpaid orders (for cron job)
 */
export async function getExpiredUnpaidOrders(expiryHours: number = 24): Promise<any[]> {
  const db = getSupabaseAdmin();
  if (!db) throw new Error('Database not available');
  const expiryDate = new Date(Date.now() - expiryHours * 60 * 60 * 1000).toISOString();
  
  const { data, error } = await db
    .from('orders')
    .select('*')
    .in('status', ['PENDING', 'WAITING_PAYMENT', 'AWAITING_PAYMENT', 'UNPAID', 'DRAFT'])
    .lt('created_at', expiryDate);
  
  if (error) throw error;
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
    const db = getSupabaseAdmin();
    if (!db) return; // Don't throw for audit logging
    await db.from('security_audit_log').insert({
      event_type: event.eventType,
      user_email: event.userEmail,
      ip_address: event.ipAddress,
      user_agent: event.userAgent,
      details: event.details,
    });
  } catch (error) {
    // Don't throw - audit logging should not break the app
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
  const db = getSupabaseAdmin();
  if (!db) throw new Error('Database not available');
  const { limit = 100, offset = 0, eventType, userEmail } = options;
  
  let query = db
    .from('security_audit_log')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  
  if (eventType) {
    query = query.eq('event_type', eventType);
  }
  
  if (userEmail) {
    query = query.eq('user_email', userEmail);
  }
  
  const { data, error, count } = await query;
  
  if (error) throw error;
  
  return {
    logs: data || [],
    total: count || 0,
  };
}

/**
 * Clean up old data for PDPA compliance
 */
export async function cleanupOldData(retentionDays: number = 365): Promise<{
  deletedOrders: number;
  deletedLogs: number;
  deletedAudit: number;
}> {
  const db = getSupabaseAdmin();
  if (!db) throw new Error('Database not available');
  
  const { data, error } = await db.rpc('cleanup_old_data', { retention_days: retentionDays });
  
  if (error) throw error;
  
  return {
    deletedOrders: data?.[0]?.deleted_orders || 0,
    deletedLogs: data?.[0]?.deleted_logs || 0,
    deletedAudit: data?.[0]?.deleted_audit || 0,
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
  
  // Generate unique path: images/YYYY-MM/timestamp_random.ext
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const ext = filename.split('.').pop()?.toLowerCase() || 'png';
  const uniqueName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
  const path = `${yearMonth}/${uniqueName}`;
  
  // Upload to Supabase Storage
  const { data, error } = await db.storage
    .from(STORAGE_BUCKET)
    .upload(path, buffer, {
      contentType,
      cacheControl: '31536000', // 1 year cache
      upsert: false,
    });
  
  if (error) {
    console.error('[Supabase Storage] Upload error:', error);
    throw new Error(`Failed to upload image: ${error.message}`);
  }
  
  // Get public URL (permanent, no expiration)
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
