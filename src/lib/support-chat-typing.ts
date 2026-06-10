/** Helpers for support-chat typing indicators (Realtime broadcast + DB fallback). */

const TYPING_STALE_MS = 5000;

export function isRecentTyping(
  typing: boolean | null | undefined,
  typingAt: string | Date | null | undefined,
  maxMs = TYPING_STALE_MS,
): boolean {
  if (!typing || !typingAt) return false;
  return Date.now() - new Date(typingAt).getTime() < maxMs;
}

export function getDbTypingFromSession(session: Record<string, unknown> | null | undefined) {
  if (!session) {
    return { adminTyping: false, customerTyping: false };
  }
  const adminTyping = Boolean(session.adminTyping ?? session.admin_typing);
  const adminTypingAt = (session.adminTypingAt ?? session.admin_typing_at) as string | undefined;
  const customerTyping = Boolean(session.customerTyping ?? session.customer_typing);
  const customerTypingAt = (session.customerTypingAt ?? session.customer_typing_at) as string | undefined;
  return {
    adminTyping: isRecentTyping(adminTyping, adminTypingAt),
    customerTyping: isRecentTyping(customerTyping, customerTypingAt),
  };
}
