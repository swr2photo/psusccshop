import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'ui-avatars.com' },
      { protocol: 'https', hostname: 's3.filebase.com' },
      { protocol: 'https', hostname: '**.s3.filebase.com' },
      { protocol: 'https', hostname: 'ipfs.filebase.io' },
    ],
  },
  // Security: Hide server info
  poweredByHeader: false,
  reactStrictMode: true,
  // Security: Disable source maps in production
  productionBrowserSourceMaps: false,
  // Security: Compress responses
  compress: true,
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
        // Content Security Policy - Strict
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self';",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://static.cloudflareinsights.com;",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;",
            "img-src 'self' data: blob: https://*.filebase.io https://*.filebase.com https://lh3.googleusercontent.com https://ui-avatars.com https://*.amazonaws.com;",
            "font-src 'self' https://fonts.gstatic.com;",
            "connect-src 'self' https://*.filebase.com https://*.filebase.io https://api.resend.com https://challenges.cloudflare.com https://fastly.jsdelivr.net https://*.supabase.co wss://*.supabase.co;",
            "media-src 'self' data: blob:;",
            "frame-src https://challenges.cloudflare.com;",
            "frame-ancestors 'none';",
            "object-src 'none';",
            "base-uri 'self';",
            "form-action 'self';",
            "upgrade-insecure-requests;",
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
        // Referrer Policy
        {
          key: 'Referrer-Policy',
          value: 'strict-origin-when-cross-origin',
        },
        // Permissions Policy - Allow camera for QR scanning
        {
          key: 'Permissions-Policy',
          value: 'camera=(self), microphone=(), geolocation=(), interest-cohort=(), payment=(self), usb=()',
        },
        // Prevent DNS prefetching to avoid information leakage
        {
          key: 'X-DNS-Prefetch-Control',
          value: 'off',
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