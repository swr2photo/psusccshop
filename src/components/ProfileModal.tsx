'use client';

import { useState, useEffect } from 'react';
import { X, ShieldCheck, User, Phone, Instagram, AlertTriangle, MapPin, Check } from 'lucide-react';
import { Drawer, Box, Typography, Button, IconButton, TextField, InputAdornment, Checkbox, FormControlLabel, useMediaQuery } from '@mui/material';

interface ProfileModalProps {
  initialData: { name: string; phone: string; address: string; instagram: string };
  onClose: () => void;
  onSave: (data: any) => void;
}

export default function ProfileModal({ initialData, onClose, onSave }: ProfileModalProps) {
  const isMobile = useMediaQuery('(max-width: 640px)');
  const [formData, setFormData] = useState(initialData);
  const [pdpaAccepted, setPdpaAccepted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialData.name && initialData.phone && initialData.instagram) {
      setPdpaAccepted(true);
    }
  }, [initialData]);

  const sanitizeThai = (value: string) => value.replace(/[^\u0E00-\u0E7F\s]/g, '').trimStart();
  const sanitizePhone = (value: string) => value.replace(/\D/g, '').slice(0, 12);

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!formData.name || !/^[\u0E00-\u0E7F\s]+$/.test(formData.name.trim())) nextErrors.name = 'กรอกชื่อ-นามสกุลภาษาไทย';
    if (!formData.phone || formData.phone.length < 9) nextErrors.phone = 'กรอกเบอร์โทรให้ถูกต้อง';
    if (!formData.instagram.trim()) nextErrors.instagram = 'กรอก Instagram (จำเป็น)';
    if (!pdpaAccepted) nextErrors.pdpa = 'กรุณายืนยันการใช้ข้อมูล';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    onSave(formData);
  };

  const inputSx = {
    '& .MuiOutlinedInput-root': {
      bgcolor: 'rgba(30,41,59,0.5)',
      borderRadius: '12px',
      color: '#f1f5f9',
      '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
      '&:hover fieldset': { borderColor: 'rgba(99,102,241,0.5)' },
      '&.Mui-focused fieldset': { borderColor: '#6366f1' },
    },
    '& .MuiInputLabel-root': { color: '#94a3b8' },
    '& .MuiInputLabel-root.Mui-focused': { color: '#a5b4fc' },
    '& .MuiInputAdornment-root': { color: '#64748b' },
  };

  return (
    <Drawer
      anchor="bottom"
      open={true}
      onClose={onClose}
      PaperProps={{
        sx: {
          height: { xs: '90vh', sm: '80vh' },
          maxHeight: '90vh',
          borderTopLeftRadius: { xs: 20, sm: 24 },
          borderTopRightRadius: { xs: 20, sm: 24 },
          bgcolor: '#0a0f1a',
          overflow: 'hidden',
        },
      }}
    >
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
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              display: 'grid',
              placeItems: 'center',
              boxShadow: '0 4px 14px rgba(99,102,241,0.3)',
            }}>
              <User size={22} color="white" />
            </Box>
            <Box>
              <Typography sx={{ fontSize: '1.15rem', fontWeight: 800, color: '#f1f5f9' }}>
                ข้อมูลผู้ติดต่อ
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>
                กรอกข้อมูลสำหรับการติดต่อและจัดส่ง
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={onClose} sx={{ color: '#94a3b8', bgcolor: 'rgba(255,255,255,0.05)', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}>
            <X size={20} />
          </IconButton>
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
          py: 3,
        }}
      >
        <Box sx={{ maxWidth: 500, mx: 'auto' }}>
          {/* Name Field */}
          <Box sx={{ mb: 2.5 }}>
            <TextField
              fullWidth
              required
              label="ชื่อ-นามสกุล (ภาษาไทย)"
              placeholder="เช่น สมชาย ใจดี"
              value={formData.name}
              onChange={e => setFormData({...formData, name: sanitizeThai(e.target.value)})}
              error={!!errors.name}
              helperText={errors.name}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <User size={18} />
                  </InputAdornment>
                ),
              }}
              sx={inputSx}
            />
          </Box>

          {/* Phone & Instagram */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mb: 2.5 }}>
            <TextField
              fullWidth
              required
              label="เบอร์โทรศัพท์"
              placeholder="0812345678"
              value={formData.phone}
              onChange={e => setFormData({...formData, phone: sanitizePhone(e.target.value)})}
              error={!!errors.phone}
              helperText={errors.phone}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Phone size={18} />
                  </InputAdornment>
                ),
              }}
              sx={inputSx}
            />
            <TextField
              fullWidth
              required
              label="Instagram"
              placeholder="@username"
              value={formData.instagram}
              onChange={e => setFormData({...formData, instagram: e.target.value.trimStart()})}
              error={!!errors.instagram}
              helperText={errors.instagram}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Instagram size={18} style={{ color: '#ec4899' }} />
                  </InputAdornment>
                ),
              }}
              sx={inputSx}
            />
          </Box>

          {/* Address Field */}
          <Box sx={{ mb: 3 }}>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="ที่อยู่จัดส่ง (ไม่บังคับ)"
              placeholder="กรอกที่อยู่สำหรับจัดส่งสินค้า"
              value={formData.address}
              onChange={e => setFormData({...formData, address: e.target.value})}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start" sx={{ alignSelf: 'flex-start', mt: 1.5 }}>
                    <MapPin size={18} />
                  </InputAdornment>
                ),
              }}
              sx={inputSx}
            />
          </Box>

          {/* PDPA Notice */}
          <Box sx={{
            p: 2.5,
            borderRadius: '16px',
            bgcolor: 'rgba(99,102,241,0.08)',
            border: '1px solid rgba(99,102,241,0.2)',
            mb: 3,
          }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 2 }}>
              <Box sx={{
                width: 36,
                height: 36,
                borderRadius: '10px',
                bgcolor: 'rgba(99,102,241,0.15)',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}>
                <ShieldCheck size={18} style={{ color: '#a5b4fc' }} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: '#a5b4fc', mb: 0.5 }}>
                  นโยบายความเป็นส่วนตัว
                </Typography>
                <Typography sx={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.5 }}>
                  ข้อมูลของท่านจะถูกใช้เพื่อการจัดส่งและติดต่อเท่านั้น จะไม่ถูกเปิดเผยต่อบุคคลภายนอก
                </Typography>
              </Box>
            </Box>
            
            <FormControlLabel
              control={
                <Checkbox
                  checked={pdpaAccepted}
                  onChange={e => setPdpaAccepted(e.target.checked)}
                  sx={{
                    color: '#64748b',
                    '&.Mui-checked': { color: '#10b981' },
                  }}
                />
              }
              label={
                <Typography sx={{ fontSize: '0.85rem', color: '#e2e8f0' }}>
                  ยินยอมให้ใช้ข้อมูลตามนโยบาย
                </Typography>
              }
            />
            {errors.pdpa && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.5, color: '#fbbf24' }}>
                <AlertTriangle size={14} />
                <Typography sx={{ fontSize: '0.75rem' }}>{errors.pdpa}</Typography>
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
        <Box sx={{ maxWidth: 500, mx: 'auto' }}>
          <Button
            fullWidth
            type="submit"
            onClick={handleSubmit}
            disabled={!pdpaAccepted}
            startIcon={<Check size={20} />}
            sx={{
              py: 1.8,
              borderRadius: '14px',
              background: pdpaAccepted 
                ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                : 'rgba(100,116,139,0.2)',
              color: pdpaAccepted ? 'white' : '#64748b',
              fontSize: '1rem',
              fontWeight: 700,
              textTransform: 'none',
              boxShadow: pdpaAccepted ? '0 4px 20px rgba(16,185,129,0.3)' : 'none',
              '&:hover': {
                background: pdpaAccepted 
                  ? 'linear-gradient(135deg, #059669 0%, #047857 100%)'
                  : 'rgba(100,116,139,0.3)',
                boxShadow: pdpaAccepted ? '0 6px 24px rgba(16,185,129,0.4)' : 'none',
              },
              '&:disabled': {
                background: 'rgba(100,116,139,0.2)',
                color: '#64748b',
              },
            }}
          >
            บันทึกข้อมูล
          </Button>
        </Box>
      </Box>
    </Drawer>
  );
}
