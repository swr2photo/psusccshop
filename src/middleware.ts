// src/middleware.ts
// Advanced Security Middleware for Next.js
// Provides maximum protection against common attacks

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

// ==================== CONFIGURATION ====================

const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 100;
const MAX_AUTH_REQUESTS_PER_WINDOW = 10;
const MAX_ADMIN_REQUESTS_PER_WINDOW = 50;

// Sensitive paths that require extra protection
const SENSITIVE_PATHS = [
  '/api/admin',
  '/api/orders',
  '/api/payment',
  '/api/slip',
  '/api/cron',
];

// Public paths that don't need auth
const PUBLIC_PATHS = [
  '/api/config',
  '/api/chatbot',
  '/_next',
  '/favicon.ico',
  '/api/auth',
];

// Blocked patterns in URLs
const BLOCKED_URL_PATTERNS = [
  /\.\.\//, // Path traversal
  /\.\.\\/, // Path traversal Windows
  /%2e%2e/i, // Encoded path traversal
  /<script/i, // XSS
  /javascript:/i, // XSS
  /\0/, // Null byte
  /%00/, // Encoded null byte
  /\/\/\//, // Multiple slashes
];

// Suspicious user agents (attack tools)
const BLOCKED_USER_AGENTS = [
  /sqlmap/i,
  /nikto/i,
  /nmap/i,
  /masscan/i,
  /burpsuite/i,
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
];

// ==================== RATE LIMITING (In-Memory) ====================

interface RateLimitEntry {
  count: number;
  resetTime: number;
  blocked: boolean;
  blockUntil?: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();
const ipBlockList = new Map<string, number>(); // IP -> unblock timestamp
const suspiciousActivity = new Map<string, number>(); // IP -> strike count

// Cleanup old entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      if (now > entry.resetTime) {
        rateLimitStore.delete(key);
      }
    }
    for (const [ip, unblockTime] of ipBlockList.entries()) {
      if (now > unblockTime) {
        ipBlockList.delete(ip);
      }
    }
  }, 300000);
}

function getClientIP(request: NextRequest): string {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

function checkRateLimit(identifier: string, maxRequests: number): { allowed: boolean; remaining: number } {
  const now = Date.now();
  let entry = rateLimitStore.get(identifier);

  if (!entry || now > entry.resetTime) {
    entry = {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW_MS,
      blocked: false,
    };
    rateLimitStore.set(identifier, entry);
    return { allowed: true, remaining: maxRequests - 1 };
  }

  entry.count++;
  
  if (entry.count > maxRequests) {
    entry.blocked = true;
    return { allowed: false, remaining: 0 };
  }

  return { allowed: true, remaining: maxRequests - entry.count };
}

function blockIP(ip: string, durationMs: number): void {
  ipBlockList.set(ip, Date.now() + durationMs);
  console.warn(`[Security] IP blocked: ${ip.substring(0, 8)}*** for ${durationMs}ms`);
}

function isIPBlocked(ip: string): boolean {
  const unblockTime = ipBlockList.get(ip);
  if (!unblockTime) return false;
  if (Date.now() > unblockTime) {
    ipBlockList.delete(ip);
    return false;
  }
  return true;
}

function recordSuspiciousActivity(ip: string): number {
  const strikes = (suspiciousActivity.get(ip) || 0) + 1;
  suspiciousActivity.set(ip, strikes);
  
  // Auto-block after 5 strikes
  if (strikes >= 5) {
    blockIP(ip, 3600000); // Block for 1 hour
    suspiciousActivity.delete(ip);
  }
  
  return strikes;
}

// ==================== SECURITY CHECKS ====================

function containsBlockedPattern(url: string): boolean {
  return BLOCKED_URL_PATTERNS.some(pattern => pattern.test(url));
}

function isBlockedUserAgent(userAgent: string | null): boolean {
  if (!userAgent) return false;
  return BLOCKED_USER_AGENTS.some(pattern => pattern.test(userAgent));
}

function isSuspiciousRequest(request: NextRequest): { suspicious: boolean; reason?: string } {
  const url = request.nextUrl.pathname + request.nextUrl.search;
  const userAgent = request.headers.get('user-agent');
  const contentLength = request.headers.get('content-length');
  
  // Check URL patterns
  if (containsBlockedPattern(url)) {
    return { suspicious: true, reason: 'blocked_url_pattern' };
  }
  
  // Check user agent
  if (isBlockedUserAgent(userAgent)) {
    return { suspicious: true, reason: 'blocked_user_agent' };
  }
  
  // Check for empty user agent (often bots)
  if (!userAgent && !request.nextUrl.pathname.startsWith('/_next')) {
    return { suspicious: true, reason: 'missing_user_agent' };
  }
  
  // Check for oversized requests (potential DoS)
  if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) { // 10MB
    return { suspicious: true, reason: 'oversized_request' };
  }
  
  // Check for suspicious headers
  const suspiciousHeaders = ['x-forwarded-host', 'x-original-url', 'x-rewrite-url'];
  for (const header of suspiciousHeaders) {
    const value = request.headers.get(header);
    if (value && containsBlockedPattern(value)) {
      return { suspicious: true, reason: `suspicious_header_${header}` };
    }
  }
  
  return { suspicious: false };
}

// ==================== RESPONSE HELPERS ====================

function securityResponse(message: string, status: number): NextResponse {
  return new NextResponse(
    JSON.stringify({ status: 'error', message }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  );
}

// ==================== MAIN MIDDLEWARE ====================

export async function middleware(request: NextRequest) {
  const startTime = Date.now();
  const clientIP = getClientIP(request);
  const pathname = request.nextUrl.pathname;
  const userAgent = request.headers.get('user-agent');
  
  // Skip middleware for static files
  if (pathname.match(/\.(ico|png|jpg|jpeg|gif|svg|css|js|woff|woff2)$/)) {
    return NextResponse.next();
  }
  
  // 1. Check if IP is blocked
  if (isIPBlocked(clientIP)) {
    console.warn(`[Security] Blocked IP attempted access: ${clientIP.substring(0, 8)}***`);
    return securityResponse('Access denied', 403);
  }
  
  // 2. Check for suspicious activity
  const suspicionCheck = isSuspiciousRequest(request);
  if (suspicionCheck.suspicious) {
    const strikes = recordSuspiciousActivity(clientIP);
    console.warn(`[Security] Suspicious request: ${suspicionCheck.reason} from ${clientIP.substring(0, 8)}*** (strikes: ${strikes})`);
    
    // Immediately block for severe violations
    if (suspicionCheck.reason === 'blocked_user_agent' || suspicionCheck.reason === 'blocked_url_pattern') {
      blockIP(clientIP, 86400000); // 24 hours
      return securityResponse('Access denied', 403);
    }
    
    return securityResponse('Invalid request', 400);
  }
  
  // 3. Rate limiting
  const isPublicPath = PUBLIC_PATHS.some(p => pathname.startsWith(p));
  const isSensitivePath = SENSITIVE_PATHS.some(p => pathname.startsWith(p));
  const isAdminPath = pathname.startsWith('/api/admin');
  
  let maxRequests = MAX_REQUESTS_PER_WINDOW;
  if (isAdminPath) {
    maxRequests = MAX_ADMIN_REQUESTS_PER_WINDOW;
  } else if (pathname.startsWith('/api/auth')) {
    maxRequests = MAX_AUTH_REQUESTS_PER_WINDOW;
  }
  
  const rateLimitKey = `${clientIP}:${isAdminPath ? 'admin' : 'api'}`;
  const rateLimit = checkRateLimit(rateLimitKey, maxRequests);
  
  if (!rateLimit.allowed) {
    recordSuspiciousActivity(clientIP);
    console.warn(`[Security] Rate limit exceeded: ${clientIP.substring(0, 8)}***`);
    return new NextResponse(
      JSON.stringify({ status: 'error', message: 'คุณส่งคำขอเร็วเกินไป กรุณารอสักครู่' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': '60',
          'X-RateLimit-Limit': String(maxRequests),
          'X-RateLimit-Remaining': '0',
        },
      }
    );
  }
  
  // 4. Authentication check for sensitive paths
  if (isSensitivePath && !isPublicPath) {
    try {
      const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
      
      if (!token?.email) {
        return securityResponse('Unauthorized', 401);
      }
      
      // Additional check for admin paths
      if (isAdminPath) {
        const adminEmails = (process.env.ADMIN_EMAILS || process.env.NEXT_PUBLIC_ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase());
        const staticAdmins = ['psuscc@psusci.club', 'doralaikon.th@gmail.com', 'tanawatnoojit@gmail.com', 'tanawat.n@psu.ac.th'];
        const allAdmins = [...new Set([...adminEmails, ...staticAdmins])];
        
        if (!allAdmins.includes(token.email.toLowerCase())) {
          console.warn(`[Security] Non-admin access attempt to ${pathname}: ${token.email}`);
          return securityResponse('Forbidden', 403);
        }
      }
    } catch (error) {
      console.error('[Security] Token validation error:', error);
      return securityResponse('Authentication error', 401);
    }
  }
  
  // 5. Add security headers to response
  const response = NextResponse.next();
  
  // Request ID for tracking
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  response.headers.set('X-Request-Id', requestId);
  
  // Additional security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  
  // Rate limit headers
  response.headers.set('X-RateLimit-Limit', String(maxRequests));
  response.headers.set('X-RateLimit-Remaining', String(rateLimit.remaining));
  
  // Log request (for security audit)
  const duration = Date.now() - startTime;
  if (pathname.startsWith('/api/') && !pathname.startsWith('/_next')) {
    console.log(`[${new Date().toISOString()}] ${request.method} ${pathname} - ${clientIP.substring(0, 8)}*** (${duration}ms) [${requestId}]`);
  }
  
  return response;
}

// Configure which routes use middleware
export const config = {
  matcher: [
    // Match all API routes
    '/api/:path*',
    // Match admin pages
    '/admin/:path*',
    // Exclude static files
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.svg$).*)',
  ],
};
