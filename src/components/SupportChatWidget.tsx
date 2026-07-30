'use client';

import { apiFetch, uploadImageApi, uploadAudioApi } from '@/lib/api-client';
// src/components/SupportChatWidget.tsx
// Customer Support Chat Widget - Floating chat button with chatbot option


import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import {
  Box,
  IconButton,
  Typography,
  TextField,
  Badge,
  Avatar,
  Paper,
  Fade,
  Zoom,
  CircularProgress,
  Rating,
  Button,
  Chip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import { Headphones as SupportAgentIcon, X as CloseIcon, Send as SendIcon, Clock as TimeIcon, CheckCircle2 as CheckCircleIcon, Star as StarIcon, Bot as ChatbotIcon, Check as DoneIcon, CheckCheck as DoneAllIcon, MessageCircle as ChatIcon, History as HistoryIcon, ArrowLeft as ArrowBackIcon, Plus as AddIcon, MoreVertical as MoreVertIcon, Trash2 as DeleteIcon, Reply as ReplyIcon, Receipt as ReceiptIcon, ShoppingBag as ShoppingBagIcon, Bell as BellIcon, BellOff as BellOffIcon } from 'lucide-react';
import { useNotification } from './NotificationContext';
import { usePushNotification } from '@/hooks/usePushNotification';
import { useRealtimeChat } from '@/hooks/useRealtimeChat';
import { useTranslation } from '@/hooks/useTranslation';
import { chatMessagesChanged, getDbTypingFromSession } from '@/lib/support-chat-typing';
import { fetchChatSync, mergeChatMessages, mergeNewestWindow, fetchOlderChatMessages, getChatPollIntervalMs } from '@/lib/support-chat-sync';
import { formatStickerMessage } from '@/lib/chat-stickers';
import { formatVoiceMessage, VOICE_DATA_URL_FALLBACK_MAX } from '@/lib/chat-voice';
import { parseChatMessage } from '@/lib/chat-message';
import { cn } from '@/lib/utils';
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
} from '@/components/ui/message';
import { Bubble, BubbleContent } from '@/components/ui/bubble';
import { ChatImage } from '@/components/ui/chat-image';
import { ChatComposer } from '@/components/ui/chat-composer';
import { ChatSystemMarker } from '@/components/ui/chat-system-marker';
import { VoiceMessage } from '@/components/ui/voice-message';
import {
  MessageScrollerProvider,
  MessageScroller,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerButton,
  MessageScrollerApiBridge,
  MessageScrollerLoadOlder,
  useMessageScroller,
} from '@/components/ui/message-scroller';
import { Skeleton } from '@/components/ui/skeleton';

// ชื่อแอดมินเริ่มต้น (ดึงจากตั้งค่าแชท)
const DEFAULT_ADMIN_NAME = 'ทีมงาน PSU SCC';

interface SupportChatWidgetProps {
  onOpenChatbot?: () => void;
  hideMobileFab?: boolean;
  externalOpen?: boolean;
  onExternalOpenHandled?: () => void;
  shopId?: string;
  shopName?: string;
}

interface ChatSession {
  id: string;
  customer_email: string;
  customer_name: string;
  status: 'pending' | 'active' | 'closed';
  admin_email?: string;
  admin_name?: string;
  subject?: string;
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

interface ChatMessage {
  id: string;
  session_id: string;
  sender: 'customer' | 'admin' | 'system';
  sender_email?: string;
  sender_name?: string;
  sender_avatar?: string;
  message: string;
  image_url?: string;
  created_at: string;
  is_read: boolean;
  read_at?: string;
  is_unsent?: boolean;
}

interface ChatWithMessages extends ChatSession {
  messages: ChatMessage[];
}

export default function SupportChatWidget({ onOpenChatbot, hideMobileFab, externalOpen, onExternalOpenHandled, shopId, shopName }: SupportChatWidgetProps) {
  const { data: session, status: authStatus } = useSession();
  const isLoggedIn = !!session?.user?.email;
  const { t, lang } = useTranslation();
  const { warning: toastWarning, error: toastError } = useNotification();
  const { permission: pushPermission, isSupported: pushSupported, isSubscribed: pushSubscribed, loading: pushLoading, subscribe: pushSubscribe, unsubscribe: pushUnsubscribe } = usePushNotification();
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [chat, setChat] = useState<ChatWithMessages | null>(null);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatSession[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [message, setMessage] = useState('');
  const [subject, setSubject] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [ratingComment, setRatingComment] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadLabel, setUploadLabel] = useState('กำลังอัปโหลดรูปภาพ...');
  const [uploadFileCount, setUploadFileCount] = useState(1);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [messageMenuAnchor, setMessageMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [unsending, setUnsending] = useState(false);
  const [replyToMessage, setReplyToMessage] = useState<{ id: string; text: string; sender: string } | null>(null);
  const [orderHistory, setOrderHistory] = useState<any[]>([]);
  const [showOrderPicker, setShowOrderPicker] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [pushBannerDismissed, setPushBannerDismissed] = useState(false);
  const [adminDisplayName, setAdminDisplayName] = useState(DEFAULT_ADMIN_NAME);
  const [fallbackTyping, setFallbackTyping] = useState(false);
  const chatEtagRef = useRef<string | null>(null);
  const lastMessageAtRef = useRef<string | null>(null);
  const loadingOlderRef = useRef(false);
  const hasMoreOlderRef = useRef(false);
  const chatRef = useRef<ChatWithMessages | null>(null);
  chatRef.current = chat;
  hasMoreOlderRef.current = hasMoreOlder;
  const displayAdminName = adminDisplayName === DEFAULT_ADMIN_NAME ? t.supportChat.adminName : adminDisplayName;
  
  // === Supabase Realtime: live messages, typing, read receipts ===
  const {
    messages: realtimeMessages,
    setMessages: setRealtimeMessages,
    session: realtimeSession,
    setSession: setRealtimeSession,
    connectionState,
    isOtherTyping: rtAdminTyping,
    typingDisplay,
    sendTyping: rtSendTyping,
    addOptimisticMessage,
    resolveOptimistic,
    broadcastRead,
    removeMessage: rtRemoveMessage,
  } = useRealtimeChat(
    chat?.id || null,
    session?.user?.email || null,
    'customer'
  );

  const dbAdminTyping = React.useMemo(() => {
    const source = (realtimeSession || chat) as Record<string, unknown> | null;
    return getDbTypingFromSession(source).adminTyping;
  }, [realtimeSession, chat]);

  // Merge typing from realtime broadcast + API poll + DB session fields
  const adminTyping = rtAdminTyping || fallbackTyping || dbAdminTyping;

  // Sync realtime messages into chat state
  useEffect(() => {
    if (realtimeMessages.length > 0 && chat) {
      setChat(prev => prev ? { ...prev, messages: realtimeMessages as ChatMessage[] } : prev);
    }
  }, [realtimeMessages]);

  // Sync realtime session updates (status changes, admin accepts, etc.)
  useEffect(() => {
    if (realtimeSession && chat) {
      setChat(prev => {
        if (!prev) return prev;
        return { ...prev, ...realtimeSession, messages: prev.messages };
      });
      // Show rating dialog if chat just closed
      if (realtimeSession.status === 'closed' && !realtimeSession.rating) {
        setShowRating(true);
      }
    }
  }, [realtimeSession]);

  // Seed realtime messages on initial chat load
  useEffect(() => {
    if (chat?.messages && chat.messages.length > 0 && realtimeMessages.length === 0) {
      setRealtimeMessages(chat.messages as any);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat?.id]);
  
  // Detect touch device for mobile-friendly Enter key behavior
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  useEffect(() => {
    setIsTouchDevice(
      'ontouchstart' in window || navigator.maxTouchPoints > 0
    );
  }, []);
  
  const scrollApiRef = useRef<ReturnType<typeof useMessageScroller> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);
  const lastMessageCountRef = useRef(0);
  const lastScrolledMessageIdRef = useRef<string | null>(null);

  // Fetch admin display name from chat settings
  useEffect(() => {
    apiFetch('/api/support-chat/settings/public')
      .then(res => res.json())
      .then(data => {
        if (data.admin_display_name) setAdminDisplayName(data.admin_display_name);
      })
      .catch(() => {});
  }, []);

  // Show browser Notification when tab is blurred and new admin message arrives
  useEffect(() => {
    if (!chat?.messages) return;
    
    const adminMessages = chat.messages.filter(m => m.sender === 'admin');
    const currentCount = adminMessages.length;
    
    // Only notify for genuinely new messages (not on initial load)
    if (lastMessageCountRef.current > 0 && currentCount > lastMessageCountRef.current) {
      const latestMsg = adminMessages[adminMessages.length - 1];
      
      // If tab is not focused or chat is not open, show browser notification
      if (document.hidden || !open) {
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          try {
            const notif = new Notification(`SCC Shop - ${t.supportChat.newMessage}`, {
              body: latestMsg.message.substring(0, 100),
              icon: '/favicon.png',
              tag: `chat-${chat.id}`,
            });
            notif.onclick = () => {
              window.focus();
              setOpen(true);
              notif.close();
            };
          } catch {
            // Notification may fail in some contexts
          }
        }
      }
    }
    
    lastMessageCountRef.current = currentCount;
  }, [chat?.messages, chat?.id, open]);

  // Scroll only the chat message pane (never the page behind the widget)
  const scrollToBottom = useCallback((force = false) => {
    if (!force) return;
    scrollApiRef.current?.scrollToEnd({ behavior: 'smooth' });
  }, []);

  // Fetch active chat (single request: metadata + recent messages)
  const fetchActiveChat = useCallback(async (markRead = false) => {
    if (!session?.user?.email) return;

    const activeUrl =
      `/api/support-chat?withMessages=1${markRead ? '&markRead=true' : ''}`;

    const applyActivePayload = (data: { chat?: ChatWithMessages | null; hasMore?: boolean }) => {
      if (data.chat) {
        setChat(data.chat);
        if (data.chat.messages) {
          setRealtimeMessages(data.chat.messages);
        }
        setHasMoreOlder(Boolean(data.hasMore));
        setUnreadCount(data.chat.customer_unread_count || 0);
        setShowHistory(false);
        setShowNewChat(false);
        if (data.chat.status === 'closed' && !data.chat.rating) {
          setShowRating(true);
        } else {
          setShowRating(false);
        }
      } else {
        setChat(null);
        setHasMoreOlder(false);
        setShowNewChat(true);
      }
    };
    
    try {
      const res = await apiFetch(activeUrl, { credentials: 'same-origin', cache: 'no-store' });
      if (res.status === 401) {
        // Session cookie not readable yet / proxied auth miss — quiet retry after sync
        try {
          await fetch('/api/auth/sync-cookie', { method: 'POST', credentials: 'include', cache: 'no-store' });
          const retry = await apiFetch(activeUrl, { credentials: 'same-origin', cache: 'no-store' });
          if (!retry.ok) return;
          applyActivePayload(await retry.json());
        } catch {
          /* ignore */
        }
        return;
      }
      if (!res.ok) return;
      applyActivePayload(await res.json());
    } catch (error) {
      console.error('Error fetching chat:', error);
    }
  }, [session?.user?.email, setRealtimeMessages]);

  // Fetch chat history (all closed chats)
  const fetchChatHistory = useCallback(async () => {
    if (!session?.user?.email) return;
    
    try {
      const res = await apiFetch('/api/support-chat?action=history');
      const data = await res.json();
      if (data.chats) {
        setChatHistory(data.chats.filter((c: ChatSession) => c.status === 'closed'));
      }
    } catch (error) {
      console.error('Error fetching chat history:', error);
    }
  }, [session?.user?.email]);

  // View a specific chat from history
  const viewChatHistory = useCallback(async (chatId: string) => {
    try {
      const res = await apiFetch(`/api/support-chat/${chatId}?limit=30`);
      const data = await res.json();
      if (data.chat) {
        setChat(data.chat);
        if (data.chat.messages) {
          setRealtimeMessages(data.chat.messages);
        }
        setHasMoreOlder(Boolean(data.hasMore));
        setShowHistory(false);
        setShowNewChat(false);
      }
    } catch (error) {
      console.error('Error viewing chat:', error);
    }
  }, [setRealtimeMessages]);

  const loadOlderMessages = useCallback(async () => {
    const current = chatRef.current;
    if (!current?.id || loadingOlderRef.current || !hasMoreOlderRef.current) return;
    const oldest = current.messages?.[0];
    if (!oldest) return;

    loadingOlderRef.current = true;
    setLoadingOlder(true);
    try {
      const page = await fetchOlderChatMessages<ChatMessage>(current.id, {
        before: oldest.created_at,
        beforeId: oldest.id,
        limit: 30,
      });
      if (page.messages.length) {
        setChat((prev) => {
          if (!prev || prev.id !== current.id) return prev;
          const merged = mergeChatMessages(page.messages, prev.messages);
          setRealtimeMessages(merged);
          return { ...prev, messages: merged };
        });
      }
      setHasMoreOlder(page.hasMore);
    } catch (error) {
      console.error('Error loading older messages:', error);
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  }, [setRealtimeMessages]);

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Send typing indicator: Realtime broadcast when connected, API fallback otherwise
  const sendTypingIndicator = useCallback(() => {
    if (!chat || (chat.status !== 'active' && chat.status !== 'pending')) return;
    if (connectionState === 'connected') {
      rtSendTyping(true, session?.user?.name || undefined);
    } else {
      // Fallback: API call
      apiFetch(`/api/support-chat/${chat.id}/typing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isTyping: true }),
      }).catch(() => {});
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        apiFetch(`/api/support-chat/${chat.id}/typing`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isTyping: false }),
        }).catch(() => {});
      }, 3000);
    }
  }, [chat?.id, chat?.status, rtSendTyping, session?.user?.name, connectionState]);

  // Poll typing status (API/DB fallback — skip when Realtime broadcast is active)
  useEffect(() => {
    if (!open || !chat?.id || showHistory || showNewChat || showRating) return;
    if (chat.status !== 'active' && chat.status !== 'pending') return;
    if (connectionState === 'connected') return;

    const pollTyping = () => {
      if (document.visibilityState === 'hidden') return;
      apiFetch(`/api/support-chat/${chat.id}/typing`)
        .then((res) => res.json())
        .then((data) => setFallbackTyping(data.isTyping || false))
        .catch(() => setFallbackTyping(false));
    };
    pollTyping();
    const interval = setInterval(pollTyping, getChatPollIntervalMs(connectionState, 'typing'));
    return () => clearInterval(interval);
  }, [open, chat?.id, chat?.status, showHistory, showNewChat, showRating, connectionState]);

  // === Realtime replaces polling ===
  // Instead of polling every 5s, Supabase Realtime pushes changes instantly.
  // Mark messages as read when user is actively viewing chat
  useEffect(() => {
    if (open && chat?.id && !showHistory && !showNewChat && !showRating && chat.status === 'active') {
      // Mark read via API (one-time, not polling)
      apiFetch(`/api/support-chat/${chat.id}/read`, { method: 'POST' }).catch(() => {});
      // Broadcast read receipt via Realtime
      broadcastRead();
    }
  }, [open, chat?.id, showHistory, showNewChat, showRating, chat?.status, broadcastRead]);

  useEffect(() => {
    lastMessageAtRef.current = chat?.messages?.[chat.messages.length - 1]?.created_at ?? null;
  }, [chat?.messages]);

  // Message polling safety net — delta sync + ETag when Realtime may miss events
  useEffect(() => {
    if (!open || !chat?.id || showHistory || showNewChat || showRating) return;
    if (chat.status !== 'active' && chat.status !== 'pending') return;

    let cancelled = false;
    const chatId = chat.id;

    const refreshMessages = async () => {
      if (cancelled || document.visibilityState === 'hidden') return;
      try {
        const result = await fetchChatSync<ChatWithMessages>(chatId, {
          etag: chatEtagRef.current,
          since: lastMessageAtRef.current,
        });

        if (cancelled || result.kind === 'unchanged') return;
        chatEtagRef.current = result.etag;

        if (result.kind === 'delta') {
          setChat((prev) => {
            if (!prev || prev.id !== chatId) return prev;
            const merged = mergeChatMessages(prev.messages, result.chat.messages || []);
            const changed =
              chatMessagesChanged(prev.messages, merged) ||
              result.chat.status !== prev.status;
            if (!changed) return prev;
            setRealtimeMessages(merged);
            lastMessageAtRef.current = merged[merged.length - 1]?.created_at ?? lastMessageAtRef.current;
            return { ...prev, ...result.chat, messages: merged };
          });
          return;
        }

        const incoming = (result.chat.messages || []) as ChatMessage[];
        setChat((prev) => {
          if (!prev || prev.id !== chatId) return prev;
          const merged = mergeNewestWindow(prev.messages, incoming);
          const changed =
            chatMessagesChanged(prev.messages, merged) ||
            result.chat.status !== prev.status;
          if (!changed) return prev;
          setRealtimeMessages(merged);
          lastMessageAtRef.current = merged[merged.length - 1]?.created_at ?? null;
          return { ...prev, ...result.chat, messages: merged };
        });
        if (typeof result.hasMore === 'boolean' && !hasMoreOlderRef.current) {
          setHasMoreOlder(result.hasMore);
        }
      } catch {}
    };

    refreshMessages();
    const interval = setInterval(
      refreshMessages,
      getChatPollIntervalMs(connectionState, 'messages')
    );
    return () => { cancelled = true; clearInterval(interval); };
  }, [open, chat?.id, chat?.status, showHistory, showNewChat, showRating, setRealtimeMessages, connectionState]);

  // Refetch when user returns to the tab (delta/ETag — avoid full history reload)
  useEffect(() => {
    if (!open || !chat?.id || showHistory || showNewChat || showRating) return;

    const chatId = chat.id;
    const onVisible = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const result = await fetchChatSync<ChatWithMessages>(chatId, {
          etag: chatEtagRef.current,
          since: lastMessageAtRef.current,
        });
        if (result.kind === 'unchanged') return;
        chatEtagRef.current = result.etag;

        if (result.kind === 'delta') {
          setChat((prev) => {
            if (!prev || prev.id !== chatId) return prev;
            const merged = mergeChatMessages(prev.messages, result.chat.messages || []);
            setRealtimeMessages(merged);
            lastMessageAtRef.current = merged[merged.length - 1]?.created_at ?? lastMessageAtRef.current;
            return { ...prev, ...result.chat, messages: merged };
          });
          return;
        }

        const incoming = (result.chat.messages || []) as ChatMessage[];
        setChat((prev) => {
          if (!prev || prev.id !== chatId) return prev;
          const merged = mergeNewestWindow(prev.messages, incoming);
          setRealtimeMessages(merged);
          lastMessageAtRef.current = merged[merged.length - 1]?.created_at ?? null;
          return { ...prev, ...result.chat, messages: merged };
        });
        if (typeof result.hasMore === 'boolean' && !hasMoreOlderRef.current) {
          setHasMoreOlder(result.hasMore);
        }
      } catch {
        /* ignore */
      }
    };

    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [open, chat?.id, showHistory, showNewChat, showRating, setRealtimeMessages]);

  // Scroll when a new message arrives (by id/length — not every array identity change)
  const lastMessageId = chat?.messages?.length
    ? chat.messages[chat.messages.length - 1]?.id ?? null
    : null;
  useEffect(() => {
    if (!open) {
      lastScrolledMessageIdRef.current = null;
      return;
    }
    if (!lastMessageId) return;
    lastScrolledMessageIdRef.current = lastMessageId;
    // MessageScroller autoScroll follows when at the live edge; do not force jump
  }, [chat?.messages?.length, lastMessageId, open]);

  // Initial fetch when widget opens
  useEffect(() => {
    if (open && session?.user?.email) {
      setLoading(true);
      // Mark as read on first open
      fetchActiveChat(true).finally(() => setLoading(false));
    }
  }, [open, session?.user?.email, fetchActiveChat]);

  // Create new chat
  const handleCreateChat = async () => {
    if (!message.trim()) return;
    
    const messageText = message.trim();
    setSending(true);
    try {
      const res = await apiFetch('/api/support-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: subject.trim() || 'สอบถามข้อมูล',
          message: messageText,
          shopId: shopId || undefined,
          shopName: shopName || undefined,
        }),
      });
      
      const data = await res.json().catch(() => ({}));
      
      if (!res.ok || !data.chat) {
        toastError(data.error || t.supportChat.sendFailed);
        return;
      }

      // Existing active chat — initial message was not added by POST, send it now
      const isExistingChat = typeof data.message === 'string' && data.message.includes('กำลังดำเนินอยู่แล้ว');
      let activeChat = data.chat as ChatWithMessages;
      if (isExistingChat) {
        const msgRes = await apiFetch(`/api/support-chat/${data.chat.id}/message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: messageText }),
        });
        const msgData = await msgRes.json().catch(() => ({}));
        if (!msgRes.ok) {
          toastError(msgData.error || t.supportChat.sendFailed);
          return;
        }
        if (msgData.message) {
          const existingMsgs = activeChat.messages || [];
          activeChat = {
            ...activeChat,
            messages: mergeChatMessages(existingMsgs, [msgData.message]),
          };
        }
      }

      if (activeChat) {
        setChat(activeChat);
        if (activeChat.messages) {
          setRealtimeMessages(activeChat.messages);
        }
        setShowNewChat(false);
        setShowRating(false);
        setMessage('');
        setSubject('');
      } else {
        toastError(t.supportChat.sendFailed);
      }
    } catch (error) {
      console.error('Error creating chat:', error);
      toastError(t.supportChat.sendFailed);
    } finally {
      setSending(false);
    }
  };

  // Handle image upload
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file type
    if (!file.type.startsWith('image/')) {
      toastWarning(t.supportChat.imageOnly);
      return;
    }

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toastWarning(t.supportChat.maxFileSize);
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPreviewImage(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const beginUpload = (label: string, fileCount = 1) => {
    uploadAbortRef.current?.abort();
    const controller = new AbortController();
    uploadAbortRef.current = controller;
    setUploadingImage(true);
    setUploadProgress(0);
    setUploadLabel(label);
    setUploadFileCount(fileCount);
    return controller;
  };

  const endUpload = () => {
    uploadAbortRef.current = null;
    setUploadingImage(false);
    setUploadProgress(0);
  };

  const cancelUpload = useCallback(() => {
    uploadAbortRef.current?.abort();
    uploadAbortRef.current = null;
    setUploadingImage(false);
    setUploadProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleSendSticker = async (src: string) => {
    if (!chat || sending || uploadingImage) return;

    if (src.startsWith('/chat-stickers/')) {
      const msgContent = formatStickerMessage(src);
      const tempId = `temp_sticker_${Date.now()}`;
      addOptimisticMessage(tempId, msgContent, session?.user?.name || undefined, session?.user?.image || undefined);
      scrollToBottom(true);
      setSending(true);
      try {
        const res = await apiFetch(`/api/support-chat/${chat.id}/message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: msgContent }),
        });
        const data = await res.json();
        if (data.success && data.message) resolveOptimistic(tempId, data.message);
        else {
          resolveOptimistic(tempId, null);
          toastError(data?.error || t.supportChat.sendFailed);
        }
      } catch {
        resolveOptimistic(tempId, null);
        toastError(t.supportChat.sendFailed);
      } finally {
        setSending(false);
      }
      return;
    }

    if (src.startsWith('data:')) {
      const controller = beginUpload(
        lang === 'en' ? 'Uploading sticker...' : 'กำลังอัปโหลดสติกเกอร์...',
        1
      );
      try {
        const mimeMatch = src.match(/data:([^;]+);/);
        const mime = mimeMatch ? mimeMatch[1] : 'image/gif';
        const ext = mime.includes('webp') ? 'webp' : 'gif';
        const uploadRes = await uploadImageApi(
          {
            base64: src,
            filename: `sticker_${Date.now()}.${ext}`,
            mime,
          },
          { signal: controller.signal, onProgress: setUploadProgress }
        );
        if (!uploadRes.ok) throw new Error(t.supportChat.imageUploadFailed);
        const uploadData = await uploadRes.json();
        if (uploadData.status !== 'success' || !uploadData.data?.url) {
          throw new Error(t.supportChat.imageUploadFailed);
        }
        setUploadProgress(100);
        const msgContent = formatStickerMessage(uploadData.data.url);
        const tempId = `temp_sticker_${Date.now()}`;
        addOptimisticMessage(tempId, msgContent, session?.user?.name || undefined, session?.user?.image || undefined);
        scrollToBottom(true);
        const res = await apiFetch(`/api/support-chat/${chat.id}/message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: msgContent }),
        });
        const data = await res.json();
        if (data.success && data.message) resolveOptimistic(tempId, data.message);
        else {
          resolveOptimistic(tempId, null);
          toastError(data?.error || t.supportChat.sendFailed);
        }
      } catch (error: any) {
        if (error?.name !== 'AbortError') {
          toastError(error?.message || t.supportChat.imageUploadFailed);
        }
      } finally {
        endUpload();
      }
    }
  };

  const handleSendVoice = async (payload: { base64: string; mime: string; duration: number }) => {
    if (!chat || sending || uploadingImage) return;
    const controller = beginUpload(
      lang === 'en' ? 'Uploading voice...' : 'กำลังอัปโหลดเสียง...',
      1
    );
    try {
      let voiceUrl: string | null = null;
      let voiceDuration = Math.max(1, Math.round(payload.duration || 1));

      const uploadRes = await uploadAudioApi(
        {
          base64: payload.base64,
          mime: payload.mime,
          duration: voiceDuration,
        },
        { signal: controller.signal, onProgress: setUploadProgress }
      );
      const uploadData = await uploadRes.json().catch(() => null);
      if (uploadRes.ok && uploadData?.status === 'success' && uploadData?.data?.url) {
        voiceUrl = uploadData.data.url;
        if (uploadData.data.duration) voiceDuration = uploadData.data.duration;
      } else if (payload.base64.length <= VOICE_DATA_URL_FALLBACK_MAX) {
        voiceUrl = payload.base64;
      }

      if (!voiceUrl) {
        throw new Error(t.supportChat.sendFailed);
      }

      setUploadProgress(100);
      const msgContent = formatVoiceMessage(voiceUrl, voiceDuration);
      const tempId = `temp_voice_${Date.now()}`;
      addOptimisticMessage(tempId, msgContent, session?.user?.name || undefined, session?.user?.image || undefined);
      scrollToBottom(true);
      const res = await apiFetch(`/api/support-chat/${chat.id}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msgContent }),
      });
      const data = await res.json();
      if (data.success && data.message) resolveOptimistic(tempId, data.message);
      else {
        resolveOptimistic(tempId, null);
        toastError(data?.error || t.supportChat.sendFailed);
      }
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        toastError(error?.message || t.supportChat.sendFailed);
      }
    } finally {
      endUpload();
    }
  };

  // Upload image and send message
  const handleSendWithImage = async () => {
    if (!previewImage || !chat || uploadingImage) return;

    const caption = message.trim();
    const imageData = previewImage;
    const controller = beginUpload(
      lang === 'en' ? 'Uploading image...' : 'กำลังอัปโหลดรูปภาพ...',
      1
    );
    setPreviewImage(null);
    setMessage('');

    try {
      const mimeMatch = imageData.match(/data:([^;]+);/);
      const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      const ext = mime.split('/')[1] || 'jpg';

      const uploadRes = await uploadImageApi(
        {
          base64: imageData,
          filename: `chat_${Date.now()}.${ext}`,
          mime: mime,
        },
        { signal: controller.signal, onProgress: setUploadProgress }
      );

      if (!uploadRes.ok) {
        throw new Error(`${t.supportChat.imageUploadFailed} (HTTP ${uploadRes.status})`);
      }
      let uploadData;
      try {
        uploadData = await uploadRes.json();
      } catch {
        throw new Error(t.supportChat.sendFailed);
      }

      if (uploadData.status === 'success' && uploadData.data?.url) {
        setUploadProgress(100);
        const imageUrl = uploadData.data.url;
        const msgContent = caption ? `${caption}\n[รูปภาพ: ${imageUrl}]` : `[รูปภาพ: ${imageUrl}]`;

        const tempId = `temp_img_${Date.now()}`;
        addOptimisticMessage(tempId, msgContent, session?.user?.name || undefined, session?.user?.image || undefined);
        scrollToBottom(true);

        const res = await apiFetch(`/api/support-chat/${chat.id}/message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: msgContent }),
        });

        const data = await res.json();
        if (data.success && data.message) {
          resolveOptimistic(tempId, data.message);
        } else {
          resolveOptimistic(tempId, null);
        }
      } else {
        throw new Error(uploadData.message || t.supportChat.imageUploadFailed);
      }
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        console.error('Error uploading image:', error);
        toastError(error?.message || t.supportChat.imageUploadFailed);
      }
    } finally {
      endUpload();
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Send message
  const handleSendMessage = async () => {
    // If there's a preview image, send with image
    if (previewImage) {
      await handleSendWithImage();
      return;
    }

    if (!message.trim() || !chat) return;
    
    setSending(true);
    let tempId: string | null = null;
    try {
      // Build message with reply prefix if replying
      let finalMessage = message.trim();
      if (replyToMessage) {
        const replyPreview = replyToMessage.text.length > 50 
          ? replyToMessage.text.substring(0, 50) + '...' 
          : replyToMessage.text;
        finalMessage = `[ตอบกลับ: "${replyPreview}"]\n${finalMessage}`;
      }
      
      // Optimistic UI: show message instantly
      tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      addOptimisticMessage(tempId, finalMessage, session?.user?.name || undefined, session?.user?.image || undefined);
      setMessage('');
      setReplyToMessage(null);
      scrollToBottom(true);
      
      // Stop typing indicator
      rtSendTyping(false);
      
      const res = await apiFetch(`/api/support-chat/${chat.id}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: finalMessage }),
      });
      
      const data = await res.json().catch(() => ({}));
      
      if (res.ok && data.success && data.message) {
        resolveOptimistic(tempId, data.message);
      } else {
        resolveOptimistic(tempId, null);
        toastError(data?.error || t.supportChat.sendFailed);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      if (tempId) resolveOptimistic(tempId, null);
      toastError(t.supportChat.sendFailed);
    } finally {
      setSending(false);
    }
  };

  // Handle reply to message
  const handleReplyToMessage = (msg: ChatMessage) => {
    const previewText = msg.message
      .replace(/\[เสียง: [^\]]+\]/g, '[ข้อความเสียง]')
      .replace(/\[สติกเกอร์: [^\]]+\]/g, `[${t.supportChat.image}]`)
      .replace(/\[รูปภาพ: [^\]]+\]/g, `[${t.supportChat.image}]`)
      .trim() || `[${t.supportChat.image}]`;
    setReplyToMessage({
      id: msg.id,
      text: previewText,
      sender: msg.sender,
    });
    setMessageMenuAnchor(null);
    setSelectedMessageId(null);
  };

  // Unsend/Delete message (IG-style) - completely removes message
  const handleUnsendMessage = async (messageId: string) => {
    if (!chat || unsending) return;
    
    setUnsending(true);
    try {
      const res = await apiFetch(`/api/support-chat/${chat.id}/message/${messageId}`, {
        method: 'DELETE',
      });
      
      const data = await res.json();
      
      if (data.success) {
        // Update local state - completely remove the message
        setChat(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            messages: prev.messages.filter(msg => msg.id !== messageId),
          };
        });
      }
    } catch (error) {
      console.error('Error unsending message:', error);
    } finally {
      setUnsending(false);
      setMessageMenuAnchor(null);
      setSelectedMessageId(null);
    }
  };

  // Open message context menu
  const handleMessageMenu = (event: React.MouseEvent<HTMLElement>, messageId: string) => {
    event.preventDefault();
    setSelectedMessageId(messageId);
    setMessageMenuAnchor(event.currentTarget);
  };

  // Close message context menu
  const handleCloseMessageMenu = () => {
    setMessageMenuAnchor(null);
    setSelectedMessageId(null);
  };

  // Check if message is last in its sender group (for IG-style time display)
  const isLastInGroup = (messages: ChatMessage[], index: number): boolean => {
    const currentMsg = messages[index];
    const nextMsg = messages[index + 1];
    
    // If no next message, it's the last
    if (!nextMsg) return true;
    
    // If next message is from different sender, current is last in group
    if (nextMsg.sender !== currentMsg.sender) return true;
    
    // If time gap > 2 minutes, show time
    const currentTime = new Date(currentMsg.created_at).getTime();
    const nextTime = new Date(nextMsg.created_at).getTime();
    if (nextTime - currentTime > 2 * 60 * 1000) return true;
    
    return false;
  };

  // Submit rating
  const handleSubmitRating = async () => {
    if (!rating || !chat) return;
    
    setSending(true);
    try {
      const res = await apiFetch(`/api/support-chat/${chat.id}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, comment: ratingComment.trim() }),
      });
      
      const data = await res.json();
      
      if (data.chat) {
        setChat(data.chat);
        setShowRating(false);
        // Clear chat after rating to allow new chat
        setTimeout(() => {
          setChat(null);
          setShowNewChat(true);
          setRating(null);
          setRatingComment('');
        }, 2000);
      }
    } catch (error) {
      console.error('Error submitting rating:', error);
    } finally {
      setSending(false);
    }
  };

  // Handle external open trigger (from navbar)
  useEffect(() => {
    if (externalOpen) {
      if (!isLoggedIn) {
        window.location.href = '/api/auth/signin?callbackUrl=' + encodeURIComponent(window.location.pathname);
        onExternalOpenHandled?.();
        return;
      }
      setOpen(true);
      setLoading(true);
      fetchActiveChat().finally(() => setLoading(false));
      onExternalOpenHandled?.();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalOpen]);

  // Footer / global open-support-chat hook (optional detail: prefill, orderRef)
  useEffect(() => {
    const onFooterOpen = (event: Event) => {
      const detail = (event as CustomEvent<{ prefill?: string; orderRef?: string }>).detail || {};
      const prefillText = String(detail.prefill || '').trim();
      if (!isLoggedIn) {
        window.location.href = '/api/auth/signin?callbackUrl=' + encodeURIComponent(window.location.pathname);
        return;
      }
      if (prefillText) {
        setMessage(prefillText);
        setShowHistory(false);
        setShowRating(false);
        if (detail.orderRef) {
          setSubject(lang === 'th' ? 'ปัญหาการสั่งซื้อ' : 'Order issue');
        }
      }
      setOpen(true);
      setLoading(true);
      fetchActiveChat().finally(() => setLoading(false));
    };
    window.addEventListener('psuscc:open-support-chat', onFooterOpen as EventListener);
    return () => window.removeEventListener('psuscc:open-support-chat', onFooterOpen as EventListener);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, lang]);

  // Deep link: open specific chat from push notification (?chat=<sessionId>)
  useEffect(() => {
    if (!session?.user?.email) return;
    const params = new URLSearchParams(window.location.search);
    const chatParam = params.get('chat');
    if (chatParam) {
      // Clean the URL without reloading
      const url = new URL(window.location.href);
      url.searchParams.delete('chat');
      window.history.replaceState({}, '', url.pathname + url.search + url.hash);
      // Open the specific chat
      setOpen(true);
      setLoading(true);
      viewChatHistory(chatParam).finally(() => setLoading(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.email]);

  // Handle opening with mode selection
  const handleOpenMenu = (event: React.MouseEvent<HTMLElement>) => {
    setMenuAnchor(event.currentTarget);
  };

  const handleSelectChatbot = () => {
    setMenuAnchor(null);
    // เรียก callback เพื่อเปิด ShirtChatBot
    if (onOpenChatbot) {
      onOpenChatbot();
    }
  };

  const handleSelectSupport = () => {
    setMenuAnchor(null);
    
    if (!isLoggedIn) {
      // Redirect to login
      window.location.href = '/api/auth/signin?callbackUrl=' + encodeURIComponent(window.location.pathname);
      return;
    }
    
    setOpen(true);
    setLoading(true);
    fetchActiveChat().finally(() => setLoading(false));
  };

  // Format time
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  };

  const parseMessage = parseChatMessage;

  // Get user avatar
  const getUserAvatar = () => session?.user?.image || null;

  // Fetch user's order history for attaching to chat
  const fetchOrderHistory = useCallback(async () => {
    if (!session?.user?.email) return;
    setLoadingOrders(true);
    try {
      const res = await apiFetch('/api/orders');
      const data = await res.json();
      if (data.status === 'success' && data.data) {
        // API returns { data: { history: [...], hasMore, total } }
        const orders = Array.isArray(data.data) ? data.data : (data.data.history || []);
        setOrderHistory(orders.slice(0, 20)); // Limit to 20 orders
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoadingOrders(false);
    }
  }, [session?.user?.email]);

  // Send order reference in chat
  const handleSendOrderRef = async (order: any) => {
    if (!chat || chat.status === 'closed') return;
    
    const orderMsg = `*${t.supportChat.orderRef} #${order.ref}*
${t.common.total}: ฿${order.totalAmount?.toLocaleString() || order.amount?.toLocaleString() || 0}
${new Date(order.date || order.createdAt).toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US')}
${getStatusLabel(order.status)}
[ORDER_REF:${order.ref}]`;
    
    setSending(true);
    try {
      const res = await apiFetch(`/api/support-chat/${chat.id}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: orderMsg }),
      });
      
      if (res.ok) {
        const chatRes = await apiFetch(`/api/support-chat/${chat.id}`);
        const chatData = await chatRes.json();
        if (chatData.chat) {
          setChat(chatData.chat);
        }
      }
    } catch (error) {
      console.error('Error sending order ref:', error);
    } finally {
      setSending(false);
      setShowOrderPicker(false);
    }
  };

  // Get status label
  const getStatusLabel = (status: string) => {
    return (t.status as any)[status?.toUpperCase()] || status;
  };

  // Show loading spinner while checking auth
  if (authStatus === 'loading') return null;

  const isLiveChat = Boolean(chat && (chat.status === 'pending' || chat.status === 'active'));
  const showNewChatForm = !isLiveChat && (!chat || showNewChat);

  return (
    <>
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleImageSelect}
      />

      {/* Floating Chat Button — Modern Animated */}
      <Zoom in={!open}>
        <Box
          sx={{
            position: 'fixed',
            bottom: { xs: 20, sm: 24 },
            right: { xs: 16, sm: 24 },
            zIndex: 1200,
            display: hideMobileFab ? 'none' : 'block',
            // Container for glow rings + button
            width: { xs: 58, sm: 64 },
            height: { xs: 58, sm: 64 },
          }}
        >
          {/* Outer aurora glow ring — slow spin */}
          <Box
            sx={{
              position: 'absolute',
              inset: { xs: -5, sm: -7 },
              borderRadius: '50%',
              background: 'conic-gradient(from 0deg, #6366f1, #8b5cf6, #a78bfa, #c084fc, #e879f9, #f472b6, #fb7185, #f97316, #fbbf24, #34d399, #22d3ee, #60a5fa, #6366f1)',
              opacity: unreadCount > 0 ? 0.85 : 0.35,
              animation: 'chatGlowSpin 8s linear infinite',
              filter: { xs: 'blur(6px)', sm: 'blur(10px)' },
              willChange: 'transform',
              '@keyframes chatGlowSpin': {
                '0%': { transform: 'rotate(0deg)' },
                '100%': { transform: 'rotate(360deg)' },
              },
            }}
          />
          {/* Inner accent ring — reverse spin, tighter */}
          <Box
            sx={{
              position: 'absolute',
              inset: { xs: -1, sm: -2 },
              borderRadius: '50%',
              background: 'conic-gradient(from 90deg, #818cf8 0%, #c084fc 25%, #f0abfc 50%, #818cf8 75%, #60a5fa 100%)',
              opacity: unreadCount > 0 ? 0.7 : 0.25,
              animation: 'chatGlowReverse 5s linear infinite',
              willChange: 'transform',
              '@keyframes chatGlowReverse': {
                '0%': { transform: 'rotate(360deg)' },
                '100%': { transform: 'rotate(0deg)' },
              },
            }}
          />
          {/* Pulse ring — expands outward when unread */}
          {unreadCount > 0 && (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                border: '2px solid rgba(139, 92, 246, 0.5)',
                animation: 'chatPulseRing 2s cubic-bezier(0, 0, 0.2, 1) infinite',
                '@keyframes chatPulseRing': {
                  '0%': { transform: 'scale(1)', opacity: 0.6 },
                  '100%': { transform: 'scale(1.6)', opacity: 0 },
                },
              }}
            />
          )}
          <Badge
            badgeContent={unreadCount}
            overlap="circular"
            sx={{
              width: '100%',
              height: '100%',
              '& .MuiBadge-badge': {
                right: { xs: 4, sm: 6 },
                top: { xs: 4, sm: 6 },
                fontWeight: 800,
                fontSize: '0.72rem',
                minWidth: 21,
                height: 21,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #ef4444 0%, #f97316 100%)',
                color: '#fff',
                border: '2px solid var(--background)',
                boxShadow: '0 2px 12px rgba(239,68,68,0.6)',
                animation: unreadCount > 0 ? 'chatBadgePop 1.8s ease-in-out infinite' : 'none',
                '@keyframes chatBadgePop': {
                  '0%, 100%': { transform: 'scale(1) translateY(0)' },
                  '30%': { transform: 'scale(1.25) translateY(-2px)' },
                  '60%': { transform: 'scale(0.95) translateY(0)' },
                },
              },
            }}
          >
            <IconButton
              onClick={handleOpenMenu}
              aria-label={t.supportChat.chatTitle}
              sx={{
                position: 'relative',
                width: '100%',
                height: '100%',
                background: 'linear-gradient(145deg, #7c3aed 0%, #6d28d9 40%, #5b21b6 100%)',
                color: 'white',
                boxShadow: '0 8px 30px rgba(109,40,217,0.5), 0 2px 8px rgba(0,0,0,0.2), inset 0 1px 1px rgba(255,255,255,0.2), inset 0 -1px 2px rgba(0,0,0,0.15)',
                overflow: 'hidden',
                borderRadius: '50%',
                // Sheen sweep
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: '-150%',
                  width: '80%',
                  height: '100%',
                  background: 'linear-gradient(105deg, transparent 20%, rgba(255,255,255,0.25) 50%, transparent 80%)',
                  animation: 'chatSheen 4s ease-in-out infinite',
                  pointerEvents: 'none',
                  '@keyframes chatSheen': {
                    '0%, 100%': { left: '-150%' },
                    '40%': { left: '150%' },
                    '41%': { left: '-150%' },
                  },
                },
                // Top highlight arc
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  top: 2,
                  left: '20%',
                  right: '20%',
                  height: '40%',
                  borderRadius: '50%',
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.2) 0%, transparent 100%)',
                  pointerEvents: 'none',
                },
                '&:hover': {
                  background: 'linear-gradient(145deg, #8b5cf6 0%, #7c3aed 40%, #6d28d9 100%)',
                  transform: 'scale(1.1)',
                  boxShadow: '0 12px 40px rgba(124,58,237,0.6), 0 4px 12px rgba(0,0,0,0.25), inset 0 1px 1px rgba(255,255,255,0.25)',
                },
                '&:active': {
                  transform: 'scale(0.92)',
                  boxShadow: '0 4px 16px rgba(109,40,217,0.4), inset 0 2px 4px rgba(0,0,0,0.2)',
                },
                transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}
            >
              <ChatIcon size={26} strokeWidth={2.3} />
            </IconButton>
          </Badge>
        </Box>
      </Zoom>

      {/* Mode Selection Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        PaperProps={{
          sx: {
            bgcolor: 'var(--surface)',
            color: 'var(--foreground)',
            borderRadius: 2,
            minWidth: 220,
            border: '1px solid var(--glass-border)',
            boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
          },
        }}
      >
        <MenuItem 
          onClick={handleSelectChatbot}
          sx={{ 
            py: 1.5, 
            '&:hover': { bgcolor: 'var(--surface-2)' },
          }}
        >
          <ListItemIcon>
            <ChatbotIcon size={24} color="#30d158" />
          </ListItemIcon>
          <ListItemText 
            primary={t.help.askChatbot} 
            secondary={t.help.chatbotDesc}
            secondaryTypographyProps={{ sx: { color: 'var(--text-muted)', fontSize: '0.75rem' } }}
          />
        </MenuItem>
        <MenuItem 
          onClick={handleSelectSupport}
          sx={{ 
            py: 1.5, 
            '&:hover': { bgcolor: 'rgba(0,113,227, 0.2)' },
          }}
        >
          <ListItemIcon>
            <SupportAgentIcon size={24} color="#0071e3" />
          </ListItemIcon>
          <ListItemText 
            primary={t.help.contactAdmin} 
            secondary={isLoggedIn ? t.help.contactAdminDesc : t.supportChat.loginRequired}
            secondaryTypographyProps={{ sx: { color: isLoggedIn ? 'var(--text-muted)' : 'var(--warning)', fontSize: '0.75rem' } }}
          />
        </MenuItem>
      </Menu>

      {/* Message Context Menu (IG-style unsend) */}
      <Menu
        anchorEl={messageMenuAnchor}
        open={Boolean(messageMenuAnchor)}
        onClose={handleCloseMessageMenu}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        PaperProps={{
          sx: {
            bgcolor: 'var(--surface)',
            color: 'var(--foreground)',
            borderRadius: 2,
            minWidth: 160,
            border: '1px solid var(--glass-border)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
          },
        }}
      >
        <MenuItem 
          onClick={() => selectedMessageId && handleUnsendMessage(selectedMessageId)}
          disabled={unsending}
          sx={{ 
            py: 1.5,
            color: 'var(--error)',
            '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.15)' },
          }}
        >
          <ListItemIcon>
            {unsending ? (
              <CircularProgress size={18} sx={{ color: 'var(--error)' }} />
            ) : (
              <DeleteIcon size={20} color="#ff453a" />
            )}
          </ListItemIcon>
          <ListItemText 
            primary={unsending ? t.common.loading : t.common.delete}
            primaryTypographyProps={{ sx: { fontWeight: 500 } }}
          />
        </MenuItem>
        {/* Reply option */}
        {selectedMessageId && chat?.messages && (
          <MenuItem 
            onClick={() => {
              const msg = chat.messages.find(m => m.id === selectedMessageId);
              if (msg) handleReplyToMessage(msg);
            }}
            sx={{ 
              py: 1.5,
              color: 'var(--primary)',
              '&:hover': { bgcolor: 'rgba(0,113,227, 0.15)' },
            }}
          >
            <ListItemIcon>
              <ReplyIcon size={20} color="#0071e3" />
            </ListItemIcon>
            <ListItemText 
              primary={t.chatbot.reply}
              primaryTypographyProps={{ sx: { fontWeight: 500 } }}
            />
          </MenuItem>
        )}
      </Menu>

      {/* Order Picker Dialog */}
      {showOrderPicker && (
        <Box
          onClick={() => setShowOrderPicker(false)}
          sx={{
            position: 'fixed',
            inset: 0,
            zIndex: 9998,
            bgcolor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <Paper
            onClick={(e) => e.stopPropagation()}
            sx={{
              width: { xs: '100%', sm: 400 },
              maxHeight: '70vh',
              borderRadius: { xs: '16px 16px 0 0', sm: 3 },
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              animation: 'slideUp 0.3s ease',
              '@keyframes slideUp': {
                '0%': { transform: 'translateY(100%)' },
                '100%': { transform: 'translateY(0)' },
              },
            }}
          >
            {/* Header */}
            <Box sx={{ 
              p: 2, 
              borderBottom: '1px solid var(--glass-border)',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}>
              <ReceiptIcon size={24} color="#0071e3" />
              <Typography sx={{ fontWeight: 700, color: 'var(--foreground)', flex: 1 }}>
                {t.supportChat.orderRef}
              </Typography>
              <IconButton size="small" onClick={() => setShowOrderPicker(false)}>
                <CloseIcon size={24} />
              </IconButton>
            </Box>
            
            {/* Order List */}
            <Box sx={{ flex: 1, overflowY: 'auto', p: 1 }}>
              {loadingOrders ? (
                <div className="space-y-2 p-2">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="rounded-xl border border-[var(--glass-border)] bg-[var(--surface-2)] p-3">
                      <div className="flex items-center gap-3">
                        <Skeleton className="size-9 shrink-0 rounded-lg" />
                        <div className="min-w-0 flex-1 space-y-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : orderHistory.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <ShoppingBagIcon size={48} color="#86868b" style={{ marginBottom: 8 }} />
                  <Typography sx={{ color: 'var(--text-muted)' }}>{t.orderHistory.empty}</Typography>
                </Box>
              ) : (
                orderHistory.map((order) => (
                  <Paper
                    key={order.ref}
                    onClick={() => handleSendOrderRef(order)}
                    sx={{
                      p: 1.5,
                      mb: 1,
                      cursor: 'pointer',
                      bgcolor: 'var(--surface-2)',
                      borderRadius: 2,
                      border: '1px solid var(--glass-border)',
                      transition: 'all 0.2s',
                      '&:hover': { 
                        bgcolor: 'var(--glass-bg)',
                        borderColor: 'var(--primary)',
                        transform: 'translateX(4px)',
                      },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{
                        width: 40,
                        height: 40,
                        borderRadius: 1.5,
                        bgcolor: 'var(--primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                      }}>
                        #{order.ref?.slice(-3) || '???'}
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 600, color: 'var(--foreground)', fontSize: '0.85rem' }}>
                          {t.supportChat.orderRef} #{order.ref}
                        </Typography>
                        <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                          ฿{order.totalAmount?.toLocaleString() || order.amount?.toLocaleString() || 0} · {new Date(order.date || order.createdAt).toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US')}
                        </Typography>
                      </Box>
                      <Chip
                        size="small"
                        label={getStatusLabel(order.status).replace(/[^\u0E00-\u0E7F\u0020-\u007E]/g, '').trim()}
                        sx={{
                          height: 22,
                          fontSize: '0.65rem',
                          bgcolor: order.status === 'PAID' ? 'rgba(34,197,94,0.15)' : 
                                   order.status === 'COMPLETED' ? 'rgba(0,113,227,0.15)' :
                                   order.status === 'CANCELLED' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                          color: order.status === 'PAID' ? 'var(--success)' :
                                 order.status === 'COMPLETED' ? 'var(--primary)' :
                                 order.status === 'CANCELLED' ? 'var(--error)' : 'var(--warning)',
                        }}
                      />
                    </Box>
                  </Paper>
                ))
              )}
            </Box>
          </Paper>
        </Box>
      )}

      {/* Support Chat Window */}
      <Fade in={open}>
        <Paper
          elevation={8}
          sx={{
            position: 'fixed',
            bottom: { xs: 0, sm: 24 },
            right: { xs: 0, sm: 24 },
            width: { xs: '100%', sm: 400 },
            height: { xs: '100dvh', sm: 550 },
            maxHeight: { xs: '100dvh', sm: 'calc(100vh - 48px)' },
            display: open ? 'flex' : 'none',
            flexDirection: 'column',
            borderRadius: { xs: 0, sm: 3 },
            overflow: 'hidden',
            zIndex: 1300,
            bgcolor: 'var(--surface)',
          }}
        >
          {/* Header */}
          <Box
            sx={{
              bgcolor: '#18181b',
              color: 'rgba(255,255,255,0.92)',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              px: 2,
              py: 1.5,
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              flexShrink: 0,
            }}
          >
            {showHistory && (
              <IconButton
                onClick={() => { setShowHistory(false); fetchActiveChat(); }}
                sx={{ color: 'rgba(255,255,255,0.85)', mr: -0.5 }}
                size="small"
              >
                <ArrowBackIcon size={24} />
              </IconButton>
            )}
            <Avatar 
              src="/favicon.png" 
              sx={{ bgcolor: 'rgba(255,255,255,0.08)', width: 40, height: 40, border: '1px solid rgba(255,255,255,0.1)' }}
            />
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: 'rgba(255,255,255,0.95)' }}>
                {showHistory ? t.supportChat.recentChats : displayAdminName}
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', opacity: 0.75, display: 'flex', alignItems: 'center', gap: 0.5, color: 'rgba(255,255,255,0.7)' }}>
                {/* Realtime connection indicator */}
                {chat && !showHistory && (
                  <Box
                    component="span"
                    sx={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      display: 'inline-block',
                      flexShrink: 0,
                      bgcolor: connectionState === 'connected' ? '#30d158'
                        : connectionState === 'connecting' ? '#ff9f0a'
                        : '#ff453a',
                      boxShadow: connectionState === 'connected' ? '0 0 6px rgba(48,209,88,0.7)' : 'none',
                      animation: connectionState === 'connecting' ? 'pulse 1.2s ease-in-out infinite' : 'none',
                      '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.3 } },
                    }}
                  />
                )}
                {showHistory 
                  ? t.supportChat.recentChats
                  : adminTyping && chat
                  ? (typingDisplay || `${chat.admin_name || displayAdminName} กำลังพิมพ์...`)
                  : chat?.status === 'active' 
                  ? `${t.supportChat.activeChats} - ${chat.admin_name || t.supportChat.admin}`
                  : chat?.status === 'pending'
                  ? t.supportChat.connecting
                  : chat?.status === 'closed'
                  ? t.supportChat.chatEnded
                  : t.supportChat.connected}
              </Typography>
            </Box>
            {!showHistory && (
              <IconButton
                onClick={() => { fetchChatHistory(); setShowHistory(true); }}
                sx={{ color: 'rgba(255,255,255,0.75)' }}
                title={t.supportChat.recentChats}
              >
                <HistoryIcon size={24} />
              </IconButton>
            )}
            {/* Push notification toggle */}
            {pushSupported && !showHistory && (
              <IconButton
                onClick={async () => {
                  if (pushSubscribed) {
                    await pushUnsubscribe();
                  } else {
                    const ok = await pushSubscribe();
                    if (!ok && pushPermission === 'denied') {
                      toastWarning(t.notification.deniedDesktop);
                    }
                  }
                }}
                disabled={pushLoading}
                sx={{ color: 'rgba(255,255,255,0.75)', opacity: pushSubscribed ? 1 : 0.55 }}
                title={pushSubscribed ? t.common.close : t.notification.enableNotification}
              >
                {pushSubscribed ? <BellIcon size={20} /> : <BellOffIcon size={20} />}
              </IconButton>
            )}
            <IconButton
              onClick={() => setOpen(false)}
              sx={{ color: 'rgba(255,255,255,0.75)' }}
            >
              <CloseIcon size={24} />
            </IconButton>
          </Box>

          {/* Content */}
          <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {loading ? (
              <Box sx={{ flex: 1, overflow: 'hidden', p: 2 }}>
                <div className="mb-4 flex flex-col gap-3">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-start gap-3">
                      <Skeleton className="size-10 shrink-0 rounded-full" />
                      <div className="min-w-0 flex-1 space-y-2">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-3 w-[75%]" />
                        <Skeleton className="h-2.5 w-16" />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 space-y-3">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className={cn('flex items-end gap-2', i % 2 ? 'flex-row-reverse' : 'flex-row')}
                    >
                      <Skeleton className="size-7 rounded-full" />
                      <Skeleton className={cn('h-14 rounded-2xl', i === 1 ? 'w-52' : 'w-40')} />
                    </div>
                  ))}
                </div>
              </Box>
            ) : showHistory ? (
              /* History View */
              <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
                {chatHistory.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <HistoryIcon size={48} color="#86868b" style={{ marginBottom: 8 }} />
                    <Typography sx={{ color: 'var(--text-muted)' }}>{t.supportChat.noChats}</Typography>
                  </Box>
                ) : (
                  chatHistory.map((historyChat) => {
                    const disableOpen = Boolean(chat && chat.status === 'pending');
                    return (
                      <Paper
                        key={historyChat.id}
                        onClick={() => { if (!disableOpen) viewChatHistory(historyChat.id); }}
                        sx={{
                          p: 2,
                          mb: 1.5,
                          cursor: disableOpen ? 'not-allowed' : 'pointer',
                          opacity: disableOpen ? 0.6 : 1,
                          bgcolor: 'var(--surface-2)',
                          borderRadius: 2,
                          pointerEvents: disableOpen ? 'none' : 'auto',
                          '&:hover': { bgcolor: disableOpen ? 'var(--surface-2)' : 'var(--glass-bg)' },
                        }}
                      >
                        <Typography sx={{ fontWeight: 600, color: 'var(--foreground)', fontSize: '0.9rem' }}>
                          {historyChat.subject || t.supportChat.topicProduct}
                        </Typography>
                        <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.8rem', mt: 0.5 }}>
                          {historyChat.last_message_preview}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                          <TimeIcon size={14} color="#86868b" />
                          <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                            {new Date(historyChat.closed_at || historyChat.updated_at).toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US', { 
                              day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                            })}
                          </Typography>
                          {historyChat.rating && (
                            <>
                              <StarIcon size={14} color="#ffd60a" />
                              <Typography sx={{ color: '#ffd60a', fontSize: '0.7rem' }}>
                                {historyChat.rating}
                              </Typography>
                            </>
                          )}
                        </Box>
                      </Paper>
                    );
                  })
                )}
              </Box>
            ) : showRating && chat ? (
              /* Rating View - Modern Design */
              <Box sx={{ 
                p: 3, 
                textAlign: 'center', 
                flex: 1, 
                display: 'flex', 
                flexDirection: 'column', 
                justifyContent: 'center',
                background: 'var(--surface)',
                overflowY: 'auto',
              }}>
                {/* Back button */}
                <Box sx={{ position: 'absolute', top: 70, left: 8 }}>
                  <IconButton
                    onClick={() => setShowRating(false)}
                    sx={{ color: 'var(--text-muted)', '&:hover': { bgcolor: 'rgba(0,0,0,0.05)' } }}
                    size="small"
                  >
                    <ArrowBackIcon size={24} />
                  </IconButton>
                </Box>
                {/* Success Icon with Animation */}
                <Box sx={{
                  width: 72,
                  height: 72,
                  mx: 'auto',
                  mb: 2,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(16, 185, 129, 0.15) 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid rgba(34, 197, 94, 0.3)',
                  animation: 'scaleIn 0.3s ease-out',
                  '@keyframes scaleIn': {
                    '0%': { transform: 'scale(0)' },
                    '100%': { transform: 'scale(1)' },
                  },
                }}>
                  <CheckCircleIcon size={40} color="#30d158" />
                </Box>
                
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5, color: 'var(--foreground)' }}>
                  {t.supportChat.chatEnded}
                </Typography>
                <Typography sx={{ color: 'var(--text-muted)', mb: 3, fontSize: '0.85rem' }}>
                  {t.supportChat.rateDesc}
                </Typography>
                
                {/* Rating Stars */}
                <Box sx={{ 
                  p: 2, 
                  mb: 2, 
                  borderRadius: 2, 
                  bgcolor: 'var(--surface-2)',
                  border: '1px solid var(--glass-border)',
                }}>
                  <Rating
                    value={rating}
                    onChange={(_, newValue) => setRating(newValue)}
                    size="large"
                    icon={<StarIcon size={16} color="#ffd60a" />}
                    emptyIcon={<StarIcon size={16} color="#e2e8f0" />}
                    sx={{ 
                      justifyContent: 'center',
                      '& .MuiRating-icon': {
                        transition: 'transform 0.2s',
                        '&:hover': { transform: 'scale(1.2)' },
                      },
                    }}
                  />
                  {rating && (
                    <Typography sx={{ color: 'var(--warning)', fontSize: '0.8rem', mt: 1, fontWeight: 500 }}>
                      {rating === 5 ? t.supportChat.excellent : 
                       rating === 4 ? t.supportChat.good : 
                       rating === 3 ? t.supportChat.average : 
                       rating === 2 ? t.supportChat.poor : t.supportChat.terrible}
                    </Typography>
                  )}
                </Box>
                
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  placeholder={`${t.supportChat.rateDesc} (${t.common.optional})`}
                  value={ratingComment}
                  onChange={(e) => setRatingComment(e.target.value)}
                  sx={{ 
                    mb: 2,
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      bgcolor: 'var(--surface)',
                      border: '1px solid var(--glass-border)',
                      '&:hover': { borderColor: 'var(--glass-border)' },
                      '&.Mui-focused': { 
                        borderColor: 'var(--primary)',
                        boxShadow: '0 0 0 3px rgba(0,113,227, 0.1)',
                      },
                      '& fieldset': { border: 'none' },
                    },
                    '& .MuiInputBase-input': {
                      color: 'var(--foreground)',
                      fontSize: '0.9rem',
                      '&::placeholder': { color: 'var(--text-muted)', opacity: 1 },
                    },
                  }}
                />
                
                <Button
                  fullWidth
                  variant="contained"
                  onClick={handleSubmitRating}
                  disabled={!rating || sending}
                  sx={{
                    background: 'linear-gradient(135deg, #0071e3 0%, #0077ED 100%)',
                    py: 1.5,
                    fontWeight: 600,
                    borderRadius: 2,
                    textTransform: 'none',
                    boxShadow: '0 4px 14px rgba(0,113,227, 0.3)',
                    '&:hover': { 
                      background: 'linear-gradient(135deg, #1d4ed8 0%, #bf5af2 100%)',
                      boxShadow: '0 6px 20px rgba(0,113,227, 0.4)',
                    },
                    '&.Mui-disabled': {
                      background: 'var(--surface-2)',
                      color: 'var(--text-muted)',
                      boxShadow: 'none',
                    },
                  }}
                >
                  {sending ? <CircularProgress size={22} sx={{ color: 'white' }} /> : (
                    <>{t.supportChat.rateService}</>
                  )}
                </Button>
              </Box>
            ) : showNewChatForm ? (
              /* New Chat Form - Modern Design */
              <Box sx={{ 
                flex: 1, 
                display: 'flex', 
                flexDirection: 'column',
                background: 'var(--surface)',
                overflowY: 'scroll',
                minHeight: 0,
                scrollbarWidth: 'thin',
                scrollbarColor: 'var(--text-muted) var(--surface-2)',
                '&::-webkit-scrollbar': {
                  width: 10,
                  background: 'var(--surface-2)',
                },
                '&::-webkit-scrollbar-thumb': {
                  background: 'var(--glass-border)',
                  borderRadius: 8,
                  border: '2px solid var(--surface-2)',
                },
                '&::-webkit-scrollbar-thumb:hover': {
                  background: 'var(--primary)',
                },
              }}>
                {/* Header Section */}
                <Box sx={{ 
                  p: 2.5, 
                  textAlign: 'center',
                  borderBottom: '1px solid var(--glass-border)',
                }}>
                  <Box sx={{
                    width: 64,
                    height: 64,
                    mx: 'auto',
                    mb: 1.5,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #0071e3 0%, #0077ED 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 8px 24px rgba(0,113,227, 0.3)',
                  }}>
                    <SupportAgentIcon size={32} color="white" />
                  </Box>
                  <Typography sx={{ fontWeight: 700, color: 'var(--foreground)', fontSize: '1.15rem', mb: 0.5 }}>
                    {t.supportChat.chatTitle}
                  </Typography>
                  <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    {t.help.contactAdminDesc}
                  </Typography>
                </Box>

                {/* Form Section */}
                <Box sx={{ p: 2.5, flex: 1, display: 'flex', flexDirection: 'column' }}>
                  {/* Quick Topics */}
                  <Typography sx={{ fontSize: '0.8rem', color: 'var(--text-muted)', mb: 1, fontWeight: 600 }}>
                    {t.supportChat.selectTopic}
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                    {[
                      { value: 'สอบถามสินค้า', label: t.supportChat.topicProduct },
                      { value: 'ปัญหาการสั่งซื้อ', label: t.supportChat.topicOrder },
                      { value: 'การจัดส่ง', label: t.supportChat.topicShipping },
                      { value: 'อื่นๆ', label: t.supportChat.topicOther },
                    ].map((topic) => (
                      <Box
                        key={topic.value}
                        onClick={() => setSubject(topic.value)}
                        sx={{
                          px: 1.5,
                          py: 0.75,
                          borderRadius: 2,
                          fontSize: '0.8rem',
                          fontWeight: 500,
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          bgcolor: subject === topic.value ? 'var(--primary)' : 'var(--surface-2)',
                          color: subject === topic.value ? 'white' : 'var(--text-muted)',
                          border: '1px solid',
                          borderColor: subject === topic.value ? 'var(--primary)' : 'var(--glass-border)',
                          '&:hover': {
                            bgcolor: subject === topic.value ? 'var(--primary)' : 'var(--surface-2)',
                            borderColor: subject === topic.value ? 'var(--primary)' : 'var(--glass-border)',
                          },
                        }}
                      >
                        {topic.label}
                      </Box>
                    ))}
                  </Box>

                  {/* Custom Subject (Optional) */}
                  <TextField
                    fullWidth
                    size="small"
                    placeholder={t.supportChat.customTopic}
                    value={!['สอบถามสินค้า', 'ปัญหาการสั่งซื้อ', 'การจัดส่ง', 'อื่นๆ'].includes(subject) ? subject : ''}
                    onChange={(e) => setSubject(e.target.value)}
                    sx={{ 
                      mb: 2,
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        bgcolor: 'var(--surface)',
                        border: '1px solid var(--glass-border)',
                        '&:hover': { borderColor: 'var(--glass-border)' },
                        '&.Mui-focused': { borderColor: 'var(--primary)' },
                        '& fieldset': { border: 'none' },
                      },
                      '& .MuiInputBase-input': {
                        color: 'var(--foreground)',
                        fontSize: '0.9rem',
                        '&::placeholder': { color: 'var(--text-muted)', opacity: 1 },
                      },
                    }}
                  />

                  {/* Message Input */}
                  <Typography sx={{ fontSize: '0.8rem', color: 'var(--text-muted)', mb: 1, fontWeight: 600 }}>
                    {t.supportChat.typeMessage}
                  </Typography>
                  <TextField
                    fullWidth
                    multiline
                    rows={4}
                    placeholder={t.supportChat.typeMessage}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    sx={{ 
                      mb: 2, 
                      flex: 1,
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        bgcolor: 'var(--surface)',
                        border: '1px solid var(--glass-border)',
                        '&:hover': { borderColor: 'var(--glass-border)' },
                        '&.Mui-focused': { borderColor: 'var(--primary)' },
                        '& fieldset': { border: 'none' },
                        alignItems: 'flex-start',
                      },
                      '& .MuiInputBase-input': {
                        color: 'var(--foreground)',
                        fontSize: '0.9rem',
                        '&::placeholder': { color: 'var(--text-muted)', opacity: 1 },
                      },
                    }}
                  />

                  {/* Submit Button */}
                  <Button
                    fullWidth
                    variant="contained"
                    onClick={handleCreateChat}
                    disabled={!message.trim() || sending}
                    sx={{
                      background: 'linear-gradient(135deg, #0071e3 0%, #0077ED 100%)',
                      py: 1.5,
                      fontWeight: 600,
                      fontSize: '0.95rem',
                      borderRadius: 2,
                      textTransform: 'none',
                      boxShadow: '0 4px 14px rgba(0,113,227, 0.4)',
                      '&:hover': { 
                        background: 'linear-gradient(135deg, #1d4ed8 0%, #bf5af2 100%)',
                        boxShadow: '0 6px 20px rgba(0,113,227, 0.5)',
                      },
                      '&.Mui-disabled': {
                        background: 'var(--surface-2)',
                        color: 'var(--text-muted)',
                        boxShadow: 'none',
                      },
                    }}
                  >
                    {sending ? (
                      <CircularProgress size={22} sx={{ color: 'white' }} />
                    ) : (
                      <>
                        <SendIcon size={20} style={{ marginRight: 8 }} />
                        {t.supportChat.startChat}
                      </>
                    )}
                  </Button>
                </Box>

                {/* Footer - View History */}
                <Box sx={{ 
                  p: 2, 
                  borderTop: '1px solid var(--glass-border)',
                  textAlign: 'center',
                  bgcolor: 'var(--surface-2)',
                }}>
                  <Button
                    size="small"
                    startIcon={<HistoryIcon size={20} />}
                    onClick={() => { fetchChatHistory(); setShowHistory(true); }}
                    sx={{ 
                      color: 'var(--text-muted)', 
                      fontSize: '0.8rem',
                      textTransform: 'none',
                      '&:hover': { color: 'var(--primary)', bgcolor: 'transparent' },
                    }}
                  >
                    {t.supportChat.recentChats}
                  </Button>
                </Box>
              </Box>
            ) : chat ? (
              /* Chat Messages */
              <>
                {/* Status Chip */}
                {chat.status === 'pending' && (
                  <Box sx={{ 
                    px: 2, 
                    py: 1.5, 
                    background: 'var(--surface-2)',
                    border: '1px solid var(--warning)',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 1,
                  }}>
                    <Box sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor: 'var(--warning)',
                      animation: 'pulse 1.5s infinite',
                      '@keyframes pulse': {
                        '0%': { opacity: 1, transform: 'scale(1)' },
                        '50%': { opacity: 0.5, transform: 'scale(0.8)' },
                        '100%': { opacity: 1, transform: 'scale(1)' },
                      },
                    }} />
                    <Typography sx={{ color: 'var(--warning)', fontSize: '0.85rem', fontWeight: 600 }}>
                      {t.supportChat.connecting}
                    </Typography>
                  </Box>
                )}

                {/* Push Notification Banner */}
                {pushSupported && !pushSubscribed && pushPermission !== 'denied' && !pushBannerDismissed && chat?.status !== 'closed' && (
                  <Box sx={{ 
                    px: 2, 
                    py: 1, 
                    background: 'linear-gradient(135deg, rgba(0,113,227,0.08) 0%, rgba(191,90,242,0.08) 100%)',
                    borderBottom: '1px solid var(--glass-border)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    flexShrink: 0,
                  }}>
                    <BellIcon size={16} color="#0071e3" />
                    <Typography sx={{ flex: 1, fontSize: '0.75rem', color: 'var(--foreground)', lineHeight: 1.3 }}>
                      {t.notification.description}
                    </Typography>
                    <Button
                      size="small"
                      variant="contained"
                      disabled={pushLoading}
                      onClick={async () => {
                        const ok = await pushSubscribe();
                        if (!ok && typeof Notification !== 'undefined' && Notification.permission === 'denied') {
                          toastWarning(t.notification.deniedDesktop);
                        }
                      }}
                      sx={{
                        fontSize: '0.7rem',
                        px: 1.5,
                        py: 0.3,
                        textTransform: 'none',
                        borderRadius: 2,
                        background: '#0071e3',
                        minWidth: 'auto',
                        '&:hover': { background: '#1d4ed8' },
                      }}
                    >
                      {pushLoading ? <CircularProgress size={14} sx={{ color: 'white' }} /> : t.notification.enableNotification}
                    </Button>
                    <IconButton 
                      size="small" 
                      onClick={() => setPushBannerDismissed(true)}
                      sx={{ p: 0.3 }}
                    >
                      <CloseIcon size={14} />
                    </IconButton>
                  </Box>
                )}
                
                {/* Messages Area — MessageScroller (follow live edge, hold when reading) */}
                <MessageScrollerProvider
                  key={chat.id}
                  autoScroll
                  defaultScrollPosition="last-anchor"
                  scrollPreviousItemPeek={40}
                >
                  <MessageScrollerApiBridge apiRef={scrollApiRef} />
                  <MessageScroller className="min-h-0 flex-1 bg-[var(--surface-2)]">
                    <MessageScrollerViewport>
                      <MessageScrollerContent className="gap-1 p-4">
                  <MessageScrollerItem messageId="__load_older__">
                    <MessageScrollerLoadOlder
                      hasMore={hasMoreOlder}
                      loading={loadingOlder}
                      onLoadMore={loadOlderMessages}
                    />
                  </MessageScrollerItem>
                  {(chat.messages || []).filter(msg => !msg.is_unsent).map((msg, index, filteredMessages) => {
                    if (
                      (msg as ChatMessage & { _optimistic?: boolean })._optimistic &&
                      typeof msg.message === 'string' &&
                      msg.message.includes('[กำลังอัปโหลด')
                    ) {
                      return null;
                    }
                    const { text, imageUrl, orderRef, animated, voiceUrl, voiceDuration, voiceBroken } = parseMessage(msg.message);
                    const isImageOnly = Boolean(imageUrl && !text && !orderRef && !voiceUrl && !voiceBroken);
                    const isVoiceOnly = Boolean(voiceUrl && !text && !orderRef && !imageUrl);
                    const isVoiceBrokenOnly = Boolean(voiceBroken && !text && !orderRef && !imageUrl && !voiceUrl);
                    const showTime = isLastInGroup(filteredMessages, index);
                    const canUnsend = msg.sender === 'customer' && chat.status !== 'closed';
                    const isLastCustomerMessage = msg.sender === 'customer' &&
                      index === filteredMessages.map(m => m.sender).lastIndexOf('customer');
                    const align = msg.sender === 'customer' ? 'end' : 'start';
                    const bubbleVariant = (msg as any)._failed
                      ? 'destructive'
                      : msg.sender === 'customer'
                        ? 'default'
                        : 'secondary';

                    if (msg.sender === 'system') {
                      return (
                        <MessageScrollerItem key={msg.id} messageId={msg.id}>
                          <ChatSystemMarker>{msg.message}</ChatSystemMarker>
                        </MessageScrollerItem>
                      );
                    }

                    return (
                      <MessageScrollerItem
                        key={`${msg.id}-${index}`}
                        messageId={msg.id}
                        scrollAnchor={msg.sender === 'customer'}
                      >
                      <Message
                        align={align}
                        className={cn(showTime ? 'mb-2' : 'mb-0')}
                      >
                        <MessageAvatar className={!showTime ? 'invisible' : undefined}>
                          {msg.sender === 'admin' ? (
                            <Avatar
                              src={msg.sender_avatar || undefined}
                              sx={{ width: 28, height: 28, bgcolor: 'var(--primary)' }}
                            >
                              {!msg.sender_avatar && <SupportAgentIcon size={16} />}
                            </Avatar>
                          ) : (
                            <Avatar
                              src={getUserAvatar() || msg.sender_avatar || undefined}
                              sx={{ width: 28, height: 28, bgcolor: 'var(--success)' }}
                            >
                              {!getUserAvatar() && !msg.sender_avatar && (
                                session?.user?.name?.charAt(0)?.toUpperCase() || 'U'
                              )}
                            </Avatar>
                          )}
                        </MessageAvatar>
                        <MessageContent>
                          {isVoiceOnly ? (
                            <VoiceMessage
                              src={voiceUrl!}
                              duration={voiceDuration}
                              className={cn((msg as any)._optimistic && 'opacity-60')}
                            />
                          ) : isVoiceBrokenOnly ? (
                            <Bubble variant={bubbleVariant} align={align}>
                              <BubbleContent>
                                <Typography sx={{ fontSize: '0.85rem', opacity: 0.85 }}>
                                  ข้อความเสียงไม่สมบูรณ์ กรุณาส่งใหม่
                                </Typography>
                              </BubbleContent>
                            </Bubble>
                          ) : isImageOnly ? (
                            <ChatImage
                              src={imageUrl!}
                              alt={t.supportChat.image}
                              animated={animated}
                              objectFit="contain"
                              maxWidth={280}
                              maxHeight={360}
                              className={cn(
                                'rounded-[14px] shadow-md',
                                (msg as any)._optimistic && 'opacity-60'
                              )}
                              onContextMenu={canUnsend ? (e) => handleMessageMenu(e as React.MouseEvent<HTMLElement>, msg.id) : undefined}
                            />
                          ) : (
                            <Bubble
                              variant={bubbleVariant}
                              align={align}
                              className={cn(
                                (msg as any)._optimistic && 'opacity-60',
                                canUnsend && 'cursor-pointer',
                              )}
                              onContextMenu={canUnsend ? (e) => handleMessageMenu(e as any, msg.id) : undefined}
                              onClick={canUnsend ? (e) => {
                                if ((e as any).detail === 2) handleMessageMenu(e as any, msg.id);
                              } : undefined}
                            >
                              <BubbleContent>
                                {text && (
                                  <Typography sx={{ fontSize: '0.9rem', whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
                                    {text}
                                  </Typography>
                                )}
                                {voiceUrl && (
                                  <VoiceMessage
                                    src={voiceUrl}
                                    duration={voiceDuration}
                                    className={cn((text || orderRef) && 'mt-1.5')}
                                  />
                                )}
                                {orderRef && (
                                  <Box
                                    sx={{
                                      mt: text ? 0.75 : 0,
                                      p: 1.5,
                                      bgcolor: msg.sender === 'customer' ? 'rgba(255,255,255,0.15)' : 'var(--surface-2)',
                                      borderRadius: 1.5,
                                      border: '1px solid',
                                      borderColor: 'var(--glass-border)',
                                    }}
                                  >
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                      <Box sx={{
                                        width: 32,
                                        height: 32,
                                        borderRadius: 1,
                                        bgcolor: '#0071e3',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                      }}>
                                        <ReceiptIcon size={18} color="white" />
                                      </Box>
                                      <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography sx={{ fontSize: '0.8rem', fontWeight: 600 }}>
                                          {t.supportChat.orderRef} #{orderRef}
                                        </Typography>
                                        <Typography sx={{ fontSize: '0.7rem', opacity: 0.8 }}>
                                          คลิกเพื่อดูรายละเอียด
                                        </Typography>
                                      </Box>
                                    </Box>
                                  </Box>
                                )}
                                {imageUrl && (
                                  <ChatImage
                                    src={imageUrl}
                                    alt={t.supportChat.image}
                                    animated={animated}
                                    objectFit="cover"
                                    maxWidth={250}
                                    maxHeight={220}
                                    className={cn(
                                      'rounded-xl',
                                      (text || orderRef) && 'mt-1.5'
                                    )}
                                  />
                                )}
                              </BubbleContent>
                            </Bubble>
                          )}

                          {showTime && (
                            <MessageFooter className="text-[0.65rem] text-muted-foreground">
                              <span className="tabular-nums">{formatTime(msg.created_at)}</span>
                              {isLastCustomerMessage && chat.status === 'active' && (
                                <>
                                  {msg.is_read
                                    ? <DoneAllIcon size={12} color="#30d158" />
                                    : <DoneIcon size={12} color="#86868b" />
                                  }
                                  {msg.is_read && msg.read_at && (
                                    <span className="text-[0.6rem] text-[#30d158] tabular-nums">
                                      {t.supportChat.readAll} {formatTime(msg.read_at)}
                                    </span>
                                  )}
                                </>
                              )}
                            </MessageFooter>
                          )}
                        </MessageContent>
                      </Message>
                      </MessageScrollerItem>
                    );
                  })}
                  
                  {/* Typing Indicator */}
                  {adminTyping && (
                    <MessageScrollerItem messageId="__typing__">
                    <Message align="start">
                      <MessageAvatar>
                        <Avatar sx={{ width: 32, height: 32, bgcolor: '#0071e3' }}>
                          <SupportAgentIcon size={18} />
                        </Avatar>
                      </MessageAvatar>
                      <MessageContent>
                        <Bubble variant="secondary" align="start">
                          <BubbleContent>
                            <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-muted)', mb: 0.5 }}>
                              {typingDisplay || `${chat?.admin_name || displayAdminName} กำลังพิมพ์...`}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                              {[0, 1, 2].map((i) => (
                                <Box
                                  key={i}
                                  sx={{
                                    width: 6,
                                    height: 6,
                                    borderRadius: '50%',
                                    bgcolor: 'var(--text-muted)',
                                    animation: 'typing 1.4s infinite ease-in-out',
                                    animationDelay: `${i * 0.2}s`,
                                    '@keyframes typing': {
                                      '0%, 60%, 100%': { transform: 'translateY(0)' },
                                      '30%': { transform: 'translateY(-4px)' },
                                    },
                                  }}
                                />
                              ))}
                            </Box>
                          </BubbleContent>
                        </Bubble>
                      </MessageContent>
                    </Message>
                    </MessageScrollerItem>
                  )}
                      </MessageScrollerContent>
                    </MessageScrollerViewport>
                    <MessageScrollerButton />
                  </MessageScroller>
                </MessageScrollerProvider>

                {/* Image Preview */}
                {previewImage && (
                  <Box sx={{ px: 2, py: 1, bgcolor: 'var(--surface-2)', borderTop: '1px solid var(--glass-border)', flexShrink: 0 }}>
                    <Box sx={{ position: 'relative', display: 'inline-block' }}>
                      <Box
                        component="img"
                        src={previewImage}
                        alt="Preview"
                        sx={{ maxHeight: 100, borderRadius: 1 }}
                      />
                      <IconButton
                        size="small"
                        onClick={() => setPreviewImage(null)}
                        sx={{
                          position: 'absolute',
                          top: -8,
                          right: -8,
                          bgcolor: '#ff453a',
                          color: 'white',
                          width: 20,
                          height: 20,
                          '&:hover': { bgcolor: '#ff3b30' },
                        }}
                      >
                        <CloseIcon size={14} />
                      </IconButton>
                    </Box>
                  </Box>
                )}

                {/* Chat Input - Only for active/pending chats */}
                {chat.status !== 'closed' ? (
                  <Box
                    sx={{
                      borderTop: '1px solid var(--glass-border)',
                      bgcolor: 'var(--surface)',
                      flexShrink: 0,
                      boxShadow: '0 -4px 12px rgba(0,0,0,0.03)',
                    }}
                  >
                    {/* Reply Preview */}
                    {replyToMessage && (
                      <Box
                        sx={{
                          px: 2,
                          py: 1,
                          bgcolor: 'var(--surface-2)',
                          borderBottom: '1px solid var(--glass-border)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.5,
                        }}
                      >
                        <Box
                          sx={{
                            width: 3,
                            height: 36,
                            bgcolor: '#0071e3',
                            borderRadius: 1,
                            flexShrink: 0,
                          }}
                        />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography sx={{ fontSize: '0.7rem', color: '#0071e3', fontWeight: 600 }}>
                            {t.chatbot.reply} {replyToMessage.sender === 'admin' ? t.supportChat.admin : t.supportChat.you}
                          </Typography>
                          <Typography 
                            sx={{ 
                              fontSize: '0.8rem', 
                              color: 'var(--text-muted)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {replyToMessage.text}
                          </Typography>
                        </Box>
                        <IconButton
                          size="small"
                          onClick={() => setReplyToMessage(null)}
                          sx={{ 
                            color: 'var(--text-muted)',
                            '&:hover': { color: 'var(--text-muted)', bgcolor: 'rgba(0,0,0,0.05)' },
                          }}
                        >
                          <CloseIcon size={18} />
                        </IconButton>
                      </Box>
                    )}
                    
                    {/* Input Area — IG-style pill composer */}
                    <Box
                      className="mobile-chat-input-bar"
                      sx={{
                        flexShrink: 0,
                        bgcolor: 'var(--surface)',
                        borderTop: '1px solid var(--glass-border)',
                      }}
                    >
                      <ChatComposer
                        value={message}
                        onChange={(v) => {
                          setMessage(v);
                          sendTypingIndicator();
                        }}
                        onSend={handleSendMessage}
                        onAttachImage={() => {
                          if (uploadingImage) return;
                          fileInputRef.current?.click();
                        }}
                        placeholder={t.supportChat.typeMessage}
                        disabled={sending}
                        sending={sending}
                        hasAttachment={Boolean(previewImage)}
                        isTouchDevice={isTouchDevice}
                        upload={
                          uploadingImage
                            ? {
                                progress: uploadProgress,
                                fileCount: uploadFileCount,
                                label: uploadLabel,
                                onCancel: cancelUpload,
                              }
                            : null
                        }
                      />
                    </Box>
                  </Box>
                ) : (
                  /* Closed chat - read only with new chat button */
                  <Box
                    sx={{
                      p: 2,
                      borderTop: '1px solid var(--glass-border)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1.5,
                      background: 'var(--surface)',
                      flexShrink: 0,
                      boxShadow: '0 -4px 12px rgba(0,0,0,0.05)',
                    }}
                  >
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      gap: 1,
                      py: 0.5,
                    }}>
                      <Box sx={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        bgcolor: chat.rating ? 'var(--success)' : 'var(--text-muted)',
                      }} />
                      <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        {chat.rating 
                          ? `${t.supportChat.chatEnded} • ${t.supportChat.rateService} ${chat.rating}/5`
                          : t.supportChat.chatEnded}
                      </Typography>
                    </Box>
                    
                    {/* Show rating button if not rated yet */}
                    {!chat.rating && (
                      <Button
                        fullWidth
                        variant="outlined"
                        startIcon={<StarIcon size={20} />}
                        onClick={() => {
                          setRating(null);
                          setRatingComment('');
                          setShowRating(true);
                        }}
                        sx={{
                          borderColor: '#ffd60a',
                          color: '#ff9f0a',
                          py: 1,
                          fontWeight: 600,
                          borderRadius: 2,
                          textTransform: 'none',
                          '&:hover': { 
                            borderColor: '#ff9f0a',
                            bgcolor: 'rgba(251, 191, 36, 0.08)',
                          },
                        }}
                      >
                        {t.supportChat.rateService}
                      </Button>
                    )}
                    
                    <Button
                      fullWidth
                      variant="contained"
                      startIcon={<AddIcon size={20} />}
                      onClick={() => { 
                        setChat(null); 
                        setShowNewChat(true);
                        setMessage('');
                        setSubject('');
                      }}
                      sx={{
                        background: 'linear-gradient(135deg, #0071e3 0%, #0077ED 100%)',
                        py: 1.25,
                        fontWeight: 600,
                        borderRadius: 2,
                        textTransform: 'none',
                        boxShadow: '0 4px 14px rgba(0,113,227, 0.3)',
                        '&:hover': { 
                          background: 'linear-gradient(135deg, #1d4ed8 0%, #bf5af2 100%)',
                          boxShadow: '0 6px 20px rgba(0,113,227, 0.4)',
                          transform: 'translateY(-1px)',
                        },
                        transition: 'all 0.2s',
                        '&.Mui-disabled': {
                          background: 'var(--surface-2)',
                          color: 'var(--text-muted)',
                          boxShadow: 'none',
                        },
                      }}
                    >
                      {t.supportChat.startNew}
                    </Button>
                  </Box>
                )}
              </>
            ) : null}
          </Box>
        </Paper>
      </Fade>
    </>
  );
}
