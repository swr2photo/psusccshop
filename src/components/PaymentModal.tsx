'use client';

import { useState, useEffect, useRef } from 'react';
import type { JSX } from 'react';
import { X, Upload, Check, Loader2, AlertCircle, CheckCircle2, Image, Clock3, Download, CreditCard, QrCode } from 'lucide-react';
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

  const hasSlip = Boolean(selectedFile);
  const discountValue = Math.abs(discount);

  useEffect(() => {
    fetchPaymentInfo();
  }, [orderRef]);

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

  return (
    <Drawer
      anchor="bottom"
      open={true}
      onClose={onClose}
      PaperProps={{
        sx: {
          height: { xs: '95vh', sm: '90vh' },
          maxHeight: '95vh',
          borderTopLeftRadius: { xs: 20, sm: 24 },
          borderTopRightRadius: { xs: 20, sm: 24 },
          bgcolor: '#0a0f1a',
          overflow: 'hidden',
        },
      }}
    >
      <PaymentToastContainer toasts={toasts} removeToast={removeToast} />
      
      {/* Header */}
      <Box sx={{
        px: { xs: 2, sm: 3 },
        py: { xs: 1.5, sm: 2 },
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'linear-gradient(180deg, rgba(15,23,42,0.98) 0%, rgba(10,15,26,0.98) 100%)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        {/* Drag Handle */}
        <Box sx={{ width: 36, height: 4, bgcolor: 'rgba(255,255,255,0.2)', borderRadius: 2, mx: 'auto', mb: 2 }} />
        
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{
              width: 44,
              height: 44,
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
              display: 'grid',
              placeItems: 'center',
              boxShadow: '0 4px 14px rgba(16,185,129,0.3)',
            }}>
              <CreditCard size={22} color="white" />
            </Box>
            <Box>
              <Typography sx={{ fontSize: '1.15rem', fontWeight: 800, color: '#f1f5f9' }}>
                ชำระเงิน
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>
                #{orderRef}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{
              px: 1.5,
              py: 0.5,
              borderRadius: '20px',
              bgcolor: verifying ? 'rgba(6,182,212,0.15)' : hasSlip ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
              border: `1px solid ${verifying ? 'rgba(6,182,212,0.4)' : hasSlip ? 'rgba(16,185,129,0.4)' : 'rgba(245,158,11,0.4)'}`,
            }}>
              <Typography sx={{ 
                fontSize: '0.7rem', 
                fontWeight: 600, 
                color: verifying ? '#67e8f9' : hasSlip ? '#6ee7b7' : '#fbbf24' 
              }}>
                {verifying ? 'กำลังตรวจสอบ' : hasSlip ? 'พร้อมยืนยัน' : 'รอแนบสลิป'}
              </Typography>
            </Box>
            <IconButton onClick={onClose} sx={{ color: '#94a3b8', bgcolor: 'rgba(255,255,255,0.05)', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}>
              <X size={20} />
            </IconButton>
          </Box>
        </Box>
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'auto', WebkitOverflowScrolling: 'touch', px: { xs: 2, sm: 3 }, py: 2 }}>
        {loading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Skeleton variant="rectangular" height={260} sx={{ bgcolor: 'rgba(30,41,59,0.5)', borderRadius: '16px' }} />
            <Skeleton variant="rectangular" height={140} sx={{ bgcolor: 'rgba(30,41,59,0.5)', borderRadius: '16px' }} />
            <Skeleton variant="rectangular" height={200} sx={{ bgcolor: 'rgba(30,41,59,0.5)', borderRadius: '16px' }} />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, maxWidth: 600, mx: 'auto' }}>
            {/* Amount Summary */}
            <Box sx={{
              p: 2.5,
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
              color: 'white',
              textAlign: 'center',
            }}>
              <Typography sx={{ fontSize: '0.8rem', opacity: 0.9, mb: 0.5 }}>ยอดที่ต้องชำระ</Typography>
              <Typography sx={{ fontSize: '2.5rem', fontWeight: 900 }}>฿{amount.toLocaleString()}</Typography>
              {discountValue > 0 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 1, fontSize: '0.8rem' }}>
                  <Typography sx={{ opacity: 0.8 }}>ค่าสินค้า ฿{baseAmount.toLocaleString()}</Typography>
                  <Typography sx={{ color: '#a7f3d0' }}>ส่วนลด -฿{discountValue.toLocaleString()}</Typography>
                </Box>
              )}
            </Box>

            {/* QR Code Section */}
            <Box sx={{
              p: 2,
              borderRadius: '16px',
              bgcolor: 'rgba(30,41,59,0.5)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                <Box sx={{
                  width: 36,
                  height: 36,
                  borderRadius: '10px',
                  bgcolor: 'rgba(16,185,129,0.15)',
                  display: 'grid',
                  placeItems: 'center',
                }}>
                  <QrCode size={18} style={{ color: '#6ee7b7' }} />
                </Box>
                <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: '#e2e8f0' }}>
                  QR Code สำหรับโอนเงิน
                </Typography>
              </Box>
              
              {qrUrl ? (
                <Box sx={{ 
                  bgcolor: 'white', 
                  borderRadius: '12px', 
                  p: 2, 
                  display: 'flex', 
                  justifyContent: 'center',
                  mb: 2,
                }}>
                  <Box
                    component="img"
                    src={qrUrl}
                    alt="QR Code"
                    sx={{ maxWidth: '100%', maxHeight: 280, objectFit: 'contain' }}
                  />
                </Box>
              ) : (
                <Box sx={{ 
                  bgcolor: 'rgba(100,116,139,0.1)', 
                  borderRadius: '12px', 
                  p: 4, 
                  textAlign: 'center',
                  mb: 2,
                }}>
                  <Typography sx={{ color: '#64748b' }}>กำลังสร้าง QR...</Typography>
                </Box>
              )}

              <Button
                fullWidth
                startIcon={downloading ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                onClick={handleSaveQr}
                disabled={!qrUrl || downloading}
                sx={{
                  py: 1.2,
                  borderRadius: '10px',
                  bgcolor: 'rgba(16,185,129,0.1)',
                  border: '1px solid rgba(16,185,129,0.3)',
                  color: '#6ee7b7',
                  fontWeight: 600,
                  textTransform: 'none',
                  '&:hover': { bgcolor: 'rgba(16,185,129,0.2)' },
                  '&:disabled': { opacity: 0.5 },
                }}
              >
                {downloading ? `บันทึก... ${downloadProgress}%` : 'บันทึก QR Code'}
              </Button>
              {downloading && (
                <LinearProgress 
                  variant="determinate" 
                  value={downloadProgress} 
                  sx={{ 
                    mt: 1, 
                    borderRadius: 1, 
                    bgcolor: 'rgba(255,255,255,0.1)',
                    '& .MuiLinearProgress-bar': { bgcolor: '#10b981' }
                  }} 
                />
              )}
            </Box>

            {/* Slip Upload Section */}
            <Box sx={{
              p: 2,
              borderRadius: '16px',
              bgcolor: 'rgba(30,41,59,0.5)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{
                    width: 36,
                    height: 36,
                    borderRadius: '10px',
                    bgcolor: 'rgba(6,182,212,0.15)',
                    display: 'grid',
                    placeItems: 'center',
                  }}>
                    <Image size={18} style={{ color: '#67e8f9' }} />
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: '#e2e8f0' }}>
                      แนบสลิปโอนเงิน
                    </Typography>
                    <Typography sx={{ fontSize: '0.7rem', color: '#64748b' }}>
                      รองรับ PNG, JPG สูงสุด 5MB
                    </Typography>
                  </Box>
                </Box>
                {hasSlip && (
                  <Button
                    size="small"
                    onClick={() => { setPreviewUrl(null); setSelectedFile(null); }}
                    sx={{ 
                      color: '#fbbf24', 
                      fontSize: '0.75rem',
                      textTransform: 'none',
                    }}
                  >
                    ลบ
                  </Button>
                )}
              </Box>

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
                    borderRadius: '12px',
                    p: 4,
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    bgcolor: dragActive ? 'rgba(6,182,212,0.1)' : 'transparent',
                    '&:hover': { borderColor: '#06b6d4', bgcolor: 'rgba(6,182,212,0.05)' },
                  }}
                >
                  <Upload size={32} style={{ color: '#64748b', margin: '0 auto 8px' }} />
                  <Typography sx={{ color: '#94a3b8', fontWeight: 600, mb: 0.5 }}>
                    ลากไฟล์หรือคลิกเพื่อเลือก
                  </Typography>
                  <Typography sx={{ color: '#64748b', fontSize: '0.8rem' }}>
                    ควรเป็นสลิปที่คมชัด เห็นยอดและเวลา
                  </Typography>
                </Box>
              ) : (
                <Box>
                  <Box sx={{ 
                    position: 'relative', 
                    borderRadius: '12px', 
                    overflow: 'hidden',
                    border: '1px solid rgba(16,185,129,0.3)',
                    mb: 1.5,
                  }}>
                    <Box
                      component="img"
                      src={previewUrl}
                      alt="Preview"
                      sx={{ width: '100%', maxHeight: 300, objectFit: 'contain', bgcolor: 'rgba(0,0,0,0.2)' }}
                    />
                    <Box sx={{
                      position: 'absolute',
                      bottom: 8,
                      right: 8,
                      bgcolor: 'rgba(16,185,129,0.9)',
                      borderRadius: '50%',
                      p: 0.5,
                    }}>
                      <CheckCircle2 size={20} color="white" />
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography sx={{ fontSize: '0.8rem', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
                      {selectedFile?.name}
                    </Typography>
                    <Button
                      size="small"
                      onClick={() => fileInputRef.current?.click()}
                      sx={{ color: '#67e8f9', fontSize: '0.75rem', textTransform: 'none' }}
                    >
                      เปลี่ยนรูป
                    </Button>
                  </Box>
                </Box>
              )}

              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                onChange={(e) => e.target.files && processFile(e.target.files[0])}
                style={{ display: 'none' }}
              />
            </Box>

            {/* Tips */}
            <Box sx={{
              p: 2,
              borderRadius: '12px',
              bgcolor: 'rgba(245,158,11,0.08)',
              border: '1px solid rgba(245,158,11,0.2)',
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Clock3 size={16} style={{ color: '#fbbf24' }} />
                <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: '#fbbf24' }}>
                  คำแนะนำ
                </Typography>
              </Box>
              <Typography sx={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.6 }}>
                • อัปโหลดสลิปภายใน 15 นาทีหลังสั่งซื้อ<br/>
                • ระบบจะตรวจสอบอัตโนมัติทันที<br/>
                • หากสลิปถูกปฏิเสธ สามารถแนบใหม่ได้
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
        <Box sx={{ maxWidth: 600, mx: 'auto' }}>
          <Button
            fullWidth
            onClick={handleConfirmPayment}
            disabled={verifying || loading || !selectedFile}
            startIcon={verifying ? <Loader2 size={20} className="animate-spin" /> : hasSlip ? <Check size={20} /> : <AlertCircle size={20} />}
            sx={{
              py: 1.8,
              borderRadius: '14px',
              background: hasSlip && !verifying
                ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                : 'rgba(100,116,139,0.2)',
              color: hasSlip && !verifying ? 'white' : '#64748b',
              fontSize: '1rem',
              fontWeight: 700,
              textTransform: 'none',
              boxShadow: hasSlip && !verifying ? '0 4px 20px rgba(16,185,129,0.3)' : 'none',
              '&:hover': {
                background: hasSlip && !verifying
                  ? 'linear-gradient(135deg, #059669 0%, #047857 100%)'
                  : 'rgba(100,116,139,0.3)',
              },
              '&:disabled': {
                background: verifying ? 'linear-gradient(135deg, #0891b2 0%, #06b6d4 100%)' : 'rgba(100,116,139,0.2)',
                color: verifying ? 'white' : '#64748b',
              },
            }}
          >
            {verifying ? 'กำลังตรวจสอบ...' : hasSlip ? 'ยืนยันการโอนเงิน' : 'กรุณาแนบสลิป'}
          </Button>
          <Typography sx={{ textAlign: 'center', fontSize: '0.75rem', color: '#64748b', mt: 1.5 }}>
            ระบบตรวจสอบอัตโนมัติ โปรดรออยู่ในหน้านี้
          </Typography>
        </Box>
      </Box>
    </Drawer>
  );
}
