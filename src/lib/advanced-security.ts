// src/lib/advanced-security.ts
// ===================================================================
// ADVANCED SECURITY MODULE - Maximum Protection Level
// ===================================================================
// Features:
// - Request fingerprinting and anomaly detection
// - Advanced brute force protection with exponential backoff
// - IP reputation and threat intelligence
// - Request signing and integrity verification
// - Session hijacking prevention
// - Advanced input validation and sanitization
// - Real-time threat detection

import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

// ==================== CONFIGURATION ====================

const SECRET_KEY = process.env.SECURITY_SECRET_KEY || process.env.NEXTAUTH_SECRET || '';
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_BASE_DURATION_MS = 60000; // 1 minute base
const MAX_LOCKOUT_DURATION_MS = 3600000; // 1 hour max
const FINGERPRINT_VALIDITY_MS = 3600000; // 1 hour
const NONCE_VALIDITY_MS = 300000; // 5 minutes
const MAX_REQUEST_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

// ==================== TYPES ====================

export interface RequestFingerprint {
  ip: string;
  userAgent: string;
  acceptLanguage: string;
  acceptEncoding: string;
  timezone?: string;
  screenResolution?: string;
  colorDepth?: string;
  platform?: string;
  cookieEnabled?: string;
  hash: string;
  timestamp: number;
}

export interface ThreatScore {
  score: number; // 0-100, higher = more suspicious
  reasons: string[];
  level: 'safe' | 'low' | 'medium' | 'high' | 'critical';
  blocked: boolean;
}

export interface SecurityContext {
  fingerprint: RequestFingerprint;
  threatScore: ThreatScore;
  requestId: string;
  timestamp: number;
  isBot: boolean;
  isTor: boolean;
  isProxy: boolean;
  geoRisk: boolean;
}

interface FailedAttempt {
  count: number;
  lastAttempt: number;
  lockoutUntil: number;
  escalationLevel: number;
}

interface SessionData {
  fingerprint: string;
  createdAt: number;
  lastActivity: number;
  requestCount: number;
}

// ==================== IN-MEMORY STORES ====================
// Note: In production, use Redis for distributed storage

const failedAttempts = new Map<string, FailedAttempt>();
const nonces = new Map<string, number>();
const sessions = new Map<string, SessionData>();
const ipReputation = new Map<string, { score: number; lastUpdated: number }>();
const requestHistory = new Map<string, { timestamps: number[]; patterns: string[] }>();

// Known malicious patterns database
const KNOWN_MALICIOUS_IPS: string[] = [];
const TOR_EXIT_NODES: Set<string> = new Set();
const PROXY_INDICATORS = ['via', 'x-forwarded-for', 'forwarded', 'proxy-connection'];

// ==================== CLEANUP INTERVALS ====================

// Cleanup expired entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    
    // Cleanup failed attempts
    for (const [key, data] of failedAttempts.entries()) {
      if (now > data.lockoutUntil && data.lockoutUntil > 0) {
        // Reset after lockout expires
        data.count = 0;
        data.lockoutUntil = 0;
        data.escalationLevel = Math.max(0, data.escalationLevel - 1);
      }
      // Remove very old entries
      if (now - data.lastAttempt > 24 * 3600000) {
        failedAttempts.delete(key);
      }
    }
    
    // Cleanup nonces
    for (const [key, timestamp] of nonces.entries()) {
      if (now - timestamp > NONCE_VALIDITY_MS * 2) {
        nonces.delete(key);
      }
    }
    
    // Cleanup sessions
    for (const [key, data] of sessions.entries()) {
      if (now - data.lastActivity > 24 * 3600000) {
        sessions.delete(key);
      }
    }
    
    // Cleanup request history
    for (const [key, data] of requestHistory.entries()) {
      data.timestamps = data.timestamps.filter(t => now - t < 3600000);
      if (data.timestamps.length === 0) {
        requestHistory.delete(key);
      }
    }
  }, 300000);
}

// ==================== CRYPTOGRAPHIC FUNCTIONS ====================

/**
 * Generate cryptographically secure random bytes
 */
export function generateSecureRandom(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Generate secure nonce with timestamp
 */
export function generateNonce(): string {
  const timestamp = Date.now();
  const random = generateSecureRandom(16);
  const nonce = `${timestamp}-${random}`;
  nonces.set(nonce, timestamp);
  return nonce;
}

/**
 * Validate nonce (prevents replay attacks)
 */
export function validateNonce(nonce: string): boolean {
  const timestamp = nonces.get(nonce);
  if (!timestamp) return false;
  
  const now = Date.now();
  if (now - timestamp > NONCE_VALIDITY_MS) {
    nonces.delete(nonce);
    return false;
  }
  
  // Delete after use (one-time use)
  nonces.delete(nonce);
  return true;
}

/**
 * Create HMAC signature for request integrity
 */
export function signRequest(data: string, secret: string = SECRET_KEY): string {
  return crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('hex');
}

/**
 * Verify HMAC signature (timing-safe)
 */
export function verifySignature(data: string, signature: string, secret: string = SECRET_KEY): boolean {
  const expected = signRequest(data, secret);
  
  if (expected.length !== signature.length) return false;
  
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(signature, 'hex')
    );
  } catch {
    return false;
  }
}

/**
 * Hash data with salt (for storage)
 */
export function hashWithSalt(data: string, salt?: string): { hash: string; salt: string } {
  const usedSalt = salt || generateSecureRandom(16);
  const hash = crypto
    .pbkdf2Sync(data, usedSalt, 100000, 64, 'sha512')
    .toString('hex');
  return { hash, salt: usedSalt };
}

/**
 * Verify hashed data
 */
export function verifyHash(data: string, hash: string, salt: string): boolean {
  const { hash: computedHash } = hashWithSalt(data, salt);
  
  if (computedHash.length !== hash.length) return false;
  
  try {
    return crypto.timingSafeEqual(
      Buffer.from(computedHash, 'hex'),
      Buffer.from(hash, 'hex')
    );
  } catch {
    return false;
  }
}

// ==================== REQUEST FINGERPRINTING ====================

/**
 * Extract request fingerprint for device identification
 */
export function extractFingerprint(req: NextRequest): RequestFingerprint {
  const ip = getClientIP(req);
  const userAgent = req.headers.get('user-agent') || '';
  const acceptLanguage = req.headers.get('accept-language') || '';
  const acceptEncoding = req.headers.get('accept-encoding') || '';
  
  // Create a hash of the fingerprint for comparison
  const fingerprintData = [ip, userAgent, acceptLanguage].join('|');
  const hash = crypto.createHash('sha256').update(fingerprintData).digest('hex').slice(0, 32);
  
  return {
    ip,
    userAgent,
    acceptLanguage,
    acceptEncoding,
    hash,
    timestamp: Date.now(),
  };
}

/**
 * Compare fingerprints for session consistency
 */
export function compareFingerprints(fp1: RequestFingerprint, fp2: RequestFingerprint): number {
  let score = 0;
  
  if (fp1.ip === fp2.ip) score += 30;
  if (fp1.userAgent === fp2.userAgent) score += 40;
  if (fp1.acceptLanguage === fp2.acceptLanguage) score += 15;
  if (fp1.acceptEncoding === fp2.acceptEncoding) score += 15;
  
  return score;
}

// ==================== IP UTILITIES ====================

/**
 * Get client IP from request headers
 */
export function getClientIP(req: NextRequest): string {
  return (
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

/**
 * Check if IP appears to be from a proxy/VPN
 */
export function detectProxy(req: NextRequest): boolean {
  for (const header of PROXY_INDICATORS) {
    if (req.headers.get(header)) return true;
  }
  
  const xForwardedFor = req.headers.get('x-forwarded-for');
  if (xForwardedFor && xForwardedFor.includes(',')) {
    // Multiple proxies detected
    return true;
  }
  
  return false;
}

/**
 * Check if IP is a known Tor exit node
 */
export function isTorExitNode(ip: string): boolean {
  return TOR_EXIT_NODES.has(ip);
}

/**
 * Check if IP is in blocklist
 */
export function isBlockedIP(ip: string): boolean {
  return KNOWN_MALICIOUS_IPS.includes(ip);
}

// ==================== BRUTE FORCE PROTECTION ====================

/**
 * Record failed authentication attempt with exponential backoff
 */
export function recordFailedAttempt(identifier: string): {
  isLocked: boolean;
  lockoutRemaining: number;
  attemptsRemaining: number;
} {
  const now = Date.now();
  let attempt = failedAttempts.get(identifier);
  
  if (!attempt) {
    attempt = {
      count: 0,
      lastAttempt: now,
      lockoutUntil: 0,
      escalationLevel: 0,
    };
  }
  
  // Check if currently locked out
  if (now < attempt.lockoutUntil) {
    return {
      isLocked: true,
      lockoutRemaining: attempt.lockoutUntil - now,
      attemptsRemaining: 0,
    };
  }
  
  attempt.count += 1;
  attempt.lastAttempt = now;
  
  // Check if lockout threshold reached
  if (attempt.count >= MAX_FAILED_ATTEMPTS) {
    // Exponential backoff: 1min, 2min, 4min, 8min, etc. up to 1 hour
    const lockoutDuration = Math.min(
      LOCKOUT_BASE_DURATION_MS * Math.pow(2, attempt.escalationLevel),
      MAX_LOCKOUT_DURATION_MS
    );
    
    attempt.lockoutUntil = now + lockoutDuration;
    attempt.escalationLevel += 1;
    attempt.count = 0;
    
    failedAttempts.set(identifier, attempt);
    
    console.warn(`[Security] Account locked: ${identifier} for ${lockoutDuration / 1000}s (level ${attempt.escalationLevel})`);
    
    return {
      isLocked: true,
      lockoutRemaining: lockoutDuration,
      attemptsRemaining: 0,
    };
  }
  
  failedAttempts.set(identifier, attempt);
  
  return {
    isLocked: false,
    lockoutRemaining: 0,
    attemptsRemaining: MAX_FAILED_ATTEMPTS - attempt.count,
  };
}

/**
 * Clear failed attempts on successful authentication
 */
export function clearFailedAttempts(identifier: string): void {
  const attempt = failedAttempts.get(identifier);
  if (attempt) {
    attempt.count = 0;
    // Keep escalation level for repeat offenders
  }
}

/**
 * Check if currently locked out
 */
export function isLockedOut(identifier: string): boolean {
  const attempt = failedAttempts.get(identifier);
  if (!attempt) return false;
  return Date.now() < attempt.lockoutUntil;
}

// ==================== THREAT DETECTION ====================

/**
 * Analyze request for potential threats
 */
export function analyzeRequest(req: NextRequest, body?: any): ThreatScore {
  const score: ThreatScore = {
    score: 0,
    reasons: [],
    level: 'safe',
    blocked: false,
  };
  
  const ip = getClientIP(req);
  const userAgent = req.headers.get('user-agent');
  const path = req.nextUrl.pathname;
  const method = req.method;
  
  // 1. Missing or suspicious User-Agent
  if (!userAgent) {
    score.score += 25;
    score.reasons.push('missing_user_agent');
  } else if (isSuspiciousUserAgent(userAgent)) {
    score.score += 30;
    score.reasons.push('suspicious_user_agent');
  }
  
  // 2. Proxy/VPN detection
  if (detectProxy(req)) {
    score.score += 10;
    score.reasons.push('proxy_detected');
  }
  
  // 3. Tor exit node
  if (isTorExitNode(ip)) {
    score.score += 20;
    score.reasons.push('tor_exit_node');
  }
  
  // 4. Known malicious IP
  if (isBlockedIP(ip)) {
    score.score += 50;
    score.reasons.push('blocked_ip');
    score.blocked = true;
  }
  
  // 5. Path traversal attempt
  if (/\.\.[\/\\]/.test(path) || /%2e%2e/i.test(path)) {
    score.score += 40;
    score.reasons.push('path_traversal_attempt');
  }
  
  // 6. SQL Injection patterns in URL
  const queryString = req.nextUrl.search;
  if (hasSQLInjectionPatterns(queryString)) {
    score.score += 45;
    score.reasons.push('sql_injection_pattern');
  }
  
  // 7. XSS patterns in URL
  if (hasXSSPatterns(queryString)) {
    score.score += 40;
    score.reasons.push('xss_pattern');
  }
  
  // 8. Unusual HTTP method for path
  if (isUnusualMethodForPath(method, path)) {
    score.score += 15;
    score.reasons.push('unusual_method');
  }
  
  // 9. Body analysis
  if (body) {
    const bodyScore = analyzeBodyContent(body);
    score.score += bodyScore.score;
    score.reasons.push(...bodyScore.reasons);
  }
  
  // 10. Request frequency analysis
  const frequencyScore = analyzeRequestFrequency(ip, path);
  score.score += frequencyScore.score;
  score.reasons.push(...frequencyScore.reasons);
  
  // 11. IP reputation
  const reputationScore = getIPReputationScore(ip);
  if (reputationScore < 50) {
    score.score += Math.round((50 - reputationScore) / 2);
    score.reasons.push('low_ip_reputation');
  }
  
  // Determine threat level
  if (score.score >= 80) {
    score.level = 'critical';
    score.blocked = true;
  } else if (score.score >= 60) {
    score.level = 'high';
  } else if (score.score >= 40) {
    score.level = 'medium';
  } else if (score.score >= 20) {
    score.level = 'low';
  }
  
  return score;
}

/**
 * Check for suspicious User-Agent patterns
 */
function isSuspiciousUserAgent(userAgent: string): boolean {
  const suspiciousPatterns = [
    /sqlmap/i,
    /nikto/i,
    /nmap/i,
    /masscan/i,
    /burpsuite/i,
    /owasp/i,
    /dirbuster/i,
    /gobuster/i,
    /wfuzz/i,
    /ffuf/i,
    /nuclei/i,
    /metasploit/i,
    /hydra/i,
    /havij/i,
    /acunetix/i,
    /nessus/i,
    /openvas/i,
    /w3af/i,
    /arachni/i,
    /skipfish/i,
  ];
  
  return suspiciousPatterns.some(pattern => pattern.test(userAgent));
}

/**
 * Check for SQL injection patterns
 */
function hasSQLInjectionPatterns(input: string): boolean {
  if (!input) return false;
  
  const patterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|TRUNCATE)\b)/gi,
    /('|"|;|--|\*|\/\*|\*\/)/,
    /(\bOR\b|\bAND\b)\s+\d+\s*=\s*\d+/gi,
    /(\bOR\b|\bAND\b)\s+['"]\w*['"]\s*=\s*['"]/gi,
    /(\bUNION\b.*\bSELECT\b)/gi,
    /(\bEXEC\b|\bEXECUTE\b)/gi,
    /(\bxp_\w+)/gi,
  ];
  
  return patterns.some(pattern => pattern.test(input));
}

/**
 * Check for XSS patterns
 */
function hasXSSPatterns(input: string): boolean {
  if (!input) return false;
  
  const patterns = [
    /<script[^>]*>/gi,
    /javascript:/gi,
    /on(click|load|error|mouseover|mouseout|keydown|keyup|submit|focus|blur)=/gi,
    /<iframe[^>]*>/gi,
    /<object[^>]*>/gi,
    /<embed[^>]*>/gi,
    /data:text\/html/gi,
    /vbscript:/gi,
    /expression\s*\(/gi,
    /<svg[^>]*onload/gi,
    /<img[^>]*onerror/gi,
  ];
  
  return patterns.some(pattern => pattern.test(decodeURIComponent(input)));
}

/**
 * Check for unusual HTTP method for path
 */
function isUnusualMethodForPath(method: string, path: string): boolean {
  // Static files should only use GET/HEAD
  if (path.includes('.') && !['GET', 'HEAD'].includes(method)) {
    return true;
  }
  
  // DELETE on non-API paths
  if (method === 'DELETE' && !path.startsWith('/api/')) {
    return true;
  }
  
  return false;
}

/**
 * Analyze body content for threats
 */
function analyzeBodyContent(body: any): { score: number; reasons: string[] } {
  const result = { score: 0, reasons: [] as string[] };
  
  if (!body || typeof body !== 'object') return result;
  
  const checkValue = (value: any, depth: number = 0): void => {
    if (depth > 10) {
      result.score += 10;
      result.reasons.push('deep_nesting');
      return;
    }
    
    if (typeof value === 'string') {
      if (hasSQLInjectionPatterns(value)) {
        result.score += 40;
        result.reasons.push('sql_injection_in_body');
      }
      if (hasXSSPatterns(value)) {
        result.score += 35;
        result.reasons.push('xss_in_body');
      }
      if (value.length > 100000) {
        result.score += 15;
        result.reasons.push('oversized_string');
      }
    } else if (Array.isArray(value)) {
      if (value.length > 1000) {
        result.score += 10;
        result.reasons.push('large_array');
      }
      value.forEach(item => checkValue(item, depth + 1));
    } else if (value && typeof value === 'object') {
      Object.values(value).forEach(v => checkValue(v, depth + 1));
    }
  };
  
  checkValue(body);
  return result;
}

/**
 * Analyze request frequency for rate limiting and anomaly detection
 */
function analyzeRequestFrequency(ip: string, path: string): { score: number; reasons: string[] } {
  const result = { score: 0, reasons: [] as string[] };
  const now = Date.now();
  const key = `${ip}:${path}`;
  
  let history = requestHistory.get(key);
  if (!history) {
    history = { timestamps: [], patterns: [] };
  }
  
  history.timestamps.push(now);
  
  // Keep last hour
  history.timestamps = history.timestamps.filter(t => now - t < 3600000);
  
  // Check for rapid requests (more than 60/minute)
  const lastMinute = history.timestamps.filter(t => now - t < 60000);
  if (lastMinute.length > 60) {
    result.score += 20;
    result.reasons.push('high_request_rate');
  }
  
  // Check for consistent timing (bot-like behavior)
  if (lastMinute.length >= 5) {
    const intervals: number[] = [];
    for (let i = 1; i < lastMinute.length; i++) {
      intervals.push(lastMinute[i] - lastMinute[i - 1]);
    }
    
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((sum, i) => sum + Math.pow(i - avgInterval, 2), 0) / intervals.length;
    
    if (Math.sqrt(variance) < 50 && avgInterval < 1000) {
      result.score += 25;
      result.reasons.push('bot_like_timing');
    }
  }
  
  requestHistory.set(key, history);
  return result;
}

/**
 * Get IP reputation score (0-100, higher is better)
 */
function getIPReputationScore(ip: string): number {
  const cached = ipReputation.get(ip);
  if (cached && Date.now() - cached.lastUpdated < 3600000) {
    return cached.score;
  }
  
  // Default score (could be enhanced with external API)
  let score = 70;
  
  // Check against failed attempts history
  const attempts = failedAttempts.get(ip);
  if (attempts) {
    score -= attempts.escalationLevel * 15;
  }
  
  // Cache the result
  ipReputation.set(ip, { score, lastUpdated: Date.now() });
  
  return Math.max(0, Math.min(100, score));
}

// ==================== SESSION SECURITY ====================

/**
 * Validate session consistency (detect session hijacking)
 */
export function validateSessionConsistency(
  sessionId: string,
  currentFingerprint: RequestFingerprint
): { valid: boolean; reason?: string } {
  const session = sessions.get(sessionId);
  
  if (!session) {
    // New session
    sessions.set(sessionId, {
      fingerprint: currentFingerprint.hash,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      requestCount: 1,
    });
    return { valid: true };
  }
  
  // Check fingerprint match
  if (session.fingerprint !== currentFingerprint.hash) {
    // Allow some variation for legitimate users (VPN, browser updates)
    // But flag it
    console.warn(`[Security] Session fingerprint mismatch: ${sessionId}`);
    
    // If too many requests with mismatched fingerprint, block
    if (session.requestCount > 10) {
      return { valid: false, reason: 'fingerprint_mismatch' };
    }
  }
  
  // Update session activity
  session.lastActivity = Date.now();
  session.requestCount += 1;
  
  return { valid: true };
}

// ==================== INPUT SANITIZATION ====================

/**
 * Deep sanitize object (remove dangerous content)
 */
export function deepSanitize<T>(obj: T, maxDepth: number = 10): T {
  if (maxDepth <= 0) return {} as T;
  
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj === 'string') {
    return sanitizeString(obj) as T;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => deepSanitize(item, maxDepth - 1)).slice(0, 1000) as T;
  }
  
  if (typeof obj === 'object') {
    const result: Record<string, any> = {};
    const entries = Object.entries(obj).slice(0, 100);
    
    for (const [key, value] of entries) {
      const sanitizedKey = sanitizeString(key);
      if (sanitizedKey) {
        result[sanitizedKey] = deepSanitize(value, maxDepth - 1);
      }
    }
    
    return result as T;
  }
  
  return obj;
}

/**
 * Sanitize string (remove dangerous characters and patterns)
 */
export function sanitizeString(input: string): string {
  if (!input || typeof input !== 'string') return '';
  
  return input
    // Remove null bytes
    .replace(/\0/g, '')
    // Remove control characters except newlines and tabs
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Normalize unicode
    .normalize('NFC')
    // Limit length
    .slice(0, 50000)
    .trim();
}

/**
 * Escape HTML entities (prevent XSS)
 */
export function escapeHtml(input: string): string {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;',
  };
  
  return input.replace(/[&<>"'`=/]/g, char => htmlEntities[char] || char);
}

/**
 * Validate email format strictly
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  
  // RFC 5322 compliant regex (simplified)
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  
  if (!emailRegex.test(email)) return false;
  if (email.length > 254) return false;
  
  const [local, domain] = email.split('@');
  if (local.length > 64) return false;
  if (!domain || domain.length > 253) return false;
  
  return true;
}

// ==================== SECURITY RESPONSE HELPERS ====================

/**
 * Create a secure error response
 */
export function secureErrorResponse(
  message: string,
  status: number,
  requestId?: string
): NextResponse {
  return new NextResponse(
    JSON.stringify({
      status: 'error',
      message: sanitizeString(message),
      requestId,
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
        ...(requestId ? { 'X-Request-Id': requestId } : {}),
      },
    }
  );
}

/**
 * Create security headers for response
 */
export function getSecurityHeaders(): Record<string, string> {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()',
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
  };
}

// ==================== COMPREHENSIVE SECURITY CHECK ====================

/**
 * Perform comprehensive security analysis on a request
 */
export function performSecurityAnalysis(
  req: NextRequest,
  body?: any
): SecurityContext {
  const fingerprint = extractFingerprint(req);
  const threatScore = analyzeRequest(req, body);
  const requestId = `req_${Date.now()}_${generateSecureRandom(8)}`;
  
  return {
    fingerprint,
    threatScore,
    requestId,
    timestamp: Date.now(),
    isBot: isSuspiciousUserAgent(req.headers.get('user-agent') || ''),
    isTor: isTorExitNode(fingerprint.ip),
    isProxy: detectProxy(req),
    geoRisk: false, // Could be enhanced with GeoIP
  };
}

/**
 * Export threat level thresholds for configuration
 */
export const THREAT_THRESHOLDS = {
  safe: 0,
  low: 20,
  medium: 40,
  high: 60,
  critical: 80,
} as const;

/**
 * Export for testing
 */
export const _internal = {
  failedAttempts,
  nonces,
  sessions,
  ipReputation,
  requestHistory,
};
