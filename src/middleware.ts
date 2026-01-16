// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// --- CORS config ---
const allowedOrigins = [
  'https://psusccshop.psusci.club',
  'https://www.psusccshop.psusci.club',
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
  
  return false;
}

// --- Simple in-memory rate limiter (per IP, per minute) ---
const rateLimitMap = new Map<string, { count: number; last: number }>();
const RATE_LIMIT = 60; // max requests per minute per IP

export function middleware(request: NextRequest) {
  const origin = request.headers.get('origin');
  
  // --- CORS ---
  if (!isAllowedOrigin(origin)) {
    return NextResponse.json(
      { status: 'error', message: 'CORS policy: This origin is not allowed' }, 
      { status: 403 }
    );
  }

  // --- Rate Limiting ---
  // Next.js Edge API does not provide request.ip; use x-forwarded-for or fallback to hostname
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.nextUrl.hostname || 'unknown';
  const now = Date.now();
  const entry = rateLimitMap.get(ip) || { count: 0, last: now };
  if (now - entry.last > 60_000) {
    entry.count = 0;
    entry.last = now;
  }
  entry.count++;
  rateLimitMap.set(ip, entry);
  if (entry.count > RATE_LIMIT) {
    return NextResponse.json({ status: 'error', message: 'Too many requests' }, { status: 429 });
  }

  // --- CSP Header ---
  const response = NextResponse.next();
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self' https://psusccshop.psusci.club;",
      "script-src 'self' 'unsafe-inline' https://psusccshop.psusci.club;",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;",
      "img-src * data: blob:;",
      "font-src 'self' https://fonts.gstatic.com;",
      "connect-src *;",
      "frame-ancestors 'none';",
      "object-src 'none';"
    ].join(' ')
  );
  return response;
}

export const config = {
  matcher: [
    '/api/:path*',
    '/admin',
    // Add more paths if needed
  ],
};
