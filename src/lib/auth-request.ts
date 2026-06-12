/**
 * Request-based auth helpers for Elysia API and other non-Next handlers.
 * Uses NextAuth JWT from cookies (same session as the Next.js frontend).
 */

import { getToken } from 'next-auth/jwt';
import { isAdminEmailAsync, isSuperAdminEmail } from '@/lib/auth';

export type AuthFailure = { ok: false; status: number; message: string };
export type AuthSuccess = { ok: true; email: string };

export async function getEmailFromRequest(request: Request): Promise<string | null> {
  const token = await getToken({
    req: request as Parameters<typeof getToken>[0]['req'],
    secret: process.env.NEXTAUTH_SECRET,
  });
  return (token?.email as string | undefined) ?? null;
}

export async function requireAuthFromRequest(
  request: Request,
): Promise<AuthSuccess | AuthFailure> {
  const email = await getEmailFromRequest(request);
  if (!email) {
    return { ok: false, status: 401, message: 'กรุณาเข้าสู่ระบบ' };
  }
  return { ok: true, email };
}

export async function requireAdminFromRequest(
  request: Request,
): Promise<AuthSuccess | AuthFailure> {
  const auth = await requireAuthFromRequest(request);
  if (!auth.ok) return auth;

  const isAdmin = await isAdminEmailAsync(auth.email);
  if (!isAdmin) {
    return { ok: false, status: 403, message: 'ไม่มีสิทธิ์เข้าถึง (Admin only)' };
  }
  return auth;
}

export async function requireSuperAdminFromRequest(
  request: Request,
): Promise<AuthSuccess | AuthFailure> {
  const auth = await requireAuthFromRequest(request);
  if (!auth.ok) return auth;

  if (!isSuperAdminEmail(auth.email)) {
    return { ok: false, status: 403, message: 'ไม่มีสิทธิ์เข้าถึง (Super Admin only)' };
  }
  return auth;
}
