// ==================== SHOP CONSTANTS & HELPERS ====================
// Extracted from page.tsx for better code organization

import { DEFAULT_NAME_VALIDATION, getCategoryFromType, SIZES, type NameValidationConfig, type Product } from './config';

export function productRequiresSize(product: Product): boolean {
  if (product.options?.requiresSize === false) return false;
  const category = product.category || getCategoryFromType(product.type);
  return category === 'APPAREL';
}

export function getDisplaySizes(product: Product, freeSizeLabel = 'Free Size'): string[] {
  const sizeKeys = Object.keys(product.sizePricing || {});
  if (sizeKeys.length === 0) return [freeSizeLabel];
  return sizeKeys.sort((a, b) => {
    const indexA = SIZES.indexOf(a);
    const indexB = SIZES.indexOf(b);
    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    return a.localeCompare(b);
  });
}

export function resolveProductUnitPrice(
  product: Product,
  selectedSize: string,
  isLongSleeve: boolean | null,
): number {
  const hasVariants = !productRequiresSize(product) && !!product.variants?.length;
  let basePrice = product.basePrice;
  if (hasVariants && selectedSize) {
    const variant = product.variants!.find((v) => v.id === selectedSize);
    if (variant) basePrice = variant.price || product.basePrice;
  } else if (productRequiresSize(product) && selectedSize) {
    basePrice = product.sizePricing?.[selectedSize] ?? product.basePrice;
  }
  const sleeveFee = product.options?.hasLongSleeve && isLongSleeve === true
    ? (product.options?.longSleevePrice ?? 50)
    : 0;
  return basePrice + sleeveFee;
}

export type ShopOpenFields = {
  isOpen: boolean;
  closeDate?: string;
  openDate?: string;
  closedMessage?: string;
};

/** Read shop open/close fields from flattened or nested settings (sub-shop public API shape). */
export function resolveShopOpenFields(shop: {
  isOpen?: boolean;
  closeDate?: string;
  openDate?: string;
  closedMessage?: string;
  settings?: {
    isOpen?: boolean;
    closeDate?: string;
    openDate?: string;
    closedMessage?: string;
  };
} | null | undefined): ShopOpenFields {
  if (!shop) {
    return { isOpen: true, closeDate: '', openDate: undefined, closedMessage: undefined };
  }
  return {
    isOpen: shop.isOpen ?? shop.settings?.isOpen ?? true,
    closeDate: shop.closeDate ?? shop.settings?.closeDate,
    openDate: shop.openDate ?? shop.settings?.openDate,
    closedMessage: shop.closedMessage ?? shop.settings?.closedMessage,
  };
}

/** Merge a Supabase realtime `shops` row into the public shop snapshot (client-safe). */
export function applyRealtimeShopRow(prevShop: Record<string, any>, row: Record<string, any>) {
  const settings = (row.settings as Record<string, any>) || {};
  const mergedSettings = {
    ...(prevShop.settings || {}),
    ...(settings.isOpen !== undefined ? { isOpen: settings.isOpen } : {}),
    ...(settings.closeDate !== undefined ? { closeDate: settings.closeDate } : {}),
    ...(settings.openDate !== undefined ? { openDate: settings.openDate } : {}),
    ...(settings.closedMessage !== undefined ? { closedMessage: settings.closedMessage } : {}),
    ...(settings.paymentEnabled !== undefined ? { paymentEnabled: settings.paymentEnabled } : {}),
    ...(settings.paymentDisabledMessage !== undefined ? { paymentDisabledMessage: settings.paymentDisabledMessage } : {}),
  };

  const isOpen = settings.isOpen !== undefined
    ? settings.isOpen
    : (prevShop.isOpen ?? prevShop.settings?.isOpen ?? true);

  return {
    ...prevShop,
    ...(row.name !== undefined ? { name: row.name } : {}),
    ...(row.name_en !== undefined ? { nameEn: row.name_en } : {}),
    ...(row.description !== undefined ? { description: row.description } : {}),
    ...(row.description_en !== undefined ? { descriptionEn: row.description_en } : {}),
    ...(row.logo_url !== undefined ? { logoUrl: row.logo_url } : {}),
    ...(row.banner_url !== undefined ? { bannerUrl: row.banner_url } : {}),
    ...(row.products !== undefined ? { products: row.products } : {}),
    isOpen,
    closeDate: settings.closeDate ?? prevShop.closeDate ?? prevShop.settings?.closeDate ?? '',
    openDate: settings.openDate ?? prevShop.openDate ?? prevShop.settings?.openDate,
    closedMessage: settings.closedMessage ?? prevShop.closedMessage ?? prevShop.settings?.closedMessage,
    paymentEnabled: settings.paymentEnabled ?? prevShop.paymentEnabled ?? prevShop.settings?.paymentEnabled,
    paymentDisabledMessage: settings.paymentDisabledMessage ?? prevShop.paymentDisabledMessage ?? prevShop.settings?.paymentDisabledMessage,
    settings: mergedSettings,
  };
}

// ==================== STATUS LABELS ====================
export const STATUS_LABELS: Record<string, string> = {
  PENDING: 'รอดำเนินการ',
  PAID: 'ซื้อสำเร็จ',
  READY: 'พร้อมรับสินค้า',
  SHIPPED: 'จัดส่งแล้ว',
  COMPLETED: 'สำเร็จ',
  CANCELLED: 'ยกเลิก',
  WAITING_PAYMENT: 'รอชำระเงิน',
  AWAITING_PAYMENT: 'รอชำระเงิน',
  UNPAID: 'ยังไม่ชำระ',
  DRAFT: 'ยังไม่ชำระ',
  VERIFYING: 'รอตรวจสลิป',
  WAITING_SLIP: 'รอตรวจสลิป',
  REJECTED: 'สลิปไม่ผ่าน',
  FAILED: 'สลิปไม่ผ่าน',
  REFUNDED: 'คืนเงินแล้ว',
  REFUND_REQUESTED: 'ขอคืนเงิน',
};

export const STATUS_LABELS_EN: Record<string, string> = {
  PENDING: 'Pending',
  PAID: 'Paid',
  READY: 'Ready for Pickup',
  SHIPPED: 'Shipped',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  WAITING_PAYMENT: 'Awaiting Payment',
  AWAITING_PAYMENT: 'Awaiting Payment',
  UNPAID: 'Unpaid',
  DRAFT: 'Unpaid',
  VERIFYING: 'Verifying Slip',
  WAITING_SLIP: 'Verifying Slip',
  REJECTED: 'Slip Rejected',
  FAILED: 'Slip Rejected',
  REFUNDED: 'Refunded',
  REFUND_REQUESTED: 'Refund Requested',
};

export const STATUS_COLORS: Record<string, string> = {
  PENDING: '#f59e0b',
  PAID: '#10b981',
  READY: '#10b981',
  SHIPPED: '#0ea5e9',
  COMPLETED: '#22c55e',
  CANCELLED: '#ef4444',
  WAITING_PAYMENT: '#f59e0b',
  AWAITING_PAYMENT: '#f59e0b',
  UNPAID: '#f59e0b',
  DRAFT: '#f59e0b',
  VERIFYING: '#06b6d4',
  WAITING_SLIP: '#06b6d4',
  REJECTED: '#ef4444',
  FAILED: '#ef4444',
  REFUNDED: '#1e40af',
  REFUND_REQUESTED: '#7c3aed',
};

// ==================== STATUS HELPERS ====================
export const PAYABLE_STATUSES = ['PENDING', 'WAITING_PAYMENT', 'AWAITING_PAYMENT', 'UNPAID', 'DRAFT'];
export const CANCELABLE_STATUSES = ['PENDING', 'WAITING_PAYMENT', 'AWAITING_PAYMENT', 'UNPAID', 'DRAFT'];

const RECEIPT_BLOCKED_STATUSES = [
  'WAITING_PAYMENT',
  'AWAITING_PAYMENT',
  'UNPAID',
  'DRAFT',
  'PENDING',
  'VERIFYING',
  'WAITING_SLIP',
  'CANCELLED',
  'REJECTED',
  'FAILED',
] as const;

const RECEIPT_PAID_STATUSES = [
  'PAID',
  'READY',
  'SHIPPED',
  'COMPLETED',
  'RECEIVED',
  'REFUNDED',
  'REFUND_REQUESTED',
] as const;

/** Receipt / invoice is only available after payment is confirmed. */
export function isOrderPaidForReceipt(order: {
  status?: string;
  paymentVerified?: boolean;
  payment_verified?: boolean;
}): boolean {
  const status = normalizeStatus(order.status || '');
  if ((RECEIPT_BLOCKED_STATUSES as readonly string[]).includes(status)) return false;
  if (order.paymentVerified === true || order.payment_verified === true) return true;
  return (RECEIPT_PAID_STATUSES as readonly string[]).includes(status);
}

export const normalizeStatus = (status: string) => (status || '').trim().toUpperCase();

export const getStatusCategory = (status: string): 'WAITING_PAYMENT' | 'COMPLETED' | 'SHIPPED' | 'RECEIVED' | 'CANCELLED' | 'OTHER' => {
  const key = normalizeStatus(status);
  if (['WAITING_PAYMENT', 'AWAITING_PAYMENT', 'UNPAID', 'DRAFT', 'PENDING'].includes(key)) return 'WAITING_PAYMENT';
  if (['PAID', 'VERIFYING', 'WAITING_SLIP'].includes(key)) return 'COMPLETED';
  if (['SHIPPED'].includes(key)) return 'SHIPPED';
  if (['READY', 'COMPLETED', 'RECEIVED'].includes(key)) return 'RECEIVED';
  if (['CANCELLED', 'REFUNDED', 'REFUND_REQUESTED', 'REJECTED', 'FAILED'].includes(key)) return 'CANCELLED';
  return 'OTHER';
};

export const getStatusLabel = (status: string, lang?: 'th' | 'en'): string => {
  const key = normalizeStatus(status);
  if (lang === 'en') return STATUS_LABELS_EN[key] || STATUS_LABELS[key] || status;
  return STATUS_LABELS[key] || status;
};
export const getStatusColor = (status: string): string => STATUS_COLORS[normalizeStatus(status)] || '#475569';

// ==================== TYPE LABELS ====================
export const TYPE_LABELS: Record<string, string> = {
  // Legacy types
  CREW: 'เสื้อ Crew',
  HOODIE: 'ฮู้ดดี้',
  SHIRT: 'เสื้อเชิ้ต',
  TSHIRT: 'เสื้อยืด',
  POLO: 'เสื้อโปโล',
  JACKET: 'แจ็กเก็ต',
  CAP: 'หมวก',
  ACCESSORY: 'ของที่ระลึก',
  OTHER: 'อื่นๆ',
  // New types
  JERSEY: 'เสื้อกีฬา',
  STICKER: 'สติกเกอร์',
  KEYCHAIN: 'พวงกุญแจ',
  MUG: 'แก้ว',
  BADGE: 'เข็มกลัด/ตรา',
  POSTER: 'โปสเตอร์',
  NOTEBOOK: 'สมุด',
  CAMP_REGISTRATION: 'ค่าสมัครค่าย',
  EVENT_TICKET: 'ตั๋วเข้างาน',
  CUSTOM: 'กำหนดเอง',
};

export const TYPE_LABELS_EN: Record<string, string> = {
  CREW: 'Crew Neck',
  HOODIE: 'Hoodie',
  SHIRT: 'Shirt',
  TSHIRT: 'T-Shirt',
  POLO: 'Polo',
  JACKET: 'Jacket',
  CAP: 'Cap',
  ACCESSORY: 'Accessory',
  OTHER: 'Other',
  JERSEY: 'Jersey',
  STICKER: 'Sticker',
  KEYCHAIN: 'Keychain',
  MUG: 'Mug',
  BADGE: 'Badge/Pin',
  POSTER: 'Poster',
  NOTEBOOK: 'Notebook',
  CAMP_REGISTRATION: 'Camp Registration',
  EVENT_TICKET: 'Event Ticket',
  CUSTOM: 'Custom',
};

// ==================== CATEGORY HELPERS ====================
export const CATEGORY_COLORS: Record<string, string> = {
  APPAREL: '#2563eb',
  MERCHANDISE: '#10b981',
  CAMP_FEE: '#f59e0b',
  EVENT: '#ec4899',
  SERVICE: '#1e40af',
  OTHER: '#64748b',
};

// ==================== SIZE CONSTANTS ====================
export const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL', '7XL', '8XL', '9XL', '10XL'] as const;

export const SIZE_MEASUREMENTS: Record<(typeof SIZE_ORDER)[number], { chest: number; length: number }> = {
  XS: { chest: 34, length: 24 },
  S: { chest: 36, length: 25 },
  M: { chest: 38, length: 26 },
  L: { chest: 40, length: 27 },
  XL: { chest: 42, length: 28 },
  '2XL': { chest: 44, length: 29 },
  '3XL': { chest: 46, length: 30 },
  '4XL': { chest: 48, length: 31 },
  '5XL': { chest: 50, length: 32 },
  '6XL': { chest: 52, length: 33 },
  '7XL': { chest: 54, length: 34 },
  '8XL': { chest: 56, length: 35 },
  '9XL': { chest: 58, length: 36 },
  '10XL': { chest: 60, length: 37 },
};

// ==================== ANNOUNCEMENT COLORS ====================
export const ANNOUNCEMENT_COLOR_MAP: Record<string, string> = {
  blue: '#3b82f6',
  red: '#ef4444',
  green: '#22c55e',
  emerald: '#10b981',
  orange: '#f97316',
};

export const getAnnouncementColor = (color: string | undefined): string => {
  if (!color) return '#3b82f6';
  if (color.startsWith('#')) return color;
  return ANNOUNCEMENT_COLOR_MAP[color] || '#3b82f6';
};

// ==================== CACHE CONSTANTS ====================
export const CONFIG_CACHE_KEY = 'shopConfigCache';
export const CONFIG_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ==================== UTILITY FUNCTIONS ====================
export const clampQty = (value: number) => Math.min(99, Math.max(1, value));

export const isValidDate = (dateString?: string): boolean => {
  if (!dateString) return false;
  const date = new Date(dateString);
  return !isNaN(date.getTime());
};

export const parseThailandDateTime = (dateString: string, isEnd: boolean): Date => {
  if (!dateString) return new Date();
  const trimmed = dateString.trim();
  if (trimmed.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(trimmed)) {
    return new Date(trimmed);
  }
  let normalized = trimmed.replace(' ', 'T');
  const hasTime = normalized.includes('T');
  if (!hasTime) {
    if (isEnd) {
      normalized += 'T23:59:59.999+07:00';
    } else {
      normalized += 'T00:00:00.000+07:00';
    }
  } else {
    normalized += '+07:00';
  }
  const date = new Date(normalized);
  if (isNaN(date.getTime())) {
    return new Date(dateString);
  }
  return date;
};

export const isProductCurrentlyOpen = (product: { isActive?: boolean; startDate?: string; endDate?: string }, nowOverride?: Date): boolean => {
  if (!product.isActive) return false;
  const now = nowOverride || new Date();
  const start = product.startDate && isValidDate(product.startDate) ? parseThailandDateTime(product.startDate, false) : null;
  const end = product.endDate && isValidDate(product.endDate) ? parseThailandDateTime(product.endDate, true) : null;
  if (start && now < start) return false;
  if (end && now > end) return false;
  return true;
};

export const normalizeEngName = (value: string) => value.replace(/[^\x20-\x7E]/g, '').toUpperCase().slice(0, 7).trim();

export const normalizeDigits99 = (value: string) => {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  return String(Math.min(99, Number(digits)));
};

export const isThaiText = (value: string) => /^[\u0E00-\u0E7F\s]+$/.test(value.trim());

export function buildNameCharPattern(cfg: NameValidationConfig): string {
  let pattern = '';
  if (cfg.allowThai) pattern += '\u0E00-\u0E7F';
  if (cfg.allowEnglish) pattern += 'a-zA-Z';
  if (cfg.allowSpecialChars && cfg.allowedSpecialChars) {
    pattern += cfg.allowedSpecialChars.replace(/[\\\]\^\-]/g, '\\$&');
  }
  pattern += '\\s';
  return pattern;
}

export function isValidCustomerName(
  name: string,
  cfg: NameValidationConfig = DEFAULT_NAME_VALIDATION,
): boolean {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length < cfg.minLength || trimmed.length > cfg.maxLength) return false;
  return new RegExp(`^[${buildNameCharPattern(cfg)}]+$`).test(trimmed);
}

export function sanitizeCustomerName(
  value: string,
  cfg: NameValidationConfig = DEFAULT_NAME_VALIDATION,
): string {
  return value.replace(new RegExp(`[^${buildNameCharPattern(cfg)}]`, 'g'), '').trim().slice(0, cfg.maxLength);
}

export const onlyDigitsPhone = (value: string) => value.replace(/\D/g, '').slice(0, 12);

export interface ProfileSavedAddress {
  id: string;
  label: string;
  address: string;
  isDefault: boolean;
}

/** Prefer flat address; fall back to default / first saved address */
export function resolveProfileAddress(
  flatAddress?: string,
  savedAddresses?: ProfileSavedAddress[],
): string {
  const flat = flatAddress?.trim() || '';
  if (flat) return flat;
  const def = savedAddresses?.find((a) => a.isDefault)?.address?.trim();
  if (def) return def;
  return savedAddresses?.[0]?.address?.trim() || '';
}

export const getBasePrice = (p: { basePrice: number; sizePricing?: Record<string, number> }) => {
  const prices = Object.values(p.sizePricing || {});
  if (prices.length === 0) return p.basePrice;
  return Math.min(...prices);
};

// ==================== TYPES ====================
export type ToastSeverity = 'success' | 'error' | 'warning' | 'info';

export type Toast = {
  id: string;
  type: ToastSeverity;
  message: string;
};

export type ProductOptions = {
  size: string;
  quantity: number;
  customName: string;
  customNumber: string;
  isLongSleeve: boolean;
};

export type CartItem = {
  id: string;
  productId: string;
  productName: string;
  size: string;
  quantity: number;
  unitPrice: number;
  options: {
    customName?: string;
    customNumber?: string;
    isLongSleeve?: boolean;
    pattern?: string;
    variantId?: string;
    variantName?: string;
  };
};

export type OrderHistoryItem = {
  productId?: string;
  name?: string;
  productName?: string;
  size?: string;
  qty?: number;
  quantity?: number;
  customName?: string;
  customNumber?: string;
  isLongSleeve?: boolean;
  unitPrice?: number;
  subtotal?: number;
  options?: {
    customName?: string;
    isLongSleeve?: boolean;
    customNumber?: string;
  };
};

export const REFUNDABLE_STATUSES = ['PAID', 'READY', 'COMPLETED', 'SHIPPED'];

export type OrderHistory = {
  ref: string;
  status: string;
  date: string;
  total?: number;
  shippingFee?: number; // ค่าจัดส่ง - ถ้า > 0 แสดงว่าเป็นออเดอร์จัดส่ง
  items?: OrderHistoryItem[];
  cart?: OrderHistoryItem[]; // For backwards compatibility
  // Tracking info for shipped orders
  trackingNumber?: string;
  shippingProvider?: string;
  shippingMethod?: string;
  shippingOption?: string; // pickup, delivery, thailand_post_ems, etc.
  // Refund info
  refundStatus?: string;
  refundReason?: string;
  refundAmount?: number;
  refundRequestedAt?: string;
  refundAdminNote?: string;
  paymentVerifiedAt?: string | null;
  receiptIssuedAt?: string | null;
  // Pickup confirmation info
  pickup?: {
    pickedUp?: boolean;
    pickedUpAt?: string;
    pickedUpBy?: string;
    condition?: string;
    notes?: string;
  };
};

export type LeanProduct = {
  id: string;
  name: string;
  description?: string;
  type: string;
  images?: string[];
  basePrice: number;
  sizePricing?: Record<string, number>;
  isActive?: boolean;
  startDate?: string;
  endDate?: string;
};

export type LeanConfig = {
  isOpen: boolean;
  closeDate?: string;
  openDate?: string;
  announcements: Array<{
    message: string;
    type?: string;
    color?: string;
    image?: string;
    enabled?: boolean;
    createdAt?: string;
  }>;
  announcementHistory?: Array<{
    message: string;
    type?: string;
    color?: string;
    image?: string;
    enabled?: boolean;
    createdAt?: string;
    archivedAt?: string;
  }>;
  products: LeanProduct[];
};
