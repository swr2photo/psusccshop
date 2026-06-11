import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getRedisClient } from '@/lib/redis';

// Edge middleware (middleware.ts) — required for @opennextjs/cloudflare; proxy.ts is Node-only in Next 16.

// --- CORS config ---
const allowedOrigins = [
  'https://sccshop.psusci.club',
  'https://www.sccshop.psusci.club',
  'https://sccshop.psuscc.club',
  'https://www.sccshop.psuscc.club',
];

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  if (origin.endsWith('.psusci.club') || origin.endsWith('.psuscc.club')) return true;
  if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) return true;
  if (origin.endsWith('.app.github.dev')) return true;
  return false;
}

const securityHeaders = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

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

function getIP(request: NextRequest): string {
  const cfIP = request.headers.get('cf-connecting-ip');
  if (cfIP) return cfIP;

  const xForwardedFor = request.headers.get('x-forwarded-for');
  if (xForwardedFor) return xForwardedFor.split(',')[0].trim();

  const xRealIP = request.headers.get('x-real-ip');
  if (xRealIP) return xRealIP;

  return 'unknown';
}

function isSuspiciousUserAgent(userAgent: string | null): boolean {
  if (!userAgent) return true;

  const ua = userAgent.toLowerCase();

  if (ua.includes('mozilla') || ua.includes('chrome') || ua.includes('safari') || ua.includes('firefox') || ua.includes('edge')) {
    return false;
  }

  const suspiciousPatterns = [
    'bot', 'crawler', 'spider', 'scraper', 'curl', 'wget', 'python-requests',
    'httpclient', 'libwww', 'lwp-', 'java/', 'perl/', 'ruby/', 'scanner',
  ];

  const allowedBots = ['googlebot', 'bingbot', 'slurp', 'duckduckbot', 'facebookexternalhit'];
  for (const allowed of allowedBots) {
    if (ua.includes(allowed)) return false;
  }

  for (const pattern of suspiciousPatterns) {
    if (ua.includes(pattern)) return true;
  }

  return false;
}

const STRICT_RATE_LIMIT_ROUTES = [
  '/api/payment',
  '/api/upload',
  '/api/auto-email',
  '/api/gas',
];

const MODERATE_RATE_LIMIT_ROUTES = [
  '/api/admin',
];

const BOT_PROTECTED_ROUTES = [
  '/api/orders',
  '/api/payment',
  '/payment/',
  '/api/cart',
  '/api/profile',
];

const EXTERNAL_API_ROUTES = [
  '/api/auth/',
  '/api/payment/webhook/',
  '/api/cron/',
  '/api/image/',
];

const NAVIGABLE_API_ROUTES = [
  '/api/invoice',
];

const CACHEABLE_API_PREFIXES = [
  '/api/config',
  '/api/live',
  '/api/shops/catalog',
  '/api/reviews',
  '/api/inventory',
  '/api/chatbot',
  '/api/support-chat/settings/public',
  '/api/image/',
];

export async function middleware(request: NextRequest) {
  const origin = request.headers.get('origin');
  const pathname = request.nextUrl.pathname;
  const method = request.method;
  const ip = getIP(request);
  const userAgent = request.headers.get('user-agent');

  if (pathname.startsWith('/api/orders') && method === 'POST') {
    try {
      const redis = getRedisClient();
      if (redis) {
        const isOrderOpen = await redis.get<boolean>('is_order_open');
        if (isOrderOpen === false) {
          return NextResponse.json(
            {
              success: false,
              status: 'error',
              message: 'ขออภัย ขณะนี้ระบบปิดรับคำสั่งซื้อแล้ว',
            },
            {
              status: 403,
              headers: {
                'Content-Type': 'application/json; charset=utf-8',
                ...securityHeaders,
              },
            }
          );
        }
      } else {
        // Redis is an optional fast-path cache; /api/orders validates isOpen from DB
        console.warn('[Middleware] Redis unavailable, deferring shop-open check to /api/orders');
      }
    } catch (error) {
      console.warn('[Middleware] Redis lookup failed, deferring shop-open check to /api/orders:', error);
    }
  }

  if (!pathname.startsWith('/api/auth/') && !isAllowedOrigin(origin)) {
    return NextResponse.json(
      { status: 'error', message: 'CORS policy: This origin is not allowed' },
      { status: 403 }
    );
  }

  const response = NextResponse.next();

  for (const [key, value] of Object.entries(securityHeaders)) {
    response.headers.set(key, value);
  }

  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/static/') ||
    pathname.includes('.')
  ) {
    return response;
  }

  if (pathname.startsWith('/api/')) {
    const secFetchMode = request.headers.get('sec-fetch-mode');
    const secFetchDest = request.headers.get('sec-fetch-dest');
    if (secFetchMode === 'navigate' || secFetchDest === 'document') {
      const isExternalRoute = EXTERNAL_API_ROUTES.some(route => pathname.startsWith(route));
      const isNavigableRoute = NAVIGABLE_API_ROUTES.some(route => pathname.startsWith(route));
      if (!isExternalRoute && !isNavigableRoute) {
        return new NextResponse(
          JSON.stringify({ status: 'error', message: 'Direct API access is not allowed' }),
          {
            status: 403,
            headers: {
              'Content-Type': 'application/json',
              ...securityHeaders,
            },
          }
        );
      }
    }
  }

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

  const isStrictRoute = STRICT_RATE_LIMIT_ROUTES.some(route => pathname.startsWith(route));
  const isModerateRoute = MODERATE_RATE_LIMIT_ROUTES.some(route => pathname.startsWith(route));
  const isWriteMethod = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);

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

  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  response.headers.set('X-Request-ID', requestId);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');

  const isCacheableApi = CACHEABLE_API_PREFIXES.some(prefix => pathname.startsWith(prefix));
  if (pathname.startsWith('/api/') && !isCacheableApi) {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
  }

  if (isSuspiciousUserAgent(userAgent)) {
    console.warn(`[Security] Suspicious request: ${ip} - ${userAgent?.slice(0, 100)} - ${pathname}`);
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
