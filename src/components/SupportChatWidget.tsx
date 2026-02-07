// src/components/SupportChatWidget.tsx
// Customer Support Chat Widget - Floating chat button with chatbot option

'use client';

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
import { Headphones as SupportAgentIcon, X as CloseIcon, Send as SendIcon, Clock as TimeIcon, CheckCircle2 as CheckCircleIcon, Star as StarIcon, Image as ImageIcon, Bot as ChatbotIcon, Check as DoneIcon, CheckCheck as DoneAllIcon, MessageCircle as ChatIcon, History as HistoryIcon, ArrowLeft as ArrowBackIcon, Plus as AddIcon, MoreVertical as MoreVertIcon, Trash2 as DeleteIcon, Reply as ReplyIcon, ZoomIn as ZoomInIcon, ZoomOut as ZoomOutIcon, Receipt as ReceiptIcon, ShoppingBag as ShoppingBagIcon } from 'lucide-react';
import { useNotification } from './NotificationContext';

// ชื่อแอดมินที่แสดง (สามารถตั้งค่าได้)
const ADMIN_DISPLAY_NAME = 'ทีมงาน PSU SCC';

interface SupportChatWidgetProps {
  onOpenChatbot?: () => void;
  hideMobileFab?: boolean;
  externalOpen?: boolean;
  onExternalOpenHandled?: () => void;
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

export default function SupportChatWidget({ onOpenChatbot, hideMobileFab, externalOpen, onExternalOpenHandled }: SupportChatWidgetProps) {
  const { data: session, status: authStatus } = useSession();
  const { warning: toastWarning, error: toastError } = useNotification();
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [chat, setChat] = useState<ChatWithMessages | null>(null);
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
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [adminTyping, setAdminTyping] = useState(false);
  const [messageMenuAnchor, setMessageMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [unsending, setUnsending] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [replyToMessage, setReplyToMessage] = useState<{ id: string; text: string; sender: string } | null>(null);
  const [orderHistory, setOrderHistory] = useState<any[]>([]);
  const [showOrderPicker, setShowOrderPicker] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom of messages
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, []);

  // Fetch active chat
  const fetchActiveChat = useCallback(async (markRead = false) => {
    if (!session?.user?.email) return;
    
    try {
      const res = await fetch('/api/support-chat');
      const data = await res.json();
      
      if (data.chat) {
        // Fetch full chat with messages (markRead only on first open, not polling)
        const chatRes = await fetch(`/api/support-chat/${data.chat.id}${markRead ? '?markRead=true' : ''}`);
        const chatData = await chatRes.json();
        
        if (chatData.chat) {
          setChat(chatData.chat);
          setUnreadCount(chatData.chat.customer_unread_count || 0);
          setShowHistory(false);
          
          // Show rating dialog if chat is closed and not rated
          if (chatData.chat.status === 'closed' && !chatData.chat.rating) {
            setShowRating(true);
          }
        }
      } else {
        setChat(null);
        setShowNewChat(true);
      }
    } catch (error) {
      console.error('Error fetching chat:', error);
    }
  }, [session?.user?.email]);

  // Fetch chat history (all closed chats)
  const fetchChatHistory = useCallback(async () => {
    if (!session?.user?.email) return;
    
    try {
      const res = await fetch('/api/support-chat?action=history');
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
      const res = await fetch(`/api/support-chat/${chatId}`);
      const data = await res.json();
      if (data.chat) {
        setChat(data.chat);
        setShowHistory(false);
        setShowNewChat(false);
      }
    } catch (error) {
      console.error('Error viewing chat:', error);
    }
  }, []);

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Send typing indicator to server
  const sendTypingIndicator = useCallback(() => {
    if (!chat || chat.status !== 'active') return;
    
    fetch(`/api/support-chat/${chat.id}/typing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isTyping: true }),
    }).catch(() => {});

    // Clear previous timeout and set new one to stop typing
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      if (chat) {
        fetch(`/api/support-chat/${chat.id}/typing`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isTyping: false }),
        }).catch(() => {});
      }
    }, 3000);
  }, [chat?.id, chat?.status]);

  // Poll for new messages and typing indicator
  useEffect(() => {
    if (open && chat && chat.status !== 'closed') {
      pollIntervalRef.current = setInterval(async () => {
        try {
          // Fetch chat messages
          const res = await fetch(`/api/support-chat/${chat.id}`);
          const data = await res.json();
          
          if (data.chat) {
            setChat(data.chat);
            if (data.chat.status === 'closed' && !data.chat.rating) {
              setShowRating(true);
            }
          }

          // Auto mark as read when customer is viewing the chat
          if (chat.status === 'active' && !showHistory && !showNewChat && !showRating) {
            fetch(`/api/support-chat/${chat.id}/read`, { method: 'POST' }).catch(() => {});
          }

          // Fetch typing indicator
          const typingRes = await fetch(`/api/support-chat/${chat.id}/typing`);
          const typingData = await typingRes.json();
          setAdminTyping(typingData.isTyping || false);
        } catch (error) {
          console.error('Error polling chat:', error);
        }
      }, 3000); // Poll every 3 seconds
      
      return () => {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
        }
      };
    }
  }, [open, chat?.id, chat?.status, showHistory, showNewChat, showRating]);

  // Mark messages as read when user is actively viewing chat
  // This is triggered when user switches from history/new chat view back to active chat
  useEffect(() => {
    if (open && chat?.id && !showHistory && !showNewChat && !showRating && chat.status === 'active') {
      // Call read API when user is actively viewing the chat
      fetch(`/api/support-chat/${chat.id}/read`, { method: 'POST' }).catch(() => {});
    }
  }, [open, chat?.id, showHistory, showNewChat, showRating, chat?.status]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (open && chat?.messages) {
      scrollToBottom();
    }
  }, [chat?.messages, open, scrollToBottom]);

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
    
    setSending(true);
    try {
      const res = await fetch('/api/support-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: subject.trim() || 'สอบถามข้อมูล',
          message: message.trim(),
        }),
      });
      
      const data = await res.json();
      
      if (data.chat) {
        // Fetch full chat with messages
        const chatRes = await fetch(`/api/support-chat/${data.chat.id}`);
        const chatData = await chatRes.json();
        
        if (chatData.chat) {
          setChat(chatData.chat);
          setShowNewChat(false);
          setMessage('');
          setSubject('');
        }
      }
    } catch (error) {
      console.error('Error creating chat:', error);
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
      toastWarning('กรุณาเลือกไฟล์รูปภาพเท่านั้น');
      return;
    }

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toastWarning('ไฟล์ต้องมีขนาดไม่เกิน 5MB');
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPreviewImage(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Upload image and send message
  const handleSendWithImage = async () => {
    if (!previewImage || !chat) return;

    setUploadingImage(true);
    try {
      // Determine mime type from base64
      const mimeMatch = previewImage.match(/data:([^;]+);/);
      const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      const ext = mime.split('/')[1] || 'jpg';
      
      // Upload image first
      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base64: previewImage,
          filename: `chat_${Date.now()}.${ext}`,
          mime: mime,
        }),
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
        // Send message with image
        const imageUrl = uploadData.data.url;
        const msgContent = message.trim() ? `${message.trim()}\n[รูปภาพ: ${imageUrl}]` : `[รูปภาพ: ${imageUrl}]`;
        
        await fetch(`/api/support-chat/${chat.id}/message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: msgContent }),
        });

        // Refresh chat
        const chatRes = await fetch(`/api/support-chat/${chat.id}`);
        const chatData = await chatRes.json();
        if (chatData.chat) {
          setChat(chatData.chat);
        }

        setMessage('');
        setPreviewImage(null);
      } else {
        throw new Error(uploadData.message || 'อัปโหลดรูปภาพไม่สำเร็จ');
      }
    } catch (error: any) {
      console.error('Error uploading image:', error);
      toastError(error?.message || 'เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ');
    } finally {
      setUploadingImage(false);
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
    try {
      // Build message with reply prefix if replying
      let finalMessage = message.trim();
      if (replyToMessage) {
        const replyPreview = replyToMessage.text.length > 50 
          ? replyToMessage.text.substring(0, 50) + '...' 
          : replyToMessage.text;
        finalMessage = `[ตอบกลับ: "${replyPreview}"]\n${finalMessage}`;
      }
      
      const res = await fetch(`/api/support-chat/${chat.id}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: finalMessage }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        // Refresh chat
        const chatRes = await fetch(`/api/support-chat/${chat.id}`);
        const chatData = await chatRes.json();
        
        if (chatData.chat) {
          setChat(chatData.chat);
        }
        
        setMessage('');
        setReplyToMessage(null);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  // Handle reply to message
  const handleReplyToMessage = (msg: ChatMessage) => {
    const previewText = msg.message.replace(/\[รูปภาพ: [^\]]+\]/g, '[รูปภาพ]').trim() || '[รูปภาพ]';
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
      const res = await fetch(`/api/support-chat/${chat.id}/message/${messageId}`, {
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
      const res = await fetch(`/api/support-chat/${chat.id}/rate`, {
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

  // Format time ago (e.g., "5 นาทีที่แล้ว")
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'เมื่อกี้';
    if (diffMins < 60) return `${diffMins} นาทีที่แล้ว`;
    if (diffHours < 24) return `${diffHours} ชั่วโมงที่แล้ว`;
    return `${diffDays} วันที่แล้ว`;
  };

  // Parse message to extract image URL and order ref
  const parseMessage = (msg: string) => {
    // Support both full URLs and /api/image/ paths
    const imageMatch = msg.match(/\[รูปภาพ: (\/api\/image\/[^\]]+|https?:\/\/[^\]]+)\]/);
    const orderMatch = msg.match(/\[ORDER_REF:([^\]]+)\]/);
    
    let text = msg;
    let imageUrl = null;
    let orderRef = null;
    
    if (imageMatch) {
      imageUrl = imageMatch[1];
      text = text.replace(imageMatch[0], '').trim();
    }
    if (orderMatch) {
      orderRef = orderMatch[1];
      text = text.replace(orderMatch[0], '').trim();
    }
    
    return { text, imageUrl, orderRef };
  };

  // Get user avatar
  const getUserAvatar = () => session?.user?.image || null;

  // Fetch user's order history for attaching to chat
  const fetchOrderHistory = useCallback(async () => {
    if (!session?.user?.email) return;
    setLoadingOrders(true);
    try {
      const res = await fetch('/api/orders');
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
    
    const orderMsg = `*ออเดอร์ #${order.ref}*
ยอด: ฿${order.totalAmount?.toLocaleString() || order.amount?.toLocaleString() || 0}
วันที่: ${new Date(order.date || order.createdAt).toLocaleDateString('th-TH')}
สถานะ: ${getStatusLabel(order.status)}
[ORDER_REF:${order.ref}]`;
    
    setSending(true);
    try {
      const res = await fetch(`/api/support-chat/${chat.id}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: orderMsg }),
      });
      
      if (res.ok) {
        const chatRes = await fetch(`/api/support-chat/${chat.id}`);
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

  // Get status label in Thai
  const getStatusLabel = (status: string) => {
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

  // Show loading spinner while checking auth
  if (authStatus === 'loading') return null;

  // Check if logged in for support mode
  const isLoggedIn = !!session?.user?.email;

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

      {/* Floating Chat Button */}
      <Zoom in={!open}>
        <Box
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 1200,
            display: hideMobileFab ? { xs: 'none', md: 'block' } : 'block',
          }}
        >
          <Badge
            badgeContent={unreadCount}
            color="error"
            overlap="circular"
            sx={{
              '& .MuiBadge-badge': {
                right: 8,
                top: 8,
              },
            }}
          >
            <IconButton
              onClick={handleOpenMenu}
              sx={{
                width: 60,
                height: 60,
                bgcolor: '#0071e3',
                color: 'white',
                boxShadow: '0 4px 20px rgba(0,113,227, 0.4)',
                '&:hover': {
                  bgcolor: '#1d4ed8',
                  transform: 'scale(1.05)',
                },
                transition: 'all 0.2s ease',
              }}
            >
              <ChatIcon size={28} />
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
            primary="ถามแชทบอท" 
            secondary="ตอบคำถามอัตโนมัติ 24 ชม."
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
            primary="ติดต่อแอดมิน" 
            secondary={isLoggedIn ? "แชทกับทีมงานโดยตรง" : "ต้องเข้าสู่ระบบก่อน"}
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
            primary={unsending ? "กำลังยกเลิก..." : "ยกเลิกข้อความ"}
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
              primary="ตอบกลับ"
              primaryTypographyProps={{ sx: { fontWeight: 500 } }}
            />
          </MenuItem>
        )}
      </Menu>

      {/* Image Lightbox - Enhanced Fullscreen */}
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
            animation: 'fadeIn 0.2s ease',
            '@keyframes fadeIn': {
              '0%': { opacity: 0 },
              '100%': { opacity: 1 },
            },
          }}
        >
          {/* Close button */}
          <IconButton
            onClick={() => setLightboxImage(null)}
            sx={{
              position: 'absolute',
              top: 16,
              right: 16,
              color: 'white',
              bgcolor: 'var(--glass-bg)',
              backdropFilter: 'blur(8px)',
              '&:hover': { bgcolor: 'var(--glass-bg)' },
              zIndex: 10,
            }}
          >
            <CloseIcon size={24} />
          </IconButton>
          
          {/* Zoom controls */}
          <Box sx={{
            position: 'absolute',
            bottom: 80,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: 1,
            bgcolor: 'var(--glass-bg)',
            backdropFilter: 'blur(8px)',
            borderRadius: 3,
            p: 0.5,
            zIndex: 10,
          }}>
            <IconButton
              onClick={(e) => { e.stopPropagation(); window.open(lightboxImage, '_blank'); }}
              sx={{ color: 'white', '&:hover': { bgcolor: 'var(--glass-bg)' } }}
              title="เปิดในแท็บใหม่"
            >
              <ZoomInIcon size={24} />
            </IconButton>
          </Box>
          
          {/* Image */}
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
              animation: 'scaleIn 0.2s ease',
              '@keyframes scaleIn': {
                '0%': { transform: 'scale(0.9)', opacity: 0 },
                '100%': { transform: 'scale(1)', opacity: 1 },
              },
            }}
          />
          <Typography
            sx={{
              position: 'absolute',
              bottom: 24,
              left: '50%',
              transform: 'translateX(-50%)',
              color: 'var(--text-muted)',
              fontSize: '0.8rem',
            }}
          >
            คลิกที่ใดก็ได้เพื่อปิด หรือกด ESC
          </Typography>
        </Box>
      )}

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
                เลือกออเดอร์ที่ต้องการแนบ
              </Typography>
              <IconButton size="small" onClick={() => setShowOrderPicker(false)}>
                <CloseIcon size={24} />
              </IconButton>
            </Box>
            
            {/* Order List */}
            <Box sx={{ flex: 1, overflowY: 'auto', p: 1 }}>
              {loadingOrders ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress size={32} sx={{ color: 'var(--primary)' }} />
                </Box>
              ) : orderHistory.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <ShoppingBagIcon size={48} color="#86868b" style={{ marginBottom: 8 }} />
                  <Typography sx={{ color: 'var(--text-muted)' }}>ไม่พบประวัติการสั่งซื้อ</Typography>
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
                          ออเดอร์ #{order.ref}
                        </Typography>
                        <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                          ฿{order.totalAmount?.toLocaleString() || order.amount?.toLocaleString() || 0} · {new Date(order.date || order.createdAt).toLocaleDateString('th-TH')}
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
              background: 'linear-gradient(135deg, #0071e3 0%, #1d4ed8 100%)',
              color: 'white',
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
                sx={{ color: 'white', mr: -0.5 }}
                size="small"
              >
                <ArrowBackIcon size={24} />
              </IconButton>
            )}
            <Avatar 
              src="/favicon.png" 
              sx={{ bgcolor: 'var(--glass-bg)', width: 40, height: 40 }}
            />
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontWeight: 700, fontSize: '1rem' }}>
                {showHistory ? 'ประวัติการสนทนา' : ADMIN_DISPLAY_NAME}
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', opacity: 0.9 }}>
                {showHistory 
                  ? 'เลือกดูการสนทนาที่ผ่านมา'
                  : chat?.status === 'active' 
                  ? `กำลังสนทนากับ ${chat.admin_name || 'แอดมิน'}`
                  : chat?.status === 'pending'
                  ? 'รอแอดมินรับเคส...'
                  : chat?.status === 'closed'
                  ? 'การสนทนาจบแล้ว (ดูได้อย่างเดียว)'
                  : 'พร้อมให้บริการ'}
              </Typography>
            </Box>
            {!showHistory && (
              <IconButton
                onClick={() => { fetchChatHistory(); setShowHistory(true); }}
                sx={{ color: 'white' }}
                title="ดูประวัติการสนทนา"
              >
                <HistoryIcon size={24} />
              </IconButton>
            )}
            <IconButton
              onClick={() => setOpen(false)}
              sx={{ color: 'white' }}
            >
              <CloseIcon size={24} />
            </IconButton>
          </Box>

          {/* Content */}
          <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {loading ? (
              <Box sx={{ flex: 1, display: 'grid', placeItems: 'center' }}>
                <CircularProgress sx={{ color: 'var(--primary)' }} />
              </Box>
            ) : showHistory ? (
              /* History View */
              <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
                {chatHistory.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <HistoryIcon size={48} color="#86868b" style={{ marginBottom: 8 }} />
                    <Typography sx={{ color: 'var(--text-muted)' }}>ไม่มีประวัติการสนทนา</Typography>
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
                          {historyChat.subject || 'สอบถามข้อมูล'}
                        </Typography>
                        <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.8rem', mt: 0.5 }}>
                          {historyChat.last_message_preview}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                          <TimeIcon size={14} color="#86868b" />
                          <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                            {new Date(historyChat.closed_at || historyChat.updated_at).toLocaleDateString('th-TH', { 
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
                  การสนทนาสิ้นสุดแล้ว
                </Typography>
                <Typography sx={{ color: 'var(--text-muted)', mb: 3, fontSize: '0.85rem' }}>
                  คุณพอใจกับการให้บริการมากแค่ไหน?
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
                      {rating === 5 ? 'ยอดเยี่ยมมาก!' : 
                       rating === 4 ? 'ดีมาก!' : 
                       rating === 3 ? 'พอใช้' : 
                       rating === 2 ? 'ควรปรับปรุง' : 'ต้องปรับปรุง'}
                    </Typography>
                  )}
                </Box>
                
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  placeholder="ความคิดเห็นเพิ่มเติม (ไม่บังคับ)"
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
                    <>ส่งคะแนน</>
                  )}
                </Button>
              </Box>
            ) : (showNewChat && (!chat || chat.status !== 'pending')) || !chat ? (
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
                    ส่งข้อความถึงเรา
                  </Typography>
                  <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    ทีมงานพร้อมตอบคำถามของคุณ
                  </Typography>
                </Box>

                {/* Form Section */}
                <Box sx={{ p: 2.5, flex: 1, display: 'flex', flexDirection: 'column' }}>
                  {/* Quick Topics */}
                  <Typography sx={{ fontSize: '0.8rem', color: 'var(--text-muted)', mb: 1, fontWeight: 600 }}>
                    เลือกหัวข้อ
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                    {['สอบถามสินค้า', 'ปัญหาการสั่งซื้อ', 'การจัดส่ง', 'อื่นๆ'].map((topic) => (
                      <Box
                        key={topic}
                        onClick={() => setSubject(topic)}
                        sx={{
                          px: 1.5,
                          py: 0.75,
                          borderRadius: 2,
                          fontSize: '0.8rem',
                          fontWeight: 500,
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          bgcolor: subject === topic ? 'var(--primary)' : 'var(--surface-2)',
                          color: subject === topic ? 'white' : 'var(--text-muted)',
                          border: '1px solid',
                          borderColor: subject === topic ? 'var(--primary)' : 'var(--glass-border)',
                          '&:hover': {
                            bgcolor: subject === topic ? 'var(--primary)' : 'var(--surface-2)',
                            borderColor: subject === topic ? 'var(--primary)' : 'var(--glass-border)',
                          },
                        }}
                      >
                        {topic}
                      </Box>
                    ))}
                  </Box>

                  {/* Custom Subject (Optional) */}
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="หรือพิมพ์หัวข้อเอง..."
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
                    ข้อความของคุณ
                  </Typography>
                  <TextField
                    fullWidth
                    multiline
                    rows={4}
                    placeholder="เขียนข้อความของคุณที่นี่..."
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
                        เริ่มการสนทนา
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
                    ดูประวัติการสนทนา
                  </Button>
                </Box>
              </Box>
            ) : (
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
                      รอแอดมินรับเคส...
                    </Typography>
                  </Box>
                )}
                
                {/* Messages Area */}
                <Box
                  sx={{
                    flex: 1,
                    overflowY: 'auto',
                    p: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 0.5,
                    bgcolor: 'var(--surface-2)',
                    minHeight: 0,
                  }}
                >
                  {(chat.messages || []).filter(msg => !msg.is_unsent).map((msg, index, filteredMessages) => {
                    const { text, imageUrl } = parseMessage(msg.message);
                    const showTime = isLastInGroup(filteredMessages, index);
                    const canUnsend = msg.sender === 'customer' && chat.status !== 'closed';
                    // Check if this is the last customer message (for showing read receipt)
                    const isLastCustomerMessage = msg.sender === 'customer' && 
                      index === filteredMessages.map(m => m.sender).lastIndexOf('customer');
                    
                    return (
                      <Box
                        key={msg.id}
                        sx={{
                          display: 'flex',
                          justifyContent: msg.sender === 'customer' ? 'flex-end' 
                            : msg.sender === 'system' ? 'center' : 'flex-start',
                          mb: showTime ? 1 : 0,
                        }}
                      >
                        {msg.sender === 'system' ? (
                          <Chip
                            size="small"
                            label={msg.message}
                            sx={{
                              bgcolor: 'rgba(0,0,0,0.08)',
                              color: 'var(--text-muted)',
                              fontSize: '0.75rem',
                            }}
                          />
                        ) : (
                          <Box
                            sx={{
                              maxWidth: '85%',
                              display: 'flex',
                              flexDirection: msg.sender === 'customer' ? 'row-reverse' : 'row',
                              alignItems: 'flex-end',
                              gap: 0.75,
                            }}
                          >
                            {/* Avatar - only show on last message of group */}
                            {msg.sender === 'admin' && showTime && (
                              <Avatar 
                                src={msg.sender_avatar || undefined}
                                sx={{ width: 28, height: 28, bgcolor: 'var(--primary)', flexShrink: 0 }}
                              >
                                {!msg.sender_avatar && <SupportAgentIcon size={16} />}
                              </Avatar>
                            )}
                            {msg.sender === 'admin' && !showTime && (
                              <Box sx={{ width: 28 }} />
                            )}
                            {msg.sender === 'customer' && showTime && (
                              <Avatar 
                                src={getUserAvatar() || msg.sender_avatar || undefined} 
                                sx={{ width: 28, height: 28, bgcolor: 'var(--success)', flexShrink: 0 }}
                              >
                                {!getUserAvatar() && !msg.sender_avatar && (
                                  session?.user?.name?.charAt(0)?.toUpperCase() || 'U'
                                )}
                              </Avatar>
                            )}
                            {msg.sender === 'customer' && !showTime && (
                              <Box sx={{ width: 28 }} />
                            )}
                            
                            <Box sx={{ position: 'relative' }}>
                              {/* Message Bubble with long-press/click support */}
                              <Paper
                                elevation={0}
                                onContextMenu={canUnsend ? (e) => handleMessageMenu(e, msg.id) : undefined}
                                onClick={canUnsend ? (e) => {
                                  // Double-click to open menu on mobile-friendly way
                                  if (e.detail === 2) {
                                    handleMessageMenu(e, msg.id);
                                  }
                                } : undefined}
                                sx={{
                                  px: 1.5,
                                  py: 0.75,
                                  bgcolor: msg.sender === 'customer' ? '#0071e3' : 'var(--surface)',
                                  color: msg.sender === 'customer' ? '#ffffff' : 'var(--foreground)',
                                  borderRadius: '18px',
                                  borderBottomRightRadius: msg.sender === 'customer' ? '6px' : '18px',
                                  borderBottomLeftRadius: msg.sender === 'admin' ? '6px' : '18px',
                                  boxShadow: msg.sender === 'admin' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                  cursor: canUnsend ? 'pointer' : 'default',
                                  transition: 'all 0.15s ease',
                                  '&:hover': canUnsend ? {
                                    opacity: 0.9,
                                  } : {},
                                  '&:active': canUnsend ? {
                                    transform: 'scale(0.98)',
                                  } : {},
                                }}
                              >
                                {text && (
                                  <Typography sx={{ fontSize: '0.9rem', whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
                                    {text}
                                  </Typography>
                                )}
                                {/* Order Reference Card */}
                                {parseMessage(msg.message).orderRef && (
                                  <Box
                                    sx={{
                                      mt: text ? 0.75 : 0,
                                      p: 1.5,
                                      bgcolor: msg.sender === 'customer' ? 'var(--glass-bg)' : 'var(--surface-2)',
                                      borderRadius: 1.5,
                                      border: '1px solid',
                                      borderColor: msg.sender === 'customer' ? 'var(--glass-border)' : 'var(--glass-border)',
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
                                        <Typography sx={{ 
                                          fontSize: '0.8rem', 
                                          fontWeight: 600,
                                          color: msg.sender === 'customer' ? 'white' : 'var(--foreground)',
                                        }}>
                                          ออเดอร์ #{parseMessage(msg.message).orderRef}
                                        </Typography>
                                        <Typography sx={{ 
                                          fontSize: '0.7rem',
                                          color: msg.sender === 'customer' ? 'rgba(255,255,255,0.8)' : 'var(--text-muted)',
                                        }}>
                                          คลิกเพื่อดูรายละเอียด
                                        </Typography>
                                      </Box>
                                    </Box>
                                  </Box>
                                )}
                                {imageUrl && (
                                  <Box
                                    component="img"
                                    src={imageUrl}
                                    alt="รูปภาพ"
                                    loading="lazy"
                                    sx={{
                                      width: '100%',
                                      maxWidth: { xs: 200, sm: 250 },
                                      height: 'auto',
                                      maxHeight: { xs: 180, sm: 220 },
                                      objectFit: 'cover',
                                      borderRadius: 1.5,
                                      mt: text ? 0.75 : 0,
                                      cursor: 'zoom-in',
                                      border: '1px solid rgba(0,0,0,0.1)',
                                      transition: 'transform 0.2s ease',
                                      '&:hover': {
                                        opacity: 0.9,
                                        transform: 'scale(1.02)',
                                      },
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setLightboxImage(imageUrl);
                                    }}
                                  />
                                )}
                              </Paper>
                              
                              {/* Time & Read Receipt - IG Style (only on last message of group) */}
                              {showTime && (
                                <Box sx={{ 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  gap: 0.5, 
                                  mt: 0.25,
                                  justifyContent: msg.sender === 'customer' ? 'flex-end' : 'flex-start',
                                }}>
                                  <Typography
                                    sx={{
                                      fontSize: '0.65rem',
                                      color: 'var(--text-muted)',
                                    }}
                                  >
                                    {formatTime(msg.created_at)}
                                  </Typography>
                                  {/* Read receipts only for the last customer message */}
                                  {isLastCustomerMessage && chat.status === 'active' && (
                                    <>
                                      {msg.is_read 
                                        ? <DoneAllIcon size={12} color="#30d158" />
                                        : <DoneIcon size={12} color="#86868b" />
                                      }
                                      {msg.is_read && msg.read_at && (
                                        <Typography sx={{ fontSize: '0.6rem', color: '#30d158', ml: 0.25 }}>
                                          อ่านแล้ว {formatTimeAgo(msg.read_at)}
                                        </Typography>
                                      )}
                                    </>
                                  )}
                                </Box>
                              )}
                            </Box>
                          </Box>
                        )}
                      </Box>
                    );
                  })}
                  
                  {/* Typing Indicator */}
                  {adminTyping && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar sx={{ width: 32, height: 32, bgcolor: '#0071e3' }}>
                        <SupportAgentIcon size={18} />
                      </Avatar>
                      <Paper sx={{ px: 2, py: 1, bgcolor: 'var(--surface)', borderRadius: 2 }}>
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
                      </Paper>
                    </Box>
                  )}
                  
                  <div ref={messagesEndRef} />
                </Box>

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
                            ตอบกลับ {replyToMessage.sender === 'admin' ? 'แอดมิน' : 'ตัวเอง'}
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
                    
                    {/* Input Area */}
                    <Box
                      sx={{
                        p: 1.5,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                      }}
                    >
                    <IconButton
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingImage}
                      sx={{ 
                        color: '#0071e3',
                        bgcolor: 'rgba(0,113,227, 0.08)',
                        '&:hover': { 
                          bgcolor: 'rgba(0,113,227, 0.15)',
                          transform: 'scale(1.05)',
                        },
                        transition: 'all 0.2s',
                      }}
                    >
                      <ImageIcon size={24} />
                    </IconButton>
                    
                    {/* Order Attach Button */}
                    <IconButton
                      onClick={() => {
                        fetchOrderHistory();
                        setShowOrderPicker(true);
                      }}
                      sx={{ 
                        color: '#30d158',
                        bgcolor: 'rgba(34, 197, 94, 0.08)',
                        '&:hover': { 
                          bgcolor: 'rgba(34, 197, 94, 0.15)',
                          transform: 'scale(1.05)',
                        },
                        transition: 'all 0.2s',
                      }}
                      title="แนบออเดอร์"
                    >
                      <ReceiptIcon size={24} />
                    </IconButton>
                    
                    <TextField
                      fullWidth
                      size="small"
                      placeholder={replyToMessage ? "พิมพ์ข้อความตอบกลับ..." : "พิมพ์ข้อความ..."}
                      value={message}
                      onChange={(e) => {
                        setMessage(e.target.value);
                        sendTypingIndicator();
                      }}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      disabled={sending || uploadingImage}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 3,
                          bgcolor: 'var(--surface-2)',
                          border: '1px solid transparent',
                          transition: 'all 0.2s',
                          '&:hover': { 
                            bgcolor: 'var(--glass-bg)',
                            border: '1px solid var(--glass-border)',
                          },
                          '&.Mui-focused': { 
                            bgcolor: 'var(--surface)',
                            border: '1px solid var(--primary)',
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
                    <IconButton
                      onClick={handleSendMessage}
                      disabled={(!message.trim() && !previewImage) || sending || uploadingImage}
                      sx={{
                        background: 'linear-gradient(135deg, #0071e3 0%, #0077ED 100%)',
                        color: 'white',
                        boxShadow: '0 4px 12px rgba(0,113,227, 0.3)',
                        '&:hover': { 
                          background: 'linear-gradient(135deg, #1d4ed8 0%, #bf5af2 100%)',
                          transform: 'scale(1.05)',
                          boxShadow: '0 6px 16px rgba(0,113,227, 0.4)',
                        },
                        transition: 'all 0.2s',
                        '&.Mui-disabled': { 
                          background: 'var(--surface-2)', 
                          color: 'var(--text-muted)',
                          boxShadow: 'none',
                        },
                      }}
                    >
                      {sending || uploadingImage ? (
                        <CircularProgress size={20} sx={{ color: 'inherit' }} />
                      ) : (
                        <SendIcon size={24} />
                      )}
                    </IconButton>
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
                          ? `การสนทนานี้ปิดแล้ว • คะแนน ${chat.rating}/5`
                          : 'การสนทนานี้ปิดแล้ว'}
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
                        ให้คะแนนการบริการ
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
                      เริ่มการสนทนาใหม่
                    </Button>
                  </Box>
                )}
              </>
            )}
          </Box>
        </Paper>
      </Fade>
    </>
  );
}
