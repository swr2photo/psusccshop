'use client';

import { useState, useEffect, useRef } from 'react';
import type { JSX } from 'react';
import { X, Upload, Check, Loader2, AlertCircle, CheckCircle2, Image, Clock3, Download, CreditCard, QrCode, Copy, Smartphone, ArrowRight, Sparkles } from 'lucide-react';
import { Drawer, Box, Typography, Button, IconButton, Skeleton, useMediaQuery, LinearProgress } from '@mui/material';

interface PaymentModalProps {
  orderRef: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message?: string;
}

const usePaymentToast = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const addToast = (type: Toast['type'], title: string, message?: string) => {
    const id = Date.now().toString();
    const newToast: Toast = { id, type, title, message };
    setToasts((prev) => [...prev, newToast]);
    setTimeout(() => removeToast(id), 3000);
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
  const bgColors = {
    success: '#10b981',
    error: '#ef4444',
    info: '#3b82f6',
    warning: '#f59e0b',
  } as const;

  const icons = {
    success: <CheckCircle2 size={18} />,
    error: <AlertCircle size={18} />,
    info: <AlertCircle size={18} />,
    warning: <AlertCircle size={18} />,
  };

  if (toasts.length === 0) return null;

  return (
    <Box
      sx={{
        position: 'absolute',
        top: 80,
        left: 0,
        right: 0,
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1,
        px: 2,
        pointerEvents: 'none',
      }}
    >
      {toasts.map((toast) => (
        <Box
          key={toast.id}
          sx={{
            bgcolor: bgColors[toast.type],
            color: 'white',
            p: 2,
            borderRadius: '12px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            maxWidth: 400,
            width: '100%',
            pointerEvents: 'auto',
            animation: 'slideIn 0.3s ease',
            '@keyframes slideIn': {
              from: { transform: 'translateY(-20px)', opacity: 0 },
              to: { transform: 'translateY(0)', opacity: 1 },
            },
          }}
        >
          <Box sx={{ flexShrink: 0 }}>{icons[toast.type]}</Box>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }}>{toast.title}</Typography>
            {toast.message && <Typography sx={{ fontSize: '0.75rem', opacity: 0.9 }}>{toast.message}</Typography>}
          </Box>
          <IconButton size="small" onClick={() => removeToast(toast.id)} sx={{ color: 'white', opacity: 0.7 }}>
            <X size={14} />
          </IconButton>
        </Box>
      ))}
    </Box>
  );
}

export default function PaymentModal({ orderRef, onClose, onSuccess }: PaymentModalProps): JSX.Element {
  const { toasts, addToast, removeToast } = usePaymentToast();
  const isMobile = useMediaQuery('(max-width: 640px)');
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [amount, setAmount] = useState(0);
  const [baseAmount, setBaseAmount] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

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
        setQrUrl(info.qrUrl || null);
        setAmount(Number(info.finalAmount ?? info.amount ?? 0));
        setBaseAmount(Number(info.baseAmount ?? info.amount ?? 0));
        setDiscount(Number(info.discount ?? 0));
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
          addToast('success', 'ชำระเงินสำเร็จ');
          setTimeout(() => {
            onSuccess();
            onClose();
          }, 1500);
        } else {
          addToast('error', 'ตรวจสอบไม่ผ่าน', data.message);
        }
      } catch (error) {
        addToast('error', 'เกิดข้อผิดพลาด');
      } finally {
        setVerifying(false);
      }
    };
  };

  const handleSaveQr = async () => {
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
          height: { xs: '95vh', sm: '90vh' },
          maxHeight: '95vh',
          borderTopLeftRadius: { xs: 24, sm: 28 },
          borderTopRightRadius: { xs: 24, sm: 28 },
          bgcolor: '#0a0f1a',
          overflow: 'hidden',
        },
      }}
    >
      <PaymentToastContainer toasts={toasts} removeToast={removeToast} />
      
      {/* Header */}
      <Box sx={{
        px: { xs: 2, sm: 3 },
        pt: 1.5,
        pb: 2,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'linear-gradient(180deg, rgba(15,23,42,0.98) 0%, rgba(10,15,26,0.98) 100%)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        {/* Drag Handle */}
        <Box sx={{ width: 40, height: 5, bgcolor: 'rgba(255,255,255,0.15)', borderRadius: 3, mx: 'auto', mb: 2 }} />
        
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{
              width: 48,
              height: 48,
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
              display: 'grid',
              placeItems: 'center',
              boxShadow: '0 8px 24px rgba(16,185,129,0.3)',
            }}>
              <CreditCard size={24} color="white" />
            </Box>
            <Box>
              <Typography sx={{ fontSize: '1.2rem', fontWeight: 800, color: '#f1f5f9' }}>
                ชำระเงิน
              </Typography>
              <Typography sx={{ fontSize: '0.8rem', color: '#64748b', fontFamily: 'monospace' }}>
                #{orderRef}
              </Typography>
            </Box>
          </Box>
          <IconButton 
            onClick={onClose} 
            sx={{ 
              color: '#94a3b8', 
              bgcolor: 'rgba(255,255,255,0.05)', 
              width: 40,
              height: 40,
              '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } 
            }}
          >
            <X size={20} />
          </IconButton>
        </Box>

        {/* Progress Steps - Simplified */}
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          gap: 1,
        }}>
          {steps.map((step, index) => (
            <Box key={step} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.8,
                px: 1.5,
                py: 0.6,
                borderRadius: '20px',
                bgcolor: activeStep >= index 
                  ? index === 2 && hasSlip ? 'rgba(16, 185, 129, 0.15)' : 'rgba(6, 182, 212, 0.15)'
                  : 'rgba(255,255,255,0.03)',
                border: `1px solid ${activeStep >= index 
                  ? index === 2 && hasSlip ? 'rgba(16, 185, 129, 0.3)' : 'rgba(6, 182, 212, 0.3)'
                  : 'transparent'}`,
                transition: 'all 0.3s ease',
              }}>
                <Box sx={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  bgcolor: activeStep >= index 
                    ? index === 2 && hasSlip ? '#10b981' : '#06b6d4'
                    : 'rgba(255,255,255,0.1)',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  color: activeStep >= index ? 'white' : '#64748b',
                }}>
                  {activeStep > index ? <Check size={12} /> : index + 1}
                </Box>
                <Typography sx={{ 
                  fontSize: '0.75rem', 
                  fontWeight: 600, 
                  color: activeStep >= index 
                    ? index === 2 && hasSlip ? '#6ee7b7' : '#67e8f9'
                    : '#64748b',
                }}>
                  {step}
                </Typography>
              </Box>
              {index < steps.length - 1 && (
                <ArrowRight size={14} style={{ color: '#475569' }} />
              )}
            </Box>
          ))}
        </Box>
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'auto', WebkitOverflowScrolling: 'touch', px: { xs: 2, sm: 3 }, py: 2.5 }}>
        {loading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, maxWidth: 500, mx: 'auto' }}>
            <Skeleton variant="rectangular" height={120} sx={{ bgcolor: 'rgba(30,41,59,0.5)', borderRadius: '20px' }} />
            <Skeleton variant="rectangular" height={300} sx={{ bgcolor: 'rgba(30,41,59,0.5)', borderRadius: '20px' }} />
            <Skeleton variant="rectangular" height={180} sx={{ bgcolor: 'rgba(30,41,59,0.5)', borderRadius: '20px' }} />
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
                bgcolor: 'rgba(255,255,255,0.1)',
              }} />
              <Box sx={{
                position: 'absolute',
                bottom: -20,
                left: -20,
                width: 60,
                height: 60,
                borderRadius: '50%',
                bgcolor: 'rgba(255,255,255,0.08)',
              }} />
              
              <Typography sx={{ fontSize: '0.85rem', opacity: 0.9, mb: 1, fontWeight: 500 }}>
                💳 ยอดที่ต้องชำระ
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5 }}>
                <Typography sx={{ fontSize: '3rem', fontWeight: 900, letterSpacing: '-2px' }}>
                  ฿{amount.toLocaleString()}
                </Typography>
                <IconButton 
                  onClick={copyAmount} 
                  sx={{ 
                    color: 'rgba(255,255,255,0.8)', 
                    bgcolor: 'rgba(255,255,255,0.15)',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' },
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
                  bgcolor: 'rgba(255,255,255,0.15)',
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

            {/* QR Code Card */}
            <Box sx={{
              borderRadius: '24px',
              bgcolor: 'rgba(30,41,59,0.4)',
              border: '1px solid rgba(255,255,255,0.06)',
              overflow: 'hidden',
            }}>
              {/* Card Header */}
              <Box sx={{ 
                px: 2.5, 
                py: 2, 
                borderBottom: '1px solid rgba(255,255,255,0.06)',
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
                    <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#e2e8f0' }}>
                      สแกนเพื่อโอนเงิน
                    </Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>
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
                {qrUrl ? (
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
                    <Loader2 size={32} style={{ color: '#64748b' }} className="animate-spin" />
                  </Box>
                )}

                <Button
                  fullWidth
                  startIcon={downloading ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                  onClick={handleSaveQr}
                  disabled={!qrUrl || downloading}
                  sx={{
                    py: 1.3,
                    borderRadius: '12px',
                    bgcolor: 'rgba(16,185,129,0.1)',
                    border: '1px solid rgba(16,185,129,0.3)',
                    color: '#6ee7b7',
                    fontWeight: 600,
                    textTransform: 'none',
                    '&:hover': { bgcolor: 'rgba(16,185,129,0.2)' },
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
                      bgcolor: 'rgba(255,255,255,0.1)',
                      '& .MuiLinearProgress-bar': { bgcolor: '#10b981' }
                    }} 
                  />
                )}
              </Box>
            </Box>

            {/* Slip Upload Card */}
            <Box sx={{
              borderRadius: '24px',
              bgcolor: 'rgba(30,41,59,0.4)',
              border: hasSlip ? '2px solid rgba(16,185,129,0.4)' : '1px solid rgba(255,255,255,0.06)',
              overflow: 'hidden',
              transition: 'all 0.3s ease',
            }}>
              {/* Card Header */}
              <Box sx={{ 
                px: 2.5, 
                py: 2, 
                borderBottom: '1px solid rgba(255,255,255,0.06)',
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
                    <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#e2e8f0' }}>
                      {hasSlip ? 'แนบสลิปแล้ว' : 'แนบสลิปโอนเงิน'}
                    </Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>
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
                {!previewUrl ? (
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
                    <Typography sx={{ color: '#e2e8f0', fontWeight: 600, mb: 0.5, fontSize: '1rem' }}>
                      คลิกหรือลากไฟล์มาวาง
                    </Typography>
                    <Typography sx={{ color: '#64748b', fontSize: '0.8rem' }}>
                      รูปสลิปที่คมชัด เห็นยอดและเวลา
                    </Typography>
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      gap: 0.5, 
                      mt: 1.5,
                      color: '#475569',
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
              <Typography sx={{ fontSize: '0.8rem', color: '#94a3b8' }}>
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
        borderTop: '1px solid rgba(255,255,255,0.08)',
        background: 'linear-gradient(180deg, rgba(15,23,42,0.98) 0%, rgba(10,15,26,0.98) 100%)',
        backdropFilter: 'blur(20px)',
        paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
      }}>
        <Box sx={{ maxWidth: 500, mx: 'auto' }}>
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
            {verifying ? 'กำลังตรวจสอบสลิป...' : hasSlip ? '✓ ยืนยันการชำระเงิน' : 'แนบสลิปเพื่อชำระเงิน'}
          </Button>
          {!hasSlip && (
            <Typography sx={{ textAlign: 'center', fontSize: '0.75rem', color: '#475569', mt: 1.5 }}>
              กรุณาแนบสลิปก่อนกดยืนยัน
            </Typography>
          )}
        </Box>
      </Box>
    </Drawer>
  );
}
