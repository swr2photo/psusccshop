// src/lib/auth.ts
// Centralized authentication utilities for server-side use

import { getServerSession, Session } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { NextResponse } from 'next/server';
import { getJson } from '@/lib/filebase';
import type { AdminPermissions } from '@/lib/config';

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
 * Check if an email belongs to the super admin
 */
export const isSuperAdminEmail = (email: string | null | undefined): boolean => {
  if (!email) return false;
  return email.trim().toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
};

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
 * Get admin permissions from config for a specific email
 */
const getAdminPermissions = async (email: string): Promise<AdminPermissions> => {
  const defaultPerms: AdminPermissions = {
    canManageShop: false,
    canManageSheet: false,
    canManageAnnouncement: false,
    canManageOrders: true,
    canManageProducts: true,
    canManagePickup: false,
    canManageEvents: false,
    canManagePromoCodes: false,
    canManageRefunds: true,
    canManageTracking: true,
    canManageShipping: false,
    canManagePayment: false,
    canManageSupport: true,
    canSendEmail: false,
  };
  try {
    const config = await getJson<{ adminPermissions?: Record<string, AdminPermissions> }>(CONFIG_KEY);
    const perms = config?.adminPermissions?.[email.trim().toLowerCase()];
    return perms ? { ...defaultPerms, ...perms } : defaultPerms;
  } catch {
    return defaultPerms;
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
 * Require super admin authentication - returns error response if not super admin
 */
export const requireSuperAdmin = async (): Promise<{ isAdmin: true; email: string } | NextResponse> => {
  const session = await getSession();
  const email = session?.user?.email;

  if (!email) {
    return NextResponse.json(
      { status: 'error', message: 'กรุณาเข้าสู่ระบบ' },
      { status: 401 }
    );
  }

  if (!isSuperAdminEmail(email)) {
    return NextResponse.json(
      { status: 'error', message: 'ไม่มีสิทธิ์เข้าถึง (Super Admin only)' },
      { status: 403 }
    );
  }

  return { isAdmin: true, email };
};

/**
 * Require admin with a specific permission - returns error response if not authorized
 * Super admin always passes all permission checks
 */
export const requireAdminWithPermission = async (
  permission: keyof AdminPermissions
): Promise<{ isAdmin: true; email: string } | NextResponse> => {
  const session = await getSession();
  const email = session?.user?.email;

  if (!email) {
    return NextResponse.json(
      { status: 'error', message: 'กรุณาเข้าสู่ระบบ' },
      { status: 401 }
    );
  }

  // Super admin always passes
  if (isSuperAdminEmail(email)) {
    return { isAdmin: true, email };
  }

  // Check if admin at all
  const adminCheck = await isAdminEmailAsync(email);
  if (!adminCheck) {
    return NextResponse.json(
      { status: 'error', message: 'ไม่มีสิทธิ์เข้าถึง (Admin only)' },
      { status: 403 }
    );
  }

  // Check specific permission
  const perms = await getAdminPermissions(email);
  if (!perms[permission]) {
    return NextResponse.json(
      { status: 'error', message: `ไม่มีสิทธิ์ดำเนินการนี้ (ต้องการสิทธิ์: ${permission})` },
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
