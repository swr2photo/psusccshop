'use client';

import React from 'react';
import {
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  IconButton,
  TextField,
  Typography,
} from '@mui/material';
import ChatIcon from '@mui/icons-material/Chat';
import SendIcon from '@mui/icons-material/Send';
import CloseIcon from '@mui/icons-material/Close';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import RefreshIcon from '@mui/icons-material/Refresh';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import StorefrontIcon from '@mui/icons-material/Storefront';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import PaidOutlinedIcon from '@mui/icons-material/PaidOutlined';
import StraightenOutlinedIcon from '@mui/icons-material/StraightenOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import HelpOutlineOutlinedIcon from '@mui/icons-material/HelpOutlineOutlined';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import VerifiedIcon from '@mui/icons-material/Verified';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import WavingHandIcon from '@mui/icons-material/WavingHand';
import ReplyIcon from '@mui/icons-material/Reply';
import EditIcon from '@mui/icons-material/Edit';

// ==================== CONSTANTS ====================
const QUICK_QUESTIONS_DATA = [
  { icon: 'cart', label: 'วิธีสั่งซื้อ' },
  { icon: 'price', label: 'ราคาสินค้า' },
  { icon: 'size', label: 'ไซซ์และขนาด' },
  { icon: 'shipping', label: 'การจัดส่ง' },
  { icon: 'payment', label: 'วิธีชำระเงิน' },
  { icon: 'help', label: 'ติดต่อร้าน' },
];

const QUICK_QUESTIONS = QUICK_QUESTIONS_DATA.map(q => q.label);

// Session storage key for chat history
const CHAT_STORAGE_KEY = 'scc_chat_history';
const CHAT_SESSION_ID_KEY = 'scc_chat_session_id';
const CHAT_PERSISTENT_KEY = 'scc_chat_persistent';

// ==================== TYPES ====================
interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: Date;
  suggestions?: string[];
  relatedQuestions?: string[];
  source?: 'ai' | 'faq' | 'fallback' | 'error';
  confidence?: number;
  productImages?: { name: string; image: string; }[];
  modelUsed?: string;
  replyTo?: { id: string; text: string; sender: 'user' | 'bot' };
  isEdited?: boolean;
}

export interface ShirtChatBotProps {
  open: boolean;
  setOpen: (open: boolean) => void;
}

// ==================== HELPER COMPONENTS ====================
const QuickQuestionIcon = ({ type, size = 14 }: { type: string; size?: number }) => {
  const sx = { fontSize: size, opacity: 0.85 };
  switch (type) {
    case 'cart': return <ShoppingCartOutlinedIcon sx={sx} />;
    case 'price': return <PaidOutlinedIcon sx={sx} />;
    case 'size': return <StraightenOutlinedIcon sx={sx} />;
    case 'shipping': return <LocalShippingOutlinedIcon sx={sx} />;
    case 'payment': return <AccountBalanceWalletOutlinedIcon sx={sx} />;
    case 'help': return <HelpOutlineOutlinedIcon sx={sx} />;
    default: return null;
  }
};

// ==================== MAIN COMPONENT ====================
export default function ShirtChatBot({ open, setOpen }: ShirtChatBotProps) {
  const [input, setInput] = React.useState('');
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [showPulse, setShowPulse] = React.useState(true);
  const [aiEnabled, setAiEnabled] = React.useState(false);
  const [userSession, setUserSession] = React.useState<{ name?: string; email?: string; image?: string } | null>(null);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [copiedMessageId, setCopiedMessageId] = React.useState<string | null>(null);
  const [shopInfo, setShopInfo] = React.useState<{
    totalProducts?: number; 
    availableProducts?: number;
    priceRange?: { min: number; max: number };
  } | null>(null);
  const [lightboxImage, setLightboxImage] = React.useState<string | null>(null);
  const [uploadedImage, setUploadedImage] = React.useState<{ base64: string; preview: string } | null>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const [replyToMessage, setReplyToMessage] = React.useState<{ id: string; text: string; sender: 'user' | 'bot' } | null>(null);
  const [editingMessage, setEditingMessage] = React.useState<{ id: string; text: string } | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const messagesContainerRef = React.useRef<HTMLDivElement>(null);

  // Generate unique session ID for secure storage
  const getSessionId = React.useCallback(() => {
    if (typeof window === 'undefined') return '';
    let sessionId = sessionStorage.getItem(CHAT_SESSION_ID_KEY);
    if (!sessionId) {
      sessionId = `chat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem(CHAT_SESSION_ID_KEY, sessionId);
    }
    return sessionId;
  }, []);

  // Save chat history securely
  const saveChatHistory = React.useCallback((msgs: ChatMessage[], email?: string) => {
    if (typeof window === 'undefined') return;
    try {
      const maxMessages = email ? 50 : 20;
      const sanitizedMsgs = msgs.slice(-maxMessages).map(m => ({
        id: m.id,
        sender: m.sender,
        text: m.text.slice(0, 2000),
        timestamp: m.timestamp.toISOString(),
        source: m.source,
        productImages: m.productImages,
      }));
      
      if (email) {
        const key = `${CHAT_PERSISTENT_KEY}_${btoa(email).slice(0, 16)}`;
        localStorage.setItem(key, JSON.stringify(sanitizedMsgs));
      } else {
        sessionStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(sanitizedMsgs));
      }
    } catch (e) {
      console.warn('Failed to save chat history');
    }
  }, []);

  // Load chat history from storage
  const loadChatHistory = React.useCallback((email?: string) => {
    if (typeof window === 'undefined') return [];
    try {
      let saved: string | null = null;
      
      if (email) {
        const key = `${CHAT_PERSISTENT_KEY}_${btoa(email).slice(0, 16)}`;
        saved = localStorage.getItem(key);
      }
      
      if (!saved) {
        saved = sessionStorage.getItem(CHAT_STORAGE_KEY);
      }
      
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp),
        }));
      }
    } catch (e) {
      console.warn('Failed to load chat history');
    }
    return [];
  }, []);

  // Fetch user session on mount
  React.useEffect(() => {
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => {
        if (data?.user) {
          setUserSession({
            name: data.user.name,
            email: data.user.email,
            image: data.user.image,
          });
          const savedMessages = loadChatHistory(data.user.email);
          if (savedMessages.length > 0) {
            setMessages(savedMessages);
          }
        } else {
          const savedMessages = loadChatHistory();
          if (savedMessages.length > 0) {
            setMessages(savedMessages);
          }
        }
      })
      .catch(() => {
        const savedMessages = loadChatHistory();
        if (savedMessages.length > 0) {
          setMessages(savedMessages);
        }
      });
  }, [loadChatHistory]);

  // Save messages when they change
  React.useEffect(() => {
    if (messages.length > 0) {
      saveChatHistory(messages, userSession?.email);
    }
  }, [messages, saveChatHistory, userSession?.email]);

  // Auto scroll to bottom
  const scrollToBottom = React.useCallback(() => {
    setTimeout(() => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
    }, 100);
  }, []);

  React.useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Hide pulse after first open & check AI status
  React.useEffect(() => {
    if (open) {
      setShowPulse(false);
      fetch('/api/chatbot')
        .then(res => res.json())
        .then(data => {
          setAiEnabled(data.aiEnabled || false);
          setShopInfo(data.shopInfo || null);
        })
        .catch(() => setAiEnabled(false));
    }
  }, [open]);

  const generateId = () => `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Build conversation history for context
  const getConversationHistory = () => {
    return messages.slice(-6).map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'assistant',
      content: msg.text,
    }));
  };

  // Handle reply to a message
  const handleReply = (msg: ChatMessage) => {
    setEditingMessage(null);
    setReplyToMessage({
      id: msg.id,
      text: msg.text.slice(0, 100) + (msg.text.length > 100 ? '...' : ''),
      sender: msg.sender,
    });
    inputRef.current?.focus();
  };

  // Handle edit message - only for user messages
  const handleEditMessage = (msg: ChatMessage) => {
    if (msg.sender !== 'user') return;
    setReplyToMessage(null);
    setEditingMessage({
      id: msg.id,
      text: msg.text.replace(/^\[รูปภาพ\]\s*/, ''),
    });
    setInput(msg.text.replace(/^\[รูปภาพ\]\s*/, ''));
    inputRef.current?.focus();
  };

  // Cancel edit mode
  const cancelEditMode = () => {
    setEditingMessage(null);
    setInput('');
  };

  const handleSend = async (customMessage?: string) => {
    const msgToSend = customMessage || input.trim();
    if (!msgToSend) return;
    
    // If editing, update the existing message and regenerate bot response
    if (editingMessage) {
      const editIndex = messages.findIndex(m => m.id === editingMessage.id);
      if (editIndex === -1) {
        setEditingMessage(null);
        return;
      }
      
      const updatedMessages = messages.slice(0, editIndex);
      const updatedUserMsg: ChatMessage = {
        ...messages[editIndex],
        text: msgToSend,
        isEdited: true,
        timestamp: new Date(),
      };
      updatedMessages.push(updatedUserMsg);
      
      setMessages(updatedMessages);
      setInput('');
      setEditingMessage(null);
      setLoading(true);
      
      try {
        const historyForEdit = updatedMessages.slice(-6).map(msg => ({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.text,
        }));
        
        const res = await fetch('/api/chatbot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            message: msgToSend,
            conversationHistory: historyForEdit,
          }),
        });
        const data = await res.json();
        
        const botMsg: ChatMessage = {
          id: generateId(),
          sender: 'bot',
          text: data.answer,
          timestamp: new Date(),
          suggestions: data.suggestions,
          relatedQuestions: data.relatedQuestions,
          source: data.source,
          confidence: data.confidence,
          productImages: data.productImages,
          modelUsed: data.modelUsed,
        };
        
        setMessages((prev) => [...prev, botMsg]);
      } catch (e) {
        const errorMsg: ChatMessage = {
          id: generateId(),
          sender: 'bot',
          text: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้งค่ะ',
          timestamp: new Date(),
          suggestions: QUICK_QUESTIONS,
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setLoading(false);
      }
      return;
    }
    
    const userMsg: ChatMessage = {
      id: generateId(),
      sender: 'user',
      text: msgToSend,
      timestamp: new Date(),
      replyTo: replyToMessage || undefined,
    };
    
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setReplyToMessage(null);
    setLoading(true);
    
    try {
      const contextMessage = replyToMessage 
        ? `(ตอบกลับ: "${replyToMessage.text}") ${msgToSend}`
        : msgToSend;
      
      const res = await fetch('/api/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: contextMessage,
          conversationHistory: getConversationHistory(),
        }),
      });
      const data = await res.json();
      
      const botMsg: ChatMessage = {
        id: generateId(),
        sender: 'bot',
        text: data.answer,
        timestamp: new Date(),
        suggestions: data.suggestions,
        relatedQuestions: data.relatedQuestions,
        source: data.source,
        confidence: data.confidence,
        productImages: data.productImages,
        modelUsed: data.modelUsed,
      };
      
      setMessages((prev) => [...prev, botMsg]);
    } catch (e) {
      const errorMsg: ChatMessage = {
        id: generateId(),
        sender: 'bot',
        text: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้งค่ะ',
        timestamp: new Date(),
        suggestions: QUICK_QUESTIONS,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !loading) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape') {
      if (editingMessage) {
        cancelEditMode();
      } else if (replyToMessage) {
        setReplyToMessage(null);
      }
    }
  };

  const handleQuickQuestion = (question: string) => {
    setInput(question);
    setTimeout(() => {
      handleSend(question);
    }, 50);
  };

  const handleClearChat = () => {
    setMessages([]);
    setUploadedImage(null);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(CHAT_STORAGE_KEY);
      if (userSession?.email) {
        const key = `${CHAT_PERSISTENT_KEY}_${btoa(userSession.email).slice(0, 16)}`;
        localStorage.removeItem(key);
      }
    }
  };

  // Handle image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      alert('รองรับเฉพาะไฟล์รูปภาพ (PNG, JPG, WEBP)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('ไฟล์ต้องมีขนาดไม่เกิน 5MB');
      return;
    }
    
    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setUploadedImage({ base64, preview: base64 });
        setIsUploading(false);
      };
      reader.onerror = () => {
        alert('ไม่สามารถอ่านไฟล์ได้');
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Upload error:', err);
      setIsUploading(false);
    }
    
    if (e.target) e.target.value = '';
  };

  // Send message with image
  const handleSendWithImage = async () => {
    if (!uploadedImage && !input.trim()) return;
    
    const msgText = input.trim() || 'ช่วยดูรูปนี้หน่อยค่ะ';
    const userMsg: ChatMessage = {
      id: generateId(),
      sender: 'user',
      text: uploadedImage ? `[รูปภาพ] ${msgText}` : msgText,
      timestamp: new Date(),
      productImages: uploadedImage ? [{ name: 'รูปที่อัปโหลด', image: uploadedImage.preview }] : undefined,
      replyTo: replyToMessage || undefined,
    };
    
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    const imageToSend = uploadedImage?.base64;
    setUploadedImage(null);
    setReplyToMessage(null);
    setLoading(true);
    
    try {
      const contextMessage = replyToMessage 
        ? `(ตอบกลับ: "${replyToMessage.text}") ${msgText}`
        : msgText;
      
      const res = await fetch('/api/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: contextMessage,
          conversationHistory: getConversationHistory(),
          image: imageToSend,
        }),
      });
      const data = await res.json();
      
      const botMsg: ChatMessage = {
        id: generateId(),
        sender: 'bot',
        text: data.answer,
        timestamp: new Date(),
        suggestions: data.suggestions,
        relatedQuestions: data.relatedQuestions,
        source: data.source,
        confidence: data.confidence,
        productImages: data.productImages,
        modelUsed: data.modelUsed,
      };
      
      setMessages((prev) => [...prev, botMsg]);
    } catch (e) {
      const errorMsg: ChatMessage = {
        id: generateId(),
        sender: 'bot',
        text: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้งค่ะ',
        timestamp: new Date(),
        suggestions: QUICK_QUESTIONS,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  // Copy message to clipboard
  const handleCopyMessage = async (messageId: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  };

  // Parse and render markdown tables
  const parseMarkdownTable = (text: string): { isTable: boolean; rows: string[][] } => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return { isTable: false, rows: [] };
    
    const hasHeaders = lines[0].includes('|');
    const hasSeparator = lines[1] && /^\|?[\s\-:|]+\|?$/.test(lines[1]);
    
    if (!hasHeaders || !hasSeparator) return { isTable: false, rows: [] };
    
    const rows: string[][] = [];
    for (let i = 0; i < lines.length; i++) {
      if (i === 1) continue;
      const line = lines[i].trim();
      if (line.startsWith('|') || line.includes('|')) {
        const cells = line.split('|')
          .map(cell => cell.trim())
          .filter((cell, idx, arr) => idx !== 0 || cell !== '');
        if (cells[cells.length - 1] === '') cells.pop();
        if (cells.length > 0) rows.push(cells);
      }
    }
    
    return { isTable: rows.length >= 2, rows };
  };

  // Render markdown table as HTML table
  const renderTable = (rows: string[][]) => {
    if (rows.length === 0) return null;
    const [header, ...body] = rows;
    
    return (
      <Box 
        component="table" 
        sx={{ 
          width: '100%',
          borderCollapse: 'collapse',
          my: 1.5,
          fontSize: 13,
          '& th, & td': {
            border: '1px solid rgba(255,255,255,0.15)',
            px: 1.5,
            py: 0.75,
            textAlign: 'left',
          },
          '& th': {
            bgcolor: 'rgba(99, 102, 241, 0.2)',
            fontWeight: 600,
            color: '#a5b4fc',
          },
          '& td': {
            bgcolor: 'rgba(255,255,255,0.03)',
          },
          '& tr:hover td': {
            bgcolor: 'rgba(255,255,255,0.06)',
          },
        }}
      >
        <thead>
          <tr>
            {header.map((cell, i) => (
              <th key={i}>{renderInlineMarkdown(cell)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j}>{renderInlineMarkdown(cell)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </Box>
    );
  };

  // Render inline markdown
  const renderInlineMarkdown = (text: string): React.ReactNode => {
    const lines = text.split('\n');
    
    return lines.map((line, lineIdx) => {
      const bulletMatch = line.match(/^[\s]*[•\-\*]\s*(.*)/);
      if (bulletMatch) {
        return (
          <Box key={lineIdx} sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, my: 0.25 }}>
            <Box component="span" sx={{ color: '#a5b4fc', flexShrink: 0 }}>•</Box>
            <span>{renderTextSegment(bulletMatch[1])}</span>
          </Box>
        );
      }
      
      const numberedMatch = line.match(/^[\s]*(\d+)[.\)]\s*(.*)/);
      if (numberedMatch) {
        return (
          <Box key={lineIdx} sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, my: 0.25 }}>
            <Box component="span" sx={{ color: '#a5b4fc', flexShrink: 0, minWidth: 16 }}>{numberedMatch[1]}.</Box>
            <span>{renderTextSegment(numberedMatch[2])}</span>
          </Box>
        );
      }
      
      return (
        <React.Fragment key={lineIdx}>
          {renderTextSegment(line)}
          {lineIdx < lines.length - 1 && <br />}
        </React.Fragment>
      );
    });
  };
  
  // Render text segment with bold, italic, links
  const renderTextSegment = (text: string): React.ReactNode => {
    const parts = text.split(/(\*\*.*?\*\*|\[.*?\]\(.*?\)|`.*?`)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} style={{ color: '#e0e7ff' }}>{part.slice(2, -2)}</strong>;
      }
      const linkMatch = part.match(/\[(.*?)\]\((.*?)\)/);
      if (linkMatch) {
        return (
          <Box 
            key={i} 
            component="a" 
            href={linkMatch[2]} 
            target="_blank" 
            rel="noopener noreferrer"
            sx={{ color: '#818cf8', textDecoration: 'underline', '&:hover': { color: '#a5b4fc' } }}
          >
            {linkMatch[1]}
          </Box>
        );
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <Box 
            key={i} 
            component="code" 
            sx={{ 
              bgcolor: 'rgba(255,255,255,0.1)', 
              px: 0.5, 
              py: 0.125, 
              borderRadius: 0.5, 
              fontSize: '0.9em',
              fontFamily: 'monospace',
            }}
          >
            {part.slice(1, -1)}
          </Box>
        );
      }
      return part;
    });
  };

  // Main render function for message text
  const renderText = (text: string) => {
    const tableMatch = text.match(/(\|[^\n]+\|\n\|[\s\-:|]+\|\n(?:\|[^\n]+\|\n?)+)/);
    
    if (tableMatch) {
      const tableText = tableMatch[1];
      const beforeTable = text.substring(0, tableMatch.index);
      const afterTable = text.substring((tableMatch.index || 0) + tableText.length);
      
      const { isTable, rows } = parseMarkdownTable(tableText);
      
      if (isTable) {
        return (
          <>
            {beforeTable && <span>{renderInlineMarkdown(beforeTable)}</span>}
            {renderTable(rows)}
            {afterTable && <span>{renderInlineMarkdown(afterTable)}</span>}
          </>
        );
      }
    }
    
    return renderInlineMarkdown(text);
  };

  return (
    <>
      {/* Chat Dialog - Apple Liquid Glass Design */}
      <Dialog 
        open={open} 
        onClose={() => setOpen(false)} 
        maxWidth={isFullscreen ? false : "sm"}
        fullWidth
        fullScreen={isFullscreen}
        PaperProps={{
          sx: {
            borderRadius: isFullscreen ? 0 : 2.5,
            overflow: 'hidden',
            maxHeight: isFullscreen ? '100vh' : '85vh',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.03) 100%)',
            backdropFilter: 'blur(32px) saturate(180%)',
            WebkitBackdropFilter: 'blur(32px) saturate(180%)',
            border: isFullscreen ? 'none' : '1px solid rgba(255,255,255,0.15)',
            boxShadow: isFullscreen ? 'none' : '0 20px 40px rgba(0, 0, 0, 0.4)',
          }
        }}
      >
        {/* Header with Logo */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2.5,
            py: 2,
            background: 'linear-gradient(180deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%)',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: 1.5,
                background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%)',
                border: '1px solid rgba(255,255,255,0.2)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              <Box
                component="img"
                src="/logo.png"
                alt="SCC Shop"
                sx={{
                  width: 36,
                  height: 36,
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))',
                }}
                onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </Box>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Typography sx={{ 
                  fontWeight: 600, 
                  fontSize: 17, 
                  color: 'rgba(255,255,255,0.95)',
                  textShadow: '0 1px 2px rgba(0,0,0,0.1)',
                }}>
                  SCC Shop
                </Typography>
                {aiEnabled && (
                  <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.25,
                    fontSize: 9,
                    px: 0.6,
                    py: 0.2,
                    borderRadius: 0.75,
                    background: 'rgba(16, 185, 129, 0.2)',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    color: '#6ee7b7',
                    fontWeight: 600,
                  }}>
                    <AutoAwesomeIcon sx={{ fontSize: 9 }} />
                    AI
                  </Box>
                )}
              </Box>
              <Typography sx={{ 
                fontSize: 12, 
                color: 'rgba(255,255,255,0.6)', 
                display: 'flex', 
                alignItems: 'center', 
                gap: 0.5 
              }}>
                {loading ? (
                  <>
                    <AutoAwesomeIcon sx={{ 
                      fontSize: 14,
                      color: '#a5b4fc',
                      animation: 'shimmer 1.5s infinite',
                      '@keyframes shimmer': {
                        '0%, 100%': { opacity: 1 },
                        '50%': { opacity: 0.4 },
                      }
                    }} />
                    กำลังคิด...
                  </>
                ) : (
                  <>
                    <Box component="span" sx={{ 
                      width: 6, 
                      height: 6, 
                      borderRadius: '50%', 
                      bgcolor: '#4ade80',
                      boxShadow: '0 0 6px #4ade80',
                    }} />
                    ออนไลน์
                  </>
                )}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <IconButton 
              size="small" 
              onClick={handleClearChat}
              sx={{ 
                color: 'rgba(255,255,255,0.6)', 
                transition: 'all 0.2s',
                '&:hover': { 
                  color: 'rgba(255,255,255,0.9)', 
                  bgcolor: 'rgba(255,255,255,0.1)',
                  transform: 'rotate(180deg)',
                } 
              }}
              title="ล้างแชท"
            >
              <RefreshIcon fontSize="small" />
            </IconButton>
            <IconButton 
              size="small" 
              onClick={toggleFullscreen}
              sx={{ 
                color: 'rgba(255,255,255,0.6)', 
                display: { xs: 'flex', sm: 'flex' },
                '&:hover': { 
                  color: 'rgba(255,255,255,0.9)', 
                  bgcolor: 'rgba(255,255,255,0.1)' 
                } 
              }}
              title={isFullscreen ? "ย่อหน้าต่าง" : "ขยายเต็มจอ"}
            >
              {isFullscreen ? <FullscreenExitIcon fontSize="small" /> : <FullscreenIcon fontSize="small" />}
            </IconButton>
            <IconButton 
              size="small" 
              onClick={() => setOpen(false)}
              sx={{ 
                color: 'rgba(255,255,255,0.6)', 
                '&:hover': { 
                  color: 'rgba(255,255,255,0.9)', 
                  bgcolor: 'rgba(255,255,255,0.1)' 
                } 
              }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>

        {/* Messages Area */}
        <DialogContent 
          ref={messagesContainerRef}
          sx={{ 
            background: 'linear-gradient(180deg, rgba(15,23,42,0.8) 0%, rgba(30,41,59,0.9) 100%)',
            minHeight: isFullscreen ? 'calc(100vh - 160px)' : 320,
            maxHeight: isFullscreen ? 'calc(100vh - 160px)' : 380,
            overflowY: 'auto',
            px: 2,
            py: 2.5,
            scrollBehavior: 'smooth',
            '&::-webkit-scrollbar': { width: 4 },
            '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
            '&::-webkit-scrollbar-thumb': { 
              bgcolor: 'rgba(255,255,255,0.15)', 
              borderRadius: 2,
              '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' },
            },
          }}
        >
          {/* Welcome Message */}
          {messages.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <Box
                sx={{
                  width: 72,
                  height: 72,
                  borderRadius: 2,
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 100%)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  boxShadow: '0 6px 20px rgba(99, 102, 241, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mx: 'auto',
                  mb: 2,
                  overflow: 'hidden',
                }}
              >
                <Box
                  component="img"
                  src="/logo.png"
                  alt="SCC Shop"
                  sx={{
                    width: 52,
                    height: 52,
                    objectFit: 'contain',
                    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
                  }}
                  onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </Box>
              
              <Typography sx={{ 
                color: 'rgba(255,255,255,0.95)', 
                fontWeight: 600, 
                fontSize: 18,
                mb: 0.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0.75,
              }}>
                สวัสดีค่ะ! <WavingHandIcon sx={{ fontSize: 20, color: '#fbbf24' }} />
              </Typography>
              
              {aiEnabled && (
                <Box sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.5,
                  fontSize: 11,
                  px: 1,
                  py: 0.4,
                  borderRadius: 1,
                  background: 'rgba(99, 102, 241, 0.15)',
                  border: '1px solid rgba(99, 102, 241, 0.25)',
                  color: 'rgba(165, 180, 252, 0.95)',
                  fontWeight: 500,
                  mb: 1.5,
                }}>
                  <AutoAwesomeIcon sx={{ fontSize: 12 }} />
                  ขับเคลื่อนด้วย Gemini AI
                </Box>
              )}
              
              <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, mb: 2 }}>
                ถามเกี่ยวกับสินค้า ราคา ไซซ์ ได้เลยค่ะ
              </Typography>

              {/* Shop Stats */}
              {shopInfo && typeof shopInfo.totalProducts === 'number' && shopInfo.totalProducts > 0 && (
                <Box sx={{ 
                  display: 'flex', 
                  justifyContent: 'center', 
                  gap: 1, 
                  mb: 2.5,
                  flexWrap: 'wrap',
                }}>
                  <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    fontSize: 11,
                    color: 'rgba(165, 180, 252, 0.9)',
                    background: 'rgba(99, 102, 241, 0.15)',
                    border: '1px solid rgba(99, 102, 241, 0.25)',
                    px: 1.25,
                    py: 0.4,
                    borderRadius: 1,
                  }}>
                    <StorefrontIcon sx={{ fontSize: 13 }} />
                    {shopInfo.totalProducts} สินค้า
                  </Box>
                  {typeof shopInfo.availableProducts === 'number' && shopInfo.availableProducts > 0 && (
                    <Box sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      fontSize: 11,
                      color: 'rgba(110, 231, 183, 0.9)',
                      background: 'rgba(16, 185, 129, 0.15)',
                      border: '1px solid rgba(16, 185, 129, 0.25)',
                      px: 1.25,
                      py: 0.4,
                      borderRadius: 1,
                    }}>
                      <VerifiedIcon sx={{ fontSize: 12 }} /> {shopInfo.availableProducts} พร้อมขาย
                    </Box>
                  )}
                  {shopInfo.priceRange && shopInfo.priceRange.max > 0 && (
                    <Box sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      fontSize: 11,
                      color: 'rgba(251, 191, 36, 0.9)',
                      background: 'rgba(251, 191, 36, 0.15)',
                      border: '1px solid rgba(251, 191, 36, 0.25)',
                      px: 1.25,
                      py: 0.4,
                      borderRadius: 1,
                    }}>
                      <PaidOutlinedIcon sx={{ fontSize: 12 }} /> {shopInfo.priceRange.min === shopInfo.priceRange.max 
                        ? `${shopInfo.priceRange.min}฿`
                        : `${shopInfo.priceRange.min}-${shopInfo.priceRange.max}฿`}
                    </Box>
                  )}
                </Box>
              )}
              
              {/* Quick Questions */}
              <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, mb: 1.5, textAlign: 'left' }}>
                ลองถาม:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, justifyContent: 'center' }}>
                {QUICK_QUESTIONS_DATA.map((q, i) => (
                  <Chip
                    key={i}
                    icon={<QuickQuestionIcon type={q.icon} />}
                    label={q.label}
                    onClick={() => handleQuickQuestion(q.label)}
                    sx={{
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      color: 'rgba(255,255,255,0.8)',
                      fontSize: 12,
                      height: 32,
                      borderRadius: 1.5,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      pl: 0.5,
                      '& .MuiChip-icon': {
                        color: 'rgba(165, 180, 252, 0.9)',
                        marginLeft: '6px',
                      },
                      '&:hover': {
                        background: 'rgba(255,255,255,0.12)',
                        borderColor: 'rgba(255,255,255,0.2)',
                      },
                    }}
                  />
                ))}
              </Box>
            </Box>
          )}

          {/* Chat Messages */}
          {messages.map((msg) => (
            <Box 
              key={msg.id} 
              sx={{ 
                display: 'flex', 
                mb: 2, 
                flexDirection: msg.sender === 'user' ? 'row-reverse' : 'row', 
                alignItems: 'flex-start',
                animation: 'messageSlide 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                '@keyframes messageSlide': {
                  from: { 
                    opacity: 0, 
                    transform: msg.sender === 'user' ? 'translateX(20px)' : 'translateX(-20px)',
                  },
                  to: { opacity: 1, transform: 'translateX(0)' },
                },
              }}
            >
              {/* Avatar */}
              <Avatar 
                src={msg.sender === 'user' && userSession?.image ? userSession.image : undefined}
                sx={{ 
                  background: msg.sender === 'user' 
                    ? 'rgba(99, 102, 241, 0.5)'
                    : 'rgba(255,255,255,0.1)',
                  border: msg.sender === 'user'
                    ? '1px solid rgba(139, 92, 246, 0.4)'
                    : '1px solid rgba(255,255,255,0.12)',
                  width: 30, 
                  height: 30, 
                  fontSize: 14,
                  flexShrink: 0,
                  mt: 0.5,
                }}
              >
                {msg.sender === 'user' ? (
                  userSession?.image ? null : <PersonOutlineIcon sx={{ fontSize: 16 }} />
                ) : (
                  <SmartToyIcon sx={{ fontSize: 16, color: '#a5b4fc' }} />
                )}
              </Avatar>
              <Box sx={{ mx: 1.25, maxWidth: '78%' }}>
                {/* Product Images */}
                {msg.productImages && msg.productImages.length > 0 && (
                  <Box sx={{ 
                    display: 'flex', 
                    gap: 1, 
                    mb: 1, 
                    flexWrap: 'wrap',
                    justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                  }}>
                    {msg.productImages.map((product, idx) => (
                      <Box
                        key={idx}
                        onClick={() => setLightboxImage(product.image)}
                        sx={{
                          position: 'relative',
                          width: 72,
                          height: 72,
                          borderRadius: 1.5,
                          overflow: 'hidden',
                          border: '1px solid rgba(255,255,255,0.15)',
                          background: 'rgba(255,255,255,0.05)',
                          flexShrink: 0,
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            transform: 'scale(1.05)',
                            borderColor: 'rgba(99, 102, 241, 0.5)',
                            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
                          },
                          '&:hover .zoom-icon': {
                            opacity: 1,
                          },
                        }}
                      >
                        <Box
                          component="img"
                          src={product.image}
                          alt={product.name}
                          sx={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                          }}
                          onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                        <Box
                          className="zoom-icon"
                          sx={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            opacity: 0,
                            transition: 'opacity 0.2s',
                            background: 'rgba(0,0,0,0.5)',
                            borderRadius: '50%',
                            p: 0.5,
                          }}
                        >
                          <FullscreenIcon sx={{ fontSize: 16, color: 'white' }} />
                        </Box>
                        <Box
                          sx={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
                            px: 0.5,
                            py: 0.25,
                          }}
                        >
                          <Typography
                            sx={{
                              fontSize: 8,
                              color: 'white',
                              textAlign: 'center',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {product.name}
                          </Typography>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                )}
                
                {/* Reply Reference */}
                {msg.replyTo && (
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      mb: 0.5,
                      px: 1,
                      py: 0.5,
                      borderRadius: 1,
                      bgcolor: msg.sender === 'user' 
                        ? 'rgba(139, 92, 246, 0.2)'
                        : 'rgba(255,255,255,0.05)',
                      borderLeft: msg.replyTo.sender === 'user' 
                        ? '2px solid rgba(139, 92, 246, 0.6)'
                        : '2px solid rgba(165, 180, 252, 0.6)',
                      fontSize: 11,
                      color: 'rgba(255,255,255,0.6)',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      '&:hover': {
                        bgcolor: msg.sender === 'user' 
                          ? 'rgba(139, 92, 246, 0.3)'
                          : 'rgba(255,255,255,0.08)',
                      },
                    }}
                    onClick={() => {
                      const el = document.getElementById(msg.replyTo!.id);
                      if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        el.style.transition = 'background 0.3s';
                        el.style.background = 'rgba(99, 102, 241, 0.3)';
                        setTimeout(() => {
                          el.style.background = '';
                        }, 1500);
                      }
                    }}
                  >
                    <ReplyIcon sx={{ fontSize: 12, transform: 'scaleX(-1)' }} />
                    <Box sx={{ 
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis', 
                      whiteSpace: 'nowrap',
                      flex: 1,
                    }}>
                      <Box component="span" sx={{ fontWeight: 500, mr: 0.5 }}>
                        {msg.replyTo.sender === 'user' ? 'คุณ' : 'Bot'}:
                      </Box>
                      {msg.replyTo.text}
                    </Box>
                  </Box>
                )}
                
                {/* Message Bubble */}
                <Box
                  id={msg.id}
                  sx={{
                    background: msg.sender === 'user' 
                      ? 'rgba(99, 102, 241, 0.35)'
                      : 'rgba(255,255,255,0.08)',
                    border: msg.sender === 'user'
                      ? '1px solid rgba(139, 92, 246, 0.35)'
                      : '1px solid rgba(255,255,255,0.1)',
                    color: 'rgba(255,255,255,0.95)',
                    px: 1.5,
                    py: 1,
                    borderRadius: msg.sender === 'user' 
                      ? '14px 14px 4px 14px' 
                      : '14px 14px 14px 4px',
                    fontSize: 13,
                    lineHeight: 1.55,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    transition: 'background 0.3s',
                  }}
                >
                  {renderText(msg.text)}
                </Box>
                {/* Message Meta */}
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 0.5,
                  fontSize: 10, 
                  color: 'rgba(255,255,255,0.4)', 
                  mt: 0.5,
                  textAlign: msg.sender === 'user' ? 'right' : 'left',
                  flexDirection: msg.sender === 'user' ? 'row-reverse' : 'row',
                }}>
                  <span>{formatTime(msg.timestamp)}</span>
                  {msg.isEdited && (
                    <Box sx={{
                      fontSize: 9,
                      color: 'rgba(255,255,255,0.4)',
                      fontStyle: 'italic',
                    }}>
                      (แก้ไขแล้ว)
                    </Box>
                  )}
                  {msg.sender === 'bot' && msg.source === 'ai' && (
                    <Box 
                      sx={{
                        fontSize: 9,
                        px: 0.6,
                        py: 0.2,
                        borderRadius: 0.5,
                        bgcolor: 'rgba(16, 185, 129, 0.2)',
                        color: '#6ee7b7',
                        cursor: 'help',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.25,
                      }}
                      title={msg.modelUsed ? `Powered by ${msg.modelUsed}` : 'AI'}
                    >
                      <AutoAwesomeIcon sx={{ fontSize: 10 }} /> {msg.modelUsed ? msg.modelUsed.replace('gemini-', '') : 'AI'}
                    </Box>
                  )}
                  {msg.sender === 'bot' && msg.source === 'faq' && (
                    <Box sx={{
                      fontSize: 9,
                      px: 0.6,
                      py: 0.2,
                      borderRadius: 0.5,
                      bgcolor: 'rgba(99, 102, 241, 0.2)',
                      color: '#a5b4fc',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.25,
                    }}>
                      <MenuBookOutlinedIcon sx={{ fontSize: 10 }} /> FAQ
                    </Box>
                  )}
                  {msg.sender === 'user' && (
                    <IconButton
                      size="small"
                      onClick={() => handleEditMessage(msg)}
                      sx={{
                        p: 0.25,
                        color: 'rgba(255,255,255,0.4)',
                        '&:hover': { color: '#fbbf24', bgcolor: 'transparent' },
                      }}
                      title="แก้ไขข้อความ"
                    >
                      <EditIcon sx={{ fontSize: 12 }} />
                    </IconButton>
                  )}
                  <IconButton
                    size="small"
                    onClick={() => handleReply(msg)}
                    sx={{
                      p: 0.25,
                      color: 'rgba(255,255,255,0.4)',
                      '&:hover': { color: '#a5b4fc', bgcolor: 'transparent' },
                    }}
                    title="ตอบกลับ"
                  >
                    <ReplyIcon sx={{ fontSize: 12, transform: 'scaleX(-1)' }} />
                  </IconButton>
                  {msg.sender === 'bot' && (
                    <IconButton
                      size="small"
                      onClick={() => handleCopyMessage(msg.id, msg.text)}
                      sx={{
                        p: 0.25,
                        color: copiedMessageId === msg.id ? '#4ade80' : 'rgba(255,255,255,0.4)',
                        '&:hover': { color: 'rgba(255,255,255,0.8)', bgcolor: 'transparent' },
                      }}
                      title="คัดลอก"
                    >
                      {copiedMessageId === msg.id ? (
                        <CheckIcon sx={{ fontSize: 12 }} />
                      ) : (
                        <ContentCopyIcon sx={{ fontSize: 12 }} />
                      )}
                    </IconButton>
                  )}
                </Box>

                {/* Suggestions */}
                {msg.sender === 'bot' && msg.suggestions && msg.suggestions.length > 0 && (
                  <Box sx={{ mt: 1.5, display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                    {msg.suggestions.map((s, i) => (
                      <Chip
                        key={i}
                        label={s}
                        size="small"
                        onClick={() => handleQuickQuestion(s)}
                        sx={{
                          background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
                          color: 'rgba(165, 180, 252, 0.9)',
                          border: '1px solid rgba(255,255,255,0.15)',
                          fontSize: 11,
                          height: 28,
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          '&:hover': { 
                            background: 'rgba(255,255,255,0.1)',
                            borderColor: 'rgba(255,255,255,0.2)',
                          },
                        }}
                      />
                    ))}
                  </Box>
                )}

                {/* Related Questions */}
                {msg.sender === 'bot' && msg.relatedQuestions && msg.relatedQuestions.length > 0 && (
                  <Box sx={{ mt: 1.5 }}>
                    <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', mb: 0.75 }}>
                      คำถามที่เกี่ยวข้อง:
                    </Typography>
                    {msg.relatedQuestions.map((q, i) => (
                      <Box 
                        key={i}
                        onClick={() => handleQuickQuestion(q)}
                        sx={{ 
                          color: 'rgba(165, 180, 252, 0.8)', 
                          fontSize: 12, 
                          cursor: 'pointer',
                          py: 0.25,
                          transition: 'all 0.2s',
                          '&:hover': { 
                            color: 'rgba(165, 180, 252, 1)',
                            transform: 'translateX(4px)',
                          },
                        }}
                      >
                        → {q}
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>
            </Box>
          ))}

          {/* Typing Indicator */}
          {loading && (
            <Box sx={{ display: 'flex', alignItems: 'flex-end', mb: 2 }}>
              <Avatar 
                sx={{ 
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  width: 32, 
                  height: 32,
                }}
              >
                <SmartToyIcon sx={{ fontSize: 18, color: '#a5b4fc' }} />
              </Avatar>
              <Box
                sx={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  px: 2,
                  py: 1.25,
                  borderRadius: '12px 12px 12px 4px',
                  mx: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                }}
              >
                {[0, 1, 2].map((i) => (
                  <Box
                    key={i}
                    sx={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      bgcolor: '#a5b4fc',
                      animation: 'bounce 1.4s infinite',
                      animationDelay: `${i * 0.16}s`,
                      '@keyframes bounce': {
                        '0%, 80%, 100%': { transform: 'translateY(0)' },
                        '40%': { transform: 'translateY(-5px)' },
                      },
                    }}
                  />
                ))}
              </Box>
            </Box>
          )}

          <div ref={messagesEndRef} />
        </DialogContent>

        {/* Reply Preview */}
        {replyToMessage && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              mx: 1.5,
              mt: 0.75,
              px: 1.5,
              py: 0.5,
              borderRadius: 1.5,
              bgcolor: 'rgba(99, 102, 241, 0.15)',
              borderLeft: '3px solid rgba(99, 102, 241, 0.6)',
            }}
          >
            <ReplyIcon sx={{ fontSize: 14, color: '#a5b4fc', transform: 'scaleX(-1)' }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ 
                fontSize: 11, 
                color: 'rgba(255,255,255,0.7)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                <Box component="span" sx={{ color: '#a5b4fc', fontWeight: 500, mr: 0.5 }}>
                  ตอบกลับ {replyToMessage.sender === 'user' ? 'คุณ' : 'Bot'}:
                </Box>
                {replyToMessage.text}
              </Typography>
            </Box>
            <IconButton
              size="small"
              onClick={() => setReplyToMessage(null)}
              sx={{ 
                p: 0.25,
                color: 'rgba(255,255,255,0.5)',
                '&:hover': { color: 'rgba(255,255,255,0.8)' },
              }}
            >
              <CloseIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Box>
        )}

        {/* Edit Preview */}
        {editingMessage && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              mx: 1.5,
              mt: 0.75,
              px: 1.5,
              py: 0.5,
              borderRadius: 1.5,
              bgcolor: 'rgba(251, 191, 36, 0.15)',
              borderLeft: '3px solid rgba(251, 191, 36, 0.6)',
            }}
          >
            <EditIcon sx={{ fontSize: 14, color: '#fbbf24' }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ 
                fontSize: 11, 
                color: 'rgba(255,255,255,0.7)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                <Box component="span" sx={{ color: '#fbbf24', fontWeight: 500, mr: 0.5 }}>
                  แก้ไขข้อความ
                </Box>
                {editingMessage.text.slice(0, 50) + (editingMessage.text.length > 50 ? '...' : '')}
              </Typography>
            </Box>
            <IconButton
              size="small"
              onClick={cancelEditMode}
              sx={{ 
                p: 0.25,
                color: 'rgba(255,255,255,0.5)',
                '&:hover': { color: 'rgba(255,255,255,0.8)' },
              }}
            >
              <CloseIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Box>
        )}

        {/* Input Area */}
        <Box sx={{ 
          px: 1.5,
          pt: (replyToMessage || editingMessage) ? 0.5 : 1,
          pb: 1.25,
          background: 'rgba(255,255,255,0.05)',
          borderTop: (replyToMessage || editingMessage) ? 'none' : '1px solid rgba(255,255,255,0.08)',
        }}>
          <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'flex-end' }}>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageUpload}
              accept="image/png,image/jpeg,image/jpg,image/webp"
              style={{ display: 'none' }}
            />
            
            <IconButton
              onClick={() => fileInputRef.current?.click()}
              disabled={loading || isUploading}
              sx={{
                width: 40,
                height: 40,
                borderRadius: 1.5,
                bgcolor: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.6)',
                flexShrink: 0,
                transition: 'all 0.2s',
                '&:hover': {
                  bgcolor: 'rgba(255,255,255,0.1)',
                  color: 'rgba(255,255,255,0.9)',
                },
                '&:disabled': {
                  color: 'rgba(255,255,255,0.3)',
                },
              }}
              title="อัปโหลดรูปภาพ"
            >
              {isUploading ? (
                <CircularProgress size={18} sx={{ color: 'rgba(255,255,255,0.5)' }} />
              ) : (
                <AddPhotoAlternateIcon sx={{ fontSize: 20 }} />
              )}
            </IconButton>
            
            <Box
              sx={{
                flex: 1,
                display: 'flex',
                alignItems: 'flex-end',
                gap: 1,
                background: 'rgba(255,255,255,0.05)',
                borderRadius: 1.5,
                border: '1px solid rgba(255,255,255,0.1)',
                px: 1,
                py: 0.5,
                transition: 'all 0.2s',
                '&:focus-within': {
                  borderColor: 'rgba(99, 102, 241, 0.5)',
                },
                '&:hover': {
                  borderColor: 'rgba(255,255,255,0.2)',
                },
              }}
            >
              {uploadedImage && (
                <Box
                  sx={{
                    position: 'relative',
                    flexShrink: 0,
                    mb: 0.5,
                  }}
                >
                  <Box
                    component="img"
                    src={uploadedImage.preview}
                    alt="Preview"
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: 1,
                      objectFit: 'cover',
                      border: '1px solid rgba(99, 102, 241, 0.4)',
                    }}
                  />
                  <IconButton
                    size="small"
                    onClick={() => setUploadedImage(null)}
                    sx={{ 
                      position: 'absolute',
                      top: -5,
                      right: -5,
                      width: 16,
                      height: 16,
                      p: 0,
                      bgcolor: 'rgba(239, 68, 68, 0.9)',
                      color: 'white',
                      '&:hover': {
                        bgcolor: 'rgba(220, 38, 38, 1)',
                      },
                    }}
                  >
                    <CloseIcon sx={{ fontSize: 10 }} />
                  </IconButton>
                </Box>
              )}
              
              <TextField
                inputRef={inputRef}
                autoFocus
                fullWidth
                size="small"
                multiline
                minRows={1}
                maxRows={3}
                placeholder={editingMessage ? "แก้ไขข้อความ..." : uploadedImage ? "พิมพ์คำถามเกี่ยวกับรูป..." : "พิมพ์คำถามของคุณ..."}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !loading) {
                    e.preventDefault();
                    uploadedImage ? handleSendWithImage() : handleSend();
                  }
                }}
                disabled={loading}
                sx={{
                  flex: 1,
                  '& .MuiOutlinedInput-root': {
                    background: 'transparent',
                    color: 'rgba(255,255,255,0.95)',
                    fontSize: 14,
                    '& fieldset': { 
                      border: 'none',
                    },
                  },
                  '& .MuiOutlinedInput-input': {
                    py: 0.75,
                    px: 0,
                    '&::placeholder': { color: 'rgba(255,255,255,0.4)', opacity: 1 },
                  },
                }}
              />
            </Box>
            
            <Button
              variant="contained"
              onClick={() => uploadedImage ? handleSendWithImage() : handleSend()}
              disabled={loading || (!input.trim() && !uploadedImage)}
              sx={{
                minWidth: 40,
                height: 40,
                borderRadius: 1.5,
                flexShrink: 0,
                bgcolor: uploadedImage ? 'rgba(16, 185, 129, 0.5)' : 'rgba(99, 102, 241, 0.5)',
                border: uploadedImage ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(139, 92, 246, 0.35)',
                transition: 'all 0.2s',
                '&:hover': {
                  bgcolor: uploadedImage ? 'rgba(16, 185, 129, 0.65)' : 'rgba(99, 102, 241, 0.65)',
                },
                '&:disabled': {
                  bgcolor: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: 'rgba(255,255,255,0.3)',
                },
              }}
            >
              <SendIcon sx={{ fontSize: 18 }} />
            </Button>
          </Box>
          <Typography sx={{ 
            fontSize: 9, 
            color: 'rgba(255,255,255,0.3)', 
            mt: 0.5, 
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.5,
            flexWrap: 'wrap',
          }}>
            {userSession && (
              <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                <PersonOutlineIcon sx={{ fontSize: 10 }} />
                {userSession.name || userSession.email}
                <Box component="span" sx={{ mx: 0.5 }}>•</Box>
              </Box>
            )}
            <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
              <AutoAwesomeIcon sx={{ fontSize: 10 }} /> Gemini AI
            </Box>
            <Box component="span" sx={{ mx: 0.5 }}>•</Box>
            <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
              <ImageOutlinedIcon sx={{ fontSize: 10 }} /> รองรับรูปภาพ
            </Box>
          </Typography>
        </Box>
      </Dialog>

      {/* Image Lightbox */}
      <Dialog
        open={!!lightboxImage}
        onClose={() => setLightboxImage(null)}
        maxWidth="lg"
        PaperProps={{
          sx: {
            background: 'rgba(0,0,0,0.95)',
            borderRadius: 2,
            overflow: 'hidden',
          }
        }}
      >
        <IconButton
          onClick={() => setLightboxImage(null)}
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            color: 'white',
            bgcolor: 'rgba(0,0,0,0.5)',
            '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
            zIndex: 1,
          }}
        >
          <CloseIcon />
        </IconButton>
        {lightboxImage && (
          <Box
            component="img"
            src={lightboxImage}
            alt="Full size"
            sx={{
              maxWidth: '90vw',
              maxHeight: '90vh',
              objectFit: 'contain',
            }}
          />
        )}
      </Dialog>
    </>
  );
}

// ==================== CHATBOT FAB ====================
export interface ChatBotFabProps {
  onClick: () => void;
  showPulse?: boolean;
}

export function ChatBotFab({ onClick, showPulse = true }: ChatBotFabProps) {
  return (
    <Box
      onClick={onClick}
      sx={{
        position: 'fixed',
        bottom: { xs: 85, sm: 24 },
        right: { xs: 16, sm: 24 },
        zIndex: 1200,
        width: 56,
        height: 56,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, rgba(99,102,241,0.9) 0%, rgba(139,92,246,0.9) 100%)',
        border: '2px solid rgba(255,255,255,0.2)',
        boxShadow: '0 8px 32px rgba(99, 102, 241, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        '&:hover': {
          transform: 'scale(1.1)',
          boxShadow: '0 12px 40px rgba(99, 102, 241, 0.5)',
        },
        '&:active': {
          transform: 'scale(0.95)',
        },
        ...(showPulse && {
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: -4,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(99,102,241,0.5) 0%, rgba(139,92,246,0.5) 100%)',
            animation: 'pulse 2s ease-in-out infinite',
            zIndex: -1,
          },
          '@keyframes pulse': {
            '0%, 100%': { transform: 'scale(1)', opacity: 0.5 },
            '50%': { transform: 'scale(1.15)', opacity: 0 },
          },
        }),
      }}
    >
      <ChatIcon sx={{ color: 'white', fontSize: 28 }} />
    </Box>
  );
}
