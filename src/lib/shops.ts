// src/lib/shops.ts
// Multi-shop system: types, helpers, and Supabase operations

import { getSupabaseAdmin } from './supabase';
import { Product } from './config';

// ==================== TYPES ====================

export interface ShopPaymentInfo {
  promptPayId: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
}

export interface ShopSettings {
  isOpen: boolean;
  closeDate?: string;
  openDate?: string;
  closedMessage?: string;
  paymentEnabled?: boolean;
  paymentDisabledMessage?: string;
}

export interface Shop {
  id: string;
  slug: string;
  name: string;
  nameEn?: string;
  description?: string;
  descriptionEn?: string;
  logoUrl?: string;
  bannerUrl?: string;
  ownerEmail: string;
  isActive: boolean;
  settings: ShopSettings;
  paymentInfo: ShopPaymentInfo;
  products: Product[];
  contactEmail?: string;
  contactPhone?: string;
  socialLinks?: Record<string, string>;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ShopAdmin {
  id: string;
  shopId: string;
  email: string;
  role: 'owner' | 'admin';
  permissions: ShopAdminPermissions;
  addedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShopAdminPermissions {
  canManageProducts?: boolean;
  canManageOrders?: boolean;
  canManagePickup?: boolean;
  canManageTracking?: boolean;
  canManageRefunds?: boolean;
  canManageAnnouncement?: boolean;
  canManageEvents?: boolean;
  canManageSupport?: boolean;
  canManageShop?: boolean;
  canManagePayment?: boolean;
  canManageShipping?: boolean;
  canAddAdmins?: boolean;
}

export const DEFAULT_SHOP_ADMIN_PERMISSIONS: ShopAdminPermissions = {
  canManageProducts: true,
  canManageOrders: true,
  canManagePickup: false,
  canManageTracking: true,
  canManageRefunds: true,
  canManageAnnouncement: false,
  canManageEvents: false,
  canManageSupport: true,
  canManageShop: false,
  canManagePayment: false,
  canManageShipping: false,
  canAddAdmins: false,
};

export const ALL_SHOP_ADMIN_PERMISSIONS: ShopAdminPermissions = {
  canManageProducts: true,
  canManageOrders: true,
  canManagePickup: true,
  canManageTracking: true,
  canManageRefunds: true,
  canManageAnnouncement: true,
  canManageEvents: true,
  canManageSupport: true,
  canManageShop: true,
  canManagePayment: true,
  canManageShipping: true,
  canAddAdmins: true,
};

/** Summary for listing shops */
export interface ShopSummary {
  id: string;
  slug: string;
  name: string;
  nameEn?: string;
  description?: string;
  logoUrl?: string;
  isActive: boolean;
  productCount: number;
  adminCount: number;
  ownerEmail: string;
}

/** Shop + user's role in it */
export interface ShopWithRole {
  shop: ShopSummary;
  role: 'owner' | 'admin';
  permissions: ShopAdminPermissions;
}

// ==================== DB ↔ APP MAPPING ====================

/** Get DB client with null check */
function getDB() {
  const db = getSupabaseAdmin();
  if (!db) throw new Error('Database not available');
  return db;
}

function dbToShop(row: any): Shop {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    nameEn: row.name_en || undefined,
    description: row.description || undefined,
    descriptionEn: row.description_en || undefined,
    logoUrl: row.logo_url || undefined,
    bannerUrl: row.banner_url || undefined,
    ownerEmail: row.owner_email,
    isActive: row.is_active,
    settings: row.settings || { isOpen: true },
    paymentInfo: row.payment_info || { promptPayId: '', bankName: '', accountName: '', accountNumber: '' },
    products: row.products || [],
    contactEmail: row.contact_email || undefined,
    contactPhone: row.contact_phone || undefined,
    socialLinks: row.social_links || undefined,
    sortOrder: row.sort_order || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function dbToShopAdmin(row: any): ShopAdmin {
  return {
    id: row.id,
    shopId: row.shop_id,
    email: row.email,
    role: row.role,
    permissions: { ...DEFAULT_SHOP_ADMIN_PERMISSIONS, ...(row.permissions || {}) },
    addedBy: row.added_by || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ==================== SHOP CRUD ====================

/** List all shops (for SuperAdmin) */
export async function listAllShops(): Promise<ShopSummary[]> {
  const db = getDB();
  const { data, error } = await db
    .from('shops')
    .select('id, slug, name, name_en, description, logo_url, is_active, owner_email, products, sort_order')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    console.error('[shops] listAllShops error:', error.message);
    return [];
  }

  return (data || []).map(row => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    nameEn: row.name_en || undefined,
    description: row.description || undefined,
    logoUrl: row.logo_url || undefined,
    isActive: row.is_active,
    productCount: Array.isArray(row.products) ? row.products.length : 0,
    adminCount: 0, // filled separately if needed
    ownerEmail: row.owner_email,
  }));
}

/** List active shops (for storefront) */
export async function listActiveShops(): Promise<ShopSummary[]> {
  const db = getDB();
  const { data, error } = await db
    .from('shops')
    .select('id, slug, name, name_en, description, logo_url, is_active, owner_email, products, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    console.error('[shops] listActiveShops error:', error.message);
    return [];
  }

  return (data || []).map(row => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    nameEn: row.name_en || undefined,
    description: row.description || undefined,
    logoUrl: row.logo_url || undefined,
    isActive: row.is_active,
    productCount: Array.isArray(row.products) ? row.products.length : 0,
    adminCount: 0,
    ownerEmail: row.owner_email,
  }));
}

/** Get shop by slug */
export async function getShopBySlug(slug: string): Promise<Shop | null> {
  const db = getDB();
  const { data, error } = await db
    .from('shops')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error || !data) return null;
  return dbToShop(data);
}

/** Get shop by ID */
export async function getShopById(id: string): Promise<Shop | null> {
  const db = getDB();
  const { data, error } = await db
    .from('shops')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return null;
  return dbToShop(data);
}

/** Create a new shop */
export async function createShop(input: {
  slug: string;
  name: string;
  nameEn?: string;
  description?: string;
  descriptionEn?: string;
  ownerEmail: string;
  paymentInfo?: ShopPaymentInfo;
  logoUrl?: string;
}): Promise<Shop | null> {
  const db = getDB();
  const { data, error } = await db
    .from('shops')
    .insert({
      slug: input.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      name: input.name,
      name_en: input.nameEn || null,
      description: input.description || null,
      description_en: input.descriptionEn || null,
      owner_email: input.ownerEmail.toLowerCase(),
      payment_info: input.paymentInfo || { promptPayId: '', bankName: '', accountName: '', accountNumber: '' },
      logo_url: input.logoUrl || null,
      products: [],
      settings: { isOpen: true },
    })
    .select()
    .single();

  if (error) {
    console.error('[shops] createShop error:', error.message);
    return null;
  }

  // Add owner as shop admin with all permissions
  await addShopAdmin(data.id, input.ownerEmail, 'owner', ALL_SHOP_ADMIN_PERMISSIONS, input.ownerEmail);

  return dbToShop(data);
}

/** Update shop details */
export async function updateShop(id: string, updates: Partial<{
  name: string;
  nameEn: string;
  slug: string;
  description: string;
  descriptionEn: string;
  logoUrl: string;
  bannerUrl: string;
  isActive: boolean;
  settings: ShopSettings;
  paymentInfo: ShopPaymentInfo;
  products: Product[];
  contactEmail: string;
  contactPhone: string;
  socialLinks: Record<string, string>;
  sortOrder: number;
}>): Promise<Shop | null> {
  const db = getDB();
  
  // Map camelCase to snake_case
  const dbUpdates: any = {};
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.nameEn !== undefined) dbUpdates.name_en = updates.nameEn;
  if (updates.slug !== undefined) dbUpdates.slug = updates.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  if (updates.description !== undefined) dbUpdates.description = updates.description;
  if (updates.descriptionEn !== undefined) dbUpdates.description_en = updates.descriptionEn;
  if (updates.logoUrl !== undefined) dbUpdates.logo_url = updates.logoUrl;
  if (updates.bannerUrl !== undefined) dbUpdates.banner_url = updates.bannerUrl;
  if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;
  if (updates.settings !== undefined) dbUpdates.settings = updates.settings;
  if (updates.paymentInfo !== undefined) dbUpdates.payment_info = updates.paymentInfo;
  if (updates.products !== undefined) dbUpdates.products = updates.products;
  if (updates.contactEmail !== undefined) dbUpdates.contact_email = updates.contactEmail;
  if (updates.contactPhone !== undefined) dbUpdates.contact_phone = updates.contactPhone;
  if (updates.socialLinks !== undefined) dbUpdates.social_links = updates.socialLinks;
  if (updates.sortOrder !== undefined) dbUpdates.sort_order = updates.sortOrder;

  const { data, error } = await db
    .from('shops')
    .update(dbUpdates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[shops] updateShop error:', error.message);
    return null;
  }
  return dbToShop(data);
}

/** Delete a shop */
export async function deleteShop(id: string): Promise<boolean> {
  const db = getDB();
  const { error } = await db.from('shops').delete().eq('id', id);
  if (error) {
    console.error('[shops] deleteShop error:', error.message);
    return false;
  }
  return true;
}

// ==================== SHOP ADMIN CRUD ====================

/** List admins of a shop */
export async function listShopAdmins(shopId: string): Promise<ShopAdmin[]> {
  const db = getDB();
  const { data, error } = await db
    .from('shop_admins')
    .select('*')
    .eq('shop_id', shopId)
    .order('role', { ascending: true })
    .order('email', { ascending: true });

  if (error) {
    console.error('[shops] listShopAdmins error:', error.message);
    return [];
  }
  return (data || []).map(dbToShopAdmin);
}

/** Add admin to a shop */
export async function addShopAdmin(
  shopId: string,
  email: string,
  role: 'owner' | 'admin' = 'admin',
  permissions?: ShopAdminPermissions,
  addedBy?: string,
): Promise<ShopAdmin | null> {
  const db = getDB();
  const { data, error } = await db
    .from('shop_admins')
    .upsert({
      shop_id: shopId,
      email: email.toLowerCase().trim(),
      role,
      permissions: permissions || DEFAULT_SHOP_ADMIN_PERMISSIONS,
      added_by: addedBy || null,
    }, { onConflict: 'shop_id,email' })
    .select()
    .single();

  if (error) {
    console.error('[shops] addShopAdmin error:', error.message);
    return null;
  }
  return dbToShopAdmin(data);
}

/** Update shop admin permissions */
export async function updateShopAdmin(
  shopId: string,
  email: string,
  updates: { role?: 'owner' | 'admin'; permissions?: ShopAdminPermissions },
): Promise<ShopAdmin | null> {
  const db = getDB();
  const dbUpdates: any = {};
  if (updates.role) dbUpdates.role = updates.role;
  if (updates.permissions) dbUpdates.permissions = updates.permissions;

  const { data, error } = await db
    .from('shop_admins')
    .update(dbUpdates)
    .eq('shop_id', shopId)
    .eq('email', email.toLowerCase().trim())
    .select()
    .single();

  if (error) {
    console.error('[shops] updateShopAdmin error:', error.message);
    return null;
  }
  return dbToShopAdmin(data);
}

/** Remove admin from shop */
export async function removeShopAdmin(shopId: string, email: string): Promise<boolean> {
  const db = getDB();
  const { error } = await db
    .from('shop_admins')
    .delete()
    .eq('shop_id', shopId)
    .eq('email', email.toLowerCase().trim());

  if (error) {
    console.error('[shops] removeShopAdmin error:', error.message);
    return false;
  }
  return true;
}

// ==================== SHOP ACCESS CONTROL ====================

/** Get all shops a user has admin access to */
export async function getShopsForAdmin(email: string): Promise<ShopWithRole[]> {
  const db = getDB();
  const { data, error } = await db
    .from('shop_admins')
    .select(`
      role, permissions,
      shops:shop_id (id, slug, name, name_en, description, logo_url, is_active, owner_email, products, sort_order)
    `)
    .eq('email', email.toLowerCase().trim());

  if (error) {
    console.error('[shops] getShopsForAdmin error:', error.message);
    return [];
  }

  return (data || [])
    .filter((row: any) => row.shops) // filter out rows where shop was deleted
    .map((row: any) => {
      const s = row.shops;
      return {
        shop: {
          id: s.id,
          slug: s.slug,
          name: s.name,
          nameEn: s.name_en || undefined,
          description: s.description || undefined,
          logoUrl: s.logo_url || undefined,
          isActive: s.is_active,
          productCount: Array.isArray(s.products) ? s.products.length : 0,
          adminCount: 0,
          ownerEmail: s.owner_email,
        },
        role: row.role as 'owner' | 'admin',
        permissions: { ...DEFAULT_SHOP_ADMIN_PERMISSIONS, ...(row.permissions || {}) },
      };
    });
}

/** Check if user has access to a specific shop */
export async function getShopAdminRole(shopId: string, email: string): Promise<ShopAdmin | null> {
  const db = getDB();
  const { data, error } = await db
    .from('shop_admins')
    .select('*')
    .eq('shop_id', shopId)
    .eq('email', email.toLowerCase().trim())
    .single();

  if (error || !data) return null;
  return dbToShopAdmin(data);
}

// ==================== SHOP ORDERS ====================

/** Get orders for a specific shop */
export async function getShopOrders(shopId: string, options?: {
  limit?: number;
  offset?: number;
  status?: string[];
  search?: string;
}): Promise<{ orders: any[]; total: number }> {
  const db = getDB();
  const limit = options?.limit ?? 100;
  const offset = options?.offset ?? 0;

  let query = db
    .from('orders')
    .select('*', { count: 'exact' })
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (options?.status?.length) {
    query = query.in('status', options.status);
  }

  if (options?.search) {
    query = query.or(`ref.ilike.%${options.search}%,customer_name.ilike.%${options.search}%,customer_email.ilike.%${options.search}%`);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('[shops] getShopOrders error:', error.message);
    return { orders: [], total: 0 };
  }

  return { orders: data || [], total: count || 0 };
}
