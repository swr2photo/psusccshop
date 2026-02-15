'use client';

import React from 'react';
import { MessageCircle as ChatIcon, Send as SendIcon, X as CloseIcon, Bot as SmartToyIcon, RotateCcw as RefreshIcon, Sparkles as AutoAwesomeIcon, Store as StorefrontIcon, Copy as ContentCopyIcon, Check as CheckIcon, Maximize2 as FullscreenIcon, Minimize2 as FullscreenExitIcon, ImagePlus as AddPhotoAlternateIcon, ShoppingCart as ShoppingCartOutlinedIcon, Coins as PaidOutlinedIcon, Ruler as StraightenOutlinedIcon, Truck as LocalShippingOutlinedIcon, Wallet as AccountBalanceWalletOutlinedIcon, HelpCircle as HelpOutlineOutlinedIcon, Image as ImageOutlinedIcon, User as PersonOutlineIcon, BadgeCheck as VerifiedIcon, BookOpen as MenuBookOutlinedIcon, Hand as WavingHandIcon, Reply as ReplyIcon, Pencil as EditIcon, ClipboardList as ClipboardListIcon, Tag as TagIcon } from 'lucide-react';

// ==================== CHATBOT COMPONENT (Enhanced with Logo & AI) ====================
const QUICK_QUESTIONS_KEYS = [
  { icon: 'cart', key: 'howToOrder' as const },
  { icon: 'price', key: 'pricing' as const },
  { icon: 'size', key: 'sizeAndFit' as const },
  { icon: 'order', key: 'checkOrder' as const },
  { icon: 'shipping', key: 'shipping' as const },
  { icon: 'payment', key: 'paymentMethod' as const },
  { icon: 'promo', key: 'promoCode' as const },
  { icon: 'help', key: 'contactShop' as const },
];

// Helper to render quick question icon
const QuickQuestionIcon = ({ type, size = 14 }: { type: string; size?: number }) => {
  switch (type) {
    case 'cart': return <ShoppingCartOutlinedIcon size={size} opacity={0.85} />;
    case 'price': return <PaidOutlinedIcon size={size} opacity={0.85} />;
    case 'size': return <StraightenOutlinedIcon size={size} opacity={0.85} />;
    case 'order': return <ClipboardListIcon size={size} opacity={0.85} />;
    case 'shipping': return <LocalShippingOutlinedIcon size={size} opacity={0.85} />;
    case 'payment': return <AccountBalanceWalletOutlinedIcon size={size} opacity={0.85} />;
    case 'promo': return <TagIcon size={size} opacity={0.85} />;
    case 'help': return <HelpOutlineOutlinedIcon size={size} opacity={0.85} />;
    default: return null;
  }
};

const QUICK_QUESTIONS = QUICK_QUESTIONS_KEYS.map(q => q.key);

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
  modelUsed?: string; // ชื่อโมเดล AI ที่ใช้
  replyTo?: { id: string; text: string; sender: 'user' | 'bot' }; // ข้อความที่ตอบกลับ
  isEdited?: boolean; // ข้อความถูกแก้ไข
}

// Session storage key for chat history (encrypted)
const CHAT_STORAGE_KEY = 'scc_chat_history';
const CHAT_SESSION_ID_KEY = 'scc_chat_session_id';
const CHAT_PERSISTENT_KEY = 'scc_chat_persistent'; // LocalStorage for logged-in users

interface ShirtChatBotProps {
  open: boolean;
  setOpen: (open: boolean) => void;
}

function ShirtChatBot({ open, setOpen }: ShirtChatBotProps) {
  const { t, lang } = useTranslation();
  const { warning: toastWarning, error: toastError } = useNotification();
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
  // New states for enhanced features
  const [lightboxImage, setLightboxImage] = React.useState<string | null>(null);
  const [lightboxImages, setLightboxImages] = React.useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = React.useState(0);
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

  // Save chat history securely (localStorage for logged-in, sessionStorage for guests)
  const saveChatHistory = React.useCallback((msgs: ChatMessage[], email?: string) => {
    if (typeof window === 'undefined') return;
    try {
      // Only save last 50 messages for logged-in users, 20 for guests
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
        // Logged-in users: save to localStorage with email hash
        const key = `${CHAT_PERSISTENT_KEY}_${btoa(email).slice(0, 16)}`;
        localStorage.setItem(key, JSON.stringify(sanitizedMsgs));
      } else {
        // Guests: save to sessionStorage
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
        // Try localStorage first for logged-in users
        const key = `${CHAT_PERSISTENT_KEY}_${btoa(email).slice(0, 16)}`;
        saved = localStorage.getItem(key);
      }
      
      // Fallback to sessionStorage
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
          // Load chat history for logged-in user
          const savedMessages = loadChatHistory(data.user.email);
          if (savedMessages.length > 0) {
            setMessages(savedMessages);
          }
        } else {
          // Load chat history for guest
          const savedMessages = loadChatHistory();
          if (savedMessages.length > 0) {
            setMessages(savedMessages);
          }
        }
      })
      .catch(() => {
        // Load guest chat history on error
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

  // Auto scroll to bottom with delay to ensure DOM is updated
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
      // Check if AI is enabled and get shop info
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
    setEditingMessage(null); // Clear edit mode if any
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
    setReplyToMessage(null); // Clear reply mode if any
    setEditingMessage({
      id: msg.id,
      text: msg.text.replace(/^\[รูปภาพ\]\s*/, ''), // Remove image prefix if any
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
      // Find the index of the message being edited
      const editIndex = messages.findIndex(m => m.id === editingMessage.id);
      if (editIndex === -1) {
        setEditingMessage(null);
        return;
      }
      
      // Update the user message and remove all messages after it
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
        // Get conversation history up to the edited message
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
          text: t.chatbot.errorRetry,
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
    setReplyToMessage(null); // Clear reply after sending
    setLoading(true);
    
    try {
      // Include reply context in the message if replying
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
        productImages: data.productImages, // รูปภาพสินค้าที่เกี่ยวข้อง
        modelUsed: data.modelUsed, // ชื่อโมเดล AI ที่ใช้
      };
      
      setMessages((prev) => [...prev, botMsg]);
    } catch (e) {
      const errorMsg: ChatMessage = {
        id: generateId(),
        sender: 'bot',
        text: t.chatbot.errorRetry,
        timestamp: new Date(),
        suggestions: QUICK_QUESTIONS,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Enter = ส่งข้อความ, Shift+Enter = ขึ้นบรรทัดใหม่
    if (e.key === 'Enter' && !e.shiftKey && !loading) {
      e.preventDefault();
      handleSend();
    }
    // Escape = ยกเลิกโหมดแก้ไข/ตอบกลับ
    if (e.key === 'Escape') {
      if (editingMessage) {
        cancelEditMode();
      } else if (replyToMessage) {
        setReplyToMessage(null);
      }
    }
  };

  const handleQuickQuestion = (question: string) => {
    // Set input first so user sees the question, then send
    setInput(question);
    // Small delay to show the question in input before sending
    setTimeout(() => {
      handleSend(question);
    }, 50);
  };

  const handleClearChat = () => {
    setMessages([]);
    setUploadedImage(null);
    // Clear storage
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(CHAT_STORAGE_KEY);
      if (userSession?.email) {
        const key = `${CHAT_PERSISTENT_KEY}_${btoa(userSession.email).slice(0, 16)}`;
        localStorage.removeItem(key);
      }
    }
  };

  // Handle image upload for visual questions
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file type and size
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toastWarning(t.chatbot.imageOnly);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toastWarning(t.chatbot.maxFileSize);
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
        toastError(t.chatbot.cannotReadFile);
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Upload error:', err);
      setIsUploading(false);
    }
    
    // Reset file input
    if (e.target) e.target.value = '';
  };

  // Send message with image
  const handleSendWithImage = async () => {
    if (!uploadedImage && !input.trim()) return;
    
    const msgText = input.trim() || t.chatbot.defaultImageQuery;
    const userMsg: ChatMessage = {
      id: generateId(),
      sender: 'user',
      text: uploadedImage ? `[รูปภาพ] ${msgText}` : msgText,
      timestamp: new Date(),
      productImages: uploadedImage ? [{ name: t.chatbot.uploadedImage, image: uploadedImage.preview }] : undefined,
      replyTo: replyToMessage || undefined,
    };
    
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    const imageToSend = uploadedImage?.base64;
    setUploadedImage(null);
    setReplyToMessage(null); // Clear reply after sending
    setLoading(true);
    
    try {
      // Include reply context in the message if replying
      const contextMessage = replyToMessage 
        ? `(ตอบกลับ: "${replyToMessage.text}") ${msgText}`
        : msgText;
      
      const res = await fetch('/api/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: contextMessage,
          conversationHistory: getConversationHistory(),
          image: imageToSend, // Send image to API
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
        text: t.chatbot.errorRetry,
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

  // Toggle fullscreen mode
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString(lang === 'th' ? 'th-TH' : 'en-US', { hour: '2-digit', minute: '2-digit' });
  };

  // Parse and render markdown tables
  const parseMarkdownTable = (text: string): { isTable: boolean; rows: string[][] } => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return { isTable: false, rows: [] };
    
    // Check if it looks like a markdown table
    const hasHeaders = lines[0].includes('|');
    const hasSeparator = lines[1] && /^\|?[\s\-:|]+\|?$/.test(lines[1]);
    
    if (!hasHeaders || !hasSeparator) return { isTable: false, rows: [] };
    
    const rows: string[][] = [];
    for (let i = 0; i < lines.length; i++) {
      if (i === 1) continue; // Skip separator line
      const line = lines[i].trim();
      if (line.startsWith('|') || line.includes('|')) {
        const cells = line.split('|')
          .map(cell => cell.trim())
          .filter((cell, idx, arr) => idx !== 0 || cell !== ''); // Remove empty first cell
        if (cells[cells.length - 1] === '') cells.pop(); // Remove empty last cell
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
            border: '1px solid var(--glass-border)',
            px: 1.5,
            py: 0.75,
            textAlign: 'left',
          },
          '& th': {
            bgcolor: 'rgba(0,113,227, 0.2)',
            fontWeight: 600,
            color: 'var(--secondary)',
          },
          '& td': {
            bgcolor: 'var(--glass-bg)',
          },
          '& tr:hover td': {
            bgcolor: 'var(--glass-bg)',
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

  // Render inline markdown (bold, italic, links, bullet points, etc)
  const renderInlineMarkdown = (text: string): React.ReactNode => {
    // Split by line breaks first
    const lines = text.split('\n');
    
    return lines.map((line, lineIdx) => {
      // Check if it's a bullet point
      const bulletMatch = line.match(/^[\s]*[•\-\*]\s*(.*)/);
      if (bulletMatch) {
        return (
          <Box key={lineIdx} sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, my: 0.25 }}>
            <Box component="span" sx={{ color: 'var(--secondary)', flexShrink: 0 }}>•</Box>
            <span>{renderTextSegment(bulletMatch[1])}</span>
          </Box>
        );
      }
      
      // Check if it's a numbered list
      const numberedMatch = line.match(/^[\s]*(\d+)[.\)]\s*(.*)/);
      if (numberedMatch) {
        return (
          <Box key={lineIdx} sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, my: 0.25 }}>
            <Box component="span" sx={{ color: 'var(--secondary)', flexShrink: 0, minWidth: 16 }}>{numberedMatch[1]}.</Box>
            <span>{renderTextSegment(numberedMatch[2])}</span>
          </Box>
        );
      }
      
      // Regular line
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
    // Handle bold **text** and links [text](url)
    const parts = text.split(/(\*\*.*?\*\*|\[.*?\]\(.*?\)|`.*?`)/g);
    return parts.map((part, i) => {
      // Bold
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} style={{ color: 'var(--primary)' }}>{part.slice(2, -2)}</strong>;
      }
      // Link
      const linkMatch = part.match(/\[(.*?)\]\((.*?)\)/);
      if (linkMatch) {
        return (
          <Box 
            key={i} 
            component="a" 
            href={linkMatch[2]} 
            target="_blank" 
            rel="noopener noreferrer"
            sx={{ color: '#0071e3', textDecoration: 'underline', '&:hover': { color: 'var(--secondary)' } }}
          >
            {linkMatch[1]}
          </Box>
        );
      }
      // Inline code
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <Box 
            key={i} 
            component="code" 
            sx={{ 
              bgcolor: 'var(--glass-bg)', 
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
    // Check if text contains a markdown table
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
    
    // No table, just render inline markdown
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
            // Liquid Glass background
            background: (theme: any) => theme.palette.mode === 'dark'
              ? 'linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.03) 100%)'
              : 'linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.9) 100%)',
            backdropFilter: 'blur(32px) saturate(180%)',
            WebkitBackdropFilter: 'blur(32px) saturate(180%)',
            border: isFullscreen ? 'none' : '1px solid var(--glass-border)',
            boxShadow: (theme: any) => isFullscreen ? 'none' : (theme.palette.mode === 'dark' ? '0 20px 40px rgba(0, 0, 0, 0.4)' : '0 20px 40px rgba(0, 0, 0, 0.1)'),
          }
        }}
      >
        {/* Header with Logo - Liquid Glass */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2.5,
            py: 2,
            // Liquid Glass header
            background: (theme: any) => theme.palette.mode === 'dark'
              ? 'linear-gradient(180deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%)'
              : 'linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(245,245,247,0.9) 100%)',
            borderBottom: '1px solid var(--glass-border)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            {/* Logo Container - Glass effect */}
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: 1.5,
                background: (theme: any) => theme.palette.mode === 'dark'
                  ? 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%)'
                  : 'linear-gradient(135deg, rgba(0,113,227,0.1) 0%, rgba(0,113,227,0.03) 100%)',
                border: '1px solid var(--glass-border)',
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
                className="theme-logo"
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
                  color: 'var(--foreground)',
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
                    color: 'var(--success)',
                    fontWeight: 600,
                  }}>
                    <AutoAwesomeIcon size={9} />
                    AI
                  </Box>
                )}
              </Box>
              <Typography sx={{ 
                fontSize: 12, 
                color: 'var(--text-muted)', 
                display: 'flex', 
                alignItems: 'center', 
                gap: 0.5 
              }}>
                {loading ? (
                  <>
                    <AutoAwesomeIcon size={14} color="#2997ff" style={{ animation: 'shimmer 1.5s infinite' }} />
                    {t.chatbot.thinking}
                  </>
                ) : (
                  <>
                    <Box component="span" sx={{ 
                      width: 6, 
                      height: 6, 
                      borderRadius: '50%', 
                      bgcolor: '#30d158',
                      boxShadow: '0 0 6px #30d158',
                    }} />
                    {t.chatbot.online}
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
                color: 'var(--text-muted)', 
                transition: 'all 0.2s',
                '&:hover': { 
                  color: 'var(--foreground)', 
                  bgcolor: 'var(--glass-bg)',
                  transform: 'rotate(180deg)',
                } 
              }}
              title={t.chatbot.clearChat}
            >
              <RefreshIcon size={20} />
            </IconButton>
            <IconButton 
              size="small" 
              onClick={toggleFullscreen}
              sx={{ 
                color: 'var(--text-muted)', 
                display: { xs: 'flex', sm: 'flex' },
                '&:hover': { 
                  color: 'var(--foreground)', 
                  bgcolor: 'var(--glass-bg)' 
                } 
              }}
              title={isFullscreen ? t.chatbot.minimize : t.chatbot.maximize}
            >
              {isFullscreen ? <FullscreenExitIcon size={20} /> : <FullscreenIcon size={20} />}
            </IconButton>
            <IconButton 
              size="small" 
              onClick={() => setOpen(false)}
              sx={{ 
                color: 'var(--text-muted)', 
                '&:hover': { 
                  color: 'var(--foreground)', 
                  bgcolor: 'var(--glass-bg)' 
                } 
              }}
            >
              <CloseIcon size={20} />
            </IconButton>
          </Box>
        </Box>

        {/* Messages Area - Frosted Glass */}
        <DialogContent 
          ref={messagesContainerRef}
          sx={{ 
            background: (theme: any) => theme.palette.mode === 'dark' 
              ? 'linear-gradient(180deg, rgba(0,0,0,0.8) 0%, rgba(29,29,31,0.9) 100%)' 
              : 'linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(245,245,247,0.98) 100%)',
            minHeight: isFullscreen ? 'calc(100vh - 160px)' : 320,
            maxHeight: isFullscreen ? 'calc(100vh - 160px)' : 380,
            overflowY: 'auto',
            px: 2,
            py: 2.5,
            scrollBehavior: 'smooth',
            '&::-webkit-scrollbar': { width: 4 },
            '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
            '&::-webkit-scrollbar-thumb': { 
              bgcolor: 'var(--glass-bg)', 
              borderRadius: 2,
              '&:hover': { bgcolor: 'var(--glass-bg)' },
            },
          }}
        >
          {/* Welcome Message - Liquid Glass */}
          {messages.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 3 }}>
              {/* Logo in Welcome */}
              <Box
                sx={{
                  width: 72,
                  height: 72,
                  borderRadius: 2,
                  background: (theme: any) => theme.palette.mode === 'dark' 
                    ? 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 100%)'
                    : 'linear-gradient(135deg, rgba(0,113,227,0.08) 0%, rgba(0,113,227,0.02) 100%)',
                  border: '1px solid var(--glass-border)',
                  boxShadow: '0 6px 20px rgba(0,113,227, 0.15)',
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
                  className="theme-logo"
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
                color: 'var(--foreground)', 
                fontWeight: 600, 
                fontSize: 18,
                mb: 0.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0.75,
              }}>
                {t.chatbot.welcome} <WavingHandIcon size={20} color="#ffd60a" />
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
                  background: 'rgba(0,113,227, 0.15)',
                  border: '1px solid rgba(0,113,227, 0.25)',
                  color: 'rgba(165, 180, 252, 0.95)',
                  fontWeight: 500,
                  mb: 1.5,
                }}>
                  <AutoAwesomeIcon size={12} />
                  {t.chatbot.poweredBy}
                </Box>
              )}
              
              <Typography sx={{ color: 'var(--text-muted)', fontSize: 13, mb: 2 }}>
                {t.chatbot.askAbout}
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
                    background: 'rgba(0,113,227, 0.15)',
                    border: '1px solid rgba(0,113,227, 0.25)',
                    px: 1.25,
                    py: 0.4,
                    borderRadius: 1,
                  }}>
                    <StorefrontIcon size={13} />
                    {shopInfo.totalProducts} {t.chatbot.products}
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
                      <VerifiedIcon size={12} /> {shopInfo.availableProducts} {t.chatbot.available}
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
                      <PaidOutlinedIcon size={12} /> {shopInfo.priceRange.min === shopInfo.priceRange.max 
                        ? `${shopInfo.priceRange.min}฿`
                        : `${shopInfo.priceRange.min}-${shopInfo.priceRange.max}฿`}
                    </Box>
                  )}
                </Box>
              )}
              
              {/* Quick Questions */}
              <Typography sx={{ color: 'var(--text-muted)', fontSize: 11, mb: 1.5, textAlign: 'left' }}>
                {t.chatbot.trySuggestion}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, justifyContent: 'center' }}>
                {QUICK_QUESTIONS_KEYS.map((q, i) => (
                  <Chip
                    key={i}
                    icon={<QuickQuestionIcon type={q.icon} />}
                    label={t.chatbot[q.key]}
                    onClick={() => handleQuickQuestion(q.key)}
                    sx={{
                      background: 'var(--glass-bg)',
                      border: '1px solid var(--glass-border)',
                      color: 'var(--foreground)',
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
                        background: 'var(--glass-strong)',
                        borderColor: 'var(--glass-border)',
                      },
                    }}
                  />
                ))}
              </Box>
            </Box>
          )}

          {/* Chat Messages - Liquid Glass Bubbles */}
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
              {/* Avatar - แสดงรูปโปรไฟล์ Google สำหรับผู้ใช้ */}
              <Avatar 
                src={msg.sender === 'user' && userSession?.image ? userSession.image : undefined}
                sx={{ 
                  background: msg.sender === 'user' 
                    ? 'rgba(0,113,227, 0.5)'
                    : 'var(--glass-bg)',
                  border: msg.sender === 'user'
                    ? '1px solid rgba(0,113,227, 0.4)'
                    : '1px solid var(--glass-border)',
                  width: 30, 
                  height: 30, 
                  fontSize: 14,
                  flexShrink: 0,
                  mt: 0.5,
                }}
              >
                {msg.sender === 'user' ? (
                  userSession?.image ? null : <PersonOutlineIcon size={16} />
                ) : (
                  <SmartToyIcon size={16} color="#2997ff" />
                )}
              </Avatar>
              <Box sx={{ mx: 1.25, maxWidth: '78%' }}>
                {/* Product Images - แสดงรูปภาพแบบ Thumbnail กดขยายได้ */}
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
                        onClick={() => {
                          setLightboxImages([product.image]);
                          setLightboxIndex(0);
                          setLightboxImage(product.image);
                        }}
                        sx={{
                          position: 'relative',
                          width: 72,
                          height: 72,
                          borderRadius: 1.5,
                          overflow: 'hidden',
                          border: '1px solid var(--glass-border)',
                          background: 'var(--glass-bg)',
                          flexShrink: 0,
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            transform: 'scale(1.05)',
                            borderColor: 'rgba(0,113,227, 0.5)',
                            boxShadow: '0 4px 12px rgba(0,113,227, 0.25)',
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
                        {/* Zoom icon overlay */}
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
                          <FullscreenIcon size={16} color="white" />
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
                
                {/* Reply Reference - Show what message is being replied to */}
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
                        ? 'rgba(0,113,227, 0.2)'
                        : 'var(--glass-bg)',
                      borderLeft: msg.replyTo.sender === 'user' 
                        ? '2px solid rgba(0,113,227, 0.6)'
                        : '2px solid rgba(165, 180, 252, 0.6)',
                      fontSize: 11,
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      '&:hover': {
                        bgcolor: msg.sender === 'user' 
                          ? 'rgba(0,113,227, 0.3)'
                          : 'var(--glass-bg)',
                      },
                    }}
                    onClick={() => {
                      // Scroll to the original message
                      const el = document.getElementById(msg.replyTo!.id);
                      if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        el.style.transition = 'background 0.3s';
                        el.style.background = 'rgba(0,113,227, 0.3)';
                        setTimeout(() => {
                          el.style.background = '';
                        }, 1500);
                      }
                    }}
                  >
                    <ReplyIcon size={12} style={{ transform: 'scaleX(-1)' }} />
                    <Box sx={{ 
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis', 
                      whiteSpace: 'nowrap',
                      flex: 1,
                    }}>
                      <Box component="span" sx={{ fontWeight: 500, mr: 0.5 }}>
                        {msg.replyTo.sender === 'user' ? t.chatbot.you : t.chatbot.bot}:
                      </Box>
                      {msg.replyTo.text}
                    </Box>
                  </Box>
                )}
                
                {/* Message Bubble */}
                <Box
                  id={msg.id}
                  sx={{
                    background: (theme: any) => msg.sender === 'user' 
                      ? 'rgba(0,113,227, 0.35)'
                      : (theme.palette.mode === 'dark' ? 'var(--glass-bg)' : 'rgba(0,0,0,0.04)'),
                    border: msg.sender === 'user'
                      ? '1px solid rgba(0,113,227, 0.35)'
                      : '1px solid var(--glass-border)',
                    color: 'var(--foreground)',
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
                {/* Message Meta - Time & Source */}
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 0.5,
                  fontSize: 10, 
                  color: 'var(--text-muted)', 
                  mt: 0.5,
                  textAlign: msg.sender === 'user' ? 'right' : 'left',
                  flexDirection: msg.sender === 'user' ? 'row-reverse' : 'row',
                }}>
                  <span>{formatTime(msg.timestamp)}</span>
                  {/* Edited indicator */}
                  {msg.isEdited && (
                    <Box sx={{
                      fontSize: 9,
                      color: 'var(--text-muted)',
                      fontStyle: 'italic',
                    }}>
                      {t.chatbot.edited}
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
                        color: 'var(--success)',
                        cursor: 'help',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.25,
                      }}
                      title={msg.modelUsed ? `Powered by ${msg.modelUsed}` : 'AI'}
                    >
                      <AutoAwesomeIcon size={10} /> {msg.modelUsed ? msg.modelUsed.replace('gemini-', '') : 'AI'}
                    </Box>
                  )}
                  {msg.sender === 'bot' && msg.source === 'faq' && (
                    <Box sx={{
                      fontSize: 9,
                      px: 0.6,
                      py: 0.2,
                      borderRadius: 0.5,
                      bgcolor: 'rgba(0,113,227, 0.2)',
                      color: 'var(--secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.25,
                    }}>
                      <MenuBookOutlinedIcon size={10} /> FAQ
                    </Box>
                  )}
                  {/* Edit Button - Only for user messages */}
                  {msg.sender === 'user' && (
                    <IconButton
                      size="small"
                      onClick={() => handleEditMessage(msg)}
                      sx={{
                        p: 0.25,
                        color: 'var(--text-muted)',
                        '&:hover': { color: 'var(--warning)', bgcolor: 'transparent' },
                      }}
                      title={t.chatbot.editMessage}
                    >
                      <EditIcon size={12} />
                    </IconButton>
                  )}
                  {/* Reply Button */}
                  <IconButton
                    size="small"
                    onClick={() => handleReply(msg)}
                    sx={{
                      p: 0.25,
                      color: 'var(--text-muted)',
                      '&:hover': { color: 'var(--secondary)', bgcolor: 'transparent' },
                    }}
                    title={t.chatbot.reply}
                  >
                    <ReplyIcon size={12} style={{ transform: 'scaleX(-1)' }} />
                  </IconButton>
                  {/* Copy Button */}
                  {msg.sender === 'bot' && (
                    <IconButton
                      size="small"
                      onClick={() => handleCopyMessage(msg.id, msg.text)}
                      sx={{
                        p: 0.25,
                        color: copiedMessageId === msg.id ? '#30d158' : 'var(--text-muted)',
                        '&:hover': { color: 'var(--foreground)', bgcolor: 'transparent' },
                      }}
                      title={t.chatbot.copy}
                    >
                      {copiedMessageId === msg.id ? (
                        <CheckIcon size={12} />
                      ) : (
                        <ContentCopyIcon size={12} />
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
                          background: 'var(--glass-bg)',
                          color: 'var(--secondary)',
                          border: '1px solid var(--glass-border)',
                          fontSize: 11,
                          height: 28,
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          '&:hover': { 
                            background: 'var(--glass-bg)',
                            borderColor: 'var(--glass-border)',
                          },
                        }}
                      />
                    ))}
                  </Box>
                )}

                {/* Related Questions - Glass Style */}
                {msg.sender === 'bot' && msg.relatedQuestions && msg.relatedQuestions.length > 0 && (
                  <Box sx={{ mt: 1.5 }}>
                    <Typography sx={{ fontSize: 10, color: 'var(--text-muted)', mb: 0.75 }}>
                      {t.chatbot.relatedQuestions}
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
                  background: 'var(--glass-bg)',
                  border: '1px solid var(--glass-border)',
                  width: 32, 
                  height: 32,
                }}
              >
                <SmartToyIcon size={18} color="#2997ff" />
              </Avatar>
              <Box
                sx={{
                  background: 'var(--glass-bg)',
                  border: '1px solid var(--glass-border)',
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
                      bgcolor: 'var(--secondary)',
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

        {/* Reply Preview - Above input area */}
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
              bgcolor: 'rgba(0,113,227, 0.15)',
              borderLeft: '3px solid rgba(0,113,227, 0.6)',
            }}
          >
            <ReplyIcon size={14} color="#2997ff" style={{ transform: 'scaleX(-1)' }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ 
                fontSize: 11, 
                color: 'var(--foreground)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                <Box component="span" sx={{ color: 'var(--secondary)', fontWeight: 500, mr: 0.5 }}>
                  {t.chatbot.replyTo} {replyToMessage.sender === 'user' ? t.chatbot.you : t.chatbot.bot}:
                </Box>
                {replyToMessage.text}
              </Typography>
            </Box>
            <IconButton
              size="small"
              onClick={() => setReplyToMessage(null)}
              sx={{ 
                p: 0.25,
                color: 'var(--text-muted)',
                '&:hover': { color: 'var(--foreground)' },
              }}
            >
              <CloseIcon size={14} />
            </IconButton>
          </Box>
        )}

        {/* Edit Preview - Above input area */}
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
            <EditIcon size={14} color="#ffd60a" />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ 
                fontSize: 11, 
                color: 'var(--foreground)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                <Box component="span" sx={{ color: 'var(--warning)', fontWeight: 500, mr: 0.5 }}>
                  {t.chatbot.editMode}
                </Box>
                {editingMessage.text.slice(0, 50) + (editingMessage.text.length > 50 ? '...' : '')}
              </Typography>
            </Box>
            <IconButton
              size="small"
              onClick={cancelEditMode}
              sx={{ 
                p: 0.25,
                color: 'var(--text-muted)',
                '&:hover': { color: 'var(--foreground)' },
              }}
            >
              <CloseIcon size={14} />
            </IconButton>
          </Box>
        )}

        {/* Input Area - Compact */}
        <Box sx={{ 
          px: 1.5,
          pt: (replyToMessage || editingMessage) ? 0.5 : 1,
          pb: 1.25,
          background: 'var(--glass-bg)',
          borderTop: (replyToMessage || editingMessage) ? 'none' : '1px solid var(--glass-border)',
        }}>
          <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'flex-end' }}>
            {/* Hidden file input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageUpload}
              accept="image/png,image/jpeg,image/jpg,image/webp"
              style={{ display: 'none' }}
            />
            
            {/* Upload Image Button */}
            <IconButton
              onClick={() => fileInputRef.current?.click()}
              disabled={loading || isUploading}
              sx={{
                width: 40,
                height: 40,
                borderRadius: 1.5,
                bgcolor: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
                color: 'var(--text-muted)',
                flexShrink: 0,
                transition: 'all 0.2s',
                '&:hover': {
                  bgcolor: 'var(--glass-bg)',
                  color: 'var(--foreground)',
                },
                '&:disabled': {
                  color: 'var(--text-muted)',
                },
              }}
              title={t.chatbot.uploadImage}
            >
              {isUploading ? (
                <CircularProgress size={18} sx={{ color: 'var(--text-muted)' }} />
              ) : (
                <AddPhotoAlternateIcon size={20} />
              )}
            </IconButton>
            
            {/* Input Container with Image Preview inside */}
            <Box
              sx={{
                flex: 1,
                display: 'flex',
                alignItems: 'flex-end',
                gap: 1,
                background: 'var(--glass-bg)',
                borderRadius: 1.5,
                border: '1px solid var(--glass-border)',
                px: 1,
                py: 0.5,
                transition: 'all 0.2s',
                '&:focus-within': {
                  borderColor: 'rgba(0,113,227, 0.5)',
                },
                '&:hover': {
                  borderColor: 'var(--glass-border)',
                },
              }}
            >
              {/* Uploaded Image Preview inside input */}
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
                      border: '1px solid rgba(0,113,227, 0.4)',
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
                    <CloseIcon size={10} />
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
                placeholder={editingMessage ? t.chatbot.editPlaceholder : uploadedImage ? t.chatbot.imagePlaceholder : t.chatbot.defaultPlaceholder}
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
                    color: 'var(--foreground)',
                    fontSize: 14,
                    '& fieldset': { 
                      border: 'none',
                    },
                  },
                  '& .MuiOutlinedInput-input': {
                    py: 0.75,
                    px: 0,
                    '&::placeholder': { color: 'var(--text-muted)', opacity: 1 },
                  },
                }}
              />
            </Box>
            
            {/* Send Button */}
            <Button
              variant="contained"
              onClick={() => uploadedImage ? handleSendWithImage() : handleSend()}
              disabled={loading || (!input.trim() && !uploadedImage)}
              sx={{
                minWidth: 40,
                height: 40,
                borderRadius: 1.5,
                flexShrink: 0,
                bgcolor: uploadedImage ? 'rgba(16, 185, 129, 0.5)' : 'rgba(0,113,227, 0.5)',
                border: uploadedImage ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(0,113,227, 0.35)',
                transition: 'all 0.2s',
                '&:hover': {
                  bgcolor: uploadedImage ? 'rgba(16, 185, 129, 0.65)' : 'rgba(0,113,227, 0.65)',
                },
                '&:disabled': {
                  bgcolor: 'var(--glass-bg)',
                  border: '1px solid var(--glass-border)',
                  color: 'var(--text-muted)',
                },
              }}
            >
              <SendIcon size={18} />
            </Button>
          </Box>
          <Typography sx={{ 
            fontSize: 9, 
            color: 'var(--text-muted)', 
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
                <PersonOutlineIcon size={10} />
                {userSession.name || userSession.email}
                <Box component="span" sx={{ mx: 0.5 }}>•</Box>
              </Box>
            )}
            <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
              <AutoAwesomeIcon size={10} /> Gemini AI
            </Box>
            <Box component="span" sx={{ mx: 0.5 }}>•</Box>
            <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
              <ImageOutlinedIcon size={10} /> {t.chatbot.imageSupported}
            </Box>
          </Typography>
        </Box>
      </Dialog>

      {/* Image Lightbox - Fullscreen Gallery */}
      <Dialog
        open={!!lightboxImage}
        onClose={() => { setLightboxImage(null); setLightboxImages([]); }}
        maxWidth={false}
        fullScreen
        PaperProps={{
          sx: {
            background: 'rgba(0,0,0,0.97)',
            boxShadow: 'none',
          }
        }}
        sx={{
          '& .MuiDialog-container': {
            alignItems: 'center',
            justifyContent: 'center',
          },
        }}
      >
        {/* Close Button */}
        <IconButton
          onClick={() => { setLightboxImage(null); setLightboxImages([]); }}
          sx={{
            position: 'absolute',
            top: { xs: 12, sm: 16 },
            right: { xs: 12, sm: 16 },
            color: 'white',
            bgcolor: 'rgba(255,255,255,0.12)',
            backdropFilter: 'blur(8px)',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
            zIndex: 10,
            width: 44,
            height: 44,
          }}
        >
          <CloseIcon size={24} />
        </IconButton>

        {/* Image Counter */}
        {lightboxImages.length > 1 && (
          <Box sx={{
            position: 'absolute',
            top: { xs: 16, sm: 20 },
            left: '50%',
            transform: 'translateX(-50%)',
            px: 2.5,
            py: 0.75,
            borderRadius: '24px',
            bgcolor: 'rgba(255,255,255,0.12)',
            backdropFilter: 'blur(8px)',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
          }}>
            <Typography sx={{ fontSize: '0.85rem', color: 'white', fontWeight: 600 }}>
              {lightboxIndex + 1} / {lightboxImages.length}
            </Typography>
          </Box>
        )}

        {/* Navigation Arrows */}
        {lightboxImages.length > 1 && (
          <>
            <IconButton
              onClick={() => setLightboxIndex((prev) => (prev - 1 + lightboxImages.length) % lightboxImages.length)}
              sx={{
                position: 'absolute',
                top: '50%',
                left: { xs: 8, sm: 24 },
                transform: 'translateY(-50%)',
                bgcolor: 'rgba(255,255,255,0.12)',
                backdropFilter: 'blur(8px)',
                color: 'white',
                zIndex: 10,
                width: { xs: 40, sm: 48 },
                height: { xs: 40, sm: 48 },
                '&:hover': { bgcolor: 'rgba(255,255,255,0.2)', transform: 'translateY(-50%) scale(1.05)' },
                transition: 'all 0.2s ease',
              }}
            >
              <ChevronLeft size={24} />
            </IconButton>
            <IconButton
              onClick={() => setLightboxIndex((prev) => (prev + 1) % lightboxImages.length)}
              sx={{
                position: 'absolute',
                top: '50%',
                right: { xs: 8, sm: 24 },
                transform: 'translateY(-50%)',
                bgcolor: 'rgba(255,255,255,0.12)',
                backdropFilter: 'blur(8px)',
                color: 'white',
                zIndex: 10,
                width: { xs: 40, sm: 48 },
                height: { xs: 40, sm: 48 },
                '&:hover': { bgcolor: 'rgba(255,255,255,0.2)', transform: 'translateY(-50%) scale(1.05)' },
                transition: 'all 0.2s ease',
              }}
            >
              <ChevronRight size={24} />
            </IconButton>
          </>
        )}

        {/* Main Image */}
        {lightboxImage && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              height: '100%',
              p: { xs: 2, sm: 4 },
            }}
          >
            <Box
              component="img"
              src={lightboxImages.length > 1 ? lightboxImages[lightboxIndex] : lightboxImage}
              alt="Full size"
              sx={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                borderRadius: '8px',
                userSelect: 'none',
              }}
            />
          </Box>
        )}

        {/* Thumbnail strip */}
        {lightboxImages.length > 1 && (
          <Box sx={{
            position: 'absolute',
            bottom: { xs: 16, sm: 24 },
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: 1,
            px: 2,
            py: 1,
            borderRadius: '16px',
            bgcolor: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(12px)',
            maxWidth: '90vw',
            overflowX: 'auto',
          }}>
            {lightboxImages.map((img, idx) => (
              <Box
                key={idx}
                onClick={() => setLightboxIndex(idx)}
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: '10px',
                  border: lightboxIndex === idx ? '2px solid white' : '2px solid transparent',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  opacity: lightboxIndex === idx ? 1 : 0.5,
                  transition: 'all 0.2s ease',
                  flexShrink: 0,
                  '&:hover': { opacity: 1 },
                }}
              >
                <Box
                  component="img"
                  src={img}
                  alt={`Thumbnail ${idx + 1}`}
                  sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              </Box>
            ))}
          </Box>
        )}
      </Dialog>
    </>
  );
}
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSession, signIn, signOut } from 'next-auth/react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Alert,
  AppBar,
  Avatar,
  Backdrop,
  Badge,
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  IconButton,
  InputAdornment,
  LinearProgress,
  Slider,
  Paper,
  Skeleton,
  Snackbar,
  Slide,
  TextField,
  Toolbar,
  FormControlLabel,
  Switch,
  Typography,
  Popover,
} from '@mui/material';
import useMediaQuery from '@mui/material/useMediaQuery';
import Grid from '@mui/material/Grid';
import {
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Info,
  ChevronLeft,
  ChevronRight,
  Copy,
  Expand,
  History,
  Home,
  LogIn,
  LogOut,
  Menu,
  Megaphone,
  Minus,
  Package,
  Plus,
  Ruler,
  ShoppingCart,
  Store,
  Tag,
  User,
  X,
  Zap,
  Search,
  Edit,
  Check,
  MapPin,
  Clock,
  CheckCircle,
  XCircle,
  ArrowLeftRight,
  TriangleAlert,
  Headphones,
  Bot,
  HandMetal,
  Share2,
  Link2,
  Percent,
  Ticket,
  Heart,
  ArrowUpDown,
  SlidersHorizontal,
  Star,
  ThumbsUp,
  Filter,
  Download,
  FileText,
  Users,
  Bell,
  BellOff,
  Eye,
  BarChart3,
  TrendingUp,
  Radio,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { useNotification } from '@/components/NotificationContext';
import AnnouncementBar from '@/components/AnnouncementBar';
import EventBanner, { type ShopEvent } from '@/components/EventBanner';
import Footer from '@/components/Footer';
import TurnstileWidget from '@/components/TurnstileWidget';
import { ShopStatusBanner, getProductStatus, getShopStatus, SHOP_STATUS_CONFIG, type ShopStatusType } from '@/components/ShopStatusCard';
import type { SavedAddress } from '@/components/ProfileModal';

// ==================== DYNAMIC IMPORTS (Code Splitting) ====================
// Heavy components loaded on-demand to reduce initial bundle size
const PaymentFlow = dynamic(() => import('@/components/PaymentFlow'), { ssr: false });
const ProfileModal = dynamic(() => import('@/components/ProfileModal'), { ssr: false });
const CartDrawer = dynamic(() => import('@/components/CartDrawer'), { ssr: false });
const OrderHistoryDrawer = dynamic(() => import('@/components/OrderHistoryDrawer'), { ssr: false });
const CheckoutDialog = dynamic(() => import('@/components/CheckoutDialog'), { ssr: false });
const SupportChatWidget = dynamic(() => import('@/components/SupportChatWidget'), { ssr: false });
const PasskeyLoginButton = dynamic(() => import('@/components/PasskeyLoginButton'), { ssr: false });

// Common tag translations for well-known tags
const TAG_TRANSLATIONS_TH_TO_EN: Record<string, string> = {
  'ขายดี': 'Best Seller',
  'สินค้าใหม่': 'New',
  'แนะนำ': 'Recommended',
  'ลดราคา': 'On Sale',
  'หมดแล้ว': 'Sold Out',
  'พรีออเดอร์': 'Pre-order',
  'จำนวนจำกัด': 'Limited Edition',
  'สั่งผลิต': 'Made to Order',
  'สินค้าพิเศษ': 'Special',
  'ของใหม่': 'New Arrival',
};
import OptimizedImage, { preloadImages, OptimizedBackground } from '@/components/OptimizedImage';
import LoadingScreen from '@/components/LoadingScreen';
import ThemeToggle from '@/components/ThemeToggle';
import LanguageToggle from '@/components/LanguageToggle';
import { 
  Product, 
  ShopConfig, 
  SIZES, 
  CATEGORY_LABELS as CONFIG_CATEGORY_LABELS, 
  CATEGORY_ICONS as CONFIG_CATEGORY_ICONS,
  getCategoryLabel,
  getSubTypeLabel,
  getCategoryIcon,
  getProductName,
  getProductDescription,
  DEFAULT_SHIRT_NAME,
  type ShirtNameConfig,
} from '@/lib/config';
import { ShippingConfig } from '@/lib/shipping';
import { useRealtimeOrdersByEmail } from '@/hooks/useRealtimeOrders';
import {
  cancelOrder,
  getCart,
  getHistory,
  getProfile,
  getPublicConfig,
  saveCart as saveCartApi,
  saveProfile as saveProfileApi,
  submitOrder as submitOrderApi,
} from '@/lib/api-client';
import { useThemeStore, ThemeMode } from '@/store/themeStore';
import { useWishlistStore } from '@/store/wishlistStore';
import { useRecentlyViewedStore } from '@/store/recentlyViewedStore';
import { useTranslation } from '@/hooks/useTranslation';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'รอดำเนินการ',
  PAID: 'ซื้อสำเร็จ',
  READY: 'พร้อมรับสินค้า',
  SHIPPED: 'จัดส่งแล้ว',
  COMPLETED: 'สำเร็จ',
  CANCELLED: 'ยกเลิก',
  WAITING_PAYMENT: 'รอชำระเงิน',
  AWAITING_PAYMENT: 'รอชำระเงิน',
  UNPAID: 'ยังไม่ชำระ',
  DRAFT: 'ยังไม่ชำระ',
  VERIFYING: 'รอตรวจสลิป',
  WAITING_SLIP: 'รอตรวจสลิป',
  REJECTED: 'สลิปไม่ผ่าน',
  FAILED: 'สลิปไม่ผ่าน',
  REFUNDED: 'คืนเงินแล้ว',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#ff9f0a',
  PAID: '#34c759',
  READY: '#34c759',
  SHIPPED: '#2997ff',
  COMPLETED: '#30d158',
  CANCELLED: '#ff453a',
  WAITING_PAYMENT: '#ff9f0a',
  AWAITING_PAYMENT: '#ff9f0a',
  UNPAID: '#ff9f0a',
  DRAFT: '#ff9f0a',
  VERIFYING: '#64d2ff',
  WAITING_SLIP: '#64d2ff',
  REJECTED: '#ff453a',
  FAILED: '#ff453a',
  REFUNDED: '#0077ED',
};

const PAYABLE_STATUSES = ['PENDING', 'WAITING_PAYMENT', 'AWAITING_PAYMENT', 'UNPAID', 'DRAFT'];
const CANCELABLE_STATUSES = ['PENDING', 'WAITING_PAYMENT', 'AWAITING_PAYMENT', 'UNPAID', 'DRAFT'];
const getStatusCategory = (status: string): 'WAITING_PAYMENT' | 'COMPLETED' | 'RECEIVED' | 'CANCELLED' | 'OTHER' => {
  const key = normalizeStatus(status);
  if (['WAITING_PAYMENT', 'AWAITING_PAYMENT', 'UNPAID', 'DRAFT', 'PENDING'].includes(key)) return 'WAITING_PAYMENT';
  if (['PAID', 'VERIFYING', 'WAITING_SLIP'].includes(key)) return 'COMPLETED';
  if (['READY', 'SHIPPED', 'COMPLETED'].includes(key)) return 'RECEIVED';
  if (['CANCELLED', 'REFUNDED', 'REJECTED', 'FAILED'].includes(key)) return 'CANCELLED';
  return 'OTHER';
};

const TYPE_LABELS: Record<string, string> = {
  // Legacy types
  CREW: 'เสื้อ Crew',
  HOODIE: 'ฮู้ดดี้',
  SHIRT: 'เสื้อเชิ้ต',
  TSHIRT: 'เสื้อยืด',
  POLO: 'เสื้อโปโล',
  JACKET: 'แจ็กเก็ต',
  CAP: 'หมวก',
  ACCESSORY: 'ของที่ระลึก',
  OTHER: 'อื่นๆ',
  // New types
  JERSEY: 'เสื้อกีฬา',
  STICKER: 'สติกเกอร์',
  KEYCHAIN: 'พวงกุญแจ',
  MUG: 'แก้ว',
  BADGE: 'เข็มกลัด/ตรา',
  POSTER: 'โปสเตอร์',
  NOTEBOOK: 'สมุด',
  CAMP_REGISTRATION: 'ค่าสมัครค่าย',
  EVENT_TICKET: 'ตั๋วเข้างาน',
  CUSTOM: 'กำหนดเอง',
};

// Category labels for new category system - use from config, extend with fallback
const CATEGORY_LABELS: Record<string, string> = {
  ...CONFIG_CATEGORY_LABELS,
};

// Category icons - use from config, extend with fallback
const CATEGORY_ICONS: Record<string, string> = {
  ...CONFIG_CATEGORY_ICONS,
};

// Helper: Get category from legacy type
const getCategoryFromType = (type: string): string => {
  switch (type) {
    case 'JERSEY':
    case 'CREW':
    case 'HOODIE':
    case 'TSHIRT':
    case 'POLO':
    case 'JACKET':
    case 'CAP':
      return 'APPAREL';
    case 'STICKER':
    case 'KEYCHAIN':
    case 'MUG':
    case 'BADGE':
    case 'POSTER':
    case 'NOTEBOOK':
    case 'ACCESSORY':
      return 'MERCHANDISE';
    case 'CAMP_REGISTRATION':
      return 'CAMP_FEE';
    case 'EVENT_TICKET':
      return 'EVENT';
    default:
      return 'OTHER';
  }
};

// Helper: Check if product requires size selection
const productRequiresSize = (product: Product): boolean => {
  if (product.options?.requiresSize === false) return false;
  const category = (product as any).category || getCategoryFromType(product.type);
  return category === 'APPAREL';
};

const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL', '7XL', '8XL', '9XL', '10XL'] as const;
const SIZE_MEASUREMENTS: Record<(typeof SIZE_ORDER)[number], { chest: number; length: number }> = {
  XS: { chest: 34, length: 24 },
  S: { chest: 36, length: 25 },
  M: { chest: 38, length: 26 },
  L: { chest: 40, length: 27 },
  XL: { chest: 42, length: 28 },
  '2XL': { chest: 44, length: 29 },
  '3XL': { chest: 46, length: 30 },
  '4XL': { chest: 48, length: 31 },
  '5XL': { chest: 50, length: 32 },
  '6XL': { chest: 52, length: 33 },
  '7XL': { chest: 54, length: 34 },
  '8XL': { chest: 56, length: 35 },
  '9XL': { chest: 58, length: 36 },
  '10XL': { chest: 60, length: 37 },
};

const ANNOUNCEMENT_COLOR_MAP: Record<string, string> = {
  blue: '#0071e3',
  red: '#ff453a',
  green: '#30d158',
  emerald: '#34c759',
  orange: '#ff9f0a',
};

// Shop status helpers imported from ShopStatusCard component

// Helper to get announcement color (supports both named colors and hex)
const getAnnouncementColor = (color: string | undefined): string => {
  if (!color) return '#0071e3';
  // If it's a hex color, return it directly
  if (color.startsWith('#')) return color;
  // Otherwise, look up in the map
  return ANNOUNCEMENT_COLOR_MAP[color] || '#0071e3';
};

const CONFIG_CACHE_KEY = 'shopConfigCache';
const CONFIG_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

type ToastSeverity = 'success' | 'error' | 'warning' | 'info';

type Toast = {
  id: string;
  type: ToastSeverity;
  message: string;
};

type ProductOptions = {
  size: string;
  quantity: number;
  customName: string;
  customNumber: string;
  isLongSleeve: boolean;
};

type CartItem = {
  id: string;
  productId: string;
  productName: string;
  size: string;
  quantity: number;
  unitPrice: number;
  options: {
    customName?: string;
    customNumber?: string;
    isLongSleeve?: boolean;
    variantId?: string;
    variantName?: string;
  };
};

type OrderHistoryItem = {
  productId?: string;
  name?: string;
  productName?: string;
  size?: string;
  qty?: number;
  quantity?: number;
  customName?: string;
  customNumber?: string;
  isLongSleeve?: boolean;
  unitPrice?: number;
  subtotal?: number;
  options?: {
    customName?: string;
    isLongSleeve?: boolean;
    customNumber?: string;
  };
};

type OrderHistory = {
  ref: string;
  status: string;
  date: string;
  total?: number;
  items?: OrderHistoryItem[];
  cart?: OrderHistoryItem[]; // For backwards compatibility
  // Shipping info for proper QR code display
  shippingFee?: number;
  shippingOption?: string;
  trackingNumber?: string;
  shippingProvider?: string;
};

type Interval = ReturnType<typeof setInterval>;

type LeanProduct = Pick<Product, 'id' | 'name' | 'description' | 'type' | 'images' | 'basePrice' | 'sizePricing' | 'isActive' | 'startDate' | 'endDate'>;
type LeanConfig = {
  isOpen: boolean;
  closeDate?: string;
  openDate?: string;
  announcements: ShopConfig['announcements'];
  announcementHistory?: ShopConfig['announcementHistory'];
  products: LeanProduct[];
};

const clampQty = (value: number) => Math.min(99, Math.max(1, value));
const normalizeStatus = (status: string) => (status || '').trim().toUpperCase();

// Check if product is currently open based on startDate/endDate
const isProductCurrentlyOpen = (product: { isActive?: boolean; startDate?: string; endDate?: string }): boolean => {
  if (!product.isActive) return false;
  const now = new Date();
  const start = product.startDate ? new Date(product.startDate) : null;
  const end = product.endDate ? new Date(product.endDate) : null;
  // Not yet started
  if (start && now < start) return false;
  // Already ended
  if (end && now > end) return false;
  return true;
};
const normalizeEngName = (value: string) => value.replace(/[^\x20-\x7E]/g, '').toUpperCase().slice(0, 7).trim();

/** Normalize shirt custom name based on ShirtNameConfig */
const normalizeShirtName = (value: string, cfg: ShirtNameConfig = DEFAULT_SHIRT_NAME): string => {
  // Build allowed character pattern
  let pattern = '';
  if (cfg.allowEnglish) pattern += 'a-zA-Z';
  if (cfg.allowThai) pattern += '\u0E00-\u0E7F';
  if (cfg.allowSpecialChars && cfg.allowedSpecialChars) {
    pattern += cfg.allowedSpecialChars.replace(/[\\\]\^\-]/g, '\\$&');
  }
  pattern += '\\s';
  const regex = new RegExp(`[^${pattern}]`, 'g');
  let result = value.replace(regex, '');
  if (cfg.autoUppercase) result = result.toUpperCase();
  return result.slice(0, cfg.maxLength).trim();
};
const normalizeDigits99 = (value: string) => {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  return String(Math.min(99, Number(digits)));
};
const isThaiText = (value: string) => /^[\u0E00-\u0E7F\s]+$/.test(value.trim());
const onlyDigitsPhone = (value: string) => value.replace(/\D/g, '').slice(0, 12);
const getBasePrice = (p: Product) => {
  const prices = Object.values(p.sizePricing || {});
  if (prices.length === 0) return p.basePrice;
  return Math.min(...prices);
};

/** คำนวณราคาส่วนลดจากอีเวนต์ที่กำลังดำเนินอยู่ */
function getEventDiscount(productId: string, events: ShopEvent[] | undefined): { discountedPrice: (original: number) => number; discountLabel: string; eventTitle: string; discountType?: 'percent' | 'fixed'; discountValue?: number } | null {
  if (!events?.length) return null;
  const now = new Date();
  const active = events.find(e => 
    e.enabled && 
    e.linkedProducts?.includes(productId) &&
    e.discountType && e.discountValue && e.discountValue > 0 &&
    (!e.startDate || new Date(e.startDate) <= now) &&
    (!e.endDate || new Date(e.endDate) > now)
  );
  if (!active) return null;
  return {
    discountedPrice: (original: number) => {
      if (active.discountType === 'percent') return Math.round(original * (1 - active.discountValue! / 100));
      return Math.max(0, original - active.discountValue!);
    },
    discountLabel: active.discountType === 'percent' ? `-${active.discountValue}%` : `-฿${active.discountValue}`,
    eventTitle: active.title,
    discountType: active.discountType,
    discountValue: active.discountValue,
  };
}

/** สร้าง slug จากชื่อสินค้า */
function generateSlug(name: string, id: string): string {
  return name.replace(/[^\u0E00-\u0E7Fa-zA-Z0-9\s-]/g, '').replace(/\s+/g, '-').toLowerCase() || id;
}

/** สร้าง product link (short format) */
function getProductLink(product: Product): string {
  return `${typeof window !== 'undefined' ? window.location.origin : ''}/?p=${encodeURIComponent(product.id)}`;
}

export default function HomePage() {
  const { data: session, status } = useSession();
  const isMobile = useMediaQuery('(max-width:600px)');

  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  
  // Available OAuth providers
  const [availableProviders, setAvailableProviders] = useState<string[]>(['google']);
  
  // Chatbot dialog state
  const [chatbotOpen, setChatbotOpen] = useState(false);
  // Support chat & chat menu state
  const [supportChatOpen, setSupportChatOpen] = useState(false);
  const [chatMenuAnchor, setChatMenuAnchor] = useState<HTMLElement | null>(null);

  // Logout confirmation
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [switchAccountOpen, setSwitchAccountOpen] = useState(false);

  const [config, setConfig] = useState<ShopConfig | null>(null);
  const [shippingConfig, setShippingConfig] = useState<ShippingConfig | null>(null);
  
  // ==================== DEV MODE TEST PRODUCTS ====================
  const isDev = process.env.NODE_ENV === 'development';
  const devTestProducts: Product[] = isDev ? [
    // เสื้อผ้า - APPAREL
    {
      id: 'dev-jersey-1',
      name: '[DEV] เสื้อกีฬา SCC 2026',
      nameEn: '[DEV] SCC Jersey 2026',
      description: 'เสื้อกีฬารุ่นใหม่ล่าสุด\nเนื้อผ้า Cool Elite\nระบายอากาศดี',
      descriptionEn: 'Latest jersey model\nCool Elite fabric\nGreat breathability',
      category: 'APPAREL',
      subType: 'JERSEY',
      type: 'JERSEY',
      basePrice: 350,
      sizePricing: { 'S': 350, 'M': 350, 'L': 350, 'XL': 370, '2XL': 390 },
      isActive: true,
      options: { hasCustomName: true, hasCustomNumber: true, hasLongSleeve: true, longSleevePrice: 50 },
      images: ['https://placehold.co/400x400/6366f1/white?text=Jersey+SCC'],
      coverImage: 'https://placehold.co/400x400/6366f1/white?text=Jersey+SCC',
    },
    {
      id: 'dev-crew-1',
      name: '[DEV] เสื้อ Crew Neck รุ่น Classic',
      nameEn: '[DEV] Crew Neck Classic',
      description: 'เสื้อ Crew Neck สไตล์คลาสสิค',
      descriptionEn: 'Classic style Crew Neck',
      category: 'APPAREL',
      subType: 'CREW',
      type: 'CREW',
      basePrice: 299,
      sizePricing: { 'S': 299, 'M': 299, 'L': 299, 'XL': 319 },
      isActive: true,
      options: { hasCustomName: true, hasCustomNumber: false, hasLongSleeve: false },
      images: ['https://placehold.co/400x400/10b981/white?text=Crew+Neck'],
    },
    // ของที่ระลึก - MERCHANDISE (with variants)
    {
      id: 'dev-merch-1',
      name: '[DEV] แก้วน้ำ SCC Limited',
      nameEn: '[DEV] SCC Limited Tumbler',
      description: 'แก้วน้ำเก็บความเย็น 24 ชม.\nขนาด 600ml',
      descriptionEn: 'Insulated tumbler, keeps cold 24 hrs\n600ml capacity',
      category: 'MERCHANDISE',
      subType: 'MUG',
      type: 'OTHER',
      basePrice: 250,
      isActive: true,
      variants: [
        { id: 'var-black', name: 'สีดำ', price: 250, stock: 50, isActive: true },
        { id: 'var-white', name: 'สีขาว', price: 250, stock: 30, isActive: true },
        { id: 'var-blue', name: 'สีน้ำเงิน', price: 280, stock: 20, isActive: true },
        { id: 'var-gold', name: 'สีทอง (Limited)', price: 350, stock: 5, isActive: true },
      ],
      images: ['https://placehold.co/400x400/f59e0b/white?text=Mug+Limited'],
    },
    {
      id: 'dev-merch-2',
      name: '[DEV] พวงกุญแจ SCC',
      nameEn: '[DEV] SCC Keychain',
      description: 'พวงกุญแจโลหะ พร้อมสายคล้อง',
      descriptionEn: 'Metal keychain with lanyard',
      category: 'MERCHANDISE',
      subType: 'KEYCHAIN',
      type: 'OTHER',
      basePrice: 79,
      isActive: true,
      variants: [
        { id: 'var-silver', name: 'สีเงิน', price: 79, stock: 100, isActive: true },
        { id: 'var-rose-gold', name: 'สี Rose Gold', price: 99, stock: 50, isActive: true },
      ],
      images: ['https://placehold.co/400x400/ec4899/white?text=Keychain'],
    },
    {
      id: 'dev-merch-3',
      name: '[DEV] สติกเกอร์ SCC Set',
      nameEn: '[DEV] SCC Sticker Set',
      description: 'เซ็ตสติกเกอร์ 10 ชิ้น\nกันน้ำ กันแดด',
      descriptionEn: '10-piece sticker set\nWaterproof & UV resistant',
      category: 'MERCHANDISE',
      subType: 'STICKER',
      type: 'OTHER',
      basePrice: 50,
      isActive: true,
      images: ['https://placehold.co/400x400/8b5cf6/white?text=Sticker+Set'],
    },
    // ค่าสมัครค่าย - CAMP_FEE
    {
      id: 'dev-camp-1',
      name: '[DEV] ค่ายอาสา SCC รุ่น 15',
      nameEn: '[DEV] SCC Volunteer Camp #15',
      description: 'ค่ายอาสาพัฒนาชุมชน\nรวมอาหาร ที่พัก และเสื้อค่าย',
      descriptionEn: 'Community volunteer camp\nIncludes meals, lodging & camp shirt',
      category: 'CAMP_FEE',
      subType: 'CAMP_REGISTRATION',
      type: 'OTHER',
      basePrice: 1500,
      isActive: true,
      campInfo: {
        campName: 'ค่ายอาสา SCC รุ่น 15',
        campDate: '2026-03-15',
        location: 'โรงเรียนบ้านห้วยน้ำใส จ.พังงา',
        organizer: 'ชมรม SCC',
        maxParticipants: 50,
        currentParticipants: 32,
        requirements: 'นิสิตชั้นปี 1-4',
      },
      variants: [
        { id: 'var-full', name: 'สมาชิกเต็มรูปแบบ', price: 1500, stock: 18, isActive: true },
        { id: 'var-day', name: 'สมาชิกรายวัน', price: 500, stock: 10, isActive: true },
        { id: 'var-staff', name: 'ทีมงาน (ไม่มีค่าใช้จ่าย)', price: 0, stock: 5, isActive: true },
      ],
      images: ['https://placehold.co/400x400/22c55e/white?text=Camp+15'],
    },
    // กิจกรรม - EVENT
    {
      id: 'dev-event-1',
      name: '[DEV] บัตรงาน SCC Night',
      nameEn: '[DEV] SCC Night Ticket',
      description: 'งานเลี้ยงสังสรรค์ประจำปี\nรวมอาหารและเครื่องดื่ม',
      descriptionEn: 'Annual party\nIncludes food and drinks',
      category: 'EVENT',
      subType: 'EVENT_TICKET',
      type: 'OTHER',
      basePrice: 200,
      isActive: true,
      eventInfo: {
        eventName: 'SCC Night 2026',
        eventDate: '2026-04-20T18:00',
        venue: 'หอประชุมใหญ่ มหาวิทยาลัย',
        organizer: 'สโมสรนิสิต SCC',
      },
      variants: [
        { id: 'var-standard', name: 'บัตรทั่วไป', price: 200, stock: 100, isActive: true },
        { id: 'var-vip', name: 'บัตร VIP (โต๊ะหน้า)', price: 500, stock: 20, isActive: true },
        { id: 'var-couple', name: 'บัตรคู่ (2 ที่นั่ง)', price: 350, stock: 30, isActive: true },
      ],
      images: ['https://placehold.co/400x400/ef4444/white?text=SCC+Night'],
    },
    // หมวดหมู่กำหนดเอง - Custom Category
    {
      id: 'dev-custom-1',
      name: '[DEV] อุปกรณ์กีฬา SCC',
      nameEn: '[DEV] SCC Sports Equipment',
      description: 'ลูกฟุตบอล มาตรฐาน FIFA',
      descriptionEn: 'FIFA standard football',
      category: 'อุปกรณ์กีฬา', // Custom category
      subType: 'ลูกฟุตบอล', // Custom subType
      type: 'OTHER',
      basePrice: 890,
      isActive: true,
      variants: [
        { id: 'var-size5', name: 'ขนาด 5 (มาตรฐาน)', price: 890, stock: 15, isActive: true },
        { id: 'var-size4', name: 'ขนาด 4 (เยาวชน)', price: 690, stock: 10, isActive: true },
      ],
      images: ['https://placehold.co/400x400/3b82f6/white?text=Football'],
    },
    {
      id: 'dev-custom-2',
      name: '[DEV] กระเป๋า SCC Bag',
      nameEn: '[DEV] SCC Bag',
      description: 'กระเป๋าสะพายข้าง\nกันน้ำ ทนทาน',
      descriptionEn: 'Crossbody bag\nWaterproof & durable',
      category: 'กระเป๋า', // Custom category
      subType: 'กระเป๋าสะพายข้าง', // Custom subType
      type: 'OTHER',
      basePrice: 450,
      isActive: true,
      variants: [
        { id: 'var-small', name: 'ขนาดเล็ก', price: 350, stock: 25, isActive: true },
        { id: 'var-medium', name: 'ขนาดกลาง', price: 450, stock: 20, isActive: true },
        { id: 'var-large', name: 'ขนาดใหญ่', price: 550, stock: 15, isActive: true },
      ],
      images: ['https://placehold.co/400x400/06b6d4/white?text=SCC+Bag'],
    },
  ] : [];
  // ==================== END DEV TEST PRODUCTS ====================
  
  const [announcements, setAnnouncements] = useState<ShopConfig['announcements']>([]);
  const [announcementHistory, setAnnouncementHistory] = useState<ShopConfig['announcementHistory']>([]);
  const [showAnnouncementHistory, setShowAnnouncementHistory] = useState(false);
  const [showAnnouncementPopup, setShowAnnouncementPopup] = useState(true); // For floating popup
  const [currentAnnouncementIndex, setCurrentAnnouncementIndex] = useState(0); // For cycling announcements
  const [showAnnouncementImage, setShowAnnouncementImage] = useState(false); // For image lightbox
  const [isShopOpen, setIsShopOpen] = useState(true);
  const configFetchInFlight = useRef(false);
  const configPollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [navHandedness, setNavHandedness] = useState<'right' | 'left'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('scc_nav_hand') as 'right' | 'left') || 'right';
    }
    return 'right';
  });
  const toggleNavHandedness = useCallback(() => {
    setNavHandedness(prev => {
      const next = prev === 'right' ? 'left' : 'right';
      localStorage.setItem('scc_nav_hand', next);
      return next;
    });
  }, []);
  const [showCart, setShowCart] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [showOrderDialog, setShowOrderDialog] = useState(false);
  const [showQRFullscreen, setShowQRFullscreen] = useState<string | null>(null); // Store order ref for fullscreen QR
  const paymentOpenerRef = useRef<((ref: string) => void) | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'home' | 'cart' | 'history' | 'profile'>('home');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [productSearch, setProductSearch] = useState('');
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 0]);
  const [sortBy, setSortBy] = useState<'default' | 'price-low' | 'price-high' | 'newest' | 'name'>('default');
  const [showOnlyAvailable, setShowOnlyAvailable] = useState(false);
  const [showWishlistDrawer, setShowWishlistDrawer] = useState(false);
  const [showRecentlyViewed, setShowRecentlyViewed] = useState(false);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [productReviews, setProductReviews] = useState<Record<string, Array<{ id: string; userName: string; userImage?: string; rating: number; comment: string; date: string; verified: boolean; helpful: number }>>>({});
  const [editingCartItem, setEditingCartItem] = useState<CartItem | null>(null);
  const [bulkOrderOpen, setBulkOrderOpen] = useState(false);
  const [bulkStep, setBulkStep] = useState(0); // 0=sizes, 1=names, 2=preview
  const [bulkSizes, setBulkSizes] = useState<Record<string, number>>({}); // size -> qty
  const [bulkNames, setBulkNames] = useState('');
  const [bulkLongSleeve, setBulkLongSleeve] = useState(false);
  const [bulkAssignments, setBulkAssignments] = useState<Array<{ name: string; size: string }>>([]); // name->size

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [productOptions, setProductOptions] = useState<ProductOptions>({
    size: '',
    quantity: 1,
    customName: '',
    customNumber: '',
    isLongSleeve: false,
  });
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const sizeSelectorRef = useRef<HTMLDivElement>(null);
  const customNameInputRef = useRef<HTMLInputElement>(null);
  const customNumberInputRef = useRef<HTMLInputElement>(null);

  const [cart, setCart] = useState<CartItem[]>([]);
  const cartRef = useRef<CartItem[]>([]);
  const productHoldTimer = useRef<Interval | null>(null);
  const cartHoldTimers = useRef<Record<string, Interval | null>>({});

  const [orderData, setOrderData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    instagram: '',
    profileImage: '',
  });
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [orderHistory, setOrderHistory] = useState<OrderHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingHistoryMore, setLoadingHistoryMore] = useState(false);
  const [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<'ALL' | 'WAITING_PAYMENT' | 'COMPLETED' | 'SHIPPED' | 'RECEIVED' | 'CANCELLED'>('ALL');
  const [cancellingRef, setCancellingRef] = useState<string | null>(null);
  const [confirmCancelRef, setConfirmCancelRef] = useState<string | null>(null);
  const [showSizeChart, setShowSizeChart] = useState(false);

  const openPaymentFlow = useCallback(
    (ref: string) => {
      setShowHistoryDialog(false);
      setShowProfileModal(false);
      setShowCart(false);
      setShowOrderDialog(false);
      paymentOpenerRef.current?.(ref);
    },
    []
  );
  const [savingProfile, setSavingProfile] = useState(false);
  const [pendingCheckout, setPendingCheckout] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string>('');

  // Theme sync with DB
  const themeMode = useThemeStore((s) => s.mode);
  const prevThemeModeRef = useRef<ThemeMode | null>(null);

  // Wishlist & Recently Viewed
  const wishlistStore = useWishlistStore();
  const recentlyViewedStore = useRecentlyViewedStore();

  const { t, lang } = useTranslation();
  const STATUS_LABELS_I18N: Record<string, string> = t.status as unknown as Record<string, string>;
  const TYPE_LABELS_I18N: Record<string, string> = t.type as unknown as Record<string, string>;

  const [navHidden, setNavHidden] = useState(false);
  const lastScrollYRef = useRef(0);
  const scrollIdleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showRefreshDroplet, setShowRefreshDroplet] = useState(false);
  const hideNavBars = navHidden || productDialogOpen;

  const [toasts, setToasts] = useState<Toast[]>([]);
  const [inlineNotice, setInlineNotice] = useState<Toast | null>(null);
  const toastTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const ToastTransition = (props: any) => <Slide {...props} direction="down" />;

  // Live stream status for navbar indicator
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [liveTitle, setLiveTitle] = useState('');

  useEffect(() => {
    let mounted = true;
    const checkLive = async () => {
      try {
        const res = await fetch('/api/live', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (mounted) {
          setIsLiveActive(!!data.live?.enabled);
          setLiveTitle(data.live?.title || '');
        }
      } catch { /* ignore */ }
    };
    checkLive();
    const iv = setInterval(checkLive, 30000);
    return () => { mounted = false; clearInterval(iv); };
  }, []);

  const openLiveStream = useCallback(() => {
    window.dispatchEvent(new CustomEvent('open-live-stream'));
  }, []);

  const bottomTabs = useMemo(() => {
    const leftTabs = [
      { key: 'home', label: t.nav.home, icon: <Home size={24} />, center: false },
      {
        key: 'cart',
        label: t.nav.cart,
        icon: (
          <Badge badgeContent={cart.length} color="error">
            <ShoppingCart size={24} />
          </Badge>
        ),
        center: false,
      },
    ];
    const centerTab = { key: 'chat', label: t.nav.chat, icon: <Headphones size={28} />, center: true };
    const rightTabs = [
      { key: 'history', label: t.nav.history, icon: <History size={24} />, center: false },
      { key: 'profile', label: t.nav.profile, icon: <User size={24} />, center: false },
    ];
    // For left-handed: swap sides so primary actions are on the left
    if (navHandedness === 'left') {
      return [...rightTabs.reverse(), centerTab, ...leftTabs.reverse()];
    }
    return [...leftTabs, centerTab, ...rightTabs];
  }, [cart.length, navHandedness, t, lang]);


  const BrandMark = ({ size = 36, showText = true }: { size?: number; showText?: boolean }) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Box
        sx={{
          width: size,
          height: size,
          position: 'relative',
          borderRadius: '12px',
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        <Image
          src="/logo.png"
          alt="PSU SCC Shop Logo"
          fill
          sizes="48px"
          className="theme-logo"
          style={{ objectFit: 'contain' }}
          priority
        />
      </Box>
      {showText && (
        <Typography
          variant="h6"
          sx={{
            fontWeight: 800,
            letterSpacing: 0.5,
            color: 'var(--foreground)',
            textTransform: 'uppercase',
            fontSize: { xs: '1rem', sm: '1.25rem' },
          }}
        >
          SCC Shop
        </Typography>
      )}
    </Box>
  );

  // ==================== SHOP STATUS CARD COMPONENT ====================
  useEffect(() => setMounted(true), []);

  // Fetch available OAuth providers
  useEffect(() => {
    fetch('/api/auth/available-providers')
      .then(res => res.json())
      .then(data => { if (data.providers) setAvailableProviders(data.providers); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let rafId: number | null = null;
    const onScroll = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const currentY = window.scrollY;
        const delta = Math.abs(currentY - lastScrollYRef.current);
        lastScrollYRef.current = currentY;
        if (delta < 2) return;
        setNavHidden(true);
        if (scrollIdleTimer.current) clearTimeout(scrollIdleTimer.current);
        scrollIdleTimer.current = setTimeout(() => setNavHidden(false), 220);
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafId) cancelAnimationFrame(rafId);
      if (scrollIdleTimer.current) clearTimeout(scrollIdleTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!showRefreshDroplet) return undefined;
    const timer = setTimeout(() => setShowRefreshDroplet(false), 1500);
    return () => clearTimeout(timer);
  }, [showRefreshDroplet]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const triggerDroplet = () => setShowRefreshDroplet(true);

    window.addEventListener('beforeunload', triggerDroplet);
    window.addEventListener('pagehide', triggerDroplet);

    return () => {
      window.removeEventListener('beforeunload', triggerDroplet);
      window.removeEventListener('pagehide', triggerDroplet);
    };
  }, []);

  useEffect(() => () => {
    if (productHoldTimer.current) clearInterval(productHoldTimer.current);
    Object.values(cartHoldTimers.current).forEach((t) => t && clearInterval(t));
  }, []);

  const refreshConfig = useCallback(async () => {
    if (configFetchInFlight.current) return;
    configFetchInFlight.current = true;
    try {
      const res = await getPublicConfig();
      if (res.status === 'success') {
        const cfg = (res.data as ShopConfig | undefined) ?? (res.config as ShopConfig | undefined);
        if (cfg) {
          const lean = sanitizeConfig(cfg);
          cacheConfig(lean);
          // Only update state if data actually changed to prevent flickering
          setConfig(prev => {
            if (!prev) return cfg;
            // Simple comparison of key fields
            const changed = prev.isOpen !== cfg.isOpen || 
              JSON.stringify(prev.products) !== JSON.stringify(cfg.products) ||
              JSON.stringify(prev.announcements) !== JSON.stringify(cfg.announcements);
            return changed ? cfg : prev;
          });
          setAnnouncements(prev => {
            const nextJson = JSON.stringify(cfg.announcements || []);
            const prevJson = JSON.stringify(prev);
            return prevJson === nextJson ? prev : (cfg.announcements || []);
          });
          setAnnouncementHistory(prev => {
            const nextJson = JSON.stringify(cfg.announcementHistory || []);
            const prevJson = JSON.stringify(prev);
            return prevJson === nextJson ? prev : (cfg.announcementHistory || []);
          });
          // Calculate actual shop open status based on isOpen flag AND closeDate
          const shopStatus = getShopStatus(cfg.isOpen, cfg.closeDate, cfg.openDate);
          const actuallyOpen = shopStatus === 'OPEN';
          setIsShopOpen(prev => prev === actuallyOpen ? prev : actuallyOpen);
        } else {
          console.warn('No config returned from getPublicConfig');
        }
      } else {
        console.error('Failed to load config:', res.message || res.error);
      }
      
      // Fetch shipping config for cart display
      try {
        const shippingRes = await fetch('/api/shipping/options');
        if (shippingRes.ok) {
          const shippingData = await shippingRes.json();
          setShippingConfig(shippingData);
        }
      } catch (shippingErr) {
        console.error('Failed to load shipping config:', shippingErr);
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    } finally {
      configFetchInFlight.current = false;
    }
  }, []);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const cached = loadCachedConfig();
        if (cached) {
          setConfig(cached as unknown as ShopConfig);
          setAnnouncements(cached.announcements || []);
          setAnnouncementHistory(cached.announcementHistory || []);
          // Calculate actual shop open status based on isOpen flag AND closeDate
          const cachedCfg = cached as unknown as ShopConfig;
          const shopStatus = getShopStatus(cachedCfg.isOpen, cachedCfg.closeDate, cachedCfg.openDate);
          setIsShopOpen(shopStatus === 'OPEN');
          
          // Preload product images from cache (first image of each product)
          const imageUrls = (cachedCfg.products || [])
            .flatMap((p: Product) => p.images?.slice(0, 1) || [])
            .filter(Boolean);
          if (imageUrls.length > 0) {
            preloadImages(imageUrls).catch(() => {});
          }
        }

        await refreshConfig();
      } catch (error) {
        console.error('Failed to load config:', error);
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, [refreshConfig]);

  // Auto-open product from URL query param (?p=id or legacy ?product=slug-or-id)
  useEffect(() => {
    if (!config?.products?.length || loading) return;
    const params = new URLSearchParams(window.location.search);
    const productParam = params.get('p') || params.get('product');
    if (!productParam) return;
    const decoded = decodeURIComponent(productParam);
    const found = config.products.find(p =>
      p.id === decoded ||
      p.slug === decoded ||
      generateSlug(p.name, p.id) === decoded
    );
    if (found && isProductCurrentlyOpen(found)) {
      handleSelectProduct(found);
      // Clean URL without reload
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [config?.products, loading]);

  useEffect(() => {
    if (!session?.user?.email) return;

    setOrderData((prev) => ({
      ...prev,
      email: session.user?.email || prev.email,
      name: prev.name || session.user?.name || '',
    }));

    const loadProfile = async () => {
      const email = session.user?.email;
      if (!email) return;
      try {
        const res = await getProfile(email);
        const profile = (res.data as any)?.profile || (res as any)?.profile;
        if (res.status === 'success' && profile) {
          const sanitizedProfile = {
            name: typeof profile.name === 'string' ? profile.name.trim() : '',
            phone: typeof profile.phone === 'string' ? onlyDigitsPhone(profile.phone) : '',
            address: typeof profile.address === 'string' ? profile.address.trim() : '',
            instagram: typeof profile.instagram === 'string' ? profile.instagram.trim() : '',
            profileImage: typeof profile.profileImage === 'string' ? profile.profileImage : '',
          };
          setOrderData((prev) => ({ ...prev, ...sanitizedProfile, email: session.user?.email || prev.email }));

          // Load saved addresses
          if (Array.isArray(profile.savedAddresses)) {
            setSavedAddresses(profile.savedAddresses);
          }

          // Load theme preference from DB
          if (profile.theme && ['light', 'dark', 'system'].includes(profile.theme)) {
            const { setMode, mode } = useThemeStore.getState();
            if (mode !== profile.theme) {
              setMode(profile.theme as ThemeMode);
            }
            // Initialize ref so the auto-save effect knows the baseline
            prevThemeModeRef.current = profile.theme as ThemeMode;
          } else {
            // No theme in DB yet — set current mode as baseline
            prevThemeModeRef.current = useThemeStore.getState().mode;
          }

          const alreadyComplete = isThaiText(sanitizedProfile.name) && !!sanitizedProfile.phone && !!sanitizedProfile.instagram;
          if (!alreadyComplete) {
            setShowProfileModal(true);
          }
          }
      } catch (error) {
        console.error('Failed to load profile:', error);
      }
    };

    const loadCart = async () => {
      const email = session.user?.email;
      if (!email) return;
      try {
        const res = await getCart(email);
        const serverCart = (res.data as any)?.cart || (res as any)?.cart;
        if (res.status === 'success' && Array.isArray(serverCart)) {
          setCart(serverCart);
        }
      } catch (error) {
        console.error('Failed to load cart:', error);
      }
    };

    loadProfile();
    loadCart();
  }, [session]);

  // Recalculate cart prices when events change (auto-revert discounts when event ends)
  useEffect(() => {
    if (!config?.products?.length || cart.length === 0) return;
    const events = config.events as ShopEvent[] | undefined;
    let needsUpdate = false;
    const updatedCart = cart.map(item => {
      const product = config.products.find(p => p.id === item.productId);
      if (!product) return item;

      // Determine base price from size/variant
      let basePrice: number;
      if (item.options?.variantId) {
        const variant = (product as any).variants?.find((v: any) => v.id === item.options?.variantId);
        basePrice = variant?.price || product.basePrice;
      } else if (item.size && item.size !== '-') {
        basePrice = product.sizePricing?.[item.size] ?? product.basePrice;
      } else {
        basePrice = product.basePrice;
      }

      // Apply event discount if still active
      const discount = getEventDiscount(product.id, events);
      if (discount) {
        basePrice = discount.discountedPrice(basePrice);
      }

      // Add long sleeve fee
      const longSleeveFee = item.options?.isLongSleeve
        ? (product.options?.longSleevePrice ?? 50)
        : 0;

      const correctPrice = basePrice + longSleeveFee;
      if (item.unitPrice !== correctPrice) {
        needsUpdate = true;
        return { ...item, unitPrice: correctPrice };
      }
      return item;
    });

    if (needsUpdate) {
      saveCart(updatedCart);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config?.events, config?.products, cart.length]);

  // Auto-save theme to DB when user changes it
  useEffect(() => {
    // Skip if ref hasn't been initialized yet (profile not loaded)
    if (prevThemeModeRef.current === null) return;
    // Skip if theme hasn't actually changed
    if (prevThemeModeRef.current === themeMode) return;
    prevThemeModeRef.current = themeMode;
    // Save to DB if logged in
    const email = session?.user?.email;
    if (email) {
      saveProfileApi(email, { theme: themeMode }).catch((err) => {
        console.error('Failed to save theme preference:', err);
      });
    }
  }, [themeMode, session?.user?.email]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = window.localStorage.getItem('orderData');
      if (saved) {
        const parsed = JSON.parse(saved);
        setOrderData((prev) => ({ ...prev, ...parsed }));
      }
    } catch (error) {
      console.error('Failed to load saved order data', error);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem('orderData', JSON.stringify(orderData));
    } catch (error) {
      console.error('Failed to persist order data', error);
    }
  }, [orderData]);

  // Unified product select handler — batches all state into one render
  const handleSelectProduct = useCallback((product: Product) => {
    const sizeKeys = Object.keys(product.sizePricing || {});
    const defaultSize = sizeKeys.length > 0 ? sizeKeys[0] : t.common.freeSize;
    setSelectedProduct(product);
    setActiveImageIndex(0);
    setProductOptions({ size: defaultSize, quantity: 1, customName: '', customNumber: '', isLongSleeve: false });
    setProductDialogOpen(true);
    // Track recently viewed
    recentlyViewedStore.addItem(product.id);
  }, []);

  //  Auto-cycle through announcements
  useEffect(() => {
    const enabledAnnouncements = announcements?.filter(a => a.enabled) || [];
    if (enabledAnnouncements.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentAnnouncementIndex(prev => (prev + 1) % enabledAnnouncements.length);
    }, 8000); // Change every 8 seconds
    
    return () => clearInterval(interval);
  }, [announcements]);

  //  Check if announcement was dismissed in this session
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const dismissed = sessionStorage.getItem('announcementDismissed');
    if (dismissed === 'true') {
      setShowAnnouncementPopup(false);
    }
  }, []);

  //  Auto-close product dialog when shop becomes closed
  useEffect(() => {
    if (!isShopOpen && productDialogOpen) {
      setProductDialogOpen(false);
      setSelectedProduct(null);
      setProductOptions({ size: '', quantity: 1, customName: '', customNumber: '', isLongSleeve: false });
      showToast('warning', t.checkout.shopClosedWarning);
    }
    // Also close order dialog if shop is closed
    if (!isShopOpen && showOrderDialog) {
      setShowOrderDialog(false);
      showToast('warning', t.checkout.shopClosedWarning);
    }
  }, [isShopOpen, productDialogOpen, showOrderDialog]);

  //  Realtime config updates via Supabase + fallback polling for visibility changes
  const handleConfigChange = useCallback((newConfig: ShopConfig) => {
    console.log('[Realtime] Config updated from server');
    // Set the full config (realtime gives us the complete config)
    setConfig(newConfig);
    // Also cache it as lean for session storage
    const lean = sanitizeConfig(newConfig);
    cacheConfig(lean);
  }, []);

  const handleOrderChange = useCallback((change: { type: string; order: any; oldOrder?: any }) => {
    console.log('[Realtime] Order change received:', change.type);
    
    // Helper to calculate shipping fee from realtime data
    const calculateShippingFee = (order: any): number | undefined => {
      if (order.shipping_fee !== undefined && order.shipping_fee !== null) return order.shipping_fee;
      if (order.shippingFee !== undefined && order.shippingFee !== null) return order.shippingFee;
      
      const cart = order.cart || order.items || [];
      const cartSubtotal = cart.reduce((sum: number, item: any) => {
        const price = item.unitPrice || item.price || 0;
        const qty = item.quantity || 1;
        return sum + (price * qty);
      }, 0);
      const totalAmount = order.total_amount || order.totalAmount || order.amount || 0;
      const calculatedFee = totalAmount - cartSubtotal;
      
      // Only return if it's a reasonable shipping fee
      if (calculatedFee > 0 && calculatedFee < 200) {
        return calculatedFee;
      }
      return undefined;
    };
    
    if (change.type === 'UPDATE' && change.order) {
      // Update order in history if it exists
      setOrderHistory((prev) => {
        const existingIndex = prev.findIndex((o) => o.ref === change.order.ref);
        if (existingIndex >= 0) {
          const updated = [...prev];
          // Convert DB format to OrderHistory format
          updated[existingIndex] = {
            ...updated[existingIndex],
            status: change.order.status,
            total: change.order.total_amount,
            cart: change.order.cart || [],
            date: change.order.date || change.order.created_at,
            // Include shipping info for proper QR code display
            shippingFee: calculateShippingFee(change.order),
            shippingOption: change.order.shipping_option || change.order.shippingOption,
            trackingNumber: change.order.tracking_number || change.order.trackingNumber,
            shippingProvider: change.order.shipping_provider || change.order.shippingProvider,
          };
          return updated;
        }
        return prev;
      });
    } else if (change.type === 'INSERT' && change.order) {
      // Add new order to history
      const newOrder: OrderHistory = {
        ref: change.order.ref,
        date: change.order.date || change.order.created_at,
        status: change.order.status,
        total: change.order.total_amount,
        cart: change.order.cart || [],
        shippingFee: calculateShippingFee(change.order),
        shippingOption: change.order.shipping_option || change.order.shippingOption,
        trackingNumber: change.order.tracking_number || change.order.trackingNumber,
        shippingProvider: change.order.shipping_provider || change.order.shippingProvider,
      };
      setOrderHistory((prev) => {
        // Check if already exists
        if (prev.some((o) => o.ref === newOrder.ref)) return prev;
        return [newOrder, ...prev];
      });
    }
  }, []);


  // Use realtime subscriptions for user's orders
  const userEmail = session?.user?.email;
  const { isConnected: realtimeConnected, error: realtimeError } = useRealtimeOrdersByEmail(
    userEmail,
    handleOrderChange,
    handleConfigChange
  );

  // Fallback: Refresh on visibility change (in case realtime disconnects)

  // --- Chatbot button ---
  // Render at the end of the page
  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden && !realtimeConnected) {
        refreshConfig();
      }
    };

    window.addEventListener('focus', handleVisibility);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('focus', handleVisibility);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [refreshConfig, realtimeConnected]);

  // Fallback polling only when realtime is disconnected
  useEffect(() => {
    if (realtimeConnected) {
      // Realtime connected, clear polling
      if (configPollTimer.current) {
        clearInterval(configPollTimer.current);
        configPollTimer.current = null;
      }
      return;
    }

    // Fallback polling when realtime is not available
    const intervalMs = 30000; // 30s polling as fallback
    configPollTimer.current = setInterval(() => {
      refreshConfig();
    }, intervalMs);

    return () => {
      if (configPollTimer.current) clearInterval(configPollTimer.current);
    };
  }, [refreshConfig, realtimeConnected]);


  const showToast = (type: ToastSeverity, message: string) => {
    const id = `${type}-${message}`;
    
    // ป้องกันการซ้ำซ้อน - ถ้ามี toast เดียวกันอยู่แล้วให้ข้าม
    setToasts((prev) => {
      if (prev.some((t) => t.id === id)) return prev;
      return [...prev, { id, type, message }].slice(-3); // เก็บแค่ 3 อันล่าสุด
    });
    
    // ลบ toast อัตโนมัติหลัง 3 วินาที
    if (toastTimeoutsRef.current.has(id)) {
      clearTimeout(toastTimeoutsRef.current.get(id)!);
    }
    toastTimeoutsRef.current.set(id, setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      toastTimeoutsRef.current.delete(id);
    }, 3000));
    
    if (productDialogOpen) {
      setInlineNotice({ id, type, message });
      setTimeout(() => setInlineNotice(null), 2000);
    }
  };

  const sanitizeConfig = (cfg: ShopConfig): LeanConfig => ({
    isOpen: cfg.isOpen,
    closeDate: cfg.closeDate,
    openDate: cfg.openDate,
    announcements: cfg.announcements || [],
    announcementHistory: cfg.announcementHistory || [],
    products: (cfg.products || []).map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      type: p.type,
      images: p.images,
      basePrice: p.basePrice,
      sizePricing: p.sizePricing,
      isActive: p.isActive,
      startDate: p.startDate,
      endDate: p.endDate,
    })),
  });

  const loadCachedConfig = (): LeanConfig | null => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.sessionStorage.getItem(CONFIG_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed?.timestamp || Date.now() - parsed.timestamp > CONFIG_CACHE_TTL) return null;
      return parsed.config as LeanConfig;
    } catch (error) {
      console.error('Failed to read cached config', error);
      return null;
    }
  };

  const cacheConfig = (lean: LeanConfig) => {
    if (typeof window === 'undefined') return;
    try {
      window.sessionStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), config: lean }));
    } catch (error) {
      console.error('Failed to cache config', error);
    }
  };

  const saveCart = async (newCart: CartItem[]) => {
    setCart(newCart);
    if (!session?.user?.email) return;
    try {
      await saveCartApi(session.user.email, newCart);
    } catch (error) {
      console.error('Failed to save cart:', error);
    }
  };

  const resetProductDialog = () => {
    setProductDialogOpen(false);
    setSelectedProduct(null);
    setProductOptions({ size: '', quantity: 1, customName: '', customNumber: '', isLongSleeve: false });
  };

  const buildCartItem = (): CartItem | null => {
    // Block cart operations when shop is closed
    if (!isShopOpen) {
      showToast('warning', t.checkout.shopClosedWarning);
      return null;
    }
    
    // Check if this product requires size selection
    const needsSize = productRequiresSize(selectedProduct as Product);
    
    // Check if product has variants (non-apparel)
    const hasVariants = !needsSize && (selectedProduct as any)?.variants && (selectedProduct as any).variants.length > 0;
    
    // For variant products, size field stores variant id
    if (!selectedProduct || (needsSize && !productOptions.size) || (hasVariants && !productOptions.size)) {
      // Scroll to size selector and show visual feedback
      sizeSelectorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => {
        sizeSelectorRef.current?.classList.add('shake-highlight');
        setTimeout(() => sizeSelectorRef.current?.classList.remove('shake-highlight'), 600);
      }, 300);
      return null;
    }

    const shirtCfg = { ...DEFAULT_SHIRT_NAME, ...config?.shirtNameConfig };
    const normalizedCustomName = normalizeShirtName(productOptions.customName, shirtCfg);

    if (selectedProduct.options?.hasCustomName && !normalizedCustomName) {
      // Scroll to customName input and focus
      customNameInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => {
        customNameInputRef.current?.focus();
        customNameInputRef.current?.parentElement?.parentElement?.classList.add('shake-highlight');
        setTimeout(() => customNameInputRef.current?.parentElement?.parentElement?.classList.remove('shake-highlight'), 600);
      }, 300);
      return null;
    }

    if (selectedProduct.options?.hasCustomName && normalizedCustomName.length < shirtCfg.minLength) {
      customNameInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => {
        customNameInputRef.current?.focus();
        customNameInputRef.current?.parentElement?.parentElement?.classList.add('shake-highlight');
        setTimeout(() => customNameInputRef.current?.parentElement?.parentElement?.classList.remove('shake-highlight'), 600);
      }, 300);
      showToast('warning', `${t.product.customNameMinLength} ${shirtCfg.minLength} ${t.profile.characters}`);
      return null;
    }

    if (selectedProduct.options?.hasCustomNumber && !productOptions.customNumber) {
      // Scroll to customNumber input and focus
      customNumberInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => {
        customNumberInputRef.current?.focus();
        customNumberInputRef.current?.parentElement?.parentElement?.classList.add('shake-highlight');
        setTimeout(() => customNumberInputRef.current?.parentElement?.parentElement?.classList.remove('shake-highlight'), 600);
      }, 300);
      return null;
    }

    // Handle variants - find selected variant and use its price
    let sizeToUse = needsSize ? productOptions.size : '-';
    let basePrice = needsSize 
      ? (selectedProduct.sizePricing?.[productOptions.size] ?? selectedProduct.basePrice)
      : selectedProduct.basePrice;
    
    // If product has variants, get variant name and price
    let variantName = '';
    if (hasVariants) {
      const selectedVariant = ((selectedProduct as any).variants || []).find((v: any) => v.id === productOptions.size);
      if (selectedVariant) {
        variantName = selectedVariant.name;
        sizeToUse = selectedVariant.name; // Show variant name instead of id
        basePrice = selectedVariant.price || selectedProduct.basePrice;
      }
    }
    
    const longSleeveFee = selectedProduct.options?.hasLongSleeve && productOptions.isLongSleeve 
      ? (selectedProduct.options?.longSleevePrice ?? 50) 
      : 0;

    // Apply event discount to base price before adding fees
    const discount = getEventDiscount(selectedProduct.id, config?.events as ShopEvent[] | undefined);
    if (discount) {
      basePrice = discount.discountedPrice(basePrice);
    }

    const unitPrice = basePrice + longSleeveFee;
    const quantity = clampQty(productOptions.quantity);

    return {
      id: `${selectedProduct.id}-${productOptions.size}-${normalizedCustomName}-${productOptions.customNumber}-${productOptions.isLongSleeve}`,
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      size: sizeToUse,
      quantity,
      unitPrice,
      options: {
        customName: normalizedCustomName,
        customNumber: productOptions.customNumber,
        isLongSleeve: productOptions.isLongSleeve,
        variantId: hasVariants ? productOptions.size : undefined,
        variantName: variantName || undefined,
      },
    };
  };

  const commitCartItem = (item: CartItem, options?: { goCheckout?: boolean }) => {
    const newCart = [...cart, item];
    saveCart(newCart);
    showToast('success', options?.goCheckout ? t.cart.addedGoCheckout : t.cart.addedToCart);
    resetProductDialog();

    if (options?.goCheckout) {
      setShowCart(false);
      setShowOrderDialog(true);
      setActiveTab('cart');
    }
  };

  const handleAddToCart = () => {
    const newItem = buildCartItem();
    if (!newItem) return;
    commitCartItem(newItem);
  };

  const handleBuyNow = () => {
    const newItem = buildCartItem();
    if (!newItem) return;
    if (!requireProfileBeforeCheckout()) return;
    commitCartItem(newItem, { goCheckout: true });
  };

  // ==================== BULK ORDER LOGIC ====================
  const openBulkOrder = () => {
    if (!selectedProduct || !isShopOpen) return;
    setBulkStep(0);
    setBulkSizes({});
    setBulkNames('');
    setBulkLongSleeve(false);
    setBulkAssignments([]);
    setBulkOrderOpen(true);
  };

  const bulkTotalQty = Object.values(bulkSizes).reduce((s, q) => s + q, 0);

  const bulkBuildAssignments = () => {
    const names = bulkNames.split('\n').map(n => n.trim()).filter(Boolean);
    // Distribute sizes across names sequentially
    const sizeList: string[] = [];
    for (const [size, qty] of Object.entries(bulkSizes)) {
      for (let i = 0; i < qty; i++) sizeList.push(size);
    }
    const assignments: Array<{ name: string; size: string }> = names.map((name, i) => ({
      name,
      size: sizeList[i] || sizeList[sizeList.length - 1] || Object.keys(bulkSizes)[0] || 'M',
    }));
    setBulkAssignments(assignments);
    return assignments;
  };

  const bulkCommitToCart = (goCheckout = false) => {
    if (!selectedProduct) return;
    const assignments = bulkAssignments.length ? bulkAssignments : bulkBuildAssignments();
    if (!assignments.length) return;

    const discount = getEventDiscount(selectedProduct.id, config?.events as ShopEvent[] | undefined);
    const longSleeveFee = selectedProduct.options?.hasLongSleeve && bulkLongSleeve
      ? (selectedProduct.options?.longSleevePrice ?? 50) : 0;

    const newItems: CartItem[] = assignments.map(a => {
      let basePrice = selectedProduct.sizePricing?.[a.size] ?? selectedProduct.basePrice;
      if (discount) basePrice = discount.discountedPrice(basePrice);
      const unitPrice = basePrice + longSleeveFee;
      return {
        id: `${selectedProduct.id}-${a.size}-${a.name}--${bulkLongSleeve}`,
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        size: a.size,
        quantity: 1,
        unitPrice,
        options: {
          customName: a.name,
          isLongSleeve: bulkLongSleeve,
        },
      };
    });

    const newCart = [...cart, ...newItems];
    saveCart(newCart);
    showToast('success', `${t.bulkOrder.addToCart} (${newItems.length} ${t.bulkOrder.pieces})`);
    setBulkOrderOpen(false);
    resetProductDialog();

    if (goCheckout) {
      setShowCart(false);
      setShowOrderDialog(true);
      setActiveTab('cart');
    }
  };

  const handleShareProduct = async (product: Product) => {
    const url = getProductLink(product);
    const shareText = `${getProductName(product, lang)} - ฿${product.basePrice.toLocaleString()}`;

    // Try to fetch product image as a File for sharing
    const getImageFile = async (): Promise<File | null> => {
      const imgUrl = product.coverImage || product.images?.[0];
      if (!imgUrl) return null;
      try {
        const res = await fetch(imgUrl, { cache: 'force-cache' });
        if (!res.ok) return null;
        const blob = await res.blob();
        const ext = blob.type.split('/')[1] || 'jpg';
        return new File([blob], `${product.name}.${ext}`, { type: blob.type });
      } catch {
        return null;
      }
    };

    try {
      if (navigator.share) {
        // Try sharing with image file first
        const file = await getImageFile();
        if (file && navigator.canShare?.({ files: [file] })) {
          await navigator.share({ title: getProductName(product, lang), text: shareText, url, files: [file] });
        } else {
          await navigator.share({ title: getProductName(product, lang), text: shareText, url });
        }
      } else {
        await navigator.clipboard.writeText(`${shareText}\n${url}`);
        showToast('success', t.product.linkCopied);
      }
    } catch {
      try { await navigator.clipboard.writeText(`${shareText}\n${url}`); showToast('success', t.product.linkCopied); } catch { /* ignore */ }
    }
  };

  const removeFromCart = (id: string) => {
    const newCart = cart.filter((item) => item.id !== id);
    saveCart(newCart);
    showToast('success', t.cart.removed);
  };

  const updateCartQuantity = (id: string, quantity: number) => {
    const clamped = clampQty(quantity);
    if (clamped <= 0) {
      removeFromCart(id);
      return;
    }
    const newCart = cart.map((item) => (item.id === id ? { ...item, quantity: clamped } : item));
    saveCart(newCart);
  };

  const updateCartItem = (id: string, updates: Partial<CartItem>) => {
    const newCart = cart.map((item) => (item.id === id ? { ...item, ...updates } : item));
    saveCart(newCart);
    setEditingCartItem(null);
    showToast('success', t.cart.updated);
  };

  const openEditCartItem = (item: CartItem) => {
    setEditingCartItem(item);
  };

  const stopProductHold = () => {
    if (productHoldTimer.current) {
      clearInterval(productHoldTimer.current);
      productHoldTimer.current = null;
    }
  };

  const startProductHold = (delta: number) => {
    stopProductHold();
    productHoldTimer.current = setInterval(() => {
      setProductOptions((prev) => ({ ...prev, quantity: clampQty(prev.quantity + delta) }));
    }, 200);
  };

  const stopCartHold = (id: string) => {
    const timer = cartHoldTimers.current[id];
    if (timer) {
      clearInterval(timer);
      cartHoldTimers.current[id] = null;
    }
  };

  const startCartHold = (id: string, delta: number) => {
    stopCartHold(id);
    cartHoldTimers.current[id] = setInterval(() => {
      const target = cartRef.current.find((item) => item.id === id);
      if (!target) {
        stopCartHold(id);
        return;
      }
      updateCartQuantity(id, target.quantity + delta);
    }, 200);
  };

  const getTotalPrice = useCallback(() => {
    return cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  }, [cart]);

  const getStatusLabel = (status: string): string => STATUS_LABELS_I18N[normalizeStatus(status)] || STATUS_LABELS[normalizeStatus(status)] || status;
  const getStatusColor = (status: string): string => STATUS_COLORS[normalizeStatus(status)] || '#86868b';

  // Calculate current price for product dialog
  const getCurrentPrice = useCallback(() => {
    if (!selectedProduct) return 0;
    
    // Check if product has variants (non-apparel)
    const hasVariants = !productRequiresSize(selectedProduct) && (selectedProduct as any)?.variants && (selectedProduct as any).variants.length > 0;
    
    let basePrice = selectedProduct.basePrice;
    
    if (hasVariants && productOptions.size) {
      // For variants, size field stores variant id
      const selectedVariant = ((selectedProduct as any).variants || []).find((v: any) => v.id === productOptions.size);
      if (selectedVariant) {
        basePrice = selectedVariant.price || selectedProduct.basePrice;
      }
    } else if (productRequiresSize(selectedProduct)) {
      // For apparel, use size pricing
      basePrice = selectedProduct.sizePricing?.[productOptions.size] ?? selectedProduct.basePrice;
    }
    
    // Apply event discount
    const discount = getEventDiscount(selectedProduct.id, config?.events as ShopEvent[] | undefined);
    if (discount) {
      basePrice = discount.discountedPrice(basePrice);
    }

    const longSleeveFee = selectedProduct.options?.hasLongSleeve && productOptions.isLongSleeve 
      ? (selectedProduct.options?.longSleevePrice ?? 50) 
      : 0;
    return (basePrice + longSleeveFee) * productOptions.quantity;
  }, [selectedProduct, productOptions, config?.events]);

  const renderProductDialog = () => {
    if (!selectedProduct) return null;

    const productContent = (
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'var(--background)', color: 'var(--foreground)' }}>
        {/* Header - Enhanced Design */}
        <Box sx={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          borderBottom: '1px solid var(--glass-border)',
          background: (theme: any) => theme.palette.mode === 'dark' 
            ? 'linear-gradient(180deg, rgba(0,0,0,0.98) 0%, rgba(0,0,0,0.95) 100%)' 
            : 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.95) 100%)',
          backdropFilter: 'blur(24px)',
        }}>
          {isMobile && (
            <Box sx={{ 
              width: 40, 
              height: 5, 
              bgcolor: 'var(--glass-bg)', 
              borderRadius: 3, 
              mx: 'auto', 
              mt: 1.5, 
              mb: 0.5,
              cursor: 'grab',
            }} />
          )}
          <Box sx={{ px: { xs: 2.5, sm: 3 }, py: { xs: 1.5, sm: 2 }, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ 
                fontSize: { xs: '1.15rem', sm: '1.35rem' }, 
                fontWeight: 800, 
                color: 'var(--foreground)', 
                overflow: 'hidden', 
                textOverflow: 'ellipsis', 
                whiteSpace: 'nowrap',
                letterSpacing: '-0.02em',
              }}>
                {getProductName(selectedProduct, lang)}
              </Typography>
              {/* Custom Tags from config - only show if customTags is defined */}
              {selectedProduct.customTags && selectedProduct.customTags.length > 0 && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.75, flexWrap: 'wrap' }}>
                  {selectedProduct.customTags.map((tag, idx) => (
                    <Box key={idx} sx={{
                      px: 1,
                      py: 0.3,
                      borderRadius: '6px',
                      bgcolor: (tag as any).bgColor || `${tag.color}20`,
                      border: `1px solid ${(tag as any).borderColor || `${tag.color}40`}`,
                    }}>
                      <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: tag.color }}>
                        {lang === 'en' 
                          ? ((tag as any).textEn || TAG_TRANSLATIONS_TH_TO_EN[tag.text] || tag.text)
                          : tag.text}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>

            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
              {/* Wishlist button in dialog */}
              <IconButton 
                onClick={() => {
                  const wasInWishlist = wishlistStore.items.includes(selectedProduct.id);
                  wishlistStore.toggleItem(selectedProduct.id);
                  showToast(
                    wasInWishlist ? 'info' : 'success',
                    wasInWishlist ? t.wishlist.removedFromWishlist : t.wishlist.addedToWishlist
                  );
                }}
                sx={{ 
                  color: wishlistStore.isInWishlist(selectedProduct.id) ? '#ff453a' : 'var(--text-muted)', 
                  bgcolor: wishlistStore.isInWishlist(selectedProduct.id) ? 'rgba(255,69,58,0.1)' : 'var(--glass-bg)', 
                  border: `1px solid ${wishlistStore.isInWishlist(selectedProduct.id) ? 'rgba(255,69,58,0.3)' : 'var(--glass-border)'}`,
                  width: 40,
                  height: 40,
                  '&:hover': { 
                    bgcolor: 'rgba(255,69,58,0.15)', 
                    borderColor: 'rgba(255,69,58,0.3)',
                    color: '#ff453a',
                  },
                  transition: 'all 0.2s ease',
                }}
              >
                <Heart size={18} fill={wishlistStore.isInWishlist(selectedProduct.id) ? '#ff453a' : 'none'} />
              </IconButton>
              <IconButton 
                onClick={() => handleShareProduct(selectedProduct)}
                sx={{ 
                  color: 'var(--text-muted)', 
                  bgcolor: 'var(--glass-bg)', 
                  border: '1px solid var(--glass-border)',
                  width: 40,
                  height: 40,
                  '&:hover': { 
                    bgcolor: 'rgba(0,113,227,0.15)', 
                    borderColor: 'rgba(0,113,227,0.3)',
                    color: '#2997ff',
                  },
                  transition: 'all 0.2s ease',
                }}
              >
                <Share2 size={18} />
              </IconButton>
              <IconButton 
                onClick={() => setProductDialogOpen(false)} 
                sx={{ 
                  color: 'var(--text-muted)', 
                  bgcolor: 'var(--glass-bg)', 
                  border: '1px solid var(--glass-border)',
                  width: 40,
                  height: 40,
                  '&:hover': { 
                    bgcolor: 'rgba(239,68,68,0.15)', 
                    borderColor: 'rgba(239,68,68,0.3)',
                    color: '#f87171',
                  },
                  transition: 'all 0.2s ease',
                }}
              >
                <X size={20} />
              </IconButton>
            </Box>
          </Box>
        </Box>

        {/* Inline Toast - Enhanced Style */}
        {inlineNotice && (
          <Slide direction="up" in={true} mountOnEnter unmountOnExit>
            <Box
              sx={{
                position: 'fixed',
                bottom: { xs: 90, sm: 32 },
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 99999,
                background: {
                  success: 'linear-gradient(135deg, rgba(16, 185, 129, 0.98) 0%, rgba(5, 150, 105, 0.98) 100%)',
                  error: 'linear-gradient(135deg, rgba(239, 68, 68, 0.98) 0%, rgba(220, 38, 38, 0.98) 100%)',
                  warning: 'linear-gradient(135deg, rgba(245, 158, 11, 0.98) 0%, rgba(234, 88, 12, 0.98) 100%)',
                  info: 'linear-gradient(135deg, rgba(0,113,227, 0.98) 0%, rgba(0,113,227, 0.98) 100%)',
                }[inlineNotice.type],
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '16px',
                py: 1.5,
                px: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                boxShadow: {
                  success: '0 8px 32px rgba(16, 185, 129, 0.35)',
                  error: '0 8px 32px rgba(239, 68, 68, 0.35)',
                  warning: '0 8px 32px rgba(245, 158, 11, 0.35)',
                  info: '0 8px 32px rgba(0,113,227, 0.35)',
                }[inlineNotice.type],
                minWidth: { xs: 220, sm: 300 },
                animation: 'toastEnterBottom 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
                '@keyframes toastEnterBottom': {
                  '0%': { opacity: 0, transform: 'translateX(-50%) translateY(12px) scale(0.96)' },
                  '100%': { opacity: 1, transform: 'translateX(-50%) translateY(0) scale(1)' },
                },
              }}
              onClick={() => setInlineNotice(null)}
            >
              <Box 
                sx={{ 
                  width: 32,
                  height: 32,
                  borderRadius: '10px',
                  bgcolor: 'rgba(255, 255, 255, 0.2)',
                  display: 'grid',
                  placeItems: 'center',
                  color: '#fff', 
                  flexShrink: 0,
                }}
              >
                {inlineNotice.type === 'success' && <CheckCircle2 size={18} />}
                {inlineNotice.type === 'error' && <AlertCircle size={18} />}
                {inlineNotice.type === 'warning' && <AlertTriangle size={18} />}
                {inlineNotice.type === 'info' && <Info size={18} />}
              </Box>
              <Typography
                sx={{
                  color: '#fff',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  flex: 1,
                  lineHeight: 1.4,
                }}
              >
                {inlineNotice.message}
              </Typography>
            </Box>
          </Slide>
        )}

        {/* Content */}
        <Box sx={{ flex: 1, overflow: 'auto', WebkitOverflowScrolling: 'touch', px: { xs: 2.5, sm: 3 }, py: 3 }}>
          {/* Image Gallery - Enhanced */}
          <Box sx={{ mb: 3.5 }}>
            {productImages.length > 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {/* Main Image with loading state */}
                <Box 
                  onClick={() => {
                    setLightboxImages(productImages);
                    setLightboxIndex(activeImageIndex);
                    setLightboxImage(productImages[activeImageIndex] || productImages[0]);
                  }}
                  sx={{ 
                    position: 'relative', 
                    borderRadius: '24px', 
                    overflow: 'hidden',
                    bgcolor: 'var(--surface-2)',
                    border: '1px solid var(--glass-border)',
                    boxShadow: (theme: any) => theme.palette.mode === 'dark'
                      ? '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)'
                      : '0 8px 32px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.8)',
                    height: { xs: 300, sm: 380, md: 440 },
                    cursor: 'pointer',
                    '&:hover .expand-icon': { opacity: 1 },
                  }}>
                  <OptimizedImage
                    src={productImages[activeImageIndex] || productImages[0]}
                    alt={`${selectedProduct.name} - รูปที่ ${activeImageIndex + 1}`}
                    width="100%"
                    height="100%"
                    objectFit="cover"
                    priority={true}
                    placeholder="shimmer"
                    showLoadingIndicator={true}
                    style={{
                      position: 'absolute',
                      inset: 0,
                    }}
                  />
                  {/* Expand Icon Overlay */}
                  <Box
                    className="expand-icon"
                    sx={{
                      position: 'absolute',
                      top: 12,
                      left: 12,
                      width: 40,
                      height: 40,
                      borderRadius: '12px',
                      bgcolor: 'rgba(0,0,0,0.55)',
                      backdropFilter: 'blur(8px)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: { xs: 0.85, sm: 0 },
                      transition: 'opacity 0.2s ease',
                      zIndex: 3,
                      border: '1px solid rgba(255,255,255,0.15)',
                    }}
                  >
                    <Expand size={18} color="white" />
                  </Box>
                  {/* Gradient overlay at bottom */}
                  <Box sx={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: 80,
                    background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.6) 100%)',
                    pointerEvents: 'none',
                    zIndex: 1,
                  }} />
                  {totalImages > 1 && (
                    <>
                      <IconButton
                        onClick={() => setActiveImageIndex((prev) => (prev - 1 + totalImages) % totalImages)}
                        sx={{ 
                          position: 'absolute', 
                          top: '50%', 
                          left: 12, 
                          transform: 'translateY(-50%)',
                          bgcolor: 'rgba(0,0,0,0.6)', 
                          backdropFilter: 'blur(8px)',
                          color: 'white', 
                          border: '1px solid var(--glass-border)',
                          zIndex: 2,
                          '&:hover': { bgcolor: 'rgba(0,0,0,0.8)', transform: 'translateY(-50%) scale(1.05)' },
                          transition: 'all 0.2s ease',
                          width: 44,
                          height: 44,
                        }}
                      >
                        <ChevronLeft size={24} />
                      </IconButton>
                      <IconButton
                        onClick={() => setActiveImageIndex((prev) => (prev + 1) % totalImages)}
                        sx={{ 
                          position: 'absolute', 
                          top: '50%', 
                          right: 12, 
                          transform: 'translateY(-50%)',
                          bgcolor: 'rgba(0,0,0,0.6)', 
                          backdropFilter: 'blur(8px)',
                          color: 'white', 
                          border: '1px solid var(--glass-border)',
                          zIndex: 2,
                          '&:hover': { bgcolor: 'rgba(0,0,0,0.8)', transform: 'translateY(-50%) scale(1.05)' },
                          transition: 'all 0.2s ease',
                          width: 44,
                          height: 44,
                        }}
                      >
                        <ChevronRight size={24} />
                      </IconButton>
                      {/* Image Counter - Enhanced */}
                      <Box sx={{
                        position: 'absolute',
                        bottom: 16,
                        right: 16,
                        px: 2,
                        py: 0.75,
                        borderRadius: '24px',
                        bgcolor: 'rgba(0,0,0,0.65)',
                        zIndex: 2,
                        backdropFilter: 'blur(12px)',
                        border: '1px solid var(--glass-border)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.75,
                      }}>
                        <Box sx={{ 
                          width: 6, 
                          height: 6, 
                          borderRadius: '50%', 
                          bgcolor: '#0071e3',
                          animation: 'pulse 2s infinite',
                          '@keyframes pulse': {
                            '0%, 100%': { opacity: 1 },
                            '50%': { opacity: 0.5 },
                          },
                        }} />
                        <Typography sx={{ fontSize: '0.8rem', color: 'white', fontWeight: 700, letterSpacing: '0.05em' }}>
                          {activeImageIndex + 1} / {totalImages}
                        </Typography>
                      </Box>
                    </>
                  )}
                </Box>

                {/* Thumbnail Gallery - Enhanced */}
                {totalImages > 1 && (
                  <Box sx={{ 
                    display: 'flex', 
                    gap: 1.5, 
                    overflowX: 'auto', 
                    pb: 1, 
                    px: 0.5,
                    '&::-webkit-scrollbar': { height: 4 },
                    '&::-webkit-scrollbar-track': { bgcolor: 'var(--glass-bg)', borderRadius: 2 },
                    '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(0,113,227,0.3)', borderRadius: 2 },
                  }}>
                    {productImages.map((img, idx) => (
                      <Box
                        key={idx}
                        onClick={() => setActiveImageIndex(idx)}
                        sx={{
                          width: 72,
                          height: 72,
                          borderRadius: '14px',
                          border: activeImageIndex === idx ? '2px solid #0071e3' : '1px solid var(--glass-border)',
                          overflow: 'hidden',
                          cursor: 'pointer',
                          opacity: activeImageIndex === idx ? 1 : 0.55,
                          transform: activeImageIndex === idx ? 'scale(1.02)' : 'scale(1)',
                          transition: 'all 0.25s ease',
                          flexShrink: 0,
                          boxShadow: activeImageIndex === idx ? '0 4px 16px rgba(0,113,227,0.3)' : 'none',
                          '&:hover': { opacity: 1, borderColor: 'rgba(0,113,227,0.5)' },
                        }}
                      >
                        <Box 
                          component="img" 
                          src={img} 
                          alt={`${selectedProduct.name}-${idx}`} 
                          loading="lazy" 
                          sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} 
                        />
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>
            ) : (
              <Box sx={{ 
                height: 220, 
                borderRadius: '24px', 
                bgcolor: 'var(--surface-2)',
                border: '2px dashed var(--glass-border)', 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: 1,
              }}>
                <Box sx={{ 
                  width: 56, 
                  height: 56, 
                  borderRadius: '16px', 
                  bgcolor: 'rgba(100,116,139,0.15)',
                  display: 'grid',
                  placeItems: 'center',
                }}>
                  <Store size={28} color="#86868b" />
                </Box>
                <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 500 }}>
                  {t.product.noImages}
                </Typography>
              </Box>
            )}
          </Box>

          {/* Description - Enhanced Premium Design */}
          {(getProductDescription(selectedProduct, lang) || selectedProduct.description) && (
            <Box sx={{
              p: 0,
              mb: 3,
              borderRadius: '20px',
              background: (theme: any) => theme.palette.mode === 'dark' 
                ? 'linear-gradient(145deg, rgba(0,0,0,0.8) 0%, rgba(29,29,31,0.6) 100%)' 
                : 'linear-gradient(145deg, rgba(255,255,255,0.9) 0%, rgba(245,245,247,0.8) 100%)',
              border: (theme: any) => theme.palette.mode === 'dark' ? '1px solid rgba(0,113,227,0.2)' : '1px solid rgba(0,113,227,0.15)',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: (theme: any) => theme.palette.mode === 'dark' ? '0 4px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)' : '0 4px 20px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.8)',
            }}>
              {/* Header */}
              <Box sx={{
                px: 2.5,
                py: 1.5,
                background: 'linear-gradient(90deg, rgba(0,113,227,0.15) 0%, rgba(0,113,227,0.1) 100%)',
                borderBottom: '1px solid rgba(0,113,227,0.15)',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}>
                <Box sx={{
                  width: 28,
                  height: 28,
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #0071e3 0%, #0077ED 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(0,113,227,0.4)',
                }}>
                  <Info size={14} color="#fff" />
                </Box>
                <Typography sx={{ 
                  fontSize: '0.85rem', 
                  fontWeight: 700, 
                  color: 'var(--foreground)',
                  letterSpacing: '0.02em',
                }}>
                  {t.product.description}
                </Typography>
              </Box>
              
              {/* Content */}
              <Box sx={{ p: 2.5 }}>
                {(getProductDescription(selectedProduct, lang) || selectedProduct.description || '').split('\n').map((line, idx) => {
                  const trimmedLine = line.trim();
                  if (!trimmedLine) return <Box key={idx} sx={{ height: 12 }} />;
                  
                  // Check if line contains a colon (label: value format)
                  const colonIndex = trimmedLine.indexOf(':');
                  if (colonIndex > 0 && colonIndex < 30) {
                    const label = trimmedLine.substring(0, colonIndex);
                    const value = trimmedLine.substring(colonIndex + 1).trim();
                    return (
                      <Box key={idx} sx={{ 
                        display: 'flex', 
                        flexWrap: 'wrap',
                        gap: 0.5,
                        mb: 1.2,
                        alignItems: 'flex-start',
                      }}>
                        <Box sx={{
                          px: 1,
                          py: 0.3,
                          borderRadius: '6px',
                          background: 'linear-gradient(135deg, rgba(0,113,227,0.2) 0%, rgba(0,113,227,0.15) 100%)',
                          border: '1px solid rgba(0,113,227,0.3)',
                        }}>
                          <Typography sx={{ 
                            fontSize: '0.78rem', 
                            fontWeight: 600, 
                            color: 'var(--secondary)',
                          }}>
                            {label}
                          </Typography>
                        </Box>
                        <Typography sx={{ 
                          fontSize: '0.88rem', 
                          color: 'var(--text-muted)', 
                          lineHeight: 1.6,
                          flex: 1,
                          pt: 0.2,
                        }}>
                          {value}
                        </Typography>
                      </Box>
                    );
                  }
                  
                  // Check if line starts with emoji or bullet
                  const startsWithEmoji = /^[\u{1F300}-\u{1F9FF}]/u.test(trimmedLine);
                  const startsWithBullet = /^[•●○◆◇→►]/u.test(trimmedLine);
                  
                  if (startsWithEmoji || startsWithBullet) {
                    return (
                      <Box key={idx} sx={{ 
                        display: 'flex', 
                        alignItems: 'flex-start',
                        gap: 1,
                        mb: 1,
                        pl: 0.5,
                      }}>
                        <Box sx={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          bgcolor: '#0077ED',
                          mt: 0.8,
                          flexShrink: 0,
                        }} />
                        <Typography sx={{ 
                          fontSize: '0.88rem', 
                          color: 'var(--text-muted)', 
                          lineHeight: 1.6,
                        }}>
                          {trimmedLine}
                        </Typography>
                      </Box>
                    );
                  }
                  
                  // Regular text
                  return (
                    <Typography key={idx} sx={{ 
                      fontSize: '0.88rem', 
                      color: 'var(--text-muted)', 
                      lineHeight: 1.7,
                      mb: 1,
                    }}>
                      {trimmedLine}
                    </Typography>
                  );
                })}
              </Box>
              
              {/* Decorative corner */}
              <Box sx={{
                position: 'absolute',
                top: -30,
                right: -30,
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(0,113,227,0.15) 0%, transparent 70%)',
                pointerEvents: 'none',
              }} />
            </Box>
          )}

          {/* Camp Info - for camp registration products */}
          {(selectedProduct as any).campInfo && (
            <Box sx={{
              p: { xs: 2.5, sm: 3 },
              mb: 2.5,
              borderRadius: '20px',
              background: 'linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(245,158,11,0.05) 100%)',
              border: '1px solid rgba(245,158,11,0.3)',
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                <span style={{ fontSize: '1.5rem' }}></span>
                <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'var(--warning)' }}>
                  {t.product.campInfo}
                </Typography>
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
                {(selectedProduct as any).campInfo.campName && (
                  <Box>
                    <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{t.product.campName}</Typography>
                    <Typography sx={{ fontSize: '0.9rem', color: 'var(--foreground)', fontWeight: 600 }}>
                      {(selectedProduct as any).campInfo.campName}
                    </Typography>
                  </Box>
                )}
                {(selectedProduct as any).campInfo.campDate && (
                  <Box>
                    <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{t.product.campDate}</Typography>
                    <Typography sx={{ fontSize: '0.9rem', color: 'var(--foreground)', fontWeight: 600 }}>
                      {new Date((selectedProduct as any).campInfo.campDate).toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US', { 
                        day: 'numeric', month: 'long', year: 'numeric' 
                      })}
                    </Typography>
                  </Box>
                )}
                {(selectedProduct as any).campInfo.location && (
                  <Box>
                    <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{t.product.campLocation}</Typography>
                    <Typography sx={{ fontSize: '0.9rem', color: 'var(--foreground)', fontWeight: 600 }}>
                      {(selectedProduct as any).campInfo.location}
                    </Typography>
                  </Box>
                )}
                {(selectedProduct as any).campInfo.organizer && (
                  <Box>
                    <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{t.product.campOrganizer}</Typography>
                    <Typography sx={{ fontSize: '0.9rem', color: 'var(--foreground)', fontWeight: 600 }}>
                      {(selectedProduct as any).campInfo.organizer}
                    </Typography>
                  </Box>
                )}
                {(selectedProduct as any).campInfo.maxParticipants > 0 && (
                  <Box sx={{ gridColumn: 'span 2' }}>
                    <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{t.product.campCapacity}</Typography>
                    <Typography sx={{ fontSize: '0.9rem', color: 'var(--foreground)', fontWeight: 600 }}>
                      {(selectedProduct as any).campInfo.currentParticipants || 0} / {(selectedProduct as any).campInfo.maxParticipants} {t.common.people}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>
          )}

          {/* Event Info - for event ticket products */}
          {(selectedProduct as any).eventInfo && (
            <Box sx={{
              p: { xs: 2.5, sm: 3 },
              mb: 2.5,
              borderRadius: '20px',
              background: 'linear-gradient(135deg, rgba(236,72,153,0.15) 0%, rgba(236,72,153,0.05) 100%)',
              border: '1px solid rgba(236,72,153,0.3)',
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                <span style={{ fontSize: '1.5rem' }}></span>
                <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'var(--error)' }}>
                  {t.product.eventInfo}
                </Typography>
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
                {(selectedProduct as any).eventInfo.eventName && (
                  <Box sx={{ gridColumn: 'span 2' }}>
                    <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{t.product.eventName}</Typography>
                    <Typography sx={{ fontSize: '0.9rem', color: 'var(--foreground)', fontWeight: 600 }}>
                      {(selectedProduct as any).eventInfo.eventName}
                    </Typography>
                  </Box>
                )}
                {(selectedProduct as any).eventInfo.eventDate && (
                  <Box>
                    <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{t.product.eventDate}</Typography>
                    <Typography sx={{ fontSize: '0.9rem', color: 'var(--foreground)', fontWeight: 600 }}>
                      {new Date((selectedProduct as any).eventInfo.eventDate).toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US', { 
                        day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </Typography>
                  </Box>
                )}
                {(selectedProduct as any).eventInfo.venue && (
                  <Box>
                    <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{t.product.eventLocation}</Typography>
                    <Typography sx={{ fontSize: '0.9rem', color: 'var(--foreground)', fontWeight: 600 }}>
                      {(selectedProduct as any).eventInfo.venue}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>
          )}

          {/* Size Chart & Selection - Only show for products that need size */}
          {productRequiresSize(selectedProduct) && (
          <Box sx={{
            p: { xs: 2.5, sm: 3 },
            mb: 2.5,
            borderRadius: '20px',
            background: (theme: any) => theme.palette.mode === 'dark' 
              ? 'linear-gradient(135deg, rgba(29,29,31,0.6) 0%, rgba(29,29,31,0.3) 100%)' 
              : 'linear-gradient(135deg, rgba(255,255,255,0.8) 0%, rgba(245,245,247,0.6) 100%)',
            border: '1px solid var(--glass-border)',
            boxShadow: (theme: any) => theme.palette.mode === 'dark' ? 'inset 0 1px 0 rgba(255,255,255,0.05)' : 'inset 0 1px 0 rgba(255,255,255,0.8)',
          }}>
            {/* Size Chart Table - Now at Top */}
            <Box sx={{ 
              mb: 3, 
              p: 2, 
              borderRadius: '16px', 
              bgcolor: 'var(--surface)',
              border: '1px solid rgba(0,113,227,0.2)',
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <Ruler size={16} color="#2997ff" />
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--secondary)' }}>
                  {t.product.sizeChart}
                </Typography>
              </Box>
              
              {/* Mobile: Horizontal scrollable cards */}
              <Box sx={{ 
                display: { xs: 'flex', sm: 'none' },
                overflowX: 'auto',
                gap: 1,
                pb: 1,
                mx: -1,
                px: 1,
                '&::-webkit-scrollbar': { height: 4 },
                '&::-webkit-scrollbar-track': { bgcolor: 'var(--glass-bg)', borderRadius: 2 },
                '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(0,113,227,0.3)', borderRadius: 2 },
              }}>
                {displaySizes.map((size) => {
                  const sizeKey = size as keyof typeof SIZE_MEASUREMENTS;
                  const measurement = SIZE_MEASUREMENTS[sizeKey];
                  const isSelected = productOptions.size === size;
                  return (
                    <Box 
                      key={size}
                      sx={{
                        flexShrink: 0,
                        minWidth: 70,
                        p: 1.5,
                        borderRadius: '12px',
                        bgcolor: isSelected ? 'rgba(0,113,227,0.2)' : 'var(--glass-bg)',
                        border: isSelected ? '2px solid rgba(0,113,227,0.5)' : '1px solid var(--glass-border)',
                        textAlign: 'center',
                      }}
                    >
                      <Typography sx={{ 
                        fontSize: '0.85rem', 
                        fontWeight: 800, 
                        color: isSelected ? 'var(--primary)' : 'var(--foreground)',
                        mb: 0.5,
                      }}>
                        {size}
                      </Typography>
                      <Box sx={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 0.5 }}>
                          <span>{t.product.chest}</span>
                          <span style={{ color: isSelected ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 600 }}>
                            {measurement?.chest || '-'}
                          </span>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 0.5 }}>
                          <span>{t.product.length}</span>
                          <span style={{ color: isSelected ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 600 }}>
                            {measurement?.length || '-'}
                          </span>
                        </Box>
                      </Box>
                    </Box>
                  );
                })}
              </Box>

              {/* Desktop: Grid table */}
              <Box sx={{ 
                display: { xs: 'none', sm: 'grid' },
                gridTemplateColumns: 'auto 1fr',
                gap: 0,
                fontSize: '0.72rem',
                '& > div': { 
                  p: 0.8, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  borderBottom: '1px solid var(--glass-border)',
                },
              }}>
                {/* Header Row */}
                <Box sx={{ bgcolor: 'rgba(0,113,227,0.15)', fontWeight: 700, color: 'var(--secondary)', borderRadius: '6px 0 0 0' }}>{t.product.sizeLabel}</Box>
                <Box sx={{ display: 'grid !important', gridTemplateColumns: `repeat(${displaySizes.length}, 1fr)`, bgcolor: 'rgba(0,113,227,0.08)' }}>
                  {displaySizes.map((size, idx) => (
                    <Box key={size} sx={{ 
                      fontWeight: 700, 
                      color: productOptions.size === size ? 'var(--primary)' : 'var(--text-muted)',
                      borderRight: idx < displaySizes.length - 1 ? '1px solid var(--glass-border)' : 'none',
                      bgcolor: productOptions.size === size ? 'rgba(0,113,227,0.2)' : 'transparent',
                    }}>
                      {size}
                    </Box>
                  ))}
                </Box>
                {/* Chest Row */}
                <Box sx={{ bgcolor: 'var(--glass-bg)', color: 'var(--text-muted)', fontWeight: 600 }}>{t.product.chestFull}</Box>
                <Box sx={{ display: 'grid !important', gridTemplateColumns: `repeat(${displaySizes.length}, 1fr)` }}>
                  {displaySizes.map((size, idx) => {
                    const sizeKey = size as keyof typeof SIZE_MEASUREMENTS;
                    const measurement = SIZE_MEASUREMENTS[sizeKey];
                    return (
                      <Box key={size} sx={{ 
                        color: productOptions.size === size ? 'var(--foreground)' : 'var(--text-muted)',
                        borderRight: idx < displaySizes.length - 1 ? '1px solid var(--glass-border)' : 'none',
                        bgcolor: productOptions.size === size ? 'rgba(0,113,227,0.1)' : 'transparent',
                      }}>
                        {measurement?.chest || '-'}
                      </Box>
                    );
                  })}
                </Box>
                {/* Length Row */}
                <Box sx={{ bgcolor: 'var(--glass-bg)', color: 'var(--text-muted)', fontWeight: 600, borderRadius: '0 0 0 6px', borderBottom: 'none !important' }}>{t.product.lengthFull}</Box>
                <Box sx={{ display: 'grid !important', gridTemplateColumns: `repeat(${displaySizes.length}, 1fr)`, borderBottom: 'none !important' }}>
                  {displaySizes.map((size, idx) => {
                    const sizeKey = size as keyof typeof SIZE_MEASUREMENTS;
                    const measurement = SIZE_MEASUREMENTS[sizeKey];
                    return (
                      <Box key={size} sx={{ 
                        color: productOptions.size === size ? 'var(--foreground)' : 'var(--text-muted)',
                        borderRight: idx < displaySizes.length - 1 ? '1px solid var(--glass-border)' : 'none',
                        bgcolor: productOptions.size === size ? 'rgba(0,113,227,0.1)' : 'transparent',
                        borderBottom: 'none !important',
                      }}>
                        {measurement?.length || '-'}
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            </Box>

            {/* Size Selection Header */}
            <Box ref={sizeSelectorRef} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <Box sx={{
                width: 36,
                height: 36,
                borderRadius: '10px',
                bgcolor: 'rgba(0,113,227,0.15)',
                display: 'grid',
                placeItems: 'center',
              }}>
                <Tag size={18} color="#2997ff" />
              </Box>
              <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--foreground)' }}>
                {t.product.selectSize}
              </Typography>
            </Box>

            {/* Size Selection Cards */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {displaySizes.map((size) => {
                const basePrice = selectedProduct?.sizePricing?.[size] ?? selectedProduct?.basePrice ?? 0;
                const longSleeveFee = selectedProduct.options?.hasLongSleeve && productOptions.isLongSleeve 
                  ? (selectedProduct.options?.longSleevePrice ?? 50) 
                  : 0;
                const price = basePrice + longSleeveFee;
                const active = productOptions.size === size;
                const sizeKey = size as keyof typeof SIZE_MEASUREMENTS;
                const measurement = SIZE_MEASUREMENTS[sizeKey];
                return (
                  <Box
                    key={size}
                    onClick={() => setProductOptions({ ...productOptions, size })}
                    sx={{
                      px: 2,
                      py: 1.2,
                      borderRadius: '12px',
                      border: active ? '2px solid #0071e3' : '1px solid var(--glass-border)',
                      bgcolor: active ? 'rgba(0,113,227,0.15)' : 'var(--glass-bg)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      minWidth: 75,
                      position: 'relative',
                      '&:hover': { 
                        borderColor: active ? '#0071e3' : 'rgba(0,113,227,0.5)',
                        bgcolor: active ? 'rgba(0,113,227,0.2)' : 'rgba(0,113,227,0.08)',
                      },
                    }}
                  >
                    <Typography sx={{ fontSize: '1rem', fontWeight: 800, color: active ? 'var(--primary)' : 'var(--foreground)' }}>
                      {size}
                    </Typography>
                    <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: active ? '#0071e3' : '#86868b', mb: 0.3 }}>
                      ฿{price.toLocaleString()}
                    </Typography>
                    {measurement && (
                      <Typography sx={{ fontSize: '0.6rem', color: active ? '#30d158' : '#86868b' }}>
                        {measurement.chest}" × {measurement.length}"
                      </Typography>
                    )}
                  </Box>
                );
              })}
            </Box>
          </Box>
          )}

          {/* Variants Selection - for non-apparel products */}
          {!productRequiresSize(selectedProduct) && (selectedProduct as any).variants && (selectedProduct as any).variants.length > 0 && (
            <Box sx={{
              p: { xs: 2.5, sm: 3 },
              mb: 2.5,
              borderRadius: '20px',
              background: 'linear-gradient(135deg, rgba(0,113,227,0.15) 0%, rgba(0,113,227,0.05) 100%)',
              border: '1px solid rgba(0,113,227,0.3)',
            }}>
              <Box ref={sizeSelectorRef} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                <Box sx={{
                  width: 36,
                  height: 36,
                  borderRadius: '10px',
                  bgcolor: 'rgba(0,113,227,0.2)',
                  display: 'grid',
                  placeItems: 'center',
                }}>
                  <span style={{ fontSize: '1.1rem' }}></span>
                </Box>
                <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--secondary)' }}>
                  {t.product.selectOption}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {((selectedProduct as any).variants || [])
                  .filter((v: any) => v.isActive !== false)
                  .map((variant: any) => {
                    const active = productOptions.size === variant.id;
                    const isOutOfStock = variant.stock !== null && variant.stock !== undefined && variant.stock <= 0;
                    return (
                      <Box
                        key={variant.id}
                        onClick={() => {
                          if (isOutOfStock) return;
                          setProductOptions({ ...productOptions, size: variant.id });
                        }}
                        sx={{
                          px: 2,
                          py: 1.5,
                          borderRadius: '12px',
                          border: active ? '2px solid #0077ED' : '1px solid var(--glass-border)',
                          bgcolor: active ? 'rgba(0,113,227,0.15)' : isOutOfStock ? 'var(--glass-bg)' : 'var(--glass-bg)',
                          cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                          opacity: isOutOfStock ? 0.5 : 1,
                          transition: 'all 0.2s ease',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          minWidth: 90,
                          position: 'relative',
                          '&:hover': !isOutOfStock ? { 
                            borderColor: active ? '#0077ED' : 'rgba(0,113,227,0.5)',
                            bgcolor: active ? 'rgba(0,113,227,0.2)' : 'rgba(0,113,227,0.08)',
                          } : {},
                        }}
                      >
                        {isOutOfStock && (
                          <Box sx={{
                            position: 'absolute',
                            top: -8,
                            right: -8,
                            px: 0.8,
                            py: 0.2,
                            bgcolor: '#ff453a',
                            borderRadius: '6px',
                            fontSize: '0.6rem',
                            fontWeight: 700,
                            color: 'white',
                          }}>
                            {t.common.outOfStock}
                          </Box>
                        )}
                        <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: active ? 'var(--secondary)' : 'var(--foreground)' }}>
                          {variant.name}
                        </Typography>
                        <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: active ? 'var(--secondary)' : 'var(--text-muted)' }}>
                          ฿{(variant.price || selectedProduct.basePrice).toLocaleString()}
                        </Typography>
                        {variant.stock !== null && variant.stock !== undefined && variant.stock > 0 && (
                          <Typography sx={{ fontSize: '0.6rem', color: 'var(--text-muted)', mt: 0.3 }}>
                            {t.common.remaining} {variant.stock}
                          </Typography>
                        )}
                      </Box>
                    );
                  })}
              </Box>
            </Box>
          )}

          {/* Additional Options */}
          {(selectedProduct.options?.hasCustomName || selectedProduct.options?.hasCustomNumber || selectedProduct.options?.hasLongSleeve) && (
            <Box sx={{
              p: { xs: 2, sm: 2.5 },
              mb: 2,
              borderRadius: '18px',
              bgcolor: 'var(--surface-2)',
              border: '1px solid var(--glass-border)',
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
                <Box sx={{
                  width: 36,
                  height: 36,
                  borderRadius: '10px',
                  bgcolor: 'rgba(16,185,129,0.15)',
                  display: 'grid',
                  placeItems: 'center',
                }}>
                  <Tag size={18} color="#30d158" />
                </Box>
                <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--foreground)' }}>
                  {t.product.additionalOptions}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {selectedProduct.options?.hasCustomName && (() => {
                  const sc = { ...DEFAULT_SHIRT_NAME, ...config?.shirtNameConfig };
                  const langs: string[] = [];
                  if (sc.allowThai) langs.push(t.profile.langThai);
                  if (sc.allowEnglish) langs.push(t.profile.langEnglish);
                  const langLabel = langs.join('/');
                  const label = `${t.product.customNameLabel} (${langLabel}${sc.allowSpecialChars ? ` + ${sc.allowedSpecialChars}` : ''}, ${sc.minLength}-${sc.maxLength} ${t.profile.characters})`;
                  return (
                    <TextField
                      label={label}
                      fullWidth
                      value={productOptions.customName}
                      onChange={(e) => setProductOptions({ ...productOptions, customName: normalizeShirtName(e.target.value, sc) })}
                      inputProps={{ maxLength: sc.maxLength }}
                      inputRef={customNameInputRef}
                      placeholder={sc.allowThai ? t.product.customNameExample : t.product.customNameExampleEN}
                      helperText={`${productOptions.customName.length}/${sc.maxLength}`}
                      sx={{ 
                        '& .MuiOutlinedInput-root': { 
                          color: 'var(--foreground)',
                          borderRadius: '12px',
                          '& fieldset': { borderColor: 'var(--glass-border)' },
                          '&:hover fieldset': { borderColor: 'rgba(0,113,227,0.5)' },
                          '&.Mui-focused fieldset': { borderColor: '#0071e3' },
                        }, 
                        '& label': { color: 'var(--text-muted)' },
                        '& label.Mui-focused': { color: 'var(--secondary)' },
                      }}
                    />
                  );
                })()}

                {selectedProduct.options?.hasCustomNumber && (
                  <TextField
                    label={t.product.customNumberLabel}
                    fullWidth
                    value={productOptions.customNumber}
                    onChange={(e) => setProductOptions({ ...productOptions, customNumber: normalizeDigits99(e.target.value) })}
                    inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
                    inputRef={customNumberInputRef}
                    placeholder={t.product.customNumberExample}
                    sx={{ 
                      '& .MuiOutlinedInput-root': { 
                        color: 'var(--foreground)',
                        borderRadius: '12px',
                        '& fieldset': { borderColor: 'var(--glass-border)' },
                        '&:hover fieldset': { borderColor: 'rgba(0,113,227,0.5)' },
                        '&.Mui-focused fieldset': { borderColor: '#0071e3' },
                      }, 
                      '& label': { color: 'var(--text-muted)' },
                      '& label.Mui-focused': { color: 'var(--secondary)' },
                    }}
                  />
                )}

                {selectedProduct.options?.hasLongSleeve && (
                  <Box 
                    onClick={() => setProductOptions({ ...productOptions, isLongSleeve: !productOptions.isLongSleeve })}
                    sx={{
                      p: 2,
                      borderRadius: '12px',
                      border: productOptions.isLongSleeve ? '2px solid #ff9f0a' : '1px solid var(--glass-border)',
                      bgcolor: productOptions.isLongSleeve ? 'rgba(245,158,11,0.1)' : 'var(--glass-bg)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.2s ease',
                      '&:hover': { borderColor: productOptions.isLongSleeve ? '#ff9f0a' : 'rgba(245,158,11,0.5)' },
                    }}
                  >
                    <Box>
                      <Typography sx={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--foreground)' }}>
                        {t.product.longSleeveOption}
                      </Typography>
                      <Typography sx={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {t.product.addPerPiece} ฿{selectedProduct.options?.longSleevePrice ?? 50} {t.product.perPiece}
                      </Typography>
                    </Box>
                    <Switch
                      checked={productOptions.isLongSleeve}
                      color="warning"
                      sx={{ pointerEvents: 'none' }}
                    />
                  </Box>
                )}
              </Box>
            </Box>
          )}

          {/* Quantity - Enhanced */}
          <Box sx={{
            p: { xs: 2.5, sm: 3 },
            mb: 2.5,
            borderRadius: '20px',
            background: (theme: any) => theme.palette.mode === 'dark' 
              ? 'linear-gradient(135deg, rgba(29,29,31,0.6) 0%, rgba(29,29,31,0.3) 100%)' 
              : 'linear-gradient(135deg, rgba(255,255,255,0.8) 0%, rgba(245,245,247,0.6) 100%)',
            border: '1px solid var(--glass-border)',
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{
                  width: 40,
                  height: 40,
                  borderRadius: '12px',
                  bgcolor: 'rgba(0,113,227,0.15)',
                  display: 'grid',
                  placeItems: 'center',
                }}>
                  <Package size={20} color="#2997ff" />
                </Box>
                <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)' }}>
                  {t.product.quantity}
                </Typography>
              </Box>
              <Box sx={{
                display: 'flex',
                alignItems: 'center',
                bgcolor: 'var(--glass-bg)',
                borderRadius: '16px',
                border: '1px solid var(--glass-border)',
                overflow: 'hidden',
              }}>
                <IconButton
                  onClick={() => setProductOptions({ ...productOptions, quantity: clampQty(productOptions.quantity - 1) })}
                  sx={{ 
                    color: 'var(--text-muted)', 
                    p: 1.5, 
                    borderRadius: 0,
                    '&:hover': { color: '#f87171', bgcolor: 'rgba(239,68,68,0.1)' },
                    transition: 'all 0.2s ease',
                  }}
                >
                  <Minus size={20} />
                </IconButton>
                <Typography sx={{ 
                  color: 'var(--foreground)', 
                  minWidth: 56, 
                  textAlign: 'center',
                  fontWeight: 800,
                  fontSize: '1.2rem',
                  borderLeft: '1px solid var(--glass-border)',
                  borderRight: '1px solid var(--glass-border)',
                  py: 0.5,
                }}>
                  {productOptions.quantity}
                </Typography>
                <IconButton
                  onClick={() => setProductOptions({ ...productOptions, quantity: clampQty(productOptions.quantity + 1) })}
                  sx={{ 
                    color: 'var(--text-muted)', 
                    p: 1.5, 
                    borderRadius: 0,
                    '&:hover': { color: 'var(--success)', bgcolor: 'rgba(16,185,129,0.1)' },
                    transition: 'all 0.2s ease',
                  }}
                >
                  <Plus size={20} />
                </IconButton>
              </Box>
            </Box>
          </Box>
        </Box>

        {/* Bottom Actions - Enhanced */}
        <Box sx={{
          px: { xs: 2.5, sm: 3 },
          py: 2.5,
          borderTop: '1px solid var(--glass-border)',
          background: (theme: any) => theme.palette.mode === 'dark' 
            ? 'linear-gradient(180deg, rgba(0,0,0,0.98) 0%, rgba(0,0,0,0.99) 100%)' 
            : 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.99) 100%)',
          backdropFilter: 'blur(24px)',
          paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
        }}>
          {/* Price Summary - Enhanced */}
          <Box sx={{
            p: 2.5,
            mb: 2.5,
            borderRadius: '18px',
            background: 'linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(16,185,129,0.05) 100%)',
            border: '1px solid rgba(16,185,129,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'relative',
            overflow: 'hidden',
          }}>
            {/* Background glow */}
            <Box sx={{
              position: 'absolute',
              top: -20,
              right: -20,
              width: 100,
              height: 100,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(16,185,129,0.2) 0%, transparent 70%)',
              pointerEvents: 'none',
            }} />
            <Box sx={{ position: 'relative', zIndex: 1 }}>
              <Typography sx={{ fontSize: '0.78rem', color: 'var(--success)', fontWeight: 600, mb: 0.3 }}>
                {t.product.totalPrice}
                {(() => {
                  const d = getEventDiscount(selectedProduct.id, config?.events as ShopEvent[] | undefined);
                  return d ? <Typography component="span" sx={{ fontSize: '0.68rem', color: '#ff453a', fontWeight: 700, ml: 0.5 }}>({d.discountLabel} {d.eventTitle})</Typography> : null;
                })()}
              </Typography>
              <Typography sx={{ 
                fontSize: '1.75rem', 
                fontWeight: 900, 
                color: 'var(--success)',
                lineHeight: 1,
                textShadow: '0 2px 12px rgba(16,185,129,0.3)',
              }}>
                ฿{getCurrentPrice().toLocaleString()}
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'right', position: 'relative', zIndex: 1 }}>
              <Box sx={{
                px: 1.5,
                py: 0.5,
                borderRadius: '10px',
                bgcolor: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
                mb: 0.5,
              }}>
                <Typography sx={{ fontSize: '0.85rem', color: 'var(--foreground)', fontWeight: 700 }}>
                  {productOptions.size} × {productOptions.quantity}
                </Typography>
              </Box>
              {productOptions.isLongSleeve && selectedProduct && (
                <Typography sx={{ fontSize: '0.72rem', color: 'var(--warning)', fontWeight: 600 }}>+ {t.common.longSleeve} ฿{selectedProduct.options?.longSleevePrice ?? 50}</Typography>
              )}
            </Box>
          </Box>

          {/* ===== Product Reviews Section ===== */}
          {selectedProduct && (
            <Box sx={{ mt: 2, mb: 0.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Star size={16} color="#ff9f0a" fill="#ff9f0a" />
                  <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--foreground)' }}>
                    {t.reviews.title}
                  </Typography>
                  {(() => {
                    const reviews = productReviews[selectedProduct.id] || [];
                    if (reviews.length === 0) return null;
                    const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
                    return (
                      <Chip 
                        label={`${avg.toFixed(1)} (${reviews.length})`} 
                        size="small" 
                        sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700, bgcolor: 'rgba(255,159,10,0.1)', color: '#ff9f0a' }} 
                      />
                    );
                  })()}
                </Box>
                <Button
                  size="small"
                  startIcon={<Edit size={14} />}
                  onClick={() => {
                    if (!session) {
                      showToast('warning', t.reviews.loginRequired);
                      return;
                    }
                    setReviewRating(0);
                    setReviewComment('');
                    setReviewDialogOpen(true);
                  }}
                  sx={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'none', color: '#0071e3' }}
                >
                  {t.reviews.writeReview}
                </Button>
              </Box>

              {/* Reviews list */}
              {(() => {
                const reviews = productReviews[selectedProduct.id] || [];
                if (reviews.length === 0) {
                  return (
                    <Box sx={{ textAlign: 'center', py: 3, borderRadius: '14px', bgcolor: 'var(--surface-2)', border: '1px solid var(--glass-border)' }}>
                      <Star size={32} strokeWidth={1} color="var(--text-muted)" />
                      <Typography sx={{ mt: 1, fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>{t.reviews.noReviews}</Typography>
                      <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)', opacity: 0.7 }}>{t.reviews.beFirst}</Typography>
                    </Box>
                  );
                }
                return (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {reviews.slice(0, 3).map((review) => (
                      <Box key={review.id} sx={{ p: 1.5, borderRadius: '12px', bgcolor: 'var(--surface-2)', border: '1px solid var(--glass-border)' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <Avatar src={review.userImage} sx={{ width: 24, height: 24, fontSize: '0.65rem' }}>{review.userName[0]}</Avatar>
                          <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--foreground)', flex: 1 }}>{review.userName}</Typography>
                          {review.verified && (
                            <Chip label={t.reviews.verified} size="small" sx={{ height: 18, fontSize: '0.55rem', bgcolor: 'rgba(52,199,89,0.1)', color: '#34c759' }} />
                          )}
                          <Box sx={{ display: 'flex', gap: 0.2 }}>
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star key={s} size={10} color="#ff9f0a" fill={s <= review.rating ? '#ff9f0a' : 'none'} />
                            ))}
                          </Box>
                        </Box>
                        {review.comment && (
                          <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5, ml: 4.2 }}>{review.comment}</Typography>
                        )}
                      </Box>
                    ))}
                    {reviews.length > 3 && (
                      <Typography sx={{ fontSize: '0.7rem', color: '#0071e3', textAlign: 'center', fontWeight: 600, cursor: 'pointer' }}>
                        + {reviews.length - 3} {t.reviews.totalReviews}
                      </Typography>
                    )}
                  </Box>
                );
              })()}
            </Box>
          )}

          {/* Stock / Inventory indicator */}
          {selectedProduct?.stock != null && (
            <Box sx={{ 
              mt: 1, mb: 1, px: 1.5, py: 0.8, 
              borderRadius: '12px', 
              bgcolor: selectedProduct.stock <= 0 ? 'rgba(255,69,58,0.08)' : selectedProduct.stock <= 5 ? 'rgba(255,159,10,0.08)' : 'rgba(52,199,89,0.08)',
              border: `1px solid ${selectedProduct.stock <= 0 ? 'rgba(255,69,58,0.2)' : selectedProduct.stock <= 5 ? 'rgba(255,159,10,0.2)' : 'rgba(52,199,89,0.2)'}`,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}>
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: selectedProduct.stock <= 0 ? '#ff453a' : selectedProduct.stock <= 5 ? '#ff9f0a' : '#34c759' }} />
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: selectedProduct.stock <= 0 ? '#ff453a' : selectedProduct.stock <= 5 ? '#ff9f0a' : '#34c759' }}>
                {selectedProduct.stock <= 0 
                  ? t.inventory.outOfStock 
                  : selectedProduct.stock <= 5 
                    ? `${t.inventory.lowStock} — ${selectedProduct.stock} ${t.inventory.remaining}`
                    : `${t.inventory.inStock} — ${selectedProduct.stock} ${t.inventory.remaining}`
                }
              </Typography>
            </Box>
          )}

          {/* Action Buttons - Enhanced */}
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Button
              onClick={handleAddToCart}
              disabled={!isShopOpen}
              startIcon={<ShoppingCart size={20} />}
              sx={{
                flex: 1,
                py: 1.6,
                borderRadius: '16px',
                background: isShopOpen 
                  ? 'linear-gradient(135deg, rgba(0,113,227,0.2) 0%, rgba(0,113,227,0.15) 100%)'
                  : 'rgba(100,116,139,0.1)',
                border: isShopOpen ? '1px solid rgba(0,113,227,0.4)' : '1px solid rgba(100,116,139,0.2)',
                color: isShopOpen ? '#2997ff' : '#86868b',
                fontSize: '0.95rem',
                fontWeight: 700,
                textTransform: 'none',
                boxShadow: isShopOpen ? '0 4px 20px rgba(0,113,227,0.2)' : 'none',
                transition: 'all 0.25s ease',
                '&:hover': { 
                  background: isShopOpen ? 'linear-gradient(135deg, rgba(0,113,227,0.3) 0%, rgba(0,113,227,0.25) 100%)' : 'rgba(100,116,139,0.1)',
                  transform: isShopOpen ? 'translateY(-2px)' : 'none',
                  boxShadow: isShopOpen ? '0 8px 30px rgba(0,113,227,0.3)' : 'none',
                },
                '&:disabled': { color: 'var(--text-muted)', borderColor: 'rgba(100,116,139,0.2)' },
              }}
            >
              {t.product.addToCart}
            </Button>
            <Button
              onClick={handleBuyNow}
              disabled={!isShopOpen}
              startIcon={<Zap size={20} />}
              sx={{
                flex: 1.3,
                py: 1.6,
                borderRadius: '16px',
                background: isShopOpen 
                  ? 'linear-gradient(135deg, #34c759 0%, #34c759 100%)'
                  : 'rgba(100,116,139,0.15)',
                color: isShopOpen ? 'white' : '#86868b',
                fontSize: '0.95rem',
                fontWeight: 800,
                textTransform: 'none',
                boxShadow: isShopOpen ? '0 4px 20px rgba(16,185,129,0.35)' : 'none',
                transition: 'all 0.25s ease',
                '&:hover': {
                  background: isShopOpen 
                    ? 'linear-gradient(135deg, #34c759 0%, #047857 100%)' 
                    : 'rgba(100,116,139,0.15)',
                  transform: isShopOpen ? 'translateY(-2px)' : 'none',
                  boxShadow: isShopOpen ? '0 8px 30px rgba(16,185,129,0.45)' : 'none',
                },
                '&:disabled': { background: 'rgba(100,116,139,0.15)', color: 'var(--text-muted)' },
              }}
            >
              {t.product.buyNow}
            </Button>
          </Box>

          {/* Bulk Order Button - only for apparel with sizes & custom names */}
          {selectedProduct && productRequiresSize(selectedProduct) && selectedProduct.options?.hasCustomName && isShopOpen && (
            <Button
              onClick={openBulkOrder}
              startIcon={<Users size={18} />}
              fullWidth
              sx={{
                mt: 1,
                py: 1.2,
                borderRadius: '14px',
                background: 'linear-gradient(135deg, rgba(168,85,247,0.15) 0%, rgba(139,92,246,0.1) 100%)',
                border: '1px solid rgba(168,85,247,0.35)',
                color: '#a855f7',
                fontSize: '0.85rem',
                fontWeight: 700,
                textTransform: 'none',
                transition: 'all 0.25s ease',
                '&:hover': { 
                  background: 'linear-gradient(135deg, rgba(168,85,247,0.25) 0%, rgba(139,92,246,0.2) 100%)',
                  transform: 'translateY(-1px)',
                  boxShadow: '0 4px 20px rgba(168,85,247,0.2)',
                },
              }}
            >
              {t.bulkOrder.buttonLabel} — {t.bulkOrder.subtitle}
            </Button>
          )}
        </Box>
      </Box>
    );

    if (isMobile) {
      return (
        <Drawer
          anchor="bottom"
          open={productDialogOpen}
          onClose={() => setProductDialogOpen(false)}
          PaperProps={{
            sx: {
              height: '95vh',
              maxHeight: '95vh',
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              bgcolor: 'var(--background)',
              overflow: 'hidden',
              boxShadow: (theme: any) => theme.palette.mode === 'dark' ? '0 -10px 60px rgba(0,0,0,0.5), 0 -4px 20px rgba(0,113,227,0.15)' : '0 -10px 60px rgba(0,0,0,0.1), 0 -4px 20px rgba(0,113,227,0.08)',
            },
          }}
          transitionDuration={{ enter: 350, exit: 250 }}
          sx={{ zIndex: 8000 }}
        >
          {productContent}
        </Drawer>
      );
    }

    return (
      <Drawer
        anchor="right"
        open={productDialogOpen}
        onClose={() => setProductDialogOpen(false)}
        PaperProps={{
          sx: {
            width: '100%',
            maxWidth: 560,
            bgcolor: 'var(--background)',
            overflow: 'hidden',
            boxShadow: (theme: any) => theme.palette.mode === 'dark' ? '-10px 0 60px rgba(0,0,0,0.5), -4px 0 20px rgba(0,113,227,0.15)' : '-10px 0 60px rgba(0,0,0,0.1), -4px 0 20px rgba(0,113,227,0.08)',
          },
        }}
        transitionDuration={{ enter: 300, exit: 200 }}
        sx={{ zIndex: 8000 }}
      >
        {productContent}
      </Drawer>
    );
  };

  // Note: historyFilters, filterCounts, and filteredOrders are now handled inside OrderHistoryDrawer

  const cancelOrderByRef = async (ref: string) => {
    try {
      setCancellingRef(ref);
      setProcessing(true);
      const res = await cancelOrder(ref);

      if (res.status === 'success') {
        showToast('success', t.orderHistory.cancelledOrder);
        // Update local state immediately for instant UI feedback
        setOrderHistory((prev) =>
          prev.map((order) =>
            order.ref === ref ? { ...order, status: 'CANCELLED' } : order
          )
        );
        // Also refresh from server in background to ensure data consistency
        setTimeout(() => {
          loadOrderHistory();
        }, 500);
      } else {
        showToast('error', res.message || t.orderHistory.cancelFailed);
      }
    } catch (error: any) {
      showToast('error', error.message || t.orderHistory.cancelFailed);
    } finally {
      setCancellingRef(null);
      setProcessing(false);
    }
  };

  const handleCancelOrder = (ref: string) => {
    setConfirmCancelRef(ref);
  };

  const profileComplete = useMemo(() => {
    return isThaiText(orderData.name) && !!orderData.phone && !!orderData.instagram;
  }, [orderData]);

  const requireProfileBeforeCheckout = () => {
    // Block checkout if shop is closed
    if (!isShopOpen) {
      showToast('warning', t.checkout.shopClosedWarning);
      return false;
    }
    if (!profileComplete) {
      showToast('warning', t.profile.profileSaveRequired);
      setShowProfileModal(true);
      setPendingCheckout(true);
      return false;
    }
    return true;
  };

  const submitOrder = async (options?: {
    shippingOptionId?: string;
    paymentOptionId?: string;
    shippingFee?: number;
    promoCode?: string;
    promoDiscount?: number;
  }) => {
    // Block submission if shop is closed
    if (!isShopOpen) {
      showToast('warning', t.checkout.shopClosedWarning);
      setShowOrderDialog(false);
      return;
    }
    
    if (!profileComplete) {
      showToast('warning', t.checkout.profileRequired);
      setShowProfileModal(true);
      setPendingCheckout(true);
      return;
    }

    if (cart.length === 0) {
      showToast('warning', t.cart.emptyWarning);
      return;
    }

    // Calculate total with shipping fee and promo discount
    const subtotal = getTotalPrice();
    const shippingFee = options?.shippingFee || 0;
    const promoDiscount = options?.promoDiscount || 0;
    const totalAmount = Math.max(0, subtotal + shippingFee - promoDiscount);

    try {
      setProcessing(true);
      
      const res = await submitOrderApi({
        customerName: orderData.name,
        customerEmail: orderData.email,
        customerPhone: orderData.phone,
        customerAddress: orderData.address,
        customerInstagram: orderData.instagram,
        cart: cart,
        totalAmount: totalAmount,
        turnstileToken,
        shippingOptionId: options?.shippingOptionId,
        paymentOptionId: options?.paymentOptionId,
        shippingFee: options?.shippingFee,
        promoCode: options?.promoCode,
        promoDiscount: options?.promoDiscount,
      });

      if (res.status === 'success') {
        showToast('success', `${t.checkout.orderSuccess} ${res.ref}`);
        
        // Add new order to history immediately with full item details
        if (res.ref) {
          const newOrder: OrderHistory = {
            ref: res.ref,
            status: 'PENDING',
            date: new Date().toISOString(),
            total: totalAmount,
            items: cart.map((item) => ({
              productId: item.productId,
              name: item.productName,
              size: item.size,
              qty: item.quantity,
              customName: item.options?.customName,
              isLongSleeve: item.options?.isLongSleeve,
              unitPrice: item.unitPrice,
              subtotal: item.unitPrice * item.quantity,
            })),
          };
          // Only add if not already present (avoid duplicates from realtime)
          setOrderHistory((prev) => {
            if (prev.some((o) => o.ref === newOrder.ref)) return prev;
            return [newOrder, ...prev];
          });
        }
        
        setCart([]);
        if (session?.user?.email) {
          saveCartApi(session.user.email, []).catch((err) => console.error('Failed to clear saved cart', err));
        }
        setShowOrderDialog(false);

        await saveProfileApi(orderData.email, {
          name: orderData.name,
          phone: orderData.phone,
          address: orderData.address,
          instagram: orderData.instagram,
          profileImage: orderData.profileImage,
        });

        if (res.ref) openPaymentFlow(res.ref);
      } else {
        throw new Error(res.message || t.common.error);
      }
    } catch (error: any) {
      showToast('error', error.message || t.checkout.orderError);
    } finally {
      setProcessing(false);
    }
  };

  const loadOrderHistory = async (opts?: { append?: boolean }) => {
    if (!session?.user?.email) return;
    const append = opts?.append;
    const pageSize = isMobile ? 20 : 50;
    append ? setLoadingHistoryMore(true) : setLoadingHistory(true);
    try {
      const res = await getHistory(session.user.email, append ? historyCursor || undefined : undefined, pageSize);

      if (res.status === 'success') {
        const rawHistory = res.data?.history || (res as any)?.history || [];
        const hasMore = Boolean(res.data?.hasMore);
        const nextCursor = res.data?.nextCursor || null;
        if (Array.isArray(rawHistory)) {
          // Normalize order data - calculate total from cart/items if not present
          const history = rawHistory.map((order: any) => {
            let total = order.total || order.totalAmount || order.amount || 0;
            
            // If total is 0 or missing, calculate from cart/items
            if (!total || total === 0) {
              const items = order.items || order.cart || [];
              if (Array.isArray(items) && items.length > 0) {
                total = items.reduce((sum: number, item: any) => {
                  const price = item.unitPrice || item.subtotal || item.price || 0;
                  const qty = item.qty || item.quantity || 1;
                  return sum + (item.subtotal || (price * qty));
                }, 0);
              }
            }
            
            return {
              ...order,
              total,
              items: order.items || order.cart || [],
            };
          });
          
          // Deduplicate orders by ref
          setOrderHistory((prev) => {
            if (append) {
              // When appending, only add orders not already present
              const existingRefs = new Set(prev.map(o => o.ref));
              const newOrders = history.filter((o: any) => !existingRefs.has(o.ref));
              return [...prev, ...newOrders];
            } else {
              // When replacing, deduplicate the new list itself
              const seen = new Set<string>();
              return history.filter((o: any) => {
                if (seen.has(o.ref)) return false;
                seen.add(o.ref);
                return true;
              });
            }
          });
          setHistoryHasMore(hasMore);
          setHistoryCursor(nextCursor);
        } else {
          console.warn('History response missing array', { res });
          if (!append) setOrderHistory([]);
          setHistoryHasMore(false);
          setHistoryCursor(null);
        }
      }
    } catch (error) {
      console.error('Failed to load history:', error);
      showToast('error', t.misc.cannotLoadHistory);
    } finally {
      append ? setLoadingHistoryMore(false) : setLoadingHistory(false);
    }
  };

  // ===== Auto-cancel expired unpaid orders (24h) =====
  // Check if waiting_payment orders have expired and auto-cancel them client-side
  useEffect(() => {
    if (orderHistory.length === 0) return;
    
    const EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
    const expiredOrders = orderHistory.filter((order) => {
      const status = normalizeStatus(order.status);
      if (!PAYABLE_STATUSES.includes(status)) return false;
      if (!order.date) return false;
      const created = new Date(order.date).getTime();
      return Date.now() - created >= EXPIRY_MS;
    });

    if (expiredOrders.length > 0) {
      // Update local state immediately for UI feedback
      setOrderHistory((prev) =>
        prev.map((order) => {
          const isExpired = expiredOrders.some((e) => e.ref === order.ref);
          return isExpired ? { ...order, status: 'CANCELLED' } : order;
        })
      );

      // Trigger server-side cancel for each expired order (fire and forget)
      expiredOrders.forEach((order) => {
        cancelOrder(order.ref).catch((err) =>
          console.error(`[auto-cancel] Failed to cancel expired order ${order.ref}:`, err)
        );
      });
    }
  }, [orderHistory.length]); // Only run when history count changes (not on every render)

  const handleSaveProfile = async (data: Partial<typeof orderData> & { savedAddresses?: SavedAddress[] }) => {
    if (!session?.user?.email) {
      showToast('error', t.misc.pleaseLogin);
      return;
    }

    setSavingProfile(true);
    const sanitized = {
      name: data.name ? data.name.replace(/[^\u0E00-\u0E7F\s]/g, '').trim() : orderData.name,
      phone: data.phone ? onlyDigitsPhone(data.phone) : orderData.phone,
      address: data.address ? data.address.trim() : orderData.address,
      instagram: data.instagram ? data.instagram.trim() : orderData.instagram,
      profileImage: data.profileImage !== undefined ? (data.profileImage || '') : orderData.profileImage,
    };
    setOrderData((prev) => ({ ...prev, ...sanitized }));

    // Update saved addresses if provided
    if (data.savedAddresses) {
      setSavedAddresses(data.savedAddresses);
    }

    try {
      await saveProfileApi(session.user.email, {
        name: sanitized.name,
        phone: sanitized.phone,
        address: sanitized.address,
        instagram: sanitized.instagram,
        profileImage: sanitized.profileImage,
        ...(data.savedAddresses && { savedAddresses: data.savedAddresses }),
      });

      showToast('success', t.profile.savedProfile);
      setShowProfileModal(false);
      if (pendingCheckout && isThaiText(sanitized.name) && sanitized.phone && sanitized.instagram) {
        setShowOrderDialog(true);
        setPendingCheckout(false);
      }
    } catch (error: any) {
      showToast('error', error.message || t.profile.saveProfileFailed);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab as any);
    if (tab === 'home') {
      setSidebarOpen(false);
      setShowCart(false);
      setShowHistoryDialog(false);
    } else if (tab === 'cart') {
      setShowCart(true);
      setShowHistoryDialog(false);
    } else if (tab === 'history') {
      setShowHistoryDialog(true);
      setShowCart(false);
      // Only load if history is empty (first time or needs refresh)
      if (orderHistory.length === 0) {
        setHistoryCursor(null);
        setHistoryHasMore(false);
        loadOrderHistory();
      }
    } else if (tab === 'profile') {
      setSidebarOpen(false);
      setShowProfileModal(true);
    } else if (tab === 'chat') {
      // Show chat selection menu - do nothing here, handled by onClick
      return;
    }
  };


  const productImages = useMemo(() => {
    const images = (selectedProduct?.images || []).filter(Boolean);
    const coverImage = selectedProduct?.coverImage;
    if (coverImage && images.includes(coverImage)) {
      // เรียงให้ coverImage ขึ้นก่อน
      return [coverImage, ...images.filter(img => img !== coverImage)];
    }
    return images;
  }, [selectedProduct]);
  const totalImages = productImages.length;
  const displaySizes = useMemo(() => {
    if (!selectedProduct) return [] as string[];
    const sizeKeys = Object.keys(selectedProduct.sizePricing || {});
    if (sizeKeys.length === 0) return [t.common.freeSize];
    // Sort sizes according to standard size order (XS, S, M, L, XL, etc.)
    return sizeKeys.sort((a, b) => {
      const indexA = SIZES.indexOf(a);
      const indexB = SIZES.indexOf(b);
      // If both sizes are in SIZES array, sort by their index
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      // If only one is in SIZES, prioritize it
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      // Otherwise sort alphabetically
      return a.localeCompare(b);
    });
  }, [selectedProduct]);

  const sizeChartRows = useMemo(() => {
    if (!selectedProduct) return [] as { size: string; price: number }[];
    return displaySizes.map((size) => ({
      size,
      price: selectedProduct.sizePricing?.[size] ?? selectedProduct.basePrice,
    }));
  }, [displaySizes, selectedProduct]);

  // All products (including non-active for showing status badges)
  // Group by category first, then subType/type
  // In dev mode, merge test products with real products
  const allGroupedProducts = useMemo(() => {
    const realProducts = config?.products || [];
    const items = isDev ? [...devTestProducts, ...realProducts] : realProducts;
    const map: Record<string, Product[]> = {};
    items.forEach((p) => {
      // Use category if available, otherwise infer from type
      const category = (p as any).category || getCategoryFromType(p.type);
      if (!map[category]) map[category] = [];
      map[category].push(p);
    });
    return map;
  }, [config?.products, isDev, devTestProducts]);

  // Only active products (for counting and filtering)
  const groupedProducts = useMemo(() => {
    const realProducts = config?.products || [];
    const items = isDev ? [...devTestProducts, ...realProducts] : realProducts;
    const activeItems = items.filter((p) => isProductCurrentlyOpen(p));
    const map: Record<string, Product[]> = {};
    activeItems.forEach((p) => {
      const category = (p as any).category || getCategoryFromType(p.type);
      if (!map[category]) map[category] = [];
      map[category].push(p);
    });
    return map;
  }, [config?.products, isDev, devTestProducts]);

  const totalProductCount = useMemo(() => Object.values(allGroupedProducts).reduce((acc, items) => acc + items.length, 0), [allGroupedProducts]);
  const activeProductCount = useMemo(() => Object.values(groupedProducts).reduce((acc, items) => acc + items.length, 0), [groupedProducts]);

  const priceBounds = useMemo(() => {
    const all = Object.values(allGroupedProducts).flat();
    if (all.length === 0) return { min: 0, max: 0 };
    const prices = all.map(getBasePrice);
    return { min: Math.min(...prices), max: Math.max(...prices) };
  }, [allGroupedProducts]);

  useEffect(() => {
    if (priceBounds.max === 0 && priceBounds.min === 0) return;
    setPriceRange([priceBounds.min, priceBounds.max]);
  }, [priceBounds.min, priceBounds.max]);

  const categoryMeta = useMemo(
    () => [
      { key: 'ALL', label: t.common.all, count: totalProductCount, icon: '' },
      ...Object.entries(allGroupedProducts).map(([key, items]) => ({ 
        key, 
        label: (t.category as Record<string, string>)[key] || getCategoryLabel(key, lang) || TYPE_LABELS_I18N[key] || key || t.type.OTHER, 
        count: items.length,
        icon: getCategoryIcon(key),
      })),
    ],
    [totalProductCount, allGroupedProducts]
  );

  // Filter products - show all products including inactive ones (with status badges)
  const filteredGroupedProducts = useMemo(() => {
    const term = productSearch.trim().toLowerCase();
    const entries = Object.entries(allGroupedProducts)
      .filter(([key]) => categoryFilter === 'ALL' || key === categoryFilter)
      .map(([key, items]) => {
        const bySearch = term ? items.filter((p) => {
          const name = getProductName(p, lang).toLowerCase();
          const nameAlt = p.name?.toLowerCase() || ''; // always search Thai name too
          const desc = getProductDescription(p, lang).toLowerCase();
          const type = (TYPE_LABELS_I18N[p.type] || p.type || '').toLowerCase();
          const cat = ((t.category as Record<string, string>)[key] || getCategoryLabel(key, lang) || key || '').toLowerCase();
          return name.includes(term) || nameAlt.includes(term) || desc.includes(term) || type.includes(term) || cat.includes(term);
        }) : items;
        const byPrice = bySearch.filter((p) => {
          const price = getBasePrice(p);
          return priceRange[0] <= price && price <= priceRange[1];
        });
        // Filter by availability
        const byAvailability = showOnlyAvailable 
          ? byPrice.filter((p) => getProductStatus(p) === 'OPEN')
          : byPrice;
        // Filter by wishlist if wishlist drawer is open
        return [key, byAvailability] as const;
      })
      .filter(([, items]) => items.length > 0);
    
    // Apply sorting
    if (sortBy !== 'default') {
      for (const entry of entries) {
        const items = [...entry[1]];
        items.sort((a, b) => {
          switch (sortBy) {
            case 'price-low': return getBasePrice(a) - getBasePrice(b);
            case 'price-high': return getBasePrice(b) - getBasePrice(a);
            case 'newest': return new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime();
            case 'name': return getProductName(a, lang).localeCompare(getProductName(b, lang), lang === 'th' ? 'th' : 'en');
            default: return 0;
          }
        });
        (entry as any)[1] = items;
      }
    }
    
    return Object.fromEntries(entries);
  }, [categoryFilter, allGroupedProducts, priceRange, productSearch, sortBy, showOnlyAvailable]);

  const filteredProductCount = useMemo(
    () => Object.values(filteredGroupedProducts).reduce((acc, items) => acc + items.length, 0),
    [filteredGroupedProducts]
  );

  if (!mounted || loading) {
    return <LoadingScreen />;
  }

  if (status === 'unauthenticated') {
    // Detect if running in WebView (LINE, Facebook, Instagram, etc.)
    const isWebView = typeof window !== 'undefined' && (
      /FBAN|FBAV|Instagram|Line\/|KAKAOTALK|Snapchat|Twitter/i.test(navigator.userAgent) ||
      /WebView|wv/i.test(navigator.userAgent) ||
      (window as any).ReactNativeWebView !== undefined
    );
    
    // Get current URL for copy
    const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
    
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'var(--background)' }}>
        <AppBar
          position="sticky"
          elevation={0}
          sx={{ bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.65)' : 'rgba(255,255,255,0.75)', borderBottom: (theme) => `1px solid ${theme.palette.divider}`, backdropFilter: 'blur(14px)' }}
        >
          <Toolbar>
            <BrandMark />
            <Box sx={{ flexGrow: 1 }} />
            <LanguageToggle size="small" />
            <ThemeToggle size="small" />
          </Toolbar>
        </AppBar>

        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
          <Container maxWidth="sm">
            {/* WebView Warning Banner */}
            {isWebView && (
              <Box
                sx={{
                  mb: 3,
                  p: 2.5,
                  borderRadius: '16px',
                  background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(239, 68, 68, 0.1) 100%)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                  <Box sx={{
                    width: 40,
                    height: 40,
                    borderRadius: '12px',
                    bgcolor: 'rgba(245, 158, 11, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <AlertTriangle size={22} color="#ff9f0a" />
                  </Box>
                  <Box>
                    <Typography sx={{ color: 'var(--warning)', fontWeight: 700, fontSize: '0.95rem', mb: 0.5 }}>
                      {t.nav.openInBrowser}
                    </Typography>
                    <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.8rem', lineHeight: 1.6 }}>
                      {t.nav.openInBrowserDesc}
                    </Typography>
                    <Button
                      size="small"
                      onClick={() => {
                        navigator.clipboard?.writeText(currentUrl);
                        showToast('info', t.nav.linkCopied);
                      }}
                      sx={{
                        mt: 1.5,
                        color: 'var(--warning)',
                        fontSize: '0.75rem',
                        textTransform: 'none',
                        '&:hover': { bgcolor: 'rgba(245, 158, 11, 0.1)' },
                      }}
                      startIcon={<Copy size={14} />}
                    >
                      {t.nav.copyLink}
                    </Button>
                  </Box>
                </Box>
              </Box>
            )}
            
            <Card 
              sx={{ 
                bgcolor: 'var(--surface)', 
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(0,113,227, 0.2)', 
                borderRadius: '24px',
                p: { xs: 3, sm: 5 }, 
                textAlign: 'center',
                boxShadow: (theme: any) => theme.palette.mode === 'dark' 
                  ? '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(0,113,227, 0.1)'
                  : '0 25px 50px -12px rgba(0, 0, 0, 0.1), 0 0 40px rgba(0,113,227, 0.06)',
              }}
            >
              {/* Web Logo */}
              <Box
                sx={{
                  width: 100,
                  height: 100,
                  position: 'relative',
                  borderRadius: '24px',
                  overflow: 'hidden',
                  margin: '0 auto 24px',
                  boxShadow: '0 10px 30px rgba(0,113,227, 0.3)',
                  border: '2px solid rgba(0,113,227, 0.3)',
                }}
              >
                <Image
                  src="/logo.png"
                  alt="PSU SCC Shop Logo"
                  fill
                  sizes="64px"
                  className="theme-logo"
                  style={{ objectFit: 'contain' }}
                  priority
                />
              </Box>
              
              <Typography 
                variant="h4" 
                sx={{ 
                  fontWeight: 800, 
                  mb: 1, 
                  color: 'var(--foreground)',
                  background: (theme: any) => theme.palette.mode === 'dark' 
                    ? 'linear-gradient(135deg, #f5f5f7 0%, #64d2ff 50%, #0071e3 100%)'
                    : 'linear-gradient(135deg, #0071e3 0%, #0071e3 50%, #0071e3 100%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                SCC Shop
              </Typography>
              <Typography sx={{ color: 'var(--text-muted)', mb: 1, fontSize: '1rem' }}>
                {t.nav.shopTitle}
              </Typography>

              <Typography sx={{ color: 'var(--text-muted)', mb: 4, fontSize: '0.85rem', lineHeight: 1.7, textAlign: 'center', maxWidth: 400, mx: 'auto' }}>
                {t.nav.appDescription}
              </Typography>
              
              <Divider sx={{ borderColor: 'var(--glass-border)', mb: 4 }} />
              
              <Typography sx={{ color: 'var(--text-muted)', mb: 3, fontSize: '0.9rem' }}>
                {t.nav.loginToShop}
              </Typography>
              
              {/* Google Sign In */}
              <Button
                variant="contained"
                size="large"
                onClick={() => signIn('google', { redirect: true, callbackUrl: '/', prompt: 'select_account' })}
                sx={{
                  background: '#ffffff',
                  color: '#1d1d1f',
                  width: '100%',
                  py: 1.5,
                  borderRadius: '14px',
                  fontWeight: 600,
                  fontSize: '1rem',
                  textTransform: 'none',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 1.5,
                  '&:hover': {
                    background: '#f5f5f7',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 8px 25px rgba(0,0,0,0.2)',
                  },
                  '&:active': {
                    transform: 'translateY(0)',
                  },
                }}
              >
                {/* Google Logo SVG */}
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                {`${t.nav.loginWith} Google`}
              </Button>

              {/* Microsoft Sign In */}
              {availableProviders.includes('azure-ad') && <Button
                variant="contained"
                size="large"
                onClick={() => signIn('azure-ad', { redirect: true, callbackUrl: '/' })}
                sx={{
                  background: '#2f2f2f',
                  color: '#ffffff',
                  width: '100%',
                  mt: 1.5,
                  py: 1.5,
                  borderRadius: '14px',
                  fontWeight: 600,
                  fontSize: '1rem',
                  textTransform: 'none',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 1.5,
                  '&:hover': {
                    background: '#404040',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 8px 25px rgba(0,0,0,0.2)',
                  },
                  '&:active': { transform: 'translateY(0)' },
                }}
              >
                <svg width="20" height="20" viewBox="0 0 23 23">
                  <path fill="#f35325" d="M1 1h10v10H1z"/>
                  <path fill="#81bc06" d="M12 1h10v10H12z"/>
                  <path fill="#05a6f0" d="M1 12h10v10H1z"/>
                  <path fill="#ffba08" d="M12 12h10v10H12z"/>
                </svg>
                {`${t.nav.loginWith} Microsoft`}
              </Button>}

              {/* Facebook Sign In */}
              {availableProviders.includes('facebook') && <Button
                variant="contained"
                size="large"
                onClick={() => signIn('facebook', { redirect: true, callbackUrl: '/' })}
                sx={{
                  background: '#1877F2',
                  color: '#ffffff',
                  width: '100%',
                  mt: 1.5,
                  py: 1.5,
                  borderRadius: '14px',
                  fontWeight: 600,
                  fontSize: '1rem',
                  textTransform: 'none',
                  boxShadow: '0 4px 14px rgba(24,119,242,0.3)',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 1.5,
                  '&:hover': {
                    background: '#166FE5',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 8px 25px rgba(24,119,242,0.4)',
                  },
                  '&:active': { transform: 'translateY(0)' },
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                {`${t.nav.loginWith} Facebook`}
              </Button>}

              {/* Apple Sign In */}
              {availableProviders.includes('apple') && <Button
                variant="contained"
                size="large"
                onClick={() => signIn('apple', { redirect: true, callbackUrl: '/' })}
                sx={{
                  background: '#000000',
                  color: '#ffffff',
                  width: '100%',
                  mt: 1.5,
                  py: 1.5,
                  borderRadius: '14px',
                  fontWeight: 600,
                  fontSize: '1rem',
                  textTransform: 'none',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 1.5,
                  '&:hover': {
                    background: '#1a1a1a',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 8px 25px rgba(0,0,0,0.35)',
                  },
                  '&:active': { transform: 'translateY(0)' },
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                  <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.52-3.23 0-1.44.62-2.2.44-3.06-.4C4.24 16.76 4.89 10.87 8.88 10.6c1.24.07 2.1.72 2.83.78.99-.2 1.94-.78 3-.84 1.28-.08 2.25.48 2.88 1.22-2.65 1.58-2.02 5.07.36 6.04-.47 1.2-.97 2.4-1.9 3.48zM12.07 10.5c-.16-2.3 1.74-4.2 3.93-4.5.32 2.5-2.25 4.64-3.93 4.5z"/>
                </svg>
                {`${t.nav.loginWith} Apple`}
              </Button>}

              {/* LINE Sign In */}
              {availableProviders.includes('line') && <Button
                variant="contained"
                size="large"
                onClick={() => signIn('line', { redirect: true, callbackUrl: '/' })}
                sx={{
                  background: '#06C755',
                  color: '#ffffff',
                  width: '100%',
                  mt: 1.5,
                  py: 1.5,
                  borderRadius: '14px',
                  fontWeight: 600,
                  fontSize: '1rem',
                  textTransform: 'none',
                  boxShadow: '0 4px 14px rgba(6,199,85,0.3)',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 1.5,
                  '&:hover': {
                    background: '#05B34C',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 8px 25px rgba(6,199,85,0.4)',
                  },
                  '&:active': { transform: 'translateY(0)' },
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                  <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .348-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .349-.281.63-.63.63h-2.386c-.348 0-.63-.281-.63-.63V8.108c0-.348.282-.63.63-.63h2.386c.349 0 .63.282.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .349-.282.63-.631.63-.345 0-.627-.281-.627-.63V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.348.279-.63.63-.63.346 0 .627.282.627.63v4.771zm-5.741 0c0 .349-.282.63-.631.63-.345 0-.627-.281-.627-.63V8.108c0-.348.282-.63.627-.63.349 0 .631.282.631.63v4.771zm-2.466.63H4.917c-.348 0-.63-.281-.63-.63V8.108c0-.348.282-.63.63-.63.349 0 .63.282.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .349-.281.63-.629.63M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
                </svg>
                {`${t.nav.loginWith} LINE`}
              </Button>}
              
              {/* Passkey Sign In */}
              <Box sx={{ mt: 2 }}>
                <Divider sx={{ borderColor: 'var(--glass-border)', mb: 2, '&::before, &::after': { borderColor: 'var(--glass-border)' } }}>
                  <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.75rem', px: 1 }}>
                    {lang === 'en' ? 'or' : 'หรือ'}
                  </Typography>
                </Divider>
                <PasskeyLoginButton />
              </Box>

              <Typography sx={{ color: 'var(--text-muted)', mt: 4, fontSize: '0.75rem', lineHeight: 1.8 }}>
                {t.nav.termsAgreement}{' '}
                <Link href="/terms" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>
                  {lang === 'en' ? 'Terms of Service' : 'ข้อกำหนดการใช้งาน'}
                </Link>
                {' & '}
                <Link href="/privacy" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>
                  {lang === 'en' ? 'Privacy Policy' : 'นโยบายความเป็นส่วนตัว'}
                </Link>
              </Typography>
            </Card>
          </Container>
        </Box>

        {/* Footer with links — visible without login */}
        <Box sx={{ py: 3, textAlign: 'center', borderTop: '1px solid var(--glass-border)' }}>
          <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.75rem', mb: 1 }}>
            © {new Date().getFullYear()} Science Computer Club, Faculty of Science, Prince of Songkla University
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
            <Link href="/privacy" style={{ color: 'var(--primary)', fontSize: '0.78rem', textDecoration: 'underline' }}>
              {lang === 'en' ? 'Privacy Policy' : 'นโยบายความเป็นส่วนตัว'}
            </Link>
            <Link href="/terms" style={{ color: 'var(--primary)', fontSize: '0.78rem', textDecoration: 'underline' }}>
              {lang === 'en' ? 'Terms of Service' : 'ข้อกำหนดการใช้งาน'}
            </Link>
          </Box>
        </Box>
      </Box>
    );
  }

  // Check if there are enabled announcements for padding adjustment
  const hasEnabledAnnouncements = (announcements?.filter(a => a.enabled)?.length ?? 0) > 0;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'var(--background)', pb: { xs: 9, md: 0 } }}>
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.65)' : 'rgba(255,255,255,0.75)',
          borderBottom: (theme) => `1px solid ${theme.palette.mode === 'dark' ? 'var(--glass-bg)' : 'rgba(0,0,0,0.06)'}`,
          backdropFilter: 'blur(14px)',
          boxShadow: (theme) => theme.palette.mode === 'dark' ? '0 18px 50px rgba(0,0,0,0.35)' : '0 4px 20px rgba(0,0,0,0.04)',
          color: 'var(--foreground)',
          transform: hideNavBars ? 'translateY(-110%)' : 'translateY(0)',
          opacity: hideNavBars ? 0 : 1,
          transition: 'transform 0.32s ease, opacity 0.28s ease',
          position: 'sticky',
          top: 0,
          zIndex: 1200,
        }}
      >
        <Toolbar>
          <BrandMark />
          <Box sx={{ flexGrow: 1 }} />
          <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 1, mr: 2 }}>
            <Button
              variant={showSearchBar ? 'contained' : 'outlined'}
              startIcon={<Search size={18} />}
              onClick={() => setShowSearchBar((v) => !v)}
              sx={{
                color: (theme) => showSearchBar ? '#fff' : theme.palette.text.primary,
                borderColor: (theme) => showSearchBar ? 'transparent' : theme.palette.divider,
                background: (theme) => showSearchBar ? 'linear-gradient(135deg, #0071e3 0%, #64d2ff 100%)' : (theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.04)'),
                textTransform: 'none',
                fontWeight: 700,
                borderRadius: 1.5,
              }}
            >
              {t.nav.search}
            </Button>
          </Box>
          <IconButton
            onClick={() => setShowSearchBar((v) => !v)}
            sx={{ mr: 1, display: { xs: 'flex', md: 'none' }, color: 'var(--foreground)', alignItems: 'center', gap: 0.5 }}
          >
            <Search size={22} />
          </IconButton>
          {isLiveActive && (
            <IconButton
              onClick={openLiveStream}
              sx={{
                mr: 0.5,
                display: { xs: 'flex', md: 'none' },
                color: '#fff',
                bgcolor: '#ef4444',
                width: 34,
                height: 34,
                animation: 'navLivePulse 2s ease-in-out infinite',
                '@keyframes navLivePulse': {
                  '0%, 100%': { boxShadow: '0 0 0 0 rgba(239,68,68,0.4)' },
                  '50%': { boxShadow: '0 0 0 6px rgba(239,68,68,0)' },
                },
                '&:hover': { bgcolor: '#dc2626' },
              }}
            >
              <Radio size={18} />
            </IconButton>
          )}
          <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 1, mr: 2 }}>
            <Button
              variant="outlined"
              startIcon={<Home size={18} />}
              onClick={() => handleTabChange('home')}
              sx={{
                color: (theme) => activeTab === 'home' ? '#0071e3' : theme.palette.text.primary,
                borderColor: (theme) => activeTab === 'home' ? 'rgba(0,113,227,0.6)' : theme.palette.divider,
                backgroundColor: activeTab === 'home' ? 'rgba(0,113,227,0.12)' : 'transparent',
                textTransform: 'none',
                borderRadius: 2,
                px: 1.5,
                py: 0.5,
                height: 40,
                '&:hover': { borderColor: '#0071e3', backgroundColor: 'rgba(0,113,227,0.16)' },
              }}
            >
              {t.nav.home}
            </Button>
            <Button
              variant="outlined"
              startIcon={<History size={18} />}
              onClick={() => handleTabChange('history')}
              sx={{
                color: (theme) => activeTab === 'history' ? '#0071e3' : theme.palette.text.primary,
                borderColor: (theme) => activeTab === 'history' ? 'rgba(0,113,227,0.6)' : theme.palette.divider,
                backgroundColor: activeTab === 'history' ? 'rgba(0,113,227,0.12)' : 'transparent',
                textTransform: 'none',
                borderRadius: 2,
                px: 1.5,
                py: 0.5,
                height: 40,
                '&:hover': { borderColor: '#0071e3', backgroundColor: 'rgba(0,113,227,0.16)' },
              }}
            >
              {t.nav.history}
            </Button>
            <Button
              variant="outlined"
              startIcon={<User size={18} />}
              onClick={() => handleTabChange('profile')}
              sx={{
                color: (theme) => activeTab === 'profile' ? '#0071e3' : theme.palette.text.primary,
                borderColor: (theme) => activeTab === 'profile' ? 'rgba(0,113,227,0.6)' : theme.palette.divider,
                backgroundColor: activeTab === 'profile' ? 'rgba(0,113,227,0.12)' : 'transparent',
                textTransform: 'none',
                borderRadius: 2,
                px: 1.5,
                py: 0.5,
                height: 40,
                '&:hover': { borderColor: '#0071e3', backgroundColor: 'rgba(0,113,227,0.16)' },
              }}
            >
              {t.nav.profile}
            </Button>
            <Button
              variant="outlined"
              startIcon={(
                <Badge badgeContent={cart.length} color="error">
                  <ShoppingCart size={18} />
                </Badge>
              )}
              onClick={() => handleTabChange('cart')}
              sx={{
                color: (theme) => activeTab === 'cart' ? '#0071e3' : theme.palette.text.primary,
                borderColor: (theme) => activeTab === 'cart' ? 'rgba(0,113,227,0.6)' : theme.palette.divider,
                backgroundColor: activeTab === 'cart' ? 'rgba(0,113,227,0.12)' : 'transparent',
                textTransform: 'none',
                borderRadius: 2,
                px: 1.5,
                py: 0.5,
                height: 40,
                '&:hover': { borderColor: '#0071e3', backgroundColor: 'rgba(0,113,227,0.16)' },
              }}
            >
              {t.nav.cart}
            </Button>
            {isLiveActive && (
              <Button
                variant="contained"
                startIcon={<Radio size={18} />}
                onClick={openLiveStream}
                sx={{
                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  color: '#fff',
                  textTransform: 'none',
                  borderRadius: 2,
                  px: 1.5,
                  py: 0.5,
                  height: 40,
                  fontWeight: 700,
                  position: 'relative',
                  overflow: 'visible',
                  animation: 'navLivePulse 2s ease-in-out infinite',
                  '@keyframes navLivePulse': {
                    '0%, 100%': { boxShadow: '0 0 0 0 rgba(239,68,68,0.4)' },
                    '50%': { boxShadow: '0 0 0 8px rgba(239,68,68,0)' },
                  },
                  '&:hover': { background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)' },
                  '&::before': {
                    content: '""',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: '#fff',
                    position: 'absolute',
                    top: 6,
                    right: 6,
                    animation: 'navLiveDot 1.5s ease-in-out infinite',
                  },
                  '@keyframes navLiveDot': {
                    '0%, 100%': { opacity: 1 },
                    '50%': { opacity: 0.3 },
                  },
                }}
              >
                {t.nav.live}
              </Button>
            )}
          </Box>
          {session && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <LanguageToggle size="small" />
              <ThemeToggle size="small" />
              <Avatar src={orderData.profileImage || session?.user?.image || ''} sx={{ width: 32, height: 32, cursor: 'pointer' }} onClick={() => setSidebarOpen(true)} />
            </Box>
          )}
          {!session && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <LanguageToggle size="small" />
              <ThemeToggle size="small" />
            </Box>
          )}
        </Toolbar>
        {showSearchBar && (
          <Box sx={{ px: { xs: 1.5, md: 3 }, pb: 2, pt: 1 }}>
            <Box sx={{
              borderRadius: '20px',
              bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(15,15,15,0.98)' : 'rgba(255,255,255,0.99)',
              border: '1px solid',
              borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
              boxShadow: (theme) => theme.palette.mode === 'dark' ? '0 8px 32px rgba(0,0,0,0.5)' : '0 8px 32px rgba(0,0,0,0.1)',
              overflow: 'hidden',
            }}>
              {/* Search Input */}
              <Box sx={{ p: 2, pb: 1.5 }}>
                <TextField
                  autoFocus
                  size="small"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Escape') { setProductSearch(''); setShowSearchBar(false); } }}
                  placeholder={t.search.placeholder}
                  inputProps={{ maxLength: 50 }}
                  fullWidth
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: 'var(--foreground)',
                      background: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                      borderRadius: '14px',
                      fontSize: '0.95rem',
                      '& fieldset': { border: 'none' },
                    },
                    '& .MuiInputBase-input::placeholder': { color: 'text.disabled', opacity: 0.7 },
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search size={20} color="var(--text-muted)" />
                      </InputAdornment>
                    ),
                    endAdornment: productSearch ? (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setProductSearch('')} sx={{ color: 'var(--text-muted)' }}>
                          <X size={16} />
                        </IconButton>
                      </InputAdornment>
                    ) : (
                      <InputAdornment position="end">
                        <Typography sx={{ fontSize: '0.65rem', color: 'var(--text-muted)', opacity: 0.5 }}>ESC</Typography>
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>

              {/* Category Quick Chips - always visible */}
              <Box sx={{ px: 2, pb: 1.5, display: 'flex', gap: 0.6, overflowX: 'auto', '&::-webkit-scrollbar': { display: 'none' } }}>
                {categoryMeta.slice(0, 8).map((cat) => (
                  <Chip
                    key={cat.key}
                    label={`${cat.icon ? cat.icon + ' ' : ''}${cat.label}`}
                    size="small"
                    onClick={() => {
                      setCategoryFilter(prev => prev === cat.key ? 'ALL' : cat.key);
                      if (!productSearch) setProductSearch('');
                    }}
                    sx={{
                      bgcolor: categoryFilter === cat.key ? 'rgba(0,113,227,0.15)' : 'transparent',
                      color: categoryFilter === cat.key ? '#0071e3' : 'var(--text-muted)',
                      border: '1px solid',
                      borderColor: categoryFilter === cat.key ? 'rgba(0,113,227,0.3)' : (theme: any) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      height: 28,
                      flexShrink: 0,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      '&:hover': { bgcolor: 'rgba(0,113,227,0.1)', borderColor: 'rgba(0,113,227,0.2)' },
                    }}
                  />
                ))}
              </Box>

              {/* Sort & Filter Controls */}
              <Box sx={{ px: 2, pb: 1.5, display: 'flex', gap: 0.6, alignItems: 'center', overflowX: 'auto', '&::-webkit-scrollbar': { display: 'none' } }}>
                {/* Sort dropdown chips */}
                {([
                  { key: 'default' as const, label: t.search.sortDefault },
                  { key: 'price-low' as const, label: t.search.sortPriceLow },
                  { key: 'price-high' as const, label: t.search.sortPriceHigh },
                  { key: 'newest' as const, label: t.search.sortNewest },
                  { key: 'name' as const, label: t.search.sortName },
                ] as const).map((opt) => (
                  <Chip
                    key={opt.key}
                    icon={<ArrowUpDown size={10} />}
                    label={opt.label}
                    size="small"
                    onClick={() => setSortBy(opt.key)}
                    sx={{
                      bgcolor: sortBy === opt.key ? 'rgba(52,199,89,0.15)' : 'transparent',
                      color: sortBy === opt.key ? '#34c759' : 'var(--text-muted)',
                      border: '1px solid',
                      borderColor: sortBy === opt.key ? 'rgba(52,199,89,0.3)' : (theme: any) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                      fontSize: '0.68rem',
                      fontWeight: 600,
                      height: 26,
                      flexShrink: 0,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      '& .MuiChip-icon': { color: 'inherit', ml: 0.5 },
                      '&:hover': { bgcolor: 'rgba(52,199,89,0.1)' },
                    }}
                  />
                ))}
                <Box sx={{ width: 1, height: 20, bgcolor: 'var(--glass-border)', flexShrink: 0, mx: 0.3 }} />
                {/* Available only toggle */}
                <Chip
                  icon={<Eye size={10} />}
                  label={t.search.filterAvailable}
                  size="small"
                  onClick={() => setShowOnlyAvailable(!showOnlyAvailable)}
                  sx={{
                    bgcolor: showOnlyAvailable ? 'rgba(0,113,227,0.15)' : 'transparent',
                    color: showOnlyAvailable ? '#0071e3' : 'var(--text-muted)',
                    border: '1px solid',
                    borderColor: showOnlyAvailable ? 'rgba(0,113,227,0.3)' : (theme: any) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                    fontSize: '0.68rem',
                    fontWeight: 600,
                    height: 26,
                    flexShrink: 0,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    '& .MuiChip-icon': { color: 'inherit', ml: 0.5 },
                    '&:hover': { bgcolor: 'rgba(0,113,227,0.1)' },
                  }}
                />
              </Box>

              {/* Instant Search Results Preview */}
              {productSearch.trim() && (() => {
                const allResults = Object.values(filteredGroupedProducts).flat();
                const previewItems = allResults.slice(0, 5);
                return (
                  <Box sx={{ borderTop: '1px solid', borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }}>
                    {/* Results header */}
                    <Box sx={{ px: 2, pt: 1.5, pb: 0.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {t.search.results}
                      </Typography>
                      <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {allResults.length} {t.common.items}
                      </Typography>
                    </Box>

                    {previewItems.length > 0 ? (
                      <Box sx={{ px: 1, pb: 1.5 }}>
                        {previewItems.map((product) => {
                          const img = product.coverImage || product.images?.[0];
                          const eventDisc = getEventDiscount(product.id, config?.events as ShopEvent[] | undefined);
                          return (
                            <Box
                              key={product.id}
                              onClick={() => {
                                if (isProductCurrentlyOpen(product)) {
                                  handleSelectProduct(product);
                                  setShowSearchBar(false);
                                  setProductSearch('');
                                }
                              }}
                              sx={{
                                display: 'flex', alignItems: 'center', gap: 1.5,
                                px: 1.5, py: 1,
                                borderRadius: '12px',
                                cursor: isProductCurrentlyOpen(product) ? 'pointer' : 'default',
                                opacity: isProductCurrentlyOpen(product) ? 1 : 0.5,
                                transition: 'all 0.15s ease',
                                '&:hover': { bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)' },
                              }}
                            >
                              {/* Thumbnail */}
                              <Box sx={{
                                width: 44, height: 44, borderRadius: '10px', flexShrink: 0,
                                bgcolor: 'var(--surface-2)', overflow: 'hidden',
                                border: '1px solid', borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}>
                                {img ? (
                                  <img src={img} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                                ) : (
                                  <Package size={18} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
                                )}
                              </Box>
                              {/* Info */}
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {getProductName(product, lang)}
                                </Typography>
                                <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {TYPE_LABELS_I18N[product.type] || product.type}
                                </Typography>
                              </Box>
                              {/* Price */}
                              <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                                {eventDisc ? (
                                  <>
                                    <Typography sx={{ fontSize: '0.65rem', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                                      ฿{getBasePrice(product).toLocaleString()}
                                    </Typography>
                                    <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#ff453a' }}>
                                      ฿{eventDisc.discountedPrice(getBasePrice(product)).toLocaleString()}
                                    </Typography>
                                  </>
                                ) : (
                                  <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#34c759' }}>
                                    ฿{getBasePrice(product).toLocaleString()}
                                  </Typography>
                                )}
                              </Box>
                            </Box>
                          );
                        })}
                        {allResults.length > 5 && (
                          <Typography sx={{ textAlign: 'center', fontSize: '0.72rem', color: '#0071e3', fontWeight: 600, py: 1, cursor: 'pointer' }}
                            onClick={() => { setShowSearchBar(false); document.getElementById('product-grid')?.scrollIntoView({ behavior: 'smooth' }); }}
                          >
                            {t.search.viewAll} {allResults.length} {t.common.items} →
                          </Typography>
                        )}
                      </Box>
                    ) : (
                      <Box sx={{ textAlign: 'center', py: 3, px: 2 }}>
                        <Search size={32} style={{ color: 'var(--text-muted)', opacity: 0.2, marginBottom: 8 }} />
                        <Typography sx={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                          {t.search.noResults}
                        </Typography>
                        <Typography sx={{ fontSize: '0.72rem', color: 'var(--text-muted)', opacity: 0.6, mt: 0.5 }}>
                          {t.search.tryOther}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                );
              })()}

              {/* No search - show suggestions */}
              {!productSearch.trim() && totalProductCount > 0 && (
                <Box sx={{ borderTop: '1px solid', borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', px: 2, py: 1.5 }}>
                  <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1 }}>
                    {t.search.popular}
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6 }}>
                    {[t.type.JERSEY, t.type.TSHIRT, t.type.STICKER, t.type.KEYCHAIN, t.type.CAP].filter(s => {
                      const term = s.toLowerCase();
                      return Object.values(allGroupedProducts).flat().some(p => 
                        p.name?.toLowerCase().includes(term) || (TYPE_LABELS_I18N[p.type] || '').toLowerCase().includes(term)
                      );
                    }).map(suggestion => (
                      <Chip
                        key={suggestion}
                        label={suggestion}
                        size="small"
                        onClick={() => setProductSearch(suggestion)}
                        sx={{
                          bgcolor: 'transparent',
                          color: 'var(--text-muted)',
                          border: '1px solid',
                          borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                          fontSize: '0.72rem',
                          fontWeight: 500,
                          height: 26,
                          cursor: 'pointer',
                          '&:hover': { bgcolor: 'rgba(0,113,227,0.08)', color: '#0071e3' },
                        }}
                      />
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
          </Box>
        )}
      </AppBar>

      {/* Shop Status Banner - Shows different states (not open, coming soon, order ended, etc.) */}
      <ShopStatusBanner 
        isOpen={isShopOpen}
        closeDate={config?.closeDate}
        openDate={config?.openDate}
        customMessage={config?.closedMessage}
      />

      {/* Modern Announcement Bar */}
      <AnnouncementBar
        announcements={announcements || []}
        history={announcementHistory}
        socialMediaNews={config?.socialMediaNews}
        onProductClick={(productId) => {
          const products = config?.products || [];
          let product = null;
          if (productId && productId !== '__default__') {
            product = products.find(p => p.id === productId)
              || products.find(p => p.id?.includes(productId) || productId?.includes(p.id));
          }
          // Fallback: open first product if only one, or scroll to grid
          if (!product && products.length > 0) {
            product = products[0];
          }
          if (product) {
            handleSelectProduct(product);
          } else {
            document.getElementById('product-grid')?.scrollIntoView({ behavior: 'smooth' });
          }
        }}
      />

      {/* Event / Promotion Banners */}
      <EventBanner
        events={config?.events || []}
        onEventClick={(event) => {
          if (event.ctaLink) {
            if (event.ctaLink.startsWith('http')) {
              window.open(event.ctaLink, '_blank');
            } else {
              // Treat as product ID — find and open the product
              const products = config?.products || [];
              const product = products.find(p => p.id === event.ctaLink)
                || products.find(p => p.id?.includes(event.ctaLink!) || event.ctaLink!.includes(p.id));
              if (product) {
                handleSelectProduct(product);
              } else if (products.length > 0) {
                handleSelectProduct(products[0]);
              } else {
                document.getElementById('product-grid')?.scrollIntoView({ behavior: 'smooth' });
              }
            }
          }
        }}
      />

      <Drawer
        anchor={navHandedness === 'left' ? 'left' : 'right'}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        PaperProps={{
          sx: {
            bgcolor: 'var(--surface)',
            color: 'var(--foreground)',
            width: 320,
            maxHeight: '100vh',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            backdropFilter: 'blur(24px)',
            borderLeft: navHandedness === 'left' ? 'none' : '1px solid var(--glass-border)',
            borderRight: navHandedness === 'left' ? '1px solid var(--glass-border)' : 'none',
            boxShadow: (theme: any) => {
              const dir = navHandedness === 'left' ? '18px' : '-18px';
              return theme.palette.mode === 'dark' ? `${dir} 0 60px rgba(0,0,0,0.45)` : `${dir} 0 60px rgba(0,0,0,0.08)`;
            },
            backgroundImage: (theme: any) => theme.palette.mode === 'dark' 
              ? 'radial-gradient(circle at 20% 20%, rgba(0,113,227,0.18), transparent 42%), radial-gradient(circle at 80% 0%, rgba(14,165,233,0.16), transparent 38%)'
              : 'radial-gradient(circle at 20% 20%, rgba(0,113,227,0.06), transparent 42%), radial-gradient(circle at 80% 0%, rgba(14,165,233,0.04), transparent 38%)',
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>{t.nav.menu}</Typography>
            <IconButton onClick={() => setSidebarOpen(false)}>
              <X style={{ color: 'var(--foreground)' }} size={24} />
            </IconButton>
          </Box>
          <Divider sx={{ mb: 2, borderColor: 'var(--glass-border)' }} />

          {session && (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Avatar src={orderData.profileImage || session?.user?.image || ''} sx={{ mr: 2, width: 40, height: 40 }} />
                <Box>
                  <Typography sx={{ fontWeight: 'bold', color: 'var(--foreground)' }}>{session?.user?.name}</Typography>
                  <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>{session?.user?.email}</Typography>
                </Box>
              </Box>
              <Divider sx={{ my: 2, borderColor: 'var(--glass-border)' }} />
              <Button
                fullWidth
                onClick={() => { setSidebarOpen(false); setShowProfileModal(true); setActiveTab('profile'); }}
                sx={{
                  textAlign: 'left',
                  mb: 1,
                  color: 'var(--foreground)',
                  justifyContent: 'flex-start',
                  borderRadius: 2,
                  px: 1.5,
                  py: 1.1,
                  background: 'linear-gradient(120deg, rgba(0,113,227,0.18), rgba(14,165,233,0.12))',
                  border: '1px solid var(--glass-border)',
                  boxShadow: (theme: any) => theme.palette.mode === 'dark' ? '0 12px 30px rgba(0,0,0,0.25)' : '0 4px 12px rgba(0,0,0,0.06)',
                  '&:hover': { borderColor: 'rgba(0,113,227,0.5)', background: 'linear-gradient(120deg, rgba(0,113,227,0.24), rgba(14,165,233,0.18))' },
                }}
                startIcon={<User size={20} />}
              >
                {t.nav.myShippingInfo}
              </Button>
              <Button
                fullWidth
                onClick={() => { setSidebarOpen(false); setShowHistoryDialog(true); loadOrderHistory(); }}
                sx={{
                  textAlign: 'left',
                  mb: 1,
                  color: 'var(--foreground)',
                  justifyContent: 'flex-start',
                  borderRadius: 2,
                  px: 1.5,
                  py: 1.1,
                  background: 'linear-gradient(120deg, rgba(16,185,129,0.18), rgba(14,165,233,0.12))',
                  border: '1px solid var(--glass-border)',
                  boxShadow: (theme: any) => theme.palette.mode === 'dark' ? '0 12px 30px rgba(0,0,0,0.25)' : '0 4px 12px rgba(0,0,0,0.06)',
                  '&:hover': { borderColor: 'rgba(16,185,129,0.5)', background: 'linear-gradient(120deg, rgba(16,185,129,0.22), rgba(14,165,233,0.16))' },
                }}
                startIcon={<History size={20} />}
              >
                {t.nav.orderHistory}
              </Button>
              {/* Wishlist button */}
              <Button
                fullWidth
                onClick={() => { setSidebarOpen(false); setShowWishlistDrawer(true); }}
                sx={{
                  textAlign: 'left',
                  mb: 1,
                  color: 'var(--foreground)',
                  justifyContent: 'flex-start',
                  borderRadius: 2,
                  px: 1.5,
                  py: 1.1,
                  background: 'linear-gradient(120deg, rgba(255,69,58,0.18), rgba(255,159,10,0.12))',
                  border: '1px solid var(--glass-border)',
                  boxShadow: (theme: any) => theme.palette.mode === 'dark' ? '0 12px 30px rgba(0,0,0,0.25)' : '0 4px 12px rgba(0,0,0,0.06)',
                  '&:hover': { borderColor: 'rgba(255,69,58,0.5)', background: 'linear-gradient(120deg, rgba(255,69,58,0.24), rgba(255,159,10,0.18))' },
                }}
                startIcon={
                  <Badge badgeContent={wishlistStore.items.length} color="error" sx={{ '& .MuiBadge-badge': { fontSize: '0.6rem', minWidth: 16, height: 16 } }}>
                    <Heart size={20} />
                  </Badge>
                }
              >
                {t.wishlist.title}
              </Button>
              {/* Recently Viewed button */}
              <Button
                fullWidth
                onClick={() => { setSidebarOpen(false); setShowRecentlyViewed(true); }}
                sx={{
                  textAlign: 'left',
                  mb: 1,
                  color: 'var(--foreground)',
                  justifyContent: 'flex-start',
                  borderRadius: 2,
                  px: 1.5,
                  py: 1.1,
                  background: 'linear-gradient(120deg, rgba(100,210,255,0.18), rgba(48,209,88,0.12))',
                  border: '1px solid var(--glass-border)',
                  boxShadow: (theme: any) => theme.palette.mode === 'dark' ? '0 12px 30px rgba(0,0,0,0.25)' : '0 4px 12px rgba(0,0,0,0.06)',
                  '&:hover': { borderColor: 'rgba(100,210,255,0.5)', background: 'linear-gradient(120deg, rgba(100,210,255,0.24), rgba(48,209,88,0.18))' },
                }}
                startIcon={<Eye size={20} />}
              >
                {t.recentlyViewed.title}
              </Button>
              <Button
                fullWidth
                onClick={() => { setSidebarOpen(false); setSwitchAccountOpen(true); }}
                sx={{
                  textAlign: 'left',
                  mb: 1,
                  color: 'var(--foreground)',
                  justifyContent: 'flex-start',
                  borderRadius: 2,
                  px: 1.5,
                  py: 1.1,
                  background: 'linear-gradient(120deg, rgba(139,92,246,0.18), rgba(99,102,241,0.12))',
                  border: '1px solid var(--glass-border)',
                  boxShadow: (theme: any) => theme.palette.mode === 'dark' ? '0 12px 30px rgba(0,0,0,0.25)' : '0 4px 12px rgba(0,0,0,0.06)',
                  '&:hover': { borderColor: 'rgba(139,92,246,0.5)', background: 'linear-gradient(120deg, rgba(139,92,246,0.24), rgba(99,102,241,0.18))' },
                }}
                startIcon={<ArrowLeftRight size={20} />}
              >
                {t.nav.switchAccount}
              </Button>
              <Button
                fullWidth
                onClick={toggleNavHandedness}
                sx={{
                  textAlign: 'left',
                  mb: 1,
                  color: 'var(--foreground)',
                  justifyContent: 'flex-start',
                  borderRadius: 2,
                  px: 1.5,
                  py: 1.1,
                  background: 'linear-gradient(120deg, rgba(245,158,11,0.18), rgba(251,191,36,0.12))',
                  border: '1px solid var(--glass-border)',
                  boxShadow: (theme: any) => theme.palette.mode === 'dark' ? '0 12px 30px rgba(0,0,0,0.25)' : '0 4px 12px rgba(0,0,0,0.06)',
                  '&:hover': { borderColor: 'rgba(245,158,11,0.5)', background: 'linear-gradient(120deg, rgba(245,158,11,0.24), rgba(251,191,36,0.18))' },
                }}
                startIcon={<HandMetal size={20} style={{ transform: navHandedness === 'left' ? 'scaleX(-1)' : 'none' }} />}
              >
                {navHandedness === 'right' ? t.nav.switchViewRight : t.nav.switchViewLeft}
              </Button>
              <Button
                fullWidth
                onClick={() => { setSidebarOpen(false); setLogoutConfirmOpen(true); }}
                sx={{
                  textAlign: 'left',
                  color: (theme: any) => theme.palette.mode === 'dark' ? '#fecdd3' : '#ff3b30',
                  justifyContent: 'flex-start',
                  borderRadius: 2,
                  px: 1.5,
                  py: 1.1,
                  background: 'linear-gradient(120deg, rgba(239,68,68,0.12), rgba(239,68,68,0.06))',
                  border: '1px solid rgba(248,113,113,0.4)',
                  boxShadow: (theme: any) => theme.palette.mode === 'dark' ? '0 12px 30px rgba(239,68,68,0.18)' : '0 4px 12px rgba(239,68,68,0.08)',
                  '&:hover': { borderColor: 'rgba(248,113,113,0.8)', background: 'linear-gradient(120deg, rgba(239,68,68,0.18), rgba(239,68,68,0.12))' },
                }}
                startIcon={<LogOut size={20} />}
              >
                {t.nav.logout}
              </Button>
            </>
          )}

          <Divider sx={{ my: 2, borderColor: 'var(--glass-border)' }} />
          <Button
            component={Link}
            href="/"
            fullWidth
            sx={{
              textAlign: 'left',
              color: 'var(--foreground)',
              justifyContent: 'flex-start',
              borderRadius: 2,
              px: 1.5,
              py: 1.1,
              background: (theme: any) => theme.palette.mode === 'dark' 
                ? 'linear-gradient(120deg, rgba(0,113,227,0.16), rgba(29,29,31,0.6))' 
                : 'linear-gradient(120deg, rgba(0,113,227,0.08), rgba(245,245,247,0.6))',
              border: '1px solid var(--glass-border)',
              boxShadow: (theme: any) => theme.palette.mode === 'dark' ? '0 12px 30px rgba(0,0,0,0.22)' : '0 4px 12px rgba(0,0,0,0.06)',
              '&:hover': { borderColor: 'rgba(0,113,227,0.6)', background: 'linear-gradient(120deg, rgba(0,113,227,0.22), rgba(0,113,227,0.08))' },
            }}
            startIcon={<Home size={20} />}
          >
            {t.nav.home}
          </Button>
        </Box>
      </Drawer>

      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Box sx={{ flex: 1, p: { xs: 2, md: 3 }, overflow: 'auto', maxWidth: '100%' }}>
          <Container maxWidth="lg" sx={{ px: { xs: 0, sm: 2 } }}>
            

            {activeProductCount > 0 && (
              <Box sx={{ mb: 3 }}>
                {/* Modern Filter Bar */}
                <Box sx={{
                  p: 2,
                  mb: 2,
                  borderRadius: '18px',
                  bgcolor: 'var(--surface)',
                  border: '1px solid var(--glass-border)',
                  backdropFilter: 'blur(10px)',
                }}>
                  {/* Search and Stats Row */}
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Box sx={{
                        width: 36,
                        height: 36,
                        borderRadius: '10px',
                        bgcolor: 'rgba(0,113,227,0.15)',
                        display: 'grid',
                        placeItems: 'center',
                      }}>
                        <Store size={18} color="#2997ff" />
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--foreground)' }}>
                          {t.product.allProducts}
                        </Typography>
                        <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {t.product.foundItems} {filteredProductCount} {t.common.items} ({activeProductCount} {t.product.openForSale})
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <IconButton 
                        onClick={() => setShowSearchBar(!showSearchBar)}
                        sx={{ 
                          color: showSearchBar ? 'var(--primary)' : 'var(--text-muted)',
                          bgcolor: showSearchBar ? 'rgba(0,113,227,0.15)' : 'var(--glass-bg)',
                        }}
                      >
                        <Search size={18} />
                      </IconButton>
                    </Box>
                  </Box>

                  {/* Category Chips */}
                  <Box sx={{
                    display: 'flex',
                    gap: 0.8,
                    flexWrap: 'nowrap',
                    overflowX: 'auto',
                    pb: 0.5,
                    mx: -1,
                    px: 1,
                    '&::-webkit-scrollbar': { display: 'none' },
                  }}>
                    {categoryMeta.map((cat) => {
                      const active = categoryFilter === cat.key;
                      return (
                        <Box
                          key={cat.key}
                          onClick={() => setCategoryFilter(cat.key)}
                          sx={{
                            px: 1.8,
                            py: 0.8,
                            borderRadius: '12px',
                            bgcolor: active ? 'rgba(0,113,227,0.2)' : 'var(--glass-bg)',
                            border: active ? '1px solid rgba(0,113,227,0.5)' : '1px solid var(--glass-border)',
                            color: active ? 'var(--primary)' : 'var(--text-muted)',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.8,
                            '&:hover': {
                              bgcolor: active ? 'rgba(0,113,227,0.25)' : 'var(--glass-bg)',
                              borderColor: active ? 'rgba(0,113,227,0.6)' : 'var(--glass-border)',
                            },
                          }}
                        >
                          <span style={{ fontSize: '0.9rem' }}>{(cat as any).icon || ''}</span>
                          {cat.label}
                          <Box sx={{
                            px: 0.7,
                            py: 0.1,
                            borderRadius: '6px',
                            bgcolor: active ? 'rgba(0,113,227,0.4)' : 'var(--glass-bg)',
                            fontSize: '0.65rem',
                            fontWeight: 700,
                          }}>
                            {cat.count}
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>

                  {/* Price Range Filter */}
                  {priceBounds.max > 0 && priceBounds.max !== priceBounds.min && (
                    <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid var(--glass-border)' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                        <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                          {t.product.filterByPrice}
                        </Typography>
                        <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--success)' }}>
                          ฿{priceRange[0].toLocaleString()} - ฿{priceRange[1].toLocaleString()}
                        </Typography>
                      </Box>
                      <Slider
                        value={priceRange}
                        min={priceBounds.min}
                        max={priceBounds.max}
                        step={10}
                        onChange={(_, value) => setPriceRange(value as [number, number])}
                        valueLabelDisplay="off"
                        sx={{
                          color: '#0071e3',
                          height: 6,
                          '& .MuiSlider-track': { border: 'none', bgcolor: '#0071e3' },
                          '& .MuiSlider-rail': { bgcolor: 'var(--glass-bg)' },
                          '& .MuiSlider-thumb': {
                            width: 18,
                            height: 18,
                            backgroundColor: '#fff',
                            border: '2px solid #0071e3',
                            '&:hover': { boxShadow: '0 0 0 8px rgba(0,113,227,0.16)' },
                          },
                        }}
                      />
                    </Box>
                  )}
                </Box>
              </Box>
            )}

            {config?.products && Object.keys(filteredGroupedProducts).length > 0 ? (
              Object.entries(filteredGroupedProducts).map(([category, items]) => (
                <Box key={category} sx={{ mb: 4 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
                    <Box sx={{
                      px: 1.5,
                      py: 0.6,
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, #0071e3 0%, #0077ED 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.75,
                    }}>
                      <span style={{ fontSize: '0.9rem' }}>{getCategoryIcon(category)}</span>
                      <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: 'white' }}>
                        {(t.category as Record<string, string>)[category] || getCategoryLabel(category, lang) || TYPE_LABELS_I18N[category] || category || t.type.OTHER}
                      </Typography>
                    </Box>
                    <Typography sx={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {items.length} {t.common.items}
                    </Typography>
                    {items.length > 1 && (
                      <Typography sx={{ 
                        display: { xs: 'flex', sm: 'none' }, 
                        alignItems: 'center',
                        gap: 0.5,
                        fontSize: '0.7rem', 
                        color: 'var(--text-muted)',
                        ml: 'auto',
                      }}>
                        {t.product.scrollMore}
                      </Typography>
                    )}
                  </Box>
                  <Box sx={{ position: 'relative', overflow: 'hidden', mx: { xs: -2, sm: 0 } }}>
                    {/* Right fade hint on mobile */}
                    <Box sx={{
                      display: { xs: 'block', sm: 'none' },
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      bottom: 0,
                      width: 32,
                      background: 'linear-gradient(to right, transparent, var(--background))',
                      zIndex: 2,
                      pointerEvents: 'none',
                    }} />
                  <Box sx={{
                    display: { xs: 'flex', sm: 'grid' },
                    gridTemplateColumns: { sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)' },
                    gap: 2,
                    overflowX: { xs: 'auto', sm: 'visible' },
                    scrollSnapType: { xs: 'x mandatory', sm: 'none' },
                    WebkitOverflowScrolling: 'touch',
                    '&::-webkit-scrollbar': { display: 'none' },
                    scrollbarWidth: 'none',
                    px: { xs: 2, sm: 0 },
                    pb: { xs: 1, sm: 0 },
                  }}>
                    {items.map((product, productIdx) => {
                      const productStatus = getProductStatus(product);
                      const isProductAvailable = productStatus === 'OPEN' && isShopOpen;
                      const isProductClosed = productStatus !== 'OPEN'; // Product is closed/coming soon/ended
                      const eventDiscount = getEventDiscount(product.id, config?.events as ShopEvent[] | undefined);
                      
                      return (
                      <Box key={product.id} sx={{
                        minWidth: { xs: '68vw', sm: 'auto' },
                        maxWidth: { xs: '68vw', sm: 'none' },
                        flex: { xs: '0 0 auto', sm: '1 1 auto' },
                        scrollSnapAlign: { xs: 'start', sm: 'unset' },
                      }}>
                        <Box
                          onClick={() => {
                            if (!isShopOpen) {
                              showToast('warning', t.checkout.shopClosedWarning);
                              return;
                            }
                            if (productStatus !== 'OPEN') {
                              const statusConfig = SHOP_STATUS_CONFIG[productStatus];
                              const statusLabelsMap: Record<ShopStatusType, string> = {
                                OPEN: t.shopStatus.open,
                                COMING_SOON: t.shopStatus.comingSoon,
                                ORDER_ENDED: t.shopStatus.closedEnded,
                                TEMPORARILY_CLOSED: t.shopStatus.closed,
                                WAITING_TO_OPEN: t.shopStatus.waitingToOpen,
                              };
                              showToast('info', `${getProductName(product, lang)} - ${statusLabelsMap[productStatus]}`);
                              return;
                            }
                            handleSelectProduct(product);
                          }}
                          sx={{
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column', // Always vertical
                            cursor: isProductAvailable ? 'pointer' : 'default',
                            borderRadius: '20px',
                            overflow: 'hidden',
                            bgcolor: 'var(--surface)',
                            border: `1px solid ${isProductClosed ? SHOP_STATUS_CONFIG[productStatus].borderColor : 'var(--glass-bg)'}`,
                            transition: 'all 0.25s ease',
                            position: 'relative',
                            opacity: isProductClosed ? 0.85 : 1,
                            '&:hover': isProductAvailable ? {
                              transform: 'translateY(-4px)',
                              boxShadow: '0 20px 40px rgba(0,113,227,0.2)',
                              borderColor: 'rgba(0,113,227,0.4)',
                            } : {},
                          }}
                        >
                          {/* Product Image Area */}
                          <Box sx={{
                            position: 'relative',
                            width: '100%',
                            aspectRatio: '1 / 1',
                            bgcolor: 'var(--surface-2)',
                            overflow: 'hidden',
                          }}>
                            {/* Optimized product image with lazy loading - ใช้ coverImage ก่อน */}
                            {(product.coverImage || product.images?.[0]) ? (
                              <OptimizedImage
                                src={product.coverImage ?? (product.images && product.images[0]) ?? ''}
                                alt={product.name}
                                width="100%"
                                height="100%"
                                objectFit="cover"
                                priority={productIdx < 4} // First 4 products load eagerly
                                placeholder="shimmer"
                                showLoadingIndicator={productIdx < 4}
                                style={{
                                  position: 'absolute',
                                  inset: 0,
                                  filter: isProductClosed ? 'grayscale(40%) brightness(0.7)' : 'none',
                                  transition: 'filter 0.3s ease',
                                }}
                              />
                            ) : (
                              <Box sx={{ 
                                position: 'absolute', 
                                inset: 0, 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                color: 'var(--text-muted)',
                                fontSize: '0.8rem',
                              }}>
                                {t.common.noImage}
                              </Box>
                            )}
                            {/* Status Overlay for closed products */}
                            {isProductClosed && (
                              <Box sx={{
                                position: 'absolute',
                                inset: 0,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: 'rgba(0,0,0,0.6)',
                                backdropFilter: 'blur(2px)',
                              }}>
                                <Box
                                  sx={{
                                    width: 48,
                                    height: 48,
                                    borderRadius: '14px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: `linear-gradient(135deg, ${SHOP_STATUS_CONFIG[productStatus].color}40 0%, ${SHOP_STATUS_CONFIG[productStatus].color}20 100%)`,
                                    border: `2px solid ${SHOP_STATUS_CONFIG[productStatus].color}`,
                                    color: SHOP_STATUS_CONFIG[productStatus].color,
                                    mb: 1,
                                    boxShadow: `0 0 20px ${SHOP_STATUS_CONFIG[productStatus].color}40`,
                                  }}
                                >
                                  {(() => {
                                    const IconComponent = SHOP_STATUS_CONFIG[productStatus].icon;
                                    return <IconComponent size={24} />;
                                  })()}
                                </Box>
                                <Typography
                                  sx={{
                                    fontSize: '0.8rem',
                                    fontWeight: 800,
                                    color: SHOP_STATUS_CONFIG[productStatus].color,
                                    textAlign: 'center',
                                    px: 2,
                                    textShadow: '0 2px 8px rgba(0,0,0,0.5)',
                                  }}
                                >
                                  {({
                                    OPEN: t.shopStatus.open,
                                    COMING_SOON: t.shopStatus.comingSoon,
                                    ORDER_ENDED: t.shopStatus.closedEnded,
                                    TEMPORARILY_CLOSED: t.shopStatus.closed,
                                    WAITING_TO_OPEN: t.shopStatus.waitingToOpen,
                                  } as Record<ShopStatusType, string>)[productStatus]}
                                </Typography>
                                {/* Show date info */}
                                {product.startDate && productStatus === 'COMING_SOON' && (
                                  <Typography sx={{ fontSize: '0.65rem', color: 'var(--foreground)', mt: 0.5, textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
                                    {t.product.opensOn} {new Date(product.startDate).toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US')}
                                  </Typography>
                                )}
                              </Box>
                            )}
                            
                            {/* Feature badges */}
                            {!isProductClosed && (
                              <Box sx={{ 
                                position: 'absolute', 
                                top: 8, 
                                left: 8, 
                                display: 'flex', 
                                flexDirection: 'column', 
                                gap: 0.5 
                              }}>
                                {/* Countdown timer if has endDate */}
                                {product.endDate && new Date(product.endDate) > new Date() && (
                                  <Box sx={{
                                    px: 0.8,
                                    py: 0.4,
                                    borderRadius: '6px',
                                    bgcolor: 'rgba(239,68,68,0.9)',
                                    fontSize: '0.58rem',
                                    fontWeight: 700,
                                    color: 'white',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 0.5,
                                  }}>
                                    <Clock size={10} />
                                    {(() => {
                                      const end = new Date(product.endDate!);
                                      const now = new Date();
                                      const diff = end.getTime() - now.getTime();
                                      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                                      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                                      if (days > 0) return `${t.common.remaining} ${days} ${t.common.days}`;
                                      if (hours > 0) return `${t.common.remaining} ${hours} ${t.common.hours}`;
                                      return t.product.closingSoon;
                                    })()}
                                  </Box>
                                )}
                              </Box>
                            )}
                            
                            {/* Price badge */}
                            <Box sx={{
                              position: 'absolute',
                              bottom: 8,
                              right: 8,
                              px: 1.2,
                              py: 0.5,
                              borderRadius: '10px',
                              bgcolor: isProductClosed ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.7)',
                              backdropFilter: 'blur(8px)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.5,
                            }}>
                              {eventDiscount && !isProductClosed ? (
                                <>
                                  <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: '#86868b', textDecoration: 'line-through' }}>
                                    ฿{product.basePrice.toLocaleString()}
                                  </Typography>
                                  <Typography sx={{ fontSize: '0.9rem', fontWeight: 800, color: '#ff453a' }}>
                                    ฿{eventDiscount.discountedPrice(product.basePrice).toLocaleString()}
                                  </Typography>
                                </>
                              ) : (
                                <Typography sx={{ 
                                  fontSize: '0.9rem', 
                                  fontWeight: 800, 
                                  color: isProductClosed ? 'var(--text-muted)' : '#34c759',
                                }}>
                                  ฿{product.basePrice.toLocaleString()}
                                </Typography>
                              )}
                            </Box>

                            {/* Event discount badge */}
                            {eventDiscount && !isProductClosed && (
                              <Box sx={{
                                position: 'absolute',
                                top: 8,
                                right: 8,
                                px: 0.8,
                                py: 0.4,
                                borderRadius: '8px',
                                bgcolor: 'rgba(255,69,58,0.9)',
                                fontSize: '0.6rem',
                                fontWeight: 800,
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.3,
                                backdropFilter: 'blur(4px)',
                              }}>
                                <Tag size={10} />
                                {eventDiscount.discountLabel}
                              </Box>
                            )}

                            {/* Action buttons */}
                            <Box
                              sx={{
                                position: 'absolute',
                                bottom: 8,
                                left: 8,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                              }}
                            >
                              <IconButton
                                size="small"
                                onClick={(e) => { e.stopPropagation(); handleShareProduct(product); }}
                                sx={{
                                  bgcolor: 'rgba(0,0,0,0.5)',
                                  backdropFilter: 'blur(8px)',
                                  color: 'white',
                                  width: 30,
                                  height: 30,
                                  '&:hover': { bgcolor: 'rgba(0,113,227,0.7)' },
                                }}
                              >
                                <Share2 size={14} />
                              </IconButton>

                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const wasInWishlist = wishlistStore.items.includes(product.id);
                                  wishlistStore.toggleItem(product.id);
                                  showToast(
                                    wasInWishlist ? 'info' : 'success',
                                    wasInWishlist ? t.wishlist.removedFromWishlist : t.wishlist.addedToWishlist
                                  );
                                }}
                                sx={{
                                  bgcolor: 'rgba(0,0,0,0.5)',
                                  backdropFilter: 'blur(8px)',
                                  color: wishlistStore.isInWishlist(product.id) ? '#ff453a' : 'white',
                                  width: 30,
                                  height: 30,
                                  '&:hover': { bgcolor: 'rgba(255,69,58,0.7)' },
                                  transition: 'all 0.2s ease',
                                }}
                              >
                                <Heart size={14} fill={wishlistStore.isInWishlist(product.id) ? '#ff453a' : 'none'} />
                              </IconButton>
                            </Box>
                          </Box>

                          {/* Product Info */}
                          <Box sx={{ 
                            p: 2, 
                            flex: 1, 
                            display: 'flex', 
                            flexDirection: 'column',
                          }}>
                            <Typography sx={{ 
                              fontSize: '0.95rem', 
                              fontWeight: 700, 
                              color: isProductClosed ? 'var(--text-muted)' : 'var(--foreground)',
                              mb: 0.5,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              lineHeight: 1.3,
                            }}>
                              {getProductName(product, lang)}
                            </Typography>
                            
                            {/* Description - Show more lines */}
                            <Typography sx={{ 
                              fontSize: '0.75rem', 
                              color: 'var(--text-muted)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              lineHeight: 1.4,
                              mb: 1,
                            }}>
                              {getProductDescription(product, lang) || TYPE_LABELS_I18N[product.type] || product.type}
                            </Typography>

                            {/* Product Tags - from customTags or auto-generated */}
                            {(() => {
                              // Use customTags if defined, otherwise auto-generate from options
                              const tags = product.customTags && product.customTags.length > 0 
                                ? product.customTags 
                                : [
                                    // Auto-generate from endDate
                                    ...(product.endDate && new Date(product.endDate) > new Date() ? [{
                                      text: `${t.product.until} ${new Date(product.endDate).toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US', { day: 'numeric', month: 'short' })}`,
                                      color: 'var(--error)',
                                      bgColor: 'rgba(239,68,68,0.15)',
                                      borderColor: 'rgba(239,68,68,0.3)',
                                      icon: 'clock'
                                    }] : []),
                                    // Auto-generate from options
                                    ...(product.options?.hasCustomName ? [{
                                      text: t.product.customNameAvailable,
                                      color: 'var(--success)',
                                      bgColor: 'rgba(16,185,129,0.15)',
                                      borderColor: 'rgba(16,185,129,0.3)'
                                    }] : []),
                                    ...(product.options?.hasCustomNumber ? [{
                                      text: t.product.customNumberAvailable,
                                      color: 'var(--secondary)',
                                      bgColor: 'rgba(0,113,227,0.15)',
                                      borderColor: 'rgba(0,113,227,0.3)'
                                    }] : []),
                                  ];
                              
                              if (tags.length === 0) return null;
                              
                              return (
                                <Box sx={{ 
                                  display: 'flex', 
                                  flexWrap: 'wrap', 
                                  gap: 0.5, 
                                  mb: 1,
                                }}>
                                  {tags.map((tag, idx) => (
                                    <Box key={idx} sx={{
                                      px: 0.8,
                                      py: 0.2,
                                      borderRadius: '6px',
                                      bgcolor: (tag as any).bgColor || `${tag.color}20`,
                                      border: `1px solid ${(tag as any).borderColor || `${tag.color}40`}`,
                                      fontSize: '0.6rem',
                                      fontWeight: 600,
                                      color: tag.color,
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 0.3,
                                    }}>
                                      {(tag as any).icon === 'clock' && <Clock size={10} />}
                                      {lang === 'en' 
                                        ? ((tag as any).textEn || TAG_TRANSLATIONS_TH_TO_EN[tag.text] || tag.text)
                                        : tag.text}
                                    </Box>
                                  ))}
                                </Box>
                              );
                            })()}
                            
                            {/* Status/Action Button */}
                            <Box sx={{ mt: 'auto' }}>
                              {!isProductClosed ? (
                                <Button
                                  fullWidth
                                  disabled={!isProductAvailable}
                                  sx={{
                                    py: 0.8,
                                    borderRadius: '10px',
                                    background: isProductAvailable 
                                      ? 'linear-gradient(135deg, #0071e3 0%, #0077ED 100%)' 
                                      : 'rgba(100,116,139,0.2)',
                                    color: isProductAvailable ? 'white' : '#86868b',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    textTransform: 'none',
                                    '&:hover': {
                                      background: isProductAvailable 
                                        ? 'linear-gradient(135deg, #0071e3 0%, #0071e3 100%)' 
                                        : 'rgba(100,116,139,0.2)',
                                    },
                                  }}
                                >
                                  {isShopOpen ? t.product.viewDetail : t.product.shopClosedTemp}
                                </Button>
                              ) : (
                                <Box
                                  sx={{
                                    py: 0.8,
                                    px: 1.5,
                                    borderRadius: '10px',
                                    background: SHOP_STATUS_CONFIG[productStatus].bgGradient,
                                    border: `1px solid ${SHOP_STATUS_CONFIG[productStatus].borderColor}`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 0.75,
                                  }}
                                >
                                  {(() => {
                                    const IconComponent = SHOP_STATUS_CONFIG[productStatus].icon;
                                    return <IconComponent size={14} color={SHOP_STATUS_CONFIG[productStatus].color} />;
                                  })()}
                                  <Typography 
                                    sx={{ 
                                      fontSize: '0.75rem', 
                                      fontWeight: 700, 
                                      color: SHOP_STATUS_CONFIG[productStatus].color,
                                    }}
                                  >
                                    {({
                                      OPEN: t.shopStatus.open,
                                      COMING_SOON: t.shopStatus.comingSoon,
                                      ORDER_ENDED: t.shopStatus.closedEnded,
                                      TEMPORARILY_CLOSED: t.shopStatus.closed,
                                      WAITING_TO_OPEN: t.shopStatus.waitingToOpen,
                                    } as Record<ShopStatusType, string>)[productStatus]}
                                  </Typography>
                                </Box>
                              )}
                            </Box>
                          </Box>
                        </Box>
                      </Box>
                    );
                    })}
                  </Box>
                  </Box>
                </Box>
              ))
            ) : (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Store size={64} style={{ color: 'var(--text-muted)', marginBottom: 16 }} />
                <Typography variant="h6" sx={{ color: 'var(--text-muted)', mb: 1 }}>
                  {totalProductCount > 0 ? t.product.noProductsSearch : t.product.noProductsYet}
                </Typography>
                {totalProductCount === 0 && (
                  <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    {t.product.comingSoon}
                  </Typography>
                )}
              </Box>
            )}
          </Container>
        </Box>

        {cart.length > 0 && (
          <Box sx={{ display: { xs: 'none', md: 'block' }, width: 350, p: 2, bgcolor: 'var(--background)', borderLeft: (theme) => `1px solid ${theme.palette.divider}`, overflow: 'auto', maxHeight: 'calc(100vh - 64px)' }}>
            <Card sx={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', backdropFilter: 'blur(16px)' }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, color: 'var(--foreground)' }}>
                  {t.misc.orderSummary}
                </Typography>
                {cart.map((item) => (
                  <Box key={item.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, pb: 2, borderBottom: '1px solid var(--glass-border)' }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'var(--foreground)' }}>
                        {item.productName}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>
                        {item.size} × {item.quantity}
                      </Typography>
                      {(item.options?.customName || item.options?.customNumber || item.options?.isLongSleeve) && (
                        <Typography variant="caption" sx={{ color: 'var(--text-muted)', display: 'block' }}>
                          {item.options?.customName && `${t.cart.customName}: ${item.options.customName}`} {item.options?.customNumber && `${t.cart.customNumber}: ${item.options.customNumber}`} {item.options?.isLongSleeve && '(' + t.common.longSleeve + ')'}
                        </Typography>
                      )}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                        <IconButton
                          size="small"
                          onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
                          onMouseDown={() => startCartHold(item.id, -1)}
                          onMouseUp={() => stopCartHold(item.id)}
                          onMouseLeave={() => stopCartHold(item.id)}
                          onTouchStart={() => startCartHold(item.id, -1)}
                          onTouchEnd={() => stopCartHold(item.id)}
                          sx={{ bgcolor: 'var(--surface-2)', color: 'var(--foreground)' }}
                        >
                          <Minus size={14} />
                        </IconButton>
                        <Typography sx={{ color: 'var(--foreground)', minWidth: 20, textAlign: 'center' }}>{item.quantity}</Typography>
                        <IconButton
                          size="small"
                          onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                          onMouseDown={() => startCartHold(item.id, 1)}
                          onMouseUp={() => stopCartHold(item.id)}
                          onMouseLeave={() => stopCartHold(item.id)}
                          onTouchStart={() => startCartHold(item.id, 1)}
                          onTouchEnd={() => stopCartHold(item.id)}
                          sx={{ bgcolor: 'var(--surface-2)', color: 'var(--foreground)' }}
                        >
                          <Plus size={14} />
                        </IconButton>
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'var(--success)' }}>
                        {(item.unitPrice * item.quantity).toLocaleString()}฿
                      </Typography>
                      <IconButton size="small" onClick={() => removeFromCart(item.id)} sx={{ color: '#ff453a' }}>
                        <X size={14} />
                      </IconButton>
                    </Box>
                  </Box>
                ))}
                <Divider sx={{ my: 2, borderColor: 'var(--glass-border)' }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Typography sx={{ fontWeight: 'bold', color: 'var(--foreground)' }}>{t.common.total}:</Typography>
                  <Typography sx={{ fontWeight: 'bold', fontSize: 18, color: 'var(--success)' }}>
                    {getTotalPrice().toLocaleString()}฿
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  fullWidth
                  onClick={() => {
                    if (!requireProfileBeforeCheckout()) return;
                    setShowOrderDialog(true);
                  }}
                  disabled={!isShopOpen}
                  sx={{
                    background: 'linear-gradient(135deg, #34c759 0%, #64d2ff 100%)',
                    fontWeight: 700,
                    borderRadius: 2,
                    py: 1,
                    boxShadow: '0 12px 30px rgba(16, 185, 129, 0.35)',
                    '&:hover': { background: 'linear-gradient(135deg, #0ea472 0%, #0591b5 100%)', boxShadow: '0 12px 34px rgba(16, 185, 129, 0.45)' },
                  }}
                >
                  {t.misc.proceedOrder}
                </Button>
              </CardContent>
            </Card>
          </Box>
        )}
      </Box>

      <Footer />

      <PaymentFlow
        registerOpener={(opener) => {
          paymentOpenerRef.current = opener;
        }}
        onPaymentSuccess={(ref) => {
          // Update local state to reflect successful payment verification
          setOrderHistory((prev) => {
            const orderExists = prev.some((order) => order.ref === ref);
            if (orderExists) {
              return prev.map((order) =>
                order.ref === ref ? { ...order, status: 'PAID' } : order
              );
            }
            // If order doesn't exist in history yet, add it
            return [{ ref, status: 'PAID', date: new Date().toISOString(), total: 0 }, ...prev];
          });
          setActiveTab('history');
          showToast('success', t.payment.paymentSuccessToast);
          
          // Refresh order history from server to get complete data
          setTimeout(() => {
            loadOrderHistory();
          }, 500);
        }}
      />

      {showProfileModal && (
        <ProfileModal
          initialData={{ name: orderData.name, phone: orderData.phone, address: orderData.address, instagram: orderData.instagram, profileImage: orderData.profileImage, savedAddresses }}
          onClose={() => { setShowProfileModal(false); setActiveTab('home'); }}
          onSave={handleSaveProfile}
          userImage={session?.user?.image || ''}
          userEmail={session?.user?.email || ''}
          nameValidation={config?.nameValidation}
        />
      )}


      {/* ===== Cart Drawer with Edit Dialog ===== */}
      <CartDrawer
        open={showCart}
        onClose={() => setShowCart(false)}
        cart={cart}
        config={config}
        shippingConfig={shippingConfig}
        isShopOpen={isShopOpen}
        onClearCart={() => {
          if (confirm(t.cart.clearAllConfirm)) {
            saveCart([]);
            showToast('success', t.cart.cleared);
          }
        }}
        onUpdateQuantity={(itemId, quantity) => updateCartQuantity(itemId, quantity)}
        onRemoveItem={(itemId) => removeFromCart(itemId)}
        onEditItem={(item) => openEditCartItem(item)}
        onCheckout={() => {
          if (!requireProfileBeforeCheckout()) return;
          setShowCart(false);
          setShowOrderDialog(true);
        }}
        onStartHold={(itemId, direction) => startCartHold(itemId, direction)}
        onStopHold={(itemId) => stopCartHold(itemId)}
        onGoHome={() => { setShowCart(false); setActiveTab('home'); }}
        getTotalPrice={getTotalPrice}
        editingCartItem={editingCartItem}
        onSetEditingCartItem={setEditingCartItem}
        onUpdateCartItem={(itemId, item) => updateCartItem(itemId, item)}
      />
      {renderProductDialog()}

      {/* ===== Size Chart Dialog - Modern Design ===== */}
      <Dialog
        open={showSizeChart}
        onClose={() => setShowSizeChart(false)}
        maxWidth="sm"
        fullWidth
        sx={{ zIndex: 1500 }}
        PaperProps={{
          sx: {
            bgcolor: 'var(--background)',
            color: 'var(--foreground)',
            borderRadius: '20px',
            border: (theme) => `1px solid ${theme.palette.divider}`,
            mx: 2,
            my: 'auto',
            maxHeight: '85vh',
          },
        }}
        slotProps={{
          backdrop: {
            sx: { backdropFilter: 'blur(8px)', bgcolor: 'rgba(0,0,0,0.6)' },
          },
        }}
      >
        {/* Header */}
        <Box sx={{
          px: 2.5,
          py: 2,
          borderBottom: '1px solid var(--glass-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{
              width: 40,
              height: 40,
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #0071e3 0%, #0077ED 100%)',
              display: 'grid',
              placeItems: 'center',
            }}>
              <Ruler size={20} color="white" />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--foreground)' }}>{t.product.sizeChartTitle}</Typography>
              <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.product.sizeChartSubtitle}</Typography>
            </Box>
          </Box>
        </Box>

        {/* Content */}
        <Box sx={{ px: 2.5, py: 2, overflow: 'auto' }}>
          {/* Info Badges */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8, mb: 2.5 }}>
            <Box sx={{
              px: 1.2,
              py: 0.4,
              borderRadius: '8px',
              bgcolor: 'rgba(0,113,227,0.15)',
              border: '1px solid rgba(0,113,227,0.3)',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'var(--secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
            }}>
              <Ruler size={14} /> {t.misc.sizeChartInch}
            </Box>
            <Box sx={{
              px: 1.2,
              py: 0.4,
              borderRadius: '8px',
              bgcolor: 'rgba(245,158,11,0.15)',
              border: '1px solid rgba(245,158,11,0.3)',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'var(--warning)',
            }}>
              {t.common.longSleeve} +{selectedProduct?.options?.longSleevePrice ?? 50}฿
            </Box>
          </Box>

          {/* Size Cards Grid */}
          <Box sx={{ 
            display: 'grid', 
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, 
            gap: 1.2,
          }}>
            {SIZE_ORDER.map((size) => {
              const measurements = SIZE_MEASUREMENTS[size];
              const row = sizeChartRows.find((r) => r.size === size);
              return (
                <Box 
                  key={size} 
                  sx={{ 
                    p: 1.5,
                    borderRadius: '14px',
                    bgcolor: 'var(--surface-2)',
                    border: '1px solid var(--glass-border)',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      bgcolor: 'var(--glass-bg)',
                      borderColor: 'rgba(0,113,227,0.3)',
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Box sx={{
                      px: 1,
                      py: 0.3,
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, #0071e3 0%, #0077ED 100%)',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      color: 'white',
                    }}>
                      {size}
                    </Box>
                    <Typography sx={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--success)' }}>
                      {row ? `฿${row.price.toLocaleString()}` : '—'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1.5 }}>
                    <Box>
                      <Typography sx={{ fontSize: '0.65rem', color: 'var(--text-muted)', mb: 0.2 }}>{t.product.chestFull}</Typography>
                      <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--foreground)' }}>
                        {measurements ? `${measurements.chest}"` : '—'}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: '0.65rem', color: 'var(--text-muted)', mb: 0.2 }}>{t.product.lengthFull}</Typography>
                      <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--foreground)' }}>
                        {measurements ? `${measurements.length}"` : '—'}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>

        {/* Footer */}
        <Box sx={{ 
          px: 2.5, 
          py: 2, 
          borderTop: '1px solid var(--glass-border)',
        }}>
          <Button
            fullWidth
            onClick={() => setShowSizeChart(false)}
            sx={{
              py: 1.3,
              borderRadius: '12px',
              bgcolor: 'var(--glass-bg)',
              color: 'var(--text-muted)',
              fontSize: '0.9rem',
              fontWeight: 600,
              '&:hover': {
                bgcolor: 'var(--glass-bg)',
              },
            }}
          >
            {t.common.close}
          </Button>
        </Box>
      </Dialog>

      {/* Checkout Dialog with Shipping & Payment Selection */}
      <CheckoutDialog
        open={showOrderDialog}
        onClose={() => setShowOrderDialog(false)}
        cart={cart}
        orderData={orderData}
        profileComplete={profileComplete}
        processing={processing}
        turnstileToken={turnstileToken}
        setTurnstileToken={setTurnstileToken}
        onSubmitOrder={submitOrder}
        onEditProfile={() => { setShowProfileModal(true); setPendingCheckout(true); }}
        products={config?.products}
        isMobile={isMobile}
        savedAddresses={savedAddresses}
        onAddressChange={(address) => setOrderData(prev => ({ ...prev, address }))}
      />

      <Dialog
        open={!!confirmCancelRef}
        onClose={() => setConfirmCancelRef(null)}
        fullScreen={isMobile}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: 420 },
            maxWidth: 'calc(100% - 24px)',
            bgcolor: 'var(--surface)',
            color: 'var(--foreground)',
            borderRadius: 2,
            p: 1,
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
          <AlertTriangle size={20} color="#ffd60a" />
          {t.orderHistory.confirmCancelTitle}
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: 'var(--text-muted)', mb: 1 }}>
            {t.orderHistory.confirmCancelMessage} {confirmCancelRef ? `#${confirmCancelRef}` : ''} {t.orderHistory.confirmCancelAsk}
          </Typography>
          <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>
            {t.orderHistory.cancelWarning}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button
            variant="outlined"
            onClick={() => setConfirmCancelRef(null)}
            sx={{ color: 'var(--text-muted)', borderColor: 'var(--glass-border)' }}
          >
            {t.orderHistory.dontCancel}
          </Button>
          <Button
            variant="contained"
            disabled={!confirmCancelRef || processing}
            onClick={async () => {
              if (!confirmCancelRef) return;
              const ref = confirmCancelRef;
              setConfirmCancelRef(null);
              await cancelOrderByRef(ref);
            }}
            sx={{
              background: '#ff453a',
              '&:hover': { background: '#ff3b30' },
              fontWeight: 800,
              px: 2.5,
            }}
          >
            {t.orderHistory.confirmCancel}
          </Button>
        </DialogActions>
      </Dialog>


      {/* ===== Order History Drawer ===== */}
      <OrderHistoryDrawer
        open={showHistoryDialog}
        onClose={() => setShowHistoryDialog(false)}
        orderHistory={orderHistory}
        loadingHistory={loadingHistory}
        loadingHistoryMore={loadingHistoryMore}
        historyHasMore={historyHasMore}
        historyFilter={historyFilter}
        onFilterChange={(filter) => setHistoryFilter(filter)}
        onLoadMore={() => loadOrderHistory({ append: true })}
        onOpenPayment={(ref) => openPaymentFlow(ref)}
        onCancelOrder={(ref) => handleCancelOrder(ref)}
        onShowQR={(ref) => setShowQRFullscreen(ref)}
        cancellingRef={cancellingRef}
        isShopOpen={isShopOpen}
        realtimeConnected={realtimeConnected}
        config={config}
        onImageClick={(image) => {
          setLightboxImages([image]);
          setLightboxIndex(0);
          setLightboxImage(image);
        }}
      />

      {/* ===== Wishlist Drawer ===== */}
      <Drawer
        anchor="right"
        open={showWishlistDrawer}
        onClose={() => setShowWishlistDrawer(false)}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: 420 },
            bgcolor: 'var(--background)',
            backgroundImage: 'none',
          },
        }}
      >
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--glass-border)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Heart size={20} color="#ff453a" />
            <Typography sx={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--foreground)' }}>
              {t.wishlist.title}
            </Typography>
            {wishlistStore.items.length > 0 && (
              <Chip label={`${wishlistStore.items.length} ${t.wishlist.items}`} size="small" sx={{ fontSize: '0.7rem', height: 22, bgcolor: 'rgba(255,69,58,0.1)', color: '#ff453a' }} />
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {wishlistStore.items.length > 0 && (
              <IconButton size="small" onClick={() => { wishlistStore.clearWishlist(); showToast('info', t.wishlist.clearAll); }} sx={{ color: 'var(--text-muted)' }}>
                <X size={16} />
              </IconButton>
            )}
            <IconButton size="small" onClick={() => setShowWishlistDrawer(false)} sx={{ color: 'var(--text-muted)' }}>
              <X size={20} />
            </IconButton>
          </Box>
        </Box>
        <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
          {wishlistStore.items.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8, color: 'var(--text-muted)' }}>
              <Heart size={48} strokeWidth={1} />
              <Typography sx={{ mt: 2, fontWeight: 600 }}>{t.wishlist.empty}</Typography>
              <Typography sx={{ mt: 0.5, fontSize: '0.85rem', opacity: 0.7 }}>{t.wishlist.emptyDesc}</Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {wishlistStore.items.map((productId) => {
                const product = Object.values(allGroupedProducts).flat().find((p) => p.id === productId);
                if (!product) return null;
                const eventDiscount = getEventDiscount(product.id, config?.events as ShopEvent[] | undefined);
                const productStatus = getProductStatus(product);
                const statusLabelsMap: Record<ShopStatusType, string> = {
                  OPEN: t.shopStatus.open,
                  COMING_SOON: t.shopStatus.comingSoon,
                  ORDER_ENDED: t.shopStatus.closedEnded,
                  TEMPORARILY_CLOSED: t.shopStatus.closed,
                  WAITING_TO_OPEN: t.shopStatus.waitingToOpen,
                };
                return (
                  <Box
                    key={productId}
                    onClick={() => {
                      if (!isShopOpen) {
                        showToast('warning', t.checkout.shopClosedWarning);
                        return;
                      }
                      if (productStatus !== 'OPEN') {
                        showToast('info', `${getProductName(product, lang)} - ${statusLabelsMap[productStatus]}`);
                        return;
                      }
                      setShowWishlistDrawer(false);
                      handleSelectProduct(product);
                    }}
                    sx={{
                      display: 'flex',
                      gap: 1.5,
                      p: 1.5,
                      borderRadius: '16px',
                      bgcolor: 'var(--surface)',
                      border: '1px solid var(--glass-border)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      '&:hover': { borderColor: 'rgba(0,113,227,0.3)', transform: 'translateX(4px)' },
                    }}
                  >
                    <Box sx={{ width: 72, height: 72, borderRadius: '12px', overflow: 'hidden', flexShrink: 0, bgcolor: 'var(--surface-2)' }}>
                      {(product.coverImage || product.images?.[0]) && (
                        <OptimizedImage src={product.coverImage ?? product.images![0]} alt={product.name} width={72} height={72} objectFit="cover" />
                      )}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {getProductName(product, lang)}
                      </Typography>
                      <Typography sx={{ fontSize: '0.8rem', color: 'var(--text-muted)', mt: 0.3 }}>
                        {getCategoryLabel(product.category || product.type, lang)}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                        {eventDiscount ? (
                          <>
                            <Typography sx={{ fontSize: '0.75rem', color: '#86868b', textDecoration: 'line-through' }}>฿{product.basePrice.toLocaleString()}</Typography>
                            <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: '#ff453a' }}>฿{eventDiscount.discountedPrice(product.basePrice).toLocaleString()}</Typography>
                          </>
                        ) : (
                          <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: '#34c759' }}>฿{product.basePrice.toLocaleString()}</Typography>
                        )}
                      </Box>
                    </Box>
                    <IconButton
                      size="small"
                      onClick={(e) => { e.stopPropagation(); wishlistStore.removeItem(productId); showToast('info', t.wishlist.removedFromWishlist); }}
                      sx={{ color: '#ff453a', alignSelf: 'center' }}
                    >
                      <Heart size={18} fill="#ff453a" />
                    </IconButton>
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>
      </Drawer>

      {/* ===== Recently Viewed Drawer ===== */}
      <Drawer
        anchor="right"
        open={showRecentlyViewed}
        onClose={() => setShowRecentlyViewed(false)}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: 420 },
            bgcolor: 'var(--background)',
            backgroundImage: 'none',
          },
        }}
      >
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--glass-border)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Eye size={20} color="#64d2ff" />
            <Typography sx={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--foreground)' }}>
              {t.recentlyViewed.title}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {recentlyViewedStore.items.length > 0 && (
              <Button size="small" onClick={() => recentlyViewedStore.clear()} sx={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                {t.recentlyViewed.clearAll}
              </Button>
            )}
            <IconButton size="small" onClick={() => setShowRecentlyViewed(false)} sx={{ color: 'var(--text-muted)' }}>
              <X size={20} />
            </IconButton>
          </Box>
        </Box>
        <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
          {recentlyViewedStore.items.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8, color: 'var(--text-muted)' }}>
              <Eye size={48} strokeWidth={1} />
              <Typography sx={{ mt: 2, fontWeight: 600 }}>{t.recentlyViewed.empty}</Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {recentlyViewedStore.items.map((productId) => {
                const product = Object.values(allGroupedProducts).flat().find((p) => p.id === productId);
                if (!product) return null;
                const productStatus = getProductStatus(product);
                const statusLabelsMap: Record<ShopStatusType, string> = {
                  OPEN: t.shopStatus.open,
                  COMING_SOON: t.shopStatus.comingSoon,
                  ORDER_ENDED: t.shopStatus.closedEnded,
                  TEMPORARILY_CLOSED: t.shopStatus.closed,
                  WAITING_TO_OPEN: t.shopStatus.waitingToOpen,
                };
                return (
                  <Box
                    key={productId}
                    onClick={() => {
                      if (!isShopOpen) {
                        showToast('warning', t.checkout.shopClosedWarning);
                        return;
                      }
                      if (productStatus !== 'OPEN') {
                        showToast('info', `${getProductName(product, lang)} - ${statusLabelsMap[productStatus]}`);
                        return;
                      }
                      setShowRecentlyViewed(false);
                      handleSelectProduct(product);
                    }}
                    sx={{
                      display: 'flex',
                      gap: 1.5,
                      p: 1.5,
                      borderRadius: '16px',
                      bgcolor: 'var(--surface)',
                      border: '1px solid var(--glass-border)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      '&:hover': { borderColor: 'rgba(0,113,227,0.3)', transform: 'translateX(4px)' },
                    }}
                  >
                    <Box sx={{ width: 60, height: 60, borderRadius: '10px', overflow: 'hidden', flexShrink: 0, bgcolor: 'var(--surface-2)' }}>
                      {(product.coverImage || product.images?.[0]) && (
                        <OptimizedImage src={product.coverImage ?? product.images![0]} alt={product.name} width={60} height={60} objectFit="cover" />
                      )}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {getProductName(product, lang)}
                      </Typography>
                      <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#34c759', mt: 0.3 }}>
                        ฿{product.basePrice.toLocaleString()}
                      </Typography>
                    </Box>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        const wasInWishlist = wishlistStore.items.includes(productId);
                        wishlistStore.toggleItem(productId);
                        showToast(
                          wasInWishlist ? 'info' : 'success',
                          wasInWishlist ? t.wishlist.removedFromWishlist : t.wishlist.addedToWishlist
                        );
                      }}
                      sx={{ color: wishlistStore.isInWishlist(productId) ? '#ff453a' : 'var(--text-muted)', alignSelf: 'center' }}
                    >
                      <Heart size={16} fill={wishlistStore.isInWishlist(productId) ? '#ff453a' : 'none'} />
                    </IconButton>
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>
      </Drawer>

      {/* ===== Bulk Order Dialog ===== */}
      <Dialog
        open={bulkOrderOpen}
        onClose={() => setBulkOrderOpen(false)}
        fullWidth
        maxWidth="sm"
        PaperProps={{
          sx: {
            borderRadius: '24px',
            bgcolor: 'var(--surface)',
            backgroundImage: 'none',
            maxHeight: '85vh',
          },
        }}
      >
        {selectedProduct && (
          <>
            {/* Header */}
            <Box sx={{ p: 2.5, pb: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{
                width: 44, height: 44, borderRadius: '12px', overflow: 'hidden', flexShrink: 0,
                bgcolor: 'rgba(168,85,247,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Users size={22} style={{ color: '#a855f7' }} />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)' }}>
                  {t.bulkOrder.title}
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {getProductName(selectedProduct, lang)}
                </Typography>
              </Box>
              <IconButton size="small" onClick={() => setBulkOrderOpen(false)} sx={{ color: 'var(--text-muted)' }}>
                <X size={20} />
              </IconButton>
            </Box>

            {/* Steps Indicator */}
            <Box sx={{ px: 2.5, pb: 1.5, display: 'flex', gap: 1 }}>
              {[t.bulkOrder.step1, t.bulkOrder.step2, t.bulkOrder.step3].map((label, i) => (
                <Box key={i} sx={{
                  flex: 1, textAlign: 'center', py: 0.6, borderRadius: '10px', fontSize: '0.72rem', fontWeight: 600,
                  bgcolor: bulkStep === i ? 'rgba(168,85,247,0.15)' : 'var(--surface-2)',
                  color: bulkStep === i ? '#a855f7' : 'var(--text-muted)',
                  border: bulkStep === i ? '1px solid rgba(168,85,247,0.3)' : '1px solid transparent',
                  transition: 'all 0.2s',
                }}>
                  {i + 1}. {label}
                </Box>
              ))}
            </Box>

            <Divider />

            {/* Step Content */}
            <Box sx={{ p: 2.5, overflowY: 'auto', maxHeight: '50vh' }}>
              {/* Step 0: Select Sizes & Quantities */}
              {bulkStep === 0 && (
                <Box>
                  <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--foreground)', mb: 1.5 }}>
                    {t.bulkOrder.sizeQuantity}
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 1 }}>
                    {SIZE_ORDER.filter(s => {
                      const sp = selectedProduct.sizePricing;
                      return !sp || sp[s] !== undefined;
                    }).map(size => {
                      const qty = bulkSizes[size] || 0;
                      const price = selectedProduct.sizePricing?.[size] ?? selectedProduct.basePrice;
                      return (
                        <Box key={size} sx={{
                          p: 1.2, borderRadius: '14px', border: qty > 0 ? '2px solid #a855f7' : '1px solid var(--glass-border)',
                          bgcolor: qty > 0 ? 'rgba(168,85,247,0.06)' : 'var(--surface-2)', transition: 'all 0.2s',
                        }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                            <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--foreground)' }}>{size}</Typography>
                            <Typography sx={{ fontSize: '0.7rem', color: '#34c759', fontWeight: 600 }}>฿{price.toLocaleString()}</Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <IconButton
                              size="small"
                              onClick={() => setBulkSizes(prev => {
                                const n = { ...prev };
                                if (n[size] && n[size] > 0) { n[size]--; if (n[size] === 0) delete n[size]; }
                                return n;
                              })}
                              disabled={!qty}
                              sx={{ width: 28, height: 28, bgcolor: 'var(--surface)', border: '1px solid var(--glass-border)' }}
                            >
                              <Minus size={14} />
                            </IconButton>
                            <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--foreground)', minWidth: 24, textAlign: 'center' }}>
                              {qty}
                            </Typography>
                            <IconButton
                              size="small"
                              onClick={() => setBulkSizes(prev => ({ ...prev, [size]: (prev[size] || 0) + 1 }))}
                              sx={{ width: 28, height: 28, bgcolor: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.3)', color: '#a855f7' }}
                            >
                              <Plus size={14} />
                            </IconButton>
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>

                  {/* Long Sleeve Option */}
                  {selectedProduct.options?.hasLongSleeve && (
                    <FormControlLabel
                      control={<Switch checked={bulkLongSleeve} onChange={(e) => setBulkLongSleeve(e.target.checked)} size="small" />}
                      label={<Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>{t.bulkOrder.longSleeve} (+฿{selectedProduct.options?.longSleevePrice ?? 50})</Typography>}
                      sx={{ mt: 1.5 }}
                    />
                  )}

                  {/* Summary */}
                  {bulkTotalQty > 0 && (
                    <Box sx={{ mt: 2, p: 1.5, borderRadius: '12px', bgcolor: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)' }}>
                      <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: '#a855f7' }}>
                        {t.bulkOrder.totalItems}: {bulkTotalQty} {t.bulkOrder.pieces}
                      </Typography>
                    </Box>
                  )}
                </Box>
              )}

              {/* Step 1: Enter Names */}
              {bulkStep === 1 && (
                <Box>
                  <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--foreground)', mb: 0.5 }}>
                    {t.bulkOrder.nameList}
                  </Typography>
                  <Typography sx={{ fontSize: '0.72rem', color: 'var(--text-muted)', mb: 1.5 }}>
                    {t.bulkOrder.nameListHint} ({bulkTotalQty} {t.bulkOrder.pieces})
                  </Typography>
                  <TextField
                    multiline
                    rows={8}
                    value={bulkNames}
                    onChange={(e) => setBulkNames(e.target.value)}
                    placeholder={`Name 1\nName 2\nName 3\n...`}
                    fullWidth
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '14px',
                        bgcolor: 'var(--surface-2)',
                        fontSize: '0.85rem',
                      },
                    }}
                  />
                  <Box sx={{ mt: 1, display: 'flex', justifyContent: 'space-between' }}>
                    <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {t.bulkOrder.namesCount}: {bulkNames.split('\n').filter(n => n.trim()).length}
                    </Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {t.bulkOrder.sizesCount}: {bulkTotalQty}
                    </Typography>
                  </Box>
                  {bulkNames.split('\n').filter(n => n.trim()).length !== bulkTotalQty && bulkNames.trim() && (
                    <Box sx={{ mt: 1, p: 1, borderRadius: '10px', bgcolor: 'rgba(255,159,10,0.1)', border: '1px solid rgba(255,159,10,0.3)' }}>
                      <Typography sx={{ fontSize: '0.72rem', color: '#ff9f0a', fontWeight: 600 }}>
                        {t.bulkOrder.mismatchWarning}
                      </Typography>
                    </Box>
                  )}
                </Box>
              )}

              {/* Step 2: Preview & Assign */}
              {bulkStep === 2 && (
                <Box>
                  <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--foreground)', mb: 1.5 }}>
                    {t.bulkOrder.preview}
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
                    {bulkAssignments.map((a, i) => {
                      const price = selectedProduct.sizePricing?.[a.size] ?? selectedProduct.basePrice;
                      const longFee = selectedProduct.options?.hasLongSleeve && bulkLongSleeve ? (selectedProduct.options?.longSleevePrice ?? 50) : 0;
                      return (
                        <Box key={i} sx={{
                          display: 'flex', alignItems: 'center', gap: 1, p: 1, borderRadius: '10px',
                          bgcolor: 'var(--surface-2)', border: '1px solid var(--glass-border)',
                        }}>
                          <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', width: 24, textAlign: 'center' }}>
                            {i + 1}
                          </Typography>
                          <Typography sx={{ flex: 1, fontSize: '0.82rem', fontWeight: 600, color: 'var(--foreground)' }}>
                            {a.name}
                          </Typography>
                          {/* Size dropdown */}
                          <select
                            value={a.size}
                            onChange={(e) => {
                              const newAssignments = [...bulkAssignments];
                              newAssignments[i] = { ...newAssignments[i], size: e.target.value };
                              setBulkAssignments(newAssignments);
                            }}
                            style={{
                              padding: '4px 8px', borderRadius: '8px', border: '1px solid var(--glass-border)',
                              background: 'var(--surface)', color: 'var(--foreground)', fontSize: '0.75rem', fontWeight: 700,
                              outline: 'none',
                            }}
                          >
                            {SIZE_ORDER.filter(s => !selectedProduct.sizePricing || selectedProduct.sizePricing[s] !== undefined).map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                          <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#34c759', minWidth: 55, textAlign: 'right' }}>
                            ฿{(price + longFee).toLocaleString()}
                          </Typography>
                        </Box>
                      );
                    })}
                  </Box>

                  {/* Total */}
                  <Box sx={{ mt: 2, p: 1.5, borderRadius: '12px', bgcolor: 'rgba(52,199,89,0.08)', border: '1px solid rgba(52,199,89,0.2)' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--foreground)' }}>
                        {t.bulkOrder.totalPrice}
                      </Typography>
                      <Typography sx={{ fontSize: '1rem', fontWeight: 800, color: '#34c759' }}>
                        ฿{bulkAssignments.reduce((s, a) => {
                          const price = selectedProduct.sizePricing?.[a.size] ?? selectedProduct.basePrice;
                          const longFee = selectedProduct.options?.hasLongSleeve && bulkLongSleeve ? (selectedProduct.options?.longSleevePrice ?? 50) : 0;
                          return s + price + longFee;
                        }, 0).toLocaleString()}
                      </Typography>
                    </Box>
                    <Typography sx={{ fontSize: '0.72rem', color: 'var(--text-muted)', mt: 0.3 }}>
                      {bulkAssignments.length} {t.bulkOrder.pieces}
                    </Typography>
                  </Box>
                </Box>
              )}
            </Box>

            <Divider />

            {/* Footer Actions */}
            <Box sx={{ p: 2, display: 'flex', gap: 1 }}>
              {bulkStep > 0 && (
                <Button
                  onClick={() => setBulkStep(s => s - 1)}
                  sx={{
                    flex: 1, py: 1.2, borderRadius: '14px', border: '1px solid var(--glass-border)',
                    color: 'var(--foreground)', fontWeight: 600, textTransform: 'none', fontSize: '0.85rem',
                  }}
                >
                  {t.bulkOrder.back}
                </Button>
              )}
              {bulkStep < 2 ? (
                <Button
                  onClick={() => {
                    if (bulkStep === 0) {
                      if (bulkTotalQty === 0) { showToast('warning', t.bulkOrder.noSizesSelected); return; }
                      setBulkStep(1);
                    } else if (bulkStep === 1) {
                      if (!bulkNames.trim()) { showToast('warning', t.bulkOrder.noNamesEntered); return; }
                      bulkBuildAssignments();
                      setBulkStep(2);
                    }
                  }}
                  sx={{
                    flex: 2, py: 1.2, borderRadius: '14px',
                    background: 'linear-gradient(135deg, #a855f7 0%, #8b5cf6 100%)',
                    color: 'white', fontWeight: 700, textTransform: 'none', fontSize: '0.85rem',
                    boxShadow: '0 4px 16px rgba(168,85,247,0.3)',
                    '&:hover': { boxShadow: '0 6px 24px rgba(168,85,247,0.4)' },
                  }}
                >
                  {t.bulkOrder.next}
                </Button>
              ) : (
                <>
                  <Button
                    onClick={() => bulkCommitToCart(false)}
                    startIcon={<ShoppingCart size={18} />}
                    sx={{
                      flex: 1, py: 1.2, borderRadius: '14px',
                      background: 'rgba(0,113,227,0.12)', border: '1px solid rgba(0,113,227,0.3)',
                      color: '#2997ff', fontWeight: 700, textTransform: 'none', fontSize: '0.82rem',
                    }}
                  >
                    {t.bulkOrder.addToCart}
                  </Button>
                  <Button
                    onClick={() => bulkCommitToCart(true)}
                    startIcon={<Zap size={18} />}
                    sx={{
                      flex: 1.5, py: 1.2, borderRadius: '14px',
                      background: 'linear-gradient(135deg, #34c759 0%, #34c759 100%)',
                      color: 'white', fontWeight: 800, textTransform: 'none', fontSize: '0.82rem',
                      boxShadow: '0 4px 16px rgba(52,199,89,0.3)',
                    }}
                  >
                    {t.bulkOrder.buyNow}
                  </Button>
                </>
              )}
            </Box>
          </>
        )}
      </Dialog>

      <Box
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.96)' : 'rgba(255,255,255,0.94)',
          borderTop: (theme) => `1px solid ${theme.palette.divider}`,
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          boxShadow: (theme) => theme.palette.mode === 'dark' ? '0 -4px 24px rgba(0,0,0,0.5)' : '0 -2px 16px rgba(0,0,0,0.08)',
          display: { xs: 'flex', md: 'none' },
          justifyContent: 'space-around',
          alignItems: 'flex-end',
          py: 0.5,
          px: 0.5,
          touchAction: 'pan-y',
          WebkitOverflowScrolling: 'touch',
          paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
          zIndex: 1100,
          transform: hideNavBars ? 'translateY(120%)' : 'translateY(0)',
          opacity: hideNavBars ? 0 : 1,
          transition: 'transform 0.32s ease, opacity 0.28s ease',
        }}
      >
        {bottomTabs.map((tab) => {
          const isActive = tab.key === 'chat' ? chatbotOpen : activeTab === tab.key;

          // Center chat button - prominent raised design
          if (tab.center) {
            return (
              <Box
                key={tab.key}
                onClick={(e: React.MouseEvent<HTMLElement>) => setChatMenuAnchor(e.currentTarget)}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 0.2,
                  cursor: 'pointer',
                  mt: -2.5,
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent',
                  userSelect: 'none',
                }}
              >
                <Box
                  sx={{
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #0071e3 0%, #bf5af2 100%)',
                    display: 'grid',
                    placeItems: 'center',
                    color: 'white',
                    boxShadow: '0 4px 16px rgba(0,113,227,0.4), 0 0 0 3px rgba(0,113,227,0.1)',
                    willChange: 'transform',
                    transition: 'transform 0.15s cubic-bezier(0.2, 0, 0, 1)',
                    '&:active': {
                      transform: 'scale(0.92)',
                    },
                  }}
                >
                  {tab.icon}
                </Box>
                <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--primary)', mt: 0.3 }}>
                  {tab.label}
                </Typography>
              </Box>
            );
          }

          // Regular nav tabs
          return (
            <IconButton
              key={tab.key}
              data-tab-key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 0.2,
                color: (theme) => isActive ? 'var(--primary)' : theme.palette.text.secondary,
                borderRadius: '14px',
                px: 1.8,
                py: 0.6,
                minWidth: 56,
                background: (theme) => isActive
                  ? (theme.palette.mode === 'dark' ? 'rgba(0,113,227,0.12)' : 'rgba(0,113,227,0.08)')
                  : 'transparent',
                border: 'none',
                boxShadow: 'none',
                transition: 'all 0.2s ease',
                '&:hover': {
                  background: (theme) => theme.palette.mode === 'dark' ? 'rgba(0,113,227,0.08)' : 'rgba(0,113,227,0.06)',
                },
                touchAction: 'manipulation',
              }}
            >
              <Box sx={{
                transition: 'transform 0.2s ease',
                transform: isActive ? 'scale(1.1)' : 'scale(1)',
              }}>
                {tab.icon}
              </Box>
              <Typography
                variant="caption"
                sx={{
                  fontSize: '0.62rem',
                  fontWeight: isActive ? 800 : 500,
                  color: (theme) => isActive ? 'var(--primary)' : theme.palette.text.secondary,
                  lineHeight: 1.2,
                }}
              >
                {tab.label}
              </Typography>
            </IconButton>
          );
        })}
      </Box>

      {showRefreshDroplet && (
        <Box className="refresh-droplet">
          <span className="droplet" />
          <span className="droplet-ripple" />
        </Box>
      )}

      {/* Enhanced Modern Toast Container */}
      {toasts.length > 0 && (
        <Box
          sx={{
            position: 'fixed',
            bottom: { xs: 90, sm: 32 },
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 99999,
            display: 'flex',
            flexDirection: 'column-reverse',
            gap: 1.5,
            width: { xs: 'calc(100% - 32px)', sm: 'auto' },
            maxWidth: 420,
            pointerEvents: 'none',
          }}
        >
          {toasts.map((t) => {
            const colors = {
              success: { 
                bg: 'linear-gradient(135deg, rgba(16, 185, 129, 0.98) 0%, rgba(5, 150, 105, 0.98) 100%)', 
                icon: <CheckCircle2 size={18} />,
                shadow: '0 8px 32px rgba(16, 185, 129, 0.35)',
              },
              error: { 
                bg: 'linear-gradient(135deg, rgba(239, 68, 68, 0.98) 0%, rgba(220, 38, 38, 0.98) 100%)', 
                icon: <AlertCircle size={18} />,
                shadow: '0 8px 32px rgba(239, 68, 68, 0.35)',
              },
              warning: { 
                bg: 'linear-gradient(135deg, rgba(245, 158, 11, 0.98) 0%, rgba(234, 88, 12, 0.98) 100%)', 
                icon: <AlertTriangle size={18} />,
                shadow: '0 8px 32px rgba(245, 158, 11, 0.35)',
              },
              info: { 
                bg: 'linear-gradient(135deg, rgba(0,113,227, 0.98) 0%, rgba(0,113,227, 0.98) 100%)', 
                icon: <Info size={18} />,
                shadow: '0 8px 32px rgba(0,113,227, 0.35)',
              },
            };
            return (
              <Slide key={t.id} in direction="up" timeout={350}>
                <Box
                  sx={{
                    background: colors[t.type].bg,
                    backdropFilter: 'blur(16px)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '16px',
                    py: 1.5,
                    px: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    boxShadow: colors[t.type].shadow,
                    cursor: 'pointer',
                    pointerEvents: 'auto',
                    animation: 'toastEnterBottom 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
                    '@keyframes toastEnterBottom': {
                      '0%': { opacity: 0, transform: 'translateY(12px) scale(0.96)' },
                      '100%': { opacity: 1, transform: 'translateY(0) scale(1)' },
                    },
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      transform: 'scale(1.02)',
                      boxShadow: `${colors[t.type].shadow}, 0 0 0 2px rgba(255, 255, 255, 0.1)`,
                    },
                  }}
                  onClick={() => setToasts((prev) => prev.filter((toast) => toast.id !== t.id))}
                >
                  <Box 
                    sx={{ 
                      width: 32,
                      height: 32,
                      borderRadius: '10px',
                      bgcolor: 'rgba(255, 255, 255, 0.2)',
                      display: 'grid',
                      placeItems: 'center',
                      color: '#fff', 
                      flexShrink: 0,
                    }}
                  >
                    {colors[t.type].icon}
                  </Box>
                  <Typography
                    sx={{
                      color: '#fff',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      flex: 1,
                      lineHeight: 1.4,
                    }}
                  >
                    {t.message}
                  </Typography>
                  <Box
                    sx={{
                      color: 'var(--foreground)',
                      p: 0.5,
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      '&:hover': { 
                        color: '#fff',
                        bgcolor: 'rgba(255, 255, 255, 0.15)',
                      },
                    }}
                  >
                    <X size={16} />
                  </Box>
                </Box>
              </Slide>
            );
          })}
        </Box>
      )}

      <Backdrop
        open={processing || savingProfile}
        sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 10, backdropFilter: 'blur(2px)', bgcolor: 'var(--glass-bg)' }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
          <CircularProgress color="inherit" size={36} />
          <Typography variant="body2" sx={{ color: 'var(--foreground)' }}>
            {savingProfile ? t.misc.processingData : t.misc.processingOrder}
          </Typography>
        </Box>
      </Backdrop>

      {/* Fullscreen QR Code Dialog */}
      <Dialog
        open={!!showQRFullscreen}
        onClose={() => setShowQRFullscreen(null)}
        fullScreen
        PaperProps={{
          sx: {
            bgcolor: 'var(--background)',
            backgroundImage: (theme) => theme.palette.mode === 'dark' ? 'radial-gradient(circle at 50% 50%, rgba(6, 182, 212, 0.1) 0%, transparent 50%)' : 'radial-gradient(circle at 50% 50%, rgba(0,113,227, 0.06) 0%, transparent 50%)',
          },
        }}
      >
        <Box sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          p: 3,
          position: 'relative',
        }}>
          {/* Close Button */}
          <IconButton
            onClick={() => setShowQRFullscreen(null)}
            sx={{
              position: 'absolute',
              top: 16,
              right: 16,
              bgcolor: 'var(--glass-bg)',
              color: 'var(--foreground)',
              '&:hover': { bgcolor: 'var(--glass-bg)' },
            }}
          >
            <X size={24} />
          </IconButton>

          {/* Header */}
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Box sx={{
              width: 64,
              height: 64,
              borderRadius: '20px',
              background: 'linear-gradient(135deg, #64d2ff 0%, #34c759 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 2,
              boxShadow: '0 8px 32px rgba(6, 182, 212, 0.3)',
            }}>
              <Package size={32} color="white" />
            </Box>
            <Typography sx={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--foreground)', mb: 0.5 }}>
              {t.qrDialog.title}
            </Typography>
            <Typography sx={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              {t.qrDialog.instruction}
            </Typography>
          </Box>

          {/* QR Code */}
          <Box sx={{
            p: 4,
            borderRadius: '24px',
            bgcolor: 'white',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            mb: 3,
          }}>
            <QRCodeSVG
              value={`ORDER:${showQRFullscreen || ''}`}
              size={Math.min(280, typeof window !== 'undefined' ? window.innerWidth - 100 : 280)}
              level="H"
              includeMargin={false}
            />
          </Box>

          {/* Order Ref */}
          <Box sx={{
            px: 3,
            py: 1.5,
            borderRadius: '16px',
            bgcolor: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
            mb: 4,
          }}>
            <Typography sx={{ 
              fontSize: '0.75rem', 
              color: 'var(--text-muted)', 
              textAlign: 'center',
              mb: 0.5,
            }}>
              {t.qrDialog.orderNumber}
            </Typography>
            <Typography sx={{ 
              fontSize: '1.3rem', 
              fontWeight: 800, 
              color: 'var(--secondary)',
              fontFamily: 'monospace',
              textAlign: 'center',
              letterSpacing: '0.05em',
            }}>
              {showQRFullscreen}
            </Typography>
          </Box>

          {/* Pickup Location - Per Product */}
          {(() => {
            // Find the order to get product IDs
            const targetOrder = orderHistory.find((o: any) => o.ref === showQRFullscreen);
            if (!targetOrder) return null;
            
            const orderItems = targetOrder.items || targetOrder.cart || [];
            const productIds = orderItems.map((item: any) => item.productId || item.id).filter(Boolean);
            const productsWithPickup = config?.products?.filter(
              (p) => p.pickup?.enabled && productIds.includes(p.id)
            ) || [];
            
            if (productsWithPickup.length === 0) return null;
            
            const uniqueLocations = [...new Set(productsWithPickup.map(p => p.pickup?.location).filter(Boolean))];
            const firstPickup = productsWithPickup[0]?.pickup;
            
            return (
              <Box sx={{ 
                maxWidth: 360,
                width: '100%',
                p: 2.5, 
                borderRadius: '16px', 
                bgcolor: 'rgba(16,185,129,0.1)',
                border: '1px solid rgba(16,185,129,0.3)',
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <MapPin size={18} style={{ color: 'var(--success)' }} />
                  <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--success)' }}>
                    {t.qrDialog.pickupLocation}
                  </Typography>
                </Box>
                {uniqueLocations.map((loc, idx) => (
                  <Typography key={idx} sx={{ fontSize: '1rem', color: 'var(--foreground)', fontWeight: 600, mb: 0.5 }}>
                    {loc}
                  </Typography>
                ))}
                {firstPickup && (firstPickup.startDate || firstPickup.endDate) && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
                    <Clock size={14} style={{ color: 'var(--text-muted)' }} />
                    <Typography sx={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {firstPickup.startDate && new Date(firstPickup.startDate).toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      {firstPickup.startDate && firstPickup.endDate && ' - '}
                      {firstPickup.endDate && new Date(firstPickup.endDate).toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </Typography>
                  </Box>
                )}
                {firstPickup?.notes && (
                  <Typography sx={{ fontSize: '0.8rem', color: 'var(--warning)', mt: 1 }}>
                     {firstPickup.notes}
                  </Typography>
                )}
              </Box>
            );
          })()}

          {/* Close Button at Bottom */}
          <Button
            onClick={() => setShowQRFullscreen(null)}
            sx={{
              mt: 4,
              px: 4,
              py: 1.5,
              borderRadius: '12px',
              bgcolor: 'var(--glass-bg)',
              color: 'var(--foreground)',
              fontSize: '1rem',
              fontWeight: 600,
              textTransform: 'none',
              '&:hover': { bgcolor: 'var(--glass-bg)' },
            }}
          >
            {t.common.close}
          </Button>
        </Box>
      </Dialog>

      {/* Logout Confirmation Dialog */}
      <Dialog
        open={logoutConfirmOpen}
        onClose={() => setLogoutConfirmOpen(false)}
        PaperProps={{
          sx: {
            borderRadius: '16px',
            bgcolor: 'var(--surface)',
            backdropFilter: 'blur(20px)',
            border: '1px solid var(--glass-border)',
            maxWidth: 360,
          },
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1, color: 'var(--foreground)' }}>
          <TriangleAlert size={22} color="#ff9f0a" />
          {t.nav.confirmLogout}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'var(--text-muted)' }}>
            {t.nav.logoutConfirmMessage}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button
            onClick={() => setLogoutConfirmOpen(false)}
            sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 600, color: 'var(--foreground)' }}
          >
            {t.common.cancel}
          </Button>
          <Button
            onClick={() => signOut()}
            variant="contained"
            color="error"
            sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 600 }}
          >
            {t.nav.logout}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Switch Account Dialog */}
      <Dialog
        open={switchAccountOpen}
        onClose={() => setSwitchAccountOpen(false)}
        fullWidth
        maxWidth="xs"
        PaperProps={{
          sx: {
            borderRadius: '20px',
            bgcolor: 'var(--surface)',
            backdropFilter: 'blur(20px)',
            border: '1px solid var(--glass-border)',
            overflow: 'hidden',
          },
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid var(--glass-border)',
          color: 'var(--foreground)',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ArrowLeftRight size={20} />
            {t.nav.switchAccount}
          </Box>
          <IconButton onClick={() => setSwitchAccountOpen(false)} sx={{ color: 'var(--text-muted)' }}>
            <X size={20} />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Current Account */}
          {session && (
            <Box sx={{
              p: 2, borderRadius: '14px',
              bgcolor: 'rgba(0,113,227,0.08)',
              border: '1px solid rgba(0,113,227,0.2)',
              display: 'flex', alignItems: 'center', gap: 1.5,
            }}>
              <Avatar src={orderData.profileImage || session?.user?.image || ''} sx={{ width: 40, height: 40 }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {session?.user?.name}
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {session?.user?.email}
                </Typography>
              </Box>
              <Chip label={t.common.current} size="small" sx={{ bgcolor: 'rgba(0,113,227,0.15)', color: '#0071e3', fontWeight: 600, fontSize: '0.7rem' }} />
            </Box>
          )}

          <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.85rem', mt: 1 }}>
            {t.nav.selectLoginMethod}
          </Typography>

          {/* Provider Buttons */}
          <Button
            fullWidth
            onClick={() => { setSwitchAccountOpen(false); signIn('google', { redirect: true, callbackUrl: '/', prompt: 'select_account' }); }}
            sx={{
              py: 1.3, borderRadius: '12px', fontWeight: 600, fontSize: '0.9rem', textTransform: 'none',
              background: '#ffffff', color: '#1d1d1f',
              border: '1px solid rgba(0,0,0,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5,
              '&:hover': { background: '#f5f5f7', boxShadow: '0 4px 14px rgba(0,0,0,0.1)' },
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Google
          </Button>

          {availableProviders.includes('azure-ad') && (
            <Button
              fullWidth
              onClick={() => { setSwitchAccountOpen(false); signIn('azure-ad', { redirect: true, callbackUrl: '/' }); }}
              sx={{
                py: 1.3, borderRadius: '12px', fontWeight: 600, fontSize: '0.9rem', textTransform: 'none',
                background: '#2f2f2f', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5,
                '&:hover': { background: '#404040', boxShadow: '0 4px 14px rgba(0,0,0,0.15)' },
              }}
            >
              <svg width="18" height="18" viewBox="0 0 23 23">
                <path fill="#f35325" d="M1 1h10v10H1z"/>
                <path fill="#81bc06" d="M12 1h10v10H12z"/>
                <path fill="#05a6f0" d="M1 12h10v10H1z"/>
                <path fill="#ffba08" d="M12 12h10v10H12z"/>
              </svg>
              Microsoft
            </Button>
          )}

          {availableProviders.includes('facebook') && (
            <Button
              fullWidth
              onClick={() => { setSwitchAccountOpen(false); signIn('facebook', { redirect: true, callbackUrl: '/' }); }}
              sx={{
                py: 1.3, borderRadius: '12px', fontWeight: 600, fontSize: '0.9rem', textTransform: 'none',
                background: '#1877F2', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5,
                '&:hover': { background: '#166FE5', boxShadow: '0 4px 14px rgba(24,119,242,0.3)' },
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              Facebook
            </Button>
          )}

          {availableProviders.includes('apple') && (
            <Button
              fullWidth
              onClick={() => { setSwitchAccountOpen(false); signIn('apple', { redirect: true, callbackUrl: '/' }); }}
              sx={{
                py: 1.3, borderRadius: '12px', fontWeight: 600, fontSize: '0.9rem', textTransform: 'none',
                background: '#000', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5,
                '&:hover': { background: '#1a1a1a', boxShadow: '0 4px 14px rgba(0,0,0,0.2)' },
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.52-3.23 0-1.44.62-2.2.44-3.06-.4C4.24 16.76 4.89 10.87 8.88 10.6c1.24.07 2.1.72 2.83.78.99-.2 1.94-.78 3-.84 1.28-.08 2.25.48 2.88 1.22-2.65 1.58-2.02 5.07.36 6.04-.47 1.2-.97 2.4-1.9 3.48zM12.07 10.5c-.16-2.3 1.74-4.2 3.93-4.5.32 2.5-2.25 4.64-3.93 4.5z"/>
              </svg>
              Apple
            </Button>
          )}

          {availableProviders.includes('line') && (
            <Button
              fullWidth
              onClick={() => { setSwitchAccountOpen(false); signIn('line', { redirect: true, callbackUrl: '/' }); }}
              sx={{
                py: 1.3, borderRadius: '12px', fontWeight: 600, fontSize: '0.9rem', textTransform: 'none',
                background: '#06C755', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5,
                '&:hover': { background: '#05B34C', boxShadow: '0 4px 14px rgba(6,199,85,0.3)' },
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .348-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .349-.281.63-.63.63h-2.386c-.348 0-.63-.281-.63-.63V8.108c0-.348.282-.63.63-.63h2.386c.349 0 .63.282.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .349-.282.63-.631.63-.345 0-.627-.281-.627-.63V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.348.279-.63.63-.63.346 0 .627.282.627.63v4.771zm-5.741 0c0 .349-.282.63-.631.63-.345 0-.627-.281-.627-.63V8.108c0-.348.282-.63.627-.63.349 0 .631.282.631.63v4.771zm-2.466.63H4.917c-.348 0-.63-.281-.63-.63V8.108c0-.348.282-.63.63-.63.349 0 .63.282.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .349-.281.63-.629.63M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
              </svg>
              LINE
            </Button>
          )}

          {/* Passkey Sign In */}
          <Box sx={{ mt: 1 }}>
            <PasskeyLoginButton variant="outlined" />
          </Box>
        </DialogContent>
      </Dialog>

      {/* Chat Selection Popover */}
      <Popover
        open={Boolean(chatMenuAnchor)}
        anchorEl={chatMenuAnchor}
        onClose={() => setChatMenuAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transitionDuration={{ enter: 150, exit: 100 }}
        disableScrollLock
        slotProps={{
          paper: {
            sx: {
              bgcolor: (theme: any) => theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.97)' : 'rgba(255,255,255,0.98)',
              color: (theme: any) => theme.palette.mode === 'dark' ? '#f5f5f7' : '#1d1d1f',
              borderRadius: 3,
              minWidth: 220,
              border: (theme: any) => `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
              boxShadow: (theme: any) => theme.palette.mode === 'dark'
                ? '0 8px 24px rgba(0,0,0,0.5)'
                : '0 8px 24px rgba(0,0,0,0.12)',
              mb: 1,
              overflow: 'hidden',
            },
          },
        }}
      >
        <Box
          onClick={() => {
            setChatMenuAnchor(null);
            setChatbotOpen(true);
          }}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            px: 2.5,
            py: 1.8,
            cursor: 'pointer',
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
            transition: 'background 0.1s',
            '&:active': { bgcolor: (theme: any) => theme.palette.mode === 'dark' ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.1)' },
          }}
        >
          <Bot size={24} color="#30d158" />
          <Box>
            <Typography sx={{ fontSize: '0.9rem', fontWeight: 600 }}>{t.help.askChatbot}</Typography>
            <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{t.help.chatbotDesc}</Typography>
          </Box>
        </Box>
        <Divider sx={{ borderColor: (theme: any) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }} />
        <Box
          onClick={() => {
            setChatMenuAnchor(null);
            setSupportChatOpen(true);
          }}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            px: 2.5,
            py: 1.8,
            cursor: 'pointer',
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
            transition: 'background 0.1s',
            '&:active': { bgcolor: (theme: any) => theme.palette.mode === 'dark' ? 'rgba(0,113,227,0.15)' : 'rgba(0,113,227,0.1)' },
          }}
        >
          <Headphones size={24} color="#0071e3" />
          <Box>
            <Typography sx={{ fontSize: '0.9rem', fontWeight: 600 }}>{t.help.contactAdmin}</Typography>
            <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{t.help.contactAdminDesc}</Typography>
          </Box>
        </Box>
      </Popover>

      {/* Chatbot */}
      <ShirtChatBot open={chatbotOpen} setOpen={setChatbotOpen} />

      {/* Support Chat Widget - ปุ่มแชทสนับสนุน */}
      <SupportChatWidget
        onOpenChatbot={() => setChatbotOpen(true)}
        hideMobileFab
        externalOpen={supportChatOpen}
        onExternalOpenHandled={() => setSupportChatOpen(false)}
      />

      {/* Image Lightbox - Fullscreen Gallery (HomePage) */}
      <Dialog
        open={!!lightboxImage}
        onClose={() => { setLightboxImage(null); setLightboxImages([]); }}
        maxWidth={false}
        fullScreen
        PaperProps={{
          sx: {
            background: 'rgba(0,0,0,0.97)',
            boxShadow: 'none',
          }
        }}
        sx={{
          zIndex: 99999,
          '& .MuiDialog-container': {
            alignItems: 'center',
            justifyContent: 'center',
          },
        }}
      >
        <IconButton
          onClick={() => { setLightboxImage(null); setLightboxImages([]); }}
          sx={{
            position: 'absolute',
            top: { xs: 12, sm: 16 },
            right: { xs: 12, sm: 16 },
            color: 'white',
            bgcolor: 'rgba(255,255,255,0.12)',
            backdropFilter: 'blur(8px)',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
            zIndex: 10,
            width: 44,
            height: 44,
          }}
        >
          <X size={24} />
        </IconButton>
        {lightboxImages.length > 1 && (
          <Box sx={{
            position: 'absolute',
            top: { xs: 16, sm: 20 },
            left: '50%',
            transform: 'translateX(-50%)',
            px: 2.5,
            py: 0.75,
            borderRadius: '24px',
            bgcolor: 'rgba(255,255,255,0.12)',
            backdropFilter: 'blur(8px)',
            zIndex: 10,
          }}>
            <Typography sx={{ fontSize: '0.85rem', color: 'white', fontWeight: 600 }}>
              {lightboxIndex + 1} / {lightboxImages.length}
            </Typography>
          </Box>
        )}
        {lightboxImages.length > 1 && (
          <>
            <IconButton
              onClick={() => setLightboxIndex((prev) => (prev - 1 + lightboxImages.length) % lightboxImages.length)}
              sx={{
                position: 'absolute', top: '50%', left: { xs: 8, sm: 24 },
                transform: 'translateY(-50%)',
                bgcolor: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)',
                color: 'white', zIndex: 10,
                width: { xs: 40, sm: 48 }, height: { xs: 40, sm: 48 },
                '&:hover': { bgcolor: 'rgba(255,255,255,0.2)', transform: 'translateY(-50%) scale(1.05)' },
                transition: 'all 0.2s ease',
              }}
            >
              <ChevronLeft size={24} />
            </IconButton>
            <IconButton
              onClick={() => setLightboxIndex((prev) => (prev + 1) % lightboxImages.length)}
              sx={{
                position: 'absolute', top: '50%', right: { xs: 8, sm: 24 },
                transform: 'translateY(-50%)',
                bgcolor: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)',
                color: 'white', zIndex: 10,
                width: { xs: 40, sm: 48 }, height: { xs: 40, sm: 48 },
                '&:hover': { bgcolor: 'rgba(255,255,255,0.2)', transform: 'translateY(-50%) scale(1.05)' },
                transition: 'all 0.2s ease',
              }}
            >
              <ChevronRight size={24} />
            </IconButton>
          </>
        )}
        {lightboxImage && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', p: { xs: 2, sm: 4 } }}>
            <Box
              component="img"
              src={lightboxImages.length > 1 ? lightboxImages[lightboxIndex] : lightboxImage}
              alt="Full size"
              sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px', userSelect: 'none' }}
            />
          </Box>
        )}
        {lightboxImages.length > 1 && (
          <Box sx={{
            position: 'absolute', bottom: { xs: 16, sm: 24 }, left: '50%', transform: 'translateX(-50%)',
            display: 'flex', gap: 1, px: 2, py: 1, borderRadius: '16px',
            bgcolor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)',
            maxWidth: '90vw', overflowX: 'auto',
          }}>
            {lightboxImages.map((img, idx) => (
              <Box
                key={idx}
                onClick={() => setLightboxIndex(idx)}
                sx={{
                  width: 48, height: 48, borderRadius: '10px',
                  border: lightboxIndex === idx ? '2px solid white' : '2px solid transparent',
                  overflow: 'hidden', cursor: 'pointer',
                  opacity: lightboxIndex === idx ? 1 : 0.5,
                  transition: 'all 0.2s ease', flexShrink: 0,
                  '&:hover': { opacity: 1 },
                }}
              >
                <Box component="img" src={img} alt={`Thumbnail ${idx + 1}`} sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </Box>
            ))}
          </Box>
        )}
      </Dialog>

      {/* ===== Review Dialog ===== */}
      <Dialog
        open={reviewDialogOpen}
        onClose={() => setReviewDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '20px',
            bgcolor: 'var(--background)',
            backgroundImage: 'none',
            border: '1px solid var(--glass-border)',
            mx: 2,
          },
        }}
        sx={{ zIndex: 9000 }}
      >
        <Box sx={{ p: 3 }}>
          <Typography sx={{ fontSize: '1.1rem', fontWeight: 700, mb: 2, color: 'var(--foreground)' }}>
            {t.reviews.writeReview}
          </Typography>

          {/* Star Rating */}
          <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', mb: 1 }}>{t.reviews.rating}</Typography>
          <Box sx={{ display: 'flex', gap: 0.5, mb: 2 }}>
            {[1, 2, 3, 4, 5].map((s) => (
              <IconButton
                key={s}
                onClick={() => setReviewRating(s)}
                sx={{ 
                  p: 0.5,
                  color: s <= reviewRating ? '#ff9f0a' : 'var(--text-muted)',
                  transition: 'all 0.15s ease',
                  '&:hover': { transform: 'scale(1.2)' },
                }}
              >
                <Star size={28} fill={s <= reviewRating ? '#ff9f0a' : 'none'} />
              </IconButton>
            ))}
          </Box>

          {/* Comment */}
          <TextField
            multiline
            rows={3}
            fullWidth
            value={reviewComment}
            onChange={(e) => setReviewComment(e.target.value)}
            placeholder={t.reviews.commentPlaceholder}
            inputProps={{ maxLength: 500 }}
            sx={{
              mb: 2,
              '& .MuiOutlinedInput-root': {
                borderRadius: '14px',
                bgcolor: 'var(--surface-2)',
                color: 'var(--foreground)',
                fontSize: '0.9rem',
                '& fieldset': { borderColor: 'var(--glass-border)' },
                '&:hover fieldset': { borderColor: 'rgba(0,113,227,0.3)' },
                '&.Mui-focused fieldset': { borderColor: '#0071e3' },
              },
            }}
          />

          {/* Actions */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              onClick={() => setReviewDialogOpen(false)}
              sx={{ flex: 1, borderRadius: '12px', color: 'var(--text-muted)', border: '1px solid var(--glass-border)' }}
            >
              {t.common.cancel}
            </Button>
            <Button
              onClick={() => {
                if (reviewRating === 0) {
                  showToast('warning', t.reviews.rating);
                  return;
                }
                const review = {
                  id: Date.now().toString(),
                  userName: session?.user?.name || 'Anonymous',
                  userImage: session?.user?.image || '',
                  rating: reviewRating,
                  comment: reviewComment,
                  date: new Date().toISOString(),
                  verified: true,
                  helpful: 0,
                };
                setProductReviews((prev) => ({
                  ...prev,
                  [selectedProduct?.id || '']: [...(prev[selectedProduct?.id || ''] || []), review],
                }));
                setReviewDialogOpen(false);
                showToast('success', t.reviews.thankYou);
              }}
              disabled={reviewRating === 0}
              sx={{
                flex: 2,
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #0071e3 0%, #2997ff 100%)',
                color: 'white',
                fontWeight: 700,
                '&:disabled': { background: 'rgba(100,116,139,0.15)', color: 'var(--text-muted)' },
              }}
            >
              {t.reviews.submit}
            </Button>
          </Box>
        </Box>
      </Dialog>
    </Box>
  );
}
