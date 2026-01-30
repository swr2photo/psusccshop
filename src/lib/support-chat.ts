// src/lib/support-chat.ts
// Support Chat System - Types and Supabase helpers

import { getSupabaseAdmin } from './supabase';

// Helper function to get admin client with null check
function getDb() {
  const db = getSupabaseAdmin();
  if (!db) {
    throw new Error('Supabase admin client not available. Check SUPABASE_SERVICE_ROLE_KEY configuration.');
  }
  return db;
}

// ==================== TYPES ====================

export type ChatStatus = 'pending' | 'active' | 'closed';
export type MessageSender = 'customer' | 'admin' | 'system';

export interface ChatSession {
  id: string;
  customer_email: string;
  customer_name: string;
  customer_avatar?: string;  // Customer profile picture
  status: ChatStatus;
  admin_email?: string;
  admin_name?: string;
  subject?: string;
  rating?: number;  // 1-5 stars
  rating_comment?: string;
  created_at: string;
  updated_at: string;
  closed_at?: string;
  last_message_at?: string;
  last_message_preview?: string;
  unread_count: number;  // Unread by admin
  customer_unread_count: number;  // Unread by customer
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
  read_at?: string;  // Timestamp when message was read
  is_unsent?: boolean;  // IG-style unsent message
}

export interface ChatSessionWithMessages extends ChatSession {
  messages: ChatMessage[];
}

// ==================== SUPABASE HELPERS ====================

/**
 * Create a new chat session
 */
export async function createChatSession(
  customerEmail: string,
  customerName: string,
  subject?: string,
  initialMessage?: string,
  customerAvatar?: string
): Promise<ChatSession> {
  const db = getDb();
  
  // Generate a unique session ID
  const sessionId = `chat_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  
  const newSession: Partial<ChatSession> = {
    id: sessionId,
    customer_email: customerEmail,
    customer_name: customerName,
    customer_avatar: customerAvatar,
    status: 'pending',
    subject: subject || 'สอบถามข้อมูล',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    unread_count: initialMessage ? 1 : 0,
    customer_unread_count: 0,
    last_message_preview: initialMessage?.substring(0, 100),
    last_message_at: initialMessage ? new Date().toISOString() : undefined,
  };
  
  const { data, error } = await db
    .from('support_chats')
    .insert(newSession)
    .select()
    .single();
  
  if (error) throw error;
  
  // Add initial message if provided
  if (initialMessage) {
    await addChatMessage(sessionId, 'customer', customerEmail, customerName, initialMessage, customerAvatar);
  }
  
  return data as ChatSession;
}

/**
 * Get a chat session by ID
 */
export async function getChatSession(sessionId: string): Promise<ChatSession | null> {
  const db = getDb();
  
  const { data, error } = await db
    .from('support_chats')
    .select('*')
    .eq('id', sessionId)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data as ChatSession | null;
}

/**
 * Get chat session with messages
 */
export async function getChatSessionWithMessages(sessionId: string): Promise<ChatSessionWithMessages | null> {
  const db = getDb();
  
  // Get session
  const { data: session, error: sessionError } = await db
    .from('support_chats')
    .select('*')
    .eq('id', sessionId)
    .single();
  
  if (sessionError && sessionError.code !== 'PGRST116') throw sessionError;
  if (!session) return null;
  
  // Get messages
  const { data: messages, error: msgError } = await db
    .from('support_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });
  
  if (msgError) throw msgError;
  
  return {
    ...session,
    messages: messages || [],
  } as ChatSessionWithMessages;
}

/**
 * Get all pending chat sessions (for admin)
 */
export async function getPendingChats(): Promise<ChatSession[]> {
  const db = getDb();
  
  const { data, error } = await db
    .from('support_chats')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  
  if (error) throw error;
  return data as ChatSession[];
}

/**
 * Get all active chat sessions (for admin)
 */
export async function getActiveChats(adminEmail?: string): Promise<ChatSession[]> {
  const db = getDb();
  
  let query = db
    .from('support_chats')
    .select('*')
    .eq('status', 'active')
    .order('last_message_at', { ascending: false });
  
  if (adminEmail) {
    query = query.eq('admin_email', adminEmail);
  }
  
  const { data, error } = await query;
  
  if (error) throw error;
  return data as ChatSession[];
}

/**
 * Get all chats (for admin panel)
 */
export async function getAllChats(status?: ChatStatus, limit = 50): Promise<ChatSession[]> {
  const db = getDb();
  
  let query = db
    .from('support_chats')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(limit);
  
  if (status) {
    query = query.eq('status', status);
  }
  
  const { data, error } = await query;
  
  if (error) throw error;
  return data as ChatSession[];
}

/**
 * Get customer's chat sessions
 */
export async function getCustomerChats(customerEmail: string): Promise<ChatSession[]> {
  const db = getDb();
  
  const { data, error } = await db
    .from('support_chats')
    .select('*')
    .eq('customer_email', customerEmail)
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (error) throw error;
  return data as ChatSession[];
}

/**
 * Get customer's active chat session (if any)
 */
export async function getCustomerActiveChat(customerEmail: string): Promise<ChatSession | null> {
  const db = getDb();
  
  const { data, error } = await db
    .from('support_chats')
    .select('*')
    .eq('customer_email', customerEmail)
    .in('status', ['pending', 'active'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  if (error) throw error;
  return data as ChatSession | null;
}

/**
 * Admin accepts a chat session
 */
export async function acceptChatSession(
  sessionId: string, 
  adminEmail: string, 
  adminName: string
): Promise<ChatSession> {
  const db = getDb();
  
  const { data, error } = await db
    .from('support_chats')
    .update({
      status: 'active',
      admin_email: adminEmail,
      admin_name: adminName,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
    .eq('status', 'pending')  // Only accept pending chats
    .select()
    .single();
  
  if (error) throw error;
  
  // Add system message
  await addChatMessage(
    sessionId, 
    'system', 
    undefined, 
    undefined, 
    `${adminName} เข้ารับการสนทนา`
  );
  
  return data as ChatSession;
}

/**
 * Close a chat session
 */
export async function closeChatSession(sessionId: string): Promise<ChatSession> {
  const db = getDb();
  
  const { data, error } = await db
    .from('support_chats')
    .update({
      status: 'closed',
      closed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      // Reset unread counts when closing chat
      unread_count: 0,
      customer_unread_count: 0,
    })
    .eq('id', sessionId)
    .select()
    .single();
  
  if (error) throw error;
  
  // Add system message
  await addChatMessage(
    sessionId, 
    'system', 
    undefined, 
    undefined, 
    'การสนทนาสิ้นสุดลง'
  );
  
  return data as ChatSession;
}

/**
 * Rate a chat session
 */
export async function rateChatSession(
  sessionId: string, 
  rating: number, 
  comment?: string
): Promise<ChatSession> {
  const db = getDb();
  
  const { data, error } = await db
    .from('support_chats')
    .update({
      rating: Math.min(5, Math.max(1, rating)),  // Clamp 1-5
      rating_comment: comment?.substring(0, 500),
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
    .select()
    .single();
  
  if (error) throw error;
  return data as ChatSession;
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
  const db = getDb();
  
  const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const now = new Date().toISOString();
  
  const newMessage: Partial<ChatMessage> = {
    id: msgId,
    session_id: sessionId,
    sender,
    sender_email: senderEmail,
    sender_name: senderName,
    sender_avatar: senderAvatar,
    message: message || '',
    created_at: now,
    is_read: sender === 'system',  // System messages are always "read"
  };
  
  const { data, error } = await db
    .from('support_messages')
    .insert(newMessage)
    .select()
    .single();
  
  if (error) throw error;
  
  // Update session's last message and unread count
  const updateData: Record<string, unknown> = {
    last_message_at: now,
    last_message_preview: (message || '').substring(0, 100),
    updated_at: now,
  };
  
  // Increment unread count for the other party
  if (sender === 'customer') {
    // Customer sent message, increment admin unread
    const { data: session } = await db
      .from('support_chats')
      .select('unread_count')
      .eq('id', sessionId)
      .single();
    
    updateData.unread_count = (session?.unread_count || 0) + 1;
  } else if (sender === 'admin') {
    // Admin sent message, increment customer unread
    const { data: session } = await db
      .from('support_chats')
      .select('customer_unread_count')
      .eq('id', sessionId)
      .single();
    
    updateData.customer_unread_count = (session?.customer_unread_count || 0) + 1;
  }
  
  await db
    .from('support_chats')
    .update(updateData)
    .eq('id', sessionId);
  
  return data as ChatMessage;
}

/**
 * Get messages for a chat session
 */
export async function getChatMessages(
  sessionId: string, 
  limit = 100,
  afterTimestamp?: string
): Promise<ChatMessage[]> {
  const db = getDb();
  
  let query = db
    .from('support_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .limit(limit);
  
  if (afterTimestamp) {
    query = query.gt('created_at', afterTimestamp);
  }
  
  const { data, error } = await query;
  
  if (error) throw error;
  return data as ChatMessage[];
}

/**
 * Mark messages as read
 */
export async function markMessagesAsRead(
  sessionId: string, 
  reader: 'customer' | 'admin'
): Promise<void> {
  const db = getDb();
  
  // Mark messages as read with timestamp
  const senderToMark = reader === 'customer' ? 'admin' : 'customer';
  
  await db
    .from('support_messages')
    .update({ 
      is_read: true,
      read_at: new Date().toISOString()
    })
    .eq('session_id', sessionId)
    .eq('sender', senderToMark)
    .eq('is_read', false);
  
  // Reset unread count
  const updateField = reader === 'customer' ? 'customer_unread_count' : 'unread_count';
  
  await db
    .from('support_chats')
    .update({ [updateField]: 0 })
    .eq('id', sessionId);
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
  const db = getDb();
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Get pending count
  const { count: pendingCount } = await db
    .from('support_chats')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');
  
  // Get active count
  const { count: activeCount } = await db
    .from('support_chats')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active');
  
  // Get today's chat count
  const { count: todayCount } = await db
    .from('support_chats')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', today.toISOString());
  
  // Get average rating
  const { data: ratingData } = await db
    .from('support_chats')
    .select('rating')
    .not('rating', 'is', null);
  
  const ratings = (ratingData || []).map(r => r.rating).filter(r => r != null);
  const avgRating = ratings.length > 0 
    ? ratings.reduce((a, b) => a + b, 0) / ratings.length 
    : 0;
  
  return {
    pendingCount: pendingCount || 0,
    activeCount: activeCount || 0,
    todayCount: todayCount || 0,
    avgRating: Math.round(avgRating * 10) / 10,
  };
}

/**
 * Unsend/Delete a message (IG-style)
 * Only the message owner can unsend their own messages
 */
export async function unsendChatMessage(
  sessionId: string,
  messageId: string,
  userEmail: string
): Promise<{ success: boolean; error?: string }> {
  const db = getDb();
  
  // Get the message to verify ownership
  const { data: message, error: msgError } = await db
    .from('support_messages')
    .select('*')
    .eq('id', messageId)
    .eq('session_id', sessionId)
    .single();
  
  if (msgError || !message) {
    return { success: false, error: 'ไม่พบข้อความที่ต้องการยกเลิก' };
  }
  
  // Only allow customer to unsend their own messages
  if (message.sender !== 'customer' || message.sender_email !== userEmail) {
    return { success: false, error: 'คุณสามารถยกเลิกได้เฉพาะข้อความของตัวเองเท่านั้น' };
  }
  
  // Completely delete the message (hard delete)
  const { error: deleteError } = await db
    .from('support_messages')
    .delete()
    .eq('id', messageId);
  
  if (deleteError) {
    console.error('[unsendChatMessage] Error:', deleteError);
    return { success: false, error: 'ไม่สามารถยกเลิกข้อความได้' };
  }
  
  // Get the last remaining message to update preview
  const { data: lastMessage } = await db
    .from('support_messages')
    .select('message, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  // Update session with new last message preview
  await db
    .from('support_chats')
    .update({ 
      last_message_preview: lastMessage?.message?.substring(0, 100) || null,
      last_message_at: lastMessage?.created_at || null
    })
    .eq('id', sessionId);
  
  return { success: true };
}

/**
 * Cleanup old chat images (delete images from closed chats older than 7 days)
 */
export async function cleanupOldChatImages(daysOld = 7): Promise<{ deletedImages: number; cleanedChats: number }> {
  const db = getDb();
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  // Find closed chats older than cutoff date
  const { data: oldChats, error } = await db
    .from('support_chats')
    .select('id')
    .eq('status', 'closed')
    .lt('closed_at', cutoffDate.toISOString());
  
  if (error) throw error;
  if (!oldChats || oldChats.length === 0) {
    return { deletedImages: 0, cleanedChats: 0 };
  }
  
  const chatIds = oldChats.map(c => c.id);
  
  // Find messages with images in these chats
  const { data: messagesWithImages, error: msgError } = await db
    .from('support_messages')
    .select('id, message')
    .in('session_id', chatIds)
    .like('message', '%[รูปภาพ:%');
  
  if (msgError) throw msgError;
  
  let deletedImages = 0;
  
  // Extract image URLs and update messages
  for (const msg of (messagesWithImages || [])) {
    const imageMatch = msg.message.match(/\[รูปภาพ: ([^\]]+)\]/);
    if (imageMatch) {
      // Replace image URL with placeholder text
      const newMessage = msg.message.replace(
        /\[รูปภาพ: [^\]]+\]/g, 
        '[รูปภาพถูกลบเนื่องจากผ่านไป 7 วัน]'
      );
      
      await db
        .from('support_messages')
        .update({ message: newMessage })
        .eq('id', msg.id);
      
      deletedImages++;
    }
  }
  
  return { deletedImages, cleanedChats: chatIds.length };
}
