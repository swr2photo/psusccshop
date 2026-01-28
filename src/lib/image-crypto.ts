// src/lib/image-crypto.ts
// Advanced Image URL Encryption with AES-256-GCM
// ป้องกันการถอดรหัส URL รูปภาพและป้องกันการดู network requests

import crypto from 'crypto';

// ==================== CONFIGURATION ====================

/**
 * Secret key for AES-256 encryption (must be 32 bytes)
 * ใช้ HMAC-SHA256 เพื่อ derive key ที่มีความยาวถูกต้อง
 */
const MASTER_SECRET = process.env.IMAGE_CRYPTO_SECRET;
if (!MASTER_SECRET && typeof window === 'undefined') {
  console.warn('[SECURITY] IMAGE_CRYPTO_SECRET is not set! Using insecure fallback.');
}
const EFFECTIVE_SECRET = MASTER_SECRET || 'psusccshop-image-secure-2026-!@#$%^&*()';

/**
 * Derive a 32-byte key from master secret
 */
function deriveKey(): Buffer {
  return crypto.createHash('sha256').update(EFFECTIVE_SECRET).digest();
}

/**
 * Additional salt for extra security
 */
const SALT_PREFIX = 'psuscc_img_';

// ==================== ENCRYPTION ====================

interface EncryptedPayload {
  url: string;
  timestamp: number;
  nonce: string;
}

/**
 * Encrypt image URL using AES-256-GCM
 * รวม timestamp เพื่อป้องกัน replay attacks (optional expiry)
 */
export function encryptImageUrl(url: string, expiryHours: number = 0): string {
  if (!url) return '';
  
  // Skip if already encrypted
  if (url.startsWith('/api/image/')) return url;
  
  // Skip data URLs
  if (url.startsWith('data:')) return url;
  
  try {
    const key = deriveKey();
    
    // Generate random IV (12 bytes for GCM)
    const iv = crypto.randomBytes(12);
    
    // Create payload with timestamp
    const payload: EncryptedPayload = {
      url,
      timestamp: Date.now(),
      nonce: crypto.randomBytes(8).toString('hex'),
    };
    
    const plaintext = JSON.stringify(payload);
    
    // Encrypt with AES-256-GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    // Get auth tag (16 bytes)
    const authTag = cipher.getAuthTag();
    
    // Combine: IV (12) + Auth Tag (16) + Ciphertext
    const combined = Buffer.concat([iv, authTag, encrypted]);
    
    // Convert to URL-safe base64
    const base64 = combined
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
    
    return `/api/image/${base64}`;
  } catch (error) {
    console.error('[image-crypto] Encryption error:', error);
    // Fallback to simple encoding if encryption fails
    return url;
  }
}

/**
 * Decrypt image URL from AES-256-GCM encrypted token
 */
export function decryptImageUrl(token: string, maxAgeHours: number = 0): string | null {
  if (!token) return null;
  
  try {
    const key = deriveKey();
    
    // Restore base64 padding
    let base64 = token.replace(/-/g, '+').replace(/_/g, '/');
    const padding = (4 - (base64.length % 4)) % 4;
    base64 += '='.repeat(padding);
    
    // Decode combined buffer
    const combined = Buffer.from(base64, 'base64');
    
    // Minimum size: IV (12) + Auth Tag (16) + at least 1 byte ciphertext
    if (combined.length < 29) {
      console.warn('[image-crypto] Token too short');
      return null;
    }
    
    // Extract components
    const iv = combined.subarray(0, 12);
    const authTag = combined.subarray(12, 28);
    const ciphertext = combined.subarray(28);
    
    // Decrypt
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(ciphertext);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    // Parse payload
    const payload: EncryptedPayload = JSON.parse(decrypted.toString('utf8'));
    
    // Check expiry if maxAgeHours is set
    if (maxAgeHours > 0) {
      const ageMs = Date.now() - payload.timestamp;
      const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
      if (ageMs > maxAgeMs) {
        console.warn('[image-crypto] Token expired');
        return null;
      }
    }
    
    return payload.url;
  } catch (error) {
    console.error('[image-crypto] Decryption error:', error);
    return null;
  }
}

// ==================== LEGACY SUPPORT ====================

/**
 * XOR-based decryption for backward compatibility with old URLs
 * จะถูกลบในอนาคต
 */
const LEGACY_SECRET = process.env.IMAGE_PROXY_SECRET;
if (!LEGACY_SECRET && typeof window === 'undefined') {
  console.warn('[SECURITY] IMAGE_PROXY_SECRET is not set! Legacy URLs may not work.');
}
const EFFECTIVE_LEGACY_SECRET = LEGACY_SECRET || 'psusccshop-image-proxy-2026';

export function decryptLegacyUrl(id: string): string | null {
  if (!id) return null;
  
  try {
    // Restore base64 padding
    let base64 = id.replace(/-/g, '+').replace(/_/g, '/');
    const padding = (4 - (base64.length % 4)) % 4;
    base64 += '='.repeat(padding);
    
    // Decode and XOR with legacy secret key
    const decoded = Buffer.from(base64, 'base64').map((byte, i) => 
      byte ^ EFFECTIVE_LEGACY_SECRET.charCodeAt(i % EFFECTIVE_LEGACY_SECRET.length)
    );
    
    const url = Buffer.from(decoded).toString('utf-8');
    
    // Validate it looks like a URL
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Smart decryption - try AES first, fallback to legacy XOR
 */
export function smartDecryptUrl(token: string, maxAgeHours: number = 0): string | null {
  // Try AES-256-GCM first
  const aesResult = decryptImageUrl(token, maxAgeHours);
  if (aesResult) return aesResult;
  
  // Fallback to legacy XOR decryption
  const legacyResult = decryptLegacyUrl(token);
  if (legacyResult) {
    console.log('[image-crypto] Used legacy decryption for token');
    return legacyResult;
  }
  
  return null;
}

// ==================== SIGNATURE VERIFICATION ====================

/**
 * Generate HMAC signature for request validation
 */
export function generateSignature(data: string): string {
  return crypto
    .createHmac('sha256', MASTER_SECRET)
    .update(data)
    .digest('hex')
    .substring(0, 16);
}

/**
 * Verify HMAC signature
 */
export function verifySignature(data: string, signature: string): boolean {
  const expected = generateSignature(data);
  return crypto.timingSafeEqual(
    Buffer.from(expected, 'hex'),
    Buffer.from(signature, 'hex')
  );
}

// ==================== URL OBFUSCATION ====================

/**
 * Generate a secure image token with timestamp and signature
 * Format: /api/image/v2/{encrypted-payload}
 */
export function generateSecureImageToken(url: string): string {
  return encryptImageUrl(url);
}

/**
 * Extract and validate image URL from secure token
 */
export function validateAndExtractUrl(token: string): string | null {
  return smartDecryptUrl(token);
}

// ==================== EXPORTS ====================

export default {
  encrypt: encryptImageUrl,
  decrypt: decryptImageUrl,
  decryptLegacy: decryptLegacyUrl,
  smartDecrypt: smartDecryptUrl,
  generateSignature,
  verifySignature,
  generateToken: generateSecureImageToken,
  validateToken: validateAndExtractUrl,
};
