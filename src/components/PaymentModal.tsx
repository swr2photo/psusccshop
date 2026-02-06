'use client';

import { useState, useEffect, useRef } from 'react';
import type { JSX } from 'react';
import { X, Upload, Check, Loader2, AlertCircle, CheckCircle2, Image, Clock3, Download, CreditCard, QrCode, Copy, Smartphone, ArrowRight, Sparkles, AlertTriangle, Info, ShoppingBag, Tag, Hash, Shirt, Clock } from 'lucide-react';
import { Drawer, Box, Typography, Button, IconButton, Skeleton, useMediaQuery, LinearProgress, Slide, Collapse } from '@mui/material';
import { QRCodeSVG } from 'qrcode.react';

interface PaymentModalProps {
  orderRef: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface CartItem {
  productName: string;
  size: string;
  quantity: number;
  unitPrice: number;
  customName?: string;
  customNumber?: string;
  isLongSleeve?: boolean;
}

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message?: string;
}

// ============== ENHANCED TOAST SYSTEM ==============

const TOAST_STYLES = {
  success: {
    bg: 'linear-gradient(135deg, rgba(16, 185, 129, 0.98) 0%, rgba(5, 150, 105, 0.98) 100%)',
    border: 'rgba(16, 185, 129, 0.5)',
    icon: <CheckCircle2 size={18} />,
    shadow: '0 8px 32px rgba(16, 185, 129, 0.35)',
  },
  error: {
    bg: 'linear-gradient(135deg, rgba(239, 68, 68, 0.98) 0%, rgba(220, 38, 38, 0.98) 100%)',
    border: 'rgba(239, 68, 68, 0.5)',
    icon: <AlertCircle size={18} />,
    shadow: '0 8px 32px rgba(239, 68, 68, 0.35)',
  },
  warning: {
    bg: 'linear-gradient(135deg, rgba(245, 158, 11, 0.98) 0%, rgba(234, 88, 12, 0.98) 100%)',
    border: 'rgba(245, 158, 11, 0.5)',
    icon: <AlertTriangle size={18} />,
    shadow: '0 8px 32px rgba(245, 158, 11, 0.35)',
  },
  info: {
    bg: 'linear-gradient(135deg, rgba(59, 130, 246, 0.98) 0%, rgba(37, 99, 235, 0.98) 100%)',
    border: 'rgba(59, 130, 246, 0.5)',
    icon: <Info size={18} />,
    shadow: '0 8px 32px rgba(59, 130, 246, 0.35)',
  },
};

const usePaymentToast = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timeout = timeoutsRef.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeoutsRef.current.delete(id);
    }
  };

  const addToast = (type: Toast['type'], title: string, message?: string) => {
    const id = `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const newToast: Toast = { id, type, title, message };
    
    setToasts((prev) => {
      // Prevent duplicates
      if (prev.some((t) => t.title === title && t.type === type)) {
        return prev;
      }
      // Keep max 3 toasts
      return [...prev, newToast].slice(-3);
    });
    
    const duration = type === 'error' ? 5000 : 3500;
    const timeout = setTimeout(() => removeToast(id), duration);
    timeoutsRef.current.set(id, timeout);
    
    return id;
  };

  return { toasts, addToast, removeToast };
};

function PaymentToastContainer({
  toasts,
  removeToast,
}: {
  toasts: Toast[];
  removeToast: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <Box
      sx={{
        position: 'absolute',
        bottom: { xs: 200, sm: 180 },
        left: 0,
        right: 0,
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column-reverse',
        alignItems: 'center',
        gap: 1.5,
        px: 2,
        pointerEvents: 'none',
      }}
    >
      {toasts.map((toast) => {
        const style = TOAST_STYLES[toast.type];
        return (
          <Slide key={toast.id} direction="up" in={true} mountOnEnter unmountOnExit>
            <Box
              sx={{
                background: style.bg,
                backdropFilter: 'blur(16px)',
                border: `1px solid ${style.border}`,
                color: 'white',
                py: 1.5,
                px: 2,
                borderRadius: '14px',
                boxShadow: style.shadow,
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                maxWidth: 380,
                width: '100%',
                pointerEvents: 'auto',
                animation: 'toastSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
                '@keyframes toastSlideUp': {
                  '0%': { opacity: 0, transform: 'translateY(12px) scale(0.96)' },
                  '100%': { opacity: 1, transform: 'translateY(0) scale(1)' },
                },
                '&:hover': {
                  transform: 'scale(1.02)',
                  transition: 'transform 0.2s ease',
                },
              }}
            >
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: '10px',
                  bgcolor: 'rgba(255, 255, 255, 0.2)',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                {style.icon}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', lineHeight: 1.3 }}>{toast.title}</Typography>
                {toast.message && (
                  <Typography sx={{ fontSize: '0.75rem', opacity: 0.9, lineHeight: 1.3, mt: 0.2 }}>
                    {toast.message}
                  </Typography>
                )}
              </Box>
              <IconButton 
                size="small" 
                onClick={() => removeToast(toast.id)} 
                sx={{ 
                  color: 'rgba(255, 255, 255, 0.8)', 
                  p: 0.5,
                  '&:hover': { color: 'white', bgcolor: 'var(--glass-bg)' } 
                }}
              >
                <X size={14} />
              </IconButton>
            </Box>
          </Slide>
        );
      })}
    </Box>
  );
}

// สถานะที่ถือว่าชำระเงินแล้ว
const PAID_STATUSES = ['PAID', 'COMPLETED', 'SHIPPED', 'READY', 'VERIFYING'];

export default function PaymentModal({ orderRef, onClose, onSuccess }: PaymentModalProps): JSX.Element {
  const { toasts, addToast, removeToast } = usePaymentToast();
  const isMobile = useMediaQuery('(max-width: 640px)');
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [qrPayload, setQrPayload] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [amount, setAmount] = useState(0);
  const [baseAmount, setBaseAmount] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [showCartDetails, setShowCartDetails] = useState(false);
  const [orderStatus, setOrderStatus] = useState<string>('PENDING');
  
  // สถานะระบบชำระเงิน
  const [paymentEnabled, setPaymentEnabled] = useState(true);
  const [paymentDisabledMessage, setPaymentDisabledMessage] = useState<string | null>(null);
  
  // ตรวจสอบว่าชำระเงินแล้วหรือยัง
  const isPaid = PAID_STATUSES.includes(orderStatus.toUpperCase());

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Step tracking: 0 = QR, 1 = Upload, 2 = Confirm
  const [activeStep, setActiveStep] = useState(0);

  const hasSlip = Boolean(selectedFile);
  const discountValue = Math.abs(discount);

  useEffect(() => {
    fetchPaymentInfo();
  }, [orderRef]);

  useEffect(() => {
    if (hasSlip) setActiveStep(2);
    else if (!loading) setActiveStep(0);
  }, [hasSlip, loading]);

  const fetchPaymentInfo = async () => {
    setLoading(true);
    try {
      const res: Response = await fetch(`/api/payment-info?ref=${encodeURIComponent(orderRef)}`);
      const data: any = await res.json();

      if (data.status === 'success') {
        const info = data.data || data;
        setQrPayload(info.qrPayload || null);
        setQrUrl(info.qrUrl || null);
        setAmount(Number(info.finalAmount ?? info.amount ?? 0));
        setBaseAmount(Number(info.baseAmount ?? info.amount ?? 0));
        setDiscount(Number(info.discount ?? 0));
        setCartItems(info.cart || []);
        setOrderStatus(info.status || 'PENDING');
        // สถานะระบบชำระเงิน
        setPaymentEnabled(info.paymentEnabled !== false);
        setPaymentDisabledMessage(info.paymentDisabledMessage || null);
      } else {
        addToast('error', 'ข้อผิดพลาด', data.message || 'ไม่พบข้อมูลชำระเงิน');
      }
    } catch (error) {
      addToast('error', 'เชื่อมต่อไม่ได้', 'ลองใหม่อีกครั้ง');
    } finally {
      setLoading(false);
    }
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      addToast('error', 'ไฟล์ไม่ถูกต้อง', 'เลือกรูปภาพ');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      addToast('error', 'ไฟล์ใหญ่เกินไป', 'ขนาดสูงสุด 5MB');
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = () => setPreviewUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleConfirmPayment = async () => {
    if (!selectedFile) {
      addToast('warning', 'กรุณาแนบสลิป');
      return;
    }

    setVerifying(true);
    const reader = new FileReader();
    reader.readAsDataURL(selectedFile);
    reader.onload = async () => {
      const base64 = reader.result?.toString().split(',')[1];
      try {
        const res: Response = await fetch('/api/payment/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ref: orderRef,
            base64,
            mime: selectedFile.type,
            name: selectedFile.name,
          }),
        });
        const data: any = await res.json();

        if (data.status === 'success') {
          // แสดงชื่อผู้โอนถ้ามี
          const senderName = data.data?.senderName;
          const successMsg = senderName 
            ? `ขอบคุณ ${senderName}` 
            : 'ระบบได้รับสลิปแล้ว';
          addToast('success', 'ชำระเงินสำเร็จ', successMsg);
          setTimeout(() => {
            onSuccess();
            onClose();
          }, 1800);
        } else {
          // แสดงข้อความ error ที่เฉพาะเจาะจง
          const errorCode = data.code;
          let title = 'ตรวจสอบไม่ผ่าน';
          let message = data.message || 'กรุณาตรวจสอบสลิปและลองใหม่';

          // ปรับ title ตาม error code
          if (errorCode === 1012) {
            title = 'สลิปซ้ำ';
            message = 'สลิปนี้เคยใช้แล้ว กรุณาโอนเงินใหม่';
          } else if (errorCode === 1013) {
            title = 'ยอดเงินไม่ตรง';
          } else if (errorCode === 1014) {
            title = 'บัญชีผิด';
            message = 'กรุณาโอนเข้าบัญชีที่ถูกต้อง';
          } else if (errorCode === 1007 || errorCode === 1008) {
            title = 'QR ไม่ถูกต้อง';
          } else if (errorCode === 'PAYMENT_DISABLED') {
            title = 'ระบบชำระเงินปิด';
            message = data.message || 'ระบบชำระเงินปิดชั่วคราว กรุณารอแอดมินเปิดระบบ';
            // อัปเดตสถานะเพื่อแสดง UI ที่ถูกต้อง
            setPaymentEnabled(false);
            setPaymentDisabledMessage(data.message);
          }

          addToast('error', title, message);
          
          // ถ้าสลิปซ้ำหรือบัญชีผิด ให้ reset slip
          if (errorCode === 1012 || errorCode === 1014) {
            setSelectedFile(null);
            setPreviewUrl(null);
            setActiveStep(0);
          }
        }
      } catch (error) {
        addToast('error', 'เกิดข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
      } finally {
        setVerifying(false);
      }
    };
  };

  const handleSaveQr = async () => {
    // If we have qrPayload, convert SVG to PNG and download
    if (qrPayload) {
      try {
        setDownloading(true);
        setDownloadProgress(30);
        
        // Find the QR SVG element by ID
        const svgElement = document.getElementById('promptpay-qr-svg');
        if (!svgElement) {
          addToast('error', 'ไม่พบ QR Code');
          setDownloading(false);
          setDownloadProgress(0);
          return;
        }
        
        setDownloadProgress(50);
        
        // Get SVG data
        const svgData = new XMLSerializer().serializeToString(svgElement);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const svgUrl = URL.createObjectURL(svgBlob);
        
        // Create canvas with padding for nice output
        const canvas = document.createElement('canvas');
        const padding = 40;
        const qrSize = 200;
        const totalSize = qrSize + (padding * 2);
        canvas.width = totalSize;
        canvas.height = totalSize + 60; // Extra space for text
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          addToast('error', 'ไม่สามารถสร้างรูปได้');
          setDownloading(false);
          setDownloadProgress(0);
          return;
        }
        
        // Draw gradient background
        const gradient = ctx.createLinearGradient(0, 0, totalSize, totalSize);
        gradient.addColorStop(0, '#1a237e');
        gradient.addColorStop(0.5, '#283593');
        gradient.addColorStop(1, '#3949ab');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw white rounded rectangle for QR
        ctx.fillStyle = '#ffffff';
        const rx = 16;
        const qrX = padding;
        const qrY = padding;
        ctx.beginPath();
        ctx.moveTo(qrX + rx, qrY);
        ctx.lineTo(qrX + qrSize - rx, qrY);
        ctx.quadraticCurveTo(qrX + qrSize, qrY, qrX + qrSize, qrY + rx);
        ctx.lineTo(qrX + qrSize, qrY + qrSize - rx);
        ctx.quadraticCurveTo(qrX + qrSize, qrY + qrSize, qrX + qrSize - rx, qrY + qrSize);
        ctx.lineTo(qrX + rx, qrY + qrSize);
        ctx.quadraticCurveTo(qrX, qrY + qrSize, qrX, qrY + qrSize - rx);
        ctx.lineTo(qrX, qrY + rx);
        ctx.quadraticCurveTo(qrX, qrY, qrX + rx, qrY);
        ctx.closePath();
        ctx.fill();
        
        setDownloadProgress(70);
        
        // Load and draw QR
        const img = document.createElement('img') as HTMLImageElement;
        img.onload = () => {
          ctx.drawImage(img, padding + 10, padding + 10, qrSize - 20, qrSize - 20);
          
          // Draw amount text
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 20px Arial, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`฿${amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`, totalSize / 2, totalSize + 35);
          
          // Draw "PromptPay" text
          ctx.font = '12px Arial, sans-serif';
          ctx.fillStyle = 'rgba(255,255,255,0.7)';
          ctx.fillText('PromptPay', totalSize / 2, totalSize + 52);
          
          setDownloadProgress(90);
          
          // Convert to blob and download
          canvas.toBlob((blob) => {
            if (blob) {
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = `promptpay-qr-${orderRef}.png`;
              link.click();
              URL.revokeObjectURL(url);
              setDownloadProgress(100);
              addToast('success', 'บันทึก QR Code แล้ว');
            } else {
              addToast('error', 'บันทึกไม่สำเร็จ');
            }
            setDownloading(false);
            setTimeout(() => setDownloadProgress(0), 500);
          }, 'image/png', 0.95);
          
          URL.revokeObjectURL(svgUrl);
        };
        
        img.onerror = () => {
          addToast('error', 'โหลด QR ไม่สำเร็จ');
          setDownloading(false);
          setDownloadProgress(0);
          URL.revokeObjectURL(svgUrl);
        };
        
        img.src = svgUrl;
      } catch (error) {
        addToast('error', 'บันทึกไม่สำเร็จ', 'ลองใหม่อีกครั้ง');
        setDownloading(false);
        setDownloadProgress(0);
      }
      return;
    }
    
    // Legacy: download from qrUrl
    if (!qrUrl) {
      addToast('warning', 'ยังไม่มี QR');
      return;
    }
    try {
      setDownloading(true);
      setDownloadProgress(0);
      const xhr = new XMLHttpRequest();
      xhr.open('GET', qrUrl, true);
      xhr.responseType = 'blob';
      xhr.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0) {
          const percent = Math.round((event.loaded / event.total) * 100);
          setDownloadProgress(percent);
        } else {
          setDownloadProgress((prev) => Math.min(99, prev + 5));
        }
      };
      xhr.onload = () => {
        if (xhr.status === 200) {
          const blob = xhr.response;
          const blobUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = `qr-${orderRef}.png`;
          link.click();
          URL.revokeObjectURL(blobUrl);
          setDownloadProgress(100);
          addToast('success', 'บันทึกคิวอาร์แล้ว');
        } else {
          addToast('error', 'บันทึกไม่สำเร็จ', 'ลองใหม่อีกครั้ง');
        }
        setDownloading(false);
        setTimeout(() => setDownloadProgress(0), 500);
      };
      xhr.onerror = () => {
        addToast('error', 'บันทึกไม่สำเร็จ', 'ลองใหม่อีกครั้ง');
        setDownloading(false);
        setDownloadProgress(0);
      };
      xhr.send();
    } catch (error) {
      addToast('error', 'บันทึกไม่สำเร็จ', 'ลองใหม่อีกครั้ง');
      setDownloading(false);
      setDownloadProgress(0);
    }
  };

  const copyAmount = () => {
    navigator.clipboard.writeText(amount.toString());
    addToast('success', 'คัดลอกยอดเงินแล้ว');
  };

  const steps = ['สแกน QR', 'แนบสลิป', 'ยืนยัน'];

  return (
    <Drawer
      anchor="bottom"
      open={true}
      onClose={onClose}
      PaperProps={{
        sx: {
          height: { xs: '85vh', sm: '85vh' },
          maxHeight: { xs: '85vh', sm: '90vh' },
          borderTopLeftRadius: { xs: 20, sm: 24 },
          borderTopRightRadius: { xs: 20, sm: 24 },
          bgcolor: 'background.default',
          overflow: 'hidden',
        },
      }}
    >
      <PaymentToastContainer toasts={toasts} removeToast={removeToast} />
      
      {/* Header - Compact */}
      <Box sx={{
        px: { xs: 2, sm: 3 },
        pt: 1,
        pb: 1.5,
        borderBottom: '1px solid var(--glass-border)',
        background: 'var(--glass-strong)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        {/* Drag Handle */}
        <Box sx={{ width: 36, height: 4, bgcolor: 'var(--glass-bg)', borderRadius: 3, mx: 'auto', mb: 1.5 }} />
        
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{
              width: 40,
              height: 40,
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
              display: 'grid',
              placeItems: 'center',
              boxShadow: '0 4px 16px rgba(16,185,129,0.25)',
            }}>
              <CreditCard size={20} color="white" />
            </Box>
            <Box>
              <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'text.primary', lineHeight: 1.2 }}>
                ชำระเงิน
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', fontFamily: 'monospace' }}>
                #{orderRef}
              </Typography>
            </Box>
          </Box>
          
          {/* Close Button */}
          <IconButton
            onClick={onClose}
            size="small"
            sx={{
              bgcolor: 'var(--glass-bg)',
              color: 'text.secondary',
              '&:hover': { bgcolor: 'var(--glass-bg)', color: 'text.primary' },
            }}
          >
            <X size={20} />
          </IconButton>
        </Box>

        {/* Progress Steps - Compact */}
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          gap: 0.5,
          mt: 1.5,
        }}>
          {steps.map((step, index) => (
            <Box key={step} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                px: 1,
                py: 0.4,
                borderRadius: '16px',
                bgcolor: activeStep >= index 
                  ? index === 2 && hasSlip ? 'rgba(16, 185, 129, 0.15)' : 'rgba(6, 182, 212, 0.15)'
                  : 'rgba(255,255,255,0.03)',
                border: `1px solid ${activeStep >= index 
                  ? index === 2 && hasSlip ? 'rgba(16, 185, 129, 0.3)' : 'rgba(6, 182, 212, 0.3)'
                  : 'transparent'}`,
                transition: 'all 0.3s ease',
              }}>
                <Box sx={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  bgcolor: activeStep >= index 
                    ? index === 2 && hasSlip ? '#10b981' : '#06b6d4'
                    : 'rgba(255,255,255,0.1)',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: '0.6rem',
                  fontWeight: 700,
                  color: activeStep >= index ? 'white' : '#64748b',
                }}>
                  {activeStep > index ? <Check size={10} /> : index + 1}
                </Box>
                <Typography sx={{ 
                  fontSize: '0.65rem', 
                  fontWeight: 600, 
                  color: activeStep >= index 
                    ? index === 2 && hasSlip ? '#6ee7b7' : '#67e8f9'
                    : '#64748b',
                }}>
                  {step}
                </Typography>
              </Box>
              {index < steps.length - 1 && (
                <ArrowRight size={12} style={{ color: 'var(--text-muted)' }} />
              )}
            </Box>
          ))}
        </Box>
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'auto', WebkitOverflowScrolling: 'touch', px: { xs: 2, sm: 3 }, py: 2.5 }}>
        {loading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, maxWidth: 500, mx: 'auto' }}>
            <Skeleton variant="rectangular" height={120} sx={{ bgcolor: 'var(--surface-2)', borderRadius: '20px' }} />
            <Skeleton variant="rectangular" height={300} sx={{ bgcolor: 'var(--surface-2)', borderRadius: '20px' }} />
            <Skeleton variant="rectangular" height={180} sx={{ bgcolor: 'var(--surface-2)', borderRadius: '20px' }} />
          </Box>
        ) : isPaid ? (
          /* ============== ALREADY PAID UI ============== */
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, maxWidth: 500, mx: 'auto' }}>
            {/* Success Hero Card */}
            <Box sx={{
              p: 4,
              borderRadius: '24px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: 'white',
              textAlign: 'center',
              position: 'relative',
              overflow: 'hidden',
            }}>
              {/* Decorative circles */}
              <Box sx={{
                position: 'absolute',
                top: -40,
                right: -40,
                width: 120,
                height: 120,
                borderRadius: '50%',
                bgcolor: 'var(--glass-bg)',
              }} />
              <Box sx={{
                position: 'absolute',
                bottom: -30,
                left: -30,
                width: 80,
                height: 80,
                borderRadius: '50%',
                bgcolor: 'var(--glass-bg)',
              }} />
              
              {/* Success Icon */}
              <Box sx={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                bgcolor: 'var(--glass-bg)',
                display: 'grid',
                placeItems: 'center',
                mx: 'auto',
                mb: 2,
                boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
              }}>
                <Check size={40} strokeWidth={3} />
              </Box>
              
              <Typography sx={{ fontSize: '1.5rem', fontWeight: 800, mb: 1 }}>
                ชำระเงินสำเร็จแล้ว!
              </Typography>
              <Typography sx={{ fontSize: '0.9rem', opacity: 0.9, mb: 2 }}>
                คำสั่งซื้อนี้ได้รับการชำระเงินเรียบร้อยแล้ว
              </Typography>
              
              {/* Order Reference */}
              <Box sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 1,
                px: 2,
                py: 0.8,
                borderRadius: '20px',
                bgcolor: 'var(--glass-bg)',
              }}>
                <Typography sx={{ fontSize: '0.8rem', opacity: 0.9 }}>
                  หมายเลขคำสั่งซื้อ:
                </Typography>
                <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, fontFamily: 'monospace' }}>
                  {orderRef}
                </Typography>
              </Box>
            </Box>

            {/* Status Info Card */}
            <Box sx={{
              p: 2.5,
              borderRadius: '20px',
              bgcolor: 'var(--surface-2)',
              border: '1px solid var(--glass-border)',
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                <Box sx={{
                  width: 36,
                  height: 36,
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, rgba(59,130,246,0.2) 0%, rgba(6,182,212,0.2) 100%)',
                  display: 'grid',
                  placeItems: 'center',
                }}>
                  <Clock size={18} style={{ color: '#60a5fa' }} />
                </Box>
                <Box>
                  <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: 'text.primary' }}>
                    สถานะคำสั่งซื้อ
                  </Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                    อัปเดตล่าสุด
                  </Typography>
                </Box>
              </Box>
              
              <Box sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                p: 1.5,
                borderRadius: '12px',
                bgcolor: 'rgba(16,185,129,0.1)',
                border: '1px solid rgba(16,185,129,0.2)',
              }}>
                <Box sx={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  bgcolor: '#10b981',
                  display: 'grid',
                  placeItems: 'center',
                }}>
                  <Check size={14} color="white" />
                </Box>
                <Box>
                  <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#6ee7b7' }}>
                    {orderStatus === 'PAID' && 'ซื้อสำเร็จ - รอรับสินค้า'}
                    {orderStatus === 'READY' && 'พร้อมรับสินค้า'}
                    {orderStatus === 'SHIPPED' && 'จัดส่งแล้ว'}
                    {orderStatus === 'COMPLETED' && 'สำเร็จ'}
                    {orderStatus === 'VERIFYING' && 'กำลังตรวจสอบสลิป'}
                    {!['PAID', 'READY', 'SHIPPED', 'COMPLETED', 'VERIFYING'].includes(orderStatus) && 'ดำเนินการแล้ว'}
                  </Typography>
                  <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                    รอแอดมินเตรียมสินค้า
                  </Typography>
                </Box>
              </Box>
            </Box>

            {/* Amount Paid Card */}
            <Box sx={{
              p: 2.5,
              borderRadius: '20px',
              bgcolor: 'var(--surface-2)',
              border: '1px solid var(--glass-border)',
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography sx={{ fontSize: '0.9rem', color: 'text.secondary' }}>
                  ยอดที่ชำระแล้ว
                </Typography>
                <Typography sx={{ fontSize: '1.5rem', fontWeight: 800, color: '#10b981' }}>
                  ฿{amount.toLocaleString()}
                </Typography>
              </Box>
            </Box>

            {/* Close Button */}
            <Button
              fullWidth
              onClick={onClose}
              sx={{
                py: 1.8,
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                color: 'white',
                fontSize: '1rem',
                fontWeight: 700,
                textTransform: 'none',
                boxShadow: '0 8px 24px rgba(59,130,246,0.35)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                },
              }}
            >
              ปิด
            </Button>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, maxWidth: 500, mx: 'auto' }}>
            
            {/* Amount Card - Hero Style */}
            <Box sx={{
              p: 3,
              borderRadius: '24px',
              background: 'linear-gradient(135deg, #10b981 0%, #0891b2 100%)',
              color: 'white',
              textAlign: 'center',
              position: 'relative',
              overflow: 'hidden',
            }}>
              {/* Decorative circles */}
              <Box sx={{
                position: 'absolute',
                top: -30,
                right: -30,
                width: 100,
                height: 100,
                borderRadius: '50%',
                bgcolor: 'var(--glass-bg)',
              }} />
              <Box sx={{
                position: 'absolute',
                bottom: -20,
                left: -20,
                width: 60,
                height: 60,
                borderRadius: '50%',
                bgcolor: 'var(--glass-bg)',
              }} />
              
              <Typography sx={{ fontSize: '0.85rem', opacity: 0.9, mb: 1, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'center' }}>
                <CreditCard size={16} /> ยอดที่ต้องชำระ
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5 }}>
                <Typography sx={{ fontSize: '3rem', fontWeight: 900, letterSpacing: '-2px' }}>
                  ฿{amount.toLocaleString()}
                </Typography>
                <IconButton 
                  onClick={copyAmount} 
                  sx={{ 
                    color: 'var(--foreground)', 
                    bgcolor: 'var(--glass-bg)',
                    '&:hover': { bgcolor: 'var(--glass-bg)' },
                  }}
                >
                  <Copy size={16} />
                </IconButton>
              </Box>
              {discountValue > 0 && (
                <Box sx={{ 
                  display: 'inline-flex', 
                  alignItems: 'center',
                  gap: 1.5, 
                  mt: 1.5, 
                  px: 2,
                  py: 0.5,
                  borderRadius: '20px',
                  bgcolor: 'var(--glass-bg)',
                  fontSize: '0.8rem',
                }}>
                  <Typography sx={{ opacity: 0.9, textDecoration: 'line-through' }}>฿{baseAmount.toLocaleString()}</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Sparkles size={12} />
                    <Typography sx={{ color: '#a7f3d0', fontWeight: 600 }}>ลด ฿{discountValue.toLocaleString()}</Typography>
                  </Box>
                </Box>
              )}
            </Box>

            {/* Payment Disabled Alert */}
            {!paymentEnabled && (
              <Box sx={{
                p: 2.5,
                borderRadius: '20px',
                background: 'linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(220,38,38,0.1) 100%)',
                border: '1px solid rgba(239,68,68,0.3)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 2,
              }}>
                <Box sx={{
                  width: 44,
                  height: 44,
                  borderRadius: '12px',
                  bgcolor: 'rgba(239,68,68,0.2)',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}>
                  <AlertCircle size={24} style={{ color: '#f87171' }} />
                </Box>
                <Box>
                  <Typography sx={{ 
                    fontSize: '1rem', 
                    fontWeight: 700, 
                    color: '#fca5a5', 
                    mb: 0.5 
                  }}>
                    ระบบชำระเงินปิดชั่วคราว
                  </Typography>
                  <Typography sx={{ 
                    fontSize: '0.85rem', 
                    color: '#fda4af',
                    lineHeight: 1.6,
                  }}>
                    {paymentDisabledMessage || 'ขณะนี้ระบบชำระเงินปิดให้บริการชั่วคราว กรุณารอแอดมินเปิดระบบก่อนทำการชำระเงิน'}
                  </Typography>
                </Box>
              </Box>
            )}

            {/* Cart Items Card */}
            {cartItems.length > 0 && (
              <Box sx={{
                borderRadius: '24px',
                bgcolor: 'var(--surface-2)',
                border: '1px solid var(--glass-border)',
                overflow: 'hidden',
              }}>
                {/* Card Header - Clickable */}
                <Box 
                  onClick={() => setShowCartDetails(!showCartDetails)}
                  sx={{ 
                    px: 2.5, 
                    py: 2, 
                    borderBottom: showCartDetails ? '1px solid var(--glass-border)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                    '&:hover': { bgcolor: 'var(--glass-bg)' },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box sx={{
                      width: 40,
                      height: 40,
                      borderRadius: '12px',
                      background: 'linear-gradient(135deg, rgba(30,64,175,0.2) 0%, rgba(236,72,153,0.2) 100%)',
                      display: 'grid',
                      placeItems: 'center',
                    }}>
                      <ShoppingBag size={20} style={{ color: '#c4b5fd' }} />
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'text.primary' }}>
                        รายการสินค้า
                      </Typography>
                      <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                        {cartItems.length} รายการ • {cartItems.reduce((sum, item) => sum + item.quantity, 0)} ชิ้น
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{
                      px: 1.5,
                      py: 0.5,
                      borderRadius: '20px',
                      bgcolor: 'rgba(30,64,175,0.1)',
                      border: '1px solid rgba(30,64,175,0.2)',
                    }}>
                      <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: '#c4b5fd' }}>
                        {showCartDetails ? 'ซ่อน' : 'ดูรายละเอียด'}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
                
                {/* Cart Items List */}
                <Collapse in={showCartDetails}>
                  <Box sx={{ px: 2, py: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {cartItems.map((item, index) => (
                      <Box 
                        key={index}
                        sx={{
                          p: 2,
                          borderRadius: '16px',
                          bgcolor: 'var(--surface)',
                          border: '1px solid rgba(255,255,255,0.04)',
                        }}
                      >
                        {/* Product Name & Quantity */}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                          <Box sx={{ flex: 1 }}>
                            <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color: 'text.primary' }}>
                              {item.productName}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                              <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                                ไซส์ {item.size}
                              </Typography>
                              <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>•</Typography>
                              <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                                x{item.quantity}
                              </Typography>
                            </Box>
                          </Box>
                          <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: '#6ee7b7' }}>
                            ฿{(item.unitPrice * item.quantity).toLocaleString()}
                          </Typography>
                        </Box>
                        
                        {/* Custom Options Badges */}
                        {(item.customName || item.customNumber || item.isLongSleeve) && (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8, mt: 1.5 }}>
                            {item.customName && (
                              <Box sx={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 0.5,
                                px: 1.2,
                                py: 0.4,
                                borderRadius: '8px',
                                bgcolor: 'rgba(236,72,153,0.15)',
                                border: '1px solid rgba(236,72,153,0.3)',
                              }}>
                                <Tag size={12} style={{ color: '#f472b6' }} />
                                <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: '#f9a8d4' }}>
                                  {item.customName}
                                </Typography>
                              </Box>
                            )}
                            {item.customNumber && (
                              <Box sx={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 0.5,
                                px: 1.2,
                                py: 0.4,
                                borderRadius: '8px',
                                bgcolor: 'rgba(251,191,36,0.15)',
                                border: '1px solid rgba(251,191,36,0.3)',
                              }}>
                                <Hash size={12} style={{ color: '#fbbf24' }} />
                                <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: '#fcd34d' }}>
                                  เบอร์ {item.customNumber}
                                </Typography>
                              </Box>
                            )}
                            {item.isLongSleeve && (
                              <Box sx={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 0.5,
                                px: 1.2,
                                py: 0.4,
                                borderRadius: '8px',
                                bgcolor: 'rgba(34,211,238,0.15)',
                                border: '1px solid rgba(34,211,238,0.3)',
                              }}>
                                <Shirt size={12} style={{ color: '#22d3ee' }} />
                                <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: '#67e8f9' }}>
                                  แขนยาว
                                </Typography>
                              </Box>
                            )}
                          </Box>
                        )}
                      </Box>
                    ))}
                  </Box>
                </Collapse>
              </Box>
            )}

            {/* QR Code Card */}
            <Box sx={{
              borderRadius: '24px',
              bgcolor: 'var(--surface-2)',
              border: '1px solid var(--glass-border)',
              overflow: 'hidden',
            }}>
              {/* Card Header */}
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
                    background: 'linear-gradient(135deg, rgba(16,185,129,0.2) 0%, rgba(6,182,212,0.2) 100%)',
                    display: 'grid',
                    placeItems: 'center',
                  }}>
                    <QrCode size={20} style={{ color: '#6ee7b7' }} />
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'text.primary' }}>
                      สแกนเพื่อโอนเงิน
                    </Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                      PromptPay / Mobile Banking
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{
                  px: 1.5,
                  py: 0.5,
                  borderRadius: '20px',
                  bgcolor: 'rgba(16,185,129,0.1)',
                  border: '1px solid rgba(16,185,129,0.2)',
                }}>
                  <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: '#6ee7b7' }}>
                    ขั้นตอนที่ 1
                  </Typography>
                </Box>
              </Box>
              
              {/* QR Image */}
              <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {!paymentEnabled ? (
                  /* Payment Disabled - Hide QR */
                  <Box sx={{ 
                    width: 220,
                    height: 220,
                    bgcolor: 'rgba(239,68,68,0.1)', 
                    borderRadius: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 1.5,
                    mb: 2,
                    border: '2px dashed rgba(239,68,68,0.3)',
                  }}>
                    <AlertCircle size={40} style={{ color: '#f87171' }} />
                    <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color: '#fca5a5', textAlign: 'center', px: 2 }}>
                      ระบบชำระเงินปิดอยู่
                    </Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: '#fb7185', textAlign: 'center', px: 2 }}>
                      รอแอดมินเปิดระบบก่อน
                    </Typography>
                  </Box>
                ) : qrPayload ? (
                  <Box sx={{ 
                    background: 'linear-gradient(135deg, #1a237e 0%, #283593 50%, #3949ab 100%)',
                    borderRadius: '20px', 
                    p: 2,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                    mb: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                  }}>
                    {/* PromptPay Header */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                      <Typography sx={{ color: '#fff', fontWeight: 700, letterSpacing: 1, textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                        พร้อมเพย์
                      </Typography>
                      <Box component="span" sx={{ bgcolor: '#fff', color: '#1a237e', px: 1, py: 0.25, borderRadius: 1, fontSize: '0.65rem', fontWeight: 700 }}>
                        PROMPTPAY
                      </Box>
                    </Box>
                    {/* QR Code */}
                    <Box sx={{ bgcolor: '#fff', p: 2, borderRadius: 2, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
                      <QRCodeSVG
                        id="promptpay-qr-svg"
                        value={qrPayload}
                        size={200}
                        level="M"
                        includeMargin={false}
                        bgColor="#ffffff"
                        fgColor="#1a237e"
                      />
                    </Box>
                    {/* Amount */}
                    <Box sx={{ mt: 1.5, textAlign: 'center' }}>
                      <Typography sx={{ color: 'var(--foreground)', fontSize: '0.75rem', mb: 0.25 }}>
                        จำนวนเงิน
                      </Typography>
                      <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '1.25rem', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                        ฿{amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                      </Typography>
                    </Box>
                    {/* Account Name */}
                    <Box sx={{ mt: 1, textAlign: 'center', bgcolor: 'var(--glass-bg)', borderRadius: 1.5, px: 2, py: 0.75 }}>
                      <Typography sx={{ color: 'var(--foreground)', fontSize: '0.65rem' }}>
                        ชื่อบัญชี
                      </Typography>
                      <Typography sx={{ color: '#fff', fontWeight: 600, fontSize: '0.8rem' }}>
                        นายวีรชาติ แก้วขำ
                      </Typography>
                      <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.6rem' }}>
                        (เลขานุการชุมนุมคอมพิวเตอร์)
                      </Typography>
                    </Box>
                    <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.65rem', mt: 1, textAlign: 'center' }}>
                      สแกน QR Code ด้วยแอปธนาคาร
                    </Typography>
                  </Box>
                ) : qrUrl ? (
                  /* Legacy fallback using img tag */
                  <Box sx={{ 
                    bgcolor: 'white', 
                    borderRadius: '20px', 
                    p: 2.5,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                    mb: 2,
                  }}>
                    <Box
                      component="img"
                      src={qrUrl}
                      alt="QR Code"
                      sx={{ 
                        width: 220,
                        height: 220,
                        objectFit: 'contain',
                        display: 'block',
                      }}
                    />
                  </Box>
                ) : (
                  <Box sx={{ 
                    width: 220,
                    height: 220,
                    bgcolor: 'rgba(100,116,139,0.1)', 
                    borderRadius: '20px',
                    display: 'grid',
                    placeItems: 'center',
                    mb: 2,
                  }}>
                    <Loader2 size={32} style={{ color: 'text.secondary' }} className="animate-spin" />
                  </Box>
                )}

                <Button
                  fullWidth
                  startIcon={downloading ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                  onClick={handleSaveQr}
                  disabled={(!qrPayload && !qrUrl) || downloading || !paymentEnabled}
                  sx={{
                    py: 1.3,
                    borderRadius: '12px',
                    bgcolor: paymentEnabled ? 'rgba(16,185,129,0.1)' : 'rgba(100,116,139,0.1)',
                    border: paymentEnabled ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(100,116,139,0.2)',
                    color: paymentEnabled ? '#6ee7b7' : '#64748b',
                    fontWeight: 600,
                    textTransform: 'none',
                    '&:hover': { bgcolor: paymentEnabled ? 'rgba(16,185,129,0.2)' : 'rgba(100,116,139,0.15)' },
                    '&:disabled': { opacity: 0.5 },
                  }}
                >
                  {downloading ? `บันทึก... ${downloadProgress}%` : 'บันทึก QR ลงเครื่อง'}
                </Button>
                {downloading && (
                  <LinearProgress 
                    variant="determinate" 
                    value={downloadProgress} 
                    sx={{ 
                      mt: 1.5, 
                      width: '100%',
                      borderRadius: 1, 
                      bgcolor: 'var(--glass-bg)',
                      '& .MuiLinearProgress-bar': { bgcolor: '#10b981' }
                    }} 
                  />
                )}
              </Box>
            </Box>

            {/* Slip Upload Card */}
            <Box sx={{
              borderRadius: '24px',
              bgcolor: 'var(--surface-2)',
              border: hasSlip ? '2px solid rgba(16,185,129,0.4)' : '1px solid var(--glass-border)',
              overflow: 'hidden',
              transition: 'all 0.3s ease',
            }}>
              {/* Card Header */}
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
                    background: hasSlip 
                      ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                      : 'linear-gradient(135deg, rgba(6,182,212,0.2) 0%, rgba(59,130,246,0.2) 100%)',
                    display: 'grid',
                    placeItems: 'center',
                  }}>
                    {hasSlip ? <Check size={20} style={{ color: 'white' }} /> : <Image size={20} style={{ color: '#67e8f9' }} />}
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'text.primary' }}>
                      {hasSlip ? 'แนบสลิปแล้ว' : 'แนบสลิปโอนเงิน'}
                    </Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                      {hasSlip ? 'พร้อมยืนยันการชำระ' : 'อัปโหลดหลักฐานการโอน'}
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{
                  px: 1.5,
                  py: 0.5,
                  borderRadius: '20px',
                  bgcolor: hasSlip ? 'rgba(16,185,129,0.15)' : 'rgba(6,182,212,0.1)',
                  border: `1px solid ${hasSlip ? 'rgba(16,185,129,0.3)' : 'rgba(6,182,212,0.2)'}`,
                }}>
                  <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: hasSlip ? '#6ee7b7' : '#67e8f9' }}>
                    ขั้นตอนที่ 2
                  </Typography>
                </Box>
              </Box>
              
              <Box sx={{ p: 2.5 }}>
                {!paymentEnabled ? (
                  /* Payment Disabled - Cannot Upload */
                  <Box sx={{
                    border: '2px dashed rgba(239,68,68,0.3)',
                    borderRadius: '16px',
                    p: 4,
                    textAlign: 'center',
                    bgcolor: 'rgba(239,68,68,0.05)',
                  }}>
                    <Box sx={{
                      width: 64,
                      height: 64,
                      borderRadius: '20px',
                      bgcolor: 'rgba(239,68,68,0.1)',
                      display: 'grid',
                      placeItems: 'center',
                      mx: 'auto',
                      mb: 2,
                    }}>
                      <AlertCircle size={28} style={{ color: '#f87171' }} />
                    </Box>
                    <Typography sx={{ color: '#fca5a5', fontWeight: 600, mb: 0.5, fontSize: '1rem' }}>
                      ระบบชำระเงินปิดอยู่
                    </Typography>
                    <Typography sx={{ color: '#fb7185', fontSize: '0.8rem' }}>
                      รอแอดมินเปิดระบบก่อนทำการชำระเงิน
                    </Typography>
                  </Box>
                ) : !previewUrl ? (
                  <Box
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                    onDragLeave={() => setDragActive(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragActive(false);
                      const droppedFile = e.dataTransfer.files?.[0];
                      if (droppedFile) processFile(droppedFile);
                    }}
                    sx={{
                      border: '2px dashed',
                      borderColor: dragActive ? '#06b6d4' : 'rgba(255,255,255,0.15)',
                      borderRadius: '16px',
                      p: 4,
                      textAlign: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      bgcolor: dragActive ? 'rgba(6,182,212,0.1)' : 'rgba(255,255,255,0.02)',
                      '&:hover': { 
                        borderColor: '#06b6d4', 
                        bgcolor: 'rgba(6,182,212,0.05)',
                        transform: 'scale(1.01)',
                      },
                    }}
                  >
                    <Box sx={{
                      width: 64,
                      height: 64,
                      borderRadius: '20px',
                      bgcolor: 'rgba(6,182,212,0.1)',
                      display: 'grid',
                      placeItems: 'center',
                      mx: 'auto',
                      mb: 2,
                    }}>
                      <Upload size={28} style={{ color: '#67e8f9' }} />
                    </Box>
                    <Typography sx={{ color: 'text.primary', fontWeight: 600, mb: 0.5, fontSize: '1rem' }}>
                      คลิกหรือลากไฟล์มาวาง
                    </Typography>
                    <Typography sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                      รูปสลิปที่คมชัด เห็นยอดและเวลา
                    </Typography>
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      gap: 0.5, 
                      mt: 1.5,
                      color: 'var(--text-muted)',
                      fontSize: '0.75rem',
                    }}>
                      <Smartphone size={14} />
                      <Typography sx={{ fontSize: 'inherit' }}>PNG, JPG ไม่เกิน 5MB</Typography>
                    </Box>
                  </Box>
                ) : (
                  <Box sx={{ position: 'relative' }}>
                    <Box sx={{
                      borderRadius: '16px',
                      overflow: 'hidden',
                      bgcolor: '#000',
                      position: 'relative',
                    }}>
                      <Box
                        component="img"
                        src={previewUrl}
                        alt="Slip Preview"
                        sx={{
                          width: '100%',
                          maxHeight: 280,
                          objectFit: 'contain',
                          display: 'block',
                        }}
                      />
                      {/* Success Overlay */}
                      <Box sx={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        py: 1.5,
                        px: 2,
                        background: 'linear-gradient(transparent, rgba(16,185,129,0.9))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 1,
                      }}>
                        <CheckCircle2 size={18} />
                        <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'white' }}>
                          พร้อมส่งตรวจสอบ
                        </Typography>
                      </Box>
                    </Box>
                    <Button
                      fullWidth
                      onClick={() => {
                        setSelectedFile(null);
                        setPreviewUrl(null);
                      }}
                      sx={{
                        mt: 1.5,
                        py: 1,
                        borderRadius: '10px',
                        bgcolor: 'rgba(245,158,11,0.1)',
                        color: '#fbbf24',
                        fontWeight: 600,
                        textTransform: 'none',
                        '&:hover': { bgcolor: 'rgba(245,158,11,0.2)' },
                      }}
                    >
                      เปลี่ยนสลิป
                    </Button>
                  </Box>
                )}
              </Box>

              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                onChange={(e) => e.target.files && processFile(e.target.files[0])}
                style={{ display: 'none' }}
              />
            </Box>

            {/* Tips - Compact */}
            <Box sx={{
              px: 2,
              py: 1.5,
              borderRadius: '14px',
              bgcolor: 'rgba(245,158,11,0.06)',
              border: '1px solid rgba(245,158,11,0.15)',
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
            }}>
              <Clock3 size={18} style={{ color: '#fbbf24', flexShrink: 0 }} />
              <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                อัปโหลดสลิปภายใน 15 นาที • ระบบตรวจอัตโนมัติ
              </Typography>
            </Box>
          </Box>
        )}
      </Box>

      {/* Bottom Submit Button */}
      <Box sx={{
        px: { xs: 2, sm: 3 },
        py: 2,
        borderTop: '1px solid var(--glass-border)',
        background: 'var(--glass-strong)',
        backdropFilter: 'blur(20px)',
        paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
      }}>
        <Box sx={{ maxWidth: 500, mx: 'auto' }}>
          {isPaid ? (
            /* Already Paid - Show Close Button */
            <Button
              fullWidth
              onClick={onClose}
              sx={{
                py: 2,
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                color: 'white',
                fontSize: '1.05rem',
                fontWeight: 700,
                textTransform: 'none',
                boxShadow: '0 8px 24px rgba(59,130,246,0.35)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                },
              }}
            >
              ปิดหน้าต่าง
            </Button>
          ) : !paymentEnabled ? (
            /* Payment Disabled - Show Disabled Button */
            <Button
              fullWidth
              disabled
              startIcon={<AlertCircle size={22} />}
              sx={{
                py: 2,
                borderRadius: '16px',
                background: 'rgba(239,68,68,0.15)',
                color: '#f87171',
                fontSize: '1.05rem',
                fontWeight: 700,
                textTransform: 'none',
                '&:disabled': {
                  background: 'rgba(239,68,68,0.15)',
                  color: '#f87171',
                },
              }}
            >
              ระบบชำระเงินปิดอยู่
            </Button>
          ) : (
            /* Normal Payment Button */
            <Button
              fullWidth
              onClick={handleConfirmPayment}
              disabled={verifying || loading || !selectedFile}
              startIcon={verifying ? <Loader2 size={22} className="animate-spin" /> : hasSlip ? <Check size={22} /> : <Upload size={22} />}
              sx={{
                py: 2,
                borderRadius: '16px',
                background: hasSlip && !verifying
                  ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                  : 'rgba(100,116,139,0.15)',
                color: hasSlip && !verifying ? 'white' : '#64748b',
                fontSize: '1.05rem',
                fontWeight: 700,
                textTransform: 'none',
                boxShadow: hasSlip && !verifying ? '0 8px 32px rgba(16,185,129,0.35)' : 'none',
                transition: 'all 0.3s ease',
                '&:hover': {
                  background: hasSlip && !verifying
                    ? 'linear-gradient(135deg, #059669 0%, #047857 100%)'
                    : 'rgba(100,116,139,0.2)',
                  transform: hasSlip && !verifying ? 'translateY(-2px)' : 'none',
                  boxShadow: hasSlip && !verifying ? '0 12px 40px rgba(16,185,129,0.4)' : 'none',
                },
                '&:disabled': {
                  background: verifying ? 'linear-gradient(135deg, #0891b2 0%, #06b6d4 100%)' : 'rgba(100,116,139,0.15)',
                  color: verifying ? 'white' : '#64748b',
                },
              }}
            >
              {verifying ? 'กำลังตรวจสอบสลิป...' : hasSlip ? 'ยืนยันการชำระเงิน' : 'แนบสลิปเพื่อชำระเงิน'}
            </Button>
          )}
          {!hasSlip && paymentEnabled && !isPaid && (
            <Typography sx={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', mt: 1.5 }}>
              กรุณาแนบสลิปก่อนกดยืนยัน
            </Typography>
          )}

          {/* Close Button */}
          <Button
            fullWidth
            onClick={onClose}
            startIcon={<X size={18} />}
            sx={{
              mt: 1.5,
              py: 1.2,
              borderRadius: '12px',
              bgcolor: 'rgba(100,116,139,0.15)',
              border: '1px solid rgba(100,116,139,0.3)',
              color: 'text.secondary',
              fontSize: '0.85rem',
              fontWeight: 600,
              textTransform: 'none',
              '&:hover': { bgcolor: 'rgba(100,116,139,0.25)' },
            }}
          >
            ปิด
          </Button>
        </Box>
      </Box>
    </Drawer>
  );
}
