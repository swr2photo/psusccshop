'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { X, ShieldCheck, User, Phone, Instagram, AlertTriangle, MapPin, Check, Sparkles, UserCircle, CheckCircle2, AlertCircle, Search, Camera, ZoomIn, ZoomOut, RotateCw, Move, Plus, Trash2, Star, Edit } from 'lucide-react';
import {
  Drawer, Box, Typography, Button, IconButton, TextField, InputAdornment,
  Slide, Avatar, Autocomplete, CircularProgress, Paper, Dialog, Slider, Chip,
} from '@mui/material';
import { useThaiAddress, type AddressSelection } from '@/hooks/useThaiAddress';

// ============== ADDRESS TYPES ==============

export interface SavedAddress {
  id: string;
  label: string;       // e.g. "บ้าน", "ที่ทำงาน", "หอพัก"
  address: string;      // composed flat string
  isDefault: boolean;
}

interface ProfileModalProps {
  initialData: { name: string; phone: string; address: string; instagram: string; profileImage?: string; savedAddresses?: SavedAddress[] };
  onClose: () => void;
  onSave: (data: any) => void;
  userImage?: string;
  userEmail?: string;
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

export default function ProfileModal({ initialData, onClose, onSave, userImage, userEmail }: ProfileModalProps) {
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 640;
  const [formData, setFormData] = useState({
    name: initialData.name,
    phone: initialData.phone,
    instagram: initialData.instagram,
  });

  // Address structured fields
  const [addressFields, setAddressFields] = useState<AddressSelection>({
    province: '',
    district: '',
    subDistrict: '',
    zipCode: '',
    detail: '',
  });

  const [pdpaAccepted, setPdpaAccepted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notification, setNotification] = useState<InlineNotification | null>(null);

  // Profile image upload
  const [customProfileImage, setCustomProfileImage] = useState(initialData.profileImage || '');
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Saved addresses - multi-address support
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>(initialData.savedAddresses || []);
  const [addressLabel, setAddressLabel] = useState('');
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(!initialData.savedAddresses?.length);

  // Crop preview state
  const [cropPreview, setCropPreview] = useState<string | null>(null);
  const [cropFileName, setCropFileName] = useState('');
  const [cropMime, setCropMime] = useState('image/png');
  const [cropScale, setCropScale] = useState(1);
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });
  const [cropRotation, setCropRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const cropCanvasRef = useRef<HTMLCanvasElement>(null);
  const cropImageRef = useRef<HTMLImageElement | null>(null);

  const displayImage = customProfileImage || userImage || '';

  // Thai address data
  const {
    loading: addressLoading,
    loadData: loadAddressData,
    provinces,
    getDistricts,
    getSubDistricts,
    lookupByZipCode,
    findProvinceId,
    findDistrictId,
    composeAddress,
  } = useThaiAddress();

  // Load address data on mount
  useEffect(() => {
    loadAddressData();
  }, [loadAddressData]);

  // Parse existing address into structured fields when data is loaded
  useEffect(() => {
    if (initialData.address && provinces.length > 0) {
      const addr = initialData.address;
      // Extract zip code
      const zipMatch = addr.match(/\b(\d{5})\b/);
      if (zipMatch) {
        const results = lookupByZipCode(zipMatch[1]);
        if (results.length > 0) {
          const match = results[0];
          // Extract sub-district from text
          const provMatch = addr.match(/(?:จ\.|จังหวัด)\s*([^\s,]+)/);
          const distMatch = addr.match(/(?:อ\.|อำเภอ|เขต)\s*([^\s,]+)/);
          const subMatch = addr.match(/(?:ต\.|ตำบล|แขวง)\s*([^\s,]+)/);

          // Determine residual detail text
          let detail = addr;
          if (zipMatch) detail = detail.replace(zipMatch[0], '');
          if (provMatch) detail = detail.replace(provMatch[0], '');
          if (distMatch) detail = detail.replace(distMatch[0], '');
          if (subMatch) detail = detail.replace(subMatch[0], '');
          detail = detail.replace(/\s+/g, ' ').trim();

          setAddressFields({
            province: match.province,
            district: match.district,
            subDistrict: subMatch ? subMatch[1] : (match.subDistricts.length === 1 ? match.subDistricts[0] : ''),
            zipCode: zipMatch[1],
            detail: detail,
          });
          return;
        }
      }
      // Fallback: put everything in detail
      setAddressFields(prev => ({ ...prev, detail: addr }));
    } else if (initialData.address && provinces.length === 0) {
      setAddressFields(prev => ({ ...prev, detail: initialData.address }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData.address, provinces.length]);

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

  // Derived address lists
  const selectedProvinceId = useMemo(() => {
    if (!addressFields.province) return null;
    return findProvinceId(addressFields.province);
  }, [addressFields.province, findProvinceId]);

  const districts = useMemo(() => {
    if (!selectedProvinceId) return [];
    return getDistricts(selectedProvinceId);
  }, [selectedProvinceId, getDistricts]);

  const selectedDistrictId = useMemo(() => {
    if (!addressFields.district || !selectedProvinceId) return null;
    return findDistrictId(addressFields.district, selectedProvinceId);
  }, [addressFields.district, selectedProvinceId, findDistrictId]);

  const subDistricts = useMemo(() => {
    if (!selectedDistrictId) return [];
    return getSubDistricts(selectedDistrictId);
  }, [selectedDistrictId, getSubDistricts]);

  // Handlers
  const handleZipCodeChange = useCallback((zipCode: string) => {
    const cleaned = zipCode.replace(/\D/g, '').slice(0, 5);
    setAddressFields(prev => ({ ...prev, zipCode: cleaned }));
    if (cleaned.length === 5) {
      const results = lookupByZipCode(cleaned);
      if (results.length > 0) {
        const first = results[0];
        setAddressFields(prev => ({
          ...prev,
          zipCode: cleaned,
          province: first.province,
          district: first.district,
          subDistrict: first.subDistricts.length === 1 ? first.subDistricts[0] : prev.subDistrict,
        }));
      }
    }
  }, [lookupByZipCode]);

  const handleProvinceChange = useCallback((name: string | null) => {
    setAddressFields(prev => ({ ...prev, province: name || '', district: '', subDistrict: '', zipCode: '' }));
  }, []);

  const handleDistrictChange = useCallback((name: string | null) => {
    setAddressFields(prev => ({ ...prev, district: name || '', subDistrict: '' }));
  }, []);

  const handleSubDistrictChange = useCallback((name: string | null) => {
    if (!name) {
      setAddressFields(prev => ({ ...prev, subDistrict: '' }));
      return;
    }
    const sd = subDistricts.find(s => s.name === name);
    setAddressFields(prev => ({
      ...prev,
      subDistrict: name,
      zipCode: sd ? String(sd.zipCode) : prev.zipCode,
    }));
  }, [subDistricts]);

  // ==================== ADDRESS MANAGEMENT ====================

  const handleSaveAddress = useCallback(() => {
    const composed = composeAddress(addressFields);
    if (!composed.trim()) {
      showNotification('warning', 'กรุณากรอกที่อยู่');
      return;
    }
    const label = addressLabel.trim() || (savedAddresses.length === 0 ? 'บ้าน' : `ที่อยู่ ${savedAddresses.length + 1}`);

    if (editingAddressId) {
      // Update existing
      setSavedAddresses(prev => prev.map(a =>
        a.id === editingAddressId ? { ...a, label, address: composed } : a
      ));
      showNotification('success', 'อัปเดตที่อยู่แล้ว');
    } else {
      // Add new
      const newAddr: SavedAddress = {
        id: `addr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        label,
        address: composed,
        isDefault: savedAddresses.length === 0, // First address is default
      };
      setSavedAddresses(prev => [...prev, newAddr]);
      showNotification('success', 'เพิ่มที่อยู่แล้ว');
    }

    // Reset form
    setAddressFields({ province: '', district: '', subDistrict: '', zipCode: '', detail: '' });
    setAddressLabel('');
    setEditingAddressId(null);
    setShowAddressForm(false);
  }, [addressFields, addressLabel, composeAddress, editingAddressId, savedAddresses.length]);

  const handleEditAddress = useCallback((addr: SavedAddress) => {
    setEditingAddressId(addr.id);
    setAddressLabel(addr.label);
    setShowAddressForm(true);
    // Parse address back into structured fields
    const parsed = addr.address;
    const zipMatch = parsed.match(/\b(\d{5})\b/);
    if (zipMatch) {
      const results = lookupByZipCode(zipMatch[1]);
      if (results.length > 0) {
        const match = results[0];
        const subMatch = parsed.match(/(?:ต\.|ตำบล|แขวง)\s*([^\s,]+)/);
        const distMatch = parsed.match(/(?:อ\.|อำเภอ|เขต)\s*([^\s,]+)/);
        const provMatch = parsed.match(/(?:จ\.|จังหวัด)\s*([^\s,]+)/);
        let detail = parsed;
        [zipMatch[0], provMatch?.[0], distMatch?.[0], subMatch?.[0]].forEach(m => {
          if (m) detail = detail.replace(m, '');
        });
        setAddressFields({
          province: match.province,
          district: match.district,
          subDistrict: subMatch ? subMatch[1] : (match.subDistricts.length === 1 ? match.subDistricts[0] : ''),
          zipCode: zipMatch[1],
          detail: detail.replace(/\s+/g, ' ').trim(),
        });
        return;
      }
    }
    setAddressFields({ province: '', district: '', subDistrict: '', zipCode: '', detail: parsed });
  }, [lookupByZipCode]);

  const handleDeleteAddress = useCallback((id: string) => {
    setSavedAddresses(prev => {
      const filtered = prev.filter(a => a.id !== id);
      // If deleted was default, make first remaining the default
      if (filtered.length > 0 && !filtered.some(a => a.isDefault)) {
        filtered[0].isDefault = true;
      }
      return filtered;
    });
    showNotification('success', 'ลบที่อยู่แล้ว');
  }, []);

  const handleSetDefaultAddress = useCallback((id: string) => {
    setSavedAddresses(prev => prev.map(a => ({ ...a, isDefault: a.id === id })));
    showNotification('success', 'ตั้งเป็นที่อยู่หลักแล้ว');
  }, []);

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
    if (Object.keys(nextErrors).length > 0) {
      showNotification('warning', Object.values(nextErrors)[0]);
    }
    return Object.keys(nextErrors).length === 0;
  };

  // Open file → show crop preview (no upload yet)
  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showNotification('error', 'กรุณาเลือกไฟล์รูปภาพ');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showNotification('error', 'ไฟล์ใหญ่เกินไป (สูงสุด 5MB)');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setCropPreview(reader.result as string);
      setCropFileName(file.name);
      setCropMime(file.type);
      setCropScale(1);
      setCropOffset({ x: 0, y: 0 });
      setCropRotation(0);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  // Draw crop preview on canvas
  const drawCropPreview = useCallback(() => {
    const canvas = cropCanvasRef.current;
    const img = cropImageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width;
    ctx.clearRect(0, 0, size, size);

    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.rotate((cropRotation * Math.PI) / 180);
    ctx.scale(cropScale, cropScale);

    const aspect = img.naturalWidth / img.naturalHeight;
    let drawW: number, drawH: number;
    if (aspect >= 1) {
      drawH = size;
      drawW = size * aspect;
    } else {
      drawW = size;
      drawH = size / aspect;
    }

    ctx.drawImage(
      img,
      -drawW / 2 + cropOffset.x,
      -drawH / 2 + cropOffset.y,
      drawW,
      drawH,
    );
    ctx.restore();

    // Dark overlay outside circle
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(0, 0, size, size);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Circle border
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2);
    ctx.stroke();

    // Grid lines (rule of thirds)
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    const r = size / 2 - 4;
    // Vertical lines
    for (let i = 1; i <= 2; i++) {
      const gx = (size / 3) * i;
      // Clip to circle
      const dx = gx - size / 2;
      if (Math.abs(dx) < r) {
        const dy = Math.sqrt(r * r - dx * dx);
        ctx.beginPath();
        ctx.moveTo(gx, size / 2 - dy);
        ctx.lineTo(gx, size / 2 + dy);
        ctx.stroke();
      }
    }
    // Horizontal lines
    for (let i = 1; i <= 2; i++) {
      const gy = (size / 3) * i;
      const dy = gy - size / 2;
      if (Math.abs(dy) < r) {
        const dx = Math.sqrt(r * r - dy * dy);
        ctx.beginPath();
        ctx.moveTo(size / 2 - dx, gy);
        ctx.lineTo(size / 2 + dx, gy);
        ctx.stroke();
      }
    }

    // Center crosshair dot
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, 3, 0, Math.PI * 2);
    ctx.fill();
  }, [cropScale, cropOffset, cropRotation]);

  // Load image for crop preview
  useEffect(() => {
    if (!cropPreview) return;
    const img = new Image();
    img.onload = () => {
      cropImageRef.current = img;
      drawCropPreview();
    };
    img.src = cropPreview;
  }, [cropPreview, drawCropPreview]);

  // Redraw when transform changes
  useEffect(() => {
    if (cropImageRef.current && cropPreview) drawCropPreview();
  }, [cropScale, cropOffset, cropRotation, drawCropPreview, cropPreview]);

  // Drag handlers for crop
  const handleCropPointerDown = useCallback((e: React.PointerEvent) => {
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY, ox: cropOffset.x, oy: cropOffset.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [cropOffset]);

  const handleCropPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    // Scale the movement relative to canvas display size vs internal size
    const canvas = cropCanvasRef.current;
    const displaySize = canvas ? canvas.getBoundingClientRect().width : 280;
    const canvasSize = canvas ? canvas.width : 560;
    const ratio = canvasSize / displaySize;
    setCropOffset({
      x: dragStartRef.current.ox + dx * ratio / cropScale,
      y: dragStartRef.current.oy + dy * ratio / cropScale,
    });
  }, [isDragging, cropScale]);

  const handleCropPointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Crop + upload + auto-save profile image
  const handleCropConfirm = useCallback(async () => {
    const img = cropImageRef.current;
    if (!img) return;

    setUploadingImage(true);
    try {
      // Render the final cropped circle into a square canvas
      const outputSize = 512;
      const offscreen = document.createElement('canvas');
      offscreen.width = outputSize;
      offscreen.height = outputSize;
      const ctx = offscreen.getContext('2d')!;

      // Clip to circle
      ctx.beginPath();
      ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();

      ctx.translate(outputSize / 2, outputSize / 2);
      ctx.rotate((cropRotation * Math.PI) / 180);
      ctx.scale(cropScale, cropScale);

      const aspect = img.naturalWidth / img.naturalHeight;
      let drawW: number, drawH: number;
      if (aspect >= 1) {
        drawH = outputSize;
        drawW = outputSize * aspect;
      } else {
        drawW = outputSize;
        drawH = outputSize / aspect;
      }

      ctx.drawImage(
        img,
        -drawW / 2 + cropOffset.x * (outputSize / 560),
        -drawH / 2 + cropOffset.y * (outputSize / 560),
        drawW,
        drawH,
      );

      const croppedBase64 = offscreen.toDataURL('image/png', 0.92);

      // Upload image
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base64: croppedBase64,
          filename: cropFileName.replace(/\.[^.]+$/, '') + '_cropped.png',
          mime: 'image/png',
        }),
      });

      const json = await res.json();
      if (json.status === 'success' && json.data?.url) {
        const newUrl = json.data.url;
        setCustomProfileImage(newUrl);

        // Save profile image immediately to server (without closing modal)
        try {
          await fetch('/api/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: userEmail,
              data: {
                name: formData.name,
                phone: formData.phone,
                instagram: formData.instagram,
                address: composeAddress(addressFields),
                profileImage: newUrl,
              },
            }),
          });
        } catch {
          // Ignore - image is still set locally, will be saved on form submit
        }

        showNotification('success', 'บันทึกรูปโปรไฟล์แล้ว');
      } else {
        showNotification('error', json.message || 'อัปโหลดไม่สำเร็จ');
      }
    } catch (err) {
      showNotification('error', 'อัปโหลดไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setUploadingImage(false);
      setCropPreview(null);
      cropImageRef.current = null;
    }
  }, [cropScale, cropOffset, cropRotation, cropFileName, userEmail, formData, composeAddress, addressFields]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    // Use default address from saved addresses, or compose current fields
    const defaultAddr = savedAddresses.find(a => a.isDefault);
    const composedAddress = defaultAddr ? defaultAddr.address : composeAddress(addressFields);
    onSave({
      ...formData,
      address: composedAddress,
      profileImage: customProfileImage || undefined,
      savedAddresses,
    });
  };

  const isFormValid = formData.name && formData.phone && formData.instagram && pdpaAccepted;

  const inputSx = {
    '& .MuiOutlinedInput-root': {
      bgcolor: 'var(--surface)',
      borderRadius: '14px',
      color: 'var(--foreground)',
      fontSize: '0.95rem',
      transition: 'all 0.2s ease',
      '& fieldset': { borderColor: 'var(--glass-border)', borderWidth: '1px' },
      '&:hover fieldset': { borderColor: 'rgba(0,113,227,0.4)' },
      '&.Mui-focused fieldset': { borderColor: 'var(--secondary)', borderWidth: '2px' },
      '&.Mui-focused': { bgcolor: 'var(--surface)' },
      '& input::placeholder, & textarea::placeholder': { color: 'var(--text-muted)', opacity: 1 },
    },
    '& .MuiInputLabel-root': { color: 'var(--text-muted)', fontSize: '0.9rem' },
    '& .MuiInputLabel-root.Mui-focused': { color: 'var(--secondary)' },
    '& .MuiInputAdornment-root': { color: 'var(--text-muted)' },
    '& .MuiFormHelperText-root': { color: 'var(--error)', fontSize: '0.75rem', mt: 0.5 },
  };

  const autocompleteSx = {
    ...inputSx,
    '& .MuiAutocomplete-popupIndicator': { color: 'var(--text-muted)' },
    '& .MuiAutocomplete-clearIndicator': { color: 'var(--text-muted)' },
  };

  const dropdownPaper = (props: any) => (
    <Paper {...props} sx={{
      bgcolor: 'var(--surface)',
      color: 'var(--foreground)',
      border: '1px solid var(--glass-border)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
      borderRadius: '12px',
      mt: 0.5,
      '& .MuiAutocomplete-option': {
        fontSize: '0.9rem',
        '&[aria-selected="true"]': { bgcolor: 'rgba(0,113,227,0.12)' },
        '&.Mui-focused': { bgcolor: 'rgba(0,113,227,0.08)' },
      },
    }} />
  );

  return (
    <Drawer
      anchor="bottom"
      open={true}
      onClose={onClose}
      PaperProps={{
        sx: {
          height: { xs: '90vh', sm: '85vh' },
          maxHeight: { xs: '95vh', sm: '90vh' },
          borderTopLeftRadius: { xs: 20, sm: 24 },
          borderTopRightRadius: { xs: 20, sm: 24 },
          bgcolor: 'var(--background)',
          color: 'var(--foreground)',
          overflow: 'hidden',
        },
      }}
    >
      {/* Inline Notification Toast */}
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

      {/* Hidden file input for profile image */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        style={{ display: 'none' }}
        onChange={handleImageSelect}
      />

      {/* Header */}
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
        <Box sx={{ width: 36, height: 4, bgcolor: 'var(--glass-bg)', borderRadius: 3, mx: 'auto', mb: 1.5 }} />
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            {/* Clickable Avatar with camera overlay */}
            <Box
              onClick={() => !uploadingImage && fileInputRef.current?.click()}
              sx={{
                position: 'relative',
                cursor: uploadingImage ? 'wait' : 'pointer',
                '&:hover .camera-overlay': { opacity: 1 },
              }}
            >
              <Avatar
                src={displayImage || undefined}
                sx={{
                  width: 44,
                  height: 44,
                  border: '2px solid',
                  borderColor: customProfileImage ? 'rgba(16,185,129,0.4)' : 'rgba(0,113,227,0.3)',
                  boxShadow: customProfileImage
                    ? '0 4px 16px rgba(16,185,129,0.2)'
                    : '0 4px 16px rgba(0,113,227,0.15)',
                  transition: 'all 0.3s ease',
                }}
              >
                {!displayImage && <UserCircle size={22} />}
              </Avatar>
              {/* Camera overlay */}
              <Box
                className="camera-overlay"
                sx={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  bgcolor: 'rgba(0,0,0,0.5)',
                  display: 'grid',
                  placeItems: 'center',
                  opacity: 0,
                  transition: 'opacity 0.2s ease',
                }}
              >
                {uploadingImage
                  ? <CircularProgress size={18} sx={{ color: 'white' }} />
                  : <Camera size={16} color="white" />
                }
              </Box>
            </Box>
            <Box>
              <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)', lineHeight: 1.2 }}>
                ข้อมูลผู้ติดต่อ
              </Typography>
              <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {userEmail || 'กรอกข้อมูลเพื่อดำเนินการสั่งซื้อ'}
              </Typography>
            </Box>
          </Box>
          <IconButton
            onClick={onClose}
            size="small"
            sx={{
              bgcolor: 'var(--glass-bg)',
              color: 'var(--text-muted)',
              '&:hover': { bgcolor: 'var(--glass-bg)', color: 'var(--foreground)' },
            }}
          >
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
          px: { xs: 1.5, sm: 2.5 },
          py: 2,
        }}
      >
        <Box sx={{ maxWidth: 520, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>

          {/* ====== Name Card ====== */}
          <Box sx={{
            p: 2,
            borderRadius: '16px',
            bgcolor: 'var(--surface-2)',
            border: '1px solid var(--glass-border)',
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
              <Box sx={{
                width: 32, height: 32, borderRadius: '8px',
                background: 'linear-gradient(135deg, rgba(0,113,227,0.2) 0%, rgba(0,113,227,0.2) 100%)',
                display: 'grid', placeItems: 'center',
              }}>
                <User size={16} style={{ color: 'var(--primary)' }} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--foreground)' }}>
                  ชื่อ-นามสกุล
                </Typography>
                <Typography sx={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                  กรุณากรอกเป็นภาษาไทย
                </Typography>
              </Box>
              <Box sx={{
                ml: 'auto', px: 1, py: 0.3, borderRadius: '6px',
                bgcolor: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.2)',
              }}>
                <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--error)' }}>จำเป็น</Typography>
              </Box>
            </Box>
            <TextField
              fullWidth
              placeholder="เช่น สมชาย ใจดี"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: sanitizeThai(e.target.value) })}
              error={!!errors.name}
              helperText={errors.name}
              sx={inputSx}
            />
          </Box>

          {/* ====== Contact Card ====== */}
          <Box sx={{
            p: 2,
            borderRadius: '16px',
            bgcolor: 'var(--surface-2)',
            border: '1px solid var(--glass-border)',
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
              <Box sx={{
                width: 32, height: 32, borderRadius: '8px',
                background: 'linear-gradient(135deg, rgba(16,185,129,0.2) 0%, rgba(6,182,212,0.2) 100%)',
                display: 'grid', placeItems: 'center',
              }}>
                <Phone size={16} style={{ color: 'var(--success)' }} />
              </Box>
              <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--foreground)' }}>
                ข้อมูลติดต่อ
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                fullWidth
                placeholder="เบอร์โทรศัพท์ เช่น 0812345678"
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: sanitizePhone(e.target.value) })}
                error={!!errors.phone}
                helperText={errors.phone}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Phone size={16} style={{ color: 'var(--success)' }} />
                    </InputAdornment>
                  ),
                }}
                sx={inputSx}
              />
              <TextField
                fullWidth
                placeholder="Instagram เช่น @username"
                value={formData.instagram}
                onChange={e => setFormData({ ...formData, instagram: e.target.value.trimStart() })}
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

          {/* ====== Address Card - Multi-Address Management ====== */}
          <Box sx={{
            p: 2,
            borderRadius: '16px',
            bgcolor: 'var(--surface-2)',
            border: '1px solid var(--glass-border)',
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{
                  width: 32, height: 32, borderRadius: '8px',
                  background: 'linear-gradient(135deg, rgba(245,158,11,0.2) 0%, rgba(234,88,12,0.2) 100%)',
                  display: 'grid', placeItems: 'center',
                }}>
                  <MapPin size={16} style={{ color: 'var(--warning)' }} />
                </Box>
                <Box>
                  <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--foreground)' }}>
                    ที่อยู่จัดส่ง
                  </Typography>
                  <Typography sx={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                    {savedAddresses.length > 0 ? `${savedAddresses.length} ที่อยู่` : 'กรอกรหัสไปรษณีย์เพื่อค้นหาอัตโนมัติ'}
                  </Typography>
                </Box>
              </Box>
              {savedAddresses.length > 0 && !showAddressForm && (
                <Button
                  size="small"
                  startIcon={<Plus size={14} />}
                  onClick={() => {
                    setShowAddressForm(true);
                    setEditingAddressId(null);
                    setAddressLabel('');
                    setAddressFields({ province: '', district: '', subDistrict: '', zipCode: '', detail: '' });
                  }}
                  sx={{
                    fontSize: '0.75rem',
                    textTransform: 'none',
                    color: 'var(--primary)',
                    borderRadius: '10px',
                    fontWeight: 600,
                  }}
                >
                  เพิ่มที่อยู่
                </Button>
              )}
            </Box>

            {/* Saved Addresses List */}
            {savedAddresses.length > 0 && !showAddressForm && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 1 }}>
                {savedAddresses.map((addr) => (
                  <Box
                    key={addr.id}
                    sx={{
                      p: 1.5,
                      borderRadius: '12px',
                      bgcolor: addr.isDefault ? 'rgba(0,113,227,0.08)' : 'var(--surface)',
                      border: addr.isDefault ? '2px solid rgba(0,113,227,0.3)' : '1px solid var(--glass-border)',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip
                          label={addr.label}
                          size="small"
                          sx={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            height: 22,
                            bgcolor: addr.isDefault ? 'rgba(0,113,227,0.15)' : 'var(--glass-bg)',
                            color: addr.isDefault ? 'var(--primary)' : 'var(--text-muted)',
                            border: 'none',
                          }}
                        />
                        {addr.isDefault && (
                          <Chip
                            icon={<Star size={10} />}
                            label="หลัก"
                            size="small"
                            sx={{
                              fontSize: '0.65rem',
                              fontWeight: 700,
                              height: 20,
                              bgcolor: 'rgba(16,185,129,0.15)',
                              color: 'var(--success)',
                              border: 'none',
                              '& .MuiChip-icon': { color: 'var(--success)', fontSize: 10 },
                            }}
                          />
                        )}
                      </Box>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        {!addr.isDefault && (
                          <IconButton size="small" onClick={() => handleSetDefaultAddress(addr.id)} title="ตั้งเป็นที่อยู่หลัก"
                            sx={{ color: 'var(--text-muted)', '&:hover': { color: 'var(--primary)' } }}>
                            <Star size={14} />
                          </IconButton>
                        )}
                        <IconButton size="small" onClick={() => handleEditAddress(addr)} title="แก้ไข"
                          sx={{ color: 'var(--text-muted)', '&:hover': { color: 'var(--primary)' } }}>
                          <Edit size={14} />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleDeleteAddress(addr.id)} title="ลบ"
                          sx={{ color: 'var(--text-muted)', '&:hover': { color: '#ef4444' } }}>
                          <Trash2 size={14} />
                        </IconButton>
                      </Box>
                    </Box>
                    <Typography sx={{ fontSize: '0.8rem', color: 'var(--foreground)', lineHeight: 1.5, pl: 0.5 }}>
                      {addr.address}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}

            {/* Address Form (add/edit) */}
            {showAddressForm && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {/* Address Label */}
                <TextField
                  fullWidth
                  placeholder="ชื่อที่อยู่ เช่น บ้าน, ที่ทำงาน, หอพัก"
                  value={addressLabel}
                  onChange={e => setAddressLabel(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <MapPin size={16} style={{ color: 'var(--warning)' }} />
                      </InputAdornment>
                    ),
                  }}
                  sx={inputSx}
                  inputProps={{ maxLength: 30 }}
                />

                {/* Zip Code → auto-fill */}
                <TextField
                  fullWidth
                  placeholder="รหัสไปรษณีย์ เช่น 90110"
                  value={addressFields.zipCode}
                  onChange={e => handleZipCodeChange(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search size={16} style={{ color: 'var(--warning)' }} />
                      </InputAdornment>
                    ),
                    endAdornment: addressFields.zipCode.length === 5 && addressFields.province ? (
                      <InputAdornment position="end">
                        <Check size={16} style={{ color: 'var(--success)' }} />
                      </InputAdornment>
                    ) : null,
                  }}
                  sx={{
                    ...inputSx,
                    '& .MuiOutlinedInput-root': {
                      ...inputSx['& .MuiOutlinedInput-root'],
                      bgcolor: addressFields.zipCode.length === 5 && addressFields.province
                        ? 'rgba(16,185,129,0.06)'
                        : 'var(--surface)',
                    },
                  }}
                  inputProps={{ maxLength: 5, inputMode: 'numeric' }}
                />

                {/* Province + District */}
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  <Autocomplete
                    fullWidth
                    options={provinces.map(p => p.name)}
                    value={addressFields.province || null}
                    onChange={(_, val) => handleProvinceChange(val)}
                    loading={addressLoading}
                    noOptionsText="ไม่พบจังหวัด"
                    loadingText="กำลังโหลด..."
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        placeholder="จังหวัด"
                        sx={autocompleteSx}
                        InputProps={{
                          ...params.InputProps,
                          endAdornment: (
                            <>
                              {addressLoading ? <CircularProgress size={16} /> : null}
                              {params.InputProps.endAdornment}
                            </>
                          ),
                        }}
                      />
                    )}
                    PaperComponent={dropdownPaper}
                    sx={{ flex: 1 }}
                  />
                  <Autocomplete
                    fullWidth
                    options={districts.map(d => d.name)}
                    value={addressFields.district || null}
                    onChange={(_, val) => handleDistrictChange(val)}
                    disabled={!addressFields.province}
                    noOptionsText="เลือกจังหวัดก่อน"
                    renderInput={(params) => (
                      <TextField {...params} placeholder="อำเภอ/เขต" sx={autocompleteSx} />
                    )}
                    PaperComponent={dropdownPaper}
                    sx={{ flex: 1 }}
                  />
                </Box>

                {/* Sub-district */}
                <Autocomplete
                  fullWidth
                  options={subDistricts.map(s => s.name)}
                  value={addressFields.subDistrict || null}
                  onChange={(_, val) => handleSubDistrictChange(val)}
                  disabled={!addressFields.district}
                  noOptionsText="เลือกอำเภอ/เขตก่อน"
                  renderInput={(params) => (
                    <TextField {...params} placeholder="ตำบล/แขวง" sx={autocompleteSx} />
                  )}
                  PaperComponent={dropdownPaper}
                />

                {/* Detail address */}
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  placeholder="บ้านเลขที่ หมู่บ้าน ซอย ถนน"
                  value={addressFields.detail}
                  onChange={e => setAddressFields(prev => ({ ...prev, detail: e.target.value }))}
                  sx={inputSx}
                />

                {/* Address Preview */}
                {(addressFields.province || addressFields.detail) && (
                  <Box sx={{
                    p: 1.5,
                    borderRadius: '10px',
                    bgcolor: 'rgba(0,113,227,0.06)',
                    border: '1px solid rgba(0,113,227,0.15)',
                  }}>
                    <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--primary)', mb: 0.3 }}>
                      ที่อยู่ที่จะบันทึก:
                    </Typography>
                    <Typography sx={{ fontSize: '0.8rem', color: 'var(--foreground)', lineHeight: 1.5 }}>
                      {composeAddress(addressFields) || '—'}
                    </Typography>
                  </Box>
                )}

                {/* Save/Cancel buttons */}
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    fullWidth
                    onClick={handleSaveAddress}
                    variant="contained"
                    startIcon={editingAddressId ? <Check size={16} /> : <Plus size={16} />}
                    sx={{
                      borderRadius: '12px',
                      textTransform: 'none',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      py: 1,
                      background: 'linear-gradient(135deg, #0071e3 0%, #0077ED 100%)',
                      boxShadow: '0 4px 16px rgba(0,113,227,0.25)',
                    }}
                  >
                    {editingAddressId ? 'อัปเดตที่อยู่' : 'บันทึกที่อยู่'}
                  </Button>
                  {savedAddresses.length > 0 && (
                    <Button
                      onClick={() => {
                        setShowAddressForm(false);
                        setEditingAddressId(null);
                        setAddressLabel('');
                        setAddressFields({ province: '', district: '', subDistrict: '', zipCode: '', detail: '' });
                      }}
                      sx={{
                        borderRadius: '12px',
                        textTransform: 'none',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        py: 1,
                        color: 'var(--text-muted)',
                        minWidth: 80,
                      }}
                    >
                      ยกเลิก
                    </Button>
                  )}
                </Box>
              </Box>
            )}
          </Box>

          {/* ====== PDPA Card ====== */}
          <Box sx={{
            p: 2,
            borderRadius: '16px',
            background: pdpaAccepted
              ? 'linear-gradient(135deg, rgba(16,185,129,0.1) 0%, rgba(6,182,212,0.1) 100%)'
              : 'var(--surface-2)',
            border: pdpaAccepted
              ? '2px solid rgba(16,185,129,0.3)'
              : '1px solid var(--glass-border)',
            transition: 'all 0.3s ease',
          }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 1.5 }}>
              <Box sx={{
                width: 36, height: 36, borderRadius: '10px',
                background: pdpaAccepted
                  ? 'linear-gradient(135deg, #34c759 0%, #34c759 100%)'
                  : 'rgba(0,113,227,0.15)',
                display: 'grid', placeItems: 'center', flexShrink: 0,
                transition: 'all 0.3s ease',
              }}>
                {pdpaAccepted
                  ? <Check size={18} style={{ color: 'white' }} />
                  : <ShieldCheck size={18} style={{ color: 'var(--primary)' }} />
                }
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: pdpaAccepted ? 'var(--success)' : 'var(--foreground)', mb: 0.3 }}>
                  {pdpaAccepted ? 'ยินยอมแล้ว' : 'นโยบายความเป็นส่วนตัว'}
                </Typography>
                <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  ข้อมูลของท่านจะถูกใช้เพื่อการจัดส่งและติดต่อเท่านั้น
                </Typography>
              </Box>
            </Box>
            <Box
              onClick={() => setPdpaAccepted(!pdpaAccepted)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                p: 1.2,
                borderRadius: '10px',
                bgcolor: pdpaAccepted ? 'rgba(16,185,129,0.15)' : 'var(--glass-bg)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                '&:hover': { bgcolor: pdpaAccepted ? 'rgba(16,185,129,0.2)' : 'var(--glass-bg)' },
              }}
            >
              <Box sx={{
                width: 22, height: 22, borderRadius: '6px',
                bgcolor: pdpaAccepted ? '#34c759' : 'var(--glass-bg)',
                border: pdpaAccepted ? 'none' : '2px solid var(--glass-border)',
                display: 'grid', placeItems: 'center',
                transition: 'all 0.2s ease',
              }}>
                {pdpaAccepted && <Check size={12} style={{ color: 'white' }} />}
              </Box>
              <Typography sx={{ fontSize: '0.8rem', color: pdpaAccepted ? 'var(--success)' : 'var(--foreground)', fontWeight: 600 }}>
                ยินยอมให้ใช้ข้อมูลตามนโยบาย
              </Typography>
            </Box>
            {errors.pdpa && (
              <Box sx={{
                display: 'flex', alignItems: 'center', gap: 1,
                mt: 2, p: 1.5, borderRadius: '10px',
                bgcolor: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)',
              }}>
                <AlertTriangle size={16} style={{ color: 'var(--warning)' }} />
                <Typography sx={{ fontSize: '0.8rem', color: 'var(--warning)' }}>{errors.pdpa}</Typography>
              </Box>
            )}
          </Box>
        </Box>
      </Box>

      {/* Bottom Submit Button */}
      <Box sx={{
        px: { xs: 2, sm: 3 },
        py: 1.5,
        borderTop: '1px solid var(--glass-border)',
        background: 'var(--glass-strong)',
        backdropFilter: 'blur(20px)',
        paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
      }}>
        <Box sx={{ maxWidth: 520, mx: 'auto' }}>
          <Button
            fullWidth
            type="submit"
            onClick={handleSubmit}
            disabled={!pdpaAccepted}
            startIcon={isFormValid ? <Sparkles size={18} /> : <Check size={18} />}
            sx={{
              py: 1.5,
              borderRadius: '14px',
              background: isFormValid
                ? 'linear-gradient(135deg, #34c759 0%, #34c759 100%)'
                : pdpaAccepted
                  ? 'linear-gradient(135deg, #0077ED 0%, #0071e3 100%)'
                  : 'rgba(100,116,139,0.15)',
              color: pdpaAccepted ? 'white' : 'var(--text-muted)',
              fontSize: '0.95rem',
              fontWeight: 700,
              textTransform: 'none',
              boxShadow: isFormValid ? '0 6px 24px rgba(16,185,129,0.3)' : 'none',
              transition: 'all 0.3s ease',
              '&:hover': {
                background: isFormValid
                  ? 'linear-gradient(135deg, #34c759 0%, #047857 100%)'
                  : pdpaAccepted
                    ? 'linear-gradient(135deg, #bf5af2 0%, #1d4ed8 100%)'
                    : 'rgba(100,116,139,0.2)',
                transform: isFormValid ? 'translateY(-1px)' : 'none',
                boxShadow: isFormValid ? '0 8px 32px rgba(16,185,129,0.35)' : 'none',
              },
              '&:disabled': {
                background: 'rgba(100,116,139,0.15)',
                color: 'var(--text-muted)',
              },
            }}
          >
            {isFormValid ? 'บันทึกและดำเนินการต่อ' : 'กรอกข้อมูลให้ครบถ้วน'}
          </Button>
          {!pdpaAccepted && (
            <Typography sx={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-muted)', mt: 1 }}>
              กรุณายินยอมนโยบายความเป็นส่วนตัวก่อนดำเนินการ
            </Typography>
          )}
        </Box>
      </Box>

      {/* ====== Image Crop Preview Dialog ====== */}
      <Dialog
        open={!!cropPreview}
        onClose={() => { setCropPreview(null); cropImageRef.current = null; }}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: 'var(--surface)',
            borderRadius: '20px',
            overflow: 'hidden',
            m: 1,
          },
        }}
      >
        {/* Dialog Header */}
        <Box sx={{
          px: 2.5, py: 1.5,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid var(--glass-border)',
        }}>
          <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--foreground)' }}>
            ครอปรูปโปรไฟล์
          </Typography>
          <IconButton
            size="small"
            onClick={() => { setCropPreview(null); cropImageRef.current = null; }}
            sx={{ color: 'var(--text-muted)' }}
          >
            <X size={18} />
          </IconButton>
        </Box>

        {/* Canvas Area */}
        <Box sx={{
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          p: 2, bgcolor: 'var(--surface-2)',
        }}>
          <Box sx={{ position: 'relative', touchAction: 'none' }}>
            <canvas
              ref={cropCanvasRef}
              width={560}
              height={560}
              style={{
                width: 280,
                height: 280,
                borderRadius: '16px',
                cursor: isDragging ? 'grabbing' : 'grab',
                userSelect: 'none',
              }}
              onPointerDown={handleCropPointerDown}
              onPointerMove={handleCropPointerMove}
              onPointerUp={handleCropPointerUp}
              onPointerCancel={handleCropPointerUp}
            />
            {/* Drag hint */}
            <Box sx={{
              position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
              px: 1.5, py: 0.3, borderRadius: '8px',
              bgcolor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
              display: 'flex', alignItems: 'center', gap: 0.5,
              opacity: isDragging ? 0 : 0.7, transition: 'opacity 0.2s',
              pointerEvents: 'none',
            }}>
              <Move size={12} color="white" />
              <Typography sx={{ fontSize: '0.65rem', color: 'white', fontWeight: 500 }}>
                ลากเพื่อเลื่อน
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Controls */}
        <Box sx={{ px: 2.5, pt: 1, pb: 0.5 }}>
          {/* Zoom */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
            <ZoomOut size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <Slider
              value={cropScale}
              onChange={(_, v) => setCropScale(v as number)}
              min={0.5}
              max={3}
              step={0.05}
              sx={{
                color: '#0071e3',
                '& .MuiSlider-thumb': { width: 18, height: 18, bgcolor: 'var(--surface)', border: '2px solid #0071e3' },
                '& .MuiSlider-track': { height: 4 },
                '& .MuiSlider-rail': { height: 4, bgcolor: 'var(--glass-border)' },
              }}
            />
            <ZoomIn size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          </Box>

          {/* Rotate */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <RotateCw size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <Slider
              value={cropRotation}
              onChange={(_, v) => setCropRotation(v as number)}
              min={-180}
              max={180}
              step={1}
              sx={{
                color: '#8b5cf6',
                '& .MuiSlider-thumb': { width: 18, height: 18, bgcolor: 'var(--surface)', border: '2px solid #8b5cf6' },
                '& .MuiSlider-track': { height: 4 },
                '& .MuiSlider-rail': { height: 4, bgcolor: 'var(--glass-border)' },
              }}
            />
            <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)', minWidth: 32, textAlign: 'right' }}>
              {cropRotation}°
            </Typography>
          </Box>
        </Box>

        {/* Action Buttons */}
        <Box sx={{
          px: 2.5, py: 1.5, display: 'flex', gap: 1.5,
          borderTop: '1px solid var(--glass-border)',
        }}>
          <Button
            fullWidth
            onClick={() => { setCropPreview(null); cropImageRef.current = null; }}
            sx={{
              py: 1, borderRadius: '12px',
              bgcolor: 'var(--glass-bg)', color: 'var(--foreground)',
              fontWeight: 600, fontSize: '0.85rem', textTransform: 'none',
              '&:hover': { bgcolor: 'var(--glass-border)' },
            }}
          >
            ยกเลิก
          </Button>
          <Button
            fullWidth
            onClick={handleCropConfirm}
            disabled={uploadingImage}
            startIcon={uploadingImage ? <CircularProgress size={16} sx={{ color: 'white' }} /> : <Check size={16} />}
            sx={{
              py: 1, borderRadius: '12px',
              background: 'linear-gradient(135deg, #34c759 0%, #34c759 100%)',
              color: 'white', fontWeight: 600, fontSize: '0.85rem', textTransform: 'none',
              boxShadow: '0 4px 16px rgba(16,185,129,0.25)',
              '&:hover': { background: 'linear-gradient(135deg, #34c759 0%, #047857 100%)' },
              '&:disabled': { opacity: 0.7 },
            }}
          >
            {uploadingImage ? 'กำลังบันทึก...' : 'ยืนยันและบันทึก'}
          </Button>
        </Box>
      </Dialog>
    </Drawer>
  );
}
