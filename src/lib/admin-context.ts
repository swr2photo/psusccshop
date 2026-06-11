import { ADMIN_EMAILS, isGlobalAdminEmailAsync, isSuperAdminEmail } from '@/lib/auth';
import { getShopConfig } from '@/lib/filebase';
import { getShopAdminPermissions, getShopsForAdmin, isShopAdminEmail } from '@/lib/shops';
import type { ShopAdminPermissions } from '@/lib/shops';

export type AdminUserRole = 'superadmin' | 'admin' | 'shopAdmin';

export interface AssignedShopSummary {
  id: string;
  slug: string;
  name: string;
  permissions: ShopAdminPermissions;
}

export interface ResolvedAdminSession {
  userRole: AdminUserRole;
  userEmail: string;
  /** True when user is in ADMIN_EMAILS or dynamic global admin list */
  isGlobalAdmin: boolean;
  /** Sub-shop IDs this user may access (empty for super/global-only admins) */
  assignedShopIds: string[];
  assignedShops?: AssignedShopSummary[];
  shopAdminPermissions?: Record<string, boolean>;
}

/** Resolve admin role server-side (shared by bootstrap + legacy data routes). */
export async function resolveAdminSession(authEmail: string): Promise<ResolvedAdminSession> {
  const normalizedEmail = authEmail.trim().toLowerCase();

  if (isSuperAdminEmail(normalizedEmail)) {
    return {
      userRole: 'superadmin',
      userEmail: authEmail,
      isGlobalAdmin: true,
      assignedShopIds: [],
    };
  }

  const [isGlobal, isShopAdmin, shopRoles] = await Promise.all([
    isGlobalAdminEmailAsync(normalizedEmail),
    isShopAdminEmail(normalizedEmail),
    getShopsForAdmin(normalizedEmail),
  ]);

  const assignedShopIds = shopRoles.map((sr) => sr.shop.id);
  const assignedShops: AssignedShopSummary[] = shopRoles.map((sr) => ({
    id: sr.shop.id,
    slug: sr.shop.slug,
    name: sr.shop.name,
    permissions: sr.permissions,
  }));

  if (isGlobal) {
    return {
      userRole: 'admin',
      userEmail: authEmail,
      isGlobalAdmin: true,
      assignedShopIds,
      ...(assignedShops.length > 0 ? { assignedShops } : {}),
    };
  }

  if (isShopAdmin && assignedShopIds.length > 0) {
    const shopAdminPerms = (await getShopAdminPermissions(normalizedEmail)) as unknown as Record<string, boolean>;
    return {
      userRole: 'shopAdmin',
      userEmail: authEmail,
      isGlobalAdmin: false,
      assignedShopIds,
      assignedShops,
      shopAdminPermissions: shopAdminPerms,
    };
  }

  // Legacy fallback: config adminEmails without shop_admins row
  const cfg = await getShopConfig();
  const configAdminEmails = ((cfg as { adminEmails?: string[] })?.adminEmails || [])
    .map((e) => e.trim().toLowerCase());
  if (configAdminEmails.includes(normalizedEmail)) {
    return {
      userRole: 'admin',
      userEmail: authEmail,
      isGlobalAdmin: true,
      assignedShopIds,
    };
  }

  return {
    userRole: 'shopAdmin',
    userEmail: authEmail,
    isGlobalAdmin: false,
    assignedShopIds: [],
    shopAdminPermissions: {},
  };
}

/** Ensure shop-only admins can only access assigned shop IDs. */
export function assertShopAccess(
  session: ResolvedAdminSession,
  shopId: string | null | undefined,
): boolean {
  if (!shopId) return session.userRole !== 'shopAdmin';
  if (session.userRole === 'superadmin' || session.userRole === 'admin') return true;
  return session.assignedShopIds.includes(shopId);
}

/** Merge env-var admin emails into shop config for the admin client. */
export function mergeConfigAdminEmails<T extends { adminEmails?: string[] }>(cfg: T): T {
  const configAdminEmails = (cfg.adminEmails || []).map((e) => e.trim().toLowerCase());
  const mergedAdminEmails = [...new Set([...ADMIN_EMAILS, ...configAdminEmails])].filter(Boolean);
  return { ...cfg, adminEmails: mergedAdminEmails };
}

/** Map shop-level permission flags to main admin panel permission keys. */
export function mapShopPermissionsToAdminPanel(perms: ShopAdminPermissions): Record<string, boolean> {
  return {
    canManageShop: perms.canManageShop ?? false,
    canManageSheet: false,
    canManageAnnouncement: perms.canManageAnnouncement ?? false,
    canManageOrders: perms.canManageOrders ?? true,
    canManageProducts: perms.canManageProducts ?? true,
    canManagePickup: perms.canManagePickup ?? false,
    canManageEvents: perms.canManageEvents ?? false,
    canManagePromoCodes: false,
    canManageRefunds: perms.canManageRefunds ?? false,
    canManageTracking: perms.canManageTracking ?? false,
    canManageShipping: perms.canManageShipping ?? false,
    canManagePayment: perms.canManagePayment ?? false,
    canManageSupport: perms.canManageSupport ?? false,
    canManageLiveStream: false,
    canSendEmail: false,
  };
}
