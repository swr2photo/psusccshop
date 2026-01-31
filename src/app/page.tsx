'use client';

import React from 'react';
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

// ==================== CHATBOT COMPONENT (Enhanced with Logo & AI) ====================
const QUICK_QUESTIONS_DATA = [
  { icon: 'cart', label: 'วิธีสั่งซื้อ' },
  { icon: 'price', label: 'ราคาสินค้า' },
  { icon: 'size', label: 'ไซซ์และขนาด' },
  { icon: 'shipping', label: 'การจัดส่ง' },
  { icon: 'payment', label: 'วิธีชำระเงิน' },
  { icon: 'help', label: 'ติดต่อร้าน' },
];

// Helper to render quick question icon
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

const QUICK_QUESTIONS = QUICK_QUESTIONS_DATA.map(q => q.label);

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
    
    // Reset file input
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

  // Toggle fullscreen mode
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
            <Box component="span" sx={{ color: '#a5b4fc', flexShrink: 0 }}>•</Box>
            <span>{renderTextSegment(bulletMatch[1])}</span>
          </Box>
        );
      }
      
      // Check if it's a numbered list
      const numberedMatch = line.match(/^[\s]*(\d+)[.\)]\s*(.*)/);
      if (numberedMatch) {
        return (
          <Box key={lineIdx} sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, my: 0.25 }}>
            <Box component="span" sx={{ color: '#a5b4fc', flexShrink: 0, minWidth: 16 }}>{numberedMatch[1]}.</Box>
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
        return <strong key={i} style={{ color: '#e0e7ff' }}>{part.slice(2, -2)}</strong>;
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
            sx={{ color: '#818cf8', textDecoration: 'underline', '&:hover': { color: '#a5b4fc' } }}
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
            background: 'linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.03) 100%)',
            backdropFilter: 'blur(32px) saturate(180%)',
            WebkitBackdropFilter: 'blur(32px) saturate(180%)',
            border: isFullscreen ? 'none' : '1px solid rgba(255,255,255,0.15)',
            boxShadow: isFullscreen ? 'none' : '0 20px 40px rgba(0, 0, 0, 0.4)',
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
            background: 'linear-gradient(180deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%)',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            {/* Logo Container - Glass effect */}
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

        {/* Messages Area - Frosted Glass */}
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
          {/* Welcome Message - Liquid Glass */}
          {messages.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 3 }}>
              {/* Logo in Welcome */}
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
                      // Scroll to the original message
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
                {/* Message Meta - Time & Source */}
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
                  {/* Edited indicator */}
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
                  {/* Edit Button - Only for user messages */}
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
                  {/* Reply Button */}
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
                  {/* Copy Button */}
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

                {/* Related Questions - Glass Style */}
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

        {/* Input Area - Compact */}
        <Box sx={{ 
          px: 1.5,
          pt: (replyToMessage || editingMessage) ? 0.5 : 1,
          pb: 1.25,
          background: 'rgba(255,255,255,0.05)',
          borderTop: (replyToMessage || editingMessage) ? 'none' : '1px solid rgba(255,255,255,0.08)',
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
            
            {/* Input Container with Image Preview inside */}
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
} from 'lucide-react';
import PaymentFlow from '@/components/PaymentFlow';
import ProfileModal from '@/components/ProfileModal';
import Footer from '@/components/Footer';
import TurnstileWidget from '@/components/TurnstileWidget';
import { ShopStatusBanner, getProductStatus, getShopStatus, SHOP_STATUS_CONFIG, type ShopStatusType } from '@/components/ShopStatusCard';
import OptimizedImage, { preloadImages, OptimizedBackground } from '@/components/OptimizedImage';
import CartDrawer from '@/components/CartDrawer';
import OrderHistoryDrawer from '@/components/OrderHistoryDrawer';
import CheckoutDialog from '@/components/CheckoutDialog';
import LoadingScreen from '@/components/LoadingScreen';
import SupportChatWidget from '@/components/SupportChatWidget';
import { Product, ShopConfig, SIZES } from '@/lib/config';
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
  PENDING: '#f59e0b',
  PAID: '#10b981',
  READY: '#10b981',
  SHIPPED: '#0ea5e9',
  COMPLETED: '#22c55e',
  CANCELLED: '#ef4444',
  WAITING_PAYMENT: '#f59e0b',
  AWAITING_PAYMENT: '#f59e0b',
  UNPAID: '#f59e0b',
  DRAFT: '#f59e0b',
  VERIFYING: '#06b6d4',
  WAITING_SLIP: '#06b6d4',
  REJECTED: '#ef4444',
  FAILED: '#ef4444',
  REFUNDED: '#8b5cf6',
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
  CREW: 'เสื้อ Crew',
  HOODIE: 'ฮู้ดดี้',
  SHIRT: 'เสื้อเชิ้ต',
  TSHIRT: 'เสื้อยืด',
  POLO: 'เสื้อโปโล',
  JACKET: 'แจ็กเก็ต',
  CAP: 'หมวก',
  ACCESSORY: 'ของที่ระลึก',
  OTHER: 'อื่นๆ',
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
  blue: '#3b82f6',
  red: '#ef4444',
  green: '#22c55e',
  emerald: '#10b981',
  orange: '#f97316',
};

// Shop status helpers imported from ShopStatusCard component

// Helper to get announcement color (supports both named colors and hex)
const getAnnouncementColor = (color: string | undefined): string => {
  if (!color) return '#3b82f6';
  // If it's a hex color, return it directly
  if (color.startsWith('#')) return color;
  // Otherwise, look up in the map
  return ANNOUNCEMENT_COLOR_MAP[color] || '#3b82f6';
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
const normalizeEngName = (value: string) => value.replace(/[^a-zA-Z\s]/g, '').toUpperCase().slice(0, 7).trim();
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

export default function HomePage() {
  const { data: session, status } = useSession();
  const isMobile = useMediaQuery('(max-width:600px)');

  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  
  // Chatbot dialog state
  const [chatbotOpen, setChatbotOpen] = useState(false);

  const [config, setConfig] = useState<ShopConfig | null>(null);
  const [shippingConfig, setShippingConfig] = useState<ShippingConfig | null>(null);
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
  const [editingCartItem, setEditingCartItem] = useState<CartItem | null>(null);

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
  });
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
  const [navHidden, setNavHidden] = useState(false);
  const lastScrollYRef = useRef(0);
  const scrollIdleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showRefreshDroplet, setShowRefreshDroplet] = useState(false);
  const hideNavBars = navHidden || productDialogOpen;

  const [toasts, setToasts] = useState<Toast[]>([]);
  const [inlineNotice, setInlineNotice] = useState<Toast | null>(null);
  const toastTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const ToastTransition = (props: any) => <Slide {...props} direction="down" />;

  const bottomTabs = useMemo(
    () => [
      { key: 'home', label: 'หน้าแรก', icon: <Home size={22} /> },
      {
        key: 'cart',
        label: 'ตะกร้า',
        icon: (
          <Badge badgeContent={cart.length} color="error">
            <ShoppingCart size={22} />
          </Badge>
        ),
      },
      { key: 'history', label: 'ประวัติ', icon: <History size={22} /> },
      { key: 'profile', label: 'โปรไฟล์', icon: <User size={22} /> },
    ],
    [cart.length],
  );


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
            color: '#f1f5f9',
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

  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onScroll = () => {
      const currentY = window.scrollY;
      const delta = Math.abs(currentY - lastScrollYRef.current);
      lastScrollYRef.current = currentY;

      if (delta < 2) return;

      setNavHidden(true);
      if (scrollIdleTimer.current) clearTimeout(scrollIdleTimer.current);
      scrollIdleTimer.current = setTimeout(() => setNavHidden(false), 220);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
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
          };
          setOrderData((prev) => ({ ...prev, ...sanitizedProfile, email: session.user?.email || prev.email }));

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

  useEffect(() => {
    if (selectedProduct) setActiveImageIndex(0);
  }, [selectedProduct]);

  // 🔔 Auto-cycle through announcements
  useEffect(() => {
    const enabledAnnouncements = announcements?.filter(a => a.enabled) || [];
    if (enabledAnnouncements.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentAnnouncementIndex(prev => (prev + 1) % enabledAnnouncements.length);
    }, 8000); // Change every 8 seconds
    
    return () => clearInterval(interval);
  }, [announcements]);

  // 🔔 Check if announcement was dismissed in this session
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const dismissed = sessionStorage.getItem('announcementDismissed');
    if (dismissed === 'true') {
      setShowAnnouncementPopup(false);
    }
  }, []);

  // 🔴 Auto-close product dialog when shop becomes closed
  useEffect(() => {
    if (!isShopOpen && productDialogOpen) {
      setProductDialogOpen(false);
      setSelectedProduct(null);
      setProductOptions({ size: '', quantity: 1, customName: '', customNumber: '', isLongSleeve: false });
      showToast('warning', 'ร้านค้าปิดชั่วคราว ไม่สามารถสั่งซื้อได้');
    }
    // Also close order dialog if shop is closed
    if (!isShopOpen && showOrderDialog) {
      setShowOrderDialog(false);
      showToast('warning', 'ร้านค้าปิดชั่วคราว ไม่สามารถสั่งซื้อได้');
    }
  }, [isShopOpen, productDialogOpen, showOrderDialog]);

  // 🔄 Realtime config updates via Supabase + fallback polling for visibility changes
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
  const { isConnected: realtimeConnected, connectionError: realtimeError } = useRealtimeOrdersByEmail(
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

  useEffect(() => {
    if (!selectedProduct) return;
    const sizeKeys = Object.keys(selectedProduct.sizePricing || {});
    const defaultSize = sizeKeys.length > 0 ? sizeKeys[0] : 'ฟรีไซส์';
    setProductOptions((prev) => ({ ...prev, size: defaultSize }));
  }, [selectedProduct]);


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
      showToast('warning', 'ร้านค้าปิดชั่วคราว ไม่สามารถสั่งซื้อได้');
      return null;
    }
    
    if (!selectedProduct || !productOptions.size) {
      // Scroll to size selector and show visual feedback
      sizeSelectorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => {
        sizeSelectorRef.current?.classList.add('shake-highlight');
        setTimeout(() => sizeSelectorRef.current?.classList.remove('shake-highlight'), 600);
      }, 300);
      return null;
    }

    const normalizedCustomName = normalizeEngName(productOptions.customName);

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

    const basePrice = selectedProduct.sizePricing?.[productOptions.size] ?? selectedProduct.basePrice;
    const longSleeveFee = selectedProduct.options?.hasLongSleeve && productOptions.isLongSleeve 
      ? (selectedProduct.options?.longSleevePrice ?? 50) 
      : 0;
    const unitPrice = basePrice + longSleeveFee;
    const quantity = clampQty(productOptions.quantity);

    return {
      id: `${selectedProduct.id}-${productOptions.size}-${normalizedCustomName}-${productOptions.customNumber}-${productOptions.isLongSleeve}`,
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      size: productOptions.size,
      quantity,
      unitPrice,
      options: {
        customName: normalizedCustomName,
        customNumber: productOptions.customNumber,
        isLongSleeve: productOptions.isLongSleeve,
      },
    };
  };

  const commitCartItem = (item: CartItem, options?: { goCheckout?: boolean }) => {
    const newCart = [...cart, item];
    saveCart(newCart);
    showToast('success', options?.goCheckout ? 'เพิ่มแล้ว ไปชำระเงิน' : 'เพิ่มสินค้าลงตะกร้าแล้ว');
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

  const removeFromCart = (id: string) => {
    const newCart = cart.filter((item) => item.id !== id);
    saveCart(newCart);
    showToast('success', 'ลบสินค้าออกจากตะกร้าแล้ว');
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
    showToast('success', 'อัปเดตสินค้าในตะกร้าแล้ว');
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
    }, 120);
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
    }, 140);
  };

  const getTotalPrice = useCallback(() => {
    return cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  }, [cart]);

  const getStatusLabel = (status: string): string => STATUS_LABELS[normalizeStatus(status)] || status;
  const getStatusColor = (status: string): string => STATUS_COLORS[normalizeStatus(status)] || '#475569';

  // Calculate current price for product dialog
  const getCurrentPrice = useCallback(() => {
    if (!selectedProduct) return 0;
    const basePrice = selectedProduct.sizePricing?.[productOptions.size] ?? selectedProduct.basePrice;
    const longSleeveFee = selectedProduct.options?.hasLongSleeve && productOptions.isLongSleeve 
      ? (selectedProduct.options?.longSleevePrice ?? 50) 
      : 0;
    return (basePrice + longSleeveFee) * productOptions.quantity;
  }, [selectedProduct, productOptions]);

  const renderProductDialog = () => {
    if (!selectedProduct) return null;

    const productContent = (
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#0a0f1a', color: '#f1f5f9' }}>
        {/* Header - Enhanced Design */}
        <Box sx={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          background: 'linear-gradient(180deg, rgba(10,15,26,0.98) 0%, rgba(15,23,42,0.95) 100%)',
          backdropFilter: 'blur(24px)',
        }}>
          {isMobile && (
            <Box sx={{ 
              width: 40, 
              height: 5, 
              bgcolor: 'rgba(255,255,255,0.25)', 
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
                color: '#f1f5f9', 
                overflow: 'hidden', 
                textOverflow: 'ellipsis', 
                whiteSpace: 'nowrap',
                letterSpacing: '-0.02em',
              }}>
                {selectedProduct.name}
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
                        {tag.text}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>

            <IconButton 
              onClick={() => setProductDialogOpen(false)} 
              sx={{ 
                color: '#94a3b8', 
                bgcolor: 'rgba(255,255,255,0.06)', 
                border: '1px solid rgba(255,255,255,0.1)',
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
                  info: 'linear-gradient(135deg, rgba(59, 130, 246, 0.98) 0%, rgba(37, 99, 235, 0.98) 100%)',
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
                  info: '0 8px 32px rgba(59, 130, 246, 0.35)',
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
                {/* Main Image */}
                <Box sx={{ 
                  position: 'relative', 
                  borderRadius: '24px', 
                  overflow: 'hidden',
                  bgcolor: 'rgba(30,41,59,0.6)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
                }}>
                  <Box
                    component="img"
                    src={productImages[activeImageIndex] || productImages[0]}
                    alt={`${selectedProduct.name} - รูปที่ ${activeImageIndex + 1}`}
                    loading="lazy"
                    sx={{ 
                      width: '100%', 
                      height: { xs: 300, sm: 380, md: 440 }, 
                      objectFit: 'cover', 
                      display: 'block',
                      transition: 'transform 0.3s ease',
                    }}
                  />
                  {/* Gradient overlay at bottom */}
                  <Box sx={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: 80,
                    background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.6) 100%)',
                    pointerEvents: 'none',
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
                          border: '1px solid rgba(255,255,255,0.1)',
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
                          border: '1px solid rgba(255,255,255,0.1)',
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
                        backdropFilter: 'blur(12px)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.75,
                      }}>
                        <Box sx={{ 
                          width: 6, 
                          height: 6, 
                          borderRadius: '50%', 
                          bgcolor: '#6366f1',
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
                    '&::-webkit-scrollbar-track': { bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 2 },
                    '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(99,102,241,0.3)', borderRadius: 2 },
                  }}>
                    {productImages.map((img, idx) => (
                      <Box
                        key={idx}
                        onClick={() => setActiveImageIndex(idx)}
                        sx={{
                          width: 72,
                          height: 72,
                          borderRadius: '14px',
                          border: activeImageIndex === idx ? '2px solid #6366f1' : '1px solid rgba(255,255,255,0.12)',
                          overflow: 'hidden',
                          cursor: 'pointer',
                          opacity: activeImageIndex === idx ? 1 : 0.55,
                          transform: activeImageIndex === idx ? 'scale(1.02)' : 'scale(1)',
                          transition: 'all 0.25s ease',
                          flexShrink: 0,
                          boxShadow: activeImageIndex === idx ? '0 4px 16px rgba(99,102,241,0.3)' : 'none',
                          '&:hover': { opacity: 1, borderColor: 'rgba(99,102,241,0.5)' },
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
                bgcolor: 'rgba(30,41,59,0.4)',
                border: '2px dashed rgba(255,255,255,0.12)', 
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
                  <Store size={28} color="#64748b" />
                </Box>
                <Typography sx={{ color: '#64748b', fontSize: '0.9rem', fontWeight: 500 }}>
                  ไม่มีรูปภาพสินค้า
                </Typography>
              </Box>
            )}
          </Box>

          {/* Description - Enhanced Premium Design */}
          {selectedProduct.description && (
            <Box sx={{
              p: 0,
              mb: 3,
              borderRadius: '20px',
              background: 'linear-gradient(145deg, rgba(15,23,42,0.8) 0%, rgba(30,41,59,0.6) 100%)',
              border: '1px solid rgba(99,102,241,0.2)',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: '0 4px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
            }}>
              {/* Header */}
              <Box sx={{
                px: 2.5,
                py: 1.5,
                background: 'linear-gradient(90deg, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.1) 100%)',
                borderBottom: '1px solid rgba(99,102,241,0.15)',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}>
                <Box sx={{
                  width: 28,
                  height: 28,
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(99,102,241,0.4)',
                }}>
                  <Info size={14} color="#fff" />
                </Box>
                <Typography sx={{ 
                  fontSize: '0.85rem', 
                  fontWeight: 700, 
                  color: '#e2e8f0',
                  letterSpacing: '0.02em',
                }}>
                  รายละเอียดสินค้า
                </Typography>
              </Box>
              
              {/* Content */}
              <Box sx={{ p: 2.5 }}>
                {selectedProduct.description.split('\n').map((line, idx) => {
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
                          background: 'linear-gradient(135deg, rgba(99,102,241,0.2) 0%, rgba(139,92,246,0.15) 100%)',
                          border: '1px solid rgba(99,102,241,0.3)',
                        }}>
                          <Typography sx={{ 
                            fontSize: '0.78rem', 
                            fontWeight: 600, 
                            color: '#a5b4fc',
                          }}>
                            {label}
                          </Typography>
                        </Box>
                        <Typography sx={{ 
                          fontSize: '0.88rem', 
                          color: '#cbd5e1', 
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
                  const startsWithBullet = /^[•●○◆◇▪▫★☆✓✔✗✘→➤►]/u.test(trimmedLine);
                  
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
                          bgcolor: '#8b5cf6',
                          mt: 0.8,
                          flexShrink: 0,
                        }} />
                        <Typography sx={{ 
                          fontSize: '0.88rem', 
                          color: '#cbd5e1', 
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
                      color: '#cbd5e1', 
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
                background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)',
                pointerEvents: 'none',
              }} />
            </Box>
          )}

          {/* Size Chart & Selection - Enhanced Modern Design */}
          <Box sx={{
            p: { xs: 2.5, sm: 3 },
            mb: 2.5,
            borderRadius: '20px',
            background: 'linear-gradient(135deg, rgba(30,41,59,0.6) 0%, rgba(30,41,59,0.3) 100%)',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
          }}>
            {/* Size Chart Table - Now at Top */}
            <Box sx={{ 
              mb: 3, 
              p: 2, 
              borderRadius: '16px', 
              bgcolor: 'rgba(15,23,42,0.6)',
              border: '1px solid rgba(99,102,241,0.2)',
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <Ruler size={16} color="#a5b4fc" />
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: '#a5b4fc' }}>
                  ตารางไซส์ (นิ้ว)
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
                '&::-webkit-scrollbar-track': { bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 2 },
                '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(99,102,241,0.3)', borderRadius: 2 },
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
                        bgcolor: isSelected ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.03)',
                        border: isSelected ? '2px solid rgba(99,102,241,0.5)' : '1px solid rgba(255,255,255,0.08)',
                        textAlign: 'center',
                      }}
                    >
                      <Typography sx={{ 
                        fontSize: '0.85rem', 
                        fontWeight: 800, 
                        color: isSelected ? '#a5b4fc' : '#e2e8f0',
                        mb: 0.5,
                      }}>
                        {size}
                      </Typography>
                      <Box sx={{ fontSize: '0.65rem', color: '#64748b' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 0.5 }}>
                          <span>อก</span>
                          <span style={{ color: isSelected ? '#a5b4fc' : '#94a3b8', fontWeight: 600 }}>
                            {measurement?.chest || '-'}
                          </span>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 0.5 }}>
                          <span>ยาว</span>
                          <span style={{ color: isSelected ? '#a5b4fc' : '#94a3b8', fontWeight: 600 }}>
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
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                },
              }}>
                {/* Header Row */}
                <Box sx={{ bgcolor: 'rgba(99,102,241,0.15)', fontWeight: 700, color: '#a5b4fc', borderRadius: '6px 0 0 0' }}>ขนาด</Box>
                <Box sx={{ display: 'grid !important', gridTemplateColumns: `repeat(${displaySizes.length}, 1fr)`, bgcolor: 'rgba(99,102,241,0.08)' }}>
                  {displaySizes.map((size, idx) => (
                    <Box key={size} sx={{ 
                      fontWeight: 700, 
                      color: productOptions.size === size ? '#818cf8' : '#94a3b8',
                      borderRight: idx < displaySizes.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                      bgcolor: productOptions.size === size ? 'rgba(99,102,241,0.2)' : 'transparent',
                    }}>
                      {size}
                    </Box>
                  ))}
                </Box>
                {/* Chest Row */}
                <Box sx={{ bgcolor: 'rgba(255,255,255,0.03)', color: '#94a3b8', fontWeight: 600 }}>รอบอก</Box>
                <Box sx={{ display: 'grid !important', gridTemplateColumns: `repeat(${displaySizes.length}, 1fr)` }}>
                  {displaySizes.map((size, idx) => {
                    const sizeKey = size as keyof typeof SIZE_MEASUREMENTS;
                    const measurement = SIZE_MEASUREMENTS[sizeKey];
                    return (
                      <Box key={size} sx={{ 
                        color: productOptions.size === size ? '#e2e8f0' : '#64748b',
                        borderRight: idx < displaySizes.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                        bgcolor: productOptions.size === size ? 'rgba(99,102,241,0.1)' : 'transparent',
                      }}>
                        {measurement?.chest || '-'}
                      </Box>
                    );
                  })}
                </Box>
                {/* Length Row */}
                <Box sx={{ bgcolor: 'rgba(255,255,255,0.03)', color: '#94a3b8', fontWeight: 600, borderRadius: '0 0 0 6px', borderBottom: 'none !important' }}>ความยาว</Box>
                <Box sx={{ display: 'grid !important', gridTemplateColumns: `repeat(${displaySizes.length}, 1fr)`, borderBottom: 'none !important' }}>
                  {displaySizes.map((size, idx) => {
                    const sizeKey = size as keyof typeof SIZE_MEASUREMENTS;
                    const measurement = SIZE_MEASUREMENTS[sizeKey];
                    return (
                      <Box key={size} sx={{ 
                        color: productOptions.size === size ? '#e2e8f0' : '#64748b',
                        borderRight: idx < displaySizes.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                        bgcolor: productOptions.size === size ? 'rgba(99,102,241,0.1)' : 'transparent',
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
                bgcolor: 'rgba(99,102,241,0.15)',
                display: 'grid',
                placeItems: 'center',
              }}>
                <Tag size={18} color="#a5b4fc" />
              </Box>
              <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: '#e2e8f0' }}>
                เลือกขนาด
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
                      border: active ? '2px solid #6366f1' : '1px solid rgba(255,255,255,0.1)',
                      bgcolor: active ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.03)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      minWidth: 75,
                      position: 'relative',
                      '&:hover': { 
                        borderColor: active ? '#6366f1' : 'rgba(99,102,241,0.5)',
                        bgcolor: active ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.08)',
                      },
                    }}
                  >
                    <Typography sx={{ fontSize: '1rem', fontWeight: 800, color: active ? '#a5b4fc' : '#e2e8f0' }}>
                      {size}
                    </Typography>
                    <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: active ? '#818cf8' : '#64748b', mb: 0.3 }}>
                      ฿{price.toLocaleString()}
                    </Typography>
                    {measurement && (
                      <Typography sx={{ fontSize: '0.6rem', color: active ? '#6ee7b7' : '#475569' }}>
                        {measurement.chest}" × {measurement.length}"
                      </Typography>
                    )}
                  </Box>
                );
              })}
            </Box>
          </Box>

          {/* Additional Options */}
          {(selectedProduct.options?.hasCustomName || selectedProduct.options?.hasCustomNumber || selectedProduct.options?.hasLongSleeve) && (
            <Box sx={{
              p: { xs: 2, sm: 2.5 },
              mb: 2,
              borderRadius: '18px',
              bgcolor: 'rgba(30,41,59,0.5)',
              border: '1px solid rgba(255,255,255,0.08)',
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
                  <Tag size={18} color="#6ee7b7" />
                </Box>
                <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: '#e2e8f0' }}>
                  ตัวเลือกเพิ่มเติม
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {selectedProduct.options?.hasCustomName && (
                  <TextField
                    label="ชื่อติดเสื้อ (ภาษาอังกฤษ สูงสุด 7 ตัว)"
                    fullWidth
                    value={productOptions.customName}
                    onChange={(e) => setProductOptions({ ...productOptions, customName: normalizeEngName(e.target.value) })}
                    inputProps={{ maxLength: 7 }}
                    inputRef={customNameInputRef}
                    placeholder="เช่น JOHN"
                    sx={{ 
                      '& .MuiOutlinedInput-root': { 
                        color: '#f1f5f9',
                        borderRadius: '12px',
                        '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
                        '&:hover fieldset': { borderColor: 'rgba(99,102,241,0.5)' },
                        '&.Mui-focused fieldset': { borderColor: '#6366f1' },
                      }, 
                      '& label': { color: '#64748b' },
                      '& label.Mui-focused': { color: '#a5b4fc' },
                    }}
                  />
                )}

                {selectedProduct.options?.hasCustomNumber && (
                  <TextField
                    label="หมายเลขเสื้อ (0-99) *จำเป็น"
                    fullWidth
                    value={productOptions.customNumber}
                    onChange={(e) => setProductOptions({ ...productOptions, customNumber: normalizeDigits99(e.target.value) })}
                    inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
                    inputRef={customNumberInputRef}
                    placeholder="เช่น 10"
                    sx={{ 
                      '& .MuiOutlinedInput-root': { 
                        color: '#f1f5f9',
                        borderRadius: '12px',
                        '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
                        '&:hover fieldset': { borderColor: 'rgba(99,102,241,0.5)' },
                        '&.Mui-focused fieldset': { borderColor: '#6366f1' },
                      }, 
                      '& label': { color: '#64748b' },
                      '& label.Mui-focused': { color: '#a5b4fc' },
                    }}
                  />
                )}

                {selectedProduct.options?.hasLongSleeve && (
                  <Box 
                    onClick={() => setProductOptions({ ...productOptions, isLongSleeve: !productOptions.isLongSleeve })}
                    sx={{
                      p: 2,
                      borderRadius: '12px',
                      border: productOptions.isLongSleeve ? '2px solid #f59e0b' : '1px solid rgba(255,255,255,0.1)',
                      bgcolor: productOptions.isLongSleeve ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.02)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.2s ease',
                      '&:hover': { borderColor: productOptions.isLongSleeve ? '#f59e0b' : 'rgba(245,158,11,0.5)' },
                    }}
                  >
                    <Box>
                      <Typography sx={{ fontSize: '0.95rem', fontWeight: 600, color: '#e2e8f0' }}>
                        แขนยาว
                      </Typography>
                      <Typography sx={{ fontSize: '0.8rem', color: '#64748b' }}>
                        เพิ่ม ฿{selectedProduct.options?.longSleevePrice ?? 50} ต่อตัว
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
            background: 'linear-gradient(135deg, rgba(30,41,59,0.6) 0%, rgba(30,41,59,0.3) 100%)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{
                  width: 40,
                  height: 40,
                  borderRadius: '12px',
                  bgcolor: 'rgba(99,102,241,0.15)',
                  display: 'grid',
                  placeItems: 'center',
                }}>
                  <Package size={20} color="#a5b4fc" />
                </Box>
                <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#e2e8f0' }}>
                  จำนวน
                </Typography>
              </Box>
              <Box sx={{
                display: 'flex',
                alignItems: 'center',
                bgcolor: 'rgba(0,0,0,0.3)',
                borderRadius: '16px',
                border: '1px solid rgba(255,255,255,0.12)',
                overflow: 'hidden',
              }}>
                <IconButton
                  onClick={() => setProductOptions({ ...productOptions, quantity: clampQty(productOptions.quantity - 1) })}
                  sx={{ 
                    color: '#94a3b8', 
                    p: 1.5, 
                    borderRadius: 0,
                    '&:hover': { color: '#f87171', bgcolor: 'rgba(239,68,68,0.1)' },
                    transition: 'all 0.2s ease',
                  }}
                >
                  <Minus size={20} />
                </IconButton>
                <Typography sx={{ 
                  color: '#f1f5f9', 
                  minWidth: 56, 
                  textAlign: 'center',
                  fontWeight: 800,
                  fontSize: '1.2rem',
                  borderLeft: '1px solid rgba(255,255,255,0.08)',
                  borderRight: '1px solid rgba(255,255,255,0.08)',
                  py: 0.5,
                }}>
                  {productOptions.quantity}
                </Typography>
                <IconButton
                  onClick={() => setProductOptions({ ...productOptions, quantity: clampQty(productOptions.quantity + 1) })}
                  sx={{ 
                    color: '#94a3b8', 
                    p: 1.5, 
                    borderRadius: 0,
                    '&:hover': { color: '#10b981', bgcolor: 'rgba(16,185,129,0.1)' },
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
          borderTop: '1px solid rgba(255,255,255,0.1)',
          background: 'linear-gradient(180deg, rgba(10,15,26,0.98) 0%, rgba(5,10,20,0.99) 100%)',
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
              <Typography sx={{ fontSize: '0.78rem', color: '#6ee7b7', fontWeight: 600, mb: 0.3 }}>ราคารวม</Typography>
              <Typography sx={{ 
                fontSize: '1.75rem', 
                fontWeight: 900, 
                color: '#10b981',
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
                bgcolor: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.1)',
                mb: 0.5,
              }}>
                <Typography sx={{ fontSize: '0.85rem', color: '#e2e8f0', fontWeight: 700 }}>
                  {productOptions.size} × {productOptions.quantity}
                </Typography>
              </Box>
              {productOptions.isLongSleeve && selectedProduct && (
                <Typography sx={{ fontSize: '0.72rem', color: '#fbbf24', fontWeight: 600 }}>+ แขนยาว ฿{selectedProduct.options?.longSleevePrice ?? 50}</Typography>
              )}
            </Box>
          </Box>

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
                  ? 'linear-gradient(135deg, rgba(99,102,241,0.2) 0%, rgba(139,92,246,0.15) 100%)'
                  : 'rgba(100,116,139,0.1)',
                border: isShopOpen ? '1px solid rgba(99,102,241,0.4)' : '1px solid rgba(100,116,139,0.2)',
                color: isShopOpen ? '#a5b4fc' : '#64748b',
                fontSize: '0.95rem',
                fontWeight: 700,
                textTransform: 'none',
                boxShadow: isShopOpen ? '0 4px 20px rgba(99,102,241,0.2)' : 'none',
                transition: 'all 0.25s ease',
                '&:hover': { 
                  background: isShopOpen ? 'linear-gradient(135deg, rgba(99,102,241,0.3) 0%, rgba(139,92,246,0.25) 100%)' : 'rgba(100,116,139,0.1)',
                  transform: isShopOpen ? 'translateY(-2px)' : 'none',
                  boxShadow: isShopOpen ? '0 8px 30px rgba(99,102,241,0.3)' : 'none',
                },
                '&:disabled': { color: '#64748b', borderColor: 'rgba(100,116,139,0.2)' },
              }}
            >
              เพิ่มลงตะกร้า
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
                  ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                  : 'rgba(100,116,139,0.15)',
                color: isShopOpen ? 'white' : '#64748b',
                fontSize: '0.95rem',
                fontWeight: 800,
                textTransform: 'none',
                boxShadow: isShopOpen ? '0 4px 20px rgba(16,185,129,0.35)' : 'none',
                transition: 'all 0.25s ease',
                '&:hover': {
                  background: isShopOpen 
                    ? 'linear-gradient(135deg, #059669 0%, #047857 100%)' 
                    : 'rgba(100,116,139,0.15)',
                  transform: isShopOpen ? 'translateY(-2px)' : 'none',
                  boxShadow: isShopOpen ? '0 8px 30px rgba(16,185,129,0.45)' : 'none',
                },
                '&:disabled': { background: 'rgba(100,116,139,0.15)', color: '#64748b' },
              }}
            >
              ซื้อเลย
            </Button>
          </Box>
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
              bgcolor: '#0a0f1a',
              overflow: 'hidden',
              boxShadow: '0 -10px 60px rgba(0,0,0,0.5), 0 -4px 20px rgba(99,102,241,0.15)',
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
            bgcolor: '#0a0f1a',
            overflow: 'hidden',
            boxShadow: '-10px 0 60px rgba(0,0,0,0.5), -4px 0 20px rgba(99,102,241,0.15)',
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
        showToast('success', 'ยกเลิกคำสั่งซื้อแล้ว');
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
        showToast('error', res.message || 'ยกเลิกคำสั่งซื้อไม่สำเร็จ');
      }
    } catch (error: any) {
      showToast('error', error.message || 'ยกเลิกคำสั่งซื้อไม่สำเร็จ');
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
      showToast('warning', 'ร้านค้าปิดชั่วคราว ไม่สามารถสั่งซื้อได้');
      return false;
    }
    if (!profileComplete) {
      showToast('warning', 'กรุณาบันทึกโปรไฟล์ก่อนชำระเงิน');
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
  }) => {
    // Block submission if shop is closed
    if (!isShopOpen) {
      showToast('warning', 'ร้านค้าปิดชั่วคราว ไม่สามารถสั่งซื้อได้');
      setShowOrderDialog(false);
      return;
    }
    
    if (!profileComplete) {
      showToast('warning', 'กรุณาบันทึกโปรไฟล์ให้ครบก่อนยืนยันคำสั่งซื้อ');
      setShowProfileModal(true);
      setPendingCheckout(true);
      return;
    }

    if (cart.length === 0) {
      showToast('warning', 'ตะกร้าสินค้าว่างเปล่า');
      return;
    }

    // Calculate total with shipping fee
    const subtotal = getTotalPrice();
    const shippingFee = options?.shippingFee || 0;
    const totalAmount = subtotal + shippingFee;

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
        // Include shipping and payment options - always include if defined
        shippingOptionId: options?.shippingOptionId,
        paymentOptionId: options?.paymentOptionId,
        shippingFee: options?.shippingFee,
      });

      if (res.status === 'success') {
        showToast('success', `สั่งซื้อสำเร็จ หมายเลข: ${res.ref}`);
        
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
              customName: item.options.customName,
              isLongSleeve: item.options.isLongSleeve,
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
        });

        if (res.ref) openPaymentFlow(res.ref);
      } else {
        throw new Error(res.message || 'เกิดข้อผิดพลาด');
      }
    } catch (error: any) {
      showToast('error', error.message || 'เกิดข้อผิดพลาดในการสั่งซื้อ');
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
      showToast('error', 'ไม่สามารถโหลดประวัติได้');
    } finally {
      append ? setLoadingHistoryMore(false) : setLoadingHistory(false);
    }
  };

  const handleSaveProfile = async (data: Partial<typeof orderData>) => {
    if (!session?.user?.email) {
      showToast('error', 'กรุณาเข้าสู่ระบบ');
      return;
    }

    setSavingProfile(true);
    const sanitized = {
      name: data.name ? data.name.replace(/[^\u0E00-\u0E7F\s]/g, '').trim() : orderData.name,
      phone: data.phone ? onlyDigitsPhone(data.phone) : orderData.phone,
      address: data.address ? data.address.trim() : orderData.address,
      instagram: data.instagram ? data.instagram.trim() : orderData.instagram,
    };
    setOrderData((prev) => ({ ...prev, ...sanitized }));

    try {
      await saveProfileApi(session.user.email, {
        name: sanitized.name,
        phone: sanitized.phone,
        address: sanitized.address,
        instagram: sanitized.instagram,
      });

      showToast('success', 'บันทึกข้อมูลจัดส่งแล้ว');
      setShowProfileModal(false);
      if (pendingCheckout && isThaiText(sanitized.name) && sanitized.phone && sanitized.instagram) {
        setShowOrderDialog(true);
        setPendingCheckout(false);
      }
    } catch (error: any) {
      showToast('error', error.message || 'บันทึกข้อมูลไม่สำเร็จ');
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
    }
  };


  const productImages = useMemo(() => (selectedProduct?.images || []).filter(Boolean), [selectedProduct]);
  const totalImages = productImages.length;
  const displaySizes = useMemo(() => {
    if (!selectedProduct) return [] as string[];
    const sizeKeys = Object.keys(selectedProduct.sizePricing || {});
    if (sizeKeys.length === 0) return ['ฟรีไซส์'];
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
  const allGroupedProducts = useMemo(() => {
    const items = config?.products || [];
    const map: Record<string, Product[]> = {};
    items.forEach((p) => {
      const key = p.type || 'OTHER';
      if (!map[key]) map[key] = [];
      map[key].push(p);
    });
    return map;
  }, [config?.products]);

  // Only active products (for counting and filtering)
  const groupedProducts = useMemo(() => {
    const items = (config?.products || []).filter((p) => isProductCurrentlyOpen(p));
    const map: Record<string, Product[]> = {};
    items.forEach((p) => {
      const key = p.type || 'OTHER';
      if (!map[key]) map[key] = [];
      map[key].push(p);
    });
    return map;
  }, [config?.products]);

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
      { key: 'ALL', label: 'ทั้งหมด', count: totalProductCount },
      ...Object.entries(allGroupedProducts).map(([key, items]) => ({ key, label: TYPE_LABELS[key] || key || 'อื่นๆ', count: items.length })),
    ],
    [totalProductCount, allGroupedProducts]
  );

  // Filter products - show all products including inactive ones (with status badges)
  const filteredGroupedProducts = useMemo(() => {
    const term = productSearch.trim().toLowerCase();
    const entries = Object.entries(allGroupedProducts)
      .filter(([key]) => categoryFilter === 'ALL' || key === categoryFilter)
      .map(([key, items]) => {
        const byName = term ? items.filter((p) => p.name?.toLowerCase().includes(term)) : items;
        const byPrice = byName.filter((p) => {
          const price = getBasePrice(p);
          return priceRange[0] <= price && price <= priceRange[1];
        });
        return [key, byPrice] as const;
      })
      .filter(([, items]) => items.length > 0);
    return Object.fromEntries(entries);
  }, [categoryFilter, allGroupedProducts, priceRange, productSearch]);

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
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: '#0f172a' }}>
        <AppBar
          position="sticky"
          elevation={0}
          sx={{ bgcolor: 'rgba(15,23,42,0.65)', borderBottom: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(14px)' }}
        >
          <Toolbar>
            <BrandMark />
            <Box sx={{ flexGrow: 1 }} />
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
                    <AlertTriangle size={22} color="#f59e0b" />
                  </Box>
                  <Box>
                    <Typography sx={{ color: '#fbbf24', fontWeight: 700, fontSize: '0.95rem', mb: 0.5 }}>
                      แนะนำให้เปิดในเบราว์เซอร์
                    </Typography>
                    <Typography sx={{ color: '#94a3b8', fontSize: '0.8rem', lineHeight: 1.6 }}>
                      Google ไม่รองรับการเข้าสู่ระบบจากแอปนี้โดยตรง 
                      กรุณากดปุ่ม <strong>⋮</strong> หรือ <strong>...</strong> แล้วเลือก 
                      <strong> "เปิดในเบราว์เซอร์"</strong> หรือ <strong>"Open in Browser"</strong>
                    </Typography>
                    <Button
                      size="small"
                      onClick={() => {
                        navigator.clipboard?.writeText(currentUrl);
                        alert('คัดลอกลิงก์แล้ว! กรุณาวางในเบราว์เซอร์');
                      }}
                      sx={{
                        mt: 1.5,
                        color: '#fbbf24',
                        fontSize: '0.75rem',
                        textTransform: 'none',
                        '&:hover': { bgcolor: 'rgba(245, 158, 11, 0.1)' },
                      }}
                      startIcon={<Copy size={14} />}
                    >
                      คัดลอกลิงก์
                    </Button>
                  </Box>
                </Box>
              </Box>
            )}
            
            <Card 
              sx={{ 
                bgcolor: 'rgba(30, 41, 59, 0.8)', 
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(99, 102, 241, 0.2)', 
                borderRadius: '24px',
                p: { xs: 3, sm: 5 }, 
                textAlign: 'center',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(99, 102, 241, 0.1)',
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
                  boxShadow: '0 10px 30px rgba(99, 102, 241, 0.3)',
                  border: '2px solid rgba(99, 102, 241, 0.3)',
                }}
              >
                <Image
                  src="/logo.png"
                  alt="PSU SCC Shop Logo"
                  fill
                  sizes="64px"
                  style={{ objectFit: 'contain' }}
                  priority
                />
              </Box>
              
              <Typography 
                variant="h4" 
                sx={{ 
                  fontWeight: 800, 
                  mb: 1, 
                  color: '#f1f5f9',
                  background: 'linear-gradient(135deg, #f1f5f9 0%, #c084fc 50%, #6366f1 100%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                SCC Shop
              </Typography>
              <Typography sx={{ color: '#94a3b8', mb: 4, fontSize: '1rem' }}>
                ร้านค้าชุมนุมคอมพิวเตอร์ ม.อ.
              </Typography>
              
              <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mb: 4 }} />
              
              <Typography sx={{ color: '#64748b', mb: 3, fontSize: '0.9rem' }}>
                เข้าสู่ระบบเพื่อเริ่มช้อปปิ้ง
              </Typography>
              
              <Button
                variant="contained"
                size="large"
                onClick={() => signIn('google', { redirect: true, callbackUrl: '/', prompt: 'select_account' })}
                sx={{
                  background: '#ffffff',
                  color: '#1f2937',
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
                    background: '#f8fafc',
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
                เข้าสู่ระบบด้วย Google
              </Button>
              
              <Typography sx={{ color: '#475569', mt: 4, fontSize: '0.75rem' }}>
                โดยการเข้าสู่ระบบ คุณยอมรับ<br/>ข้อกำหนดและเงื่อนไขการใช้งาน
              </Typography>
            </Card>
          </Container>
        </Box>
      </Box>
    );
  }

  // Check if there are enabled announcements for padding adjustment
  const hasEnabledAnnouncements = (announcements?.filter(a => a.enabled)?.length ?? 0) > 0;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: '#0f172a', pb: { xs: 9, md: 0 }, pt: hasEnabledAnnouncements ? { xs: '44px', sm: '40px' } : 0 }}>
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: 'rgba(15,23,42,0.65)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(14px)',
          boxShadow: '0 18px 50px rgba(0,0,0,0.35)',
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
                color: showSearchBar ? '#0b1120' : '#e2e8f0',
                borderColor: showSearchBar ? 'transparent' : 'rgba(255,255,255,0.18)',
                background: showSearchBar ? 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)' : 'rgba(15,23,42,0.4)',
                textTransform: 'none',
                fontWeight: 700,
                borderRadius: 1.5,
              }}
            >
              ค้นหา
            </Button>
          </Box>
          <IconButton
            onClick={() => setShowSearchBar((v) => !v)}
            sx={{ mr: 1, display: { xs: 'flex', md: 'none' }, color: '#f1f5f9', alignItems: 'center', gap: 0.5 }}
          >
            <Search size={22} />
          </IconButton>
          <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 1, mr: 2 }}>
            <Button
              variant="outlined"
              startIcon={<Home size={18} />}
              onClick={() => handleTabChange('home')}
              sx={{
                color: activeTab === 'home' ? '#6366f1' : '#e2e8f0',
                borderColor: activeTab === 'home' ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.18)',
                backgroundColor: activeTab === 'home' ? 'rgba(99,102,241,0.12)' : 'transparent',
                textTransform: 'none',
                borderRadius: 2,
                px: 1.5,
                py: 0.5,
                height: 40,
                '&:hover': { borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.16)' },
              }}
            >
              หน้าแรก
            </Button>
            <Button
              variant="outlined"
              startIcon={<History size={18} />}
              onClick={() => handleTabChange('history')}
              sx={{
                color: activeTab === 'history' ? '#6366f1' : '#e2e8f0',
                borderColor: activeTab === 'history' ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.18)',
                backgroundColor: activeTab === 'history' ? 'rgba(99,102,241,0.12)' : 'transparent',
                textTransform: 'none',
                borderRadius: 2,
                px: 1.5,
                py: 0.5,
                height: 40,
                '&:hover': { borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.16)' },
              }}
            >
              ประวัติ
            </Button>
            <Button
              variant="outlined"
              startIcon={<User size={18} />}
              onClick={() => handleTabChange('profile')}
              sx={{
                color: activeTab === 'profile' ? '#6366f1' : '#e2e8f0',
                borderColor: activeTab === 'profile' ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.18)',
                backgroundColor: activeTab === 'profile' ? 'rgba(99,102,241,0.12)' : 'transparent',
                textTransform: 'none',
                borderRadius: 2,
                px: 1.5,
                py: 0.5,
                height: 40,
                '&:hover': { borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.16)' },
              }}
            >
              โปรไฟล์
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
                color: activeTab === 'cart' ? '#6366f1' : '#e2e8f0',
                borderColor: activeTab === 'cart' ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.18)',
                backgroundColor: activeTab === 'cart' ? 'rgba(99,102,241,0.12)' : 'transparent',
                textTransform: 'none',
                borderRadius: 2,
                px: 1.5,
                py: 0.5,
                height: 40,
                '&:hover': { borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.16)' },
              }}
            >
              ตะกร้า
            </Button>
          </Box>
          {session && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Avatar src={session?.user?.image || ''} sx={{ width: 32, height: 32, cursor: 'pointer' }} onClick={() => setSidebarOpen(true)} />
            </Box>
          )}
        </Toolbar>
        {showSearchBar && (
          <Box sx={{ px: { xs: 2, md: 3 }, pb: 2, pt: 1 }}>
            <Box sx={{
              p: 2,
              borderRadius: '16px',
              bgcolor: 'rgba(15,23,42,0.95)',
              border: '1px solid rgba(99,102,241,0.2)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            }}>
              <TextField
                autoFocus
                size="small"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="ค้นหาชื่อสินค้า, ประเภท..."
                inputProps={{ maxLength: 50 }}
                fullWidth
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#e2e8f0',
                    background: 'rgba(30,41,59,0.5)',
                    borderRadius: '12px',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                    '&:hover fieldset': { borderColor: 'rgba(99,102,241,0.5)' },
                    '&.Mui-focused fieldset': { borderColor: '#6366f1' },
                  },
                  '& .MuiInputBase-input::placeholder': { color: '#64748b', opacity: 1 },
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search size={18} color="#6366f1" />
                    </InputAdornment>
                  ),
                  endAdornment: productSearch && (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setProductSearch('')} sx={{ color: '#64748b' }}>
                        <X size={16} />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              
              {/* Quick Filters */}
              {productSearch && (
                <Box sx={{ mt: 1.5, display: 'flex', flexWrap: 'wrap', gap: 0.8 }}>
                  {Object.entries(TYPE_LABELS).slice(0, 4).map(([key, label]) => (
                    <Chip
                      key={key}
                      label={label}
                      size="small"
                      onClick={() => setProductSearch(label)}
                      sx={{
                        bgcolor: productSearch.includes(label) ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)',
                        color: productSearch.includes(label) ? '#a5b4fc' : '#94a3b8',
                        border: '1px solid',
                        borderColor: productSearch.includes(label) ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.1)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'rgba(99,102,241,0.15)' },
                      }}
                    />
                  ))}
                </Box>
              )}

              {/* Search Results Count */}
              {productSearch && (
                <Typography sx={{ mt: 1.5, fontSize: '0.75rem', color: '#64748b' }}>
                  พบ {Object.values(filteredGroupedProducts).flat().length} รายการ
                </Typography>
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

      {/* Top Announcement Banner - Always visible when announcements exist */}
      {(() => {
        const enabledAnnouncements = announcements?.filter(a => a.enabled) || [];
        if (enabledAnnouncements.length === 0) return null;
        const currentAnn = enabledAnnouncements[currentAnnouncementIndex % enabledAnnouncements.length];
        if (!currentAnn) return null;
        
        const baseColor = getAnnouncementColor(currentAnn.color);
        
        return (
          <Box
            sx={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 1300, // Above everything including navbar
              animation: 'slideInFromTop 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
              '@keyframes slideInFromTop': {
                from: { transform: 'translateY(-100%)', opacity: 0 },
                to: { transform: 'translateY(0)', opacity: 1 },
              },
            }}
          >
            <Box
              sx={{
                position: 'relative',
                overflow: 'hidden',
                boxShadow: `0 4px 20px ${baseColor}40, 0 2px 8px rgba(0,0,0,0.3)`,
              }}
            >
              {/* Animated gradient background */}
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: `linear-gradient(-45deg, ${baseColor}, ${baseColor}dd, ${baseColor}bb, ${baseColor})`,
                  backgroundSize: '400% 400%',
                  animation: 'gradientShift 8s ease infinite',
                  '@keyframes gradientShift': {
                    '0%': { backgroundPosition: '0% 50%' },
                    '50%': { backgroundPosition: '100% 50%' },
                    '100%': { backgroundPosition: '0% 50%' },
                  },
                }}
              />
              
              {/* Shimmer effect */}
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: '-100%',
                  right: 0,
                  bottom: 0,
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)',
                  animation: 'shimmer 3s ease-in-out infinite',
                  '@keyframes shimmer': {
                    '0%': { left: '-100%' },
                    '100%': { left: '100%' },
                  },
                }}
              />

              {/* Content */}
              <Box 
                sx={{ 
                  position: 'relative', 
                  zIndex: 1, 
                  px: { xs: 2, sm: 3 },
                  py: { xs: 1, sm: 1.25 },
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: { xs: 1.5, sm: 2 },
                  flexWrap: 'wrap',
                }}
              >
                {/* Animated icon */}
                <Box sx={{ 
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  animation: 'pulse 2s ease-in-out infinite',
                  '@keyframes pulse': {
                    '0%, 100%': { transform: 'scale(1)' },
                    '50%': { transform: 'scale(1.05)' },
                  },
                }}>
                  <Box sx={{ 
                    width: 8, 
                    height: 8, 
                    borderRadius: '50%', 
                    bgcolor: '#fff',
                    boxShadow: '0 0 8px #fff, 0 0 16px #fff',
                    animation: 'glow 2s ease-in-out infinite',
                    '@keyframes glow': {
                      '0%, 100%': { boxShadow: '0 0 4px #fff, 0 0 8px #fff', opacity: 1 },
                      '50%': { boxShadow: '0 0 12px #fff, 0 0 24px #fff', opacity: 0.7 },
                    },
                  }} />
                  <Megaphone size={18} color="white" />
                </Box>

                {/* Image thumbnail (if exists) */}
                {currentAnn.imageUrl && (
                  <Box
                    onClick={() => setShowAnnouncementImage(true)}
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: '8px',
                      overflow: 'hidden',
                      border: '2px solid rgba(255,255,255,0.4)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      flexShrink: 0,
                      '&:hover': {
                        transform: 'scale(1.1)',
                        border: '2px solid rgba(255,255,255,0.8)',
                      },
                    }}
                  >
                    <OptimizedImage
                      src={currentAnn.imageUrl}
                      alt="Announcement"
                      width={32}
                      height={32}
                      objectFit="cover"
                    />
                  </Box>
                )}

                {/* Message */}
                <Typography
                  onClick={currentAnn.imageUrl ? () => setShowAnnouncementImage(true) : undefined}
                  sx={{
                    color: '#fff',
                    fontSize: { xs: '0.85rem', sm: '0.95rem' },
                    fontWeight: 600,
                    textAlign: 'center',
                    textShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    maxWidth: { xs: '100%', sm: '70%' },
                    whiteSpace: { xs: 'normal', sm: 'nowrap' },
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    cursor: currentAnn.imageUrl ? 'pointer' : 'default',
                    '&:hover': currentAnn.imageUrl ? { textDecoration: 'underline' } : {},
                  }}
                >
                  {currentAnn.message || 'ประกาศจากทีมงาน'}
                </Typography>

                {/* Navigation dots for multiple announcements */}
                {enabledAnnouncements.length > 1 && (
                  <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                    {enabledAnnouncements.map((_, idx) => (
                      <Box
                        key={idx}
                        onClick={() => setCurrentAnnouncementIndex(idx)}
                        sx={{
                          width: idx === currentAnnouncementIndex ? 14 : 6,
                          height: 6,
                          borderRadius: '3px',
                          bgcolor: idx === currentAnnouncementIndex ? '#fff' : 'rgba(255,255,255,0.4)',
                          cursor: 'pointer',
                          transition: 'all 0.3s ease',
                          '&:hover': { bgcolor: 'rgba(255,255,255,0.8)' },
                        }}
                      />
                    ))}
                  </Box>
                )}

                {/* History button */}
                {announcementHistory && announcementHistory.length > 0 && (
                  <IconButton
                    size="small"
                    onClick={() => setShowAnnouncementHistory(true)}
                    sx={{
                      color: 'rgba(255,255,255,0.9)',
                      bgcolor: 'rgba(255,255,255,0.15)',
                      width: 28,
                      height: 28,
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' },
                    }}
                  >
                    <History size={14} />
                  </IconButton>
                )}
              </Box>
            </Box>
          </Box>
        );
      })()}

      {/* Announcement History Dialog */}
      <Dialog
        open={showAnnouncementHistory}
        onClose={() => setShowAnnouncementHistory(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: 'rgba(15, 23, 42, 0.98)',
            backdropFilter: 'blur(20px)',
            borderRadius: '20px',
            border: '1px solid rgba(255,255,255,0.1)',
            maxHeight: '80vh',
          },
        }}
      >
        <DialogTitle sx={{ 
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          pb: 2,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{
              width: 40,
              height: 40,
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <History size={20} color="#fff" />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 700, color: '#f1f5f9', fontSize: '1.1rem' }}>
                ประวัติประกาศ
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>
                ประกาศย้อนหลังทั้งหมด {announcementHistory?.length || 0} รายการ
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          {announcementHistory && announcementHistory.length > 0 ? (
            <Box sx={{ py: 2 }}>
              {announcementHistory.map((item, index) => (
                <Box
                  key={item.id || index}
                  sx={{
                    mx: 2,
                    mb: 2,
                    p: 2,
                    borderRadius: '16px',
                    background: `linear-gradient(135deg, ${getAnnouncementColor(item.color)}20, ${getAnnouncementColor(item.color)}10)`,
                    border: `1px solid ${getAnnouncementColor(item.color)}40`,
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {/* Color indicator bar */}
                  <Box sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    bottom: 0,
                    width: 4,
                    bgcolor: getAnnouncementColor(item.color),
                  }} />

                  {/* Date badge */}
                  <Box sx={{ 
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.5,
                    px: 1,
                    py: 0.25,
                    mb: 1,
                    borderRadius: '8px',
                    bgcolor: 'rgba(255,255,255,0.1)',
                    fontSize: '0.7rem',
                    color: '#94a3b8',
                  }}>
                    <Clock size={12} />
                    {item.postedAt 
                      ? new Date(item.postedAt).toLocaleDateString('th-TH', { 
                          day: 'numeric', 
                          month: 'long', 
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'ไม่ระบุวันที่'
                    }
                  </Box>

                  {/* Image */}
                  {item.imageUrl && (
                    <OptimizedImage
                      src={item.imageUrl}
                      alt="Announcement"
                      width="100%"
                      height={150}
                      objectFit="cover"
                      borderRadius="12px"
                      style={{ marginBottom: item.message ? 12 : 0 }}
                    />
                  )}

                  {/* Message */}
                  {item.message && (
                    <Typography sx={{ 
                      color: '#e2e8f0',
                      fontSize: '0.9rem',
                      lineHeight: 1.6,
                      whiteSpace: 'pre-wrap',
                    }}>
                      {item.message}
                    </Typography>
                  )}

                  {/* Posted by */}
                  {(item.displayName || item.postedBy) && (
                    <Typography sx={{ 
                      mt: 1, 
                      fontSize: '0.75rem', 
                      color: '#64748b',
                    }}>
                      — {item.displayName || item.postedBy}
                    </Typography>
                  )}
                </Box>
              ))}
            </Box>
          ) : (
            <Box sx={{ 
              py: 6, 
              textAlign: 'center',
              color: '#64748b',
            }}>
              <History size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
              <Typography>ยังไม่มีประวัติประกาศ</Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid rgba(255,255,255,0.1)', p: 2 }}>
          <Button 
            onClick={() => setShowAnnouncementHistory(false)}
            sx={{ 
              color: '#94a3b8',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
            }}
          >
            ปิด
          </Button>
        </DialogActions>
      </Dialog>

      {/* Announcement Image Lightbox */}
      <Dialog
        open={showAnnouncementImage}
        onClose={() => setShowAnnouncementImage(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: 'rgba(10, 15, 26, 0.98)',
            backdropFilter: 'blur(24px)',
            borderRadius: '24px',
            border: '1px solid rgba(255,255,255,0.1)',
            overflow: 'hidden',
            maxHeight: '90vh',
          },
        }}
      >
        {(() => {
          const enabledAnnouncements = announcements?.filter(a => a.enabled) || [];
          const currentAnn = enabledAnnouncements[currentAnnouncementIndex % enabledAnnouncements.length];
          if (!currentAnn) return null;
          
          const baseColor = getAnnouncementColor(currentAnn.color);
          
          return (
            <>
              {/* Header */}
              <Box
                sx={{
                  position: 'relative',
                  p: 2,
                  background: `linear-gradient(135deg, ${baseColor}30, ${baseColor}10)`,
                  borderBottom: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{
                    width: 44,
                    height: 44,
                    borderRadius: '14px',
                    background: `linear-gradient(135deg, ${baseColor}, ${baseColor}cc)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: `0 4px 16px ${baseColor}40`,
                  }}>
                    <Megaphone size={22} color="#fff" />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontWeight: 700, color: '#f1f5f9', fontSize: '1.1rem' }}>
                      ประกาศ
                    </Typography>
                    {currentAnn.postedAt && (
                      <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>
                        {new Date(currentAnn.postedAt).toLocaleDateString('th-TH', { 
                          day: 'numeric', 
                          month: 'long', 
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Typography>
                    )}
                  </Box>
                  <IconButton 
                    onClick={() => setShowAnnouncementImage(false)}
                    sx={{ 
                      color: '#94a3b8',
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
                    }}
                  >
                    <X size={20} />
                  </IconButton>
                </Box>
              </Box>

              {/* Content */}
              <DialogContent sx={{ p: 0 }}>
                {/* Image */}
                {currentAnn.imageUrl && (
                  <Box
                    sx={{
                      position: 'relative',
                      width: '100%',
                      maxHeight: '60vh',
                      overflow: 'hidden',
                      bgcolor: '#000',
                    }}
                  >
                    <OptimizedImage
                      src={currentAnn.imageUrl}
                      alt="Announcement Image"
                      width="100%"
                      height="auto"
                      objectFit="contain"
                      style={{ maxHeight: '60vh' }}
                      priority
                    />
                  </Box>
                )}

                {/* Message */}
                {currentAnn.message && (
                  <Box sx={{ p: 3 }}>
                    <Typography
                      sx={{
                        color: '#e2e8f0',
                        fontSize: '1rem',
                        lineHeight: 1.8,
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {currentAnn.message}
                    </Typography>
                  </Box>
                )}

                {/* Footer */}
                <Box 
                  sx={{ 
                    p: 2, 
                    borderTop: '1px solid rgba(255,255,255,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    bgcolor: 'rgba(30,41,59,0.5)',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    {currentAnn.showLogo !== false && (
                      <Box 
                        component="img" 
                        src="/logo.png" 
                        alt="Logo" 
                        sx={{ 
                          width: 28, 
                          height: 28, 
                          borderRadius: '8px',
                          border: '1px solid rgba(255,255,255,0.1)',
                        }} 
                        onError={(e: any) => { e.target.style.display = 'none'; }} 
                      />
                    )}
                    <Typography sx={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                      {currentAnn.displayName || (currentAnn.postedBy === 'ระบบ' ? 'PSU SCC Shop' : 'แอดมิน')}
                    </Typography>
                  </Box>

                  {/* Navigation for multiple announcements */}
                  {enabledAnnouncements.length > 1 && (
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <IconButton
                        size="small"
                        onClick={() => setCurrentAnnouncementIndex(prev => 
                          prev === 0 ? enabledAnnouncements.length - 1 : prev - 1
                        )}
                        sx={{ color: '#94a3b8', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}
                      >
                        <ChevronLeft size={18} />
                      </IconButton>
                      <Typography sx={{ color: '#64748b', fontSize: '0.8rem', minWidth: 40, textAlign: 'center' }}>
                        {currentAnnouncementIndex + 1} / {enabledAnnouncements.length}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={() => setCurrentAnnouncementIndex(prev => 
                          (prev + 1) % enabledAnnouncements.length
                        )}
                        sx={{ color: '#94a3b8', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}
                      >
                        <ChevronRight size={18} />
                      </IconButton>
                    </Box>
                  )}
                </Box>
              </DialogContent>
            </>
          );
        })()}
      </Dialog>

      <Drawer
        anchor="right"
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        PaperProps={{
          sx: {
            bgcolor: 'rgba(10,14,26,0.9)',
            color: '#f1f5f9',
            width: 320,
            maxHeight: '100vh',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            backdropFilter: 'blur(24px)',
            borderLeft: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '-18px 0 60px rgba(0,0,0,0.45)',
            backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(99,102,241,0.18), transparent 42%), radial-gradient(circle at 80% 0%, rgba(14,165,233,0.16), transparent 38%)',
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>เมนู</Typography>
            <IconButton onClick={() => setSidebarOpen(false)}>
              <X style={{ color: '#f1f5f9' }} size={24} />
            </IconButton>
          </Box>
          <Divider sx={{ mb: 2, borderColor: '#334155' }} />

          {session && (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Avatar src={session?.user?.image || ''} sx={{ mr: 2, width: 40, height: 40 }} />
                <Box>
                  <Typography sx={{ fontWeight: 'bold', color: '#f1f5f9' }}>{session?.user?.name}</Typography>
                  <Typography variant="caption" sx={{ color: '#94a3b8' }}>{session?.user?.email}</Typography>
                </Box>
              </Box>
              <Divider sx={{ my: 2, borderColor: '#334155' }} />
              <Button
                fullWidth
                onClick={() => { setSidebarOpen(false); setShowProfileModal(true); setActiveTab('profile'); }}
                sx={{
                  textAlign: 'left',
                  mb: 1,
                  color: '#e2e8f0',
                  justifyContent: 'flex-start',
                  borderRadius: 2,
                  px: 1.5,
                  py: 1.1,
                  background: 'linear-gradient(120deg, rgba(99,102,241,0.18), rgba(14,165,233,0.12))',
                  border: '1px solid rgba(255,255,255,0.08)',
                  boxShadow: '0 12px 30px rgba(0,0,0,0.25)',
                  '&:hover': { borderColor: 'rgba(99,102,241,0.5)', background: 'linear-gradient(120deg, rgba(99,102,241,0.24), rgba(14,165,233,0.18))' },
                }}
                startIcon={<User size={20} />}
              >
                ข้อมูลจัดส่งของฉัน
              </Button>
              <Button
                fullWidth
                onClick={() => { setSidebarOpen(false); setShowHistoryDialog(true); loadOrderHistory(); }}
                sx={{
                  textAlign: 'left',
                  mb: 1,
                  color: '#e2e8f0',
                  justifyContent: 'flex-start',
                  borderRadius: 2,
                  px: 1.5,
                  py: 1.1,
                  background: 'linear-gradient(120deg, rgba(16,185,129,0.18), rgba(14,165,233,0.12))',
                  border: '1px solid rgba(255,255,255,0.08)',
                  boxShadow: '0 12px 30px rgba(0,0,0,0.25)',
                  '&:hover': { borderColor: 'rgba(16,185,129,0.5)', background: 'linear-gradient(120deg, rgba(16,185,129,0.22), rgba(14,165,233,0.16))' },
                }}
                startIcon={<History size={20} />}
              >
                ประวัติคำสั่งซื้อ
              </Button>
              <Button
                fullWidth
                onClick={() => signOut()}
                sx={{
                  textAlign: 'left',
                  color: '#fecdd3',
                  justifyContent: 'flex-start',
                  borderRadius: 2,
                  px: 1.5,
                  py: 1.1,
                  background: 'linear-gradient(120deg, rgba(239,68,68,0.12), rgba(239,68,68,0.06))',
                  border: '1px solid rgba(248,113,113,0.4)',
                  boxShadow: '0 12px 30px rgba(239,68,68,0.18)',
                  '&:hover': { borderColor: 'rgba(248,113,113,0.8)', background: 'linear-gradient(120deg, rgba(239,68,68,0.18), rgba(239,68,68,0.12))' },
                }}
                startIcon={<LogOut size={20} />}
              >
                ออกจากระบบ
              </Button>
            </>
          )}

          <Divider sx={{ my: 2, borderColor: '#334155' }} />
          <Button
            component={Link}
            href="/"
            fullWidth
            sx={{
              textAlign: 'left',
              color: '#e2e8f0',
              justifyContent: 'flex-start',
              borderRadius: 2,
              px: 1.5,
              py: 1.1,
              background: 'linear-gradient(120deg, rgba(99,102,241,0.16), rgba(30,41,59,0.6))',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 12px 30px rgba(0,0,0,0.22)',
              '&:hover': { borderColor: 'rgba(99,102,241,0.6)', background: 'linear-gradient(120deg, rgba(99,102,241,0.22), rgba(30,41,59,0.7))' },
            }}
            startIcon={<Home size={20} />}
          >
            หน้าแรก
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
                  bgcolor: 'rgba(15,23,42,0.8)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  backdropFilter: 'blur(10px)',
                }}>
                  {/* Search and Stats Row */}
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Box sx={{
                        width: 36,
                        height: 36,
                        borderRadius: '10px',
                        bgcolor: 'rgba(99,102,241,0.15)',
                        display: 'grid',
                        placeItems: 'center',
                      }}>
                        <Store size={18} color="#a5b4fc" />
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#e2e8f0' }}>
                          สินค้าทั้งหมด
                        </Typography>
                        <Typography sx={{ fontSize: '0.7rem', color: '#64748b' }}>
                          พบ {filteredProductCount} รายการ ({activeProductCount} เปิดขาย)
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <IconButton 
                        onClick={() => setShowSearchBar(!showSearchBar)}
                        sx={{ 
                          color: showSearchBar ? '#6366f1' : '#94a3b8',
                          bgcolor: showSearchBar ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.05)',
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
                            bgcolor: active ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
                            border: active ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(255,255,255,0.06)',
                            color: active ? '#a5b4fc' : '#94a3b8',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.8,
                            '&:hover': {
                              bgcolor: active ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.08)',
                              borderColor: active ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.12)',
                            },
                          }}
                        >
                          {cat.label}
                          <Box sx={{
                            px: 0.7,
                            py: 0.1,
                            borderRadius: '6px',
                            bgcolor: active ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.08)',
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
                    <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                        <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8' }}>
                          กรองตามราคา
                        </Typography>
                        <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981' }}>
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
                          color: '#6366f1',
                          height: 6,
                          '& .MuiSlider-track': { border: 'none', bgcolor: '#6366f1' },
                          '& .MuiSlider-rail': { bgcolor: 'rgba(255,255,255,0.1)' },
                          '& .MuiSlider-thumb': {
                            width: 18,
                            height: 18,
                            backgroundColor: '#fff',
                            border: '2px solid #6366f1',
                            '&:hover': { boxShadow: '0 0 0 8px rgba(99,102,241,0.16)' },
                          },
                        }}
                      />
                    </Box>
                  )}
                </Box>
              </Box>
            )}

            {config?.products && Object.keys(filteredGroupedProducts).length > 0 ? (
              Object.entries(filteredGroupedProducts).map(([type, items]) => (
                <Box key={type} sx={{ mb: 4 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
                    <Box sx={{
                      px: 1.5,
                      py: 0.6,
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                    }}>
                      <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: 'white' }}>
                        {TYPE_LABELS[type] || type || 'อื่นๆ'}
                      </Typography>
                    </Box>
                    <Typography sx={{ fontSize: '0.85rem', color: '#64748b' }}>
                      {items.length} รายการ
                    </Typography>
                  </Box>
                  <Grid container spacing={2} sx={{ width: '100%', m: 0 }}>
                    {items.map((product, productIdx) => {
                      const productStatus = getProductStatus(product);
                      const isProductAvailable = productStatus === 'OPEN' && isShopOpen;
                      const isProductClosed = productStatus !== 'OPEN'; // Product is closed/coming soon/ended
                      
                      return (
                      <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={product.id}>
                        <Box
                          onClick={() => {
                            if (!isShopOpen) {
                              showToast('warning', 'ร้านค้าปิดชั่วคราว ไม่สามารถสั่งซื้อได้');
                              return;
                            }
                            if (productStatus !== 'OPEN') {
                              const statusConfig = SHOP_STATUS_CONFIG[productStatus];
                              showToast('info', `${product.name} - ${statusConfig.label}`);
                              return;
                            }
                            setSelectedProduct(product);
                            setProductDialogOpen(true);
                          }}
                          sx={{
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column', // Always vertical
                            cursor: isProductAvailable ? 'pointer' : 'default',
                            borderRadius: '20px',
                            overflow: 'hidden',
                            bgcolor: 'rgba(15,23,42,0.8)',
                            border: `1px solid ${isProductClosed ? SHOP_STATUS_CONFIG[productStatus].borderColor : 'rgba(255,255,255,0.08)'}`,
                            transition: 'all 0.25s ease',
                            position: 'relative',
                            opacity: isProductClosed ? 0.85 : 1,
                            '&:hover': isProductAvailable ? {
                              transform: 'translateY(-4px)',
                              boxShadow: '0 20px 40px rgba(99,102,241,0.2)',
                              borderColor: 'rgba(99,102,241,0.4)',
                            } : {},
                          }}
                        >
                          {/* Product Image Area */}
                          <Box sx={{
                            position: 'relative',
                            width: '100%',
                            aspectRatio: '1 / 1',
                            bgcolor: '#0b1224',
                            overflow: 'hidden',
                          }}>
                            {/* Optimized product image with lazy loading */}
                            {product.images?.[0] ? (
                              <OptimizedImage
                                src={product.images[0]}
                                alt={product.name}
                                width="100%"
                                height="100%"
                                objectFit="cover"
                                priority={productIdx < 4} // First 4 products load eagerly
                                placeholder="skeleton"
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
                                color: '#475569',
                                fontSize: '0.8rem',
                              }}>
                                ไม่มีรูป
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
                                  {SHOP_STATUS_CONFIG[productStatus].label}
                                </Typography>
                                {/* Show date info */}
                                {product.startDate && productStatus === 'COMING_SOON' && (
                                  <Typography sx={{ fontSize: '0.65rem', color: '#e2e8f0', mt: 0.5, textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
                                    เปิด {new Date(product.startDate).toLocaleDateString('th-TH')}
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
                                      if (days > 0) return `เหลือ ${days} วัน`;
                                      if (hours > 0) return `เหลือ ${hours} ชม.`;
                                      return 'ใกล้ปิด!';
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
                            }}>
                              <Typography sx={{ 
                                fontSize: '0.9rem', 
                                fontWeight: 800, 
                                color: isProductClosed ? '#94a3b8' : '#10b981',
                              }}>
                                ฿{product.basePrice.toLocaleString()}
                              </Typography>
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
                              color: isProductClosed ? '#94a3b8' : '#f1f5f9',
                              mb: 0.5,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              lineHeight: 1.3,
                            }}>
                              {product.name}
                            </Typography>
                            
                            {/* Description - Show more lines */}
                            <Typography sx={{ 
                              fontSize: '0.75rem', 
                              color: '#94a3b8',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              lineHeight: 1.4,
                              mb: 1,
                            }}>
                              {product.description || TYPE_LABELS[product.type] || product.type}
                            </Typography>

                            {/* Product Tags - from customTags or auto-generated */}
                            {(() => {
                              // Use customTags if defined, otherwise auto-generate from options
                              const tags = product.customTags && product.customTags.length > 0 
                                ? product.customTags 
                                : [
                                    // Auto-generate from endDate
                                    ...(product.endDate && new Date(product.endDate) > new Date() ? [{
                                      text: `ถึง ${new Date(product.endDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}`,
                                      color: '#f87171',
                                      bgColor: 'rgba(239,68,68,0.15)',
                                      borderColor: 'rgba(239,68,68,0.3)',
                                      icon: 'clock'
                                    }] : []),
                                    // Auto-generate from options
                                    ...(product.options?.hasCustomName ? [{
                                      text: 'สกรีนชื่อได้',
                                      color: '#34d399',
                                      bgColor: 'rgba(16,185,129,0.15)',
                                      borderColor: 'rgba(16,185,129,0.3)'
                                    }] : []),
                                    ...(product.options?.hasCustomNumber ? [{
                                      text: 'สกรีนเบอร์ได้',
                                      color: '#a5b4fc',
                                      bgColor: 'rgba(99,102,241,0.15)',
                                      borderColor: 'rgba(99,102,241,0.3)'
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
                                      {tag.text}
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
                                      ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' 
                                      : 'rgba(100,116,139,0.2)',
                                    color: isProductAvailable ? 'white' : '#64748b',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    textTransform: 'none',
                                    '&:hover': {
                                      background: isProductAvailable 
                                        ? 'linear-gradient(135deg, #5558e8 0%, #7c3aed 100%)' 
                                        : 'rgba(100,116,139,0.2)',
                                    },
                                  }}
                                >
                                  {isShopOpen ? 'ดูรายละเอียด' : 'ร้านปิดชั่วคราว'}
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
                                    {SHOP_STATUS_CONFIG[productStatus].label}
                                  </Typography>
                                </Box>
                              )}
                            </Box>
                          </Box>
                        </Box>
                      </Grid>
                    );
                    })}
                  </Grid>
                </Box>
              ))
            ) : (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Store size={64} style={{ color: '#64748b', marginBottom: 16 }} />
                <Typography variant="h6" sx={{ color: '#94a3b8', mb: 1 }}>
                  {totalProductCount > 0 ? 'ไม่พบสินค้าที่ค้นหา' : 'ยังไม่มีสินค้า'}
                </Typography>
                {totalProductCount === 0 && (
                  <Typography sx={{ color: '#64748b', fontSize: '0.9rem' }}>
                    รอติดตามสินค้าใหม่เร็วๆ นี้
                  </Typography>
                )}
              </Box>
            )}
          </Container>
        </Box>

        {cart.length > 0 && (
          <Box sx={{ display: { xs: 'none', md: 'block' }, width: 350, p: 2, bgcolor: '#0f172a', borderLeft: '1px solid #334155', overflow: 'auto', maxHeight: 'calc(100vh - 64px)' }}>
            <Card sx={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(16px)' }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, color: '#f1f5f9' }}>
                  สรุปคำสั่งซื้อ
                </Typography>
                {cart.map((item) => (
                  <Box key={item.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, pb: 2, borderBottom: '1px solid #334155' }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#f1f5f9' }}>
                        {item.productName}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                        {item.size} × {item.quantity}
                      </Typography>
                      {(item.options.customName || item.options.customNumber || item.options.isLongSleeve) && (
                        <Typography variant="caption" sx={{ color: '#cbd5e1', display: 'block' }}>
                          {item.options.customName && `ชื่อ: ${item.options.customName}`} {item.options.customNumber && `เบอร์: ${item.options.customNumber}`} {item.options.isLongSleeve && '(แขนยาว)'}
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
                          sx={{ bgcolor: '#334155', color: '#f1f5f9' }}
                        >
                          <Minus size={14} />
                        </IconButton>
                        <Typography sx={{ color: '#f1f5f9', minWidth: 20, textAlign: 'center' }}>{item.quantity}</Typography>
                        <IconButton
                          size="small"
                          onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                          onMouseDown={() => startCartHold(item.id, 1)}
                          onMouseUp={() => stopCartHold(item.id)}
                          onMouseLeave={() => stopCartHold(item.id)}
                          onTouchStart={() => startCartHold(item.id, 1)}
                          onTouchEnd={() => stopCartHold(item.id)}
                          sx={{ bgcolor: '#334155', color: '#f1f5f9' }}
                        >
                          <Plus size={14} />
                        </IconButton>
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#10b981' }}>
                        {(item.unitPrice * item.quantity).toLocaleString()}฿
                      </Typography>
                      <IconButton size="small" onClick={() => removeFromCart(item.id)} sx={{ color: '#ef4444' }}>
                        <X size={14} />
                      </IconButton>
                    </Box>
                  </Box>
                ))}
                <Divider sx={{ my: 2, borderColor: '#334155' }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Typography sx={{ fontWeight: 'bold', color: '#f1f5f9' }}>รวม:</Typography>
                  <Typography sx={{ fontWeight: 'bold', fontSize: 18, color: '#10b981' }}>
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
                    background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
                    fontWeight: 700,
                    borderRadius: 2,
                    py: 1,
                    boxShadow: '0 12px 30px rgba(16, 185, 129, 0.35)',
                    '&:hover': { background: 'linear-gradient(135deg, #0ea472 0%, #0591b5 100%)', boxShadow: '0 12px 34px rgba(16, 185, 129, 0.45)' },
                  }}
                >
                  ดำเนินการสั่งซื้อ
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
          showToast('success', 'ชำระเงินสำเร็จ!');
          
          // Refresh order history from server to get complete data
          setTimeout(() => {
            loadOrderHistory();
          }, 500);
        }}
      />

      {showProfileModal && (
        <ProfileModal
          initialData={{ name: orderData.name, phone: orderData.phone, address: orderData.address, instagram: orderData.instagram }}
          onClose={() => { setShowProfileModal(false); setActiveTab('home'); }}
          onSave={handleSaveProfile}
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
          if (confirm('ล้างตะกร้าทั้งหมด?')) {
            saveCart([]);
            showToast('success', 'ล้างตะกร้าแล้ว');
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
            bgcolor: '#0a0f1a',
            color: '#f1f5f9',
            borderRadius: '20px',
            border: '1px solid rgba(255,255,255,0.1)',
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
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{
              width: 40,
              height: 40,
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              display: 'grid',
              placeItems: 'center',
            }}>
              <Ruler size={20} color="white" />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', color: '#f1f5f9' }}>ตารางไซส์</Typography>
              <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>สัดส่วนรอบอก/ความยาว (นิ้ว)</Typography>
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
              bgcolor: 'rgba(99,102,241,0.15)',
              border: '1px solid rgba(99,102,241,0.3)',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: '#a5b4fc',
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
            }}>
              <Ruler size={14} /> อก / ความยาว (นิ้ว)
            </Box>
            <Box sx={{
              px: 1.2,
              py: 0.4,
              borderRadius: '8px',
              bgcolor: 'rgba(245,158,11,0.15)',
              border: '1px solid rgba(245,158,11,0.3)',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: '#fbbf24',
            }}>
              แขนยาว +{selectedProduct?.options?.longSleevePrice ?? 50}฿
            </Box>
          </Box>

          {/* Size Cards Grid */}
          <Box sx={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(2, 1fr)', 
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
                    bgcolor: 'rgba(30,41,59,0.6)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      bgcolor: 'rgba(30,41,59,0.8)',
                      borderColor: 'rgba(99,102,241,0.3)',
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Box sx={{
                      px: 1,
                      py: 0.3,
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      color: 'white',
                    }}>
                      {size}
                    </Box>
                    <Typography sx={{ fontSize: '0.95rem', fontWeight: 800, color: '#10b981' }}>
                      {row ? `฿${row.price.toLocaleString()}` : '—'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1.5 }}>
                    <Box>
                      <Typography sx={{ fontSize: '0.65rem', color: '#64748b', mb: 0.2 }}>รอบอก</Typography>
                      <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color: '#e2e8f0' }}>
                        {measurements ? `${measurements.chest}"` : '—'}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: '0.65rem', color: '#64748b', mb: 0.2 }}>ความยาว</Typography>
                      <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color: '#e2e8f0' }}>
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
          borderTop: '1px solid rgba(255,255,255,0.08)',
        }}>
          <Button
            fullWidth
            onClick={() => setShowSizeChart(false)}
            sx={{
              py: 1.3,
              borderRadius: '12px',
              bgcolor: 'rgba(255,255,255,0.05)',
              color: '#94a3b8',
              fontSize: '0.9rem',
              fontWeight: 600,
              '&:hover': {
                bgcolor: 'rgba(255,255,255,0.1)',
              },
            }}
          >
            ปิด
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
      />

      <Dialog
        open={!!confirmCancelRef}
        onClose={() => setConfirmCancelRef(null)}
        fullScreen={isMobile}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: 420 },
            maxWidth: 'calc(100% - 24px)',
            bgcolor: '#0b1120',
            color: '#e2e8f0',
            borderRadius: 2,
            p: 1,
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
          <AlertTriangle size={20} color="#fbbf24" />
          ยืนยันยกเลิกคำสั่งซื้อ
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#cbd5e1', mb: 1 }}>
            ต้องการยกเลิกคำสั่งซื้อหมายเลข {confirmCancelRef ? `#${confirmCancelRef}` : ''} หรือไม่?
          </Typography>
          <Typography variant="caption" sx={{ color: '#94a3b8' }}>
            การยกเลิกจะไม่สามารถย้อนกลับได้ และสถานะจะเปลี่ยนเป็น ยกเลิก
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button
            variant="outlined"
            onClick={() => setConfirmCancelRef(null)}
            sx={{ color: '#cbd5e1', borderColor: '#334155' }}
          >
            ไม่ยกเลิก
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
              background: '#ef4444',
              '&:hover': { background: '#dc2626' },
              fontWeight: 800,
              px: 2.5,
            }}
          >
            ยืนยันยกเลิก
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
      />

      <Box
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          bgcolor: 'rgba(15,23,42,0.95)',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.4)',
          display: { xs: 'flex', md: 'none' },
          justifyContent: 'space-around',
          py: 1,
          px: 1,
          touchAction: 'pan-y',
          WebkitOverflowScrolling: 'touch',
          paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
          zIndex: 1100,
          transform: hideNavBars ? 'translateY(120%)' : 'translateY(0)',
          opacity: hideNavBars ? 0 : 1,
          transition: 'transform 0.32s ease, opacity 0.28s ease',
        }}
      >
        {bottomTabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <IconButton
              key={tab.key}
              data-tab-key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 0.3,
                color: isActive ? '#6366f1' : '#94a3b8',
                borderRadius: 0,
                px: 2.5,
                py: 0.5,
                background: 'transparent',
                border: 'none',
                boxShadow: 'none',
                transform: 'none',
                transition: 'color 0.2s ease',
                '&:hover': {
                  background: 'transparent',
                  color: isActive ? '#6366f1' : '#e2e8f0',
                },
                touchAction: 'manipulation',
              }}
            >
              {tab.icon}
              <Typography variant="caption" sx={{ fontSize: '0.65rem', fontWeight: isActive ? 700 : 500 }}>{tab.label}</Typography>
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
                bg: 'linear-gradient(135deg, rgba(59, 130, 246, 0.98) 0%, rgba(37, 99, 235, 0.98) 100%)', 
                icon: <Info size={18} />,
                shadow: '0 8px 32px rgba(59, 130, 246, 0.35)',
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
                      color: 'rgba(255,255,255,0.8)',
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
        sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 10, backdropFilter: 'blur(2px)', bgcolor: 'rgba(15, 23, 42, 0.55)' }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
          <CircularProgress color="inherit" size={36} />
          <Typography variant="body2" sx={{ color: '#e2e8f0' }}>
            {savingProfile ? 'กำลังบันทึกข้อมูล...' : 'กำลังประมวลผล...'}
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
            bgcolor: '#0a0f1a',
            backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(6, 182, 212, 0.1) 0%, transparent 50%)',
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
              bgcolor: 'rgba(255,255,255,0.1)',
              color: '#f1f5f9',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
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
              background: 'linear-gradient(135deg, #06b6d4 0%, #10b981 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 2,
              boxShadow: '0 8px 32px rgba(6, 182, 212, 0.3)',
            }}>
              <Package size={32} color="white" />
            </Box>
            <Typography sx={{ fontSize: '1.5rem', fontWeight: 800, color: '#f1f5f9', mb: 0.5 }}>
              QR Code รับสินค้า
            </Typography>
            <Typography sx={{ fontSize: '0.9rem', color: '#94a3b8' }}>
              แสดง QR Code นี้ให้พนักงาน
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
            bgcolor: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            mb: 4,
          }}>
            <Typography sx={{ 
              fontSize: '0.75rem', 
              color: '#64748b', 
              textAlign: 'center',
              mb: 0.5,
            }}>
              หมายเลขคำสั่งซื้อ
            </Typography>
            <Typography sx={{ 
              fontSize: '1.3rem', 
              fontWeight: 800, 
              color: '#06b6d4',
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
                  <MapPin size={18} style={{ color: '#10b981' }} />
                  <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#10b981' }}>
                    สถานที่รับสินค้า
                  </Typography>
                </Box>
                {uniqueLocations.map((loc, idx) => (
                  <Typography key={idx} sx={{ fontSize: '1rem', color: '#f1f5f9', fontWeight: 600, mb: 0.5 }}>
                    {loc}
                  </Typography>
                ))}
                {firstPickup && (firstPickup.startDate || firstPickup.endDate) && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
                    <Clock size={14} style={{ color: '#64748b' }} />
                    <Typography sx={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                      {firstPickup.startDate && new Date(firstPickup.startDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      {firstPickup.startDate && firstPickup.endDate && ' - '}
                      {firstPickup.endDate && new Date(firstPickup.endDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </Typography>
                  </Box>
                )}
                {firstPickup?.notes && (
                  <Typography sx={{ fontSize: '0.8rem', color: '#fbbf24', mt: 1 }}>
                    📝 {firstPickup.notes}
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
              bgcolor: 'rgba(255,255,255,0.1)',
              color: '#f1f5f9',
              fontSize: '1rem',
              fontWeight: 600,
              textTransform: 'none',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' },
            }}
          >
            ปิด
          </Button>
        </Box>
      </Dialog>

      {/* Chatbot */}
      <ShirtChatBot open={chatbotOpen} setOpen={setChatbotOpen} />

      {/* Support Chat Widget - ปุ่มแชทสนับสนุน */}
      <SupportChatWidget onOpenChatbot={() => setChatbotOpen(true)} />
    </Box>
  );
}
