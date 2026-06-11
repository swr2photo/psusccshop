import { ADMIN_EMAILS, isAdminEmailAsync, isSuperAdminEmail } from '@/lib/auth';
import { getShopConfig } from '@/lib/filebase';
import { getShopAdminPermissions } from '@/lib/shops';

export type AdminUserRole = 'superadmin' | 'admin' | 'shopAdmin';

export interface ResolvedAdminSession {
  userRole: AdminUserRole;
  userEmail: string;
  shopAdminPermissions?: Record<string, boolean>;
}

/** Resolve admin role server-side (shared by bootstrap + legacy data routes). */
export async function resolveAdminSession(authEmail: string): Promise<ResolvedAdminSession> {
  const normalizedEmail = authEmail.trim().toLowerCase();
  let userRole: AdminUserRole = 'admin';
  let shopAdminPerms: Record<string, boolean> | undefined;

  if (isSuperAdminEmail(normalizedEmail)) {
    userRole = 'superadmin';
  } else if (await isAdminEmailAsync(normalizedEmail)) {
    userRole = 'admin';
  } else {
    const cfg = await getShopConfig();
    const configAdminEmails = ((cfg as { adminEmails?: string[] })?.adminEmails || [])
      .map((e) => e.trim().toLowerCase());
    if (configAdminEmails.includes(normalizedEmail)) {
      userRole = 'admin';
    } else {
      userRole = 'shopAdmin';
      shopAdminPerms = (await getShopAdminPermissions(normalizedEmail)) as unknown as Record<string, boolean>;
    }
  }

  return {
    userRole,
    userEmail: authEmail,
    ...(shopAdminPerms ? { shopAdminPermissions: shopAdminPerms } : {}),
  };
}

/** Merge env-var admin emails into shop config for the admin client. */
export function mergeConfigAdminEmails<T extends { adminEmails?: string[] }>(cfg: T): T {
  const configAdminEmails = (cfg.adminEmails || []).map((e) => e.trim().toLowerCase());
  const mergedAdminEmails = [...new Set([...ADMIN_EMAILS, ...configAdminEmails])].filter(Boolean);
  return { ...cfg, adminEmails: mergedAdminEmails };
}
