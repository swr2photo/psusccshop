// src/proxy.ts
// Next.js Proxy for security headers, CORS, and rate limiting (Next.js 16+)

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// --- CORS config ---
const allowedOrigins = [
  'https://sccshop.psusci.club',
  'https://www.sccshop.psusci.club',
];

// Check if origin is allowed
function isAllowedOrigin(origin: string | null): boolean {
  // No origin header = same-origin request (allowed)
  if (!origin) return true;

  // Exact match for production domains
  if (allowedOrigins.includes(origin)) return true;

  // Allow subdomains of psusci.club
  if (origin.endsWith('.psusci.club')) return true;

  // Allow localhost for development
  if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) return true;

  // Allow GitHub Codespaces public URLs (HMR/CSR in dev)
  if (origin.endsWith('.app.github.dev')) return true;

  return false;
}

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
 * Routes that require stricter rate limiting (POST/PUT/DELETE only)
 * GET requests have higher limits for better UX
 */
const STRICT_RATE_LIMIT_ROUTES = [
  '/api/payment',
  '/payment/verify',
  '/api/upload',
];

/**
 * Routes with moderate rate limiting (all methods)
 */
const MODERATE_RATE_LIMIT_ROUTES = [
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

export default function proxy(request: NextRequest) {
  const origin = request.headers.get('origin');
  const pathname = request.nextUrl.pathname;
  const method = request.method;
  const ip = getIP(request);
  const userAgent = request.headers.get('user-agent');

  // --- CORS Check ---
  if (!isAllowedOrigin(origin)) {
    return NextResponse.json(
      { status: 'error', message: 'CORS policy: This origin is not allowed' },
      { status: 403 }
    );
  }

  const response = NextResponse.next();
  
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
  
  // Apply rate limiting based on route and method
  const isStrictRoute = STRICT_RATE_LIMIT_ROUTES.some(route => pathname.startsWith(route));
  const isModerateRoute = MODERATE_RATE_LIMIT_ROUTES.some(route => pathname.startsWith(route));
  const isWriteMethod = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);
  
  // Rate limits: 
  // - Strict routes (payment, upload): 30/min
  // - Moderate routes (admin): 60/min
  // - Write methods on API: 60/min
  // - Read methods: 200/min
  let rateLimit = 200;
  let rateLimitKey = 'normal';
  
  if (isStrictRoute) {
    rateLimit = 30;
    rateLimitKey = 'strict';
  } else if (isModerateRoute) {
    rateLimit = 60;
    rateLimitKey = 'moderate';
  } else if (isWriteMethod && pathname.startsWith('/api/')) {
    rateLimit = 60;
    rateLimitKey = 'write';
  }
  
  const windowSeconds = 60;
  
  if (!checkMiddlewareRateLimit(`${ip}:${rateLimitKey}`, rateLimit, windowSeconds)) {
    console.warn(`[Security] Rate limit exceeded: ${ip} on ${pathname} (${rateLimitKey})`);
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
