// src/lib/support-chat.ts
// Support Chat System - Types and Drizzle ORM helpers

import { db } from './db';
import { supportChats, supportMessages } from '../db/schema';
import { eq, lt, gt, and, desc, inArray, like, count, sql, avg } from 'drizzle-orm';

// ==================== TYPES ====================

export type ChatStatus = 'pending' | 'active' | 'closed';
export type MessageSender = 'customer' | 'admin' | 'system';

export interface ChatSession {
  id: string;
  customer_email: string;
  customer_name: string;
  customer_avatar?: string;
  status: ChatStatus;
  admin_email?: string;
  admin_name?: string;
  subject?: string;
  shop_id?: string;
  shop_name?: string;
  rating?: number;
  rating_comment?: string;
  created_at: string;
  updated_at: string;
  closed_at?: string;
  last_message_at?: string;
  last_message_preview?: string;
  unread_count: number;
  customer_unread_count: number;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  sender: MessageSender;
  sender_email?: string;
  sender_name?: string;
  sender_avatar?: string;
  message: string;
  created_at: string;
  is_read: boolean;
  read_at?: string;
  is_unsent?: boolean;
}

export interface ChatSessionWithMessages extends ChatSession {
  messages: ChatMessage[];
}

// ==================== HELPERS ====================

function toChat(row: any): ChatSession {
  return {
    id: row.id,
    customer_email: row.customerEmail,
    customer_name: row.customerName,
    customer_avatar: row.customerAvatar || undefined,
    status: row.status as ChatStatus,
    admin_email: row.adminEmail || undefined,
    admin_name: row.adminName || undefined,
    subject: row.subject || undefined,
    shop_id: row.shopId || undefined,
    shop_name: row.shopName || undefined,
    rating: row.rating || undefined,
    rating_comment: row.ratingComment || undefined,
    unread_count: row.unreadCount,
    customer_unread_count: row.customerUnreadCount,
    created_at: row.createdAt?.toISOString?.() || row.createdAt,
    updated_at: row.updatedAt?.toISOString?.() || row.updatedAt,
    closed_at: row.closedAt?.toISOString?.() || row.closedAt || undefined,
    last_message_at: row.lastMessageAt?.toISOString?.() || row.lastMessageAt || undefined,
    last_message_preview: row.lastMessagePreview || undefined,
  };
}

function toMsg(row: any): ChatMessage {
  return {
    id: row.id,
    session_id: row.sessionId,
    sender: row.sender as MessageSender,
    sender_email: row.senderEmail || undefined,
    sender_name: row.senderName || undefined,
    sender_avatar: row.senderAvatar || undefined,
    message: row.message,
    created_at: row.createdAt?.toISOString?.() || row.createdAt,
    is_read: row.isRead,
    read_at: row.readAt?.toISOString?.() || row.readAt || undefined,
    is_unsent: row.isUnsent || undefined,
  };
}

// ==================== DRIZZLE HELPERS ====================

/**
 * Create a new chat session
 */
export async function createChatSession(
  customerEmail: string,
  customerName: string,
  subject?: string,
  initialMessage?: string,
  customerAvatar?: string,
  shopId?: string,
  shopName?: string
): Promise<ChatSession> {
  const sessionId = `chat_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const now = new Date();
  
  const data = await db.insert(supportChats)
    .values({
      id: sessionId,
      customerEmail,
      customerName,
      customerAvatar,
      status: 'pending',
      subject: subject || 'สอบถามข้อมูล',
      shopId,
      shopName,
      unreadCount: initialMessage ? 1 : 0,
      customerUnreadCount: 0,
      lastMessagePreview: initialMessage?.substring(0, 100),
      lastMessageAt: initialMessage ? now : undefined,
    })
    .returning();
  
  if (initialMessage) {
    await addChatMessage(sessionId, 'customer', customerEmail, customerName, initialMessage, customerAvatar);
  }
  
  return toChat(data[0]);
}

/**
 * Get a chat session by ID
 */
export async function getChatSession(sessionId: string): Promise<ChatSession | null> {
  const data = await db.select().from(supportChats).where(eq(supportChats.id, sessionId)).limit(1);
  return data[0] ? toChat(data[0]) : null;
}

/**
 * Get chat session with messages
 */
export async function getChatSessionWithMessages(sessionId: string): Promise<ChatSessionWithMessages | null> {
  const chatRows = await db.select().from(supportChats).where(eq(supportChats.id, sessionId)).limit(1);
  const chat = chatRows[0];
  if (!chat) return null;
  
  const msgRowsSorted = await db.select()
    .from(supportMessages)
    .where(eq(supportMessages.sessionId, sessionId))
    .orderBy(supportMessages.createdAt);
  
  return {
    ...toChat(chat),
    messages: msgRowsSorted.map(toMsg),
  };
}

/**
 * Get all pending chat sessions (for admin)
 */
export async function getPendingChats(): Promise<ChatSession[]> {
  const data = await db.select()
    .from(supportChats)
    .where(eq(supportChats.status, 'pending'))
    .orderBy(supportChats.createdAt);
  return data.map(toChat);
}

/**
 * Get all active chat sessions (for admin)
 */
export async function getActiveChats(adminEmail?: string): Promise<ChatSession[]> {
  const conditions = [eq(supportChats.status, 'active')];
  if (adminEmail) conditions.push(eq(supportChats.adminEmail, adminEmail));
  
  const data = await db.select()
    .from(supportChats)
    .where(and(...conditions))
    .orderBy(desc(supportChats.lastMessageAt));
  return data.map(toChat);
}

/**
 * Get all chats (for admin panel)
 */
export async function getAllChats(status?: ChatStatus, limit = 50): Promise<ChatSession[]> {
  let queryBuilder = db.select().from(supportChats);
  if (status) queryBuilder = queryBuilder.where(eq(supportChats.status, status)) as any;
  
  const data = await queryBuilder
    .orderBy(desc(supportChats.updatedAt))
    .limit(limit);
  return data.map(toChat);
}

/**
 * Get customer's chat sessions
 */
export async function getCustomerChats(customerEmail: string): Promise<ChatSession[]> {
  const data = await db.select()
    .from(supportChats)
    .where(eq(supportChats.customerEmail, customerEmail))
    .orderBy(desc(supportChats.createdAt))
    .limit(10);
  return data.map(toChat);
}

/**
 * Get customer's active chat session (if any)
 */
export async function getCustomerActiveChat(customerEmail: string): Promise<ChatSession | null> {
  const data = await db.select()
    .from(supportChats)
    .where(and(
      eq(supportChats.customerEmail, customerEmail),
      inArray(supportChats.status, ['pending', 'active'])
    ))
    .orderBy(desc(supportChats.createdAt))
    .limit(1);
  return data[0] ? toChat(data[0]) : null;
}

/**
 * Admin accepts a chat session
 */
export async function acceptChatSession(
  sessionId: string, 
  adminEmail: string, 
  adminName: string
): Promise<ChatSession> {
  const data = await db.update(supportChats)
    .set({
      status: 'active',
      adminEmail,
      adminName,
      updatedAt: new Date(),
    })
    .where(eq(supportChats.id, sessionId))
    .returning();
  
  await addChatMessage(sessionId, 'system', undefined, undefined, `${adminName} เข้ารับการสนทนา`);
  
  return toChat(data[0]);
}

/**
 * Close a chat session
 */
export async function closeChatSession(sessionId: string): Promise<ChatSession> {
  const data = await db.update(supportChats)
    .set({
      status: 'closed',
      closedAt: new Date(),
      unreadCount: 0,
      customerUnreadCount: 0,
      updatedAt: new Date(),
    })
    .where(eq(supportChats.id, sessionId))
    .returning();
  
  await addChatMessage(sessionId, 'system', undefined, undefined, 'การสนทนาสิ้นสุดลง');
  
  return toChat(data[0]);
}

/**
 * Rate a chat session
 */
export async function rateChatSession(
  sessionId: string, 
  rating: number, 
  comment?: string
): Promise<ChatSession> {
  const data = await db.update(supportChats)
    .set({
      rating: Math.min(5, Math.max(1, rating)),
      ratingComment: comment?.substring(0, 500),
      updatedAt: new Date(),
    })
    .where(eq(supportChats.id, sessionId))
    .returning();
  return toChat(data[0]);
}

/**
 * Add a message to a chat session
 */
export async function addChatMessage(
  sessionId: string,
  sender: MessageSender,
  senderEmail?: string,
  senderName?: string,
  message?: string,
  senderAvatar?: string
): Promise<ChatMessage> {
  const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const now = new Date();
  
  const data = await db.insert(supportMessages)
    .values({
      id: msgId,
      sessionId,
      sender,
      senderEmail,
      senderName,
      senderAvatar,
      message: message || '',
      isRead: sender === 'system',
    })
    .returning();
  
  // Update session's last message and unread count
  const updateData: any = {
    lastMessageAt: now,
    lastMessagePreview: (message || '').substring(0, 100),
    updatedAt: now,
  };
  
  if (sender === 'customer') {
    updateData.unreadCount = sql`${supportChats.unreadCount} + 1`;
  } else if (sender === 'admin') {
    updateData.customerUnreadCount = sql`${supportChats.customerUnreadCount} + 1`;
  }
  
  await db.update(supportChats)
    .set(updateData)
    .where(eq(supportChats.id, sessionId));
  
  return toMsg(data[0]);
}

/**
 * Get messages for a chat session
 */
export async function getChatMessages(
  sessionId: string, 
  limit = 100,
  afterTimestamp?: string
): Promise<ChatMessage[]> {
  const conditions = [eq(supportMessages.sessionId, sessionId)];
  if (afterTimestamp) {
    conditions.push(gt(supportMessages.createdAt, new Date(afterTimestamp)));
  }
  
  const data = await db.select()
    .from(supportMessages)
    .where(and(...conditions))
    .orderBy(supportMessages.createdAt)
    .limit(limit);
  return data.map(toMsg);
}

/**
 * Mark messages as read
 */
export async function markMessagesAsRead(
  sessionId: string, 
  reader: 'customer' | 'admin'
): Promise<void> {
  const senderToMark = reader === 'customer' ? 'admin' : 'customer';
  
  await db.update(supportMessages)
    .set({
      isRead: true,
      readAt: new Date(),
    })
    .where(and(
      eq(supportMessages.sessionId, sessionId),
      eq(supportMessages.sender, senderToMark),
      eq(supportMessages.isRead, false)
    ));
  
  const updateField = reader === 'customer' ? 'customerUnreadCount' : 'unreadCount';
  await db.update(supportChats)
    .set({ [updateField]: 0, updatedAt: new Date() })
    .where(eq(supportChats.id, sessionId));
}

/**
 * Get chat statistics for admin dashboard
 */
export async function getChatStatistics(): Promise<{
  pendingCount: number;
  activeCount: number;
  todayCount: number;
  avgRating: number;
}> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const [pendingCountResult, activeCountResult, todayCountResult, ratingData] = await Promise.all([
    db.select({ value: count() }).from(supportChats).where(eq(supportChats.status, 'pending')),
    db.select({ value: count() }).from(supportChats).where(eq(supportChats.status, 'active')),
    db.select({ value: count() }).from(supportChats).where(gt(supportChats.createdAt, today)),
    db.select({ value: avg(supportChats.rating) })
      .from(supportChats)
      .where(sql`${supportChats.rating} is not null`),
  ]);
  
  return {
    pendingCount: pendingCountResult[0]?.value || 0,
    activeCount: activeCountResult[0]?.value || 0,
    todayCount: todayCountResult[0]?.value || 0,
    avgRating: Math.round(parseFloat(ratingData[0]?.value || '0') * 10) / 10,
  };
}

/**
 * Unsend/Delete a message (IG-style)
 */
export async function unsendChatMessage(
  sessionId: string,
  messageId: string,
  userEmail: string
): Promise<{ success: boolean; error?: string }> {
  const rows = await db.select()
    .from(supportMessages)
    .where(and(eq(supportMessages.id, messageId), eq(supportMessages.sessionId, sessionId)))
    .limit(1);
  const message = rows[0];
  
  if (!message) {
    return { success: false, error: 'ไม่พบข้อความที่ต้องการยกเลิก' };
  }
  
  if (message.sender !== 'customer' || message.senderEmail !== userEmail) {
    return { success: false, error: 'คุณสามารถยกเลิกได้เฉพาะข้อความของตัวเองเท่านั้น' };
  }
  
  await db.delete(supportMessages).where(eq(supportMessages.id, messageId));
  
  // Update last message preview
  const lastMsgRows = await db.select({
      message: supportMessages.message,
      createdAt: supportMessages.createdAt,
    })
    .from(supportMessages)
    .where(eq(supportMessages.sessionId, sessionId))
    .orderBy(desc(supportMessages.createdAt))
    .limit(1);
  const lastMessage = lastMsgRows[0];
  
  await db.update(supportChats)
    .set({
      lastMessagePreview: lastMessage?.message?.substring(0, 100) || null,
      lastMessageAt: lastMessage?.createdAt || null,
      updatedAt: new Date(),
    })
    .where(eq(supportChats.id, sessionId));
  
  return { success: true };
}

/**
 * Cleanup old chat images (delete images from closed chats older than 7 days)
 */
export async function cleanupOldChatImages(daysOld = 7): Promise<{ deletedImages: number; cleanedChats: number }> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  const oldChats = await db.select({ id: supportChats.id })
    .from(supportChats)
    .where(and(
      eq(supportChats.status, 'closed'),
      lt(supportChats.closedAt, cutoffDate)
    ));
  
  if (oldChats.length === 0) {
    return { deletedImages: 0, cleanedChats: 0 };
  }
  
  const chatIds = oldChats.map((c: any) => c.id);
  
  const messagesWithImages = await db.select({ id: supportMessages.id, message: supportMessages.message })
    .from(supportMessages)
    .where(and(
      inArray(supportMessages.sessionId, chatIds),
      like(supportMessages.message, '%[รูปภาพ:%')
    ));
  
  let deletedImages = 0;
  
  for (const msg of messagesWithImages) {
    const imageMatch = msg.message.match(/\[รูปภาพ: ([^\]]+)\]/);
    if (imageMatch) {
      const newMessage = msg.message.replace(
        /\[รูปภาพ: [^\]]+\]/g, 
        '[รูปภาพถูกลบเนื่องจากผ่านไป 7 วัน]'
      );
      
      await db.update(supportMessages)
        .set({ message: newMessage })
        .where(eq(supportMessages.id, msg.id));
      
      deletedImages++;
    }
  }
  
  return { deletedImages, cleanedChats: chatIds.length };
}
