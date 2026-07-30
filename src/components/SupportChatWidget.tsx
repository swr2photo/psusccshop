/* eslint-disable @typescript-eslint/no-explicit-any */
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
import { Headphones as SupportAgentIcon, X as CloseIcon, Send as SendIcon, Clock as TimeIcon, CheckCircle2 as CheckCircleIcon, Star as StarIcon, Bot as ChatbotIcon, Check as DoneIcon, CheckCheck as DoneAllIcon, MessageCircle as ChatIcon, History as HistoryIcon, ArrowLeft as ArrowBackIcon, Plus as AddIcon, MoreVertical as MoreVertIcon, Trash2 as DeleteIcon, Reply as ReplyIcon, Pencil as EditIcon, Receipt as ReceiptIcon, ShoppingBag as ShoppingBagIcon, Bell as BellIcon, BellOff as BellOffIcon, Settings as SettingsIcon, Maximize2 as MaximizeIcon } from 'lucide-react';
import { useNotification } from './NotificationContext';
import { usePushNotification } from '@/hooks/usePushNotification';
import { useRealtimeChat } from '@/hooks/useRealtimeChat';
import { useTranslation } from '@/hooks/useTranslation';
import { chatMessagesChanged, getDbTypingFromSession } from '@/lib/support-chat-typing';
import { fetchChatSync, mergeChatMessages, mergeNewestWindow, fetchOlderChatMessages, getChatPollIntervalMs } from '@/lib/support-chat-sync';
import { formatStickerMessage } from '@/lib/chat-stickers';
import { formatVoiceMessage, VOICE_DATA_URL_FALLBACK_MAX } from '@/lib/chat-voice';
import { formatReplyPrefix, parseChatMessage } from '@/lib/chat-message';
import { cn } from '@/lib/utils';
import {
  chatBubbleContentStyle,
  chatThemeChromeStyle,
  chatThemeCssVars,
  chatThemeSurfaceStyle,
  getChatTheme,
  type ChatThemeId,
} from '@/lib/chat-themes';
import { ChatThemePicker } from '@/components/ChatThemePicker';
import { useRouter } from 'next/navigation';
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
import { SupportChatSettingsPanel } from '@/components/SupportChatSettingsPanel';
import {
  loadCustomerChatPrefs,
  saveCustomerChatPrefs,
  playChatMessageSound,
  type CustomerChatPrefs,
} from '@/lib/customer-chat-prefs';
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
  /** Full-page conversation view (Messenger-style /messages) */
  variant?: 'widget' | 'page';
  /** Prefetch / open a specific session when known */
  initialSessionId?: string;
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

export default function SupportChatWidget({
  onOpenChatbot,
  hideMobileFab,
  externalOpen,
  onExternalOpenHandled,
  shopId,
  shopName,
  variant = 'widget',
  initialSessionId,
}: SupportChatWidgetProps) {
  const isPage = variant === 'page';
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();
  const isLoggedIn = !!session?.user?.email;
  const { t, lang } = useTranslation();
  const { warning: toastWarning, error: toastError } = useNotification();
  const { permission: pushPermission, isSupported: pushSupported, isSubscribed: pushSubscribed, loading: pushLoading, subscribe: pushSubscribe, unsubscribe: pushUnsubscribe } = usePushNotification();
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [open, setOpen] = useState(isPage);
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
  const [messageMenuAnchor, setMessageMenuAnchor] = useState<null | Element>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [unsending, setUnsending] = useState(false);
  const [replyToMessage, setReplyToMessage] = useState<{ id: string; text: string; sender: string } | null>(null);
  const [editingMessage, setEditingMessage] = useState<{ id: string; text: string } | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [orderHistory, setOrderHistory] = useState<any[]>([]);
  const [showOrderPicker, setShowOrderPicker] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [pushBannerDismissed, setPushBannerDismissed] = useState(false);
  const [adminDisplayName, setAdminDisplayName] = useState(DEFAULT_ADMIN_NAME);
  const [fallbackTyping, setFallbackTyping] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [chatPrefs, setChatPrefs] = useState<CustomerChatPrefs>(() => loadCustomerChatPrefs());
  const chatTheme = getChatTheme(chatPrefs.themeId);
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

  const updateChatPrefs = useCallback((next: CustomerChatPrefs) => {
    setChatPrefs(next);
    saveCustomerChatPrefs(next);
  }, []);

  // Show browser Notification when tab is blurred and new admin message arrives
  useEffect(() => {
    if (!chat?.messages) return;
    
    const adminMessages = chat.messages.filter(m => m.sender === 'admin');
    const currentCount = adminMessages.length;
    
    // Only notify for genuinely new messages (not on initial load)
    if (lastMessageCountRef.current > 0 && currentCount > lastMessageCountRef.current) {
      const latestMsg = adminMessages[adminMessages.length - 1];

      if (open && chatPrefs.soundEnabled && !chatPrefs.muted) {
        playChatMessageSound();
      }
      
      // If tab is not focused or chat is not open, show browser notification
      if (!chatPrefs.muted && (document.hidden || !open)) {
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
  }, [chat?.messages, chat?.id, open, chatPrefs.muted, chatPrefs.soundEnabled, t.supportChat.newMessage]);

  // Scroll only the chat message pane (never the page behind the widget)
  const scrollToBottom = useCallback((_force = false) => {
    // Defer until optimistic message is painted so MessageScroller can follow the live edge
    requestAnimationFrame(() => {
      scrollApiRef.current?.scrollToEnd({ behavior: 'smooth' });
      requestAnimationFrame(() => {
        scrollApiRef.current?.scrollToEnd({ behavior: 'auto' });
      });
    });
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
      const boot = initialSessionId
        ? viewChatHistory(initialSessionId)
        : fetchActiveChat(true);
      void boot.finally(() => setLoading(false));
    }
  }, [open, session?.user?.email, fetchActiveChat, initialSessionId, viewChatHistory]);

  // Full-page: keep Messenger-style URL in sync once the active thread is known
  useEffect(() => {
    if (!isPage || !chat?.id) return;
    const target = `/messages/t/${chat.id}`;
    if (typeof window !== 'undefined' && window.location.pathname !== target) {
      router.replace(target);
    }
  }, [isPage, chat?.id, router]);

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

    // Local stickers or remote Giphy HTTPS URLs — send path directly
    if (src.startsWith('/chat-stickers/') || /^https?:\/\//i.test(src)) {
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
      } catch (error: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ {
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
      t.supportChat.uploadingVoice,
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
        throw new Error(t.supportChat.voiceUploadFailed);
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
    } catch (error: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ {
      if (error?.name !== 'AbortError') {
        toastError(error?.message || t.supportChat.voiceUploadFailed);
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
    } catch (error: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ {
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
    // If editing an existing message, save edit instead of sending new
    if (editingMessage) {
      await handleSaveEdit();
      return;
    }

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
        finalMessage = formatReplyPrefix(replyToMessage.id, replyPreview) + finalMessage;
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
      .replace(/\[ตอบกลับ[^\]]*\]\n?/g, '')
      .replace(/\[#edited#\]/g, '')
      .trim() || `[${t.supportChat.image}]`;
    setEditingMessage(null);
    setReplyToMessage({
      id: msg.id,
      text: previewText,
      sender: msg.sender,
    });
    setMessageMenuAnchor(null);
    setSelectedMessageId(null);
  };

  const jumpToMessage = useCallback((messageId: string) => {
    const el = document.getElementById(`chat-msg-${messageId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedMessageId(messageId);
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => setHighlightedMessageId(null), 1600);
  }, []);

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    };
  }, []);

  const handleStartEditMessage = (msg: ChatMessage) => {
    const parsed = parseChatMessage(msg.message);
    if (parsed.voiceUrl || parsed.voiceBroken || parsed.imageUrl || parsed.orderRef) {
      setMessageMenuAnchor(null);
      setSelectedMessageId(null);
      return;
    }
    setReplyToMessage(null);
    setEditingMessage({ id: msg.id, text: parsed.text });
    setMessage(parsed.text);
    setMessageMenuAnchor(null);
    setSelectedMessageId(null);
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
    setMessage('');
  };

  const handleSaveEdit = async () => {
    if (!chat || !editingMessage || sending) return;
    const next = message.trim();
    if (!next) return;
    setSending(true);
    try {
      const res = await apiFetch(`/api/support-chat/${chat.id}/message/${editingMessage.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && data.message) {
        setChat((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            messages: prev.messages.map((m) =>
              m.id === editingMessage.id ? { ...m, ...data.message } : m
            ),
          };
        });
        setRealtimeMessages((prev: any[]) =>
          prev.map((m) => (m.id === editingMessage.id ? { ...m, ...data.message } : m))
        );
        setEditingMessage(null);
        setMessage('');
      } else {
        toastError(data?.error || t.supportChat.editFailed);
      }
    } catch {
      toastError(t.supportChat.editFailed);
    } finally {
      setSending(false);
      setMessageMenuAnchor(null);
      setSelectedMessageId(null);
    }
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
  const handleMessageMenu = (event: React.MouseEvent<Element>, messageId: string) => {
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

      {/* Floating Chat Button — clean primary FAB */}
      {!isPage && (
      <Zoom in={!open}>
        <Box
          sx={{
            position: 'fixed',
            bottom: { xs: 20, sm: 24 },
            right: { xs: 16, sm: 24 },
            zIndex: 1200,
            display: hideMobileFab ? 'none' : 'block',
          }}
        >
          <Badge
            badgeContent={unreadCount}
            overlap="circular"
            sx={{
              '& .MuiBadge-badge': {
                right: 4,
                top: 4,
                fontWeight: 700,
                fontSize: '0.7rem',
                minWidth: 20,
                height: 20,
                borderRadius: '50%',
                bgcolor: 'var(--destructive, #ff3b30)',
                color: '#fff',
                border: '2px solid var(--background)',
              },
            }}
          >
            <IconButton
              onClick={handleOpenMenu}
              aria-label={t.supportChat.chatTitle}
              sx={{
                width: { xs: 56, sm: 60 },
                height: { xs: 56, sm: 60 },
                bgcolor: 'var(--primary)',
                color: 'var(--primary-foreground)',
                boxShadow: '0 8px 24px color-mix(in srgb, var(--primary) 35%, transparent)',
                borderRadius: '50%',
                border: '1px solid color-mix(in srgb, var(--primary) 70%, #000)',
                '&:hover': {
                  bgcolor: 'color-mix(in srgb, var(--primary) 88%, #000)',
                  transform: 'scale(1.05)',
                },
                '&:active': { transform: 'scale(0.96)' },
                transition: 'transform 0.2s ease, background-color 0.2s ease',
              }}
            >
              <ChatIcon size={24} strokeWidth={2.2} />
            </IconButton>
          </Badge>
        </Box>
      </Zoom>
      )}

      {/* Mode Selection Menu */}
      {!isPage && (
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
      )}

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
        {selectedMessageId &&
          chat?.messages?.find((m) => m.id === selectedMessageId)?.sender === 'customer' && (
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
        )}
        {selectedMessageId && chat?.messages && (() => {
          const msg = chat.messages.find((m) => m.id === selectedMessageId);
          if (!msg || msg.sender !== 'customer') return null;
          const parsed = parseChatMessage(msg.message);
          const canEdit =
            chat.status !== 'closed' &&
            !parsed.voiceUrl &&
            !parsed.voiceBroken &&
            !parsed.imageUrl &&
            !parsed.orderRef &&
            Boolean(parsed.text);
          if (!canEdit) return null;
          return (
            <MenuItem
              onClick={() => handleStartEditMessage(msg)}
              sx={{
                py: 1.5,
                color: 'var(--foreground)',
                '&:hover': { bgcolor: 'var(--surface-2)' },
              }}
            >
              <ListItemIcon>
                <EditIcon size={20} color="var(--foreground)" />
              </ListItemIcon>
              <ListItemText
                primary={t.supportChat.editMessage}
                primaryTypographyProps={{ sx: { fontWeight: 500 } }}
              />
            </MenuItem>
          );
        })()}
        {/* Reply option */}
        {selectedMessageId && chat?.messages && chat.status !== 'closed' && (
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
          elevation={isPage ? 0 : 8}
          sx={{
            position: isPage ? 'relative' : 'fixed',
            bottom: isPage ? 'auto' : { xs: 0, sm: 24 },
            right: isPage ? 'auto' : { xs: 0, sm: 24 },
            width: isPage ? '100%' : { xs: '100%', sm: 400 },
            height: isPage ? '100dvh' : { xs: '100dvh', sm: 550 },
            maxHeight: isPage ? '100dvh' : { xs: '100dvh', sm: 'calc(100vh - 48px)' },
            maxWidth: isPage ? 1200 : undefined,
            mx: isPage ? 'auto' : undefined,
            display: open ? 'flex' : 'none',
            flexDirection: isPage ? { xs: 'column', md: 'row' } : 'column',
            borderRadius: isPage ? 0 : { xs: 0, sm: 3 },
            overflow: 'hidden',
            zIndex: isPage ? 1 : 1300,
            bgcolor: 'var(--surface)',
            border: isPage ? '1px solid var(--glass-border)' : undefined,
            ...chatThemeCssVars(chatTheme),
          }}
        >
          <Box
            sx={{
              flex: 1,
              minWidth: 0,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
          {/* Header */}
          <Box
            sx={{
              ...chatThemeChromeStyle(chatTheme),
              borderBottom: '1px solid var(--chat-chrome-border)',
              px: 2,
              py: 1.5,
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              flexShrink: 0,
            }}
          >
            {showHistory || showSettings ? (
              <IconButton
                onClick={() => {
                  if (showSettings) {
                    setShowSettings(false);
                    return;
                  }
                  setShowHistory(false);
                  fetchActiveChat();
                }}
                sx={{ color: 'inherit', mr: -0.5, opacity: 0.9 }}
                size="small"
              >
                <ArrowBackIcon size={22} />
              </IconButton>
            ) : null}
            <Avatar 
              src="/favicon.png" 
              sx={{
                bgcolor: 'color-mix(in srgb, var(--background) 12%, transparent)',
                width: 40,
                height: 40,
                border: '1px solid color-mix(in srgb, var(--background) 16%, transparent)',
              }}
            />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: 'inherit', lineHeight: 1.2 }}>
                {showSettings
                  ? t.supportChat.settingsTitle
                  : showHistory
                    ? t.supportChat.recentChats
                    : displayAdminName}
              </Typography>
              {!showSettings && (
              <Typography sx={{ fontSize: '0.75rem', opacity: 0.72, display: 'flex', alignItems: 'center', gap: 0.5, color: 'inherit' }}>
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
              )}
            </Box>
            {!showHistory && !showSettings && (
              <IconButton
                onClick={() => { fetchChatHistory(); setShowHistory(true); }}
                sx={{ color: 'inherit', opacity: 0.8 }}
                title={t.supportChat.recentChats}
              >
                <HistoryIcon size={22} />
              </IconButton>
            )}
            {!showHistory && !showSettings && (
              <IconButton
                onClick={() => setShowSettings(true)}
                sx={{
                  color: 'inherit',
                  opacity: 0.8,
                  display: isPage ? { xs: 'inline-flex', md: 'none' } : 'inline-flex',
                }}
                title={t.supportChat.settings}
                aria-label={t.supportChat.settings}
              >
                <SettingsIcon size={20} />
              </IconButton>
            )}
            {!isPage && !showHistory && !showSettings && (
              <IconButton
                sx={{ color: 'inherit', opacity: 0.8 }}
                title={t.supportChat.openFullPage}
                aria-label={t.supportChat.openFullPage}
                onClick={() => {
                  const href = chat?.id ? `/messages/t/${chat.id}` : '/messages';
                  setOpen(false);
                  router.push(href);
                }}
              >
                <MaximizeIcon size={18} />
              </IconButton>
            )}
            {/* Push notification toggle — only when not muted via settings */}
            {pushSupported && !showHistory && !showSettings && (
              <IconButton
                onClick={async () => {
                  if (pushSubscribed) {
                    await pushUnsubscribe();
                    updateChatPrefs({ ...chatPrefs, muted: true });
                  } else {
                    const ok = await pushSubscribe();
                    if (ok) updateChatPrefs({ ...chatPrefs, muted: false });
                    if (!ok && pushPermission === 'denied') {
                      toastWarning(t.notification.deniedDesktop);
                    }
                  }
                }}
                disabled={pushLoading}
                sx={{ color: 'inherit', opacity: pushSubscribed && !chatPrefs.muted ? 1 : 0.55 }}
                title={pushSubscribed ? t.supportChat.muteNotifications : t.notification.enableNotification}
              >
                {pushSubscribed && !chatPrefs.muted ? <BellIcon size={20} /> : <BellOffIcon size={20} />}
              </IconButton>
            )}
            <IconButton
              onClick={() => {
                if (isPage) {
                  router.push('/');
                  return;
                }
                setOpen(false);
                setShowSettings(false);
              }}
              sx={{ color: 'inherit', opacity: 0.8 }}
              aria-label={isPage ? t.supportChat.settingsBack : undefined}
            >
              <CloseIcon size={22} />
            </IconButton>
          </Box>

          {/* Content */}
          <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {showSettings ? (
              <SupportChatSettingsPanel
                prefs={chatPrefs}
                onPrefsChange={updateChatPrefs}
                messages={chat?.messages || []}
                onBack={() => setShowSettings(false)}
                onChangeTheme={() => setShowThemePicker(true)}
                onMuteEnabled={() => {
                  if (pushSubscribed) void pushUnsubscribe();
                }}
                pushLoading={pushLoading}
                labels={{
                  settingsTitle: t.supportChat.settingsTitle,
                  sectionCustomize: t.supportChat.sectionCustomize,
                  sectionMedia: t.supportChat.sectionMedia,
                  sectionPrivacy: t.supportChat.sectionPrivacy,
                  sectionHelp: t.supportChat.sectionHelp,
                  muteNotifications: t.supportChat.muteNotifications,
                  muteNotificationsDesc: t.supportChat.muteNotificationsDesc,
                  soundToggle: t.supportChat.soundToggle,
                  soundToggleDesc: t.supportChat.soundToggleDesc,
                  compactDensity: t.supportChat.compactDensity,
                  compactDensityDesc: t.supportChat.compactDensityDesc,
                  primaryBubbles: t.supportChat.primaryBubbles,
                  primaryBubblesDesc: t.supportChat.primaryBubblesDesc,
                  changeTheme: t.supportChat.changeTheme,
                  changeThemeDesc: t.supportChat.changeThemeDesc,
                  currentTheme: lang === 'en' ? chatTheme.nameEn : chatTheme.nameTh,
                  mediaGallery: t.supportChat.mediaGallery,
                  mediaGalleryDesc: t.supportChat.mediaGalleryDesc,
                  noMedia: t.supportChat.noMedia,
                  images: t.supportChat.images,
                  voiceMessages: t.supportChat.voiceMessages,
                  faqSupport: t.supportChat.faqSupport,
                  faqSupportDesc: t.supportChat.faqSupportDesc,
                  back: t.supportChat.settingsBack,
                  on: t.supportChat.on,
                  off: t.supportChat.off,
                }}
              />
            ) : loading ? (
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
                    py: 1, 
                    bgcolor: 'color-mix(in srgb, var(--warning) 10%, var(--surface))',
                    borderBottom: '1px solid color-mix(in srgb, var(--warning) 35%, var(--glass-border))',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 1,
                  }}>
                    <Box sx={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      bgcolor: 'var(--warning)',
                      animation: 'pulse 1.5s infinite',
                      '@keyframes pulse': {
                        '0%': { opacity: 1 },
                        '50%': { opacity: 0.4 },
                        '100%': { opacity: 1 },
                      },
                    }} />
                    <Typography sx={{ color: 'var(--foreground)', fontSize: '0.8rem', fontWeight: 550 }}>
                      {t.supportChat.connecting}
                    </Typography>
                  </Box>
                )}

                {/* Push Notification Banner */}
                {pushSupported && !pushSubscribed && !chatPrefs.muted && pushPermission !== 'denied' && !pushBannerDismissed && chat?.status !== 'closed' && (
                  <Box sx={{ 
                    px: 2, 
                    py: 1, 
                    bgcolor: 'color-mix(in srgb, var(--primary) 8%, var(--surface))',
                    borderBottom: '1px solid var(--glass-border)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    flexShrink: 0,
                  }}>
                    <BellIcon size={16} color="var(--primary)" />
                    <Typography sx={{ flex: 1, fontSize: '0.75rem', color: 'var(--foreground)', lineHeight: 1.3 }}>
                      {t.notification.description}
                    </Typography>
                    <Button
                      size="small"
                      variant="contained"
                      disabled={pushLoading}
                      onClick={async () => {
                        const ok = await pushSubscribe();
                        if (ok) updateChatPrefs({ ...chatPrefs, muted: false });
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
                        bgcolor: 'var(--primary)',
                        minWidth: 'auto',
                        boxShadow: 'none',
                        '&:hover': { bgcolor: 'color-mix(in srgb, var(--primary) 85%, #000)' },
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
                  defaultScrollPosition="end"
                  scrollPreviousItemPeek={40}
                >
                  <MessageScrollerApiBridge apiRef={scrollApiRef} />
                  <MessageScroller
                    className="min-h-0 flex-1"
                    style={chatThemeSurfaceStyle(chatTheme)}
                    data-chat-theme={chatTheme.id}
                  >
                    <MessageScrollerViewport>
                      <MessageScrollerContent className={cn('gap-1 p-4', chatPrefs.compact && 'gap-0.5 p-3')}>
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
                    const { text, imageUrl, orderRef, animated, voiceUrl, voiceDuration, voiceBroken, replyToId, replyPreview, edited } = parseMessage(msg.message);
                    const isImageOnly = Boolean(imageUrl && !text && !orderRef && !voiceUrl && !voiceBroken);
                    const isVoiceOnly = Boolean(voiceUrl && !text && !orderRef && !imageUrl);
                    const isVoiceBrokenOnly = Boolean(voiceBroken && !text && !orderRef && !imageUrl && !voiceUrl);
                    const showTime = isLastInGroup(filteredMessages, index);
                    const canUnsend = msg.sender === 'customer' && chat.status !== 'closed';
                    const canReply = chat.status !== 'closed';
                    const canEditText =
                      canUnsend &&
                      Boolean(text) &&
                      !voiceUrl &&
                      !voiceBroken &&
                      !imageUrl &&
                      !orderRef;
                    const openMsgMenu = canUnsend || canReply
                      ? (e: React.MouseEvent<Element>) => handleMessageMenu(e, msg.id)
                      : undefined;
                    const isLastCustomerMessage = msg.sender === 'customer' &&
                      index === filteredMessages.map(m => m.sender).lastIndexOf('customer');
                    const align = msg.sender === 'customer' ? 'end' : 'start';
                    const bubbleVariant = (msg as any)._failed
                      ? 'destructive'
                      : msg.sender === 'customer'
                        ? (chatPrefs.themeId === 'classic' && !chatPrefs.primaryBubbles ? 'tinted' : 'default')
                        : 'secondary';
                    const themedBubbleStyle =
                      (msg as any)._failed
                        ? undefined
                        : chatBubbleContentStyle(
                            chatTheme,
                            msg.sender === 'customer' ? 'outgoing' : 'incoming'
                          );
                    const isHighlighted = highlightedMessageId === msg.id;

                    if (msg.sender === 'system') {
                      return (
                        <MessageScrollerItem key={msg.id} messageId={msg.id}>
                          <ChatSystemMarker>{msg.message}</ChatSystemMarker>
                        </MessageScrollerItem>
                      );
                    }

                    return (
                      <MessageScrollerItem
                        key={msg.id}
                        messageId={msg.id}
                      >
                      <div
                        id={`chat-msg-${msg.id}`}
                        className={cn(
                          'rounded-2xl transition-[box-shadow,background-color] duration-500',
                          isHighlighted && 'bg-[color-mix(in_srgb,var(--chat-accent,#0071e3)_22%,transparent)] ring-2 ring-[color-mix(in_srgb,var(--chat-accent,#0071e3)_45%,transparent)]'
                        )}
                      >
                      <Message
                        align={align}
                        className={cn(showTime ? (chatPrefs.compact ? 'mb-1' : 'mb-2') : 'mb-0')}
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
                          {(replyPreview || replyToId) && (
                            <button
                              type="button"
                              title={t.supportChat.jumpToReply}
                              onClick={() => {
                                if (replyToId) jumpToMessage(replyToId);
                              }}
                              disabled={!replyToId}
                              className={cn(
                                'mb-1 max-w-[min(280px,85%)] rounded-xl border border-white/15 bg-black/15 px-2.5 py-1.5 text-left transition',
                                replyToId && 'cursor-pointer hover:bg-black/25',
                                !replyToId && 'cursor-default opacity-80',
                                align === 'end' ? 'ml-auto' : 'mr-auto'
                              )}
                            >
                              <span className="block text-[10px] font-semibold opacity-80">
                                {t.chatbot.reply}
                              </span>
                              <span className="line-clamp-2 block text-[11px] opacity-90">
                                {replyPreview || '…'}
                              </span>
                            </button>
                          )}
                          {isVoiceOnly ? (
                            <div
                              onContextMenu={openMsgMenu}
                              onDoubleClick={openMsgMenu}
                            >
                            <VoiceMessage
                              src={voiceUrl!}
                              duration={voiceDuration}
                              playLabel={t.supportChat.playVoice}
                              pauseLabel={t.supportChat.pauseVoice}
                              className={cn((msg as any)._optimistic && 'opacity-60')}
                            />
                            </div>
                          ) : isVoiceBrokenOnly ? (
                            <Bubble
                              variant={bubbleVariant}
                              align={align}
                              onContextMenu={openMsgMenu}
                              onDoubleClick={openMsgMenu}
                            >
                              <BubbleContent
                                style={themedBubbleStyle}
                                className={
                                  msg.sender === 'customer'
                                    ? '![background:var(--chat-out-bg)] ![color:var(--chat-out-fg)]'
                                    : '![background:var(--chat-in-bg)] ![color:var(--chat-in-fg)]'
                                }
                              >
                                <Typography sx={{ fontSize: '0.85rem', opacity: 0.85 }}>
                                  {t.supportChat.voiceBroken}
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
                              onContextMenu={openMsgMenu}
                            />
                          ) : (
                            <Bubble
                              variant={bubbleVariant}
                              align={align}
                              className={cn(
                                (msg as any)._optimistic && 'opacity-60',
                                (canUnsend || canReply) && 'cursor-pointer',
                              )}
                              onContextMenu={openMsgMenu}
                              onDoubleClick={openMsgMenu}
                            >
                              <BubbleContent
                                style={themedBubbleStyle}
                                className={
                                  (msg as any)._failed
                                    ? undefined
                                    : msg.sender === 'customer'
                                      ? '![background:var(--chat-out-bg)] ![color:var(--chat-out-fg)]'
                                      : '![background:var(--chat-in-bg)] ![color:var(--chat-in-fg)]'
                                }
                              >
                                {text && (
                                  <Typography sx={{ fontSize: '0.9rem', whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
                                    {text}
                                    {edited ? (
                                      <Box
                                        component="span"
                                        sx={{ ml: 0.75, fontSize: '0.68rem', opacity: 0.7, fontWeight: 500 }}
                                      >
                                        {t.supportChat.edited}
                                      </Box>
                                    ) : null}
                                  </Typography>
                                )}
                                {voiceUrl && (
                                  <VoiceMessage
                                    src={voiceUrl}
                                    duration={voiceDuration}
                                    playLabel={t.supportChat.playVoice}
                                    pauseLabel={t.supportChat.pauseVoice}
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

                          <div className={cn('mt-0.5 flex items-center gap-1', align === 'end' ? 'justify-end' : 'justify-start')}>
                            {canReply || canEditText ? (
                              <button
                                type="button"
                                aria-label="message actions"
                                onClick={(e) => handleMessageMenu(e, msg.id)}
                                className="flex size-6 items-center justify-center rounded-full text-[var(--chat-chrome-muted,var(--text-muted))] opacity-70 transition hover:bg-black/10 hover:opacity-100"
                              >
                                <MoreVertIcon size={14} />
                              </button>
                            ) : null}
                          </div>

                          {showTime && (
                            <MessageFooter className="text-[0.65rem] text-muted-foreground">
                              <span className="tabular-nums">{formatTime(msg.created_at)}</span>
                              {edited && !text ? (
                                <span className="opacity-70">{t.supportChat.edited}</span>
                              ) : null}
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
                      </div>
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
                          <BubbleContent
                            style={chatBubbleContentStyle(chatTheme, 'incoming')}
                            className="![background:var(--chat-in-bg)] ![color:var(--chat-in-fg)]"
                          >
                            <Typography sx={{ fontSize: '0.75rem', color: 'inherit', opacity: 0.75, mb: 0.5 }}>
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
                      borderTop: '1px solid var(--chat-chrome-border, var(--glass-border))',
                      bgcolor: 'var(--chat-composer-bg, var(--surface))',
                      color: 'var(--chat-chrome-fg, var(--foreground))',
                      flexShrink: 0,
                      boxShadow: '0 -4px 12px rgba(0,0,0,0.03)',
                      backdropFilter: 'blur(12px)',
                    }}
                  >
                    {/* Edit / Reply Preview */}
                    {editingMessage && (
                      <Box
                        sx={{
                          px: 2,
                          py: 1,
                          bgcolor: 'color-mix(in srgb, var(--chat-accent, var(--primary)) 12%, transparent)',
                          borderBottom: '1px solid var(--chat-chrome-border, var(--glass-border))',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.5,
                        }}
                      >
                        <EditIcon size={16} color="var(--chat-accent, var(--primary))" />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography sx={{ fontSize: '0.7rem', color: 'var(--chat-accent, var(--primary))', fontWeight: 600 }}>
                            {t.supportChat.editMessage}
                          </Typography>
                          <Typography sx={{ fontSize: '0.8rem', color: 'var(--chat-chrome-muted, var(--text-muted))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {editingMessage.text}
                          </Typography>
                        </Box>
                        <IconButton size="small" onClick={handleCancelEdit} sx={{ color: 'var(--chat-chrome-muted)' }}>
                          <CloseIcon size={18} />
                        </IconButton>
                      </Box>
                    )}
                    {replyToMessage && !editingMessage && (
                      <Box
                        sx={{
                          px: 2,
                          py: 1,
                          bgcolor: 'color-mix(in srgb, var(--chat-accent, var(--primary)) 10%, transparent)',
                          borderBottom: '1px solid var(--chat-chrome-border, var(--glass-border))',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.5,
                        }}
                      >
                        <Box
                          sx={{
                            width: 3,
                            height: 36,
                            bgcolor: 'var(--chat-accent, #0071e3)',
                            borderRadius: 1,
                            flexShrink: 0,
                          }}
                        />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography sx={{ fontSize: '0.7rem', color: 'var(--chat-accent, #0071e3)', fontWeight: 600 }}>
                            {t.chatbot.reply} {replyToMessage.sender === 'admin' ? t.supportChat.admin : t.supportChat.you}
                          </Typography>
                          <Typography 
                            sx={{ 
                              fontSize: '0.8rem', 
                              color: 'var(--chat-chrome-muted, var(--text-muted))',
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
                            color: 'var(--chat-chrome-muted, var(--text-muted))',
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
                        bgcolor: 'transparent',
                        borderTop: 'none',
                      }}
                    >
                      <ChatComposer
                        value={message}
                        onChange={(v) => {
                          setMessage(v);
                          if (!editingMessage) sendTypingIndicator();
                        }}
                        onSend={handleSendMessage}
                        onAttachImage={() => {
                          if (uploadingImage || editingMessage) return;
                          fileInputRef.current?.click();
                        }}
                        onSendSticker={editingMessage ? undefined : handleSendSticker}
                        onSendVoice={editingMessage ? undefined : handleSendVoice}
                        showMic={!editingMessage}
                        voiceLabels={{
                          recordVoice: t.supportChat.recordVoice,
                          sendVoice: t.supportChat.sendVoice,
                          cancelRecording: t.supportChat.cancelRecording,
                          stopRecording: t.supportChat.stopRecording,
                          voiceTooShort: t.supportChat.voiceTooShort,
                          micPermissionDenied: t.supportChat.micPermissionDenied,
                          micNotFound: t.supportChat.micNotFound,
                          micInUse: t.supportChat.micInUse,
                          micUnsupported: t.supportChat.micUnsupported,
                          micRecordUnsupported: t.supportChat.micRecordUnsupported,
                          micHttpsRequired: t.supportChat.micHttpsRequired,
                          micBlocked: t.supportChat.micBlocked,
                          micFailed: t.supportChat.micFailed,
                          micRecordFailed: t.supportChat.micRecordFailed,
                        }}
                        gifLabels={{
                          title: t.supportChat.gifTitle,
                          searchPlaceholder: t.supportChat.gifSearch,
                          uploadGif: t.supportChat.gifUpload,
                          trending: t.supportChat.gifTrending,
                          empty: t.supportChat.gifEmpty,
                          loadError: t.supportChat.gifLoadError,
                          missingKey: t.supportChat.gifMissingKey,
                          loading: t.supportChat.gifLoading,
                        }}
                        placeholder={editingMessage ? t.supportChat.editPlaceholder : t.supportChat.typeMessage}
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
                          background: 'var(--primary)',
                          py: 1.25,
                          fontWeight: 600,
                          borderRadius: 2,
                          textTransform: 'none',
                          boxShadow: '0 4px 14px color-mix(in srgb, var(--primary) 30%, transparent)',
                          '&:hover': { 
                            background: 'color-mix(in srgb, var(--primary) 88%, #000)',
                            boxShadow: '0 6px 20px color-mix(in srgb, var(--primary) 35%, transparent)',
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
          </Box>

          {/* Desktop / iPad info sidebar (Messenger-style) */}
          {isPage && !showHistory && !showNewChat && !showRating && (
            <Box
              sx={{
                display: { xs: 'none', md: 'flex' },
                width: 320,
                flexShrink: 0,
                flexDirection: 'column',
                minHeight: 0,
                borderLeft: '1px solid var(--chat-chrome-border, var(--glass-border))',
                bgcolor: 'var(--surface-2)',
              }}
            >
              <SupportChatSettingsPanel
                sidebar
                prefs={chatPrefs}
                onPrefsChange={updateChatPrefs}
                messages={chat?.messages || []}
                onBack={() => undefined}
                onChangeTheme={() => setShowThemePicker(true)}
                onMuteEnabled={() => {
                  if (pushSubscribed) void pushUnsubscribe();
                }}
                pushLoading={pushLoading}
                profile={{
                  name: displayAdminName,
                  avatarUrl: '/favicon.png',
                  status:
                    chat?.status === 'active'
                      ? `${t.supportChat.activeChats} - ${chat.admin_name || t.supportChat.admin}`
                      : chat?.status === 'pending'
                        ? t.supportChat.connecting
                        : t.supportChat.connected,
                }}
                labels={{
                  settingsTitle: t.supportChat.settingsTitle,
                  sectionCustomize: t.supportChat.sectionCustomize,
                  sectionMedia: t.supportChat.sectionMedia,
                  sectionPrivacy: t.supportChat.sectionPrivacy,
                  sectionHelp: t.supportChat.sectionHelp,
                  muteNotifications: t.supportChat.muteNotifications,
                  muteNotificationsDesc: t.supportChat.muteNotificationsDesc,
                  soundToggle: t.supportChat.soundToggle,
                  soundToggleDesc: t.supportChat.soundToggleDesc,
                  compactDensity: t.supportChat.compactDensity,
                  compactDensityDesc: t.supportChat.compactDensityDesc,
                  primaryBubbles: t.supportChat.primaryBubbles,
                  primaryBubblesDesc: t.supportChat.primaryBubblesDesc,
                  changeTheme: t.supportChat.changeTheme,
                  changeThemeDesc: t.supportChat.changeThemeDesc,
                  currentTheme: lang === 'en' ? chatTheme.nameEn : chatTheme.nameTh,
                  mediaGallery: t.supportChat.mediaGallery,
                  mediaGalleryDesc: t.supportChat.mediaGalleryDesc,
                  noMedia: t.supportChat.noMedia,
                  images: t.supportChat.images,
                  voiceMessages: t.supportChat.voiceMessages,
                  faqSupport: t.supportChat.faqSupport,
                  faqSupportDesc: t.supportChat.faqSupportDesc,
                  back: t.supportChat.settingsBack,
                  on: t.supportChat.on,
                  off: t.supportChat.off,
                }}
              />
            </Box>
          )}
        </Paper>
      </Fade>

      <ChatThemePicker
        open={showThemePicker}
        currentThemeId={chatPrefs.themeId}
        lang={lang === 'en' ? 'en' : 'th'}
        labels={{
          title: t.supportChat.themePickerTitle,
          cancel: t.supportChat.themeCancel,
          select: t.supportChat.themeSelect,
          previewOutgoing: t.supportChat.themePreviewOutgoing,
          previewIncoming: t.supportChat.themePreviewIncoming,
          close: t.supportChat.settingsBack,
        }}
        onClose={() => setShowThemePicker(false)}
        onSelect={(themeId: ChatThemeId) => {
          updateChatPrefs({ ...chatPrefs, themeId });
        }}
      />
    </>
  );
}
