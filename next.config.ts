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
};

export default nextConfig;