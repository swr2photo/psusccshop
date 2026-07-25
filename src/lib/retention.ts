/**
 * Legal / PDPA retention periods (days).
 * Aligned with privacy policy + Thai accounting practice for commerce records.
 */
export const RETENTION_DAYS = {
  /** Orders, payments, refunds — accounting / dispute */
  COMMERCE: 730,
  /** Cancelled orders only (still keep short window for support) */
  CANCELLED_ORDERS: 365,
  /** User activity logs (login, cart, profile, admin actions on user) */
  USER_ACTIVITY: 730,
  /** Immutable entity audit trail (before/after) */
  AUDIT_TRAIL: 730,
  /** Security / threat telemetry */
  SECURITY: 730,
  /** Transactional email logs */
  EMAIL: 365,
  /** Support chat messages */
  SUPPORT_CHAT: 365,
} as const;

export function retentionCutoff(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}
