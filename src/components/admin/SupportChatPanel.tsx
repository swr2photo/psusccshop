'use client';

import { apiFetch, uploadImageApi } from '@/lib/api-client';
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
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
  Image as ImageIcon,
  X as CloseIcon,
  Settings as SettingsIcon,
  ArrowLeft as ArrowBackIcon,
  CheckCheck as DoneAllIcon,
  Check as DoneIcon,
  Receipt as ReceiptIcon,
  Search as SearchIcon,
  Eye as ViewIcon,
  ZoomIn as ZoomInIcon,
  Loader2,
} from 'lucide-react';
import { chatMessagesChanged, getDbTypingFromSession } from '@/lib/support-chat-typing';
import { fetchChatSync, mergeChatMessages, getChatPollIntervalMs } from '@/lib/support-chat-sync';

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

interface ChatSettings {
  admin_display_name: string;
  auto_reply_enabled: boolean;
  auto_reply_message: string;
  quick_replies: string[];
  notification_sound: boolean;
}

function StarRating({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <StarIcon
          key={star}
          className={cn(
            'size-4',
            star <= value ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'
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
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [stats, setStats] = useState<ChatStats | null>(null);
  const [selectedChat, setSelectedChat] = useState<ChatWithMessages | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [fallbackTyping, setFallbackTyping] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [chatSettings, setChatSettings] = useState<ChatSettings>({
    admin_display_name: 'ทีมงาน PSU SCC',
    auto_reply_enabled: true,
    auto_reply_message: 'ขอบคุณที่ติดต่อมา ทีมงานจะตอบกลับโดยเร็วที่สุดค่ะ',
    quick_replies: ['สวัสดีค่ะ', 'รอสักครู่นะคะ', 'ขอบคุณที่รอค่ะ', 'ยินดีให้บริการค่ะ'],
    notification_sound: true,
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const chatEtagRef = useRef<string | null>(null);
  const lastMessageAtRef = useRef<string | null>(null);
  const prevMessageCountRef = useRef<number>(0);
  const isUserScrollingRef = useRef<boolean>(false);

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
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [customerOrders, setCustomerOrders] = useState<any[]>([]);
  const [loadingCustomerOrders, setLoadingCustomerOrders] = useState(false);

  const [isTouchDevice, setIsTouchDevice] = useState(false);
  useEffect(() => {
    setIsTouchDevice(
      'ontouchstart' in window || navigator.maxTouchPoints > 0
    );
  }, []);

  const scrollToBottom = useCallback((force = false) => {
    if (!isUserScrollingRef.current || force) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
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
      const url = '/api/support-chat/' + chatId + (markRead ? '?markRead=true' : '');
      const res = await apiFetch(url);
      const data = await res.json();
      if (data.chat) {
        setSelectedChat(data.chat);
        if (data.chat.messages) setRealtimeMessages(data.chat.messages || []);
      }
    } catch (error) {
      console.error('Error fetching chat details:', error);
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
          const changed =
            chatMessagesChanged(prev.messages, incoming) ||
            result.chat.status !== prev.status;
          if (!changed) return prev;
          didUpdate = true;
          setRealtimeMessages(incoming);
          lastMessageAtRef.current = incoming[incoming.length - 1]?.created_at ?? null;
          return { ...result.chat, messages: incoming };
        });
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

        setSelectedChat(result.chat);
        setRealtimeMessages(result.chat.messages || []);
        lastMessageAtRef.current =
          result.chat.messages?.[result.chat.messages.length - 1]?.created_at ?? null;
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
        scrollToBottom();

        const latestMsg = selectedChat.messages[selectedChat.messages.length - 1];
        if (document.hidden && latestMsg?.sender === 'customer') {
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
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
  }, [selectedChat?.messages?.length, scrollToBottom]);

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
      .then(data => { if (data.settings) setChatSettings(data.settings); })
      .catch(() => {});
  }, []);

  const handleSelectChat = async (chatId: string) => {
    isUserScrollingRef.current = false;
    prevMessageCountRef.current = 0;
    const res = await apiFetch('/api/support-chat/' + chatId + '?markRead=true');
    const data = await res.json();
    if (data.chat) {
      setSelectedChat(data.chat);
      setRealtimeMessages(data.chat.messages || []);
    }
    fetchChats();
    broadcastRead();
    if (isMobile) setMobileShowChat(true);
  };

  const handleMobileBack = () => {
    setMobileShowChat(false);
    setSelectedChat(null);
    prevMessageCountRef.current = 0;
  };

  const handleSaveSettings = async () => {
    try {
      await apiFetch('/api/support-chat/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chatSettings),
      });
      setSettingsOpen(false);
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  const handleQuickReply = (reply: string) => setMessage(reply);

  const handleAcceptChat = async (chatId: string) => {
    try {
      const res = await apiFetch('/api/support-chat/' + chatId + '/accept', { method: 'POST' });
      const data = await res.json();
      if (data.chat) {
        await fetchChats();
        const detailRes = await apiFetch('/api/support-chat/' + chatId);
        const detailData = await detailRes.json();
        if (detailData.chat) {
          setSelectedChat(detailData.chat);
          setRealtimeMessages(detailData.chat.messages || []);
        }
      }
    } catch (error) {
      console.error('Error accepting chat:', error);
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

  const handleSendMessage = async () => {
    if (previewImage) { await handleSendWithImage(); return; }
    if (!message.trim() || !selectedChat) return;

    const msgText = message.trim();
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
    if (!previewImage || !selectedChat) return;
    setUploadingImage(true);

    const tempId = `opt_img_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const msgText = message.trim() ? message.trim() + '\n[กำลังอัปโหลดรูปภาพ...]' : '[กำลังอัปโหลดรูปภาพ...]';
    addOptimisticMessage(tempId, msgText, session?.user?.name || chatSettings.admin_display_name, session?.user?.image || undefined);
    setPreviewImage(null);
    setMessage('');
    scrollToBottom(true);

    try {
      const mimeMatch = previewImage.match(/data:([^;]+);/);
      const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      const ext = mime.split('/')[1] || 'jpg';
      const uploadRes = await uploadImageApi({
        base64: previewImage,
        filename: 'admin_chat_' + Date.now() + '.' + ext,
        mime,
      });
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
        const imageUrl = uploadData.data.url;
        const finalMsg = message.trim() ? message.trim() + '\n[รูปภาพ: ' + imageUrl + ']' : '[รูปภาพ: ' + imageUrl + ']';
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
        resolveOptimistic(tempId, null);
        toastError('ไม่สามารถอัปโหลดรูปภาพได้');
      }
    } catch (error: any) {
      console.error('Error uploading image:', error);
      resolveOptimistic(tempId, null);
      toastError(error?.message || 'เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ');
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

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
      case 'pending': return '#fbbf24';
      case 'active': return '#22c55e';
      case 'closed': return '#64748b';
      default: return '#64748b';
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

  const parseMessage = (msg: string) => {
    const imageMatch = msg.match(/\[รูปภาพ: (\/api\/image\/[^\]]+|https?:\/\/[^\]]+)\]/);
    if (imageMatch) {
      const imageUrl = imageMatch[1];
      const textPart = msg.replace(imageMatch[0], '').trim();
      return { text: textPart, imageUrl };
    }
    const orderMatch = msg.match(/\[ORDER_REF:([^\]]+)\]/);
    if (orderMatch) {
      const orderRef = orderMatch[1];
      const textPart = msg.replace(orderMatch[0], '').trim();
      return { text: textPart, imageUrl: null, orderRef };
    }
    return { text: msg, imageUrl: null, orderRef: null };
  };

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
      const res = await apiFetch(`/api/admin/orders?email=${encodeURIComponent(email)}&limit=10`);
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

      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-[9999] flex cursor-zoom-out items-center justify-center bg-black/95"
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setLightboxImage(null)}
            className="absolute top-4 right-4 bg-[var(--glass-bg)] text-white hover:bg-[var(--glass-strong)]"
          >
            <CloseIcon />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={(e) => { e.stopPropagation(); window.open(lightboxImage, '_blank'); }}
            className="absolute top-4 right-16 bg-[var(--glass-bg)] text-white hover:bg-[var(--glass-strong)]"
            title="เปิดในแท็บใหม่"
          >
            <ZoomInIcon />
          </Button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxImage}
            alt="รูปภาพขยาย"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] max-w-[95vw] cursor-default rounded-lg object-contain shadow-2xl"
          />
          <p className="absolute bottom-6 text-sm text-[var(--text-muted)]">
            คลิกที่ใดก็ได้เพื่อปิด
          </p>
        </div>
      )}

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
                      <Badge
                        className={cn(
                          'text-[0.7rem]',
                          foundOrder.status === 'PAID'
                            ? 'bg-green-500/20 text-green-500'
                            : 'bg-amber-400/20 text-amber-400'
                        )}
                      >
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
                        onClick={() => window.open(`/admin?tab=orders&ref=${foundOrder.ref}`, '_blank')}
                      >
                        <ViewIcon className="size-4" />
                        ดูรายละเอียด
                      </Button>
                      <Button
                        size="sm"
                        className="bg-green-500 text-xs hover:bg-green-600"
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
        'flex min-h-[400px]',
        isMobile ? 'h-[calc(100vh-120px)]' : 'h-[calc(100vh-200px)]'
      )}>
        {/* Chat List Panel */}
        <div className={cn(
          'flex shrink-0 flex-col overflow-hidden border bg-card',
          isMobile ? 'w-full rounded-none' : 'mr-2 w-[340px] rounded-lg',
          isMobile && mobileShowChat && 'hidden'
        )}>
          <div className="border-b border-border p-4">
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
            {stats && (
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-amber-400/10 text-[0.7rem] font-medium text-amber-400">
                  <DotIcon className="size-2.5 fill-amber-400 text-amber-400" />
                  รอ {stats.pendingCount}
                </Badge>
                <Badge className="bg-green-500/10 text-[0.7rem] font-medium text-green-500">
                  <DotIcon className="size-2.5 fill-green-500 text-green-500" />
                  Active {stats.activeCount}
                </Badge>
                {stats.avgRating > 0 && (
                  <Badge className="bg-amber-400/10 text-[0.7rem] font-medium text-amber-400">
                    <StarIcon className="size-3 fill-amber-400 text-amber-400" />
                    {stats.avgRating.toFixed(1)}
                  </Badge>
                )}
              </div>
            )}
          </div>

          <Tabs
            value={TAB_KEYS[tabValue]}
            onValueChange={(v) => setTabValue(TAB_KEYS.indexOf(v as typeof TAB_KEYS[number]))}
            className="flex min-h-0 flex-1 flex-col"
          >
            <TabsList variant="line" className="h-9 w-full rounded-none border-b border-border bg-transparent p-0">
              <TabsTrigger value="all" className="min-h-9 flex-1 px-0.5 text-[0.7rem] data-[state=active]:text-blue-600">
                ทั้งหมด
              </TabsTrigger>
              <TabsTrigger value="pending" className="relative min-h-9 flex-1 px-0.5 text-[0.7rem] data-[state=active]:text-blue-600">
                รอรับ
                {(stats?.pendingCount ?? 0) > 0 && (
                  <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
                    {stats!.pendingCount > 99 ? '99+' : stats!.pendingCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="my" className="min-h-9 flex-1 px-0.5 text-[0.7rem] data-[state=active]:text-blue-600">
                ของฉัน
              </TabsTrigger>
              <TabsTrigger value="closed" className="min-h-9 flex-1 px-0.5 text-[0.7rem] data-[state=active]:text-blue-600">
                ปิด
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <div className="grid h-[200px] place-items-center">
                <Loader2 className="size-8 animate-spin text-blue-600" />
              </div>
            ) : chats.length === 0 ? (
              <div className="p-6 text-center">
                <ChatIcon className="mx-auto mb-2 size-12 text-[var(--text-muted)]" />
                <p className="text-[var(--text-muted)]">ไม่มีแชท</p>
              </div>
            ) : (
              <div>
                {chats.map((chat) => (
                  <React.Fragment key={chat.id}>
                    <button
                      type="button"
                      onClick={() => handleSelectChat(chat.id)}
                      className={cn(
                        'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50',
                        selectedChat?.id === chat.id && 'border-l-[3px] border-l-blue-600 bg-blue-600/10'
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
                          <Badge
                            className="h-4 px-1 text-[0.55rem]"
                            style={{
                              backgroundColor: getStatusColor(chat.status) + '20',
                              color: getStatusColor(chat.status),
                            }}
                          >
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
                    <Separator />
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Chat Detail Panel */}
        <div className={cn(
          'flex min-h-0 flex-1 flex-col overflow-hidden border bg-card',
          isMobile ? 'rounded-none' : 'rounded-lg',
          isMobile && !mobileShowChat && 'hidden'
        )}>
          {selectedChat ? (
            <>
              <div className="flex items-center gap-2 border-b border-border px-4 py-3">
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
                  <p className="truncate text-sm font-bold">{selectedChat.customer_name}</p>
                  <p className="flex items-center gap-1 truncate text-xs text-[var(--text-muted)]">
                    <span
                      className={cn(
                        'size-1.5 shrink-0 rounded-full',
                        connectionState === 'connected' && 'bg-[#30d158] shadow-[0_0_3px_#30d158]',
                        connectionState === 'connecting' && 'bg-[#ff9f0a]',
                        connectionState !== 'connected' && connectionState !== 'connecting' && 'bg-[#ff453a]'
                      )}
                    />
                    {otherTyping
                      ? (typingDisplay || 'ลูกค้ากำลังพิมพ์...')
                      : selectedChat.subject}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => {
                    setOrderLookupOpen(true);
                    setFoundOrder(null);
                    setOrderSearchRef('');
                    fetchCustomerOrders(selectedChat.customer_email);
                  }}
                  className="bg-green-500/10 text-green-500 hover:bg-green-500/20"
                  title="ค้นหาออเดอร์"
                >
                  <ReceiptIcon className="size-5" />
                </Button>
                {selectedChat.status === 'pending' && (
                  <Button
                    size="sm"
                    onClick={() => handleAcceptChat(selectedChat.id)}
                    className="bg-green-500 text-xs hover:bg-green-600"
                  >
                    <AcceptIcon className="size-4" />
                    รับเคส
                  </Button>
                )}
                {selectedChat.status === 'active' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCloseChat}
                    className="border-slate-500 text-xs text-[var(--text-muted)] hover:bg-slate-500/10"
                  >
                    <CheckCircleIcon className="size-4" />
                    ปิด
                  </Button>
                )}
                {selectedChat.status === 'closed' && selectedChat.rating && (
                  <StarRating value={selectedChat.rating} />
                )}
              </div>

              <div
                className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-[var(--surface)] p-4"
                onScroll={(e) => {
                  const el = e.target as HTMLDivElement;
                  isUserScrollingRef.current = el.scrollHeight - el.scrollTop - el.clientHeight > 100;
                }}
              >
                {(() => {
                  const messages = selectedChat.messages;
                  const lastAdminMsgIndex = messages.map(m => m.sender).lastIndexOf('admin');
                  return messages.map((msg, index) => {
                    const { text, imageUrl, orderRef } = parseMessage(msg.message);
                    const isImageOnly = Boolean(imageUrl && !text && !orderRef);
                    const isLastAdminMessage = msg.sender === 'admin' && index === lastAdminMsgIndex;
                    const isOptimistic = (msg as ChatMessage & { _optimistic?: boolean })._optimistic;
                    const isFailed = (msg as ChatMessage & { _failed?: boolean })._failed;

                    return (
                      <div
                        key={msg.id}
                        className={cn(
                          'flex',
                          msg.sender === 'admin' ? 'justify-end' : msg.sender === 'system' ? 'justify-center' : 'justify-start'
                        )}
                      >
                        {msg.sender === 'system' ? (
                          <Badge variant="secondary" className="bg-[var(--glass-bg)] text-[0.7rem] text-[var(--text-muted)]">
                            {msg.message}
                          </Badge>
                        ) : (
                          <div className={cn(
                            'flex max-w-[85%] items-start gap-2 sm:max-w-[75%]',
                            msg.sender === 'admin' && 'flex-row-reverse'
                          )}>
                            {msg.sender === 'customer' && (
                              <Avatar size="sm" className="size-7 shrink-0">
                                {msg.sender_avatar && <AvatarImage src={msg.sender_avatar} alt="" />}
                                <AvatarFallback className="bg-amber-400">
                                  <PersonIcon className="size-4" />
                                </AvatarFallback>
                              </Avatar>
                            )}
                            {msg.sender === 'admin' && (
                              <Avatar size="sm" className="size-7 shrink-0">
                                {msg.sender_avatar && <AvatarImage src={msg.sender_avatar} alt="" />}
                                <AvatarFallback className="bg-blue-600">
                                  <SupportAgentIcon className="size-4 text-white" />
                                </AvatarFallback>
                              </Avatar>
                            )}
                            <div className="min-w-0">
                              {isImageOnly ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={imageUrl!}
                                  alt="รูปภาพ"
                                  loading="lazy"
                                  onClick={(e) => { e.stopPropagation(); setLightboxImage(imageUrl!); }}
                                  className={cn(
                                    'block max-h-[260px] max-w-[200px] cursor-zoom-in rounded-[14px] object-contain shadow-md transition-opacity hover:opacity-90 sm:max-h-[340px] sm:max-w-[260px]',
                                    isOptimistic && 'opacity-60'
                                  )}
                                />
                              ) : (
                                <div
                                  className={cn(
                                    'rounded-lg px-3 py-2 transition-opacity',
                                    isFailed ? 'bg-[#ff453a]' : msg.sender === 'admin' ? 'bg-blue-600 text-white' : 'bg-card',
                                    msg.sender === 'admin' ? 'rounded-br-sm' : 'rounded-bl-sm',
                                    isOptimistic && 'opacity-60'
                                  )}
                                >
                                  {text && (
                                    <p className="whitespace-pre-wrap break-words text-sm leading-snug">{text}</p>
                                  )}
                                  {orderRef && (
                                    <div
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setOrderSearchRef(orderRef || '');
                                        setOrderLookupOpen(true);
                                        handleSearchOrder();
                                      }}
                                      className={cn(
                                        'cursor-pointer rounded-md border p-3 transition-all',
                                        text && 'mt-2',
                                        msg.sender === 'admin'
                                          ? 'border-[var(--glass-border)] bg-[var(--glass-bg)] hover:bg-[var(--glass-strong)]'
                                          : 'border-border bg-[var(--surface)] hover:bg-blue-600/10'
                                      )}
                                    >
                                      <div className="flex items-center gap-2">
                                        <div className="flex size-8 items-center justify-center rounded bg-green-500">
                                          <ReceiptIcon className="size-[18px] text-white" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                          <p className={cn(
                                            'text-sm font-semibold',
                                            msg.sender === 'admin' ? 'text-white' : 'text-foreground'
                                          )}>
                                            ออเดอร์ #{orderRef}
                                          </p>
                                          <p className={cn(
                                            'text-xs',
                                            msg.sender === 'admin' ? 'text-[var(--text-muted)]' : 'text-[var(--text-muted)]'
                                          )}>
                                            คลิกเพื่อดูรายละเอียด
                                          </p>
                                        </div>
                                        <ViewIcon className="size-4 text-[var(--text-muted)]" />
                                      </div>
                                    </div>
                                  )}
                                  {imageUrl && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={imageUrl}
                                      alt="รูปภาพ"
                                      loading="lazy"
                                      className={cn(
                                        'mt-2 max-h-[140px] w-full max-w-[160px] cursor-zoom-in rounded-md object-cover transition-transform hover:scale-[1.02] sm:max-h-[180px] sm:max-w-[200px]',
                                        !text && !orderRef && 'mt-0'
                                      )}
                                      onClick={(e) => { e.stopPropagation(); setLightboxImage(imageUrl); }}
                                    />
                                  )}
                                </div>
                              )}
                              <div className={cn(
                                'mt-0.5 flex flex-wrap items-center gap-1',
                                msg.sender === 'admin' ? 'justify-end' : 'justify-start'
                              )}>
                                <span className="text-[0.6rem] text-[var(--text-muted)]">
                                  {new Date(msg.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} · {formatTime(msg.created_at)}
                                </span>
                                {isLastAdminMessage && (
                                  <>
                                    {msg.is_read
                                      ? <DoneAllIcon className="size-3 text-green-500" />
                                      : <DoneIcon className="size-3 text-[var(--text-muted)]" />
                                    }
                                    {msg.is_read && msg.read_at && (
                                      <span className="text-[0.55rem] text-green-500">
                                        ลูกค้าอ่านแล้ว {formatTime(msg.read_at)}
                                      </span>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}

                {otherTyping && (
                  <div className="flex items-center gap-2">
                    <Avatar size="sm" className="size-7 bg-amber-400">
                      <AvatarFallback className="bg-amber-400">
                        <PersonIcon className="size-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="rounded-lg bg-card px-4 py-2">
                      <p className="mb-1 text-xs text-[var(--text-muted)]">
                        {typingDisplay || 'ลูกค้ากำลังพิมพ์...'}
                      </p>
                      <div className="flex gap-1">
                        {[0, 0.2, 0.4].map((delay) => (
                          <span
                            key={delay}
                            className="size-1.5 rounded-full bg-[var(--text-muted)]"
                            style={{ animation: 'bounce 1.4s infinite ease-in-out both', animationDelay: `${delay}s` }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {selectedChat.status === 'active' && selectedChat.admin_email === session?.user?.email && (
                <div className="flex gap-1 overflow-x-auto border-t border-border px-4 py-2">
                  {chatSettings.quick_replies.map((reply, idx) => (
                    <Badge
                      key={idx}
                      className="shrink-0 cursor-pointer bg-blue-600/10 text-[0.7rem] text-blue-600 hover:bg-blue-600/20"
                      onClick={() => handleQuickReply(reply)}
                    >
                      {reply}
                    </Badge>
                  ))}
                </div>
              )}

              {previewImage && (
                <div className="border-t border-border bg-[var(--surface)] px-4 py-2">
                  <div className="relative inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={previewImage} alt="Preview" className="max-h-20 rounded" />
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
                <div className="flex gap-2 border-t border-border p-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImage}
                    className="text-[var(--text-muted)] hover:text-blue-600"
                  >
                    <ImageIcon />
                  </Button>
                  <Textarea
                    placeholder={isTouchDevice ? 'พิมพ์ข้อความ...' : 'พิมพ์ข้อความ... (Shift+Enter = ขึ้นบรรทัดใหม่)'}
                    value={message}
                    rows={1}
                    className="min-h-9 max-h-32 flex-1 resize-none bg-[var(--surface)] text-sm"
                    onChange={(e) => { setMessage(e.target.value); sendTypingIndicator(); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !isTouchDevice) { e.preventDefault(); handleSendMessage(); } }}
                    disabled={sending || uploadingImage}
                  />
                  <Button
                    size="icon"
                    onClick={handleSendMessage}
                    disabled={(!message.trim() && !previewImage) || sending || uploadingImage}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-border"
                  >
                    {sending || uploadingImage ? <Loader2 className="size-5 animate-spin" /> : <SendIcon className="size-5" />}
                  </Button>
                </div>
              )}
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
                  <div className="min-w-[90px] rounded-lg border border-amber-400/30 bg-amber-400/10 px-5 py-3 text-center">
                    <p className="text-2xl font-bold text-amber-400">{stats?.pendingCount || 0}</p>
                    <p className="text-xs text-amber-400/80">รอรับเคส</p>
                  </div>
                  <div className="min-w-[90px] rounded-lg border border-green-500/30 bg-green-500/10 px-5 py-3 text-center">
                    <p className="text-2xl font-bold text-green-500">{stats?.activeCount || 0}</p>
                    <p className="text-xs text-green-500/80">กำลังสนทนา</p>
                  </div>
                </div>

                <div className="mt-8 max-w-[320px] rounded-lg border border-blue-600/20 bg-blue-600/10 p-4">
                  <p className="mb-1 text-xs font-semibold text-blue-600">เคล็ดลับ</p>
                  <p className="text-xs leading-normal text-[var(--text-muted)]">
                    คลิกที่แชทในรายการเพื่อดูรายละเอียด กดปุ่ม &quot;รับเคส&quot; เพื่อเริ่มช่วยเหลือลูกค้า
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-lg bg-card text-foreground">
          <DialogHeader className="border-b border-border pb-4">
            <DialogTitle className="flex items-center gap-2">
              <SettingsIcon className="size-6" />
              ตั้งค่าแชท
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="admin-display-name">ชื่อทีมแอดมินที่แสดง</Label>
              <Input
                id="admin-display-name"
                value={chatSettings.admin_display_name}
                onChange={(e) => setChatSettings(s => ({ ...s, admin_display_name: e.target.value }))}
                placeholder="เช่น ทีมงาน PSU SCC"
              />
              <p className="text-xs text-[var(--text-muted)]">ชื่อที่ลูกค้าจะเห็นในหัวข้อแชท</p>
            </div>

            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="auto-reply">เปิดใช้ข้อความตอบอัตโนมัติ</Label>
              <Switch
                id="auto-reply"
                checked={chatSettings.auto_reply_enabled}
                onCheckedChange={(checked) => setChatSettings(s => ({ ...s, auto_reply_enabled: checked }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="auto-reply-message">ข้อความตอบอัตโนมัติ</Label>
              <Textarea
                id="auto-reply-message"
                rows={2}
                value={chatSettings.auto_reply_message}
                onChange={(e) => setChatSettings(s => ({ ...s, auto_reply_message: e.target.value }))}
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="notification-sound">เปิดเสียงแจ้งเตือน</Label>
              <Switch
                id="notification-sound"
                checked={chatSettings.notification_sound}
                onCheckedChange={(checked) => setChatSettings(s => ({ ...s, notification_sound: checked }))}
              />
            </div>

            <div>
              <p className="mb-2 text-sm text-[var(--text-muted)]">ข้อความตอบด่วน</p>
              {chatSettings.quick_replies.map((reply, idx) => (
                <Input
                  key={idx}
                  value={reply}
                  onChange={(e) => {
                    const newReplies = [...chatSettings.quick_replies];
                    newReplies[idx] = e.target.value;
                    setChatSettings(s => ({ ...s, quick_replies: newReplies }));
                  }}
                  className="mb-2 text-sm"
                />
              ))}
            </div>
          </div>

          <DialogFooter className="border-t border-border pt-4">
            <Button variant="ghost" onClick={() => setSettingsOpen(false)} className="text-[var(--text-muted)]">
              ยกเลิก
            </Button>
            <Button onClick={handleSaveSettings} className="bg-blue-600 hover:bg-blue-700">
              บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
