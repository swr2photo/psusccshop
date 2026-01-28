// src/lib/request-signing.ts
// Request signing and validation for API security
// ป้องกันการปลอมแปลง requests และ replay attacks

import crypto from 'crypto';

// ==================== CONFIGURATION ====================

const REQUEST_SIGNATURE_SECRET = process.env.REQUEST_SIGNATURE_SECRET || process.env.NEXTAUTH_SECRET || '';
const SIGNATURE_VALIDITY_MS = 300000; // 5 minutes
const NONCE_CACHE_SIZE = 10000;

if (!REQUEST_SIGNATURE_SECRET && typeof window === 'undefined') {
  console.warn('[Security] REQUEST_SIGNATURE_SECRET not set, using fallback');
}

// ==================== NONCE CACHE (Prevent Replay Attacks) ====================

const usedNonces = new Map<string, number>();

// Cleanup old nonces periodically
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [nonce, timestamp] of usedNonces.entries()) {
      if (now - timestamp > SIGNATURE_VALIDITY_MS * 2) {
        usedNonces.delete(nonce);
      }
    }
  }, 60000);
}

function isNonceUsed(nonce: string): boolean {
  return usedNonces.has(nonce);
}

function markNonceAsUsed(nonce: string): void {
  // Prevent cache from growing too large
  if (usedNonces.size >= NONCE_CACHE_SIZE) {
    const oldestKey = usedNonces.keys().next().value;
    if (oldestKey) usedNonces.delete(oldestKey);
  }
  usedNonces.set(nonce, Date.now());
}

// ==================== SIGNATURE FUNCTIONS ====================

export interface SignedRequest {
  timestamp: number;
  nonce: string;
  signature: string;
  payload?: any;
}

/**
 * Generate HMAC-SHA256 signature for request
 */
function generateSignature(data: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('hex');
}

/**
 * Create a signed request payload
 * @param payload - The data to sign
 * @param secret - Optional custom secret (uses env var by default)
 */
export function signRequest(payload: any, secret?: string): SignedRequest {
  const timestamp = Date.now();
  const nonce = crypto.randomBytes(16).toString('hex');
  const dataToSign = JSON.stringify({ timestamp, nonce, payload });
  const signature = generateSignature(dataToSign, secret || REQUEST_SIGNATURE_SECRET);
  
  return {
    timestamp,
    nonce,
    signature,
    payload,
  };
}

/**
 * Verify a signed request
 * @returns Object with valid status and optional error message
 */
export function verifySignedRequest(
  signedRequest: SignedRequest,
  secret?: string
): { valid: boolean; error?: string } {
  const { timestamp, nonce, signature, payload } = signedRequest;
  
  // Check required fields
  if (!timestamp || !nonce || !signature) {
    return { valid: false, error: 'Missing required signature fields' };
  }
  
  // Check timestamp validity
  const now = Date.now();
  if (Math.abs(now - timestamp) > SIGNATURE_VALIDITY_MS) {
    return { valid: false, error: 'Request timestamp expired' };
  }
  
  // Check nonce replay
  if (isNonceUsed(nonce)) {
    return { valid: false, error: 'Nonce already used (replay attack detected)' };
  }
  
  // Verify signature
  const dataToSign = JSON.stringify({ timestamp, nonce, payload });
  const expectedSignature = generateSignature(dataToSign, secret || REQUEST_SIGNATURE_SECRET);
  
  // Timing-safe comparison
  if (signature.length !== expectedSignature.length) {
    return { valid: false, error: 'Invalid signature' };
  }
  
  const signatureBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');
  
  if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return { valid: false, error: 'Invalid signature' };
  }
  
  // Mark nonce as used
  markNonceAsUsed(nonce);
  
  return { valid: true };
}

// ==================== SESSION FINGERPRINTING ====================

export interface SessionFingerprint {
  userAgent: string;
  acceptLanguage: string;
  acceptEncoding: string;
  ipHash: string;
  fingerprintHash: string;
}

/**
 * Generate session fingerprint from request headers
 */
export function generateSessionFingerprint(
  userAgent: string | null,
  acceptLanguage: string | null,
  acceptEncoding: string | null,
  clientIP: string
): SessionFingerprint {
  const ua = userAgent || 'unknown';
  const lang = acceptLanguage || 'unknown';
  const enc = acceptEncoding || 'unknown';
  
  // Hash the IP for privacy
  const ipHash = crypto.createHash('sha256').update(clientIP).digest('hex').substring(0, 16);
  
  // Create combined fingerprint hash
  const fingerprintData = `${ua}|${lang}|${enc}|${ipHash}`;
  const fingerprintHash = crypto.createHash('sha256').update(fingerprintData).digest('hex');
  
  return {
    userAgent: ua,
    acceptLanguage: lang,
    acceptEncoding: enc,
    ipHash,
    fingerprintHash,
  };
}

/**
 * Validate session fingerprint matches
 * @returns true if fingerprints match within tolerance
 */
export function validateSessionFingerprint(
  stored: SessionFingerprint,
  current: SessionFingerprint
): { valid: boolean; changes: string[] } {
  const changes: string[] = [];
  
  // Check each component
  if (stored.userAgent !== current.userAgent) {
    changes.push('userAgent');
  }
  if (stored.acceptLanguage !== current.acceptLanguage) {
    changes.push('acceptLanguage');
  }
  if (stored.ipHash !== current.ipHash) {
    changes.push('ipAddress');
  }
  
  // Allow some changes (network switching, etc.) but flag significant changes
  const valid = changes.length < 2; // Allow 1 change, flag 2+
  
  return { valid, changes };
}

// ==================== API KEY AUTHENTICATION ====================

export interface APIKey {
  key: string;
  name: string;
  permissions: string[];
  rateLimit: number;
  createdAt: number;
  expiresAt?: number;
  lastUsedAt?: number;
}

/**
 * Generate a new API key
 */
export function generateAPIKey(prefix: string = 'psuscc'): string {
  const randomPart = crypto.randomBytes(24).toString('base64url');
  return `${prefix}_${randomPart}`;
}

/**
 * Hash API key for storage
 */
export function hashAPIKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Validate API key format
 */
export function isValidAPIKeyFormat(key: string): boolean {
  return /^[a-zA-Z0-9_]{6,}$/.test(key);
}

// ==================== ENCRYPTION HELPERS ====================

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';

/**
 * Encrypt sensitive data
 */
export function encryptData(data: string, key?: string): string {
  const encKey = key || REQUEST_SIGNATURE_SECRET;
  const keyBuffer = crypto.createHash('sha256').update(encKey).digest();
  const iv = crypto.randomBytes(16);
  
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, keyBuffer, iv);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt sensitive data
 */
export function decryptData(encryptedData: string, key?: string): string | null {
  try {
    const encKey = key || REQUEST_SIGNATURE_SECRET;
    const keyBuffer = crypto.createHash('sha256').update(encKey).digest();
    
    const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
    if (!ivHex || !authTagHex || !encrypted) return null;
    
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, keyBuffer, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('[Security] Decryption failed:', error);
    return null;
  }
}

// ==================== TOKEN GENERATION ====================

/**
 * Generate secure random token
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Generate URL-safe token
 */
export function generateUrlSafeToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('base64url');
}

/**
 * Generate short numeric code (for OTP, etc.)
 */
export function generateNumericCode(length: number = 6): string {
  const max = Math.pow(10, length);
  const randomNum = crypto.randomInt(max);
  return randomNum.toString().padStart(length, '0');
}
