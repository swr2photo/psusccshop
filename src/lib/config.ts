'use client';

/**
 * Centralized configuration and types
 */

// ==================== PRODUCT CATEGORIES ====================

/** หมวดหมู่หลักที่กำหนดไว้ล่วงหน้า */
export const PREDEFINED_CATEGORIES = ['APPAREL', 'MERCHANDISE', 'CAMP_FEE', 'EVENT', 'SERVICE', 'OTHER'] as const;

/** หมวดหมู่หลักของสินค้า - รองรับค่าที่กำหนดเองได้ */
export type ProductCategory = typeof PREDEFINED_CATEGORIES[number] | string;

/** ประเภทย่อยที่กำหนดไว้ล่วงหน้า */
export const PREDEFINED_SUBTYPES = [
  // Apparel
  'JERSEY', 'CREW', 'HOODIE', 'TSHIRT', 'POLO', 'JACKET', 'CAP',
  // Merchandise
  'STICKER', 'KEYCHAIN', 'MUG', 'BADGE', 'POSTER', 'NOTEBOOK',
  // Camp/Event
  'CAMP_REGISTRATION', 'EVENT_TICKET',
  // Other
  'CUSTOM', 'OTHER'
] as const;

/** ประเภทย่อยของสินค้า - รองรับค่าที่กำหนดเองได้ */
export type ProductSubType = typeof PREDEFINED_SUBTYPES[number] | string;

/** Category labels in Thai */
export const CATEGORY_LABELS: Record<string, string> = {
  APPAREL: 'เสื้อผ้า',
  MERCHANDISE: 'ของที่ระลึก',
  CAMP_FEE: 'ค่าสมัครค่าย',
  EVENT: 'กิจกรรม/อีเวนต์',
  SERVICE: 'บริการ',
  OTHER: 'อื่นๆ',
};

/** Category labels in English */
export const CATEGORY_LABELS_EN: Record<string, string> = {
  APPAREL: 'Apparel',
  MERCHANDISE: 'Merchandise',
  CAMP_FEE: 'Camp Fee',
  EVENT: 'Events',
  SERVICE: 'Service',
  OTHER: 'Other',
};

/** SubType labels in Thai */
export const SUBTYPE_LABELS: Record<string, string> = {
  // Apparel
  JERSEY: 'เสื้อกีฬา',
  CREW: 'เสื้อ Crew',
  HOODIE: 'ฮู้ดดี้',
  TSHIRT: 'เสื้อยืด',
  POLO: 'เสื้อโปโล',
  JACKET: 'แจ็กเก็ต',
  CAP: 'หมวก',
  // Merchandise
  STICKER: 'สติกเกอร์',
  KEYCHAIN: 'พวงกุญแจ',
  MUG: 'แก้ว',
  BADGE: 'เข็มกลัด/ตรา',
  POSTER: 'โปสเตอร์',
  NOTEBOOK: 'สมุด',
  // Camp/Event
  CAMP_REGISTRATION: 'ค่าสมัครค่าย',
  EVENT_TICKET: 'ตั๋วเข้างาน',
  // Other
  CUSTOM: 'กำหนดเอง',
  OTHER: 'อื่นๆ',
};

/** SubType labels in English */
export const SUBTYPE_LABELS_EN: Record<string, string> = {
  JERSEY: 'Jersey',
  CREW: 'Crew Neck',
  HOODIE: 'Hoodie',
  TSHIRT: 'T-Shirt',
  POLO: 'Polo',
  JACKET: 'Jacket',
  CAP: 'Cap',
  STICKER: 'Sticker',
  KEYCHAIN: 'Keychain',
  MUG: 'Mug',
  BADGE: 'Badge/Pin',
  POSTER: 'Poster',
  NOTEBOOK: 'Notebook',
  CAMP_REGISTRATION: 'Camp Registration',
  EVENT_TICKET: 'Event Ticket',
  CUSTOM: 'Custom',
  OTHER: 'Other',
};

/** Category icons */
export const CATEGORY_ICONS: Record<string, string> = {
  APPAREL: '',
  MERCHANDISE: '',
  CAMP_FEE: '',
  EVENT: '',
  SERVICE: '',
  OTHER: '',
};

/** Get subtypes for a category */
export const CATEGORY_SUBTYPES: Record<string, string[]> = {
  APPAREL: ['JERSEY', 'CREW', 'HOODIE', 'TSHIRT', 'POLO', 'JACKET', 'CAP'],
  MERCHANDISE: ['STICKER', 'KEYCHAIN', 'MUG', 'BADGE', 'POSTER', 'NOTEBOOK'],
  CAMP_FEE: ['CAMP_REGISTRATION'],
  EVENT: ['EVENT_TICKET'],
  SERVICE: ['CUSTOM'],
  OTHER: ['OTHER'],
};

/**
 * Thai → English mapping for custom categories created by admin.
 * Add new entries here when admin creates categories in Thai.
 */
export const CUSTOM_CATEGORY_TRANSLATIONS: Record<string, string> = {
  'เสื้อผ้า': 'Apparel',
  'ของที่ระลึก': 'Merchandise',
  'ค่าสมัครค่าย': 'Camp Fee',
  'กิจกรรม/อีเวนต์': 'Events',
  'บริการ': 'Service',
  'อื่นๆ': 'Other',
  'อุปกรณ์กีฬา': 'Sports Equipment',
  'กระเป๋า': 'Bags',
  'เครื่องเขียน': 'Stationery',
  'อาหาร': 'Food',
  'เครื่องดื่ม': 'Beverages',
  'หนังสือ': 'Books',
  'ของแจก': 'Giveaway',
  'ชุดกีฬา': 'Sportswear',
  'รองเท้า': 'Shoes',
  'หมวก': 'Hats',
  'ผ้าพันคอ': 'Scarves',
  'เข็มกลัด': 'Pins',
  'โปสเตอร์': 'Posters',
  'สติกเกอร์': 'Stickers',
  'พวงกุญแจ': 'Keychains',
  'แก้วน้ำ': 'Cups',
  'สมุด': 'Notebooks',
};

/** Helper: Get category label (returns custom value if not in predefined list) */
export const getCategoryLabel = (category: string, lang?: 'th' | 'en'): string => {
  if (lang === 'en') {
    return CATEGORY_LABELS_EN[category]
      || CUSTOM_CATEGORY_TRANSLATIONS[category]
      || CATEGORY_LABELS[category]
      || category;
  }
  return CATEGORY_LABELS[category] || category;
};

/** Helper: Get subtype label (returns custom value if not in predefined list) */
export const getSubTypeLabel = (subType: string, lang?: 'th' | 'en'): string => {
  if (lang === 'en') return SUBTYPE_LABELS_EN[subType] || SUBTYPE_LABELS[subType] || subType;
  return SUBTYPE_LABELS[subType] || subType;
};

/** Helper: Get category icon (returns default if not in predefined list) */
export const getCategoryIcon = (category: string): string => {
  return CATEGORY_ICONS[category] || '';
};

// ==================== TYPES ====================

export interface Product {
  id: string;
  name: string;
  /** English product name (optional, for i18n) */
  nameEn?: string;
  description?: string;
  /** English description (optional, for i18n) */
  descriptionEn?: string;
  /** หมวดหมู่หลัก - ใช้สำหรับกรองและแสดงผล */
  category?: ProductCategory;
  /** Legacy type - backward compatible */
  type: 'JERSEY' | 'CREW' | 'OTHER';
  /** ประเภทย่อยของสินค้า */
  subType?: ProductSubType;
  images?: string[];
  coverImage?: string;
  /** ราคาพื้นฐาน */
  basePrice: number;
  /** ราคาตามขนาด (สำหรับเสื้อ) */
  sizePricing?: { [key: string]: number };
  /** ตัวเลือกสินค้าแบบกำหนดเอง (สำหรับของที่ระลึก/ค่ายฯ) */
  variants?: ProductVariant[];
  /** จำนวนสินค้าในสต็อค (null = ไม่จำกัด) */
  stock?: number | null;
  /** จำนวนสูงสุดต่อออเดอร์ */
  maxPerOrder?: number;
  startDate?: string;
  endDate?: string;
  isActive?: boolean;
  options?: {
    hasCustomName: boolean;
    hasCustomNumber: boolean;
    hasLongSleeve: boolean;
    longSleevePrice?: number;
    /** ต้องเลือกขนาดหรือไม่ */
    requiresSize?: boolean;
    /** ฟิลด์ที่ต้องกรอกเพิ่มเติม (สำหรับค่ายฯ) */
    customFields?: ProductCustomField[];
  };
  /** Custom tags to display on product card */
  customTags?: Array<{
    text: string;
    textEn?: string;
    color: string;
    bgColor?: string;
  }>;
  /** Per-product pickup settings */
  pickup?: {
    enabled: boolean;
    location?: string;
    startDate?: string;
    endDate?: string;
    notes?: string;
    updatedBy?: string;
    updatedAt?: string;
  };
  /** สำหรับค่าย - ข้อมูลเพิ่มเติม */
  campInfo?: {
    campName?: string;
    campDate?: string;
    location?: string;
    organizer?: string;
    maxParticipants?: number;
    currentParticipants?: number;
    requirements?: string;
  };
  /** สำหรับอีเวนต์ */
  eventInfo?: {
    eventName?: string;
    eventDate?: string;
    venue?: string;
    organizer?: string;
  };
  /** URL-friendly slug สำหรับ product link */
  slug?: string;
  /** ลำดับการแสดงผล */
  sortOrder?: number;
  /** วันที่สร้าง */
  createdAt?: string;
  /** วันที่อัปเดตล่าสุด */
  updatedAt?: string;
}

/** Get product name in the active language */
export const getProductName = (product: Product, lang?: 'th' | 'en'): string => {
  if (lang === 'en' && (product as any).nameEn) return (product as any).nameEn;
  return product.name;
};

/** Get product description in the active language */
export const getProductDescription = (product: Product, lang?: 'th' | 'en'): string => {
  if (lang === 'en' && (product as any).descriptionEn) return (product as any).descriptionEn;
  return product.description || '';
};

/** ตัวเลือกสินค้า (สำหรับของที่ระลึก) */
export interface ProductVariant {
  id: string;
  name: string;
  price: number;
  /** รูปภาพของตัวเลือก */
  image?: string;
  /** จำนวนในสต็อค */
  stock?: number | null;
  /** เปิดใช้งาน */
  isActive?: boolean;
}

/** ฟิลด์ที่กำหนดเอง (สำหรับค่าสมัครค่าย) */
export interface ProductCustomField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'date' | 'email' | 'phone';
  required: boolean;
  placeholder?: string;
  options?: string[]; // สำหรับ type: 'select'
  validation?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
  };
}

/** Admin permissions - granular access control for each admin */
export interface AdminPermissions {
  // ร้านค้า & ระบบ
  canManageShop?: boolean;         // เปิด/ปิดร้าน, ตั้งค่าทั่วไป
  canManageSheet?: boolean;        // จัดการ Google Sheet
  canManageShipping?: boolean;     // ตั้งค่าการจัดส่ง
  canManagePayment?: boolean;      // ตั้งค่าชำระเงิน
  // สินค้า & ออเดอร์
  canManageProducts?: boolean;     // จัดการสินค้า
  canManageOrders?: boolean;       // จัดการออเดอร์
  canManagePickup?: boolean;       // จัดการรับสินค้า
  canManageTracking?: boolean;     // ติดตามพัสดุ
  canManageRefunds?: boolean;      // จัดการคืนเงิน
  // การตลาด & สื่อสาร
  canManageAnnouncement?: boolean; // จัดการประกาศ
  canManageEvents?: boolean;       // จัดการอีเวนต์/โปรโมชั่น
  canManagePromoCodes?: boolean;   // จัดการโค้ดส่วนลด
  canManageSupport?: boolean;      // แชทสนับสนุน
  canSendEmail?: boolean;          // ส่งอีเมลถึงลูกค้า
  canManageLiveStream?: boolean;   // จัดการไลฟ์สด
}

/** Default permissions for newly added admins */
export const DEFAULT_ADMIN_PERMISSIONS: AdminPermissions = {
  canManageShop: false,
  canManageSheet: false,
  canManageShipping: false,
  canManagePayment: false,
  canManageProducts: true,
  canManageOrders: true,
  canManagePickup: false,
  canManageTracking: true,
  canManageRefunds: true,
  canManageAnnouncement: false,
  canManageEvents: false,
  canManagePromoCodes: false,
  canManageSupport: true,
  canSendEmail: false,
  canManageLiveStream: true,
};

/** ตั้งค่าการตรวจสอบชื่อ */
export interface NameValidationConfig {
  /** ความยาวขั้นต่ำ (default: 2) */
  minLength: number;
  /** ความยาวสูงสุด (default: 100) */
  maxLength: number;
  /** อนุญาตภาษาไทย (default: true) */
  allowThai: boolean;
  /** อนุญาตภาษาอังกฤษ (default: false) */
  allowEnglish: boolean;
  /** อนุญาตอักษรพิเศษ เช่น . - ' (default: false) */
  allowSpecialChars: boolean;
  /** รูปแบบอักษรพิเศษที่อนุญาต (default: ".-'") */
  allowedSpecialChars: string;
}

export const DEFAULT_NAME_VALIDATION: NameValidationConfig = {
  minLength: 2,
  maxLength: 100,
  allowThai: true,
  allowEnglish: true,
  allowSpecialChars: false,
  allowedSpecialChars: ".-'",
};

/** ตั้งค่าชื่อบนเสื้อ (Custom Name on Shirt) */
export interface ShirtNameConfig {
  /** ความยาวขั้นต่ำ (default: 1) */
  minLength: number;
  /** ความยาวสูงสุด (default: 7) */
  maxLength: number;
  /** อนุญาตภาษาไทย (default: false) */
  allowThai: boolean;
  /** อนุญาตภาษาอังกฤษ (default: true) */
  allowEnglish: boolean;
  /** แปลงเป็นตัวพิมพ์ใหญ่อัตโนมัติ (default: true) */
  autoUppercase: boolean;
  /** อนุญาตอักษรพิเศษ (default: false) */
  allowSpecialChars: boolean;
  /** รูปแบบอักษรพิเศษที่อนุญาต (default: ".-") */
  allowedSpecialChars: string;
}

export const DEFAULT_SHIRT_NAME: ShirtNameConfig = {
  minLength: 1,
  maxLength: 7,
  allowThai: true,
  allowEnglish: true,
  autoUppercase: true,
  allowSpecialChars: false,
  allowedSpecialChars: '.-',
};

export interface ShopConfig {
  isOpen: boolean;
  closeDate: string;
  /** วันที่เปิดร้าน (สำหรับแสดง "รอเปิด" หรือ "เร็วๆ นี้") */
  openDate?: string;
  /** ข้อความแสดงเมื่อร้านปิด */
  closedMessage?: string;
  /** ระบบชำระเงินเปิด/ปิด */
  paymentEnabled?: boolean;
  /** ข้อความแสดงเมื่อปิดระบบชำระเงิน */
  paymentDisabledMessage?: string;
  /** ตั้งค่าการตรวจสอบชื่อ */
  nameValidation?: NameValidationConfig;
  /** ตั้งค่าชื่อบนเสื้อ */
  shirtNameConfig?: ShirtNameConfig;
  products: Product[];
    /**
     * Firestore/Storage key for products (optional, for large data)
     */
    productsKey?: string;
  sheetId?: string;
  sheetUrl?: string;
  vendorSheetId?: string;
  vendorSheetUrl?: string;
  /** Legacy single announcement (deprecated, kept for backward compatibility) */
  announcement?: {
    enabled: boolean;
    message: string;
    color: string;
    /** Image URL for announcement (optional) */
    imageUrl?: string;
    /** Who posted this announcement */
    postedBy?: string;
    /** Custom display name for announcement */
    displayName?: string;
    /** Timestamp when posted */
    postedAt?: string;
    /** Type: 'text' | 'image' | 'both' */
    type?: 'text' | 'image' | 'both';
    /** Show logo in announcement */
    showLogo?: boolean;
    /** Unique ID for this announcement */
    id?: string;
  };
  /** Multiple announcements (new system) */
  announcements?: Array<{
    id: string;
    enabled: boolean;
    message: string;
    color: string;
    imageUrl?: string;
    postedBy?: string;
    displayName?: string;
    postedAt: string;
    type?: 'text' | 'image' | 'both';
    showLogo?: boolean;
    /** Priority/order for display */
    priority?: number;
    /** ข้อความพิเศษ (เช่น ตัวหนา, ขีดเส้นใต้, หรือข้อความสำคัญ) */
    isSpecial?: boolean;
    /** ไอคอน emoji หรือ icon สำหรับข้อความพิเศษ */
    specialIcon?: string;
    /** ลิงก์แนบ (ถ้ามี) */
    link?: string;
    /** ข้อความปุ่ม (ถ้ามี link) */
    linkText?: string;
    /** สินค้าที่เชื่อมโยง (product ID) */
    linkedProductId?: string;
  }>;
  /** Social media news feed */
  socialMediaNews?: Array<{
    id: string;
    platform: 'instagram' | 'facebook' | 'tiktok' | 'line';
    title: string;
    description?: string;
    postUrl: string;
    imageUrl?: string;
    postedAt: string;
    enabled: boolean;
    createdBy?: string;
  }>;
  /** Announcement history (last 50) */
  announcementHistory?: Array<{
    id: string;
    message: string;
    color: string;
    imageUrl?: string;
    postedBy?: string;
    displayName?: string;
    postedAt: string;
    type?: 'text' | 'image' | 'both';
    deletedAt?: string;
    deletedBy?: string;
  }>;
  bankAccount?: {
    bankName: string;
    accountName: string;
    accountNumber: string;
  };
  /** List of admin emails (managed by super admin) */
  adminEmails?: string[];
  /** Admin permissions - what each admin can do */
  adminPermissions?: {
    [email: string]: AdminPermissions;
  };
  /** Pickup system configuration */
  pickup?: {
    /** Whether pickup is currently available */
    enabled: boolean;
    /** Pickup location */
    location: string;
    /** Pickup date/time start */
    startDate?: string;
    /** Pickup date/time end */
    endDate?: string;
    /** Additional notes for pickup */
    notes?: string;
    /** Last updated by */
    updatedBy?: string;
    /** Last update time */
    updatedAt?: string;
  };
  /** Events & Promotions */
  events?: Array<{
    id: string;
    enabled: boolean;
    title: string;
    description?: string;
    /** Banner image URL */
    imageUrl?: string;
    /** Event color theme */
    color: string;
    /** 'event' | 'promotion' | 'sale' | 'announcement' */
    type: 'event' | 'promotion' | 'sale' | 'announcement';
    /** Start date (for countdown) */
    startDate?: string;
    /** End date (for expiry) */
    endDate?: string;
    /** CTA button text */
    ctaText?: string;
    /** CTA link (product ID or URL) */
    ctaLink?: string;
    /** Discount badge text e.g. "ลด 20%", "ฟรีค่าส่ง" */
    badge?: string;
    /** Priority order (lower = higher priority) */
    priority?: number;
    /** สินค้าที่เข้าร่วมอีเวนต์ (product IDs) */
    linkedProducts?: string[];
    /** ประเภทส่วนลด: 'percent' = ลดเป็น%, 'fixed' = ลดเป็นจำนวนเงิน */
    discountType?: 'percent' | 'fixed';
    /** จำนวนส่วนลด (เช่น 20 = ลด 20% หรือ ลด 20 บาท) */
    discountValue?: number;
    /** Created by admin email */
    createdBy?: string;
    /** Creation timestamp */
    createdAt: string;
    /** Last updated */
    updatedAt?: string;
  }>;
  /** รหัสส่วนลด (Promo Codes) */
  promoCodes?: Array<{
    id: string;
    /** รหัสที่ลูกค้ากรอก */
    code: string;
    /** เปิดใช้งาน */
    enabled: boolean;
    /** ประเภทส่วนลด */
    discountType: 'percent' | 'fixed';
    /** จำนวนส่วนลด */
    discountValue: number;
    /** ยอดขั้นต่ำที่ใช้โค้ดได้ */
    minOrderAmount?: number;
    /** ส่วนลดสูงสุด (สำหรับ percent) */
    maxDiscount?: number;
    /** จำนวนครั้งที่ใช้ได้ (null = ไม่จำกัด) */
    usageLimit?: number | null;
    /** จำนวนครั้งที่ใช้ไปแล้ว */
    usageCount?: number;
    /** วันหมดอายุ */
    expiresAt?: string;
    /** คำอธิบาย */
    description?: string;
    /** สร้างโดย */
    createdBy?: string;
    createdAt: string;
  }>;
  /** ไลฟ์สดขายของ (Live Stream) */
  liveStream?: {
    /** เปิดใช้งานไลฟ์สด */
    enabled: boolean;
    /** ชื่อไลฟ์ */
    title: string;
    /** คำอธิบาย */
    description?: string;
    /** URL ของ HLS stream (.m3u8) หรือ embed URL (YouTube/Facebook) */
    streamUrl: string;
    /** ประเภท stream */
    streamType: 'hls' | 'youtube' | 'facebook' | 'custom';
    /** รูปปก thumbnail */
    thumbnailUrl?: string;
    /** เวลาเริ่มไลฟ์ */
    startedAt?: string;
    /** เวลาจบไลฟ์ */
    endedAt?: string;
    /** แสดง popup อัตโนมัติเมื่อมีไลฟ์ */
    autoPopup: boolean;
    /** สินค้าที่ขายในไลฟ์ (product IDs) */
    featuredProducts?: string[];
    /** ตั้งค่าโดย */
    updatedBy?: string;
    /** อัปเดตล่าสุด */
    updatedAt?: string;
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

// Super admin - can manage other admins (cannot be removed)
export const SUPER_ADMIN_EMAIL = 'doralaikon.th@gmail.com';

// Normalize to lowercase and trim to avoid casing/whitespace mismatches
export const ADMIN_EMAILS = ADMIN_EMAILS_RAW.map((e) => e.trim().toLowerCase()).filter(Boolean);

// Dynamic admin check - supports runtime admin list from config
let dynamicAdminEmails: string[] = [];

export const setDynamicAdminEmails = (emails: string[]) => {
  dynamicAdminEmails = emails.map(e => e.trim().toLowerCase()).filter(Boolean);
};

export const isSuperAdmin = (email: string | null): boolean => {
  if (!email) return false;
  return email.trim().toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
};

export const isAdmin = (email: string | null): boolean => {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  // Check super admin first
  if (normalized === SUPER_ADMIN_EMAIL.toLowerCase()) return true;
  // Check static list
  if (ADMIN_EMAILS.includes(normalized)) return true;
  // Check dynamic list from config
  if (dynamicAdminEmails.includes(normalized)) return true;
  return false;
};

export const SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL', '7XL', '8XL', '9XL', '10XL'];
export const ORDER_STATUSES = ['PENDING', 'PAID', 'READY', 'SHIPPED', 'COMPLETED', 'CANCELLED'];
export const PRODUCT_TYPES = ['JERSEY', 'CREW', 'OTHER'];
export const PRODUCT_CATEGORIES: ProductCategory[] = ['APPAREL', 'MERCHANDISE', 'CAMP_FEE', 'EVENT', 'SERVICE', 'OTHER'];
export const ANNOUNCEMENT_COLORS = ['blue', 'red', 'green', 'orange'];

/** Helper: Get category from legacy type */
export const getCategoryFromType = (type: string): ProductCategory => {
  switch (type) {
    case 'JERSEY':
    case 'CREW':
      return 'APPAREL';
    default:
      return 'OTHER';
  }
};

/** Helper: Check if product requires size selection */
export const productRequiresSize = (product: Product): boolean => {
  if (product.options?.requiresSize === false) return false;
  const category = product.category || getCategoryFromType(product.type);
  return category === 'APPAREL';
};

/** Helper: Check if product is a camp registration */
export const isCampProduct = (product: Product): boolean => {
  return product.category === 'CAMP_FEE' || product.subType === 'CAMP_REGISTRATION';
};

/** Helper: Check if product is an event ticket */
export const isEventProduct = (product: Product): boolean => {
  return product.category === 'EVENT' || product.subType === 'EVENT_TICKET';
};

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
  vendorSheetId: '',
  vendorSheetUrl: '',
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
