// ==================== SHOP CONSTANTS & HELPERS ====================
// Extracted from page.tsx for better code organization

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
  REFUNDED: '#8b5cf6',
};

// ==================== STATUS HELPERS ====================
export const PAYABLE_STATUSES = ['PENDING', 'WAITING_PAYMENT', 'AWAITING_PAYMENT', 'UNPAID', 'DRAFT'];
export const CANCELABLE_STATUSES = ['PENDING', 'WAITING_PAYMENT', 'AWAITING_PAYMENT', 'UNPAID', 'DRAFT'];

export const normalizeStatus = (status: string) => (status || '').trim().toUpperCase();

export const getStatusCategory = (status: string): 'WAITING_PAYMENT' | 'COMPLETED' | 'RECEIVED' | 'CANCELLED' | 'OTHER' => {
  const key = normalizeStatus(status);
  if (['WAITING_PAYMENT', 'AWAITING_PAYMENT', 'UNPAID', 'DRAFT', 'PENDING'].includes(key)) return 'WAITING_PAYMENT';
  if (['PAID', 'VERIFYING', 'WAITING_SLIP'].includes(key)) return 'COMPLETED';
  if (['READY', 'SHIPPED', 'COMPLETED'].includes(key)) return 'RECEIVED';
  if (['CANCELLED', 'REFUNDED', 'REJECTED', 'FAILED'].includes(key)) return 'CANCELLED';
  return 'OTHER';
};

export const getStatusLabel = (status: string): string => STATUS_LABELS[normalizeStatus(status)] || status;
export const getStatusColor = (status: string): string => STATUS_COLORS[normalizeStatus(status)] || '#475569';

// ==================== TYPE LABELS ====================
export const TYPE_LABELS: Record<string, string> = {
  CREW: 'เสื้อ Crew',
  HOODIE: 'ฮู้ดดี้',
  SHIRT: 'เสื้อเชิ้ต',
  TSHIRT: 'เสื้อยืด',
  POLO: 'เสื้อโปโล',
  JACKET: 'แจ็กเก็ต',
  CAP: 'หมวก',
  ACCESSORY: 'ของที่ระลึก',
  OTHER: 'อื่นๆ',
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

export const isProductCurrentlyOpen = (product: { isActive?: boolean; startDate?: string; endDate?: string }): boolean => {
  if (!product.isActive) return false;
  const now = new Date();
  const start = product.startDate ? new Date(product.startDate) : null;
  const end = product.endDate ? new Date(product.endDate) : null;
  if (start && now < start) return false;
  if (end && now > end) return false;
  return true;
};

export const normalizeEngName = (value: string) => value.replace(/[^a-zA-Z\s]/g, '').toUpperCase().slice(0, 7).trim();

export const normalizeDigits99 = (value: string) => {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  return String(Math.min(99, Number(digits)));
};

export const isThaiText = (value: string) => /^[\u0E00-\u0E7F\s]+$/.test(value.trim());

export const onlyDigitsPhone = (value: string) => value.replace(/\D/g, '').slice(0, 12);

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

export type OrderHistory = {
  ref: string;
  status: string;
  date: string;
  total?: number;
  items?: OrderHistoryItem[];
  cart?: OrderHistoryItem[]; // For backwards compatibility
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
