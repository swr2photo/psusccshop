// src/components/admin/SupportChatPanel.tsx
// Admin Panel for Support Chat Management - Mobile Responsive with Typing & Read Receipts

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useNotification } from '../NotificationContext';
import {
  Box,
  Typography,
  TextField,
  Avatar,
  Paper,
  CircularProgress,
  Badge,
  Button,
  Chip,
  IconButton,
  List,
  ListItemAvatar,
  ListItemText,
  ListItemButton,
  Divider,
  Tab,
  Tabs,
  Rating,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Switch,
  FormControlLabel,
  useMediaQuery,
  useTheme,
} from '@mui/material';
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
  Pencil as EditIcon,
  ShoppingBag as ShoppingBagIcon,
  ZoomIn as ZoomInIcon,
} from 'lucide-react';

const ADMIN_THEME = {
  bg: 'var(--surface)',
  bgCard: 'var(--surface-2)',
  text: 'var(--foreground)',
  textMuted: 'var(--text-muted)',
  border: 'var(--glass-border)',
};

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
  auto_reply_enabled: boolean;
  auto_reply_message: string;
  quick_replies: string[];
  notification_sound: boolean;
}

export default function SupportChatPanel() {
  const { data: session } = useSession();
  const { warning: toastWarning, error: toastError } = useNotification();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
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
  const [otherTyping, setOtherTyping] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [chatSettings, setChatSettings] = useState<ChatSettings>({
    auto_reply_enabled: true,
    auto_reply_message: 'ขอบคุณที่ติดต่อมา ทีมงานจะตอบกลับโดยเร็วที่สุดค่ะ',
    quick_replies: ['สวัสดีค่ะ', 'รอสักครู่นะคะ', 'ขอบคุณที่รอค่ะ', 'ยินดีให้บริการค่ะ'],
    notification_sound: true,
  });
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prevMessageCountRef = useRef<number>(0);
  const isUserScrollingRef = useRef<boolean>(false);
  
  // New states for order lookup and image lightbox
  const [orderLookupOpen, setOrderLookupOpen] = useState(false);
  const [orderSearchRef, setOrderSearchRef] = useState('');
  const [foundOrder, setFoundOrder] = useState<any>(null);
  const [searchingOrder, setSearchingOrder] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [customerOrders, setCustomerOrders] = useState<any[]>([]);
  const [loadingCustomerOrders, setLoadingCustomerOrders] = useState(false);

  const scrollToBottom = useCallback((force = false) => {
    if (!isUserScrollingRef.current || force) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  const fetchChats = useCallback(async () => {
    try {
      const filter = ['all', 'pending', 'my', 'closed'][tabValue];
      const res = await fetch('/api/admin/support-chat?filter=' + filter);
      const data = await res.json();
      if (data.chats) setChats(data.chats);
      if (data.stats) setStats(data.stats);
    } catch (error) {
      console.error('Error fetching chats:', error);
    }
  }, [tabValue]);

  const fetchChatDetails = useCallback(async (chatId: string, markRead = false) => {
    try {
      const url = '/api/support-chat/' + chatId + (markRead ? '?markRead=true' : '');
      const res = await fetch(url);
      const data = await res.json();
      if (data.chat) setSelectedChat(data.chat);
    } catch (error) {
      console.error('Error fetching chat details:', error);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchChats().finally(() => setLoading(false));
  }, [fetchChats]);

  useEffect(() => {
    pollIntervalRef.current = setInterval(() => {
      fetchChats();
      if (selectedChat) {
        fetchChatDetails(selectedChat.id);
        // Auto mark as read when admin is viewing the chat
        fetch('/api/support-chat/' + selectedChat.id + '/read', { method: 'POST' }).catch(() => {});
        fetch('/api/support-chat/' + selectedChat.id + '/typing')
          .then(res => res.json())
          .then(data => setOtherTyping(data.isTyping || false))
          .catch(() => setOtherTyping(false));
      }
    }, 3000);
    return () => { if (pollIntervalRef.current) clearInterval(pollIntervalRef.current); };
  }, [fetchChats, fetchChatDetails, selectedChat?.id]);

  useEffect(() => {
    if (selectedChat?.messages) {
      const currentCount = selectedChat.messages.length;
      // Only auto-scroll when new messages arrive (not on initial load)
      if (prevMessageCountRef.current > 0 && currentCount > prevMessageCountRef.current) {
        scrollToBottom();
      }
      // Don't force scroll on initial chat selection - let user see from top
      prevMessageCountRef.current = currentCount;
    }
  }, [selectedChat?.messages?.length, scrollToBottom]);

  const sendTypingIndicator = useCallback(() => {
    if (!selectedChat) return;
    fetch('/api/support-chat/' + selectedChat.id + '/typing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isTyping: true }),
    }).catch(() => {});
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      if (selectedChat) {
        fetch('/api/support-chat/' + selectedChat.id + '/typing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isTyping: false }),
        }).catch(() => {});
      }
    }, 3000);
  }, [selectedChat?.id]);

  // Removed redundant /read call - now handled by fetchChatDetails with markRead=true

  useEffect(() => {
    fetch('/api/support-chat/settings')
      .then(res => res.json())
      .then(data => { if (data.settings) setChatSettings(data.settings); })
      .catch(() => {});
  }, []);

  const handleSelectChat = async (chatId: string) => {
    // Reset scroll tracking when selecting new chat
    isUserScrollingRef.current = false;
    prevMessageCountRef.current = 0;
    // Fetch with markRead=true when user explicitly selects a chat
    await fetchChatDetails(chatId, true);
    // Refresh chat list to update unread counts
    fetchChats();
    if (isMobile) setMobileShowChat(true);
  };

  const handleMobileBack = () => {
    setMobileShowChat(false);
    setSelectedChat(null);
    prevMessageCountRef.current = 0;
  };

  const handleSaveSettings = async () => {
    try {
      await fetch('/api/support-chat/settings', {
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
      const res = await fetch('/api/support-chat/' + chatId + '/accept', { method: 'POST' });
      const data = await res.json();
      if (data.chat) {
        await fetchChats();
        await fetchChatDetails(chatId);
      }
    } catch (error) {
      console.error('Error accepting chat:', error);
    }
  };

  const handleCloseChat = async () => {
    if (!selectedChat) return;
    try {
      const res = await fetch('/api/support-chat/' + selectedChat.id + '/close', { method: 'POST' });
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
    setSending(true);
    try {
      const res = await fetch('/api/support-chat/' + selectedChat.id + '/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchChatDetails(selectedChat.id);
        setMessage('');
      }
    } catch (error) {
      console.error('Error sending message:', error);
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
    try {
      const mimeMatch = previewImage.match(/data:([^;]+);/);
      const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      const ext = mime.split('/')[1] || 'jpg';
      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64: previewImage, filename: 'admin_chat_' + Date.now() + '.' + ext, mime }),
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
        const msgContent = message.trim() ? message.trim() + '\n[รูปภาพ: ' + imageUrl + ']' : '[รูปภาพ: ' + imageUrl + ']';
        await fetch('/api/support-chat/' + selectedChat.id + '/message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: msgContent }),
        });
        await fetchChatDetails(selectedChat.id);
        setMessage('');
        setPreviewImage(null);
      } else {
        toastError('ไม่สามารถอัปโหลดรูปภาพได้');
      }
    } catch (error: any) {
      console.error('Error uploading image:', error);
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
    // Check for order reference
    const orderMatch = msg.match(/\[ORDER_REF:([^\]]+)\]/);
    if (orderMatch) {
      const orderRef = orderMatch[1];
      const textPart = msg.replace(orderMatch[0], '').trim();
      return { text: textPart, imageUrl: null, orderRef };
    }
    return { text: msg, imageUrl: null, orderRef: null };
  };

  // Search for order by ref
  const handleSearchOrder = async () => {
    if (!orderSearchRef.trim()) return;
    setSearchingOrder(true);
    setFoundOrder(null);
    try {
      const res = await fetch(`/api/admin/orders?ref=${encodeURIComponent(orderSearchRef.trim())}`);
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

  // Fetch customer's orders
  const fetchCustomerOrders = async (email: string) => {
    if (!email) return;
    setLoadingCustomerOrders(true);
    try {
      const res = await fetch(`/api/admin/orders?email=${encodeURIComponent(email)}&limit=10`);
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

  // Send order reference to chat
  const handleSendOrderToChat = async (order: any) => {
    if (!selectedChat || selectedChat.status !== 'active') return;
    const orderMsg = `*ออเดอร์ #${order.ref}*
ยอด: ฿${order.totalAmount?.toLocaleString() || order.amount?.toLocaleString() || 0}
วันที่: ${new Date(order.date || order.createdAt).toLocaleDateString('th-TH')}
สถานะ: ${getOrderStatusLabel(order.status)}
[ORDER_REF:${order.ref}]`;
    
    setSending(true);
    try {
      await fetch('/api/support-chat/' + selectedChat.id + '/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: orderMsg }),
      });
      await fetchChatDetails(selectedChat.id);
    } catch (error) {
      console.error('Error sending order ref:', error);
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
      <input type="file" ref={fileInputRef} accept="image/*" style={{ display: 'none' }} onChange={handleImageSelect} />
      
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }
      `}</style>

      {/* Image Lightbox */}
      {lightboxImage && (
        <Box
          onClick={() => setLightboxImage(null)}
          sx={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            bgcolor: 'rgba(0,0,0,0.95)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'zoom-out',
          }}
        >
          <IconButton
            onClick={() => setLightboxImage(null)}
            sx={{
              position: 'absolute',
              top: 16,
              right: 16,
              color: 'white',
              bgcolor: 'var(--glass-bg)',
              '&:hover': { bgcolor: 'var(--glass-strong)' },
            }}
          >
            <CloseIcon />
          </IconButton>
          <IconButton
            onClick={(e) => { e.stopPropagation(); window.open(lightboxImage, '_blank'); }}
            sx={{
              position: 'absolute',
              top: 16,
              right: 64,
              color: 'white',
              bgcolor: 'var(--glass-bg)',
              '&:hover': { bgcolor: 'var(--glass-strong)' },
            }}
            title="เปิดในแท็บใหม่"
          >
            <ZoomInIcon />
          </IconButton>
          <Box
            component="img"
            src={lightboxImage}
            alt="รูปภาพขยาย"
            onClick={(e) => e.stopPropagation()}
            sx={{
              maxWidth: '95vw',
              maxHeight: '90vh',
              objectFit: 'contain',
              borderRadius: 2,
              cursor: 'default',
              boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
            }}
          />
          <Typography sx={{
            position: 'absolute',
            bottom: 24,
            color: 'var(--text-muted)',
            fontSize: '0.8rem',
          }}>
            คลิกที่ใดก็ได้เพื่อปิด
          </Typography>
        </Box>
      )}

      {/* Order Lookup Dialog */}
      <Dialog 
        open={orderLookupOpen} 
        onClose={() => setOrderLookupOpen(false)} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{ sx: { bgcolor: ADMIN_THEME.bgCard, color: ADMIN_THEME.text } }}
      >
        <DialogTitle sx={{ borderBottom: '1px solid ' + ADMIN_THEME.border, display: 'flex', alignItems: 'center', gap: 1 }}>
          <ReceiptIcon size={24} color="#2563eb" />
          ค้นหาออเดอร์ / ดูประวัติลูกค้า
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          {/* Search by Order Ref */}
          <Typography sx={{ fontSize: '0.85rem', color: ADMIN_THEME.textMuted, mb: 1 }}>
            ค้นหาจากหมายเลขออเดอร์
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="เช่น ABC123"
              value={orderSearchRef}
              onChange={(e) => setOrderSearchRef(e.target.value)}
              onKeyPress={(e) => { if (e.key === 'Enter') handleSearchOrder(); }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: ADMIN_THEME.text,
                  '& fieldset': { borderColor: ADMIN_THEME.border },
                  '&:hover fieldset': { borderColor: '#2563eb' },
                },
              }}
            />
            <Button
              variant="contained"
              onClick={handleSearchOrder}
              disabled={searchingOrder || !orderSearchRef.trim()}
              sx={{ bgcolor: '#2563eb', '&:hover': { bgcolor: '#1d4ed8' }, minWidth: 80 }}
            >
              {searchingOrder ? <CircularProgress size={20} color="inherit" /> : <SearchIcon />}
            </Button>
          </Box>
          
          {/* Search Result */}
          {foundOrder && (
            <Paper sx={{ p: 2, mb: 3, bgcolor: 'var(--surface)', borderRadius: 2 }}>
              {foundOrder.notFound ? (
                <Typography sx={{ color: '#f87171', textAlign: 'center' }}>
                  ไม่พบออเดอร์ "{orderSearchRef}"
                </Typography>
              ) : foundOrder.error ? (
                <Typography sx={{ color: '#f87171', textAlign: 'center' }}>
                  เกิดข้อผิดพลาดในการค้นหา
                </Typography>
              ) : (
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                    <Box sx={{
                      width: 40,
                      height: 40,
                      borderRadius: 1.5,
                      bgcolor: '#2563eb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontWeight: 700,
                      fontSize: '0.75rem',
                    }}>
                      #{foundOrder.ref?.slice(-3)}
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontWeight: 600, color: ADMIN_THEME.text }}>
                        ออเดอร์ #{foundOrder.ref}
                      </Typography>
                      <Typography sx={{ fontSize: '0.75rem', color: ADMIN_THEME.textMuted }}>
                        {foundOrder.customerName || foundOrder.name} · {foundOrder.customerEmail || foundOrder.email}
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      label={getOrderStatusLabel(foundOrder.status)}
                      sx={{
                        bgcolor: foundOrder.status === 'PAID' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(251, 191, 36, 0.2)',
                        color: foundOrder.status === 'PAID' ? '#22c55e' : '#fbbf24',
                        fontSize: '0.7rem',
                      }}
                    />
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', fontSize: '0.8rem', color: ADMIN_THEME.textMuted, mb: 2 }}>
                    <span>฿{foundOrder.totalAmount?.toLocaleString() || foundOrder.amount?.toLocaleString()}</span>
                    <span>{new Date(foundOrder.date || foundOrder.createdAt).toLocaleDateString('th-TH')}</span>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<ViewIcon />}
                      onClick={() => window.open(`/admin?tab=orders&ref=${foundOrder.ref}`, '_blank')}
                      sx={{ borderColor: ADMIN_THEME.border, color: ADMIN_THEME.text, fontSize: '0.75rem' }}
                    >
                      ดูรายละเอียด
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<SendIcon />}
                      onClick={() => handleSendOrderToChat(foundOrder)}
                      disabled={!selectedChat || selectedChat.status !== 'active'}
                      sx={{ bgcolor: '#22c55e', '&:hover': { bgcolor: '#16a34a' }, fontSize: '0.75rem' }}
                    >
                      ส่งในแชท
                    </Button>
                  </Box>
                </Box>
              )}
            </Paper>
          )}

          {/* Customer's Order History */}
          {selectedChat && (
            <>
              <Divider sx={{ borderColor: ADMIN_THEME.border, my: 2 }} />
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                <Typography sx={{ fontSize: '0.85rem', color: ADMIN_THEME.textMuted }}>
                  ประวัติออเดอร์ของ {selectedChat.customer_name}
                </Typography>
                <Button
                  size="small"
                  onClick={() => fetchCustomerOrders(selectedChat.customer_email)}
                  disabled={loadingCustomerOrders}
                  sx={{ color: '#2563eb', fontSize: '0.75rem' }}
                >
                  {loadingCustomerOrders ? <CircularProgress size={16} /> : <RefreshIcon size={16} />}
                </Button>
              </Box>
              <Box sx={{ maxHeight: 200, overflowY: 'auto' }}>
                {customerOrders.length === 0 ? (
                  <Typography sx={{ color: ADMIN_THEME.textMuted, fontSize: '0.8rem', textAlign: 'center', py: 2 }}>
                    {loadingCustomerOrders ? 'กำลังโหลด...' : 'กดปุ่มรีเฟรชเพื่อโหลดประวัติ'}
                  </Typography>
                ) : (
                  customerOrders.map((order) => (
                    <Paper
                      key={order.ref}
                      sx={{
                        p: 1.5,
                        mb: 1,
                        bgcolor: 'var(--surface)',
                        borderRadius: 1.5,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'rgba(37, 99, 235, 0.1)' },
                      }}
                      onClick={() => handleSendOrderToChat(order)}
                    >
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: ADMIN_THEME.text }}>
                          #{order.ref} · ฿{order.totalAmount?.toLocaleString() || order.amount?.toLocaleString()}
                        </Typography>
                        <Typography sx={{ fontSize: '0.7rem', color: ADMIN_THEME.textMuted }}>
                          {new Date(order.date || order.createdAt).toLocaleDateString('th-TH')} · {order.status}
                        </Typography>
                      </Box>
                      <SendIcon size={16} color="#2563eb" />
                    </Paper>
                  ))
                )}
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid ' + ADMIN_THEME.border, p: 2 }}>
          <Button onClick={() => setOrderLookupOpen(false)} sx={{ color: ADMIN_THEME.textMuted }}>ปิด</Button>
        </DialogActions>
      </Dialog>

      <Box sx={{ display: 'flex', height: isMobile ? 'calc(100vh - 120px)' : 'calc(100vh - 200px)', minHeight: 400 }}>
        {/* Chat List Panel */}
        <Paper sx={{
          width: isMobile ? '100%' : 340,
          flexShrink: 0,
          bgcolor: ADMIN_THEME.bgCard,
          borderRadius: isMobile ? 0 : 2,
          overflow: 'hidden',
          display: isMobile && mobileShowChat ? 'none' : 'flex',
          flexDirection: 'column',
          mr: isMobile ? 0 : 2,
          height: '100%',
        }}>
          <Box sx={{ p: 2, borderBottom: '1px solid ' + ADMIN_THEME.border }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
              <Typography sx={{ fontWeight: 700, color: ADMIN_THEME.text, fontSize: { xs: '0.9rem', sm: '1rem' } }}>
                <SupportAgentIcon size={24} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                แชทสนับสนุน
              </Typography>
              <Box>
                <IconButton size="small" onClick={() => setSettingsOpen(true)} sx={{ color: ADMIN_THEME.textMuted }}>
                  <SettingsIcon size={18} />
                </IconButton>
                <IconButton size="small" onClick={() => fetchChats()} sx={{ color: ADMIN_THEME.textMuted }}>
                  <RefreshIcon size={18} />
                </IconButton>
              </Box>
            </Box>
            {stats && (
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Chip size="small" icon={<DotIcon size={10} color="#fbbf24" />}
                  label={'รอ ' + stats.pendingCount}
                  sx={{ bgcolor: 'rgba(251, 191, 36, 0.1)', color: '#fbbf24', fontWeight: 500, fontSize: '0.7rem' }} />
                <Chip size="small" icon={<DotIcon size={10} color="#22c55e" />}
                  label={'Active ' + stats.activeCount}
                  sx={{ bgcolor: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', fontWeight: 500, fontSize: '0.7rem' }} />
                {stats.avgRating > 0 && (
                  <Chip size="small" icon={<StarIcon size={12} color="#fbbf24" />}
                    label={stats.avgRating.toFixed(1)}
                    sx={{ bgcolor: 'rgba(251, 191, 36, 0.1)', color: '#fbbf24', fontWeight: 500, fontSize: '0.7rem' }} />
                )}
              </Box>
            )}
          </Box>

          <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} variant="fullWidth"
            sx={{
              borderBottom: '1px solid ' + ADMIN_THEME.border,
              '& .MuiTab-root': { color: ADMIN_THEME.textMuted, minHeight: 36, fontSize: '0.7rem', px: 0.5, '&.Mui-selected': { color: '#2563eb' } },
              '& .MuiTabs-indicator': { bgcolor: '#2563eb' },
            }}>
            <Tab label="ทั้งหมด" />
            <Tab label={<Badge badgeContent={stats?.pendingCount} color="warning" max={99}><span>รอรับ</span></Badge>} />
            <Tab label="ของฉัน" />
            <Tab label="ปิด" />
          </Tabs>

          <Box sx={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <Box sx={{ display: 'grid', placeItems: 'center', height: 200 }}>
                <CircularProgress size={32} sx={{ color: '#2563eb' }} />
              </Box>
            ) : chats.length === 0 ? (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <ChatIcon size={48} color={ADMIN_THEME.textMuted} style={{ marginBottom: 8 }} />
                <Typography sx={{ color: ADMIN_THEME.textMuted }}>ไม่มีแชท</Typography>
              </Box>
            ) : (
              <List sx={{ py: 0 }}>
                {chats.map((chat) => (
                  <React.Fragment key={chat.id}>
                    <ListItemButton selected={selectedChat?.id === chat.id} onClick={() => handleSelectChat(chat.id)}
                      sx={{ py: 1.5, '&.Mui-selected': { bgcolor: 'rgba(37, 99, 235, 0.1)', borderLeft: '3px solid #2563eb' }, '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.05)' } }}>
                      <ListItemAvatar>
                        <Badge badgeContent={chat.unread_count} color="error" overlap="circular">
                          <Avatar 
                            src={chat.customer_avatar || undefined}
                            sx={{ bgcolor: getStatusColor(chat.status), width: 40, height: 40 }}
                          >
                            {!chat.customer_avatar && <PersonIcon />}
                          </Avatar>
                        </Badge>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Typography sx={{ fontWeight: chat.unread_count > 0 ? 700 : 500, color: ADMIN_THEME.text, fontSize: '0.85rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {chat.customer_name}
                            </Typography>
                            <Chip size="small" label={getStatusLabel(chat.status)} sx={{ height: 16, fontSize: '0.55rem', bgcolor: getStatusColor(chat.status) + '20', color: getStatusColor(chat.status) }} />
                          </Box>
                        }
                        secondary={
                          <Box component="span" sx={{ display: 'block' }}>
                            <Typography component="span" sx={{ display: 'block', color: ADMIN_THEME.textMuted, fontSize: '0.7rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {chat.last_message_preview || chat.subject}
                            </Typography>
                            <Typography component="span" sx={{ display: 'block', color: ADMIN_THEME.textMuted, fontSize: '0.65rem', mt: 0.25 }}>
                              {formatTime(chat.last_message_at || chat.created_at)}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItemButton>
                    <Divider sx={{ borderColor: ADMIN_THEME.border }} />
                  </React.Fragment>
                ))}
              </List>
            )}
          </Box>
        </Paper>

        {/* Chat Detail Panel */}
        <Paper sx={{
          flex: 1,
          bgcolor: ADMIN_THEME.bgCard,
          borderRadius: isMobile ? 0 : 2,
          overflow: 'hidden',
          display: isMobile && !mobileShowChat ? 'none' : 'flex',
          flexDirection: 'column',
          height: '100%',
          minHeight: 0,
        }}>
          {selectedChat ? (
            <>
              <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid ' + ADMIN_THEME.border, display: 'flex', alignItems: 'center', gap: 1 }}>
                {isMobile && (
                  <IconButton onClick={handleMobileBack} sx={{ color: ADMIN_THEME.text, mr: 0.5 }}>
                    <ArrowBackIcon />
                  </IconButton>
                )}
                <Avatar 
                  src={selectedChat.customer_avatar || undefined} 
                  sx={{ bgcolor: getStatusColor(selectedChat.status), width: 36, height: 36 }}
                >
                  {!selectedChat.customer_avatar && <PersonIcon />}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700, color: ADMIN_THEME.text, fontSize: '0.9rem' }}>{selectedChat.customer_name}</Typography>
                  <Typography sx={{ fontSize: '0.7rem', color: ADMIN_THEME.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selectedChat.subject}
                  </Typography>
                </Box>
                {/* Order Lookup Button */}
                <IconButton
                  onClick={() => {
                    setOrderLookupOpen(true);
                    setFoundOrder(null);
                    setOrderSearchRef('');
                    fetchCustomerOrders(selectedChat.customer_email);
                  }}
                  sx={{ 
                    color: '#22c55e',
                    bgcolor: 'rgba(34, 197, 94, 0.1)',
                    '&:hover': { bgcolor: 'rgba(34, 197, 94, 0.2)' },
                  }}
                  title="ค้นหาออเดอร์"
                >
                  <ReceiptIcon size={20} />
                </IconButton>
                {selectedChat.status === 'pending' && (
                  <Button variant="contained" size="small" startIcon={<AcceptIcon />} onClick={() => handleAcceptChat(selectedChat.id)}
                    sx={{ bgcolor: '#22c55e', '&:hover': { bgcolor: '#16a34a' }, fontSize: '0.75rem', py: 0.5 }}>
                    รับเคส
                  </Button>
                )}
                {selectedChat.status === 'active' && (
                  <Button variant="outlined" size="small" startIcon={<CheckCircleIcon />} onClick={handleCloseChat}
                    sx={{ borderColor: '#64748b', color: 'var(--text-muted)', '&:hover': { borderColor: '#94a3b8', bgcolor: 'rgba(148, 163, 184, 0.1)' }, fontSize: '0.75rem', py: 0.5 }}>
                    ปิด
                  </Button>
                )}
                {selectedChat.status === 'closed' && selectedChat.rating && (
                  <Rating value={selectedChat.rating} readOnly size="small" />
                )}
              </Box>

              <Box sx={{ flex: 1, overflowY: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 1.5, bgcolor: 'var(--surface)' }}
                onScroll={(e) => {
                  const el = e.target as HTMLDivElement;
                  isUserScrollingRef.current = el.scrollHeight - el.scrollTop - el.clientHeight > 100;
                }}>
                {(() => {
                  const messages = selectedChat.messages;
                  const lastAdminMsgIndex = messages.map(m => m.sender).lastIndexOf('admin');
                  return messages.map((msg, index) => {
                  const { text, imageUrl } = parseMessage(msg.message);
                  const isLastAdminMessage = msg.sender === 'admin' && index === lastAdminMsgIndex;
                  return (
                    <Box key={msg.id} sx={{ display: 'flex', justifyContent: msg.sender === 'admin' ? 'flex-end' : msg.sender === 'system' ? 'center' : 'flex-start' }}>
                      {msg.sender === 'system' ? (
                        <Chip size="small" label={msg.message} sx={{ bgcolor: 'var(--glass-bg)', color: ADMIN_THEME.textMuted, fontSize: '0.7rem' }} />
                      ) : (
                        <Box sx={{ maxWidth: { xs: '85%', sm: '75%' }, display: 'flex', flexDirection: msg.sender === 'admin' ? 'row-reverse' : 'row', alignItems: 'flex-start', gap: 1 }}>
                          {msg.sender === 'customer' && (
                            <Avatar src={msg.sender_avatar || undefined} sx={{ width: 28, height: 28, bgcolor: '#fbbf24', flexShrink: 0 }}>
                              {!msg.sender_avatar && <PersonIcon size={16} />}
                            </Avatar>
                          )}
                          {msg.sender === 'admin' && (
                            <Avatar src={msg.sender_avatar || undefined} sx={{ width: 28, height: 28, bgcolor: '#2563eb', flexShrink: 0 }}>
                              {!msg.sender_avatar && <SupportAgentIcon size={16} />}
                            </Avatar>
                          )}
                          <Box sx={{ minWidth: 0 }}>
                            <Paper elevation={0} sx={{
                              px: 1.5, py: 1,
                              bgcolor: msg.sender === 'admin' ? '#2563eb' : ADMIN_THEME.bgCard,
                              color: ADMIN_THEME.text,
                              borderRadius: 2,
                              borderBottomRightRadius: msg.sender === 'admin' ? 4 : 16,
                              borderBottomLeftRadius: msg.sender === 'customer' ? 4 : 16,
                            }}>
                              {text && <Typography sx={{ fontSize: '0.85rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.4 }}>{text}</Typography>}
                              {/* Order Reference Card */}
                              {parseMessage(msg.message).orderRef && (
                                <Box
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOrderSearchRef(parseMessage(msg.message).orderRef || '');
                                    setOrderLookupOpen(true);
                                    handleSearchOrder();
                                  }}
                                  sx={{
                                    mt: text ? 1 : 0,
                                    p: 1.5,
                                    bgcolor: msg.sender === 'admin' ? 'var(--glass-bg)' : 'var(--surface)',
                                    borderRadius: 1.5,
                                    border: '1px solid',
                                    borderColor: msg.sender === 'admin' ? 'var(--glass-border)' : ADMIN_THEME.border,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    '&:hover': { 
                                      bgcolor: msg.sender === 'admin' ? 'var(--glass-strong)' : 'rgba(37, 99, 235, 0.1)',
                                    },
                                  }}
                                >
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Box sx={{
                                      width: 32,
                                      height: 32,
                                      borderRadius: 1,
                                      bgcolor: '#22c55e',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}>
                                      <ReceiptIcon size={18} color="white" />
                                    </Box>
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                      <Typography sx={{ 
                                        fontSize: '0.8rem', 
                                        fontWeight: 600,
                                        color: msg.sender === 'admin' ? 'white' : ADMIN_THEME.text,
                                      }}>
                                        ออเดอร์ #{parseMessage(msg.message).orderRef}
                                      </Typography>
                                      <Typography sx={{ 
                                        fontSize: '0.7rem',
                                        color: msg.sender === 'admin' ? 'var(--foreground)' : ADMIN_THEME.textMuted,
                                      }}>
                                        คลิกเพื่อดูรายละเอียด
                                      </Typography>
                                    </Box>
                                    <ViewIcon size={16} color={msg.sender === 'admin' ? 'var(--text-muted)' : ADMIN_THEME.textMuted} />
                                  </Box>
                                </Box>
                              )}
                              {imageUrl && (
                                <Box component="img" src={imageUrl} alt="รูปภาพ" loading="lazy"
                                  sx={{ width: '100%', maxWidth: { xs: 160, sm: 200 }, height: 'auto', maxHeight: { xs: 140, sm: 180 }, objectFit: 'cover', borderRadius: 1.5, mt: text ? 1 : 0, cursor: 'zoom-in', transition: 'transform 0.2s', '&:hover': { transform: 'scale(1.02)' } }}
                                  onClick={(e) => { e.stopPropagation(); setLightboxImage(imageUrl); }} />
                              )}
                            </Paper>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25, justifyContent: msg.sender === 'admin' ? 'flex-end' : 'flex-start', flexWrap: 'wrap' }}>
                              <Typography sx={{ fontSize: '0.6rem', color: ADMIN_THEME.textMuted }}>
                                {new Date(msg.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} · {formatTime(msg.created_at)}
                              </Typography>
                              {/* Read receipts only for the last admin message */}
                              {isLastAdminMessage && (
                                <>
                                  {msg.is_read 
                                    ? <DoneAllIcon size={12} color="#22c55e" /> 
                                    : <DoneIcon size={12} color={ADMIN_THEME.textMuted} />
                                  }
                                  {msg.is_read && msg.read_at && (
                                    <Typography sx={{ fontSize: '0.55rem', color: '#22c55e' }}>
                                      ลูกค้าอ่านแล้ว {formatTime(msg.read_at)}
                                    </Typography>
                                  )}
                                </>
                              )}
                            </Box>
                          </Box>
                        </Box>
                      )}
                    </Box>
                  );
                });
                })()}
                
                {otherTyping && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar sx={{ width: 28, height: 28, bgcolor: '#fbbf24' }}><PersonIcon size={16} /></Avatar>
                    <Paper sx={{ px: 2, py: 1, bgcolor: ADMIN_THEME.bgCard, borderRadius: 2 }}>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: ADMIN_THEME.textMuted, animation: 'bounce 1.4s infinite ease-in-out both', animationDelay: '0s' }} />
                        <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: ADMIN_THEME.textMuted, animation: 'bounce 1.4s infinite ease-in-out both', animationDelay: '0.2s' }} />
                        <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: ADMIN_THEME.textMuted, animation: 'bounce 1.4s infinite ease-in-out both', animationDelay: '0.4s' }} />
                      </Box>
                    </Paper>
                  </Box>
                )}
                <div ref={messagesEndRef} />
              </Box>

              {selectedChat.status === 'active' && selectedChat.admin_email === session?.user?.email && (
                <Box sx={{ px: 2, py: 1, borderTop: '1px solid ' + ADMIN_THEME.border, overflowX: 'auto', display: 'flex', gap: 0.5 }}>
                  {chatSettings.quick_replies.map((reply, idx) => (
                    <Chip key={idx} label={reply} size="small" onClick={() => handleQuickReply(reply)}
                      sx={{ bgcolor: 'rgba(37, 99, 235, 0.1)', color: '#2563eb', fontSize: '0.7rem', cursor: 'pointer', '&:hover': { bgcolor: 'rgba(37, 99, 235, 0.2)' }, flexShrink: 0 }} />
                  ))}
                </Box>
              )}

              {previewImage && (
                <Box sx={{ px: 2, py: 1, bgcolor: 'var(--surface)', borderTop: '1px solid ' + ADMIN_THEME.border }}>
                  <Box sx={{ position: 'relative', display: 'inline-block' }}>
                    <Box component="img" src={previewImage} alt="Preview" sx={{ maxHeight: 80, borderRadius: 1 }} />
                    <IconButton size="small" onClick={() => setPreviewImage(null)}
                      sx={{ position: 'absolute', top: -8, right: -8, bgcolor: '#ef4444', color: 'white', width: 20, height: 20, '&:hover': { bgcolor: '#dc2626' } }}>
                      <CloseIcon size={14} />
                    </IconButton>
                  </Box>
                </Box>
              )}

              {selectedChat.status === 'active' && selectedChat.admin_email === session?.user?.email && (
                <Box sx={{ p: 1.5, borderTop: '1px solid ' + ADMIN_THEME.border, display: 'flex', gap: 1 }}>
                  <IconButton onClick={() => fileInputRef.current?.click()} disabled={uploadingImage}
                    sx={{ color: ADMIN_THEME.textMuted, '&:hover': { color: '#2563eb' } }}>
                    <ImageIcon />
                  </IconButton>
                  <TextField fullWidth size="small" placeholder="พิมพ์ข้อความ..." value={message}
                    onChange={(e) => { setMessage(e.target.value); sendTypingIndicator(); }}
                    onKeyPress={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                    disabled={sending || uploadingImage}
                    sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'var(--surface)', color: ADMIN_THEME.text, fontSize: '0.9rem', '& fieldset': { borderColor: ADMIN_THEME.border }, '&:hover fieldset': { borderColor: '#2563eb' }, '&.Mui-focused fieldset': { borderColor: '#2563eb' } } }} />
                  <IconButton onClick={handleSendMessage} disabled={(!message.trim() && !previewImage) || sending || uploadingImage}
                    sx={{ bgcolor: '#2563eb', color: 'white', '&:hover': { bgcolor: '#1d4ed8' }, '&.Mui-disabled': { bgcolor: ADMIN_THEME.border } }}>
                    {sending || uploadingImage ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
                  </IconButton>
                </Box>
              )}
            </>
          ) : (
            /* Empty State - No Chat Selected */
            <Box sx={{ 
              flex: 1, 
              display: 'flex', 
              flexDirection: 'column',
              alignItems: 'center', 
              background: 'var(--background)',
              overflowY: 'auto',
              minHeight: 0,
            }}>
              {/* Inner content wrapper for centering */}
              <Box sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100%',
                p: 3,
                py: 4,
              }}>
              {/* Animated Icon */}
              <Box sx={{
                width: 100,
                height: 100,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.2) 0%, rgba(30, 64, 175, 0.2) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 3,
                flexShrink: 0,
                border: '2px solid rgba(37, 99, 235, 0.3)',
                animation: 'pulse 2s infinite',
                '@keyframes pulse': {
                  '0%': { boxShadow: '0 0 0 0 rgba(37, 99, 235, 0.4)' },
                  '70%': { boxShadow: '0 0 0 20px rgba(37, 99, 235, 0)' },
                  '100%': { boxShadow: '0 0 0 0 rgba(37, 99, 235, 0)' },
                },
              }}>
                <ChatIcon size={48} color="#2563eb" />
              </Box>

              <Typography sx={{ 
                color: ADMIN_THEME.text, 
                fontSize: '1.25rem', 
                fontWeight: 700, 
                mb: 1,
                textAlign: 'center',
              }}>
                ศูนย์กลางการสนทนา
              </Typography>
              
              <Typography sx={{ 
                color: ADMIN_THEME.textMuted, 
                fontSize: '0.9rem',
                textAlign: 'center',
                maxWidth: 280,
                mb: 3,
                lineHeight: 1.6,
              }}>
                {isMobile ? 'เลือกแชทจากรายการเพื่อเริ่มสนทนา' : 'เลือกแชทจากรายการด้านซ้ายเพื่อเริ่มสนทนากับลูกค้า'}
              </Typography>

              {/* Stats Summary */}
              <Box sx={{ 
                display: 'flex', 
                gap: 2, 
                flexWrap: 'wrap',
                justifyContent: 'center',
              }}>
                <Box sx={{
                  px: 2.5,
                  py: 1.5,
                  borderRadius: 2,
                  bgcolor: 'rgba(251, 191, 36, 0.1)',
                  border: '1px solid rgba(251, 191, 36, 0.3)',
                  textAlign: 'center',
                  minWidth: 90,
                }}>
                  <Typography sx={{ color: '#fbbf24', fontSize: '1.5rem', fontWeight: 700 }}>
                    {stats?.pendingCount || 0}
                  </Typography>
                  <Typography sx={{ color: '#fbbf24', fontSize: '0.7rem', opacity: 0.8 }}>
                    รอรับเคส
                  </Typography>
                </Box>
                <Box sx={{
                  px: 2.5,
                  py: 1.5,
                  borderRadius: 2,
                  bgcolor: 'rgba(34, 197, 94, 0.1)',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                  textAlign: 'center',
                  minWidth: 90,
                }}>
                  <Typography sx={{ color: '#22c55e', fontSize: '1.5rem', fontWeight: 700 }}>
                    {stats?.activeCount || 0}
                  </Typography>
                  <Typography sx={{ color: '#22c55e', fontSize: '0.7rem', opacity: 0.8 }}>
                    กำลังสนทนา
                  </Typography>
                </Box>
              </Box>

              {/* Quick Tips */}
              <Box sx={{ 
                mt: 4, 
                p: 2, 
                borderRadius: 2, 
                bgcolor: 'rgba(37, 99, 235, 0.1)',
                border: '1px solid rgba(37, 99, 235, 0.2)',
                maxWidth: 320,
              }}>
                <Typography sx={{ 
                  color: '#2563eb', 
                  fontSize: '0.75rem', 
                  fontWeight: 600,
                  mb: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                }}>
                  เคล็ดลับ
                </Typography>
                <Typography sx={{ color: ADMIN_THEME.textMuted, fontSize: '0.75rem', lineHeight: 1.5 }}>
                  คลิกที่แชทในรายการเพื่อดูรายละเอียด กดปุ่ม &quot;รับเคส&quot; เพื่อเริ่มช่วยเหลือลูกค้า
                </Typography>
              </Box>
              </Box>
            </Box>
          )}
        </Paper>
      </Box>

      <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: ADMIN_THEME.bgCard, color: ADMIN_THEME.text } }}>
        <DialogTitle sx={{ borderBottom: '1px solid ' + ADMIN_THEME.border }}>
          <SettingsIcon size={24} style={{ marginRight: 8, verticalAlign: 'middle' }} />
          ตั้งค่าแชท
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <FormControlLabel
            control={<Switch checked={chatSettings.auto_reply_enabled} onChange={(e) => setChatSettings(s => ({ ...s, auto_reply_enabled: e.target.checked }))} />}
            label="เปิดใช้ข้อความตอบอัตโนมัติ"
            sx={{ color: ADMIN_THEME.text, mb: 2 }}
          />
          <TextField fullWidth multiline rows={2} label="ข้อความตอบอัตโนมัติ" value={chatSettings.auto_reply_message}
            onChange={(e) => setChatSettings(s => ({ ...s, auto_reply_message: e.target.value }))}
            sx={{ mb: 2, '& .MuiOutlinedInput-root': { color: ADMIN_THEME.text, '& fieldset': { borderColor: ADMIN_THEME.border } }, '& .MuiInputLabel-root': { color: ADMIN_THEME.textMuted } }} />
          <FormControlLabel
            control={<Switch checked={chatSettings.notification_sound} onChange={(e) => setChatSettings(s => ({ ...s, notification_sound: e.target.checked }))} />}
            label="เปิดเสียงแจ้งเตือน"
            sx={{ color: ADMIN_THEME.text }}
          />
          <Typography sx={{ color: ADMIN_THEME.textMuted, mt: 3, mb: 1, fontSize: '0.9rem' }}>ข้อความตอบด่วน</Typography>
          {chatSettings.quick_replies.map((reply, idx) => (
            <TextField key={idx} fullWidth size="small" value={reply}
              onChange={(e) => {
                const newReplies = [...chatSettings.quick_replies];
                newReplies[idx] = e.target.value;
                setChatSettings(s => ({ ...s, quick_replies: newReplies }));
              }}
              sx={{ mb: 1, '& .MuiOutlinedInput-root': { color: ADMIN_THEME.text, fontSize: '0.85rem', '& fieldset': { borderColor: ADMIN_THEME.border } } }} />
          ))}
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid ' + ADMIN_THEME.border, p: 2 }}>
          <Button onClick={() => setSettingsOpen(false)} sx={{ color: ADMIN_THEME.textMuted }}>ยกเลิก</Button>
          <Button variant="contained" onClick={handleSaveSettings} sx={{ bgcolor: '#2563eb', '&:hover': { bgcolor: '#1d4ed8' } }}>บันทึก</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
