/** Helpers for support-chat typing indicators (Realtime broadcast + DB fallback). */

const TYPING_STALE_MS = 5000;

/** True when message list length or latest id changed (for poll dedup). */
export function chatMessagesChanged(
  prev: { id: string }[] | undefined,
  next: { id: string }[] | undefined,
): boolean {
  const a = prev || [];
  const b = next || [];
  if (a.length !== b.length) return true;
  if (a.length === 0) return false;
  return a[a.length - 1].id !== b[b.length - 1].id;
}

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
