/**
 * Safe date helpers — never call `.toISOString()` on raw API/DB values
 * (they are often ISO strings, null, or Invalid Date).
 */

export function parseToDate(value: unknown): Date | null {
  if (value == null || value === '') return null;
  const date = value instanceof Date ? value : new Date(value as string | number);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

/** Convert Date | string | number to ISO string, or fallback (default ''). */
export function toIsoString(value: unknown, fallback = ''): string {
  const date = parseToDate(value);
  return date ? date.toISOString() : fallback;
}

/** YYYY-MM-DD in UTC (for day bucketing). */
export function toIsoDateKey(value: unknown): string {
  const iso = toIsoString(value);
  return iso ? iso.slice(0, 10) : '';
}
