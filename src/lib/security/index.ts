// src/lib/security/index.ts
// ===================================================================
// SECURITY MODULE EXPORTS
// ===================================================================
// Central export point for all security-related modules

// ==================== ADVANCED SECURITY ====================
export {
  // Cryptographic functions
  generateSecureRandom,
  generateNonce,
  validateNonce,
  signRequest,
  verifySignature,
  hashWithSalt,
  verifyHash,
  
  // Request analysis
  extractFingerprint,
  compareFingerprints,
  getClientIP,
  detectProxy,
  isTorExitNode,
  isBlockedIP,
  
  // Brute force protection
  recordFailedAttempt,
  clearFailedAttempts,
  isLockedOut,
  
  // Threat detection
  analyzeRequest,
  performSecurityAnalysis,
  
  // Input sanitization
  deepSanitize,
  sanitizeString,
  escapeHtml,
  isValidEmail,
  
  // Response helpers
  secureErrorResponse,
  getSecurityHeaders,
  
  // Types
  type RequestFingerprint,
  type ThreatScore,
  type SecurityContext,
  THREAT_THRESHOLDS,
} from '../advanced-security';

// ==================== SECURITY AUDIT ====================
export {
  logSecurityEvent,
  getSecurityAuditLogs,
  getSecurityMetrics,
  getSecurityAlerts,
  checkActiveThreats,
  cleanupOldAuditLogs,
  hashForAudit,
  flushEvents,
  RETENTION_DAYS,
  
  // Types
  type SecurityEventType,
  type SecuritySeverity,
  type SecurityEvent,
  type SecurityMetrics,
  type AuditLogQuery,
} from '../security-audit';

// ==================== SECURE MIDDLEWARE ====================
export {
  withSecureMiddleware,
  withPublicAPI,
  withAuthenticatedAPI,
  withAdminAPI,
  withPaymentAPI,
  withOrderAPI,
  withStrictAPI,
  
  // Types
  type SecureMiddlewareConfig,
  type SecureAPIContext,
  type SecureAPIHandler,
} from '../secure-middleware';

// ==================== ENCRYPTION ====================
export {
  encrypt,
  decrypt,
  encryptJSON,
  decryptJSON,
  encryptToBase64,
  decryptFromBase64,
  encryptSensitiveFields,
  decryptSensitiveFields,
  envelopeEncrypt,
  envelopeDecrypt,
  secureHash,
  createHMAC,
  verifyHMAC,
  generateToken,
  generateURLSafeToken,
  generateOTP,
  hashPassword,
  verifyPassword,
  SENSITIVE_FIELDS,
  
  // Types
  type EncryptedData,
  type EncryptionOptions,
} from '../encryption';

// ==================== RATE LIMITING ====================
export {
  checkRateLimit,
  checkCombinedRateLimit,
  getRateLimitHeaders,
  RATE_LIMITS,
  
  // Types
  type RateLimitConfig,
  type RateLimitResult,
} from '../rate-limit';

// ==================== CLOUDFLARE ====================
export {
  verifyTurnstileToken,
  getClientIP as getCFClientIP,
  isCloudflareRequest,
  getCloudflareCountry,
  TURNSTILE_SITE_KEY,
  
  // Types
  type TurnstileVerifyResponse,
} from '../cloudflare';

// ==================== COMBINED SECURITY CHECK ====================

import { NextRequest } from 'next/server';
import { performSecurityAnalysis, ThreatScore } from '../advanced-security';
import { checkCombinedRateLimit, RATE_LIMITS } from '../rate-limit';
import { logSecurityEvent } from '../security-audit';

/**
 * Perform all security checks in one call
 */
export async function performFullSecurityCheck(
  request: NextRequest,
  body?: any
): Promise<{
  passed: boolean;
  threatScore: ThreatScore;
  rateLimit: { allowed: boolean; remaining: number };
  requestId: string;
  clientIP: string;
  reasons: string[];
}> {
  const securityAnalysis = performSecurityAnalysis(request, body);
  const rateLimitResult = checkCombinedRateLimit(request, RATE_LIMITS.api);
  
  const passed = 
    securityAnalysis.threatScore.score < 60 && 
    rateLimitResult.allowed;
  
  const reasons: string[] = [];
  
  if (!rateLimitResult.allowed) {
    reasons.push('rate_limit_exceeded');
  }
  
  if (securityAnalysis.threatScore.score >= 60) {
    reasons.push(...securityAnalysis.threatScore.reasons);
  }
  
  // Log if suspicious
  if (!passed) {
    await logSecurityEvent('suspicious_activity', {
      ip: securityAnalysis.fingerprint.ip,
      userAgent: request.headers.get('user-agent') || undefined,
      requestPath: request.nextUrl.pathname,
      requestMethod: request.method,
      requestId: securityAnalysis.requestId,
      threatScore: securityAnalysis.threatScore.score,
      blocked: true,
      details: { reasons },
    });
  }
  
  return {
    passed,
    threatScore: securityAnalysis.threatScore,
    rateLimit: {
      allowed: rateLimitResult.allowed,
      remaining: rateLimitResult.remaining,
    },
    requestId: securityAnalysis.requestId,
    clientIP: securityAnalysis.fingerprint.ip,
    reasons,
  };
}

/**
 * Security configuration constants
 */
export const SECURITY_CONFIG = {
  // Threat thresholds
  THREAT_BLOCK_THRESHOLD: 60,
  THREAT_WARN_THRESHOLD: 40,
  
  // Rate limits
  DEFAULT_RATE_LIMIT: 100,
  STRICT_RATE_LIMIT: 30,
  AUTH_RATE_LIMIT: 10,
  
  // Lockout settings
  MAX_FAILED_ATTEMPTS: 5,
  LOCKOUT_BASE_DURATION_MS: 60000,
  MAX_LOCKOUT_DURATION_MS: 3600000,
  
  // Token validity
  NONCE_VALIDITY_MS: 300000,
  SESSION_VALIDITY_MS: 86400000,
  
  // Encryption
  KEY_DERIVATION_ITERATIONS: 100000,
  
  // Audit
  AUDIT_RETENTION_DAYS: 90,
} as const;
