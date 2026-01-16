// src/lib/validation.ts
// Input validation and sanitization utilities

/**
 * Sanitize string input - remove dangerous characters and limit length
 */
export const sanitizeString = (input: string | null | undefined, maxLength = 500): string => {
  if (!input) return '';
  return input
    .toString()
    .trim()
    .slice(0, maxLength)
    // Remove potentially dangerous HTML/script tags
    .replace(/<[^>]*>/g, '')
    // Remove null bytes
    .replace(/\0/g, '');
};

/**
 * Sanitize HTML - escape dangerous characters
 */
export const escapeHtml = (input: string): string => {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return input.replace(/[&<>"']/g, (char) => map[char] || char);
};

/**
 * Validate email format
 */
export const isValidEmail = (email: string | null | undefined): boolean => {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim()) && email.length <= 254;
};

/**
 * Validate Thai phone number
 */
export const isValidThaiPhone = (phone: string | null | undefined): boolean => {
  if (!phone) return false;
  const cleaned = phone.replace(/[\s\-\.]/g, '');
  // Thai mobile: 08x, 09x (10 digits)
  // Thai landline: 02x, 03x, etc. (9 digits)
  return /^0[0-9]{8,9}$/.test(cleaned);
};

/**
 * Sanitize phone number - keep only digits
 */
export const sanitizePhone = (phone: string | null | undefined): string => {
  if (!phone) return '';
  return phone.replace(/[^\d]/g, '').slice(0, 12);
};

/**
 * Validate order reference format
 */
export const isValidOrderRef = (ref: string | null | undefined): boolean => {
  if (!ref) return false;
  // Only allow alphanumeric, hyphens, and underscores
  return /^[A-Za-z0-9\-_]{3,50}$/.test(ref);
};

/**
 * Sanitize order reference
 */
export const sanitizeOrderRef = (ref: string | null | undefined): string => {
  if (!ref) return '';
  return ref.replace(/[^A-Za-z0-9\-_]/g, '').slice(0, 50);
};

/**
 * Validate price/amount
 */
export const isValidAmount = (amount: number | null | undefined): boolean => {
  if (amount === null || amount === undefined) return false;
  return !isNaN(amount) && amount >= 0 && amount <= 9999999 && Number.isFinite(amount);
};

/**
 * Validate base64 image data
 */
export const isValidBase64Image = (data: string | null | undefined): boolean => {
  if (!data) return false;
  // Check if it's a valid base64 string or data URI
  const base64Regex = /^data:image\/(png|jpeg|jpg|gif|webp);base64,[A-Za-z0-9+/=]+$/;
  const rawBase64Regex = /^[A-Za-z0-9+/=]+$/;
  return base64Regex.test(data) || rawBase64Regex.test(data);
};

/**
 * Validate and sanitize JSON object keys
 */
export const sanitizeObjectKeys = (obj: Record<string, any>, allowedKeys: string[]): Record<string, any> => {
  const result: Record<string, any> = {};
  for (const key of allowedKeys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result;
};

/**
 * Validate file size (in bytes)
 */
export const isValidFileSize = (base64Data: string, maxSizeBytes = 5 * 1024 * 1024): boolean => {
  // Base64 is approximately 4/3 the size of the original
  const data = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
  const approximateSize = (data.length * 3) / 4;
  return approximateSize <= maxSizeBytes;
};

/**
 * Validate Instagram handle
 */
export const isValidInstagramHandle = (handle: string | null | undefined): boolean => {
  if (!handle) return true; // Optional field
  // Instagram: 1-30 chars, alphanumeric and underscores/periods
  const cleaned = handle.replace(/^@/, '');
  return /^[a-zA-Z0-9._]{1,30}$/.test(cleaned);
};

/**
 * Sanitize Instagram handle
 */
export const sanitizeInstagramHandle = (handle: string | null | undefined): string => {
  if (!handle) return '';
  return handle.replace(/^@/, '').replace(/[^a-zA-Z0-9._]/g, '').slice(0, 30);
};

/**
 * Rate limit check result
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
}

/**
 * Simple in-memory rate limiter (for single instance)
 * For production, use Redis or similar
 */
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export const checkRateLimit = (
  key: string,
  maxRequests = 10,
  windowMs = 60000
): RateLimitResult => {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetTime < now) {
    // New window
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetTime: now + windowMs };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetTime: entry.resetTime };
  }

  entry.count++;
  rateLimitStore.set(key, entry);
  return { allowed: true, remaining: maxRequests - entry.count, resetTime: entry.resetTime };
};

/**
 * Clean up expired rate limit entries (call periodically)
 */
export const cleanupRateLimits = (): void => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
};
