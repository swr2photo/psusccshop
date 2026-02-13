import type { NextConfig } from "next";

// Semantic versioning — matches package.json
const pkg = require('./package.json');
const buildTime = new Date().toISOString();
const buildHash = Math.floor(Date.now() / 1000).toString(36);
const buildVersion = `v${pkg.version}+${buildHash}`;

const nextConfig: NextConfig = {
  // Enable standalone output for Docker
  output: 'standalone',
  // Expose build info to client
  env: {
    NEXT_PUBLIC_BUILD_TIME: buildTime,
    NEXT_PUBLIC_BUILD_VERSION: buildVersion,
    NEXT_PUBLIC_APP_VERSION: pkg.version,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'ui-avatars.com' },
      { protocol: 'https', hostname: 's3.filebase.com' },
      { protocol: 'https', hostname: '**.s3.filebase.com' },
      { protocol: 'https', hostname: 'ipfs.filebase.io' },
      // Supabase Storage
      { protocol: 'https', hostname: '**.supabase.co' },
      // OAuth provider avatars
      { protocol: 'https', hostname: 'profile.line-scdn.net' },
      { protocol: 'https', hostname: 'platform-lookaside.fbsbx.com' },
      { protocol: 'https', hostname: '**.fbcdn.net' },
      { protocol: 'https', hostname: 'graph.microsoft.com' },
    ],
    // Performance: aggressive image caching (31 days)
    minimumCacheTTL: 2678400,
    // Performance: modern image formats
    formats: ['image/avif', 'image/webp'],
    // Performance: limit image sizes to what we actually use
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },
  // Security: Hide server info
  poweredByHeader: false,
  reactStrictMode: true,
  // Security: Disable source maps in production
  productionBrowserSourceMaps: false,
  // Security: Compress responses
  compress: true,
  // ======================== PERFORMANCE ========================
  // Tree-shake barrel exports for heavy packages
  // This dramatically reduces bundle size for MUI and lucide-react
  experimental: {
    optimizePackageImports: [
      '@mui/material',
      '@mui/icons-material',
      'lucide-react',
      '@supabase/supabase-js',
      'date-fns',
      '@tanstack/react-query',
      'swr',
      'zustand',
      'qrcode.react',
    ],
  },
  // Enable HTTPS in production (for custom server, not Vercel)
  ...(process.env.NODE_ENV === 'production' && process.env.HTTPS_KEY && process.env.HTTPS_CERT
    ? {
        server: {
          https: {
            key: process.env.HTTPS_KEY,
            cert: process.env.HTTPS_CERT,
          },
        },
      }
    : {}),
  // Set security headers for all routes
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        // Content Security Policy - Relaxed for Next.js compatibility
        // Note: Next.js requires 'unsafe-eval' and 'unsafe-inline' for hydration and HMR
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self';",
            // 'unsafe-eval' needed for Next.js (both dev HMR and production hydration in some cases)
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://static.cloudflareinsights.com;",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;",
            "img-src 'self' data: blob: https://*.filebase.io https://*.filebase.com https://*.googleusercontent.com https://ui-avatars.com https://*.supabase.co https://profile.line-scdn.net https://platform-lookaside.fbsbx.com https://*.fbcdn.net https://graph.microsoft.com;",
            "font-src 'self' https://fonts.gstatic.com;",
            "connect-src 'self' https://*.filebase.com https://*.filebase.io https://api.resend.com https://challenges.cloudflare.com https://*.supabase.co wss://*.supabase.co;",
            "media-src 'self';",
            "worker-src 'self';",
            "frame-src https://challenges.cloudflare.com;",
            "frame-ancestors 'none';",
            "object-src 'none';",
            "base-uri 'self';",
            "form-action 'self';",
            "upgrade-insecure-requests;",
            "block-all-mixed-content;",
          ].join(' '),
        },
        // Prevent Clickjacking
        {
          key: 'X-Frame-Options',
          value: 'DENY',
        },
        // Prevent MIME sniffing
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff',
        },
        // XSS Protection for legacy browsers
        {
          key: 'X-XSS-Protection',
          value: '1; mode=block',
        },
        // Referrer Policy - No referrer to external
        {
          key: 'Referrer-Policy',
          value: 'no-referrer',
        },
        // Permissions Policy - Restrict all
        {
          key: 'Permissions-Policy',
          value: 'camera=(self), microphone=(), geolocation=(), interest-cohort=(), payment=(self), usb=(), accelerometer=(), gyroscope=(), magnetometer=(), autoplay=(), encrypted-media=(self), fullscreen=(self)',
        },
        // Prevent DNS prefetching to avoid information leakage
        {
          key: 'X-DNS-Prefetch-Control',
          value: 'off',
        },
        // Cross-Origin Embedder Policy
        {
          key: 'Cross-Origin-Embedder-Policy',
          value: 'credentialless',
        },
        // Cross-Origin Opener Policy
        {
          key: 'Cross-Origin-Opener-Policy',
          value: 'same-origin',
        },
        // Cross-Origin Resource Policy
        {
          key: 'Cross-Origin-Resource-Policy',
          value: 'same-origin',
        },
        // Download options - prevent execution of downloads
        {
          key: 'X-Download-Options',
          value: 'noopen',
        },
        // Permitted cross-domain policies
        {
          key: 'X-Permitted-Cross-Domain-Policies',
          value: 'none',
        },
      ],
    },
    // HSTS for production
    ...(process.env.NODE_ENV === 'production' ? [{
      source: '/(.*)',
      headers: [
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=31536000; includeSubDomains; preload',
        },
      ],
    }] : []),
    // Block common attack paths
    {
      source: '/(wp-admin|wp-login|wp-content|.env|.git|.htaccess|xmlrpc.php|readme.html)(.*)',
      headers: [
        {
          key: 'X-Robots-Tag',
          value: 'noindex, nofollow',
        },
      ],
    },
    // Service Worker — no cache so browsers always get the latest version
    {
      source: '/sw.js',
      headers: [
        {
          key: 'Cache-Control',
          value: 'no-cache, no-store, must-revalidate',
        },
        {
          key: 'Service-Worker-Allowed',
          value: '/',
        },
      ],
    },
    // Performance: Long cache for static assets (hashed filenames)
    {
      source: '/_next/static/(.*)',
      headers: [
        {
          key: 'Cache-Control',
          value: 'public, max-age=31536000, immutable',
        },
      ],
    },
    // Performance: Cache fonts aggressively
    {
      source: '/fonts/(.*)',
      headers: [
        {
          key: 'Cache-Control',
          value: 'public, max-age=31536000, immutable',
        },
      ],
    },
    // Performance: Cache images with revalidation
    {
      source: '/(.*\\.(?:png|jpg|jpeg|gif|webp|avif|svg|ico))',
      headers: [
        {
          key: 'Cache-Control',
          value: 'public, max-age=86400, stale-while-revalidate=604800',
        },
      ],
    },
    // Performance: API routes — allow stale-while-revalidate for GET requests
    {
      source: '/api/config',
      headers: [
        {
          key: 'Cache-Control',
          value: 'public, s-maxage=60, stale-while-revalidate=300',
        },
      ],
    },
    {
      source: '/api/shipping/options',
      headers: [
        {
          key: 'Cache-Control',
          value: 'public, s-maxage=300, stale-while-revalidate=600',
        },
      ],
    },
    {
      source: '/api/inventory',
      headers: [
        {
          key: 'Cache-Control',
          value: 'public, s-maxage=30, stale-while-revalidate=120',
        },
      ],
    },
    {
      source: '/api/reviews',
      headers: [
        {
          key: 'Cache-Control',
          value: 'public, s-maxage=60, stale-while-revalidate=300',
        },
      ],
    },
  ],
  // Redirects - block common attack vectors
  redirects: async () => [
    {
      source: '/.env',
      destination: '/404',
      permanent: false,
    },
    {
      source: '/.git/:path*',
      destination: '/404',
      permanent: false,
    },
    {
      source: '/wp-admin/:path*',
      destination: '/404',
      permanent: false,
    },
    {
      source: '/wp-login.php',
      destination: '/404',
      permanent: false,
    },
    {
      source: '/xmlrpc.php',
      destination: '/404',
      permanent: false,
    },
    {
      source: '/phpmyadmin/:path*',
      destination: '/404',
      permanent: false,
    },
  ],
};

if (process.env.NODE_ENV === 'production') {
  process.env.NEXT_PUBLIC_DEBUG = 'false';
}

export default nextConfig;