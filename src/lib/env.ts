// src/lib/env.ts
// Centralized Environment Variable Validation and Type Safety

interface ServerEnv {
  NODE_ENV: 'development' | 'production' | 'test';
  SUPER_ADMIN_EMAIL: string;
  ADMIN_EMAILS: string[];
  DATABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
  SENTRY_AUTH_TOKEN?: string;
}

interface ClientEnv {
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
  NEXT_PUBLIC_API_URL?: string;
  NEXT_PUBLIC_APP_VERSION?: string;
}

interface EnvConfig extends ServerEnv, ClientEnv {}

function validateEnv(): EnvConfig {
  const isServer = typeof window === 'undefined';

  const nodeEnv = (process.env.NODE_ENV || 'development') as ServerEnv['NODE_ENV'];
  const superAdminEmail = (process.env.SUPER_ADMIN_EMAIL || '').trim().toLowerCase();
  const rawAdminEmails = process.env.ADMIN_EMAILS || '';
  const adminEmails = [
    ...new Set(
      rawAdminEmails
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean)
    ),
  ];

  if (isServer && nodeEnv === 'production') {
    if (!superAdminEmail) {
      console.warn('[env] WARNING: SUPER_ADMIN_EMAIL is not configured in environment!');
    }
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      console.warn('[env] WARNING: NEXT_PUBLIC_SUPABASE_URL is not set!');
    }
  }

  return {
    NODE_ENV: nodeEnv,
    SUPER_ADMIN_EMAIL: superAdminEmail,
    ADMIN_EMAILS: adminEmails,
    DATABASE_URL: process.env.DATABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,

    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION || process.env.NEXT_PUBLIC_BUILD_VERSION,
  };
}

export const env = validateEnv();
