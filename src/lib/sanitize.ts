// src/lib/sanitize.ts
// Data sanitization utilities for API responses

import { ShopConfig, Product } from './config';
import { encryptImageUrl } from './image-crypto';

// ==================== IMAGE URL PROXY ====================

/**
 * Encode real image URL to proxy URL using AES-256-GCM encryption
 * แปลง https://ipfs.filebase.io/... → /api/image/[encrypted-id]
 * 
 * Uses advanced encryption from image-crypto module
 */
export function encodeImageUrl(url: string | undefined | null): string {
  if (!url) return '';
  
  // Skip if already a proxy URL
  if (url.startsWith('/api/image/')) return url;
  
  // Skip data URLs
  if (url.startsWith('data:')) return url;
  
  // Use AES-256-GCM encryption
  return encryptImageUrl(url);
}

/**
 * Encode all image URLs in a product
 */
function sanitizeProductImages(product: Product): Product {
  return {
    ...product,
    images: (product.images || []).map(encodeImageUrl),
    coverImage: encodeImageUrl(product.coverImage),
  };
}

// ==================== SENSITIVE FIELD DEFINITIONS ====================

/**
 * Fields that should NEVER be sent to frontend
 */
const BLOCKED_FIELDS = [
  'adminEmails',
  'adminPermissions',
  'sheetId',
  'vendorSheetId',
  'permissions',
  '_key',
  'slip',           // Slip data contains sensitive payment info
  'slipCheck',
  'base64',         // Raw image data
  'apiKey',
  'secretKey',
  'password',
  'token',
  'accessKey',
  'privateKey',
];

/**
 * Fields that should be masked (show partial info)
 */
const MASKED_FIELDS = [
  'customerEmail',
  'email',
];

// ==================== SANITIZATION FUNCTIONS ====================

/**
 * Remove sensitive fields from any object recursively
 */
export function removeSensitiveFields<T>(obj: T, blockedFields: string[] = BLOCKED_FIELDS): T {
  if (obj === null || obj === undefined) return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => removeSensitiveFields(item, blockedFields)) as T;
  }
  
  if (typeof obj === 'object') {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj as Record<string, any>)) {
      // Skip blocked fields
      if (blockedFields.includes(key)) continue;
      
      // Recursively clean nested objects
      if (typeof value === 'object' && value !== null) {
        result[key] = removeSensitiveFields(value, blockedFields);
      } else {
        result[key] = value;
      }
    }
    return result as T;
  }
  
  return obj;
}

/**
 * Mask email for display (show only first 3 chars and domain)
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return '';
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  const visiblePart = local.length > 3 ? local.slice(0, 3) : local.slice(0, 1);
  return `${visiblePart}***@${domain}`;
}

/**
 * Mask phone number (show only last 4 digits)
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '****';
  return `***-***-${digits.slice(-4)}`;
}

// ==================== CONFIG SANITIZATION ====================

/**
 * Public config fields that are safe for frontend
 * SECURITY: ไม่รวม sheetUrl, sheetId, vendorSheetUrl, vendorSheetId
 */
interface PublicShopConfig {
  isOpen: boolean;
  closeDate: string;
  products: Product[];
  announcement?: {
    enabled: boolean;
    message: string;
    color: string;
    imageUrl?: string;
    displayName?: string;
    postedAt?: string;
    type?: 'text' | 'image' | 'both';
    showLogo?: boolean;
    id?: string;
  };
  announcements?: Array<{
    id: string;
    enabled: boolean;
    message: string;
    color: string;
    imageUrl?: string;
    displayName?: string;
    postedAt: string;
    type?: 'text' | 'image' | 'both';
    showLogo?: boolean;
    priority?: number;
  }>;
  bankAccount?: {
    bankName: string;
    accountName: string;
    // SECURITY: Mask account number for security
    accountNumberMasked: string;
  };
}

/**
 * Mask account number - แสดงแค่ 4 ตัวท้าย
 * เช่น 123-456789-0 → ***-******-0 (แสดง 4 ตัวสุดท้าย)
 */
function maskAccountNumber(accountNumber: string | null | undefined): string {
  if (!accountNumber) return '';
  const cleaned = accountNumber.replace(/\D/g, '');
  if (cleaned.length <= 4) return accountNumber;
  const lastFour = cleaned.slice(-4);
  const maskedPart = '*'.repeat(cleaned.length - 4);
  return `${maskedPart}${lastFour}`;
}

/**
 * Sanitize shop config for public/frontend use
 * SECURITY: Removes adminEmails, adminPermissions, sheetId, sheetUrl, vendorSheetId, vendorSheetUrl
 * SECURITY: Encodes all image URLs to hide real storage paths
 */
export function sanitizeConfigForPublic(config: ShopConfig | null): PublicShopConfig | null {
  if (!config) return null;
  
  // SECURITY: Explicitly pick only safe fields - NO sheet URLs!
  // SECURITY: Encode all image URLs
  const sanitized: PublicShopConfig = {
    isOpen: config.isOpen,
    closeDate: config.closeDate,
    products: (config.products || []).map(sanitizeProductImages),
    // REMOVED: sheetUrl, vendorSheetUrl - ไม่ส่งให้ frontend
  };
  
  // Copy announcement without postedBy email, encode image URLs
  if (config.announcement) {
    sanitized.announcement = {
      enabled: config.announcement.enabled,
      message: config.announcement.message,
      color: config.announcement.color,
      imageUrl: encodeImageUrl(config.announcement.imageUrl),
      displayName: config.announcement.displayName,
      postedAt: config.announcement.postedAt,
      type: config.announcement.type,
      showLogo: config.announcement.showLogo,
      id: config.announcement.id,
    };
  }
  
  // Copy announcements without postedBy emails, encode image URLs
  if (config.announcements) {
    sanitized.announcements = config.announcements.map(a => ({
      id: a.id,
      enabled: a.enabled,
      message: a.message,
      color: a.color,
      imageUrl: encodeImageUrl(a.imageUrl),
      displayName: a.displayName,
      postedAt: a.postedAt,
      type: a.type,
      showLogo: a.showLogo,
      priority: a.priority,
    }));
  }
  
  // Bank account - mask account number for security
  if (config.bankAccount) {
    sanitized.bankAccount = {
      bankName: config.bankAccount.bankName,
      accountName: config.bankAccount.accountName,
      accountNumberMasked: maskAccountNumber(config.bankAccount.accountNumber),
    };
  }
  
  return sanitized;
}

/**
 * Sanitize config for admin use (keeps some sensitive fields but removes API keys)
 * SECURITY: Still encodes image URLs to prevent URL exposure in network requests
 */
export function sanitizeConfigForAdmin(config: ShopConfig | null): ShopConfig | null {
  if (!config) return null;
  
  // For admin, we keep adminEmails and permissions but remove any API keys
  // Still encode image URLs to prevent exposure
  const result: ShopConfig = {
    ...config,
    // Encode product images
    products: (config.products || []).map(p => ({
      ...p,
      images: (p.images || []).map(encodeImageUrl),
      coverImage: encodeImageUrl(p.coverImage),
    })),
  };
  
  // Encode announcement images
  if (result.announcement) {
    result.announcement = {
      ...result.announcement,
      imageUrl: encodeImageUrl(result.announcement.imageUrl),
    };
  }
  
  // Encode announcements images
  if (result.announcements) {
    result.announcements = result.announcements.map(a => ({
      ...a,
      imageUrl: encodeImageUrl(a.imageUrl),
    }));
  }
  
  // Clean announcement history from raw data
  if (result.announcementHistory) {
    result.announcementHistory = result.announcementHistory.map(h => ({
      ...h,
      imageUrl: encodeImageUrl(h.imageUrl),
      // Keep postedBy for admin audit trail
    }));
  }
  
  return result;
}

// ==================== ORDER SANITIZATION ====================

/**
 * Fields to include in public order response
 */
interface PublicOrder {
  ref: string;
  date: string;
  status: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  customerInstagram?: string;
  cart?: any[];
  items?: any[];
  totalAmount?: number;
  amount?: number;
  baseAmount?: number;
  discount?: number;
  notes?: string;
  verifiedAt?: string;
  hasSlip?: boolean;
  // Tracking info for shipped orders
  trackingNumber?: string;
  shippingProvider?: string;
  shippingMethod?: string;
  // Shipping info
  shippingFee?: number;
  shippingOption?: string;
}

/**
 * Sanitize order for user view (owner can see their own data)
 * Removes: slip data, internal fields
 */
export function sanitizeOrderForUser(order: any): PublicOrder | null {
  if (!order) return null;
  
  // Calculate shipping fee from total - cart subtotal if not explicitly set
  let shippingFee = order.shippingFee || order.shipping_fee;
  if (shippingFee === undefined || shippingFee === null) {
    const cart = order.cart || order.items || [];
    const cartSubtotal = cart.reduce((sum: number, item: any) => {
      const price = item.unitPrice || item.price || 0;
      const qty = item.quantity || 1;
      return sum + (price * qty);
    }, 0);
    const totalAmount = order.totalAmount || order.total_amount || order.amount || 0;
    const calculatedFee = totalAmount - cartSubtotal;
    // Only set shipping fee if it's a positive value (difference indicates shipping)
    if (calculatedFee > 0 && calculatedFee < 200) { // Reasonable shipping fee range
      shippingFee = calculatedFee;
    }
  }
  
  return {
    ref: order.ref,
    date: order.date || order.createdAt,
    status: order.status,
    customerName: order.customerName || order.name,
    customerPhone: order.customerPhone || order.phone,
    customerAddress: order.customerAddress || order.address,
    customerInstagram: order.customerInstagram || order.instagram,
    cart: order.cart,
    items: order.items,
    totalAmount: order.totalAmount,
    amount: order.amount,
    baseAmount: order.baseAmount,
    discount: order.discount,
    notes: order.notes,
    verifiedAt: order.verifiedAt,
    hasSlip: !!(order.slip && order.slip.base64),
    // Include tracking info for shipped orders
    trackingNumber: order.trackingNumber,
    shippingProvider: order.shippingProvider,
    shippingMethod: order.shippingMethod,
    // Include shipping info (calculated if not explicitly set)
    shippingFee: shippingFee,
    shippingOption: order.shippingOption || order.shipping_option,
  };
}

/**
 * Sanitize order for admin view (can see more but still no raw slip base64)
 */
export function sanitizeOrderForAdmin(order: any): any {
  if (!order) return null;
  
  const result = { ...order };
  
  // Remove raw base64 but keep metadata and imageUrl
  if (result.slip) {
    result.slip = {
      uploadedAt: result.slip.uploadedAt,
      mime: result.slip.mime,
      fileName: result.slip.fileName,
      hasData: !!(result.slip.base64 || result.slip.imageUrl),
      // Keep imageUrl for SlipOK S3 images (URL is safe to expose)
      imageUrl: result.slip.imageUrl,
      // Keep slipData for verification details
      slipData: result.slip.slipData,
      // Remove actual base64 data (large, sensitive)
    };
  }
  
  // Remove internal keys
  delete result._key;
  
  return result;
}

/**
 * Sanitize order list for API response
 */
export function sanitizeOrdersForUser(orders: any[]): PublicOrder[] {
  return orders.map(sanitizeOrderForUser).filter(Boolean) as PublicOrder[];
}

export function sanitizeOrdersForAdmin(orders: any[]): any[] {
  return orders.map(sanitizeOrderForAdmin).filter(Boolean);
}

// ==================== INPUT VALIDATION & UTF-8 ====================

/**
 * Validate and normalize UTF-8 string input
 * Removes invalid characters and normalizes unicode
 */
export function sanitizeUtf8Input(input: string | null | undefined): string {
  if (!input) return '';
  
  // Normalize to NFC form (canonical composition)
  let result = input.normalize('NFC');
  
  // Remove control characters except newlines and tabs
  result = result.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  // Remove null bytes
  result = result.replace(/\0/g, '');
  
  // Trim whitespace
  result = result.trim();
  
  return result;
}

/**
 * Sanitize object with UTF-8 normalization for all string fields
 */
export function sanitizeObjectUtf8<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj === 'string') {
    return sanitizeUtf8Input(obj) as T;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObjectUtf8(item)) as T;
  }
  
  if (typeof obj === 'object') {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj as Record<string, any>)) {
      result[key] = sanitizeObjectUtf8(value);
    }
    return result as T;
  }
  
  return obj;
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone format (Thai format)
 */
export function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 9 && digits.length <= 12;
}

/**
 * Sanitize user input for storage
 */
export function sanitizeUserInput(input: string, maxLength: number = 500): string {
  let result = sanitizeUtf8Input(input);
  
  // Limit length
  if (result.length > maxLength) {
    result = result.slice(0, maxLength);
  }
  
  // Escape potential HTML/script injection (basic)
  result = result
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
  
  return result;
}

// ==================== RESPONSE HELPER ====================

/**
 * Create sanitized JSON response with proper UTF-8 encoding
 */
export function createSanitizedResponse(data: any, status: number = 200) {
  const sanitizedData = sanitizeObjectUtf8(data);
  
  return new Response(JSON.stringify(sanitizedData), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
