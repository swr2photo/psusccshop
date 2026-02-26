// src/lib/shops.ts
// Multi-shop system: types, helpers, and Prisma operations

import { prisma } from './prisma';
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
    nameEn: row.name_en || undefined,
    description: row.description || undefined,
    descriptionEn: row.description_en || undefined,
    logoUrl: row.logo_url || undefined,
    bannerUrl: row.banner_url || undefined,
    ownerEmail: row.owner_email,
    isActive: row.is_active,
    settings: (row.settings as any) || { isOpen: true },
    paymentInfo: (row.payment_info as any) || { promptPayId: '', bankName: '', accountName: '', accountNumber: '' },
    products: (row.products as any) || [],
    config: (row.config as any) || {},
    contactEmail: row.contact_email || undefined,
    contactPhone: row.contact_phone || undefined,
    socialLinks: (row.social_links as any) || undefined,
    sortOrder: row.sort_order || 0,
    createdAt: row.created_at?.toISOString?.() || row.created_at,
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at,
  };
}

function dbToShopAdmin(row: any): ShopAdmin {
  return {
    id: row.id,
    shopId: row.shop_id,
    email: row.email,
    role: row.role,
    permissions: { ...DEFAULT_SHOP_ADMIN_PERMISSIONS, ...((row.permissions as any) || {}) },
    addedBy: row.added_by || undefined,
    createdAt: row.created_at?.toISOString?.() || row.created_at,
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at,
  };
}

function dbToShopSummary(row: any): ShopSummary {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    nameEn: row.name_en || undefined,
    description: row.description || undefined,
    logoUrl: row.logo_url || undefined,
    isActive: row.is_active,
    productCount: Array.isArray(row.products) ? (row.products as any[]).length : 0,
    adminCount: 0,
    ownerEmail: row.owner_email,
  };
}

// ==================== SHOP CRUD ====================

export async function listAllShops(): Promise<ShopSummary[]> {
  try {
    const data = await prisma.shop.findMany({
      orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
    });
    return data.map(dbToShopSummary);
  } catch (error: any) {
    console.error('[shops] listAllShops error:', error.message);
    return [];
  }
}

export async function listActiveShops(): Promise<ShopSummary[]> {
  try {
    const data = await prisma.shop.findMany({
      where: { is_active: true },
      orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
    });
    return data.map(dbToShopSummary);
  } catch (error: any) {
    console.error('[shops] listActiveShops error:', error.message);
    return [];
  }
}

export async function getShopBySlug(slug: string): Promise<Shop | null> {
  const data = await prisma.shop.findUnique({ where: { slug } });
  return data ? dbToShop(data) : null;
}

export async function getShopById(id: string): Promise<Shop | null> {
  const data = await prisma.shop.findUnique({ where: { id } });
  return data ? dbToShop(data) : null;
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
    const data = await prisma.shop.create({
      data: {
        slug: input.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        name: input.name,
        name_en: input.nameEn || null,
        description: input.description || null,
        description_en: input.descriptionEn || null,
        owner_email: input.ownerEmail.toLowerCase(),
        payment_info: (input.paymentInfo || { promptPayId: '', bankName: '', accountName: '', accountNumber: '' }) as any,
        logo_url: input.logoUrl || null,
        products: [] as any,
        config: {} as any,
        settings: { isOpen: true } as any,
      },
    });
    
    await addShopAdmin(data.id, input.ownerEmail, 'owner', ALL_SHOP_ADMIN_PERMISSIONS, input.ownerEmail);
    return dbToShop(data);
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
    if (updates.config !== undefined) dbUpdates.config = updates.config;
    if (updates.contactEmail !== undefined) dbUpdates.contact_email = updates.contactEmail;
    if (updates.contactPhone !== undefined) dbUpdates.contact_phone = updates.contactPhone;
    if (updates.socialLinks !== undefined) dbUpdates.social_links = updates.socialLinks;
    if (updates.sortOrder !== undefined) dbUpdates.sort_order = updates.sortOrder;
    
    const data = await prisma.shop.update({ where: { id }, data: dbUpdates });
    return dbToShop(data);
  } catch (error: any) {
    console.error('[shops] updateShop error:', error.message);
    return null;
  }
}

export async function deleteShop(id: string): Promise<boolean> {
  try {
    await prisma.shop.delete({ where: { id } });
    return true;
  } catch (error: any) {
    console.error('[shops] deleteShop error:', error.message);
    return false;
  }
}

// ==================== SHOP ADMIN CRUD ====================

export async function listShopAdmins(shopId: string): Promise<ShopAdmin[]> {
  try {
    const data = await prisma.shopAdmin.findMany({
      where: { shop_id: shopId },
      orderBy: [{ role: 'asc' }, { email: 'asc' }],
    });
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
    const data = await prisma.shopAdmin.upsert({
      where: { shop_id_email: { shop_id: shopId, email: normalizedEmail } },
      update: {
        role,
        permissions: (permissions || DEFAULT_SHOP_ADMIN_PERMISSIONS) as any,
        added_by: addedBy || null,
      },
      create: {
        shop_id: shopId,
        email: normalizedEmail,
        role,
        permissions: (permissions || DEFAULT_SHOP_ADMIN_PERMISSIONS) as any,
        added_by: addedBy || null,
      },
    });
    return dbToShopAdmin(data);
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
    const dbUpdates: any = {};
    if (updates.role) dbUpdates.role = updates.role;
    if (updates.permissions) dbUpdates.permissions = updates.permissions;
    
    const data = await prisma.shopAdmin.update({
      where: { shop_id_email: { shop_id: shopId, email: normalizedEmail } },
      data: dbUpdates,
    });
    return dbToShopAdmin(data);
  } catch (error: any) {
    console.error('[shops] updateShopAdmin error:', error.message);
    return null;
  }
}

export async function removeShopAdmin(shopId: string, email: string): Promise<boolean> {
  try {
    await prisma.shopAdmin.delete({
      where: { shop_id_email: { shop_id: shopId, email: email.toLowerCase().trim() } },
    });
    return true;
  } catch (error: any) {
    console.error('[shops] removeShopAdmin error:', error.message);
    return false;
  }
}

// ==================== SHOP ACCESS CONTROL ====================

export async function getShopsForAdmin(email: string): Promise<ShopWithRole[]> {
  try {
    const data = await prisma.shopAdmin.findMany({
      where: { email: email.toLowerCase().trim() },
      include: { shop: true },
    });
    
    return data
      .filter(row => row.shop)
      .map(row => ({
        shop: dbToShopSummary(row.shop),
        role: row.role as 'owner' | 'admin',
        permissions: { ...DEFAULT_SHOP_ADMIN_PERMISSIONS, ...((row.permissions as any) || {}) },
      }));
  } catch (error: any) {
    console.error('[shops] getShopsForAdmin error:', error.message);
    return [];
  }
}

export async function getShopAdminRole(shopId: string, email: string): Promise<ShopAdmin | null> {
  const data = await prisma.shopAdmin.findFirst({
    where: { shop_id: shopId, email: email.toLowerCase().trim() },
  });
  return data ? dbToShopAdmin(data) : null;
}

export async function isShopAdminEmail(email: string): Promise<boolean> {
  try {
    const count = await prisma.shopAdmin.count({
      where: { email: email.toLowerCase().trim() },
    });
    return count > 0;
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
    
    const where: any = { shop_id: shopId };
    if (options?.status?.length) where.status = { in: options.status };
    if (options?.search) {
      where.OR = [
        { ref: { contains: options.search, mode: 'insensitive' } },
        { customer_name: { contains: options.search, mode: 'insensitive' } },
        { customer_email: { contains: options.search, mode: 'insensitive' } },
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
    
    return { orders: data || [], total };
  } catch (error: any) {
    console.error('[shops] getShopOrders error:', error.message);
    return { orders: [], total: 0 };
  }
}
