// src/lib/support-chat.ts
// Support Chat System - Types and Prisma helpers

import { prisma } from './prisma';

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
    ...row,
    created_at: row.created_at?.toISOString?.() || row.created_at,
    updated_at: row.updated_at?.toISOString?.() || row.updated_at,
    closed_at: row.closed_at?.toISOString?.() || row.closed_at,
    last_message_at: row.last_message_at?.toISOString?.() || row.last_message_at,
    status: row.status as ChatStatus,
  };
}

function toMsg(row: any): ChatMessage {
  return {
    ...row,
    created_at: row.created_at?.toISOString?.() || row.created_at,
    read_at: row.read_at?.toISOString?.() || row.read_at,
    sender: row.sender as MessageSender,
  };
}

// ==================== PRISMA HELPERS ====================

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
  
  const data = await prisma.supportChat.create({
    data: {
      id: sessionId,
      customer_email: customerEmail,
      customer_name: customerName,
      customer_avatar: customerAvatar,
      status: 'pending',
      subject: subject || 'สอบถามข้อมูล',
      shop_id: shopId,
      shop_name: shopName,
      unread_count: initialMessage ? 1 : 0,
      customer_unread_count: 0,
      last_message_preview: initialMessage?.substring(0, 100),
      last_message_at: initialMessage ? now : undefined,
    },
  });
  
  if (initialMessage) {
    await addChatMessage(sessionId, 'customer', customerEmail, customerName, initialMessage, customerAvatar);
  }
  
  return toChat(data);
}

/**
 * Get a chat session by ID
 */
export async function getChatSession(sessionId: string): Promise<ChatSession | null> {
  const data = await prisma.supportChat.findUnique({ where: { id: sessionId } });
  return data ? toChat(data) : null;
}

/**
 * Get chat session with messages
 */
export async function getChatSessionWithMessages(sessionId: string): Promise<ChatSessionWithMessages | null> {
  const data = await prisma.supportChat.findUnique({
    where: { id: sessionId },
    include: { messages: { orderBy: { created_at: 'asc' } } },
  });
  
  if (!data) return null;
  
  return {
    ...toChat(data),
    messages: (data.messages || []).map(toMsg),
  };
}

/**
 * Get all pending chat sessions (for admin)
 */
export async function getPendingChats(): Promise<ChatSession[]> {
  const data = await prisma.supportChat.findMany({
    where: { status: 'pending' },
    orderBy: { created_at: 'asc' },
  });
  return data.map(toChat);
}

/**
 * Get all active chat sessions (for admin)
 */
export async function getActiveChats(adminEmail?: string): Promise<ChatSession[]> {
  const where: any = { status: 'active' };
  if (adminEmail) where.admin_email = adminEmail;
  
  const data = await prisma.supportChat.findMany({
    where,
    orderBy: { last_message_at: 'desc' },
  });
  return data.map(toChat);
}

/**
 * Get all chats (for admin panel)
 */
export async function getAllChats(status?: ChatStatus, limit = 50): Promise<ChatSession[]> {
  const where: any = {};
  if (status) where.status = status;
  
  const data = await prisma.supportChat.findMany({
    where,
    orderBy: { updated_at: 'desc' },
    take: limit,
  });
  return data.map(toChat);
}

/**
 * Get customer's chat sessions
 */
export async function getCustomerChats(customerEmail: string): Promise<ChatSession[]> {
  const data = await prisma.supportChat.findMany({
    where: { customer_email: customerEmail },
    orderBy: { created_at: 'desc' },
    take: 10,
  });
  return data.map(toChat);
}

/**
 * Get customer's active chat session (if any)
 */
export async function getCustomerActiveChat(customerEmail: string): Promise<ChatSession | null> {
  const data = await prisma.supportChat.findFirst({
    where: {
      customer_email: customerEmail,
      status: { in: ['pending', 'active'] },
    },
    orderBy: { created_at: 'desc' },
  });
  return data ? toChat(data) : null;
}

/**
 * Admin accepts a chat session
 */
export async function acceptChatSession(
  sessionId: string, 
  adminEmail: string, 
  adminName: string
): Promise<ChatSession> {
  const data = await prisma.supportChat.update({
    where: { id: sessionId },
    data: {
      status: 'active',
      admin_email: adminEmail,
      admin_name: adminName,
    },
  });
  
  await addChatMessage(sessionId, 'system', undefined, undefined, `${adminName} เข้ารับการสนทนา`);
  
  return toChat(data);
}

/**
 * Close a chat session
 */
export async function closeChatSession(sessionId: string): Promise<ChatSession> {
  const data = await prisma.supportChat.update({
    where: { id: sessionId },
    data: {
      status: 'closed',
      closed_at: new Date(),
      unread_count: 0,
      customer_unread_count: 0,
    },
  });
  
  await addChatMessage(sessionId, 'system', undefined, undefined, 'การสนทนาสิ้นสุดลง');
  
  return toChat(data);
}

/**
 * Rate a chat session
 */
export async function rateChatSession(
  sessionId: string, 
  rating: number, 
  comment?: string
): Promise<ChatSession> {
  const data = await prisma.supportChat.update({
    where: { id: sessionId },
    data: {
      rating: Math.min(5, Math.max(1, rating)),
      rating_comment: comment?.substring(0, 500),
    },
  });
  return toChat(data);
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
  
  const data = await prisma.supportMessage.create({
    data: {
      id: msgId,
      session_id: sessionId,
      sender,
      sender_email: senderEmail,
      sender_name: senderName,
      sender_avatar: senderAvatar,
      message: message || '',
      is_read: sender === 'system',
    },
  });
  
  // Update session's last message and unread count
  const updateData: any = {
    last_message_at: now,
    last_message_preview: (message || '').substring(0, 100),
  };
  
  if (sender === 'customer') {
    updateData.unread_count = { increment: 1 };
  } else if (sender === 'admin') {
    updateData.customer_unread_count = { increment: 1 };
  }
  
  await prisma.supportChat.update({
    where: { id: sessionId },
    data: updateData,
  });
  
  return toMsg(data);
}

/**
 * Get messages for a chat session
 */
export async function getChatMessages(
  sessionId: string, 
  limit = 100,
  afterTimestamp?: string
): Promise<ChatMessage[]> {
  const where: any = { session_id: sessionId };
  if (afterTimestamp) {
    where.created_at = { gt: new Date(afterTimestamp) };
  }
  
  const data = await prisma.supportMessage.findMany({
    where,
    orderBy: { created_at: 'asc' },
    take: limit,
  });
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
  
  await prisma.supportMessage.updateMany({
    where: {
      session_id: sessionId,
      sender: senderToMark,
      is_read: false,
    },
    data: {
      is_read: true,
      read_at: new Date(),
    },
  });
  
  const updateField = reader === 'customer' ? 'customer_unread_count' : 'unread_count';
  await prisma.supportChat.update({
    where: { id: sessionId },
    data: { [updateField]: 0 },
  });
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
  
  const [pendingCount, activeCount, todayCount, ratingData] = await Promise.all([
    prisma.supportChat.count({ where: { status: 'pending' } }),
    prisma.supportChat.count({ where: { status: 'active' } }),
    prisma.supportChat.count({ where: { created_at: { gte: today } } }),
    prisma.supportChat.aggregate({
      _avg: { rating: true },
      where: { rating: { not: null } },
    }),
  ]);
  
  return {
    pendingCount,
    activeCount,
    todayCount,
    avgRating: Math.round((ratingData._avg.rating || 0) * 10) / 10,
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
  const message = await prisma.supportMessage.findFirst({
    where: { id: messageId, session_id: sessionId },
  });
  
  if (!message) {
    return { success: false, error: 'ไม่พบข้อความที่ต้องการยกเลิก' };
  }
  
  if (message.sender !== 'customer' || message.sender_email !== userEmail) {
    return { success: false, error: 'คุณสามารถยกเลิกได้เฉพาะข้อความของตัวเองเท่านั้น' };
  }
  
  await prisma.supportMessage.delete({ where: { id: messageId } });
  
  // Update last message preview
  const lastMessage = await prisma.supportMessage.findFirst({
    where: { session_id: sessionId },
    orderBy: { created_at: 'desc' },
    select: { message: true, created_at: true },
  });
  
  await prisma.supportChat.update({
    where: { id: sessionId },
    data: {
      last_message_preview: lastMessage?.message?.substring(0, 100) || null,
      last_message_at: lastMessage?.created_at || null,
    },
  });
  
  return { success: true };
}

/**
 * Cleanup old chat images (delete images from closed chats older than 7 days)
 */
export async function cleanupOldChatImages(daysOld = 7): Promise<{ deletedImages: number; cleanedChats: number }> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  const oldChats = await prisma.supportChat.findMany({
    where: {
      status: 'closed',
      closed_at: { lt: cutoffDate },
    },
    select: { id: true },
  });
  
  if (oldChats.length === 0) {
    return { deletedImages: 0, cleanedChats: 0 };
  }
  
  const chatIds = oldChats.map(c => c.id);
  
  const messagesWithImages = await prisma.supportMessage.findMany({
    where: {
      session_id: { in: chatIds },
      message: { contains: '[รูปภาพ:' },
    },
    select: { id: true, message: true },
  });
  
  let deletedImages = 0;
  
  for (const msg of messagesWithImages) {
    const imageMatch = msg.message.match(/\[รูปภาพ: ([^\]]+)\]/);
    if (imageMatch) {
      const newMessage = msg.message.replace(
        /\[รูปภาพ: [^\]]+\]/g, 
        '[รูปภาพถูกลบเนื่องจากผ่านไป 7 วัน]'
      );
      
      await prisma.supportMessage.update({
        where: { id: msg.id },
        data: { message: newMessage },
      });
      
      deletedImages++;
    }
  }
  
  return { deletedImages, cleanedChats: chatIds.length };
}
