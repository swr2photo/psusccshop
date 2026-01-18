// src/middleware.ts
// Next.js Middleware for security headers and rate limiting

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Security headers to add to all responses
 */
const securityHeaders = {
  // Prevent clickjacking
  'X-Frame-Options': 'DENY',
  
  // Prevent MIME type sniffing
  'X-Content-Type-Options': 'nosniff',
  
  // Enable XSS filter
  'X-XSS-Protection': '1; mode=block',
  
  // Referrer policy
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  
  // Permissions policy
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  
  // HSTS (HTTP Strict Transport Security)
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

/**
 * Simple in-memory rate limiting for middleware
 * Note: This resets on server restart. For production, use Redis.
 */
const ipRequestCounts = new Map<string, { count: number; resetTime: number }>();

function checkMiddlewareRateLimit(ip: string, limit: number, windowSeconds: number): boolean {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  
  let entry = ipRequestCounts.get(ip);
  
  if (!entry || now > entry.resetTime) {
    entry = { count: 0, resetTime: now + windowMs };
  }
  
  entry.count += 1;
  ipRequestCounts.set(ip, entry);
  
  // Cleanup old entries periodically
  if (ipRequestCounts.size > 10000) {
    const threshold = now - windowMs;
    for (const [key, val] of ipRequestCounts.entries()) {
      if (val.resetTime < threshold) {
        ipRequestCounts.delete(key);
      }
    }
  }
  
  return entry.count <= limit;
}

/**
 * Get client IP from request
 */
function getIP(request: NextRequest): string {
  // Cloudflare IP
  const cfIP = request.headers.get('cf-connecting-ip');
  if (cfIP) return cfIP;
  
  // X-Forwarded-For
  const xForwardedFor = request.headers.get('x-forwarded-for');
  if (xForwardedFor) return xForwardedFor.split(',')[0].trim();
  
  // X-Real-IP
  const xRealIP = request.headers.get('x-real-ip');
  if (xRealIP) return xRealIP;
  
  // Fallback
  return 'unknown';
}

/**
 * Check if user agent looks like a bot
 */
function isSuspiciousUserAgent(userAgent: string | null): boolean {
  if (!userAgent) return true;
  
  const ua = userAgent.toLowerCase();
  
  // Allow common browsers
  if (ua.includes('mozilla') || ua.includes('chrome') || ua.includes('safari') || ua.includes('firefox') || ua.includes('edge')) {
    return false;
  }
  
  // Block obvious bots (unless it's a legitimate crawler)
  const suspiciousPatterns = [
    'bot', 'crawler', 'spider', 'scraper', 'curl', 'wget', 'python-requests',
    'httpclient', 'libwww', 'lwp-', 'java/', 'perl/', 'ruby/', 'scanner',
  ];
  
  // Allow known good bots
  const allowedBots = ['googlebot', 'bingbot', 'slurp', 'duckduckbot', 'facebookexternalhit'];
  for (const allowed of allowedBots) {
    if (ua.includes(allowed)) return false;
  }
  
  for (const pattern of suspiciousPatterns) {
    if (ua.includes(pattern)) return true;
  }
  
  return false;
}

/**
 * Routes that require stricter rate limiting
 */
const STRICT_RATE_LIMIT_ROUTES = [
  '/api/orders',
  '/api/payment',
  '/payment/verify',
  '/api/upload',
  '/api/admin',
];

/**
 * Routes that should block suspicious bots
 */
const BOT_PROTECTED_ROUTES = [
  '/api/orders',
  '/api/payment',
  '/payment/',
  '/api/cart',
  '/api/profile',
];

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const pathname = request.nextUrl.pathname;
  const ip = getIP(request);
  const userAgent = request.headers.get('user-agent');
  
  // Add security headers to all responses
  for (const [key, value] of Object.entries(securityHeaders)) {
    response.headers.set(key, value);
  }
  
  // Skip rate limiting for static files
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/static/') ||
    pathname.includes('.') // files with extensions
  ) {
    return response;
  }
  
  // Block suspicious bots on protected routes
  const isBotProtected = BOT_PROTECTED_ROUTES.some(route => pathname.startsWith(route));
  if (isBotProtected && isSuspiciousUserAgent(userAgent)) {
    console.warn(`[Security] Blocked suspicious bot: ${ip} - ${userAgent?.slice(0, 100)}`);
    return new NextResponse(
      JSON.stringify({ status: 'error', message: 'Access denied' }),
      {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          ...securityHeaders,
        },
      }
    );
  }
  
  // Apply rate limiting
  const isStrictRoute = STRICT_RATE_LIMIT_ROUTES.some(route => pathname.startsWith(route));
  const rateLimit = isStrictRoute ? 30 : 200; // requests per minute
  const windowSeconds = 60;
  
  if (!checkMiddlewareRateLimit(`${ip}:${isStrictRoute ? 'strict' : 'normal'}`, rateLimit, windowSeconds)) {
    console.warn(`[Security] Rate limit exceeded: ${ip} on ${pathname}`);
    return new NextResponse(
      JSON.stringify({ status: 'error', message: 'Too many requests. Please try again later.' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(windowSeconds),
          ...securityHeaders,
        },
      }
    );
  }
  
  // Add request ID for tracing
  response.headers.set('X-Request-ID', `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`);
  
  return response;
}

/**
 * Configure which routes the middleware applies to
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
