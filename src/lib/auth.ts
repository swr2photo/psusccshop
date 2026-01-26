// src/lib/auth.ts
// Centralized authentication utilities for server-side use

import { getServerSession, Session } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { NextResponse } from 'next/server';
import { getJson } from '@/lib/filebase';

// Re-export authOptions for convenience
export { authOptions };

// Admin emails list - reads from environment variable first, then fallback to hardcoded list
const ADMIN_EMAILS_ENV = process.env.NEXT_PUBLIC_ADMIN_EMAILS || process.env.ADMIN_EMAILS || '';
const ADMIN_EMAILS_HARDCODED = [
  'psuscc@psusci.club',
  'doralaikon.th@gmail.com',
  'tanawatnoojit@gmail.com',
  'tanawat.n@psu.ac.th',
];

// Super admin email - cannot be removed
export const SUPER_ADMIN_EMAIL = 'doralaikon.th@gmail.com';

// Combine and normalize all admin emails
const ADMIN_EMAILS_RAW = [
  ...ADMIN_EMAILS_ENV.split(',').map((e) => e.trim()).filter(Boolean),
  ...ADMIN_EMAILS_HARDCODED,
];

export const ADMIN_EMAILS = [...new Set(ADMIN_EMAILS_RAW.map((e) => e.trim().toLowerCase()).filter(Boolean))];

// Config key for shop settings
const CONFIG_KEY = 'config/shop-settings.json';

/**
 * Get dynamic admin emails from config stored in Filebase
 */
const getDynamicAdminEmails = async (): Promise<string[]> => {
  try {
    const config = await getJson<{ adminEmails?: string[] }>(CONFIG_KEY);
    return (config?.adminEmails || []).map(e => e.trim().toLowerCase()).filter(Boolean);
  } catch (error) {
    console.error('Failed to load dynamic admin emails:', error);
    return [];
  }
};

/**
 * Check if an email belongs to an admin (static list only - for sync checks)
 */
export const isAdminEmail = (email: string | null | undefined): boolean => {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return ADMIN_EMAILS.includes(normalized);
};

/**
 * Check if an email belongs to an admin (includes dynamic list from config)
 */
export const isAdminEmailAsync = async (email: string | null | undefined): Promise<boolean> => {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  
  // Check static list first
  if (ADMIN_EMAILS.includes(normalized)) return true;
  
  // Check dynamic list from config
  const dynamicAdmins = await getDynamicAdminEmails();
  return dynamicAdmins.includes(normalized);
};

/**
 * Get current session on server side
 */
export const getSession = async (): Promise<Session | null> => {
  return await getServerSession(authOptions);
};

/**
 * Get current user email from session
 */
export const getCurrentUserEmail = async (): Promise<string | null> => {
  const session = await getSession();
  return session?.user?.email || null;
};

/**
 * Check if current session user is admin
 */
export const isCurrentUserAdmin = async (): Promise<boolean> => {
  const email = await getCurrentUserEmail();
  return await isAdminEmailAsync(email);
};

/**
 * Require admin authentication - returns error response if not admin
 */
export const requireAdmin = async (): Promise<{ isAdmin: true; email: string } | NextResponse> => {
  const session = await getSession();
  const email = session?.user?.email;

  if (!email) {
    return NextResponse.json(
      { status: 'error', message: 'กรุณาเข้าสู่ระบบ' },
      { status: 401 }
    );
  }

  // Use async check that includes dynamic admin list
  const isAdmin = await isAdminEmailAsync(email);
  if (!isAdmin) {
    return NextResponse.json(
      { status: 'error', message: 'ไม่มีสิทธิ์เข้าถึง (Admin only)' },
      { status: 403 }
    );
  }

  return { isAdmin: true, email };
};

/**
 * Require authentication - returns error response if not logged in
 */
export const requireAuth = async (): Promise<{ isAuthenticated: true; email: string } | NextResponse> => {
  const session = await getSession();
  const email = session?.user?.email;

  if (!email) {
    return NextResponse.json(
      { status: 'error', message: 'กรุณาเข้าสู่ระบบ' },
      { status: 401 }
    );
  }

  return { isAuthenticated: true, email };
};

/**
 * Check if user owns the resource (by email comparison)
 */
export const isResourceOwner = (resourceEmail: string | null | undefined, userEmail: string | null | undefined): boolean => {
  if (!resourceEmail || !userEmail) return false;
  return resourceEmail.trim().toLowerCase() === userEmail.trim().toLowerCase();
};

/**
 * Sanitize email for storage/comparison
 */
export const normalizeEmail = (email: string | null | undefined): string => {
  return (email || '').trim().toLowerCase();
};
