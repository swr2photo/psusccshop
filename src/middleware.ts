// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// --- CORS config ---
const allowedOrigins = [
  'https://psusccshop.psusci.club',
  // Add more allowed domains here
];

// --- Simple in-memory rate limiter (per IP, per minute) ---
const rateLimitMap = new Map<string, { count: number; last: number }>();
const RATE_LIMIT = 60; // max requests per minute per IP

export function middleware(request: NextRequest) {
  // --- CORS ---
  const origin = request.headers.get('origin');
  if (origin && !allowedOrigins.includes(origin)) {
    return new NextResponse('CORS policy: This origin is not allowed', { status: 403 });
  }

  // --- Rate Limiting ---
  const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
  const now = Date.now();
  const entry = rateLimitMap.get(ip) || { count: 0, last: now };
  if (now - entry.last > 60_000) {
    entry.count = 0;
    entry.last = now;
  }
  entry.count++;
  rateLimitMap.set(ip, entry);
  if (entry.count > RATE_LIMIT) {
    return new NextResponse('Too many requests', { status: 429 });
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
