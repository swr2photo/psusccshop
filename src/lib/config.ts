'use client';

/**
 * Centralized configuration and types
 */

// ==================== TYPES ====================

export interface Product {
  id: string;
  name: string;
  description?: string;
  type: 'JERSEY' | 'CREW' | 'OTHER';
  images?: string[];
  coverImage?: string;
  basePrice: number;
  sizePricing?: { [key: string]: number };
  startDate?: string;
  endDate?: string;
  isActive?: boolean;
  options?: {
    hasCustomName: boolean;
    hasCustomNumber: boolean;
    hasLongSleeve: boolean;
  };
}

export interface ShopConfig {
  isOpen: boolean;
  closeDate: string;
    products: Product[];
    /**
     * Firestore/Storage key for products (optional, for large data)
     */
    productsKey?: string;
  sheetId?: string;
  sheetUrl?: string;
  announcement?: {
    enabled: boolean;
    message: string;
    color: string;
  };
  bankAccount?: {
    bankName: string;
    accountName: string;
    accountNumber: string;
  };
}

export interface Order {
  studentId: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  instagram?: string;
  items: OrderItem[];
  baseAmount: number;
  shippingFee: number;
  discount: number;
  totalPrice: number;
  notes?: string;
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  size?: string;
  customName?: string;
  customNumber?: string;
  customSleeve?: 'SHORT' | 'LONG';
  price: number;
}

export interface CartItem {
  productId: string;
  product: Product;
  quantity: number;
  size?: string;
  customName?: string;
  customNumber?: string;
  customSleeve?: 'SHORT' | 'LONG';
  price: number;
}

// ==================== CONFIGURATION ====================

export const API_URL = process.env.NEXT_PUBLIC_GAS_URL || '';

// Keep raw list here (case/space insensitive). If you add env support later, normalize similarly.
const ADMIN_EMAILS_RAW = [
  'doralaikon.th@gmail.com',
  // Add more admin emails here
];

// Normalize to lowercase and trim to avoid casing/whitespace mismatches
export const ADMIN_EMAILS = ADMIN_EMAILS_RAW.map((e) => e.trim().toLowerCase()).filter(Boolean);

export const isAdmin = (email: string | null): boolean => {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return ADMIN_EMAILS.includes(normalized);
};

export const SIZES = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL', '7XL'];
export const ORDER_STATUSES = ['PENDING', 'PAID', 'READY', 'SHIPPED', 'COMPLETED', 'CANCELLED'];
export const PRODUCT_TYPES = ['JERSEY', 'CREW', 'OTHER'];
export const ANNOUNCEMENT_COLORS = ['blue', 'red', 'green', 'orange'];

// ==================== VALIDATION ====================

export const validateEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export const validatePhone = (phone: string): boolean => {
  return phone.length >= 8 && /^\d+$/.test(phone);
};

export const validatePrice = (price: number): boolean => {
  return !isNaN(price) && price >= 0 && price <= 999999;
};

export const sanitizeInput = (str: string): string => {
  return str.trim().slice(0, 500);
};

export const validateStudentId = (id: string): boolean => {
  return id.trim().length >= 5;
};

// ==================== FORMATTERS ====================

export const formatPrice = (price: number): string => {
  return `฿${price.toLocaleString('th-TH')}`;
};

export const formatDateTime = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('th-TH');
};

export const formatDate = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('th-TH');
};

export const formatTime = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('th-TH');
};

// ==================== STATUS COLORS ====================

export const getStatusColor = (status: string): 'warning' | 'info' | 'success' | 'error' => {
  const colors: Record<string, 'warning' | 'info' | 'success' | 'error'> = {
    'PENDING': 'warning',
    'PAID': 'info',
    'READY': 'success',
    'SHIPPED': 'success',
    'COMPLETED': 'success',
    'CANCELLED': 'error'
  };
  return colors[status] || 'default' as any;
};

export const getStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    'PENDING': 'รออยู่ระหว่างประมวลผล',
    'PAID': 'ชำระเงินแล้ว',
    'READY': 'พร้อมส่งแล้ว',
    'SHIPPED': 'ส่งออกมาแล้ว',
    'COMPLETED': 'สำเร็จแล้ว',
    'CANCELLED': 'ยกเลิก'
  };
  return labels[status] || status;
};

// ==================== CONSTANTS ====================

export const DEFAULT_CONFIG: ShopConfig = {
  isOpen: true,
  closeDate: '',
  products: [],
  sheetId: '',
  sheetUrl: '',
  announcement: {
    enabled: false,
    message: '',
    color: 'blue'
  }
};

export const DEFAULT_ORDER: Order = {
  studentId: '',
  name: '',
  email: '',
  phone: '',
  address: '',
  items: [],
  baseAmount: 0,
  shippingFee: 0,
  discount: 0,
  totalPrice: 0
};

// ==================== LOCALIZATION ====================

export const THAI_LOCALE = {
  welcome: 'ยินดีต้อนรับ',
  addToCart: 'เพิ่มลงตะกร้า',
  checkout: 'ชำระเงิน',
  viewCart: 'ดูตะกร้า',
  total: 'รวมทั้งหมด',
  price: 'ราคา',
  quantity: 'จำนวน',
  size: 'ขนาด',
  available: 'มีในสต็อก',
  outOfStock: 'หมดสต็อก',
  loading: 'กำลังโหลด...',
  error: 'เกิดข้อผิดพลาด',
  success: 'สำเร็จ',
  cancel: 'ยกเลิก',
  confirm: 'ยืนยัน',
  delete: 'ลบ',
  edit: 'แก้ไข',
  save: 'บันทึก',
  close: 'ปิด',
  search: 'ค้นหา',
  filter: 'กรอง',
  sort: 'เรียงลำดับ',
};
