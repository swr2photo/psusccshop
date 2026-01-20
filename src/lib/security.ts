// src/lib/security.ts
// Advanced security utilities for protection against common attacks

import { NextRequest } from 'next/server';
import crypto from 'crypto';

// ==================== SECURITY CONSTANTS ====================

// Blocked patterns for SQL Injection, XSS, Path Traversal, etc.
const MALICIOUS_PATTERNS = [
  // SQL Injection patterns
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE)\b)/gi,
  /('|\"|;|--|\*|\/\*|\*\/|\\x00|\\x1a)/g,
  /(\bOR\b|\bAND\b)\s+\d+\s*=\s*\d+/gi,
  
  // XSS patterns
  /<script[^>]*>[\s\S]*?<\/script>/gi,
  /javascript:/gi,
  /on(click|load|error|mouseover|mouseout|keydown|keyup|submit|focus|blur)=/gi,
  /<iframe[^>]*>/gi,
  /<object[^>]*>/gi,
  /<embed[^>]*>/gi,
  /data:text\/html/gi,
  /vbscript:/gi,
  
  // Path Traversal patterns
  /\.\.[\/\\]/g,
  /%2e%2e[%2f%5c]/gi,
  /\.\.%c0%af/gi,
  /\.\.%c1%9c/gi,
  
  // Command Injection patterns
  /[;&|`$()]/g,
  /\$\{.*\}/g,
  
  // LDAP Injection patterns
  /[()\\*]/g,
  
  // XML/XXE patterns
  /<!DOCTYPE[^>]*>/gi,
  /<!ENTITY[^>]*>/gi,
  /<!\[CDATA\[/gi,
];

// Allowed characters for different input types
const SAFE_PATTERNS = {
  alphanumeric: /^[a-zA-Z0-9]+$/,
  alphanumericThai: /^[a-zA-Z0-9ก-๙\s]+$/,
  email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  phone: /^[0-9\-+\s()]+$/,
  orderRef: /^ORD-[0-9]+$/,
  base64: /^[A-Za-z0-9+/=]+$/,
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
};

// Suspicious User-Agent patterns (common attack tools)
const SUSPICIOUS_USER_AGENTS = [
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
  /curl\/\d+/i,
  /wget/i,
  /python-requests/i,
  /scrapy/i,
];

// Blocked IP ranges (known malicious)
const BLOCKED_IP_PREFIXES: string[] = [];

// ==================== SECURITY FUNCTIONS ====================

/**
 * Check if input contains malicious patterns
 */
export function containsMaliciousPatterns(input: string): boolean {
  if (!input || typeof input !== 'string') return false;
  
  for (const pattern of MALICIOUS_PATTERNS) {
    if (pattern.test(input)) {
      console.warn('[Security] Malicious pattern detected:', { pattern: pattern.source, input: input.slice(0, 100) });
      return true;
    }
  }
  return false;
}

/**
 * Sanitize string input - removes dangerous characters
 */
export function sanitizeString(input: string | null | undefined): string {
  if (!input) return '';
  
  return input
    .replace(/[<>'";&|`$(){}[\]\\]/g, '') // Remove dangerous chars
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
    .slice(0, 10000); // Limit length
}

/**
 * Sanitize HTML - escape all HTML entities
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
  
  return input.replace(/[&<>"'`=/]/g, (char) => htmlEntities[char] || char);
}

/**
 * Validate input against safe pattern
 */
export function validatePattern(input: string, patternName: keyof typeof SAFE_PATTERNS): boolean {
  const pattern = SAFE_PATTERNS[patternName];
  return pattern.test(input);
}

/**
 * Check for suspicious User-Agent
 */
export function isSuspiciousUserAgent(userAgent: string | null): boolean {
  if (!userAgent) return true; // No UA is suspicious
  
  for (const pattern of SUSPICIOUS_USER_AGENTS) {
    if (pattern.test(userAgent)) {
      console.warn('[Security] Suspicious User-Agent:', userAgent);
      return true;
    }
  }
  return false;
}

/**
 * Check if IP is blocked
 */
export function isBlockedIP(ip: string | null): boolean {
  if (!ip) return false;
  
  for (const prefix of BLOCKED_IP_PREFIXES) {
    if (ip.startsWith(prefix)) {
      console.warn('[Security] Blocked IP:', ip);
      return true;
    }
  }
  return false;
}

/**
 * Generate secure random token
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Hash sensitive data (for logging without exposing)
 */
export function hashForLog(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex').slice(0, 16);
}

/**
 * Validate request integrity
 */
export function validateRequestIntegrity(req: NextRequest): {
  isValid: boolean;
  reason?: string;
} {
  // 1. Check User-Agent
  const userAgent = req.headers.get('user-agent');
  if (isSuspiciousUserAgent(userAgent)) {
    return { isValid: false, reason: 'suspicious_user_agent' };
  }
  
  // 2. Check for common attack headers
  const suspiciousHeaders = [
    'x-forwarded-host',
    'x-original-url',
    'x-rewrite-url',
  ];
  
  for (const header of suspiciousHeaders) {
    const value = req.headers.get(header);
    if (value && containsMaliciousPatterns(value)) {
      return { isValid: false, reason: `malicious_header_${header}` };
    }
  }
  
  // 3. Check URL for path traversal
  const url = req.nextUrl.pathname;
  if (/\.\.[\/\\]/.test(url)) {
    return { isValid: false, reason: 'path_traversal' };
  }
  
  // 4. Check query params for injection
  const searchParams = req.nextUrl.searchParams;
  for (const [key, value] of searchParams) {
    if (containsMaliciousPatterns(key) || containsMaliciousPatterns(value)) {
      return { isValid: false, reason: 'malicious_query_param' };
    }
  }
  
  return { isValid: true };
}

/**
 * Validate JSON body for malicious content
 */
export function validateJsonBody(body: any, maxDepth: number = 10): {
  isValid: boolean;
  reason?: string;
} {
  const checkObject = (obj: any, depth: number): boolean => {
    if (depth > maxDepth) return false;
    
    if (typeof obj === 'string') {
      return !containsMaliciousPatterns(obj);
    }
    
    if (Array.isArray(obj)) {
      return obj.every(item => checkObject(item, depth + 1));
    }
    
    if (obj && typeof obj === 'object') {
      return Object.entries(obj).every(([key, value]) => {
        if (containsMaliciousPatterns(key)) return false;
        return checkObject(value, depth + 1);
      });
    }
    
    return true;
  };
  
  if (!checkObject(body, 0)) {
    return { isValid: false, reason: 'malicious_body_content' };
  }
  
  return { isValid: true };
}

/**
 * Rate limiting with sliding window (more accurate than fixed window)
 */
const slidingWindowStore = new Map<string, number[]>();
const SLIDING_WINDOW_CLEANUP_INTERVAL = 60000; // 1 minute

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of slidingWindowStore.entries()) {
    const filtered = timestamps.filter(t => now - t < 60000);
    if (filtered.length === 0) {
      slidingWindowStore.delete(key);
    } else {
      slidingWindowStore.set(key, filtered);
    }
  }
}, SLIDING_WINDOW_CLEANUP_INTERVAL);

export function checkSlidingWindowRateLimit(
  identifier: string,
  maxRequests: number,
  windowMs: number = 60000
): { allowed: boolean; remaining: number; resetMs: number } {
  const now = Date.now();
  const timestamps = slidingWindowStore.get(identifier) || [];
  
  // Filter timestamps within window
  const windowStart = now - windowMs;
  const recentTimestamps = timestamps.filter(t => t > windowStart);
  
  if (recentTimestamps.length >= maxRequests) {
    const oldestInWindow = Math.min(...recentTimestamps);
    const resetMs = oldestInWindow + windowMs - now;
    
    return {
      allowed: false,
      remaining: 0,
      resetMs,
    };
  }
  
  // Add new timestamp
  recentTimestamps.push(now);
  slidingWindowStore.set(identifier, recentTimestamps);
  
  return {
    allowed: true,
    remaining: maxRequests - recentTimestamps.length,
    resetMs: windowMs,
  };
}

/**
 * IP-based blocking for repeated offenders
 */
const blockList = new Map<string, { until: number; reason: string }>();

export function blockIP(ip: string, durationMs: number, reason: string): void {
  blockList.set(ip, {
    until: Date.now() + durationMs,
    reason,
  });
  console.warn('[Security] IP blocked:', { ip, duration: durationMs, reason });
}

export function isIPBlocked(ip: string): { blocked: boolean; reason?: string } {
  const block = blockList.get(ip);
  if (!block) return { blocked: false };
  
  if (Date.now() > block.until) {
    blockList.delete(ip);
    return { blocked: false };
  }
  
  return { blocked: true, reason: block.reason };
}

/**
 * Log security event
 */
export function logSecurityEvent(
  event: string,
  details: Record<string, any>,
  severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    event,
    severity,
    ...details,
    // Hash sensitive data
    ip: details.ip ? hashForLog(details.ip) : undefined,
    email: details.email ? hashForLog(details.email) : undefined,
  };
  
  console.log('[Security Event]', JSON.stringify(logEntry));
  
  // In production, you might want to send to external logging service
  // await sendToSecurityLogger(logEntry);
}

/**
 * CSRF Token generation and validation
 */
const csrfTokens = new Map<string, { token: string; expires: number }>();

export function generateCSRFToken(sessionId: string): string {
  const token = generateSecureToken(32);
  csrfTokens.set(sessionId, {
    token,
    expires: Date.now() + 3600000, // 1 hour
  });
  return token;
}

export function validateCSRFToken(sessionId: string, token: string): boolean {
  const stored = csrfTokens.get(sessionId);
  if (!stored) return false;
  
  if (Date.now() > stored.expires) {
    csrfTokens.delete(sessionId);
    return false;
  }
  
  // Timing-safe comparison
  const storedBuffer = Buffer.from(stored.token);
  const tokenBuffer = Buffer.from(token);
  
  if (storedBuffer.length !== tokenBuffer.length) return false;
  
  return crypto.timingSafeEqual(storedBuffer, tokenBuffer);
}

/**
 * Honeypot field detection
 */
export function detectHoneypot(body: any, honeypotField: string = '_hp_field'): boolean {
  return body && body[honeypotField] && body[honeypotField].length > 0;
}

/**
 * Request timing anomaly detection
 */
const requestTimings = new Map<string, number[]>();

export function detectTimingAnomaly(identifier: string): boolean {
  const now = Date.now();
  const timings = requestTimings.get(identifier) || [];
  
  timings.push(now);
  
  // Keep last 10 requests
  if (timings.length > 10) {
    timings.shift();
  }
  
  requestTimings.set(identifier, timings);
  
  // Check for suspicious patterns
  if (timings.length >= 3) {
    const intervals: number[] = [];
    for (let i = 1; i < timings.length; i++) {
      intervals.push(timings[i] - timings[i - 1]);
    }
    
    // Check for bot-like consistent timing (< 50ms variance)
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((sum, i) => sum + Math.pow(i - avgInterval, 2), 0) / intervals.length;
    
    if (variance < 2500 && avgInterval < 500) { // Very consistent, very fast
      return true;
    }
  }
  
  return false;
}

// ==================== SECURITY MIDDLEWARE HELPER ====================

export interface SecurityCheckResult {
  passed: boolean;
  failedChecks: string[];
  warnings: string[];
}

export function performSecurityChecks(req: NextRequest, body?: any): SecurityCheckResult {
  const result: SecurityCheckResult = {
    passed: true,
    failedChecks: [],
    warnings: [],
  };
  
  // 1. Check request integrity
  const integrity = validateRequestIntegrity(req);
  if (!integrity.isValid) {
    result.passed = false;
    result.failedChecks.push(`integrity_${integrity.reason}`);
  }
  
  // 2. Check IP blocking
  const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                   req.headers.get('x-real-ip') ||
                   'unknown';
                   
  const ipCheck = isIPBlocked(clientIP);
  if (ipCheck.blocked) {
    result.passed = false;
    result.failedChecks.push(`ip_blocked_${ipCheck.reason}`);
  }
  
  // 3. Check body if provided
  if (body) {
    const bodyCheck = validateJsonBody(body);
    if (!bodyCheck.isValid) {
      result.passed = false;
      result.failedChecks.push(`body_${bodyCheck.reason}`);
    }
    
    // Check honeypot
    if (detectHoneypot(body)) {
      result.passed = false;
      result.failedChecks.push('honeypot_triggered');
    }
  }
  
  // 4. Timing anomaly (warning only)
  if (detectTimingAnomaly(clientIP)) {
    result.warnings.push('timing_anomaly_detected');
  }
  
  return result;
}
