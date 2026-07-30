// Edit support-chat message helpers (no schema migration required)

import { db } from './db';
import { supportChats, supportMessages } from '../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { normalizeEmail } from './auth';
import {
  parseChatMessage,
  stripEditedToken,
  withEditedToken,
  formatReplyPrefix,
} from './chat-message';
import type { ChatMessage } from './support-chat';

function toMsg(row: {
  id: string;
  sessionId: string;
  sender: string;
  senderEmail: string | null;
  senderName: string | null;
  senderAvatar: string | null;
  message: string;
  createdAt: Date | string;
  isRead: boolean;
  readAt: Date | string | null;
  isUnsent: boolean;
}): ChatMessage {
  return {
    id: row.id,
    session_id: row.sessionId,
    sender: row.sender as ChatMessage['sender'],
    sender_email: row.senderEmail || undefined,
    sender_name: row.senderName || undefined,
    sender_avatar: row.senderAvatar || undefined,
    message: row.message,
    created_at:
      typeof row.createdAt === 'string'
        ? row.createdAt
        : row.createdAt?.toISOString?.() || String(row.createdAt),
    is_read: row.isRead,
    read_at:
      row.readAt == null
        ? undefined
        : typeof row.readAt === 'string'
          ? row.readAt
          : row.readAt?.toISOString?.() || undefined,
    is_unsent: row.isUnsent || undefined,
  };
}

/**
 * Customer can edit their own text-only messages.
 * Preserves reply prefix; media/voice/image-only messages are rejected.
 */
export async function editChatMessage(
  sessionId: string,
  messageId: string,
  userEmail: string,
  newText: string
): Promise<{ success: boolean; message?: ChatMessage; error?: string }> {
  const email = normalizeEmail(userEmail);
  const trimmed = newText.trim();
  if (!trimmed) {
    return { success: false, error: 'ข้อความว่างไม่ได้' };
  }
  if (trimmed.length > 4000) {
    return { success: false, error: 'ข้อความยาวเกินไป' };
  }

  const rows = await db
    .select()
    .from(supportMessages)
    .where(and(eq(supportMessages.id, messageId), eq(supportMessages.sessionId, sessionId)))
    .limit(1);
  const row = rows[0];
  if (!row) {
    return { success: false, error: 'ไม่พบข้อความ' };
  }
  if (row.sender !== 'customer' || normalizeEmail(row.senderEmail || '') !== email) {
    return { success: false, error: 'แก้ไขได้เฉพาะข้อความของตัวเอง' };
  }

  const parsed = parseChatMessage(row.message);
  if (parsed.voiceUrl || parsed.voiceBroken || parsed.imageUrl || parsed.orderRef) {
    return { success: false, error: 'แก้ไขได้เฉพาะข้อความตัวอักษร' };
  }

  let next = trimmed;
  if (parsed.replyToId && parsed.replyPreview != null) {
    next = formatReplyPrefix(parsed.replyToId, parsed.replyPreview) + next;
  } else if (parsed.replyPreview != null) {
    const safe = parsed.replyPreview.replace(/\\/g, '\\\\').replace(/"/g, '\\"').slice(0, 80);
    next = `[ตอบกลับ: "${safe}"]\n${next}`;
  }
  next = withEditedToken(stripEditedToken(next));

  const updated = await db
    .update(supportMessages)
    .set({ message: next })
    .where(and(eq(supportMessages.id, messageId), eq(supportMessages.sessionId, sessionId)))
    .returning();

  const msg = updated[0];
  if (!msg) {
    return { success: false, error: 'อัปเดตไม่สำเร็จ' };
  }

  // Refresh last-message preview if this was the latest message
  const lastRows = await db
    .select({ id: supportMessages.id, message: supportMessages.message })
    .from(supportMessages)
    .where(eq(supportMessages.sessionId, sessionId))
    .orderBy(desc(supportMessages.createdAt))
    .limit(1);
  if (lastRows[0]?.id === messageId) {
    const preview = parseChatMessage(next).text || next;
    await db
      .update(supportChats)
      .set({
        lastMessagePreview: preview.substring(0, 100),
        updatedAt: new Date(),
      })
      .where(eq(supportChats.id, sessionId));
  }

  return { success: true, message: toMsg(msg) };
}
