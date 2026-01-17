'use client';

import { useState, useEffect } from 'react';
import { X, ShieldCheck, User, Phone, Instagram, AlertTriangle, MapPin, Check, Sparkles, UserCircle, CheckCircle2, AlertCircle } from 'lucide-react';
import { Drawer, Box, Typography, Button, IconButton, TextField, InputAdornment, Checkbox, FormControlLabel, useMediaQuery, Slide } from '@mui/material';

interface ProfileModalProps {
  initialData: { name: string; phone: string; address: string; instagram: string };
  onClose: () => void;
  onSave: (data: any) => void;
}

// ============== INLINE NOTIFICATION ==============

interface InlineNotification {
  type: 'success' | 'error' | 'warning';
  message: string;
}

const NOTIFICATION_STYLES = {
  success: {
    bg: 'linear-gradient(135deg, rgba(16, 185, 129, 0.95) 0%, rgba(5, 150, 105, 0.95) 100%)',
    icon: <CheckCircle2 size={16} />,
  },
  error: {
    bg: 'linear-gradient(135deg, rgba(239, 68, 68, 0.95) 0%, rgba(220, 38, 38, 0.95) 100%)',
    icon: <AlertCircle size={16} />,
  },
  warning: {
    bg: 'linear-gradient(135deg, rgba(245, 158, 11, 0.95) 0%, rgba(234, 88, 12, 0.95) 100%)',
    icon: <AlertTriangle size={16} />,
  },
};

export default function ProfileModal({ initialData, onClose, onSave }: ProfileModalProps) {
  const isMobile = useMediaQuery('(max-width: 640px)');
  const [formData, setFormData] = useState(initialData);
  const [pdpaAccepted, setPdpaAccepted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notification, setNotification] = useState<InlineNotification | null>(null);

  useEffect(() => {
    if (initialData.name && initialData.phone && initialData.instagram) {
      setPdpaAccepted(true);
    }
  }, [initialData]);

  // Auto-hide notification
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const showNotification = (type: InlineNotification['type'], message: string) => {
    setNotification({ type, message });
  };

  const sanitizeThai = (value: string) => value.replace(/[^\u0E00-\u0E7F\s]/g, '').trimStart();
  const sanitizePhone = (value: string) => value.replace(/\D/g, '').slice(0, 12);

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!formData.name || !/^[\u0E00-\u0E7F\s]+$/.test(formData.name.trim())) {
      nextErrors.name = 'กรอกชื่อ-นามสกุลภาษาไทย';
    }
    if (!formData.phone || formData.phone.length < 9) {
      nextErrors.phone = 'กรอกเบอร์โทรให้ถูกต้อง';
    }
    if (!formData.instagram.trim()) {
      nextErrors.instagram = 'กรอก Instagram (จำเป็น)';
    }
    if (!pdpaAccepted) {
      nextErrors.pdpa = 'กรุณายืนยันการใช้ข้อมูล';
    }
    setErrors(nextErrors);
    
    // Show notification for first error
    if (Object.keys(nextErrors).length > 0) {
      const firstError = Object.values(nextErrors)[0];
      showNotification('warning', firstError);
    }
    
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    onSave(formData);
  };

  const isFormValid = formData.name && formData.phone && formData.instagram && pdpaAccepted;

  const inputSx = {
    '& .MuiOutlinedInput-root': {
      bgcolor: 'rgba(30,41,59,0.4)',
      borderRadius: '14px',
      color: '#f1f5f9',
      fontSize: '1rem',
      transition: 'all 0.2s ease',
      '& fieldset': { borderColor: 'rgba(255,255,255,0.08)', borderWidth: '1px' },
      '&:hover fieldset': { borderColor: 'rgba(139,92,246,0.4)' },
      '&.Mui-focused fieldset': { borderColor: '#8b5cf6', borderWidth: '2px' },
      '&.Mui-focused': { bgcolor: 'rgba(30,41,59,0.6)' },
    },
    '& .MuiInputLabel-root': { color: '#64748b', fontSize: '0.9rem' },
    '& .MuiInputLabel-root.Mui-focused': { color: '#a78bfa' },
    '& .MuiInputAdornment-root': { color: '#64748b' },
    '& .MuiFormHelperText-root': { color: '#f87171', fontSize: '0.75rem', mt: 0.5 },
  };

  return (
    <Drawer
      anchor="bottom"
      open={true}
      onClose={onClose}
      PaperProps={{
        sx: {
          height: { xs: '92vh', sm: '85vh' },
          maxHeight: '92vh',
          borderTopLeftRadius: { xs: 24, sm: 28 },
          borderTopRightRadius: { xs: 24, sm: 28 },
          bgcolor: '#0a0f1a',
          overflow: 'hidden',
        },
      }}
    >
      {/* Inline Notification Toast - Bottom */}
      {notification && (
        <Box
          sx={{
            position: 'absolute',
            bottom: { xs: 160, sm: 130 },
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 100,
            width: 'calc(100% - 32px)',
            maxWidth: 380,
          }}
        >
          <Slide direction="up" in={true} mountOnEnter unmountOnExit>
            <Box
              sx={{
                background: NOTIFICATION_STYLES[notification.type].bg,
                backdropFilter: 'blur(16px)',
                color: 'white',
                py: 1.5,
                px: 2,
                borderRadius: '14px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                animation: 'notificationSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
                '@keyframes notificationSlideUp': {
                  '0%': { opacity: 0, transform: 'translateY(12px) scale(0.96)' },
                  '100%': { opacity: 1, transform: 'translateY(0) scale(1)' },
                },
              }}
            >
              <Box
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: '8px',
                  bgcolor: 'rgba(255, 255, 255, 0.2)',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                {NOTIFICATION_STYLES[notification.type].icon}
              </Box>
              <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', flex: 1 }}>
                {notification.message}
              </Typography>
            </Box>
          </Slide>
        </Box>
      )}

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
        
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{
              width: 48,
              height: 48,
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
              display: 'grid',
              placeItems: 'center',
              boxShadow: '0 8px 24px rgba(139,92,246,0.3)',
            }}>
              <UserCircle size={24} color="white" />
            </Box>
            <Box>
              <Typography sx={{ fontSize: '1.2rem', fontWeight: 800, color: '#f1f5f9' }}>
                ข้อมูลผู้ติดต่อ
              </Typography>
              <Typography sx={{ fontSize: '0.8rem', color: '#64748b' }}>
                กรอกข้อมูลเพื่อดำเนินการสั่งซื้อ
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Content */}
      <Box 
        component="form" 
        onSubmit={handleSubmit}
        sx={{ 
          flex: 1, 
          overflow: 'auto', 
          WebkitOverflowScrolling: 'touch',
          px: { xs: 2, sm: 3 },
          py: 2.5,
        }}
      >
        <Box sx={{ maxWidth: 480, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          
          {/* Name Card */}
          <Box sx={{
            p: 2.5,
            borderRadius: '20px',
            bgcolor: 'rgba(30,41,59,0.4)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <Box sx={{
                width: 36,
                height: 36,
                borderRadius: '10px',
                background: 'linear-gradient(135deg, rgba(139,92,246,0.2) 0%, rgba(99,102,241,0.2) 100%)',
                display: 'grid',
                placeItems: 'center',
              }}>
                <User size={18} style={{ color: '#a78bfa' }} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: '#e2e8f0' }}>
                  ชื่อ-นามสกุล
                </Typography>
                <Typography sx={{ fontSize: '0.7rem', color: '#64748b' }}>
                  กรุณากรอกเป็นภาษาไทย
                </Typography>
              </Box>
              <Box sx={{ 
                ml: 'auto', 
                px: 1, 
                py: 0.3, 
                borderRadius: '6px', 
                bgcolor: 'rgba(239,68,68,0.15)', 
                border: '1px solid rgba(239,68,68,0.2)' 
              }}>
                <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: '#f87171' }}>จำเป็น</Typography>
              </Box>
            </Box>
            <TextField
              fullWidth
              placeholder="เช่น สมชาย ใจดี"
              value={formData.name}
              onChange={e => setFormData({...formData, name: sanitizeThai(e.target.value)})}
              error={!!errors.name}
              helperText={errors.name}
              sx={inputSx}
            />
          </Box>

          {/* Contact Card */}
          <Box sx={{
            p: 2.5,
            borderRadius: '20px',
            bgcolor: 'rgba(30,41,59,0.4)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <Box sx={{
                width: 36,
                height: 36,
                borderRadius: '10px',
                background: 'linear-gradient(135deg, rgba(16,185,129,0.2) 0%, rgba(6,182,212,0.2) 100%)',
                display: 'grid',
                placeItems: 'center',
              }}>
                <Phone size={18} style={{ color: '#6ee7b7' }} />
              </Box>
              <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: '#e2e8f0' }}>
                ข้อมูลติดต่อ
              </Typography>
            </Box>
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                fullWidth
                placeholder="เบอร์โทรศัพท์ เช่น 0812345678"
                value={formData.phone}
                onChange={e => setFormData({...formData, phone: sanitizePhone(e.target.value)})}
                error={!!errors.phone}
                helperText={errors.phone}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Phone size={16} style={{ color: '#6ee7b7' }} />
                    </InputAdornment>
                  ),
                }}
                sx={inputSx}
              />
              <TextField
                fullWidth
                placeholder="Instagram เช่น @username"
                value={formData.instagram}
                onChange={e => setFormData({...formData, instagram: e.target.value.trimStart()})}
                error={!!errors.instagram}
                helperText={errors.instagram}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Instagram size={16} style={{ color: '#ec4899' }} />
                    </InputAdornment>
                  ),
                }}
                sx={inputSx}
              />
            </Box>
          </Box>

          {/* Address Card */}
          <Box sx={{
            p: 2.5,
            borderRadius: '20px',
            bgcolor: 'rgba(30,41,59,0.4)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <Box sx={{
                width: 36,
                height: 36,
                borderRadius: '10px',
                background: 'linear-gradient(135deg, rgba(245,158,11,0.2) 0%, rgba(234,88,12,0.2) 100%)',
                display: 'grid',
                placeItems: 'center',
              }}>
                <MapPin size={18} style={{ color: '#fbbf24' }} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: '#e2e8f0' }}>
                  ที่อยู่จัดส่ง
                </Typography>
                <Typography sx={{ fontSize: '0.7rem', color: '#64748b' }}>
                  ไม่บังคับ - กรอกเมื่อต้องการจัดส่ง
                </Typography>
              </Box>
            </Box>
            <TextField
              fullWidth
              multiline
              rows={3}
              placeholder="บ้านเลขที่ หมู่บ้าน ซอย ถนน ตำบล อำเภอ จังหวัด รหัสไปรษณีย์"
              value={formData.address}
              onChange={e => setFormData({...formData, address: e.target.value})}
              sx={inputSx}
            />
          </Box>

          {/* PDPA Card */}
          <Box sx={{
            p: 2.5,
            borderRadius: '20px',
            background: pdpaAccepted 
              ? 'linear-gradient(135deg, rgba(16,185,129,0.1) 0%, rgba(6,182,212,0.1) 100%)'
              : 'rgba(30,41,59,0.4)',
            border: pdpaAccepted 
              ? '2px solid rgba(16,185,129,0.3)' 
              : '1px solid rgba(255,255,255,0.06)',
            transition: 'all 0.3s ease',
          }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 2 }}>
              <Box sx={{
                width: 40,
                height: 40,
                borderRadius: '12px',
                background: pdpaAccepted
                  ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                  : 'rgba(139,92,246,0.15)',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
                transition: 'all 0.3s ease',
              }}>
                {pdpaAccepted 
                  ? <Check size={20} style={{ color: 'white' }} />
                  : <ShieldCheck size={20} style={{ color: '#a78bfa' }} />
                }
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: pdpaAccepted ? '#6ee7b7' : '#e2e8f0', mb: 0.5 }}>
                  {pdpaAccepted ? '✓ ยินยอมแล้ว' : 'นโยบายความเป็นส่วนตัว'}
                </Typography>
                <Typography sx={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.6 }}>
                  ข้อมูลของท่านจะถูกใช้เพื่อการจัดส่งและติดต่อเท่านั้น ไม่เปิดเผยต่อบุคคลภายนอก
                </Typography>
              </Box>
            </Box>
            
            <Box 
              onClick={() => setPdpaAccepted(!pdpaAccepted)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                p: 1.5,
                borderRadius: '12px',
                bgcolor: pdpaAccepted ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.03)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                '&:hover': { bgcolor: pdpaAccepted ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.06)' },
              }}
            >
              <Box sx={{
                width: 24,
                height: 24,
                borderRadius: '8px',
                bgcolor: pdpaAccepted ? '#10b981' : 'rgba(255,255,255,0.1)',
                border: pdpaAccepted ? 'none' : '2px solid rgba(255,255,255,0.2)',
                display: 'grid',
                placeItems: 'center',
                transition: 'all 0.2s ease',
              }}>
                {pdpaAccepted && <Check size={14} style={{ color: 'white' }} />}
              </Box>
              <Typography sx={{ fontSize: '0.9rem', color: pdpaAccepted ? '#6ee7b7' : '#e2e8f0', fontWeight: 600 }}>
                ยินยอมให้ใช้ข้อมูลตามนโยบาย
              </Typography>
            </Box>

            {errors.pdpa && (
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 1, 
                mt: 2, 
                p: 1.5, 
                borderRadius: '10px',
                bgcolor: 'rgba(245,158,11,0.1)',
                border: '1px solid rgba(245,158,11,0.2)',
              }}>
                <AlertTriangle size={16} style={{ color: '#fbbf24' }} />
                <Typography sx={{ fontSize: '0.8rem', color: '#fbbf24' }}>{errors.pdpa}</Typography>
              </Box>
            )}
          </Box>
        </Box>
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
        <Box sx={{ maxWidth: 480, mx: 'auto' }}>
          <Button
            fullWidth
            type="submit"
            onClick={handleSubmit}
            disabled={!pdpaAccepted}
            startIcon={isFormValid ? <Sparkles size={20} /> : <Check size={20} />}
            sx={{
              py: 2,
              borderRadius: '16px',
              background: isFormValid 
                ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                : pdpaAccepted
                  ? 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)'
                  : 'rgba(100,116,139,0.15)',
              color: pdpaAccepted ? 'white' : '#64748b',
              fontSize: '1.05rem',
              fontWeight: 700,
              textTransform: 'none',
              boxShadow: isFormValid ? '0 8px 32px rgba(16,185,129,0.35)' : 'none',
              transition: 'all 0.3s ease',
              '&:hover': {
                background: isFormValid 
                  ? 'linear-gradient(135deg, #059669 0%, #047857 100%)'
                  : pdpaAccepted
                    ? 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)'
                    : 'rgba(100,116,139,0.2)',
                transform: isFormValid ? 'translateY(-2px)' : 'none',
                boxShadow: isFormValid ? '0 12px 40px rgba(16,185,129,0.4)' : 'none',
              },
              '&:disabled': {
                background: 'rgba(100,116,139,0.15)',
                color: '#64748b',
              },
            }}
          >
            {isFormValid ? '✓ บันทึกและดำเนินการต่อ' : 'กรอกข้อมูลให้ครบถ้วน'}
          </Button>
          {!pdpaAccepted && (
            <Typography sx={{ textAlign: 'center', fontSize: '0.75rem', color: '#475569', mt: 1.5 }}>
              กรุณายินยอมนโยบายความเป็นส่วนตัวก่อนดำเนินการ
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
              color: '#94a3b8',
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
