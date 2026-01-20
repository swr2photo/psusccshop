// src/lib/api-security.ts
// Security wrapper for API routes

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { 
  performSecurityChecks, 
  logSecurityEvent, 
  blockIP, 
  checkSlidingWindowRateLimit,
  sanitizeString,
  escapeHtml,
} from './security';

// ==================== TYPES ====================

export interface SecureAPIOptions {
  // Rate limiting
  rateLimit?: {
    maxRequests: number;
    windowMs: number;
  };
  // Require authentication
  requireAuth?: boolean;
  // Require admin
  requireAdmin?: boolean;
  // Enable request logging
  enableLogging?: boolean;
  // Max body size (bytes)
  maxBodySize?: number;
  // Skip security checks (use with caution)
  skipSecurityChecks?: boolean;
}

export interface SecureRequest extends NextRequest {
  securityContext?: {
    clientIP: string;
    userAgent: string | null;
    requestId: string;
    timestamp: number;
  };
}

// ==================== HELPER FUNCTIONS ====================

function getClientIP(request: NextRequest): string {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

function generateRequestId(): string {
  return `req_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
}

/**
 * Create a secure error response
 */
export function secureErrorResponse(
  message: string,
  status: number = 400,
  details?: Record<string, any>
): NextResponse {
  // Sanitize error message to prevent information leakage
  const safeMessage = sanitizeString(message);
  
  return NextResponse.json(
    {
      status: 'error',
      message: safeMessage,
      ...(process.env.NODE_ENV === 'development' && details ? { details } : {}),
    },
    { 
      status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      }
    }
  );
}

/**
 * Create a secure success response
 */
export function secureSuccessResponse(
  data: any,
  status: number = 200
): NextResponse {
  return NextResponse.json(
    {
      status: 'success',
      ...data,
    },
    { 
      status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
      }
    }
  );
}

// ==================== SECURITY WRAPPER ====================

/**
 * Wrap an API handler with security protections
 */
export function withSecurity(
  handler: (request: SecureRequest, context?: any) => Promise<NextResponse>,
  options: SecureAPIOptions = {}
) {
  const {
    rateLimit = { maxRequests: 60, windowMs: 60000 },
    enableLogging = true,
    maxBodySize = 10 * 1024 * 1024, // 10MB default
    skipSecurityChecks = false,
  } = options;

  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    const startTime = Date.now();
    const clientIP = getClientIP(request);
    const requestId = generateRequestId();
    const userAgent = request.headers.get('user-agent');

    // Add security context to request
    const secureRequest = request as SecureRequest;
    secureRequest.securityContext = {
      clientIP,
      userAgent,
      requestId,
      timestamp: startTime,
    };

    try {
      // 1. Rate limiting
      const rateLimitKey = `api_${clientIP}_${request.nextUrl.pathname}`;
      const rateLimitResult = checkSlidingWindowRateLimit(
        rateLimitKey,
        rateLimit.maxRequests,
        rateLimit.windowMs
      );

      if (!rateLimitResult.allowed) {
        logSecurityEvent('rate_limit_exceeded', {
          ip: clientIP,
          path: request.nextUrl.pathname,
          remaining: rateLimitResult.remaining,
        }, 'medium');

        return new NextResponse(
          JSON.stringify({ 
            status: 'error', 
            message: 'คุณส่งคำขอเร็วเกินไป กรุณารอสักครู่' 
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': String(Math.ceil(rateLimitResult.resetMs / 1000)),
              'X-RateLimit-Limit': String(rateLimit.maxRequests),
              'X-RateLimit-Remaining': String(rateLimitResult.remaining),
            },
          }
        );
      }

      // 2. Security checks (if not skipped)
      if (!skipSecurityChecks) {
        // Parse body if present
        let body: any = undefined;
        const contentType = request.headers.get('content-type');
        
        if (contentType?.includes('application/json')) {
          try {
            const text = await request.text();
            
            // Check body size
            if (text.length > maxBodySize) {
              return secureErrorResponse('Request body too large', 413);
            }
            
            body = JSON.parse(text);
            
            // Create new request with body for handler
            // (since we already consumed the body)
            Object.defineProperty(secureRequest, 'json', {
              value: async () => body,
            });
          } catch {
            return secureErrorResponse('Invalid JSON body', 400);
          }
        }

        const securityResult = performSecurityChecks(request, body);

        if (!securityResult.passed) {
          logSecurityEvent('security_check_failed', {
            ip: clientIP,
            path: request.nextUrl.pathname,
            failedChecks: securityResult.failedChecks,
            userAgent,
          }, 'high');

          // Block IP for severe violations
          if (securityResult.failedChecks.some(c => 
            c.includes('malicious') || c.includes('honeypot')
          )) {
            blockIP(clientIP, 86400000, securityResult.failedChecks.join(',')); // 24 hours
          }

          return secureErrorResponse('Request rejected for security reasons', 403);
        }

        // Log warnings
        if (securityResult.warnings.length > 0 && enableLogging) {
          logSecurityEvent('security_warning', {
            ip: clientIP,
            path: request.nextUrl.pathname,
            warnings: securityResult.warnings,
          }, 'low');
        }
      }

      // 3. Execute handler
      const response = await handler(secureRequest, context);

      // 4. Log request (if enabled)
      if (enableLogging) {
        const duration = Date.now() - startTime;
        console.log(`[API] ${request.method} ${request.nextUrl.pathname} - ${response.status} (${duration}ms) [${requestId}]`);
      }

      // 5. Add security headers to response
      response.headers.set('X-Request-Id', requestId);
      response.headers.set('X-Content-Type-Options', 'nosniff');

      return response;

    } catch (error: any) {
      // Log error
      logSecurityEvent('api_error', {
        ip: clientIP,
        path: request.nextUrl.pathname,
        error: error.message,
        requestId,
      }, 'medium');

      console.error(`[API Error] ${request.nextUrl.pathname}:`, error);

      // Return safe error response
      return secureErrorResponse(
        process.env.NODE_ENV === 'development' 
          ? error.message 
          : 'An error occurred processing your request',
        500
      );
    }
  };
}

// ==================== INPUT VALIDATION ====================

/**
 * Validate and sanitize order reference
 */
export function validateOrderRef(ref: any): string | null {
  if (typeof ref !== 'string') return null;
  
  const sanitized = sanitizeString(ref);
  if (!/^ORD-\d+$/.test(sanitized)) return null;
  
  return sanitized;
}

/**
 * Validate and sanitize email
 */
export function validateEmail(email: any): string | null {
  if (typeof email !== 'string') return null;
  
  const sanitized = sanitizeString(email).toLowerCase();
  if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(sanitized)) return null;
  
  return sanitized;
}

/**
 * Validate and sanitize phone number
 */
export function validatePhone(phone: any): string | null {
  if (typeof phone !== 'string') return null;
  
  const cleaned = phone.replace(/[^0-9]/g, '');
  if (cleaned.length < 9 || cleaned.length > 15) return null;
  
  return cleaned;
}

/**
 * Validate positive integer
 */
export function validatePositiveInt(value: any): number | null {
  const num = parseInt(value, 10);
  if (isNaN(num) || num < 0) return null;
  return num;
}

/**
 * Validate enum value
 */
export function validateEnum<T extends string>(value: any, validValues: T[]): T | null {
  if (typeof value !== 'string') return null;
  const upper = value.toUpperCase() as T;
  if (!validValues.includes(upper)) return null;
  return upper;
}

/**
 * Deep sanitize object
 */
export function deepSanitize<T>(obj: T): T {
  if (typeof obj === 'string') {
    return escapeHtml(sanitizeString(obj)) as T;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => deepSanitize(item)) as T;
  }
  
  if (obj && typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const sanitizedKey = sanitizeString(key);
      result[sanitizedKey] = deepSanitize(value);
    }
    return result as T;
  }
  
  return obj;
}

// ==================== EXPORTS ====================

export {
  sanitizeString,
  escapeHtml,
  logSecurityEvent,
} from './security';
