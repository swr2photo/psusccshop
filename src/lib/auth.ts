// src/lib/auth.ts
// Centralized authentication utilities for server-side use

import { getServerSession, Session } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { NextResponse } from 'next/server';

// Admin emails list - reads from environment variable first, then fallback to hardcoded list
const ADMIN_EMAILS_ENV = process.env.NEXT_PUBLIC_ADMIN_EMAILS || process.env.ADMIN_EMAILS || '';
const ADMIN_EMAILS_HARDCODED = [
  'psuscc@psusci.club',
  'doralaikon.th@gmail.com',
  'tanawatnoojit@gmail.com',
  'tanawat.n@psu.ac.th',
];

// Combine and normalize all admin emails
const ADMIN_EMAILS_RAW = [
  ...ADMIN_EMAILS_ENV.split(',').map((e) => e.trim()).filter(Boolean),
  ...ADMIN_EMAILS_HARDCODED,
];

export const ADMIN_EMAILS = [...new Set(ADMIN_EMAILS_RAW.map((e) => e.trim().toLowerCase()).filter(Boolean))];

/**
 * Check if an email belongs to an admin
 */
export const isAdminEmail = (email: string | null | undefined): boolean => {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return ADMIN_EMAILS.includes(normalized);
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
  return isAdminEmail(email);
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

  if (!isAdminEmail(email)) {
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
