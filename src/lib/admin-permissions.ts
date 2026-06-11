/** Client-safe shop admin permission types and mappers (no DB imports). */

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
