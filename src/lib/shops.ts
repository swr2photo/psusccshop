// src/lib/shops.ts
// Multi-shop system: types, helpers, and Drizzle ORM operations

import { db } from './db';
import { shops, shopAdmins, orders } from '../db/schema';
import { eq, and, desc, inArray, count, or, like } from 'drizzle-orm';
import { Product, ShopConfig } from './config';

// ==================== TYPES ====================

/** Shop-level config */
export type ShopLocalConfig = Pick<ShopConfig,
  | 'announcements' | 'announcementHistory' | 'announcement'
  | 'events' | 'promoCodes' | 'liveStream'
  | 'pickup' | 'nameValidation' | 'shirtNameConfig'
  | 'socialMediaNews'
> & {
  shippingOptions?: any[];
};

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
  config: ShopLocalConfig;
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

export interface ShopWithRole {
  shop: ShopSummary;
  role: 'owner' | 'admin';
  permissions: ShopAdminPermissions;
}

// ==================== DB ↔ APP MAPPING ====================

function dbToShop(row: any): Shop {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    nameEn: row.nameEn || undefined,
    description: row.description || undefined,
    descriptionEn: row.descriptionEn || undefined,
    logoUrl: row.logoUrl || undefined,
    bannerUrl: row.bannerUrl || undefined,
    ownerEmail: row.ownerEmail,
    isActive: row.isActive,
    settings: (row.settings as any) || { isOpen: true },
    paymentInfo: (row.paymentInfo as any) || { promptPayId: '', bankName: '', accountName: '', accountNumber: '' },
    products: (row.products as any) || [],
    config: (row.config as any) || {},
    contactEmail: row.contactEmail || undefined,
    contactPhone: row.contactPhone || undefined,
    socialLinks: (row.socialLinks as any) || undefined,
    sortOrder: row.sortOrder || 0,
    createdAt: row.createdAt?.toISOString?.() || row.createdAt,
    updatedAt: row.updatedAt?.toISOString?.() || row.updatedAt,
  };
}

function dbToShopAdmin(row: any): ShopAdmin {
  return {
    id: row.id,
    shopId: row.shopId,
    email: row.email,
    role: row.role,
    permissions: { ...DEFAULT_SHOP_ADMIN_PERMISSIONS, ...((row.permissions as any) || {}) },
    addedBy: row.addedBy || undefined,
    createdAt: row.createdAt?.toISOString?.() || row.createdAt,
    updatedAt: row.updatedAt?.toISOString?.() || row.updatedAt,
  };
}

function dbToShopSummary(row: any): ShopSummary {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    nameEn: row.nameEn || undefined,
    description: row.description || undefined,
    logoUrl: row.logoUrl || undefined,
    isActive: row.isActive,
    productCount: Array.isArray(row.products) ? (row.products as any[]).length : 0,
    adminCount: 0,
    ownerEmail: row.ownerEmail,
  };
}

function toLegacyOrder(row: any) {
  return {
    id: row.id,
    ref: row.ref,
    date: row.date,
    status: row.status,
    customer_name: row.customerName,
    customer_email: row.customerEmail,
    email_hash: row.emailHash,
    customer_phone: row.customerPhone,
    customer_address: row.customerAddress,
    customer_instagram: row.customerInstagram,
    cart: row.cart,
    total_amount: row.totalAmount,
    notes: row.notes,
    slip_data: row.slipData,
    payment_verified_at: row.paymentVerifiedAt,
    payment_method: row.paymentMethod,
    shipping_option: row.shippingOption,
    tracking_number: row.trackingNumber,
    shipping_provider: row.shippingProvider,
    tracking_status: row.trackingStatus,
    tracking_last_checked: row.trackingLastChecked,
    shipped_at: row.shippedAt,
    received_at: row.receivedAt,
    refund_status: row.refundStatus,
    refund_reason: row.refundReason,
    refund_details: row.refundDetails,
    refund_bank_name: row.refundBankName,
    refund_bank_account: row.refundBankAccount,
    refund_account_name: row.refundAccountName,
    refund_amount: row.refundAmount,
    refund_requested_at: row.refundRequestedAt,
    refund_reviewed_at: row.refundReviewedAt,
    refund_reviewed_by: row.refundReviewedBy,
    refund_admin_note: row.refundAdminNote,
    pickup_data: row.pickupData,
    shop_id: row.shopId,
    shop_slug: row.shopSlug,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

// ==================== SHOP CRUD ====================

export async function listAllShops(): Promise<ShopSummary[]> {
  try {
    const data = await db.select()
      .from(shops)
      .orderBy(shops.sortOrder, shops.name);
    return data.map(dbToShopSummary);
  } catch (error: any) {
    console.error('[shops] listAllShops error:', error.message);
    return [];
  }
}

export async function listActiveShops(): Promise<ShopSummary[]> {
  try {
    const data = await db.select()
      .from(shops)
      .where(eq(shops.isActive, true))
      .orderBy(shops.sortOrder, shops.name);
    return data.map(dbToShopSummary);
  } catch (error: any) {
    console.error('[shops] listActiveShops error:', error.message);
    return [];
  }
}

export async function getShopBySlug(slug: string): Promise<Shop | null> {
  const data = await db.select().from(shops).where(eq(shops.slug, slug)).limit(1);
  return data[0] ? dbToShop(data[0]) : null;
}

export async function getShopById(id: string): Promise<Shop | null> {
  const data = await db.select().from(shops).where(eq(shops.id, id)).limit(1);
  return data[0] ? dbToShop(data[0]) : null;
}

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
  try {
    const data = await db.insert(shops)
      .values({
        slug: input.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        name: input.name,
        nameEn: input.nameEn || null,
        description: input.description || null,
        descriptionEn: input.descriptionEn || null,
        ownerEmail: input.ownerEmail.toLowerCase(),
        paymentInfo: (input.paymentInfo || { promptPayId: '', bankName: '', accountName: '', accountNumber: '' }) as any,
        logoUrl: input.logoUrl || null,
        products: [] as any,
        config: {} as any,
        settings: { isOpen: true } as any,
      })
      .returning();
    
    await addShopAdmin(data[0].id, input.ownerEmail, 'owner', ALL_SHOP_ADMIN_PERMISSIONS, input.ownerEmail);
    return dbToShop(data[0]);
  } catch (error: any) {
    console.error('[shops] createShop error:', error.message);
    return null;
  }
}

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
  config: ShopLocalConfig;
  contactEmail: string;
  contactPhone: string;
  socialLinks: Record<string, string>;
  sortOrder: number;
}>): Promise<Shop | null> {
  try {
    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.nameEn !== undefined) dbUpdates.nameEn = updates.nameEn;
    if (updates.slug !== undefined) dbUpdates.slug = updates.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.descriptionEn !== undefined) dbUpdates.descriptionEn = updates.descriptionEn;
    if (updates.logoUrl !== undefined) dbUpdates.logoUrl = updates.logoUrl;
    if (updates.bannerUrl !== undefined) dbUpdates.bannerUrl = updates.bannerUrl;
    if (updates.isActive !== undefined) dbUpdates.isActive = updates.isActive;
    if (updates.settings !== undefined) dbUpdates.settings = updates.settings;
    if (updates.paymentInfo !== undefined) dbUpdates.paymentInfo = updates.paymentInfo;
    if (updates.products !== undefined) dbUpdates.products = updates.products;
    if (updates.config !== undefined) dbUpdates.config = updates.config;
    if (updates.contactEmail !== undefined) dbUpdates.contactEmail = updates.contactEmail;
    if (updates.contactPhone !== undefined) dbUpdates.contactPhone = updates.contactPhone;
    if (updates.socialLinks !== undefined) dbUpdates.socialLinks = updates.socialLinks;
    if (updates.sortOrder !== undefined) dbUpdates.sortOrder = updates.sortOrder;
    dbUpdates.updatedAt = new Date();
    
    const data = await db.update(shops)
      .set(dbUpdates)
      .where(eq(shops.id, id))
      .returning();
    return dbToShop(data[0]);
  } catch (error: any) {
    console.error('[shops] updateShop error:', error.message);
    return null;
  }
}

export async function deleteShop(id: string): Promise<boolean> {
  try {
    await db.delete(shops).where(eq(shops.id, id));
    return true;
  } catch (error: any) {
    console.error('[shops] deleteShop error:', error.message);
    return false;
  }
}

// ==================== SHOP ADMIN CRUD ====================

export async function listShopAdmins(shopId: string): Promise<ShopAdmin[]> {
  try {
    const data = await db.select()
      .from(shopAdmins)
      .where(eq(shopAdmins.shopId, shopId))
      .orderBy(shopAdmins.role, shopAdmins.email);
    return data.map(dbToShopAdmin);
  } catch (error: any) {
    console.error('[shops] listShopAdmins error:', error.message);
    return [];
  }
}

export async function addShopAdmin(
  shopId: string,
  email: string,
  role: 'owner' | 'admin' = 'admin',
  permissions?: ShopAdminPermissions,
  addedBy?: string,
): Promise<ShopAdmin | null> {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    
    const data = await db.insert(shopAdmins)
      .values({
        shopId,
        email: normalizedEmail,
        role,
        permissions: (permissions || DEFAULT_SHOP_ADMIN_PERMISSIONS) as any,
        addedBy: addedBy || null,
      })
      .onConflictDoUpdate({
        target: [shopAdmins.shopId, shopAdmins.email],
        set: {
          role,
          permissions: (permissions || DEFAULT_SHOP_ADMIN_PERMISSIONS) as any,
          addedBy: addedBy || null,
          updatedAt: new Date(),
        },
      })
      .returning();
      
    return dbToShopAdmin(data[0]);
  } catch (error: any) {
    console.error('[shops] addShopAdmin error:', error.message);
    return null;
  }
}

export async function updateShopAdmin(
  shopId: string,
  email: string,
  updates: { role?: 'owner' | 'admin'; permissions?: ShopAdminPermissions },
): Promise<ShopAdmin | null> {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    const dbUpdates: any = { updatedAt: new Date() };
    if (updates.role) dbUpdates.role = updates.role;
    if (updates.permissions) dbUpdates.permissions = updates.permissions;
    
    const data = await db.update(shopAdmins)
      .set(dbUpdates)
      .where(and(eq(shopAdmins.shopId, shopId), eq(shopAdmins.email, normalizedEmail)))
      .returning();
    return dbToShopAdmin(data[0]);
  } catch (error: any) {
    console.error('[shops] updateShopAdmin error:', error.message);
    return null;
  }
}

export async function removeShopAdmin(shopId: string, email: string): Promise<boolean> {
  try {
    await db.delete(shopAdmins)
      .where(and(eq(shopAdmins.shopId, shopId), eq(shopAdmins.email, email.toLowerCase().trim())));
    return true;
  } catch (error: any) {
    console.error('[shops] removeShopAdmin error:', error.message);
    return false;
  }
}

// ==================== SHOP ACCESS CONTROL ====================

export async function getShopsForAdmin(email: string): Promise<ShopWithRole[]> {
  try {
    const rows = await db.select({
        shopAdmin: shopAdmins,
        shop: shops,
      })
      .from(shopAdmins)
      .innerJoin(shops, eq(shopAdmins.shopId, shops.id))
      .where(eq(shopAdmins.email, email.toLowerCase().trim()));
    
    return rows
      .filter((row: any) => row.shop)
      .map((row: any) => ({
        shop: dbToShopSummary(row.shop),
        role: row.shopAdmin.role as 'owner' | 'admin',
        permissions: { ...DEFAULT_SHOP_ADMIN_PERMISSIONS, ...((row.shopAdmin.permissions as any) || {}) },
      }));
  } catch (error: any) {
    console.error('[shops] getShopsForAdmin error:', error.message);
    return [];
  }
}

export async function getShopAdminRole(shopId: string, email: string): Promise<ShopAdmin | null> {
  const data = await db.select()
    .from(shopAdmins)
    .where(and(eq(shopAdmins.shopId, shopId), eq(shopAdmins.email, email.toLowerCase().trim())))
    .limit(1);
  return data[0] ? dbToShopAdmin(data[0]) : null;
}

export async function isShopAdminEmail(email: string): Promise<boolean> {
  try {
    const result = await db.select({ value: count() })
      .from(shopAdmins)
      .where(eq(shopAdmins.email, email.toLowerCase().trim()));
    return (result[0]?.value || 0) > 0;
  } catch {
    return false;
  }
}

export async function getShopAdminPermissions(email: string): Promise<ShopAdminPermissions> {
  try {
    const shops = await getShopsForAdmin(email);
    const merged: ShopAdminPermissions = { ...DEFAULT_SHOP_ADMIN_PERMISSIONS };
    for (const sr of shops) {
      for (const key of Object.keys(sr.permissions) as (keyof ShopAdminPermissions)[]) {
        if (sr.permissions[key]) merged[key] = true;
      }
    }
    return merged;
  } catch {
    return { ...DEFAULT_SHOP_ADMIN_PERMISSIONS };
  }
}

export async function getShopOrders(shopId: string, options?: {
  limit?: number;
  offset?: number;
  status?: string[];
  search?: string;
}): Promise<{ orders: any[]; total: number }> {
  try {
    const limit = options?.limit ?? 100;
    const offset = options?.offset ?? 0;
    
    const conditions = [eq(orders.shopId, shopId)];
    if (options?.status?.length) conditions.push(inArray(orders.status, options.status));
    if (options?.search) {
      conditions.push(or(
        like(orders.ref, `%${options.search}%`),
        like(orders.customerName, `%${options.search}%`),
        like(orders.customerEmail, `%${options.search}%`)
      )!);
    }
    
    const whereClause = and(...conditions);
    
    const [data, totalResult] = await Promise.all([
      db.select()
        .from(orders)
        .where(whereClause!)
        .orderBy(desc(orders.createdAt))
        .offset(offset)
        .limit(limit),
      db.select({ value: count() })
        .from(orders)
        .where(whereClause!),
    ]);
    
    const total = totalResult[0]?.value || 0;
    return { orders: (data || []).map(toLegacyOrder), total };
  } catch (error: any) {
    console.error('[shops] getShopOrders error:', error.message);
    return { orders: [], total: 0 };
  }
}
