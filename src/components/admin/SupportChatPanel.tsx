'use client';

import { apiFetch, uploadImageApi, uploadAudioApi } from '@/lib/api-client';
// src/components/admin/SupportChatPanel.tsx
// Admin Panel for Support Chat Management - Mobile Responsive with Typing & Read Receipts

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useNotification } from '../NotificationContext';
import { usePushNotification } from '@/hooks/usePushNotification';
import { useRealtimeChat, useRealtimeChatList } from '@/hooks/useRealtimeChat';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  Headphones as SupportAgentIcon,
  Send as SendIcon,
  User as PersonIcon,
  CheckCircle2 as CheckCircleIcon,
  Play as AcceptIcon,
  MessageCircle as ChatIcon,
  Star as StarIcon,
  RotateCcw as RefreshIcon,
  Circle as DotIcon,
  X as CloseIcon,
  Settings as SettingsIcon,
  ArrowLeft as ArrowBackIcon,
  CheckCheck as DoneAllIcon,
  Check as DoneIcon,
  Receipt as ReceiptIcon,
  Search as SearchIcon,
  Eye as ViewIcon,
  PanelRight,
  PanelRightClose,
  Loader2,
} from 'lucide-react';
import { ChatSettingsDialog } from '@/components/admin/ChatSettingsDialog';
import {
  CustomerContextPanel,
  ChatTextWithOrderLinks,
} from '@/components/admin/CustomerContextPanel';
import {
  DEFAULT_SUPPORT_CHAT_SETTINGS,
  normalizeSupportChatSettings,
  playNotificationTone,
  type SupportChatSettings,
} from '@/lib/support-chat-settings';
import { chatMessagesChanged, getDbTypingFromSession } from '@/lib/support-chat-typing';
import { fetchChatSync, mergeChatMessages, mergeNewestWindow, fetchOlderChatMessages, getChatPollIntervalMs } from '@/lib/support-chat-sync';
import { formatStickerMessage } from '@/lib/chat-stickers';
import { formatVoiceMessage, VOICE_DATA_URL_FALLBACK_MAX } from '@/lib/chat-voice';
import { parseChatMessage } from '@/lib/chat-message';

const TAB_KEYS = ['all', 'pending', 'my', 'closed'] as const;

interface ChatSession {
  id: string;
  customer_email: string;
  customer_name: string;
  customer_avatar?: string;
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
  created_at: string;
  is_read: boolean;
  read_at?: string;
}

interface ChatWithMessages extends ChatSession {
  messages: ChatMessage[];
}

interface ChatStats {
  pendingCount: number;
  activeCount: number;
  todayCount: number;
  avgRating: number;
}

function StarRating({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <StarIcon
          key={star}
          className={cn(
            'size-4',
            star <= value ? 'fill-amber-500 text-amber-500 dark:fill-amber-400 dark:text-amber-400' : 'text-muted-foreground/30'
          )}
        />
      ))}
    </div>
  );
}

function UnreadAvatarBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -top-1 -right-1 z-10 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white ring-2 ring-card">
      {count > 99 ? '99+' : count}
    </span>
  );
}

export default function SupportChatPanel({ selectedShopId }: { selectedShopId?: string }) {
  const { data: session } = useSession();
  const { warning: toastWarning, error: toastError } = useNotification();
  const { isSupported: pushSupported, isSubscribed: pushSubscribed, subscribe: pushSubscribe } = usePushNotification();

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 899px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const [loading, setLoading] = useState(true);
  const [loadingChatDetail, setLoadingChatDetail] = useState(false);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [stats, setStats] = useState<ChatStats | null>(null);
  const [selectedChat, setSelectedChat] = useState<ChatWithMessages | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadLabel, setUploadLabel] = useState('กำลังอัปโหลดรูปภาพ...');
  const [uploadFileCount, setUploadFileCount] = useState(1);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [fallbackTyping, setFallbackTyping] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [chatSettings, setChatSettings] = useState<SupportChatSettings>(DEFAULT_SUPPORT_CHAT_SETTINGS);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [transferAdmins, setTransferAdmins] = useState<{ email: string; name: string }[]>([]);
  const [transferToEmail, setTransferToEmail] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [focusOrderRef, setFocusOrderRef] = useState<string | null>(null);

  const scrollApiRef = useRef<ReturnType<typeof useMessageScroller> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const chatEtagRef = useRef<string | null>(null);
  const lastMessageAtRef = useRef<string | null>(null);
  const prevMessageCountRef = useRef<number>(0);
  const loadingOlderRef = useRef(false);
  const hasMoreOlderRef = useRef(false);
  const selectedChatRef = useRef<ChatWithMessages | null>(null);
  selectedChatRef.current = selectedChat;
  hasMoreOlderRef.current = hasMoreOlder;

  const {
    messages: realtimeMessages,
    setMessages: setRealtimeMessages,
    session: realtimeSession,
    connectionState,
    isOtherTyping: rtOtherTyping,
    typingDisplay,
    sendTyping: rtSendTyping,
    addOptimisticMessage,
    resolveOptimistic,
    broadcastRead,
  } = useRealtimeChat(
    selectedChat?.id || null,
    session?.user?.email || null,
    'admin'
  );

  const dbCustomerTyping = React.useMemo(() => {
    const source = (realtimeSession || selectedChat) as Record<string, unknown> | null;
    return getDbTypingFromSession(source).customerTyping;
  }, [realtimeSession, selectedChat]);

  const otherTyping = rtOtherTyping || fallbackTyping || dbCustomerTyping;

  const {
    sessions: realtimeSessions,
    connectionState: listConnectionState,
  } = useRealtimeChatList(session?.user?.email || null);

  const [orderLookupOpen, setOrderLookupOpen] = useState(false);
  const [orderSearchRef, setOrderSearchRef] = useState('');
  const [foundOrder, setFoundOrder] = useState<any>(null);
  const [searchingOrder, setSearchingOrder] = useState(false);
  const [customerOrders, setCustomerOrders] = useState<any[]>([]);
  const [loadingCustomerOrders, setLoadingCustomerOrders] = useState(false);
  const [contextPanelOpen, setContextPanelOpen] = useState(() => {
    if (typeof window === 'undefined') return true;
    try {
      return window.localStorage.getItem('support-chat-context-panel') !== '0';
    } catch {
      return true;
    }
  });
  const [adminNote, setAdminNote] = useState('');

  const [isTouchDevice, setIsTouchDevice] = useState(false);
  useEffect(() => {
    setIsTouchDevice(
      'ontouchstart' in window || navigator.maxTouchPoints > 0
    );
  }, []);

  const scrollToBottom = useCallback((force = false) => {
    // MessageScroller owns follow/hold; only re-engage live edge after explicit send
    if (!force) return;
    scrollApiRef.current?.scrollToEnd({ behavior: 'smooth' });
  }, []);

  const deepLinkHandledRef = useRef(false);
  useEffect(() => {
    if (deepLinkHandledRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const chatIdParam = params.get('chatId');
    if (chatIdParam) {
      deepLinkHandledRef.current = true;
      const url = new URL(window.location.href);
      url.searchParams.delete('chatId');
      window.history.replaceState({}, '', url.pathname + url.search + url.hash);
      fetchChatDetails(chatIdParam, true).then(() => {
        /* selectedChat + messages applied inside fetchChatDetails */
      });
      if (isMobile) setMobileShowChat(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchChats = useCallback(async (opts?: { includeStats?: boolean }) => {
    try {
      const filter = ['all', 'pending', 'my', 'closed'][tabValue];
      const shopParam = selectedShopId ? `&shopId=${encodeURIComponent(selectedShopId)}` : '';
      const statsParam = opts?.includeStats === false ? '&stats=0' : '';
      const res = await apiFetch('/api/admin/support-chat?filter=' + filter + shopParam + statsParam);
      const data = await res.json();
      if (data.chats) setChats(data.chats);
      if (data.stats) setStats(data.stats);
    } catch (error) {
      console.error('Error fetching chats:', error);
    }
  }, [tabValue, selectedShopId]);

  const fetchChatDetails = useCallback(async (chatId: string, markRead = false) => {
    try {
      const params = new URLSearchParams({ limit: '30' });
      if (markRead) params.set('markRead', 'true');
      const res = await apiFetch(`/api/support-chat/${chatId}?${params}`);
      const data = await res.json();
      if (data.chat) {
        setSelectedChat(data.chat);
        if (data.chat.messages) setRealtimeMessages(data.chat.messages || []);
        setHasMoreOlder(Boolean(data.hasMore));
      }
    } catch (error) {
      console.error('Error fetching chat details:', error);
    }
  }, [setRealtimeMessages]);

  const loadOlderMessages = useCallback(async () => {
    const chat = selectedChatRef.current;
    if (!chat?.id || loadingOlderRef.current || !hasMoreOlderRef.current) return;
    const oldest = chat.messages?.[0];
    if (!oldest) return;

    loadingOlderRef.current = true;
    setLoadingOlder(true);
    try {
      const page = await fetchOlderChatMessages<ChatMessage>(chat.id, {
        before: oldest.created_at,
        beforeId: oldest.id,
        limit: 30,
      });
      if (page.messages.length) {
        setSelectedChat((prev) => {
          if (!prev || prev.id !== chat.id) return prev;
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

  useEffect(() => {
    setLoading(true);
    fetchChats({ includeStats: true }).finally(() => setLoading(false));
  }, [fetchChats]);

  useEffect(() => {
    if (realtimeMessages.length > 0 && selectedChat) {
      setSelectedChat(prev => prev ? { ...prev, messages: realtimeMessages as ChatMessage[] } : prev);
    }
  }, [realtimeMessages]);

  useEffect(() => {
    if (realtimeSession && selectedChat) {
      setSelectedChat(prev => prev ? { ...prev, ...realtimeSession } : prev);
    }
  }, [realtimeSession]);

  useEffect(() => {
    if (realtimeSessions.length > 0) {
      setChats(prev => {
        const merged = [...prev];
        for (const rt of realtimeSessions) {
          const idx = merged.findIndex(c => c.id === rt.id);
          if (idx >= 0) {
            merged[idx] = { ...merged[idx], ...rt } as ChatSession;
          } else {
            merged.unshift(rt as ChatSession);
          }
        }
        return merged;
      });
    }
  }, [realtimeSessions]);

  useEffect(() => {
    if (!selectedChat?.id) return;
    if ((selectedChat.unread_count || 0) <= 0) {
      broadcastRead();
      return;
    }
    apiFetch('/api/support-chat/' + selectedChat.id + '/read', { method: 'POST' }).catch(() => {});
    broadcastRead();
  }, [selectedChat?.id, broadcastRead]);

  useEffect(() => {
    const isRealtimeUp = connectionState === 'connected' && listConnectionState === 'connected';
    const pollInterval = isRealtimeUp ? 60_000 : 8000;

    let cancelled = false;
    let tick = 0;
    const poll = async () => {
      if (cancelled || document.visibilityState === 'hidden') return;
      try {
        tick += 1;
        await fetchChats({ includeStats: tick % 5 === 0 });
      } catch {}
    };
    const interval = setInterval(poll, pollInterval);
    return () => { cancelled = true; clearInterval(interval); };
  }, [fetchChats, connectionState, listConnectionState]);

  useEffect(() => {
    if (!selectedChat?.id) return;
    if (selectedChat.status !== 'active' && selectedChat.status !== 'pending') return;

    lastMessageAtRef.current = selectedChat.messages?.[selectedChat.messages.length - 1]?.created_at ?? null;

    let cancelled = false;
    const chatId = selectedChat.id;
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
          let didUpdate = false;
          setSelectedChat((prev) => {
            if (!prev || prev.id !== chatId) return prev;
            const merged = mergeChatMessages(prev.messages, result.chat.messages || []);
            const changed =
              chatMessagesChanged(prev.messages, merged) ||
              result.chat.status !== prev.status;
            if (!changed) return prev;
            didUpdate = true;
            setRealtimeMessages(merged);
            lastMessageAtRef.current = merged[merged.length - 1]?.created_at ?? lastMessageAtRef.current;
            return { ...prev, ...result.chat, messages: merged };
          });
          if (didUpdate && (result.chat.unread_count || 0) > 0) {
            apiFetch('/api/support-chat/' + chatId + '/read', { method: 'POST' }).catch(() => {});
          }
          return;
        }

        const incoming = (result.chat.messages || []) as ChatMessage[];
        let didUpdate = false;
        setSelectedChat((prev) => {
          if (!prev || prev.id !== chatId) return prev;
          const merged = mergeNewestWindow(prev.messages, incoming);
          const changed =
            chatMessagesChanged(prev.messages, merged) ||
            result.chat.status !== prev.status;
          if (!changed) return prev;
          didUpdate = true;
          setRealtimeMessages(merged);
          lastMessageAtRef.current = merged[merged.length - 1]?.created_at ?? null;
          return { ...result.chat, messages: merged };
        });
        if (typeof result.hasMore === 'boolean' && !hasMoreOlderRef.current) {
          setHasMoreOlder(result.hasMore);
        }
        if (didUpdate && (result.chat.unread_count || 0) > 0) {
          apiFetch('/api/support-chat/' + chatId + '/read', { method: 'POST' }).catch(() => {});
        }
      } catch {}
    };

    refreshMessages();
    const interval = setInterval(
      refreshMessages,
      getChatPollIntervalMs(connectionState, 'messages')
    );
    return () => { cancelled = true; clearInterval(interval); };
  }, [selectedChat?.id, selectedChat?.status, setRealtimeMessages, connectionState]);

  useEffect(() => {
    if (!selectedChat?.id) return;

    const chatId = selectedChat.id;
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
          setSelectedChat((prev) => {
            if (!prev || prev.id !== chatId) return prev;
            const merged = mergeChatMessages(prev.messages, result.chat.messages || []);
            setRealtimeMessages(merged);
            lastMessageAtRef.current = merged[merged.length - 1]?.created_at ?? lastMessageAtRef.current;
            return { ...prev, ...result.chat, messages: merged };
          });
          return;
        }

        setSelectedChat((prev) => {
          if (!prev || prev.id !== chatId) return prev;
          const merged = mergeNewestWindow(prev.messages, result.chat.messages || []);
          setRealtimeMessages(merged);
          lastMessageAtRef.current = merged[merged.length - 1]?.created_at ?? null;
          return { ...result.chat, messages: merged };
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
  }, [selectedChat?.id, setRealtimeMessages]);

  useEffect(() => {
    if (!selectedChat?.id) return;
    if (selectedChat.status !== 'active' && selectedChat.status !== 'pending') return;
    if (connectionState === 'connected') return;

    const pollTyping = () => {
      if (document.visibilityState === 'hidden') return;
      apiFetch('/api/support-chat/' + selectedChat.id + '/typing')
        .then((res) => res.json())
        .then((data) => setFallbackTyping(data.isTyping || false))
        .catch(() => setFallbackTyping(false));
    };
    pollTyping();
    const interval = setInterval(
      pollTyping,
      getChatPollIntervalMs(connectionState, 'typing')
    );
    return () => clearInterval(interval);
  }, [selectedChat?.id, selectedChat?.status, connectionState]);

  useEffect(() => {
    if (selectedChat?.messages) {
      const currentCount = selectedChat.messages.length;
      if (prevMessageCountRef.current > 0 && currentCount > prevMessageCountRef.current) {
        const latestMsg = selectedChat.messages[selectedChat.messages.length - 1];
        if (latestMsg?.sender === 'customer') {
          if (chatSettings.notification_sound) {
            try {
              playNotificationTone(chatSettings.notification_sound_id);
            } catch {
              /* ignore */
            }
          }
          if (
            document.hidden &&
            chatSettings.notification_desktop &&
            typeof Notification !== 'undefined' &&
            Notification.permission === 'granted'
          ) {
            try {
              const notif = new Notification(`ข้อความใหม่จาก ${latestMsg.sender_name || 'ลูกค้า'}`, {
                body: latestMsg.message.substring(0, 100),
                icon: '/favicon.png',
                tag: `admin-chat-${selectedChat.id}`,
              });
              notif.onclick = () => {
                window.focus();
                notif.close();
              };
            } catch {
              // Notification may fail in some contexts
            }
          }
        }
      }
      prevMessageCountRef.current = currentCount;
    }
  }, [selectedChat?.messages?.length, chatSettings.notification_sound, chatSettings.notification_sound_id, chatSettings.notification_desktop, selectedChat?.id]);

  useEffect(() => {
    if (pushSupported && !pushSubscribed && session?.user?.email) {
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        pushSubscribe().catch(() => {});
      }
    }
  }, [pushSupported, pushSubscribed, session?.user?.email, pushSubscribe]);

  const sendTypingIndicator = useCallback(() => {
    const adminName = chatSettings.admin_display_name || session?.user?.name || 'แอดมิน';
    if (connectionState === 'connected') {
      rtSendTyping(true, adminName);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        rtSendTyping(false, adminName);
      }, 3000);
    } else if (selectedChat) {
      apiFetch('/api/support-chat/' + selectedChat.id + '/typing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isTyping: true }),
      }).catch(() => {});
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        if (selectedChat) {
          apiFetch('/api/support-chat/' + selectedChat.id + '/typing', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isTyping: false }),
          }).catch(() => {});
        }
      }, 3000);
    }
  }, [rtSendTyping, chatSettings.admin_display_name, session?.user?.name, connectionState, selectedChat?.id]);

  useEffect(() => {
    apiFetch('/api/support-chat/settings')
      .then(res => res.json())
      .then(data => {
        if (data.settings) setChatSettings(normalizeSupportChatSettings(data.settings));
      })
      .catch(() => {});

    apiFetch('/api/admin/support-chat?action=admins')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.admins)) setTransferAdmins(data.admins);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setTransferToEmail('');
  }, [selectedChat?.id]);

  const handleSelectChat = async (chatId: string) => {
    prevMessageCountRef.current = 0;
    setLoadingChatDetail(true);
    setHasMoreOlder(false);
    if (isMobile) setMobileShowChat(true);
    const preview = chats.find((c) => c.id === chatId);
    if (preview) {
      setSelectedChat({
        ...preview,
        messages: [],
      });
    }
    try {
      const res = await apiFetch(`/api/support-chat/${chatId}?markRead=true&limit=30`);
      const data = await res.json();
      if (data.chat) {
        setSelectedChat(data.chat);
        setRealtimeMessages(data.chat.messages || []);
        setHasMoreOlder(Boolean(data.hasMore));
      }
      fetchChats();
      broadcastRead();
    } finally {
      setLoadingChatDetail(false);
    }
  };

  const handleMobileBack = () => {
    setMobileShowChat(false);
    setSelectedChat(null);
    prevMessageCountRef.current = 0;
  };

  const handleSaveSettings = async () => {
    setSettingsSaving(true);
    try {
      const res = await apiFetch('/api/support-chat/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chatSettings),
      });
      const data = await res.json();
      if (data.settings) setChatSettings(normalizeSupportChatSettings(data.settings));
      setSettingsOpen(false);
    } catch (error) {
      console.error('Error saving settings:', error);
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleAcceptChat = async (chatId: string, options?: { force?: boolean }) => {
    try {
      const res = await apiFetch('/api/support-chat/' + chatId + '/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: Boolean(options?.force) }),
      });
      const data = await res.json();
      if (data.chat) {
        await fetchChats();
        const detailRes = await apiFetch(`/api/support-chat/${chatId}?limit=30`);
        const detailData = await detailRes.json();
        if (detailData.chat) {
          setSelectedChat(detailData.chat);
          setRealtimeMessages(detailData.chat.messages || []);
          setHasMoreOlder(Boolean(detailData.hasMore));
        }
      }
    } catch (error) {
      console.error('Error accepting chat:', error);
    }
  };

  const handleTransferChat = async () => {
    if (!selectedChat || !transferToEmail) return;
    setTransferring(true);
    try {
      const target = transferAdmins.find((a) => a.email === transferToEmail);
      const res = await apiFetch(`/api/support-chat/${selectedChat.id}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toEmail: transferToEmail,
          toName: target?.name,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error('Transfer failed:', data?.error);
        return;
      }
      if (data.chat) {
        setTransferToEmail('');
        await fetchChats();
        const detailRes = await apiFetch(`/api/support-chat/${selectedChat.id}?limit=30`);
        const detailData = await detailRes.json();
        if (detailData.chat) {
          setSelectedChat(detailData.chat);
          setRealtimeMessages(detailData.chat.messages || []);
          setHasMoreOlder(Boolean(detailData.hasMore));
        }
      }
    } catch (error) {
      console.error('Error transferring chat:', error);
    } finally {
      setTransferring(false);
    }
  };

  const handleCloseChat = async () => {
    if (!selectedChat) return;
    try {
      const res = await apiFetch('/api/support-chat/' + selectedChat.id + '/close', { method: 'POST' });
      const data = await res.json();
      if (data.chat) {
        await fetchChats();
        setSelectedChat(null);
        if (isMobile) setMobileShowChat(false);
      }
    } catch (error) {
      console.error('Error closing chat:', error);
    }
  };

  const handleSendMessage = async (overrideText?: string) => {
    if (previewImage && !overrideText) { await handleSendWithImage(); return; }
    if (!selectedChat) return;
    const msgText = (overrideText ?? message).trim();
    if (!msgText) return;

    const tempId = `opt_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    addOptimisticMessage(tempId, msgText, session?.user?.name || chatSettings.admin_display_name, session?.user?.image || undefined);
    setMessage('');
    rtSendTyping(false, chatSettings.admin_display_name || 'แอดมิน');
    scrollToBottom(true);

    setSending(true);
    try {
      const res = await apiFetch('/api/support-chat/' + selectedChat.id + '/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msgText }),
      });
      const data = await res.json();
      if (data.success && data.message) {
        resolveOptimistic(tempId, data.message);
      } else {
        resolveOptimistic(tempId, null);
      }
    } catch {
      resolveOptimistic(tempId, null);
    } finally {
      setSending(false);
    }
  };

  const handleQuickReply = (reply: string) => {
    void handleSendMessage(reply);
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
    if (!selectedChat || sending || uploadingImage) return;

    // Built-in / remote Giphy GIF — send path directly (animated)
    if (src.startsWith('/chat-stickers/') || /^https?:\/\//i.test(src)) {
      const msgContent = formatStickerMessage(src);
      const tempId = `opt_sticker_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      addOptimisticMessage(
        tempId,
        msgContent,
        session?.user?.name || chatSettings.admin_display_name,
        session?.user?.image || undefined
      );
      scrollToBottom(true);
      setSending(true);
      try {
        const res = await apiFetch(`/api/support-chat/${selectedChat.id}/message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: msgContent }),
        });
        const data = await res.json();
        if (data.success && data.message) resolveOptimistic(tempId, data.message);
        else resolveOptimistic(tempId, null);
      } catch {
        resolveOptimistic(tempId, null);
      } finally {
        setSending(false);
      }
      return;
    }

    // Custom GIF/WebP (data URL) — upload then send
    if (src.startsWith('data:')) {
      const controller = beginUpload('กำลังอัปโหลดสติกเกอร์...', 1);
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
        if (!uploadRes.ok) throw new Error('upload failed');
        const uploadData = await uploadRes.json();
        if (uploadData.status !== 'success' || !uploadData.data?.url) throw new Error('upload failed');
        setUploadProgress(100);
        const imageUrl = uploadData.data.url;
        const msgContent = formatStickerMessage(imageUrl);
        const tempId = `opt_sticker_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        addOptimisticMessage(
          tempId,
          msgContent,
          session?.user?.name || chatSettings.admin_display_name,
          session?.user?.image || undefined
        );
        scrollToBottom(true);
        const res = await apiFetch(`/api/support-chat/${selectedChat.id}/message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: msgContent }),
        });
        const data = await res.json();
        if (data.success && data.message) resolveOptimistic(tempId, data.message);
        else resolveOptimistic(tempId, null);
      } catch (error: any) {
        if (error?.name !== 'AbortError') {
          toastError('ส่งสติกเกอร์ไม่สำเร็จ');
        }
      } finally {
        endUpload();
      }
    }
  };

  const handleSendVoice = async (payload: { base64: string; mime: string; duration: number }) => {
    if (!selectedChat || sending || uploadingImage) return;
    const controller = beginUpload('กำลังอัปโหลดเสียง...', 1);
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
        throw new Error('อัปโหลดเสียงไม่สำเร็จ (ไฟล์ใหญ่เกินไป)');
      }

      setUploadProgress(100);
      const msgContent = formatVoiceMessage(voiceUrl, voiceDuration);
      const tempId = `opt_voice_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      addOptimisticMessage(
        tempId,
        msgContent,
        session?.user?.name || chatSettings.admin_display_name,
        session?.user?.image || undefined
      );
      scrollToBottom(true);
      const res = await apiFetch(`/api/support-chat/${selectedChat.id}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msgContent }),
      });
      const data = await res.json();
      if (data.success && data.message) resolveOptimistic(tempId, data.message);
      else {
        resolveOptimistic(tempId, null);
        toastError(data?.error || 'ส่งข้อความเสียงไม่สำเร็จ');
      }
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        toastError(error?.message || 'ส่งข้อความเสียงไม่สำเร็จ');
      }
    } finally {
      endUpload();
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toastWarning('กรุณาเลือกไฟล์รูปภาพเท่านั้น'); return; }
    if (file.size > 5 * 1024 * 1024) { toastWarning('ไฟล์ต้องมีขนาดไม่เกิน 5MB'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => setPreviewImage(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSendWithImage = async () => {
    if (!previewImage || !selectedChat || uploadingImage) return;
    const caption = message.trim();
    const imageData = previewImage;
    const controller = beginUpload('กำลังอัปโหลดรูปภาพ...', 1);
    setPreviewImage(null);
    setMessage('');

    try {
      const mimeMatch = imageData.match(/data:([^;]+);/);
      const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      const ext = mime.split('/')[1] || 'jpg';
      const uploadRes = await uploadImageApi(
        {
          base64: imageData,
          filename: 'admin_chat_' + Date.now() + '.' + ext,
          mime,
        },
        {
          signal: controller.signal,
          onProgress: setUploadProgress,
        }
      );
      if (!uploadRes.ok) {
        throw new Error(`อัปโหลดล้มเหลว (HTTP ${uploadRes.status})`);
      }
      let uploadData;
      try {
        uploadData = await uploadRes.json();
      } catch {
        throw new Error('เซิร์ฟเวอร์ตอบกลับผิดปกติ กรุณาลองใหม่');
      }
      if (uploadData.status === 'success' && uploadData.data?.url) {
        setUploadProgress(100);
        const imageUrl = uploadData.data.url;
        const finalMsg = caption ? caption + '\n[รูปภาพ: ' + imageUrl + ']' : '[รูปภาพ: ' + imageUrl + ']';
        const tempId = `opt_img_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        addOptimisticMessage(
          tempId,
          finalMsg,
          session?.user?.name || chatSettings.admin_display_name,
          session?.user?.image || undefined
        );
        scrollToBottom(true);
        const res = await apiFetch('/api/support-chat/' + selectedChat.id + '/message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: finalMsg }),
        });
        const data = await res.json();
        if (data.success && data.message) {
          resolveOptimistic(tempId, data.message);
        } else {
          resolveOptimistic(tempId, null);
        }
      } else {
        toastError('ไม่สามารถอัปโหลดรูปภาพได้');
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        // cancelled by user
      } else {
        console.error('Error uploading image:', error);
        toastError(error?.message || 'เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ');
      }
    } finally {
      endUpload();
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const formatClock = (dateString: string) =>
    new Date(dateString).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 60000) return 'เมื่อสักครู่';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' นาทีที่แล้ว';
    if (diff < 86400000) return Math.floor(diff / 3600000) + ' ชั่วโมงที่แล้ว';
    return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#d97706'; // amber-600
      case 'active': return '#059669'; // emerald-600
      case 'closed': return '#475569'; // slate-600
      default: return '#64748b';
    }
  };

  const getChatStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-amber-50 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400';
      case 'active':
        return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400';
      case 'closed':
        return 'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300';
      default:
        return 'bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-muted-foreground';
    }
  };

  const getOrderStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'CANCELLED':
      case 'cancelled':
        return 'bg-red-50 text-red-700 dark:bg-red-500/20 dark:text-red-400';
      case 'COMPLETED':
      case 'PAID':
      case 'SHIPPED':
      case 'completed':
        return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400';
      case 'PENDING':
      case 'pending':
      default:
        return 'bg-amber-50 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'รอรับ';
      case 'active': return 'สนทนา';
      case 'closed': return 'ปิด';
      default: return status;
    }
  };

  const parseMessage = parseChatMessage;

  const handleSearchOrder = async () => {
    if (!orderSearchRef.trim()) return;
    setSearchingOrder(true);
    setFoundOrder(null);
    try {
      const res = await apiFetch(`/api/admin/orders?ref=${encodeURIComponent(orderSearchRef.trim())}`);
      const data = await res.json();
      if (data.status === 'success' && data.data) {
        setFoundOrder(data.data);
      } else {
        setFoundOrder({ notFound: true });
      }
    } catch (error) {
      console.error('Error searching order:', error);
      setFoundOrder({ error: true });
    } finally {
      setSearchingOrder(false);
    }
  };

  const fetchCustomerOrders = async (email: string) => {
    if (!email) return;
    setLoadingCustomerOrders(true);
    try {
      const res = await apiFetch(`/api/admin/orders?email=${encodeURIComponent(email)}&limit=50`);
      const data = await res.json();
      if (data.status === 'success' && Array.isArray(data.data)) {
        setCustomerOrders(data.data);
      } else {
        setCustomerOrders([]);
      }
    } catch (error) {
      console.error('Error fetching customer orders:', error);
      setCustomerOrders([]);
    } finally {
      setLoadingCustomerOrders(false);
    }
  };

  useEffect(() => {
    if (!selectedChat?.id) {
      setAdminNote('');
      return;
    }
    try {
      setAdminNote(window.localStorage.getItem(`support-chat-note:${selectedChat.id}`) || '');
    } catch {
      setAdminNote('');
    }
    void fetchCustomerOrders(selectedChat.customer_email);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per chat id
  }, [selectedChat?.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        !!target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      if (e.altKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault();
        if (!chats.length) return;
        const idx = selectedChat ? chats.findIndex((c) => c.id === selectedChat.id) : -1;
        const next =
          e.key === 'ArrowDown'
            ? Math.min(chats.length - 1, Math.max(0, idx + 1))
            : Math.max(0, idx <= 0 ? 0 : idx - 1);
        const chat = chats[next];
        if (chat && chat.id !== selectedChat?.id) void handleSelectChat(chat.id);
        return;
      }

      if (e.altKey && (e.key === 'c' || e.key === 'C') && !typing) {
        e.preventDefault();
        if (selectedChat?.status === 'active') void handleCloseChat();
        return;
      }

      if (e.altKey && (e.key === 'i' || e.key === 'I') && !typing) {
        e.preventDefault();
        setContextPanelOpen((v) => {
          const next = !v;
          try {
            window.localStorage.setItem('support-chat-context-panel', next ? '1' : '0');
          } catch {
            /* ignore */
          }
          return next;
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chats, selectedChat?.id, selectedChat?.status]);

  const persistAdminNote = (chatId: string, note: string) => {
    setAdminNote(note);
    try {
      window.localStorage.setItem(`support-chat-note:${chatId}`, note);
    } catch {
      /* ignore */
    }
  };

  const toggleContextPanel = () => {
    setContextPanelOpen((v) => {
      const next = !v;
      try {
        window.localStorage.setItem('support-chat-context-panel', next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const handleSendOrderToChat = async (order: any) => {
    if (!selectedChat || selectedChat.status !== 'active') return;
    const orderMsg = `*ออเดอร์ #${order.ref}*
ยอด: ฿${order.totalAmount?.toLocaleString() || order.amount?.toLocaleString() || 0}
วันที่: ${new Date(order.date || order.createdAt).toLocaleDateString('th-TH')}
สถานะ: ${getOrderStatusLabel(order.status)}
[ORDER_REF:${order.ref}]`;

    setSending(true);
    const tempId = `opt_order_${Date.now()}`;
    addOptimisticMessage(tempId, orderMsg, session?.user?.name || chatSettings.admin_display_name, session?.user?.image || undefined);
    scrollToBottom(true);

    try {
      const res = await apiFetch('/api/support-chat/' + selectedChat.id + '/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: orderMsg }),
      });
      const data = await res.json();
      if (data.success && data.message) {
        resolveOptimistic(tempId, data.message);
      } else {
        resolveOptimistic(tempId, null);
      }
    } catch (error) {
      console.error('Error sending order ref:', error);
      resolveOptimistic(tempId, null);
    } finally {
      setSending(false);
      setOrderLookupOpen(false);
    }
  };

  const handleSendTrackingUpdate = async (order: any) => {
    if (!selectedChat || selectedChat.status !== 'active') return;
    const tracking = order.trackingNumber || order.tracking_number || '';
    const provider = order.shippingProvider || order.shipping_provider || '';
    const items = Array.isArray(order.cart)
      ? order.cart
          .slice(0, 3)
          .map((item: any) => {
            const name = item?.productName || item?.name || 'สินค้า';
            const size = item?.size ? ` (${item.size})` : '';
            const qty = item?.quantity ?? item?.qty;
            return `- ${name}${size}${qty ? ` x${qty}` : ''}`;
          })
          .join('\n')
      : '';

    const orderMsg = `📦 อัปเดตสถานะออเดอร์ #${order.ref}
สถานะ: ${getOrderStatusLabel(order.status)}
${items ? `รายการ:\n${items}\n` : ''}ยอดรวม: ฿${(order.totalAmount || order.amount || 0).toLocaleString()}
${tracking ? `เลขพัสดุ: ${tracking}` : 'เลขพัสดุ: ยังไม่มี'}
${provider ? `ผู้ให้บริการ: ${provider}` : ''}
[ORDER_REF:${order.ref}]`.trim();

    setSending(true);
    const tempId = `opt_track_${Date.now()}`;
    addOptimisticMessage(
      tempId,
      orderMsg,
      session?.user?.name || chatSettings.admin_display_name,
      session?.user?.image || undefined
    );
    scrollToBottom(true);

    try {
      const res = await apiFetch('/api/support-chat/' + selectedChat.id + '/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: orderMsg }),
      });
      const data = await res.json();
      if (data.success && data.message) {
        resolveOptimistic(tempId, data.message);
      } else {
        resolveOptimistic(tempId, null);
      }
    } catch (error) {
      console.error('Error sending tracking update:', error);
      resolveOptimistic(tempId, null);
    } finally {
      setSending(false);
    }
  };

  const focusOrderInPanel = (ref: string) => {
    const clean = ref.replace(/^#/, '').trim();
    if (!clean) return;
    setContextPanelOpen(true);
    try {
      window.localStorage.setItem('support-chat-context-panel', '1');
    } catch {
      /* ignore */
    }
    setFocusOrderRef(clean);
  };

  const getOrderStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'PENDING': 'รอดำเนินการ',
      'PAID': 'ชำระแล้ว',
      'PROCESSING': 'กำลังดำเนินการ',
      'READY': 'พร้อมรับ',
      'SHIPPED': 'จัดส่งแล้ว',
      'COMPLETED': 'เสร็จสิ้น',
      'CANCELLED': 'ยกเลิก',
    };
    return labels[status?.toUpperCase()] || status;
  };

  return (
    <>
      <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleImageSelect} />

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes chat-pulse {
          0% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.4); }
          70% { box-shadow: 0 0 0 20px rgba(37, 99, 235, 0); }
          100% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0); }
        }
      `}</style>

      <Dialog open={orderLookupOpen} onOpenChange={setOrderLookupOpen}>
        <DialogContent className="max-w-lg bg-card text-foreground">
          <DialogHeader className="border-b border-border pb-4">
            <DialogTitle className="flex items-center gap-2">
              <ReceiptIcon className="size-6 text-blue-600" />
              ค้นหาออเดอร์ / ดูประวัติลูกค้า
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <p className="text-sm text-[var(--text-muted)]">ค้นหาจากหมายเลขออเดอร์</p>
            <div className="flex gap-2">
              <Input
                placeholder="เช่น ABC123"
                value={orderSearchRef}
                onChange={(e) => setOrderSearchRef(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSearchOrder(); }}
                className="bg-[var(--surface)]"
              />
              <Button
                onClick={handleSearchOrder}
                disabled={searchingOrder || !orderSearchRef.trim()}
                className="min-w-20 bg-blue-600 hover:bg-blue-700"
              >
                {searchingOrder ? <Loader2 className="size-5 animate-spin" /> : <SearchIcon className="size-5" />}
              </Button>
            </div>

            {foundOrder && (
              <div className="rounded-lg bg-[var(--surface)] p-4">
                {foundOrder.notFound ? (
                  <p className="text-center text-red-400">ไม่พบออเดอร์ &quot;{orderSearchRef}&quot;</p>
                ) : foundOrder.error ? (
                  <p className="text-center text-red-400">เกิดข้อผิดพลาดในการค้นหา</p>
                ) : (
                  <div>
                    <div className="mb-3 flex items-center gap-2">
                      <div className="flex size-10 items-center justify-center rounded-md bg-blue-600 text-xs font-bold text-white">
                        #{foundOrder.ref?.slice(-3)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">ออเดอร์ #{foundOrder.ref}</p>
                        <p className="text-xs text-[var(--text-muted)]">
                          {foundOrder.customerName || foundOrder.name} · {foundOrder.customerEmail || foundOrder.email}
                        </p>
                      </div>
                      <Badge className={cn('text-[0.7rem]', getOrderStatusBadgeClass(foundOrder.status))}>
                        {getOrderStatusLabel(foundOrder.status)}
                      </Badge>
                    </div>
                    <div className="mb-3 flex flex-wrap gap-2 text-sm text-[var(--text-muted)]">
                      <span>฿{foundOrder.totalAmount?.toLocaleString() || foundOrder.amount?.toLocaleString()}</span>
                      <span>{new Date(foundOrder.date || foundOrder.createdAt).toLocaleDateString('th-TH')}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(`/admin/orders?ref=${foundOrder.ref}`, '_blank')}
                      >
                        <ViewIcon className="size-4" />
                        ดูรายละเอียด
                      </Button>
                      <Button
                        size="sm"
                        className="bg-emerald-600 text-xs text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600"
                        onClick={() => handleSendOrderToChat(foundOrder)}
                        disabled={!selectedChat || selectedChat.status !== 'active'}
                      >
                        <SendIcon className="size-4" />
                        ส่งในแชท
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {selectedChat && (
              <>
                <Separator />
                <div className="flex items-center justify-between">
                  <p className="text-sm text-[var(--text-muted)]">
                    ประวัติออเดอร์ของ {selectedChat.customer_name}
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => fetchCustomerOrders(selectedChat.customer_email)}
                    disabled={loadingCustomerOrders}
                    className="text-blue-600"
                  >
                    {loadingCustomerOrders ? <Loader2 className="size-4 animate-spin" /> : <RefreshIcon className="size-4" />}
                  </Button>
                </div>
                <div className="max-h-[200px] overflow-y-auto">
                  {customerOrders.length === 0 ? (
                    <p className="py-4 text-center text-sm text-[var(--text-muted)]">
                      {loadingCustomerOrders ? 'กำลังโหลด...' : 'กดปุ่มรีเฟรชเพื่อโหลดประวัติ'}
                    </p>
                  ) : (
                    customerOrders.map((order) => (
                      <div
                        key={order.ref}
                        className="mb-2 flex cursor-pointer items-center gap-2 rounded-md bg-[var(--surface)] p-3 hover:bg-blue-600/10"
                        onClick={() => handleSendOrderToChat(order)}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold">
                            #{order.ref} · ฿{order.totalAmount?.toLocaleString() || order.amount?.toLocaleString()}
                          </p>
                          <p className="text-xs text-[var(--text-muted)]">
                            {new Date(order.date || order.createdAt).toLocaleDateString('th-TH')} · {order.status}
                          </p>
                        </div>
                        <SendIcon className="size-4 shrink-0 text-blue-600" />
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          <DialogFooter className="border-t border-border pt-4">
            <Button variant="ghost" onClick={() => setOrderLookupOpen(false)} className="text-[var(--text-muted)]">
              ปิด
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className={cn(
        'flex min-h-[400px] gap-0 overflow-hidden rounded-xl bg-slate-50 dark:bg-[#090D16]',
        isMobile ? 'h-[calc(100vh-120px)]' : 'h-[calc(100vh-200px)]'
      )}>
        {/* Chat List Panel */}
        <div className={cn(
          'flex min-h-0 shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-white dark:border-white/5 dark:bg-[#0c1220]',
          isMobile ? 'w-full border-r-0' : 'w-[300px]',
          isMobile && mobileShowChat && 'hidden'
        )}>
          <div className="border-b border-slate-200 p-4 dark:border-white/5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center text-sm font-bold sm:text-base">
                <SupportAgentIcon className="mr-2 size-6" />
                แชทสนับสนุน
                <span
                  className={cn(
                    'ml-2 inline-block size-2 rounded-full align-middle',
                    listConnectionState === 'connected' && 'bg-[#30d158] shadow-[0_0_4px_#30d158]',
                    listConnectionState === 'connecting' && 'animate-[pulse-dot_1.2s_ease-in-out_infinite] bg-[#ff9f0a]',
                    listConnectionState !== 'connected' && listConnectionState !== 'connecting' && 'bg-[#ff453a]'
                  )}
                  title={
                    listConnectionState === 'connected' ? 'เชื่อมต่อแบบ Realtime'
                      : listConnectionState === 'connecting' ? 'กำลังเชื่อมต่อ...'
                      : 'ไม่ได้เชื่อมต่อ'
                  }
                />
              </h2>
              <div className="flex items-center">
                <Button variant="ghost" size="icon-sm" onClick={() => setSettingsOpen(true)} className="text-[var(--text-muted)]">
                  <SettingsIcon className="size-[18px]" />
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={() => fetchChats()} className="text-[var(--text-muted)]">
                  <RefreshIcon className="size-[18px]" />
                </Button>
              </div>
            </div>
            {stats ? (
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-amber-50 text-[0.7rem] font-medium text-amber-700 dark:bg-amber-400/10 dark:text-amber-400">
                  <DotIcon className="size-2.5 fill-amber-600 text-amber-600 dark:fill-amber-400 dark:text-amber-400" />
                  รอ {stats.pendingCount}
                </Badge>
                <Badge className="bg-emerald-50 text-[0.7rem] font-medium text-emerald-700 dark:bg-green-500/10 dark:text-green-500">
                  <DotIcon className="size-2.5 fill-emerald-600 text-emerald-600 dark:fill-green-500 dark:text-green-500" />
                  Active {stats.activeCount}
                </Badge>
                {stats.avgRating > 0 && (
                  <Badge className="bg-amber-50 text-[0.7rem] font-medium text-amber-700 dark:bg-amber-400/10 dark:text-amber-400">
                    <StarIcon className="size-3 fill-amber-600 text-amber-600 dark:fill-amber-400 dark:text-amber-400" />
                    {stats.avgRating.toFixed(1)}
                  </Badge>
                )}
              </div>
            ) : loading ? (
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-5 w-14 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-12 rounded-full" />
              </div>
            ) : null}
          </div>

          <Tabs
            value={TAB_KEYS[tabValue]}
            onValueChange={(v) => setTabValue(TAB_KEYS.indexOf(v as typeof TAB_KEYS[number]))}
            className="flex min-h-0 flex-1 flex-col gap-0"
          >
            <TabsList variant="line" className="h-9 w-full shrink-0 rounded-none border-b border-slate-200 bg-transparent p-0 dark:border-white/5">
              <TabsTrigger value="all" className="min-h-9 flex-1 px-0.5 text-[0.7rem] after:bg-blue-600 data-[state=active]:text-blue-600 dark:after:bg-sky-400 dark:data-[state=active]:text-sky-400">
                ทั้งหมด
              </TabsTrigger>
              <TabsTrigger value="pending" className="relative min-h-9 flex-1 px-0.5 text-[0.7rem] after:bg-blue-600 data-[state=active]:text-blue-600 dark:after:bg-sky-400 dark:data-[state=active]:text-sky-400">
                รอรับ
                {(stats?.pendingCount ?? 0) > 0 && (
                  <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-600 px-1 text-[10px] font-bold text-white dark:bg-amber-500">
                    {stats!.pendingCount > 99 ? '99+' : stats!.pendingCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="my" className="min-h-9 flex-1 px-0.5 text-[0.7rem] after:bg-blue-600 data-[state=active]:text-blue-600 dark:after:bg-sky-400 dark:data-[state=active]:text-sky-400">
                ของฉัน
              </TabsTrigger>
              <TabsTrigger value="closed" className="min-h-9 flex-1 px-0.5 text-[0.7rem] after:bg-blue-600 data-[state=active]:text-blue-600 dark:after:bg-sky-400 dark:data-[state=active]:text-sky-400">
                ปิด
              </TabsTrigger>
            </TabsList>

            <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex flex-col">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-3 border-b border-slate-100 px-4 py-3 dark:border-border/60">
                    <Skeleton className="size-10 shrink-0 rounded-full" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="ml-auto h-4 w-10 rounded-full" />
                      </div>
                      <Skeleton className="h-3 w-[80%] max-w-[200px]" />
                      <Skeleton className="h-2.5 w-16" />
                    </div>
                  </div>
                ))}
              </div>
            ) : chats.length === 0 ? (
              <div className="p-6 text-center">
                <ChatIcon className="mx-auto mb-2 size-12 text-[var(--text-muted)]" />
                <p className="text-[var(--text-muted)]">ไม่มีแชท</p>
              </div>
            ) : (
              <div className="flex flex-col justify-start">
                {chats.map((chat) => (
                  <React.Fragment key={chat.id}>
                    <button
                      type="button"
                      onClick={() => handleSelectChat(chat.id)}
                      className={cn(
                        'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.04]',
                        selectedChat?.id === chat.id && 'bg-blue-50 dark:bg-white/[0.06]'
                      )}
                    >
                      <div className="relative shrink-0">
                        <Avatar className="size-10">
                          {chat.customer_avatar && (
                            <AvatarImage src={chat.customer_avatar} alt={chat.customer_name} />
                          )}
                          <AvatarFallback style={{ backgroundColor: getStatusColor(chat.status) }}>
                            <PersonIcon className="size-4 text-white" />
                          </AvatarFallback>
                        </Avatar>
                        <UnreadAvatarBadge count={chat.unread_count} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <p className={cn(
                            'flex-1 truncate text-sm',
                            chat.unread_count > 0 ? 'font-bold' : 'font-medium'
                          )}>
                            {chat.customer_name}
                          </p>
                          <Badge className={cn('h-4 px-1 text-[0.55rem]', getChatStatusBadgeClass(chat.status))}>
                            {getStatusLabel(chat.status)}
                          </Badge>
                        </div>
                        <p className="truncate text-xs text-[var(--text-muted)]">
                          {chat.last_message_preview || chat.subject}
                        </p>
                        <p className="mt-0.5 text-[0.65rem] text-[var(--text-muted)]">
                          {formatTime(chat.last_message_at || chat.created_at)}
                        </p>
                      </div>
                    </button>
                    <Separator className="bg-slate-200 dark:bg-white/5" />
                  </React.Fragment>
                ))}
              </div>
            )}
            </div>
          </Tabs>
        </div>

        {/* Chat Detail Panel */}
        <div className={cn(
          'flex min-h-0 flex-1 flex-col overflow-hidden bg-white dark:bg-[#111827]',
          isMobile && !mobileShowChat && 'hidden'
        )}>
          {selectedChat ? (
            <>
              <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-2.5 dark:border-white/5">
                {isMobile && (
                  <Button variant="ghost" size="icon-sm" onClick={handleMobileBack} className="mr-1">
                    <ArrowBackIcon />
                  </Button>
                )}
                <Avatar className="size-9">
                  {selectedChat.customer_avatar && (
                    <AvatarImage src={selectedChat.customer_avatar} alt={selectedChat.customer_name} />
                  )}
                  <AvatarFallback style={{ backgroundColor: getStatusColor(selectedChat.status) }}>
                    <PersonIcon className="size-4 text-white" />
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{selectedChat.customer_name}</p>
                  <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <span
                      className={cn(
                        'size-1.5 shrink-0 rounded-full',
                        connectionState === 'connected' && 'bg-[#30d158]',
                        connectionState === 'connecting' && 'bg-[#ff9f0a]',
                        connectionState !== 'connected' && connectionState !== 'connecting' && 'bg-[#ff453a]'
                      )}
                    />
                    {otherTyping
                      ? (typingDisplay || 'ลูกค้ากำลังพิมพ์...')
                      : selectedChat.subject}
                  </p>
                </div>
                {!isMobile && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={toggleContextPanel}
                    className="text-muted-foreground"
                    title="แผงข้อมูลลูกค้า (Alt+I)"
                  >
                    {contextPanelOpen ? <PanelRightClose className="size-4" /> : <PanelRight className="size-4" />}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => {
                    setOrderLookupOpen(true);
                    setFoundOrder(null);
                    setOrderSearchRef('');
                    fetchCustomerOrders(selectedChat.customer_email);
                  }}
                  className="text-emerald-600 hover:bg-emerald-50 dark:text-emerald-500 dark:hover:bg-emerald-500/10"
                  title="ค้นหาออเดอร์"
                >
                  <ReceiptIcon className="size-5" />
                </Button>
                {selectedChat.status === 'pending' && (
                  <Button
                    size="sm"
                    onClick={() => handleAcceptChat(selectedChat.id)}
                    className="bg-emerald-600 text-xs hover:bg-emerald-700"
                  >
                    <AcceptIcon className="size-4" />
                    รับเคส
                  </Button>
                )}
                {selectedChat.status === 'active' &&
                  selectedChat.admin_email &&
                  selectedChat.admin_email.toLowerCase() !== (session?.user?.email || '').toLowerCase() && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAcceptChat(selectedChat.id, { force: true })}
                    className="border-blue-200 text-xs text-blue-700 hover:bg-blue-50 dark:border-blue-500/30 dark:text-blue-300 dark:hover:bg-blue-500/10"
                  >
                    <AcceptIcon className="size-4" />
                    โอนเคสมาให้ฉัน
                  </Button>
                )}
                {selectedChat.status === 'active' && !selectedChat.admin_email && (
                  <Button
                    size="sm"
                    onClick={() => handleAcceptChat(selectedChat.id, { force: true })}
                    className="bg-emerald-600 text-xs hover:bg-emerald-700"
                  >
                    <AcceptIcon className="size-4" />
                    รับเคส
                  </Button>
                )}
                {selectedChat.status === 'active' &&
                  selectedChat.admin_email &&
                  selectedChat.admin_email.toLowerCase() === (session?.user?.email || '').toLowerCase() && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCloseChat}
                    className="text-xs text-muted-foreground hover:bg-slate-100 dark:hover:bg-white/5"
                    title="ปิดแชท (Alt+C)"
                  >
                    <CheckCircleIcon className="size-4" />
                    ปิด
                  </Button>
                )}
                {selectedChat.status === 'closed' && selectedChat.rating && (
                  <StarRating value={selectedChat.rating} />
                )}
              </div>

              <div className="flex min-h-0 flex-1">
              <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <MessageScrollerProvider
                key={selectedChat.id}
                autoScroll
                defaultScrollPosition="last-anchor"
                scrollPreviousItemPeek={48}
              >
                <MessageScrollerApiBridge apiRef={scrollApiRef} />
                <MessageScroller className="min-h-0 flex-1 bg-slate-50/80 dark:bg-[#111827]">
                  <MessageScrollerViewport>
                    <MessageScrollerContent className="gap-1 px-4 py-3">
                {loadingChatDetail ? (
                  <div className="flex flex-col gap-3 py-1">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={cn(
                          'flex items-end gap-2',
                          i % 2 === 1 ? 'flex-row-reverse' : 'flex-row',
                        )}
                      >
                        <Skeleton className="size-7 shrink-0 rounded-full" />
                        <div className={cn('space-y-1.5', i % 2 === 1 ? 'items-end' : 'items-start')}>
                          <Skeleton
                            className={cn(
                              'h-16 rounded-2xl',
                              i % 3 === 0 ? 'w-48' : i % 3 === 1 ? 'w-56' : 'w-40',
                            )}
                          />
                          <Skeleton className="h-2.5 w-16" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (() => {
                  const messages = selectedChat.messages;
                  const lastAdminMsgIndex = messages.map(m => m.sender).lastIndexOf('admin');
                  return (
                    <>
                      <MessageScrollerItem messageId="__load_older__">
                        <MessageScrollerLoadOlder
                          hasMore={hasMoreOlder}
                          loading={loadingOlder}
                          onLoadMore={loadOlderMessages}
                        />
                      </MessageScrollerItem>
                      {messages.map((msg, index) => {
                    // Hide legacy optimistic upload placeholders (progress lives in composer now)
                    if (
                      (msg as ChatMessage & { _optimistic?: boolean })._optimistic &&
                      typeof msg.message === 'string' &&
                      msg.message.includes('[กำลังอัปโหลด')
                    ) {
                      return null;
                    }
                    const { text, imageUrl, orderRef, animated, voiceUrl, voiceDuration, voiceBroken } = parseMessage(msg.message);
                    const isOrderOnly = Boolean(orderRef && !text && !imageUrl && !voiceUrl && !voiceBroken);
                    const isImageOnly = Boolean(imageUrl && !text && !orderRef && !voiceUrl && !voiceBroken);
                    const isVoiceOnly = Boolean(voiceUrl && !text && !orderRef && !imageUrl);
                    const isVoiceBrokenOnly = Boolean(voiceBroken && !text && !orderRef && !imageUrl && !voiceUrl);
                    const isLastAdminMessage = msg.sender === 'admin' && index === lastAdminMsgIndex;
                    const isOptimistic = (msg as ChatMessage & { _optimistic?: boolean })._optimistic;
                    const isFailed = (msg as ChatMessage & { _failed?: boolean })._failed;
                    const prev = messages[index - 1];
                    const next = messages[index + 1];
                    const showAvatar = !next || next.sender !== msg.sender || next.sender === 'system';
                    const isGroupedWithPrev = !!prev && prev.sender === msg.sender && prev.sender !== 'system';
                    const align = msg.sender === 'admin' ? 'end' : 'start';
                    const bubbleVariant = isFailed
                      ? 'destructive'
                      : msg.sender === 'admin'
                        ? 'default'
                        : 'muted';

                    if (msg.sender === 'system') {
                      return (
                        <MessageScrollerItem key={msg.id} messageId={msg.id}>
                          <ChatSystemMarker>{msg.message}</ChatSystemMarker>
                        </MessageScrollerItem>
                      );
                    }

                    if (isOrderOnly && orderRef) {
                      return (
                        <MessageScrollerItem key={`${msg.id}-${index}`} messageId={msg.id}>
                          <button
                            type="button"
                            className="w-full"
                            onClick={() => focusOrderInPanel(orderRef)}
                          >
                            <ChatSystemMarker tone="order">
                              ออเดอร์ #{orderRef}
                            </ChatSystemMarker>
                          </button>
                        </MessageScrollerItem>
                      );
                    }

                    return (
                      <MessageScrollerItem
                        key={`${msg.id}-${index}`}
                        messageId={msg.id}
                        scrollAnchor={msg.sender === 'admin'}
                      >
                      <Message
                        align={align}
                        className={cn(isGroupedWithPrev ? 'mt-0.5' : 'mt-2')}
                      >
                        <MessageAvatar className={cn(!showAvatar && 'invisible')}>
                          <Avatar size="sm" className="size-7 shrink-0 ring-2 ring-background">
                            {msg.sender_avatar && <AvatarImage src={msg.sender_avatar} alt="" />}
                            <AvatarFallback className={msg.sender === 'admin' ? 'bg-blue-600 text-white' : 'bg-amber-100 text-amber-800 dark:bg-amber-400 dark:text-white'}>
                              {msg.sender === 'admin'
                                ? <SupportAgentIcon className="size-3.5 text-white" />
                                : <PersonIcon className="size-3.5" />}
                            </AvatarFallback>
                          </Avatar>
                        </MessageAvatar>
                        <MessageContent>
                          {isVoiceOnly ? (
                            <VoiceMessage
                              src={voiceUrl!}
                              duration={voiceDuration}
                              className={cn(isOptimistic && 'opacity-60')}
                            />
                          ) : isVoiceBrokenOnly ? (
                            <Bubble
                              variant={bubbleVariant}
                              align={align}
                              className={cn('max-w-full', isOptimistic && 'opacity-60')}
                            >
                              <BubbleContent className="shadow-sm">
                                <p className="text-[0.85rem] opacity-85">ข้อความเสียงไม่สมบูรณ์ กรุณาส่งใหม่</p>
                              </BubbleContent>
                            </Bubble>
                          ) : isImageOnly ? (
                            <ChatImage
                              src={imageUrl!}
                              alt="รูปภาพ"
                              animated={animated}
                              objectFit="contain"
                              maxWidth={260}
                              maxHeight={340}
                              className={cn(
                                'rounded-2xl shadow-sm',
                                isOptimistic && 'opacity-60'
                              )}
                            />
                          ) : (
                            <Bubble
                              variant={bubbleVariant}
                              align={align}
                              className={cn('max-w-full', isOptimistic && 'opacity-60')}
                            >
                              <BubbleContent className="shadow-sm">
                                {text && (
                                  <ChatTextWithOrderLinks text={text} onOrderClick={focusOrderInPanel} />
                                )}
                                {voiceUrl && (
                                  <VoiceMessage
                                    src={voiceUrl}
                                    duration={voiceDuration}
                                    className={cn(text && 'mt-2')}
                                  />
                                )}
                                {orderRef && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      focusOrderInPanel(orderRef);
                                    }}
                                    className={cn(
                                      'mt-1.5 inline-flex max-w-full items-center gap-1.5 rounded-md px-2 py-0.5 text-[0.7rem] transition',
                                      msg.sender === 'admin'
                                        ? 'bg-blue-500/15 text-blue-800 hover:bg-blue-500/25 dark:bg-white/10 dark:text-white/90 dark:hover:bg-white/15'
                                        : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20 dark:hover:bg-emerald-500/15'
                                    )}
                                  >
                                    <ReceiptIcon className="size-3 shrink-0 opacity-80" />
                                    <span className="truncate">#{orderRef}</span>
                                  </button>
                                )}
                                {imageUrl && (
                                  <ChatImage
                                    src={imageUrl}
                                    alt="รูปภาพ"
                                    animated={animated}
                                    objectFit="cover"
                                    maxWidth={200}
                                    maxHeight={180}
                                    className={cn(
                                      'mt-2 rounded-xl',
                                      !text && !orderRef && 'mt-0'
                                    )}
                                  />
                                )}
                              </BubbleContent>
                            </Bubble>
                          )}
                          {showAvatar && (
                            <MessageFooter className="pt-0.5 text-[0.65rem] text-muted-foreground">
                              <span className="tabular-nums">{formatClock(msg.created_at)}</span>
                              {isLastAdminMessage && (
                                <>
                                  {msg.is_read
                                    ? <DoneAllIcon className="size-3 text-emerald-600 dark:text-green-500" />
                                    : <DoneIcon className="size-3 text-[var(--text-muted)]" />
                                  }
                                  {msg.is_read && msg.read_at && (
                                    <span className="text-[0.6rem] text-emerald-600 tabular-nums dark:text-green-500">
                                      อ่านแล้ว {formatClock(msg.read_at)}
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
                    </>
                  );
                })()}

                {otherTyping && (
                  <MessageScrollerItem messageId="__typing__">
                    <Message align="start" className="mt-1">
                      <MessageAvatar>
                        <Avatar size="sm" className="size-7 bg-amber-100 ring-2 ring-background dark:bg-amber-400">
                          <AvatarFallback className="bg-amber-100 text-amber-800 dark:bg-amber-400 dark:text-white">
                            <PersonIcon className="size-3.5" />
                          </AvatarFallback>
                        </Avatar>
                      </MessageAvatar>
                      <MessageContent>
                        <Bubble variant="muted" align="start">
                          <BubbleContent className="min-w-[4.5rem] py-2.5">
                            <p className="sr-only">{typingDisplay || 'ลูกค้ากำลังพิมพ์...'}</p>
                            <div className="flex gap-1">
                              {[0, 0.15, 0.3].map((delay) => (
                                <span
                                  key={delay}
                                  className="size-1.5 rounded-full bg-muted-foreground/70"
                                  style={{ animation: 'bounce 1.2s infinite ease-in-out both', animationDelay: `${delay}s` }}
                                />
                              ))}
                            </div>
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

              {previewImage && (
                <div className="border-t border-slate-200 bg-white px-4 py-2 dark:border-white/5 dark:bg-[#0c1220]">
                  <div className="relative inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={previewImage} alt="Preview" className="max-h-20 rounded-lg" />
                    <Button
                      type="button"
                      size="icon-xs"
                      onClick={() => setPreviewImage(null)}
                      className="absolute -top-2 -right-2 size-5 bg-red-500 text-white hover:bg-red-600"
                    >
                      <CloseIcon className="size-3.5" />
                    </Button>
                  </div>
                </div>
              )}

              {selectedChat.status === 'active' && selectedChat.admin_email === session?.user?.email && (
                <div className="shrink-0 border-t border-slate-200 bg-white dark:border-white/5 dark:bg-[#0c1220]">
                  {chatSettings.quick_replies.length > 0 && (
                    <div
                      className="flex gap-1 overflow-x-auto px-3 pt-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                      role="list"
                      aria-label="ข้อความตอบกลับด่วน"
                    >
                      {chatSettings.quick_replies.filter((r) => r.text.trim()).map((reply) => (
                        <button
                          key={reply.id}
                          type="button"
                          role="listitem"
                          title={`/${reply.slash} — ${reply.text}`}
                          className="max-w-[10rem] shrink-0 truncate rounded-md px-2 py-0.5 text-[0.65rem] text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-50 hover:text-slate-900 dark:text-muted-foreground dark:ring-white/10 dark:hover:bg-white/5 dark:hover:text-foreground"
                          onClick={() => handleQuickReply(reply.text)}
                        >
                          <span className="mr-1 font-mono text-[0.6rem] opacity-60">/{reply.slash}</span>
                          {reply.text}
                        </button>
                      ))}
                    </div>
                  )}
                  <ChatComposer
                    value={message}
                    onChange={(v) => {
                      setMessage(v);
                      sendTypingIndicator();
                    }}
                    onSend={() => void handleSendMessage()}
                    onSlashSend={(text) => void handleSendMessage(text)}
                    quickReplies={chatSettings.quick_replies}
                    sendOnCtrlEnter
                    onAttachImage={() => {
                      if (uploadingImage) return;
                      fileInputRef.current?.click();
                    }}
                    onSendSticker={handleSendSticker}
                    onSendVoice={handleSendVoice}
                    gifLabels={{
                      title: 'GIF',
                      searchPlaceholder: 'ค้นหา GIF...',
                      uploadGif: 'อัปโหลด GIF',
                      trending: 'ยอดนิยม',
                      empty: 'ไม่พบ GIF',
                      loadError: 'โหลด GIF ไม่สำเร็จ',
                      missingKey: 'ตั้งค่า GIPHY_API_KEY ในเซิร์ฟเวอร์',
                      loading: 'กำลังโหลด...',
                    }}
                    placeholder="ส่งข้อความ... (Ctrl+Enter หรือ /)"
                    disabled={sending}
                    sending={sending}
                    hasAttachment={Boolean(previewImage)}
                    isTouchDevice={isTouchDevice}
                    showMic
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
                    className={chatSettings.quick_replies.length > 0 ? 'pt-1.5' : undefined}
                  />
                </div>
              )}
              </div>

              {/* Customer context panel */}
              {contextPanelOpen && !isMobile && (
                <CustomerContextPanel
                  customerName={selectedChat.customer_name}
                  customerEmail={selectedChat.customer_email}
                  customerAvatar={selectedChat.customer_avatar}
                  chatStatus={selectedChat.status}
                  adminName={selectedChat.admin_name}
                  adminEmail={selectedChat.admin_email}
                  currentAdminEmail={session?.user?.email ?? undefined}
                  orders={customerOrders}
                  loadingOrders={loadingCustomerOrders}
                  onRefreshOrders={() => fetchCustomerOrders(selectedChat.customer_email)}
                  focusOrderRef={focusOrderRef}
                  onFocusHandled={() => setFocusOrderRef(null)}
                  canSendToChat={
                    selectedChat.status === 'active' &&
                    selectedChat.admin_email?.toLowerCase() === (session?.user?.email || '').toLowerCase()
                  }
                  onSendOrderSummary={(order) => void handleSendOrderToChat(order)}
                  onSendTrackingUpdate={(order) => void handleSendTrackingUpdate(order)}
                  onAccept={() => handleAcceptChat(selectedChat.id)}
                  onTakeOver={() => handleAcceptChat(selectedChat.id, { force: true })}
                  onCloseCase={handleCloseChat}
                  transferAdmins={transferAdmins}
                  transferToEmail={transferToEmail}
                  onTransferToEmailChange={setTransferToEmail}
                  transferring={transferring}
                  onTransfer={() => void handleTransferChat()}
                  adminNote={adminNote}
                  onAdminNoteChange={(v) => persistAdminNote(selectedChat.id, v)}
                  getOrderStatusLabel={getOrderStatusLabel}
                  getOrderStatusBadgeClass={getOrderStatusBadgeClass}
                />
              )}
              </div>
            </>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-background">
              <div className="flex min-h-full flex-col items-center justify-center p-6 py-8">
                <div
                  className="mb-6 flex size-[100px] shrink-0 items-center justify-center rounded-full border-2 border-blue-600/30"
                  style={{
                    background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.2) 0%, rgba(30, 64, 175, 0.2) 100%)',
                    animation: 'chat-pulse 2s infinite',
                  }}
                >
                  <ChatIcon className="size-12 text-blue-600" />
                </div>

                <h3 className="mb-1 text-center text-xl font-bold">ศูนย์กลางการสนทนา</h3>

                <p className="mb-6 max-w-[280px] text-center text-sm leading-relaxed text-[var(--text-muted)]">
                  {isMobile ? 'เลือกแชทจากรายการเพื่อเริ่มสนทนา' : 'เลือกแชทจากรายการด้านซ้ายเพื่อเริ่มสนทนากับลูกค้า'}
                </p>

                <div className="flex flex-wrap justify-center gap-4">
                  <div className="min-w-[90px] rounded-lg bg-amber-50 px-5 py-3 text-center ring-1 ring-amber-100 dark:border dark:border-amber-400/30 dark:bg-amber-400/10 dark:ring-0">
                    <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{stats?.pendingCount || 0}</p>
                    <p className="text-xs text-amber-700/80 dark:text-amber-400/80">รอรับเคส</p>
                  </div>
                  <div className="min-w-[90px] rounded-lg bg-emerald-50 px-5 py-3 text-center ring-1 ring-emerald-100 dark:border dark:border-green-500/30 dark:bg-green-500/10 dark:ring-0">
                    <p className="text-2xl font-bold text-emerald-700 dark:text-green-500">{stats?.activeCount || 0}</p>
                    <p className="text-xs text-emerald-700/80 dark:text-green-500/80">กำลังสนทนา</p>
                  </div>
                </div>

                <div className="mt-8 max-w-[320px] rounded-lg bg-slate-100 p-4 ring-1 ring-slate-200 dark:bg-white/5 dark:ring-white/10">
                  <p className="mb-1 text-xs font-semibold text-blue-600 dark:text-sky-400">คีย์ลัด</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Alt+↑/↓ สลับแชท · Alt+C ปิดเคส · Alt+I แผงข้อมูล · พิมพ์ / ตอบด่วน · Ctrl+Enter ส่ง
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <ChatSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={chatSettings}
        onChange={setChatSettings}
        onSave={handleSaveSettings}
        saving={settingsSaving}
      />
    </>
  );
}
