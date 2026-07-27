/** Admin console section IDs (path segments under /admin/[section]) */

export const ADMIN_TAB_SECTIONS = [
  'dashboard',
  'products',
  'orders',
  'pickup',
  'support',
  'announce',
  'settings',
  'email',
  'user-logs',
  'logs',
  'shipping',
  'payment',
  'tracking',
  'refunds',
  'events',
  'promo',
  'live',
  'shops',
] as const;

export type AdminSection = (typeof ADMIN_TAB_SECTIONS)[number];

export const ADMIN_TAB_TO_SECTION: Record<number, AdminSection> = {
  0: 'dashboard',
  1: 'products',
  2: 'orders',
  3: 'pickup',
  4: 'support',
  5: 'announce',
  6: 'settings',
  7: 'email',
  8: 'user-logs',
  9: 'logs',
  10: 'shipping',
  11: 'payment',
  12: 'tracking',
  13: 'refunds',
  14: 'events',
  15: 'promo',
  16: 'live',
  17: 'shops',
};

export const ADMIN_SECTION_TO_TAB: Record<string, number> = Object.fromEntries(
  Object.entries(ADMIN_TAB_TO_SECTION).map(([idx, section]) => [section, Number(idx)])
);

export function isAdminSection(value: string | null | undefined): value is AdminSection {
  return Boolean(value && (ADMIN_SECTION_TO_TAB[value] !== undefined));
}

export function adminSectionFromTab(tab: number): AdminSection {
  return ADMIN_TAB_TO_SECTION[tab] ?? 'dashboard';
}

export function adminTabFromSection(section: string | null | undefined): number {
  if (!section) return 0;
  return ADMIN_SECTION_TO_TAB[section] ?? 0;
}

export function adminPath(section: string, search?: string): string {
  const q = search && search !== '?' ? (search.startsWith('?') ? search : `?${search}`) : '';
  return `/admin/${section}${q}`;
}
