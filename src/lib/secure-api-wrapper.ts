// src/lib/secure-api-wrapper.ts
// Secure API Wrapper with full security features
// ใช้ wrap API routes เพื่อเพิ่มความปลอดภัยอัตโนมัติ

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isAdminEmail, isAdminEmailAsync } from './auth';
import { logSecurityEvent, SecurityEventType } from './security-audit';
import { checkCombinedRateLimit, RATE_LIMITS, getRateLimitHeaders } from './rate-limit';
import { verifyTurnstileToken, getClientIP } from './cloudflare';
import { sanitizeString, escapeHtml } from './security';
import crypto from 'crypto';

// ==================== TYPES ====================

export interface SecureAPIConfig {
  // Authentication
  requireAuth?: boolean;
  requireAdmin?: boolean;
  
  // Rate limiting
  rateLimit?: {
    maxRequests: number;
    windowSeconds: number;
    prefix?: string;
  };
  
  // Turnstile verification
  requireTurnstile?: boolean;
  
  // Input validation
  maxBodySize?: number; // bytes
  validateBody?: (body: any) => { valid: boolean; error?: string };
  
  // Audit logging
  auditEventType?: SecurityEventType;
  skipAudit?: boolean;
  
  // Security checks
  skipSecurityChecks?: boolean;
}

export interface SecureAPIContext {
  session: any | null;
  userEmail: string | null;
  isAdmin: boolean;
  clientIP: string;
  requestId: string;
  userAgent: string;
}

type APIHandler = (
  request: NextRequest,
  context: SecureAPIContext,
  params?: any
) => Promise<NextResponse>;

// ==================== HELPERS ====================

function generateRequestId(): string {
  return `req_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
}

function sanitizeErrorMessage(message: string): string {
  return sanitizeString(message).substring(0, 200);
}

function createErrorResponse(
  message: string,
  status: number,
  requestId?: string
): NextResponse {
  const response = NextResponse.json(
    { status: 'error', message: sanitizeErrorMessage(message) },
    { status }
  );
  
  if (requestId) {
    response.headers.set('X-Request-Id', requestId);
  }
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  
  return response;
}

// ==================== SECURITY CHECKS ====================

const MALICIOUS_PATTERNS = [
  /<script/i,
  /javascript:/i,
  /on\w+\s*=/i,
  /\.\.\//,
  /%2e%2e/i,
  /\0/,
  /%00/,
  /union.*select/i,
  /drop.*table/i,
  /insert.*into/i,
  /delete.*from/i,
];

function containsMaliciousContent(input: any, depth: number = 0): boolean {
  if (depth > 10) return false; // Prevent infinite recursion
  
  if (typeof input === 'string') {
    return MALICIOUS_PATTERNS.some(p => p.test(input));
  }
  
  if (Array.isArray(input)) {
    return input.some(item => containsMaliciousContent(item, depth + 1));
  }
  
  if (input && typeof input === 'object') {
    for (const [key, value] of Object.entries(input)) {
      if (containsMaliciousContent(key, depth + 1)) return true;
      if (containsMaliciousContent(value, depth + 1)) return true;
    }
  }
  
  return false;
}

// ==================== MAIN WRAPPER ====================

export function withSecureAPI(
  handler: APIHandler,
  config: SecureAPIConfig = {}
): (request: NextRequest, context?: { params?: Promise<any> }) => Promise<NextResponse> {
  const {
    requireAuth = false,
    requireAdmin = false,
    rateLimit = RATE_LIMITS.api,
    requireTurnstile = false,
    maxBodySize = 5 * 1024 * 1024, // 5MB default
    validateBody,
    auditEventType,
    skipAudit = false,
    skipSecurityChecks = false,
  } = config;

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
    };

    try {
      // 1. Rate limiting
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
        
        const response = createErrorResponse(
          'คุณส่งคำขอเร็วเกินไป กรุณารอสักครู่',
          429,
          requestId
        );
        const headers = getRateLimitHeaders(rateLimitResult);
        Object.entries(headers).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
        return response;
      }

      // 2. Security checks on request
      if (!skipSecurityChecks) {
        const url = pathname + request.nextUrl.search;
        if (containsMaliciousContent(url)) {
          await logSecurityEvent('injection_attempt', {
            severity: 'high',
            ip: clientIP,
            userAgent,
            requestPath: pathname,
            requestMethod: method,
            requestId,
            details: { type: 'url_injection' },
          });
          return createErrorResponse('Invalid request', 400, requestId);
        }
      }

      // 3. Authentication
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
          return createErrorResponse('กรุณาเข้าสู่ระบบ', 401, requestId);
        }

        ctx.isAdmin = await isAdminEmailAsync(ctx.userEmail);

        if (requireAdmin && !ctx.isAdmin) {
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
          return createErrorResponse('ไม่มีสิทธิ์เข้าถึง', 403, requestId);
        }
      }

      // 4. Body validation for POST/PUT/PATCH
      let body: any = undefined;
      if (['POST', 'PUT', 'PATCH'].includes(method)) {
        const contentLength = parseInt(request.headers.get('content-length') || '0');
        
        if (contentLength > maxBodySize) {
          return createErrorResponse('Request body too large', 413, requestId);
        }

        try {
          const contentType = request.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            body = await request.json();
            
            // Check for malicious content in body
            if (!skipSecurityChecks && containsMaliciousContent(body)) {
              await logSecurityEvent('injection_attempt', {
                severity: 'high',
                ip: clientIP,
                userEmail: ctx.userEmail || undefined,
                userAgent,
                requestPath: pathname,
                requestMethod: method,
                requestId,
                details: { type: 'body_injection' },
              });
              return createErrorResponse('Invalid request data', 400, requestId);
            }
            
            // Custom validation
            if (validateBody) {
              const validation = validateBody(body);
              if (!validation.valid) {
                return createErrorResponse(validation.error || 'Validation failed', 400, requestId);
              }
            }
          }
        } catch (e) {
          return createErrorResponse('Invalid request body', 400, requestId);
        }
      }

      // 5. Turnstile verification
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
          return createErrorResponse(
            turnstileResult.error || 'กรุณายืนยันว่าคุณไม่ใช่บอท',
            400,
            requestId
          );
        }
      }

      // 6. Execute handler
      const params = routeContext?.params ? await routeContext.params : undefined;
      const response = await handler(request, ctx, params);

      // 7. Audit logging (success)
      if (!skipAudit && auditEventType) {
        await logSecurityEvent(auditEventType, {
          severity: 'low',
          ip: clientIP,
          userEmail: ctx.userEmail || undefined,
          userAgent,
          requestPath: pathname,
          requestMethod: method,
          requestId,
          details: { status: response.status, duration: Date.now() - startTime },
        });
      }

      // 8. Add security headers to response
      response.headers.set('X-Request-Id', requestId);
      response.headers.set('X-Content-Type-Options', 'nosniff');
      
      const rateLimitHeaders = getRateLimitHeaders(rateLimitResult);
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });

      return response;

    } catch (error: any) {
      // Log error
      await logSecurityEvent('api_error', {
        severity: 'medium',
        ip: clientIP,
        userEmail: ctx.userEmail || undefined,
        userAgent,
        requestPath: pathname,
        requestMethod: method,
        requestId,
        details: {
          error: error.message?.substring(0, 500),
          stack: process.env.NODE_ENV === 'development' ? error.stack?.substring(0, 1000) : undefined,
        },
      });

      console.error(`[API Error] ${pathname}:`, error);

      // Return safe error response
      return createErrorResponse(
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
 * Wrapper for public APIs (no auth, standard rate limiting)
 */
export function withPublicAPI(handler: APIHandler) {
  return withSecureAPI(handler, {
    requireAuth: false,
    rateLimit: RATE_LIMITS.api,
  });
}

/**
 * Wrapper for authenticated APIs
 */
export function withAuthenticatedAPI(handler: APIHandler) {
  return withSecureAPI(handler, {
    requireAuth: true,
    rateLimit: RATE_LIMITS.api,
  });
}

/**
 * Wrapper for admin-only APIs
 */
export function withAdminAPI(handler: APIHandler) {
  return withSecureAPI(handler, {
    requireAuth: true,
    requireAdmin: true,
    rateLimit: RATE_LIMITS.admin,
    auditEventType: 'admin_action',
  });
}

/**
 * Wrapper for payment APIs (strict security)
 */
export function withPaymentAPI(handler: APIHandler) {
  return withSecureAPI(handler, {
    requireAuth: true,
    requireTurnstile: true,
    rateLimit: RATE_LIMITS.payment,
    auditEventType: 'payment_attempt',
  });
}

/**
 * Wrapper for order creation APIs
 */
export function withOrderAPI(handler: APIHandler) {
  return withSecureAPI(handler, {
    requireAuth: false, // Guest checkout allowed
    requireTurnstile: true,
    rateLimit: RATE_LIMITS.order,
    auditEventType: 'order_created',
  });
}
