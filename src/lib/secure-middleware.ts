// src/lib/secure-middleware.ts
// ===================================================================
// SECURE API MIDDLEWARE - Maximum Security Wrapper
// ===================================================================
// A comprehensive middleware that applies all security measures
// automatically to API routes

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isAdminEmailAsync } from './auth';
import { logSecurityEvent, SecurityEventType } from './security-audit';
import { 
  performSecurityAnalysis, 
  analyzeRequest,
  recordFailedAttempt,
  clearFailedAttempts,
  isLockedOut,
  deepSanitize,
  getSecurityHeaders,
  secureErrorResponse,
  generateNonce,
  validateNonce,
  getClientIP,
  ThreatScore,
} from './advanced-security';
import { checkCombinedRateLimit, RATE_LIMITS, getRateLimitHeaders, RateLimitResult } from './rate-limit';
import { verifyTurnstileToken } from './cloudflare';

// ==================== TYPES ====================

export interface SecureMiddlewareConfig {
  // Authentication requirements
  requireAuth?: boolean;
  requireAdmin?: boolean;
  
  // Rate limiting
  rateLimit?: {
    maxRequests: number;
    windowSeconds: number;
    prefix?: string;
  };
  
  // Security features
  requireTurnstile?: boolean;
  requireNonce?: boolean;
  enableFingerprinting?: boolean;
  
  // Input validation
  maxBodySize?: number;
  validateBody?: (body: any) => { valid: boolean; error?: string };
  sanitizeBody?: boolean;
  
  // Threat thresholds
  blockThreatLevel?: 'low' | 'medium' | 'high' | 'critical';
  
  // Audit logging
  auditEventType?: SecurityEventType;
  skipAudit?: boolean;
  
  // Allow options
  allowedMethods?: string[];
  allowedContentTypes?: string[];
}

export interface SecureAPIContext {
  session: any | null;
  userEmail: string | null;
  isAdmin: boolean;
  clientIP: string;
  requestId: string;
  userAgent: string;
  threatScore: ThreatScore;
  fingerprint: string;
  body?: any;
}

export type SecureAPIHandler = (
  request: NextRequest,
  context: SecureAPIContext,
  params?: any
) => Promise<NextResponse>;

// ==================== CONFIGURATION DEFAULTS ====================

const DEFAULT_CONFIG: SecureMiddlewareConfig = {
  requireAuth: false,
  requireAdmin: false,
  rateLimit: RATE_LIMITS.api,
  requireTurnstile: false,
  requireNonce: false,
  enableFingerprinting: true,
  maxBodySize: 5 * 1024 * 1024, // 5MB
  sanitizeBody: true,
  blockThreatLevel: 'critical',
  skipAudit: false,
  allowedMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedContentTypes: ['application/json', 'multipart/form-data', 'application/x-www-form-urlencoded'],
};

// ==================== HELPER FUNCTIONS ====================

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function getThreatBlockLevel(level: string): number {
  const levels: Record<string, number> = {
    'low': 20,
    'medium': 40,
    'high': 60,
    'critical': 80,
  };
  return levels[level] || 80;
}

async function parseRequestBody(
  request: NextRequest,
  maxSize: number
): Promise<{ body: any; error?: string }> {
  const contentType = request.headers.get('content-type') || '';
  
  try {
    if (contentType.includes('application/json')) {
      const text = await request.text();
      
      if (text.length > maxSize) {
        return { body: null, error: 'Request body too large' };
      }
      
      return { body: text ? JSON.parse(text) : {} };
    }
    
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const body: Record<string, any> = {};
      
      for (const [key, value] of formData.entries()) {
        if (value instanceof File) {
          if (value.size > maxSize) {
            return { body: null, error: 'File too large' };
          }
          body[key] = { name: value.name, size: value.size, type: value.type };
        } else {
          body[key] = value;
        }
      }
      
      return { body };
    }
    
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const text = await request.text();
      
      if (text.length > maxSize) {
        return { body: null, error: 'Request body too large' };
      }
      
      const params = new URLSearchParams(text);
      const body: Record<string, any> = {};
      
      for (const [key, value] of params.entries()) {
        body[key] = value;
      }
      
      return { body };
    }
    
    return { body: null };
  } catch (error: any) {
    return { body: null, error: error.message || 'Failed to parse request body' };
  }
}

// ==================== MAIN MIDDLEWARE ====================

/**
 * Create a secure API handler wrapper
 */
export function withSecureMiddleware(
  handler: SecureAPIHandler,
  config: SecureMiddlewareConfig = {}
): (request: NextRequest, context?: { params?: Promise<any> }) => Promise<NextResponse> {
  
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  
  const {
    requireAuth,
    requireAdmin,
    rateLimit,
    requireTurnstile,
    requireNonce,
    enableFingerprinting,
    maxBodySize,
    validateBody,
    sanitizeBody,
    blockThreatLevel,
    auditEventType,
    skipAudit,
    allowedMethods,
    allowedContentTypes,
  } = mergedConfig;
  
  return async (request: NextRequest, routeContext?: { params?: Promise<any> }): Promise<NextResponse> => {
    const startTime = Date.now();
    const requestId = generateRequestId();
    const clientIP = getClientIP(request) || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const pathname = request.nextUrl.pathname;
    const method = request.method;
    
    // Initialize context
    const ctx: SecureAPIContext = {
      session: null,
      userEmail: null,
      isAdmin: false,
      clientIP,
      requestId,
      userAgent,
      threatScore: { score: 0, reasons: [], level: 'safe', blocked: false },
      fingerprint: '',
    };
    
    try {
      // ==================== 1. Method Check ====================
      if (allowedMethods && !allowedMethods.includes(method)) {
        return secureErrorResponse('Method not allowed', 405, requestId);
      }
      
      // Handle OPTIONS for CORS
      if (method === 'OPTIONS') {
        return new NextResponse(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Methods': allowedMethods?.join(', ') || 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Nonce',
            'Access-Control-Max-Age': '86400',
            ...getSecurityHeaders(),
          },
        });
      }
      
      // ==================== 2. Content-Type Check ====================
      if (['POST', 'PUT', 'PATCH'].includes(method)) {
        const contentType = request.headers.get('content-type')?.split(';')[0];
        if (contentType && allowedContentTypes && !allowedContentTypes.some(t => contentType.includes(t))) {
          return secureErrorResponse('Unsupported content type', 415, requestId);
        }
      }
      
      // ==================== 3. Lockout Check ====================
      if (isLockedOut(clientIP)) {
        await logSecurityEvent('access_denied', {
          ip: clientIP,
          userAgent,
          requestPath: pathname,
          requestMethod: method,
          requestId,
          blocked: true,
          details: { reason: 'account_locked' },
        });
        
        return secureErrorResponse('บัญชีถูกล็อคชั่วคราว กรุณารอสักครู่', 429, requestId);
      }
      
      // ==================== 4. Threat Analysis ====================
      let body: any = undefined;
      
      if (['POST', 'PUT', 'PATCH'].includes(method)) {
        const { body: parsedBody, error: bodyError } = await parseRequestBody(request, maxBodySize || 5 * 1024 * 1024);
        
        if (bodyError) {
          return secureErrorResponse(bodyError, 413, requestId);
        }
        
        body = parsedBody;
        ctx.body = body;
      }
      
      // Perform security analysis
      const securityAnalysis = performSecurityAnalysis(request, body);
      ctx.threatScore = securityAnalysis.threatScore;
      ctx.fingerprint = securityAnalysis.fingerprint.hash;
      
      // Check threat level
      const blockThreshold = getThreatBlockLevel(blockThreatLevel || 'critical');
      if (ctx.threatScore.score >= blockThreshold) {
        await logSecurityEvent('suspicious_activity', {
          severity: ctx.threatScore.level === 'critical' ? 'critical' : 'high',
          ip: clientIP,
          userAgent,
          requestPath: pathname,
          requestMethod: method,
          requestId,
          blocked: true,
          threatScore: ctx.threatScore.score,
          details: { reasons: ctx.threatScore.reasons },
        });
        
        // Record as failed attempt for progressive lockout
        recordFailedAttempt(clientIP);
        
        return secureErrorResponse('คำขอไม่ปลอดภัย', 403, requestId);
      }
      
      // ==================== 5. Rate Limiting ====================
      if (rateLimit) {
        const rateLimitResult = checkCombinedRateLimit(request, rateLimit);
        
        if (!rateLimitResult.allowed) {
          await logSecurityEvent('rate_limit_exceeded', {
            ip: clientIP,
            userAgent,
            requestPath: pathname,
            requestMethod: method,
            requestId,
            details: { remaining: rateLimitResult.remaining },
          });
          
          const response = secureErrorResponse('คุณส่งคำขอเร็วเกินไป กรุณารอสักครู่', 429, requestId);
          
          const headers = getRateLimitHeaders(rateLimitResult);
          for (const [key, value] of Object.entries(headers)) {
            response.headers.set(key, value);
          }
          
          return response;
        }
      }
      
      // ==================== 6. Nonce Verification ====================
      if (requireNonce) {
        const nonce = request.headers.get('x-nonce');
        
        if (!nonce || !validateNonce(nonce)) {
          await logSecurityEvent('csrf_violation', {
            ip: clientIP,
            userAgent,
            requestPath: pathname,
            requestMethod: method,
            requestId,
          });
          
          return secureErrorResponse('Invalid or missing nonce', 403, requestId);
        }
      }
      
      // ==================== 7. Authentication ====================
      if (requireAuth || requireAdmin) {
        ctx.session = await getServerSession(authOptions);
        ctx.userEmail = ctx.session?.user?.email || null;
        
        if (!ctx.userEmail) {
          await logSecurityEvent('access_denied', {
            ip: clientIP,
            userAgent,
            requestPath: pathname,
            requestMethod: method,
            requestId,
            details: { reason: 'not_authenticated' },
          });
          
          return secureErrorResponse('กรุณาเข้าสู่ระบบ', 401, requestId);
        }
        
        if (requireAdmin) {
          ctx.isAdmin = await isAdminEmailAsync(ctx.userEmail);
          
          if (!ctx.isAdmin) {
            await logSecurityEvent('access_denied', {
              severity: 'high',
              ip: clientIP,
              userEmail: ctx.userEmail,
              userAgent,
              requestPath: pathname,
              requestMethod: method,
              requestId,
              details: { reason: 'not_admin' },
            });
            
            return secureErrorResponse('ไม่มีสิทธิ์เข้าถึง', 403, requestId);
          }
        }
      }
      
      // ==================== 8. Turnstile Verification ====================
      if (requireTurnstile && body?.turnstileToken !== undefined) {
        const turnstileResult = await verifyTurnstileToken(body.turnstileToken, clientIP);
        
        if (!turnstileResult.success) {
          await logSecurityEvent('suspicious_activity', {
            ip: clientIP,
            userEmail: ctx.userEmail || undefined,
            userAgent,
            requestPath: pathname,
            requestMethod: method,
            requestId,
            details: { reason: 'turnstile_failed', error: turnstileResult.error },
          });
          
          return secureErrorResponse(turnstileResult.error || 'กรุณายืนยันว่าคุณไม่ใช่บอท', 400, requestId);
        }
      }
      
      // ==================== 9. Body Validation ====================
      if (body && validateBody) {
        const validation = validateBody(body);
        
        if (!validation.valid) {
          return secureErrorResponse(validation.error || 'Invalid request data', 400, requestId);
        }
      }
      
      // Sanitize body if enabled
      if (body && sanitizeBody) {
        ctx.body = deepSanitize(body);
      }
      
      // ==================== 10. Execute Handler ====================
      const params = routeContext?.params ? await routeContext.params : undefined;
      const response = await handler(request, ctx, params);
      
      // Clear failed attempts on successful auth
      if (requireAuth && ctx.userEmail) {
        clearFailedAttempts(clientIP);
      }
      
      // ==================== 11. Audit Logging ====================
      if (!skipAudit && auditEventType) {
        await logSecurityEvent(auditEventType, {
          severity: 'low',
          ip: clientIP,
          userEmail: ctx.userEmail || undefined,
          userAgent,
          requestPath: pathname,
          requestMethod: method,
          requestId,
          details: { 
            status: response.status, 
            duration: Date.now() - startTime,
          },
        });
      }
      
      // ==================== 12. Add Security Headers ====================
      response.headers.set('X-Request-Id', requestId);
      response.headers.set('X-Content-Type-Options', 'nosniff');
      response.headers.set('X-Frame-Options', 'DENY');
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      
      return response;
      
    } catch (error: any) {
      // ==================== Error Handling ====================
      console.error(`[Secure Middleware] Error in ${pathname}:`, error);
      
      await logSecurityEvent('api_error', {
        severity: 'high',
        ip: clientIP,
        userEmail: ctx.userEmail || undefined,
        userAgent,
        requestPath: pathname,
        requestMethod: method,
        requestId,
        details: { 
          error: error.message,
          duration: Date.now() - startTime,
        },
      });
      
      return secureErrorResponse(
        process.env.NODE_ENV === 'development' 
          ? error.message 
          : 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
        500,
        requestId
      );
    }
  };
}

// ==================== PRESET WRAPPERS ====================

/**
 * Public API wrapper (no auth, standard rate limiting)
 */
export function withPublicAPI(handler: SecureAPIHandler) {
  return withSecureMiddleware(handler, {
    requireAuth: false,
    rateLimit: RATE_LIMITS.api,
  });
}

/**
 * Authenticated API wrapper
 */
export function withAuthenticatedAPI(handler: SecureAPIHandler) {
  return withSecureMiddleware(handler, {
    requireAuth: true,
    rateLimit: RATE_LIMITS.api,
  });
}

/**
 * Admin API wrapper (strict security)
 */
export function withAdminAPI(handler: SecureAPIHandler) {
  return withSecureMiddleware(handler, {
    requireAuth: true,
    requireAdmin: true,
    rateLimit: RATE_LIMITS.admin,
    auditEventType: 'admin_action',
    blockThreatLevel: 'high',
  });
}

/**
 * Payment API wrapper (maximum security)
 */
export function withPaymentAPI(handler: SecureAPIHandler) {
  return withSecureMiddleware(handler, {
    requireAuth: true,
    requireTurnstile: true,
    rateLimit: RATE_LIMITS.payment,
    auditEventType: 'payment_attempt',
    blockThreatLevel: 'medium',
    sanitizeBody: true,
  });
}

/**
 * Order API wrapper
 */
export function withOrderAPI(handler: SecureAPIHandler) {
  return withSecureMiddleware(handler, {
    requireAuth: true,
    rateLimit: RATE_LIMITS.order,
    sanitizeBody: true,
  });
}

/**
 * Strict API wrapper (for sensitive operations)
 */
export function withStrictAPI(handler: SecureAPIHandler) {
  return withSecureMiddleware(handler, {
    requireAuth: true,
    requireNonce: true,
    rateLimit: RATE_LIMITS.strict,
    auditEventType: 'suspicious_activity',
    blockThreatLevel: 'low',
  });
}

// ==================== UTILITY EXPORTS ====================

export { generateNonce };
