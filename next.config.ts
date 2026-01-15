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
  poweredByHeader: false,
  reactStrictMode: true,
  productionBrowserSourceMaps: false,
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
  // Set CSP header for all routes (for static export, fallback to middleware for dynamic)
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        {
          key: 'Content-Security-Policy',
          value:
            [
              "default-src 'self' https://psusccshop.psusci.club;",
              "script-src 'self' 'unsafe-inline' https://psusccshop.psusci.club;",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;",
              "img-src * data: blob:;",
              "font-src 'self' https://fonts.gstatic.com;",
              "connect-src *;",
              "frame-ancestors 'none';",
              "object-src 'none';"
            ].join(' '),
        },
      ],
    },
  ],
};

if (process.env.NODE_ENV === 'production') {
  process.env.NEXT_PUBLIC_DEBUG = 'false';
}

export default nextConfig;