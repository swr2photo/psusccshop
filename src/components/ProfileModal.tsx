'use client';

import { apiFetch, uploadImageApi } from '@/lib/api-client';
import { useState, useEffect, useMemo, useCallback, useRef, type HTMLAttributes } from 'react';
import { X, ShieldCheck, User, Phone, Instagram, AlertTriangle, MapPin, Check, ArrowRight, UserCircle, CheckCircle2, AlertCircle, Search, Camera, ZoomIn, ZoomOut, RotateCw, Move, Plus, Trash2, Star, Pencil } from 'lucide-react';
import {
  Drawer, Box, Typography, Button, IconButton, TextField, InputAdornment,
  Slide, Avatar, Autocomplete, CircularProgress, Paper, Dialog, Slider, Chip,
  useMediaQuery,
} from '@mui/material';
import PasskeyManager from '@/components/PasskeyManager';
import { useThaiAddress, type AddressSelection } from '@/hooks/useThaiAddress';
import { type NameValidationConfig, DEFAULT_NAME_VALIDATION } from '@/lib/config';
import { useTranslation } from '@/hooks/useTranslation';
import { Button as UiButton } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/** Formal institutional UI tokens (shadcn-like, muted, lower radius). */
const FORMAL = {
  card: {
    p: 2,
    borderRadius: '8px',
    bgcolor: 'var(--surface)',
    border: '1px solid var(--glass-border)',
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: '6px',
    bgcolor: 'var(--surface-2)',
    border: '1px solid var(--glass-border)',
    display: 'grid',
    placeItems: 'center',
    color: 'var(--foreground)',
    flexShrink: 0,
  },
  mutedIcon: 'var(--text-muted)',
} as const;

// ============== ADDRESS TYPES ==============

export interface SavedAddress {
  id: string;
  label: string;       // e.g. "บ้าน", "ที่ทำงาน", "หอพัก"
  address: string;      // composed flat string
  isDefault: boolean;
}

export interface ProfileSaveData {
  name: string;
  phone: string;
  address: string;
  instagram: string;
  profileImage?: string;
  savedAddresses?: SavedAddress[];
}

interface ProfileModalProps {
  initialData: { name: string; phone: string; address: string; instagram: string; profileImage?: string; savedAddresses?: SavedAddress[] };
  onClose: () => void;
  onSave: (data: ProfileSaveData) => void;
  userImage?: string;
  userEmail?: string;
  nameValidation?: NameValidationConfig;
}

// ============== INLINE NOTIFICATION ==============

interface InlineNotification {
  type: 'success' | 'error' | 'warning';
  message: string;
}

const NOTIFICATION_STYLES = {
  success: {
    bg: 'var(--foreground)',
    icon: <CheckCircle2 size={16} strokeWidth={1.75} />,
  },
  error: {
    bg: 'var(--error)',
    icon: <AlertCircle size={16} strokeWidth={1.75} />,
  },
  warning: {
    bg: 'var(--text-muted)',
    icon: <AlertTriangle size={16} strokeWidth={1.75} />,
  },
};

export default function ProfileModal({ initialData, onClose, onSave, userImage, userEmail, nameValidation }: ProfileModalProps) {
  const isMobile = useMediaQuery('(max-width:640px)');
  const nameConfig = { ...DEFAULT_NAME_VALIDATION, ...nameValidation };
  const { t } = useTranslation();

  // Swipe-to-dismiss state
  const [pmDragOffset, setPmDragOffset] = useState(0);
  const [pmIsDragging, setPmIsDragging] = useState(false);
  const pmSwipeStartY = useRef(0);

  const handlePmSwipeStart = useCallback((e: React.TouchEvent) => {
    pmSwipeStartY.current = e.touches[0].clientY;
    setPmIsDragging(true);
  }, []);

  const handlePmSwipeMove = useCallback((e: React.TouchEvent) => {
    if (!pmIsDragging) return;
    const delta = e.touches[0].clientY - pmSwipeStartY.current;
    if (delta < 0) { setPmDragOffset(0); return; }
    setPmDragOffset(delta > 80 ? 80 + (delta - 80) * 0.3 : delta);
  }, [pmIsDragging]);

  const handlePmSwipeEnd = useCallback(() => {
    if (!pmIsDragging) return;
    setPmIsDragging(false);
    if (pmDragOffset >= 80) {
      setPmDragOffset(window.innerHeight);
      setTimeout(() => { onClose(); setPmDragOffset(0); }, 200);
    } else {
      setPmDragOffset(0);
    }
  }, [pmIsDragging, pmDragOffset, onClose]);

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

  // Category tabs: keep the popup compact instead of one long scrolling form
  type ProfileTab = 'personal' | 'address' | 'security';
  const [activeTab, setActiveTab] = useState<ProfileTab>('personal');

  // Profile image upload
  const [customProfileImage, setCustomProfileImage] = useState(initialData.profileImage || '');
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Saved addresses - multi-address support
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>(initialData.savedAddresses || []);
  const [addressLabel, setAddressLabel] = useState('');
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(!initialData.savedAddresses?.length);

  // Sync saved addresses when parent finishes async profile load (avoid empty overwrite on save)
  useEffect(() => {
    if (initialData.savedAddresses?.length && savedAddresses.length === 0) {
      setSavedAddresses(initialData.savedAddresses);
    }
  }, [initialData.savedAddresses, savedAddresses.length]);

  // Crop preview state
  const [cropPreview, setCropPreview] = useState<string | null>(null);
  const [cropFileName, setCropFileName] = useState('');
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

  const sanitizeName = (value: string) => {
    // Build allowed character regex dynamically from nameConfig
    let pattern = '';
    if (nameConfig.allowThai) pattern += '\u0E00-\u0E7F';
    if (nameConfig.allowEnglish) pattern += 'a-zA-Z';
    if (nameConfig.allowSpecialChars && nameConfig.allowedSpecialChars) {
      // Escape special regex chars
      pattern += nameConfig.allowedSpecialChars.replace(/[\\\]\^\-]/g, '\\$&');
    }
    pattern += '\\s';
    const regex = new RegExp(`[^${pattern}]`, 'g');
    return value.replace(regex, '').trimStart().slice(0, nameConfig.maxLength);
  };
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
      showNotification('warning', t.profile.fillAddress);
      return;
    }
    const label = addressLabel.trim() || (savedAddresses.length === 0 ? t.profile.homeDefault : `${t.profile.addressN} ${savedAddresses.length + 1}`);

    if (editingAddressId) {
      // Update existing
      setSavedAddresses(prev => prev.map(a =>
        a.id === editingAddressId ? { ...a, label, address: composed } : a
      ));
      showNotification('success', t.profile.updatedAddress);
    } else {
      // Add new
      const newAddr: SavedAddress = {
        id: `addr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        label,
        address: composed,
        isDefault: savedAddresses.length === 0, // First address is default
      };
      setSavedAddresses(prev => [...prev, newAddr]);
      showNotification('success', t.profile.addedAddress);
    }

    // Reset form
    setAddressFields({ province: '', district: '', subDistrict: '', zipCode: '', detail: '' });
    setAddressLabel('');
    setEditingAddressId(null);
    setShowAddressForm(false);
  }, [addressFields, addressLabel, composeAddress, editingAddressId, savedAddresses.length, t]);

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
    showNotification('success', t.profile.deletedAddress);
  }, [t]);

  const handleSetDefaultAddress = useCallback((id: string) => {
    setSavedAddresses(prev => prev.map(a => ({ ...a, isDefault: a.id === id })));
    showNotification('success', t.profile.setAsDefault);
  }, [t]);

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    const trimmedName = formData.name.trim();
    if (!trimmedName) {
      nextErrors.name = t.profile.fillName;
    } else if (trimmedName.length < nameConfig.minLength) {
      nextErrors.name = `${t.profile.nameMinLength} ${nameConfig.minLength} ${t.profile.characters}`;
    } else if (trimmedName.length > nameConfig.maxLength) {
      nextErrors.name = `${t.profile.nameMaxLength} ${nameConfig.maxLength} ${t.profile.characters}`;
    } else {
      // Build validation regex from config
      let charClass = '';
      if (nameConfig.allowThai) charClass += '\u0E00-\u0E7F';
      if (nameConfig.allowEnglish) charClass += 'a-zA-Z';
      if (nameConfig.allowSpecialChars && nameConfig.allowedSpecialChars) {
        charClass += nameConfig.allowedSpecialChars.replace(/[\\\]\^\-]/g, '\\$&');
      }
      charClass += '\\s';
      const nameRegex = new RegExp(`^[${charClass}]+$`);
      if (!nameRegex.test(trimmedName)) {
        const langs: string[] = [];
        if (nameConfig.allowThai) langs.push(t.profile.langThai);
        if (nameConfig.allowEnglish) langs.push(t.profile.langEnglish);
        nextErrors.name = `${t.profile.nameLanguageHint}${langs.join('/')}`;
        if (nameConfig.allowSpecialChars) nextErrors.name += ` (${nameConfig.allowedSpecialChars})`;
      }
    }
    if (!formData.phone || formData.phone.length < 9) {
      nextErrors.phone = t.profile.fillPhone;
    }
    if (!formData.instagram.trim()) {
      nextErrors.instagram = t.profile.fillIG;
    }
    if (!pdpaAccepted) {
      nextErrors.pdpa = t.profile.pdpaAcceptRequired;
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      showNotification('warning', Object.values(nextErrors)[0]);
      // All required fields live on the personal tab — jump there so the user sees the error
      setActiveTab('personal');
    }
    return Object.keys(nextErrors).length === 0;
  };

  // Open file → show crop preview (no upload yet)
  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showNotification('error', t.profile.selectImageFile);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showNotification('error', t.profile.fileTooLarge);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setCropPreview(reader.result as string);
      setCropFileName(file.name);
      setCropScale(1);
      setCropOffset({ x: 0, y: 0 });
      setCropRotation(0);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [t]);

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
      const res = await uploadImageApi({
        base64: croppedBase64,
        filename: cropFileName.replace(/\.[^.]+$/, '') + '_cropped.png',
        mime: 'image/png',
      });

      const json = await res.json();
      if (json.status === 'success' && json.data?.url) {
        const newUrl = json.data.url;
        setCustomProfileImage(newUrl);

        // Save profile image immediately to server (without closing modal)
        try {
          await apiFetch('/api/profile', {
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

        showNotification('success', t.profile.profileImageSaved);
      } else {
        showNotification('error', json.message || t.profile.uploadFailed);
      }
    } catch {
      showNotification('error', t.profile.uploadFailedRetry);
    } finally {
      setUploadingImage(false);
      setCropPreview(null);
      cropImageRef.current = null;
    }
  }, [cropScale, cropOffset, cropRotation, cropFileName, userEmail, formData, composeAddress, addressFields, t]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    // Never send blank address if we already have one on file
    const defaultAddr = savedAddresses.find(a => a.isDefault);
    const composedAddress =
      defaultAddr?.address?.trim() ||
      composeAddress(addressFields).trim() ||
      initialData.address?.trim() ||
      '';
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
      bgcolor: 'var(--background)',
      borderRadius: '6px',
      color: 'var(--foreground)',
      fontSize: '0.875rem',
      transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
      '& fieldset': { borderColor: 'var(--glass-border)', borderWidth: '1px' },
      '&:hover fieldset': { borderColor: 'var(--text-muted)' },
      '&.Mui-focused fieldset': { borderColor: 'var(--foreground)', borderWidth: '1px' },
      '&.Mui-focused': {
        bgcolor: 'var(--background)',
        boxShadow: '0 0 0 3px color-mix(in srgb, var(--foreground) 8%, transparent)',
      },
      '& input::placeholder, & textarea::placeholder': { color: 'var(--text-muted)', opacity: 1 },
    },
    '& .MuiInputLabel-root': { color: 'var(--text-muted)', fontSize: '0.875rem' },
    '& .MuiInputLabel-root.Mui-focused': { color: 'var(--foreground)' },
    '& .MuiInputAdornment-root': { color: 'var(--text-muted)' },
    '& .MuiFormHelperText-root': { color: 'var(--text-muted)', fontSize: '0.75rem', mt: 0.5 },
    '& .MuiFormHelperText-root.Mui-error': { color: 'var(--error)' },
  };

  const autocompleteSx = {
    ...inputSx,
    '& .MuiAutocomplete-popupIndicator': { color: 'var(--text-muted)' },
    '& .MuiAutocomplete-clearIndicator': { color: 'var(--text-muted)' },
  };

  const dropdownPaper = (props: HTMLAttributes<HTMLDivElement>) => (
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
      anchor={isMobile ? 'bottom' : 'right'}
      open={true}
      onClose={onClose}
      sx={{ zIndex: 1400 }}
      PaperProps={{
        sx: {
          height: isMobile ? { xs: '92vh', sm: '88vh' } : '100vh',
          maxHeight: isMobile ? { xs: '96vh', sm: '92vh' } : '100vh',
          width: isMobile ? '100%' : '440px',
          borderTopLeftRadius: isMobile ? '12px' : 0,
          borderTopRightRadius: isMobile ? '12px' : 0,
          borderBottomLeftRadius: 0,
          bgcolor: 'var(--background)',
          color: 'var(--foreground)',
          overflow: 'hidden',
          borderLeft: isMobile ? 'none' : '1px solid var(--glass-border)',
          transform: isMobile && pmDragOffset > 0 ? `translateY(${pmDragOffset}px) !important` : undefined,
          transition: pmIsDragging ? 'none !important' : 'transform 0.25s ease !important',
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
                borderRadius: '8px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
              }}
            >
              <Box
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: '6px',
                  bgcolor: 'rgba(255, 255, 255, 0.12)',
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
        {isMobile && (
          <>
            <Box sx={{ width: 36, height: 4, bgcolor: 'var(--glass-bg)', borderRadius: 3, mx: 'auto', mb: 1.5 }} />
            {/* Drag Handle Area - Swipe to dismiss */}
            <Box
              onTouchStart={handlePmSwipeStart}
              onTouchMove={handlePmSwipeMove}
              onTouchEnd={handlePmSwipeEnd}
              sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 32, cursor: 'grab', touchAction: 'none', zIndex: 15 }}
            />
          </>
        )}
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
                  borderRadius: '8px',
                  border: '1px solid var(--glass-border)',
                  bgcolor: 'var(--surface-2)',
                  color: 'var(--text-muted)',
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
                  borderRadius: '8px',
                  bgcolor: 'rgba(0,0,0,0.55)',
                  display: 'grid',
                  placeItems: 'center',
                  opacity: 0,
                  transition: 'opacity 0.15s ease',
                }}
              >
                {uploadingImage
                  ? <CircularProgress size={18} sx={{ color: 'white' }} />
                  : <Camera size={16} color="white" />
                }
              </Box>
            </Box>
            <Box>
              <Typography sx={{ fontSize: '0.95rem', fontWeight: 650, color: 'var(--foreground)', lineHeight: 1.25, letterSpacing: '-0.01em' }}>
                {t.profile.contactInfo}
              </Typography>
              <Typography sx={{ fontSize: '0.72rem', color: 'var(--text-muted)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {userEmail || t.profile.contactDesc}
              </Typography>
            </Box>
          </Box>
          <UiButton
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={onClose}
            aria-label="Close"
            className="border-[var(--glass-border)] bg-transparent text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
          >
            <X className="size-4" />
          </UiButton>
        </Box>

        {/* Segmented tabs — formal, not pills */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: userEmail ? '1fr 1fr 1fr' : '1fr 1fr',
            gap: 0.5,
            mt: 1.75,
            p: 0.5,
            borderRadius: '8px',
            bgcolor: 'var(--surface-2)',
            border: '1px solid var(--glass-border)',
          }}
        >
          {([
            {
              key: 'personal' as const,
              label: t.profile.tabPersonal,
              icon: <User size={14} strokeWidth={1.75} />,
              complete: !!(formData.name && formData.phone && formData.instagram && pdpaAccepted),
              show: true,
            },
            {
              key: 'address' as const,
              label: t.profile.tabAddress,
              icon: <MapPin size={14} strokeWidth={1.75} />,
              complete: savedAddresses.length > 0,
              show: true,
              badge: savedAddresses.length || undefined,
            },
            {
              key: 'security' as const,
              label: t.profile.tabSecurity,
              icon: <ShieldCheck size={14} strokeWidth={1.75} />,
              complete: false,
              show: !!userEmail,
            },
          ]).filter(tab => tab.show).map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <Box
                key={tab.key}
                component="button"
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-[0.72rem] font-medium transition-colors',
                  isActive
                    ? 'bg-[var(--background)] text-[var(--foreground)] shadow-sm border border-[var(--glass-border)]'
                    : 'text-[var(--text-muted)] border border-transparent hover:text-[var(--foreground)]',
                )}
              >
                {tab.icon}
                <span className="truncate">{tab.label}</span>
                {tab.badge !== undefined ? (
                  <Badge variant="muted" className="min-w-5 justify-center px-1 py-0 text-[0.65rem]">
                    {tab.badge}
                  </Badge>
                ) : null}
                {tab.complete ? <Check size={12} strokeWidth={2} className="opacity-70" /> : null}
              </Box>
            );
          })}
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

          {/* ============ TAB: Personal Info (name + contact + consent) ============ */}
          {activeTab === 'personal' && (
          <>
          {/* ====== Name Card ====== */}
          <Box sx={FORMAL.card}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
              <Box sx={FORMAL.iconBox}>
                <User size={15} strokeWidth={1.75} />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: '0.85rem', fontWeight: 650, color: 'var(--foreground)' }}>
                  {t.profile.fullName}
                </Typography>
                <Typography sx={{ fontSize: '0.68rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  {(() => {
                    const langs: string[] = [];
                    if (nameConfig.allowThai) langs.push(t.profile.langThai);
                    if (nameConfig.allowEnglish) langs.push(t.profile.langEnglish);
                    let hint = `${t.profile.nameLanguageHint}${langs.join('/')}`;
                    if (nameConfig.allowSpecialChars) hint += ` (${nameConfig.allowedSpecialChars})`;
                    hint += ` · ${nameConfig.minLength}-${nameConfig.maxLength} ${t.profile.characters}`;
                    return hint;
                  })()}
                </Typography>
              </Box>
              <Badge variant="outline" className="shrink-0 border-[var(--glass-border)] text-[var(--text-muted)]">
                {t.common.required}
              </Badge>
            </Box>
            <TextField
              fullWidth
              placeholder={nameConfig.allowEnglish ? t.profile.nameExampleBilingual : t.profile.nameExample}
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: sanitizeName(e.target.value) })}
              error={!!errors.name}
              helperText={errors.name || `${formData.name.trim().length}/${nameConfig.maxLength}`}
              inputProps={{ maxLength: nameConfig.maxLength }}
              sx={inputSx}
            />
          </Box>

          {/* ====== Contact Card ====== */}
          <Box sx={FORMAL.card}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
              <Box sx={FORMAL.iconBox}>
                <Phone size={15} strokeWidth={1.75} />
              </Box>
              <Typography sx={{ fontSize: '0.85rem', fontWeight: 650, color: 'var(--foreground)' }}>
                {t.profile.contactSection}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <TextField
                fullWidth
                placeholder={t.profile.phoneNumber}
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: sanitizePhone(e.target.value) })}
                error={!!errors.phone}
                helperText={errors.phone}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Phone size={15} strokeWidth={1.75} style={{ color: FORMAL.mutedIcon }} />
                    </InputAdornment>
                  ),
                }}
                sx={inputSx}
              />
              <TextField
                fullWidth
                placeholder={t.profile.instagram}
                value={formData.instagram}
                onChange={e => setFormData({ ...formData, instagram: e.target.value.trimStart() })}
                error={!!errors.instagram}
                helperText={errors.instagram}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Instagram size={15} strokeWidth={1.75} style={{ color: FORMAL.mutedIcon }} />
                    </InputAdornment>
                  ),
                }}
                sx={inputSx}
              />
            </Box>
          </Box>
          </>
          )}

          {/* ============ TAB: Shipping Addresses ============ */}
          {activeTab === 'address' && (
          /* ====== Address Card - Multi-Address Management ====== */
          <Box sx={FORMAL.card}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={FORMAL.iconBox}>
                  <MapPin size={15} strokeWidth={1.75} />
                </Box>
                <Box>
                  <Typography sx={{ fontSize: '0.85rem', fontWeight: 650, color: 'var(--foreground)' }}>
                    {t.profile.shippingAddress}
                  </Typography>
                  <Typography sx={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                    {savedAddresses.length > 0 ? `${savedAddresses.length} ${t.profile.addressCount}` : t.profile.zipCodeHint}
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
                    color: 'var(--foreground)',
                    borderRadius: '6px',
                    fontWeight: 600,
                    border: '1px solid var(--glass-border)',
                    px: 1.25,
                  }}
                >
                  {t.profile.addAddress}
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
                      borderRadius: '8px',
                      bgcolor: 'var(--background)',
                      border: addr.isDefault ? '1px solid var(--foreground)' : '1px solid var(--glass-border)',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip
                          label={addr.label}
                          size="small"
                          sx={{
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            height: 22,
                            bgcolor: 'var(--surface-2)',
                            color: 'var(--foreground)',
                            border: '1px solid var(--glass-border)',
                            borderRadius: '4px',
                          }}
                        />
                        {addr.isDefault && (
                          <Chip
                            icon={<Star size={10} />}
                            label={t.common.default}
                            size="small"
                            sx={{
                              fontSize: '0.65rem',
                              fontWeight: 600,
                              height: 20,
                              bgcolor: 'transparent',
                              color: 'var(--text-muted)',
                              border: '1px solid var(--glass-border)',
                              borderRadius: '4px',
                              '& .MuiChip-icon': { color: 'var(--text-muted)', fontSize: 10 },
                            }}
                          />
                        )}
                      </Box>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        {!addr.isDefault && (
                          <IconButton size="small" onClick={() => handleSetDefaultAddress(addr.id)} title={t.profile.setDefault}
                            sx={{ color: 'var(--text-muted)', '&:hover': { color: 'var(--foreground)' } }}>
                            <Star size={14} strokeWidth={1.75} />
                          </IconButton>
                        )}
                        <IconButton size="small" onClick={() => handleEditAddress(addr)} title={t.common.edit}
                          sx={{ color: 'var(--text-muted)', '&:hover': { color: 'var(--foreground)' } }}>
                          <Pencil size={14} strokeWidth={1.75} />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleDeleteAddress(addr.id)} title={t.common.delete}
                          sx={{ color: 'var(--text-muted)', '&:hover': { color: 'var(--error)' } }}>
                          <Trash2 size={14} strokeWidth={1.75} />
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
                  placeholder={t.profile.addressLabel}
                  value={addressLabel}
                  onChange={e => setAddressLabel(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <MapPin size={15} strokeWidth={1.75} style={{ color: FORMAL.mutedIcon }} />
                      </InputAdornment>
                    ),
                  }}
                  sx={inputSx}
                  inputProps={{ maxLength: 30 }}
                />

                {/* Zip Code → auto-fill */}
                <TextField
                  fullWidth
                  placeholder={t.profile.zipCode}
                  value={addressFields.zipCode}
                  onChange={e => handleZipCodeChange(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search size={15} strokeWidth={1.75} style={{ color: FORMAL.mutedIcon }} />
                      </InputAdornment>
                    ),
                    endAdornment: addressFields.zipCode.length === 5 && addressFields.province ? (
                      <InputAdornment position="end">
                        <Check size={15} strokeWidth={1.75} style={{ color: FORMAL.mutedIcon }} />
                      </InputAdornment>
                    ) : null,
                  }}
                  sx={inputSx}
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
                    noOptionsText={t.profile.noProvince}
                    loadingText={t.common.loading}
                    slotProps={{ popper: { sx: { zIndex: 1500 } } }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        placeholder={t.profile.province}
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
                    noOptionsText={t.profile.selectProvince}
                    slotProps={{ popper: { sx: { zIndex: 1500 } } }}
                    renderInput={(params) => (
                      <TextField {...params} placeholder={t.profile.district} sx={autocompleteSx} />
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
                  noOptionsText={t.profile.selectDistrict}
                  slotProps={{ popper: { sx: { zIndex: 1500 } } }}
                  renderInput={(params) => (
                    <TextField {...params} placeholder={t.profile.subDistrict} sx={autocompleteSx} />
                  )}
                  PaperComponent={dropdownPaper}
                />

                {/* Detail address */}
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  placeholder={t.profile.addressDetail}
                  value={addressFields.detail}
                  onChange={e => setAddressFields(prev => ({ ...prev, detail: e.target.value }))}
                  sx={inputSx}
                />

                {/* Address Preview */}
                {(addressFields.province || addressFields.detail) && (
                  <Box sx={{
                    p: 1.5,
                    borderRadius: '6px',
                    bgcolor: 'var(--surface-2)',
                    border: '1px solid var(--glass-border)',
                  }}>
                    <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', mb: 0.3 }}>
                      {t.profile.addressPreview}
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
                    startIcon={editingAddressId ? <Check size={16} strokeWidth={1.75} /> : <Plus size={16} strokeWidth={1.75} />}
                    sx={{
                      borderRadius: '6px',
                      textTransform: 'none',
                      fontWeight: 650,
                      fontSize: '0.85rem',
                      py: 1,
                      bgcolor: 'var(--foreground)',
                      color: 'var(--background)',
                      boxShadow: 'none',
                      '&:hover': { bgcolor: 'var(--foreground)', opacity: 0.92, boxShadow: 'none' },
                    }}
                  >
                    {editingAddressId ? t.profile.updateAddress : t.profile.saveAddress}
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
                        borderRadius: '6px',
                        textTransform: 'none',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        py: 1,
                        color: 'var(--text-muted)',
                        border: '1px solid var(--glass-border)',
                        minWidth: 80,
                      }}
                    >
                      {t.common.cancel}
                    </Button>
                  )}
                </Box>
              </Box>
            )}
          </Box>
          )}

          {/* ============ TAB: Security ============ */}
          {activeTab === 'security' && userEmail && (
            <Box sx={FORMAL.card}>
              <PasskeyManager userEmail={userEmail} />
            </Box>
          )}

          {/* ====== PDPA Card (personal tab) ====== */}
          {activeTab === 'personal' && (
          <Box sx={{
            ...FORMAL.card,
            borderColor: pdpaAccepted ? 'var(--foreground)' : 'var(--glass-border)',
          }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 1.5 }}>
              <Box sx={FORMAL.iconBox}>
                <ShieldCheck size={16} strokeWidth={1.75} />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontSize: '0.85rem', fontWeight: 650, color: 'var(--foreground)', mb: 0.3 }}>
                  {pdpaAccepted ? t.profile.pdpaAccepted : t.profile.privacyPolicy}
                </Typography>
                <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  {t.profile.pdpaDesc}
                </Typography>
              </Box>
            </Box>
            <Box
              onClick={() => setPdpaAccepted(!pdpaAccepted)}
              role="checkbox"
              aria-checked={pdpaAccepted}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                p: 1.25,
                borderRadius: '6px',
                bgcolor: 'var(--surface-2)',
                border: '1px solid var(--glass-border)',
                cursor: 'pointer',
                '&:hover': { bgcolor: 'var(--glass-bg)' },
              }}
            >
              <Box sx={{
                width: 18, height: 18, borderRadius: '4px',
                bgcolor: pdpaAccepted ? 'var(--foreground)' : 'transparent',
                border: pdpaAccepted ? 'none' : '1.5px solid var(--text-muted)',
                display: 'grid', placeItems: 'center',
                flexShrink: 0,
              }}>
                {pdpaAccepted && <Check size={12} strokeWidth={2.5} style={{ color: 'var(--background)' }} />}
              </Box>
              <Typography sx={{ fontSize: '0.8rem', color: 'var(--foreground)', fontWeight: 550 }}>
                {t.profile.pdpaConsent}
              </Typography>
            </Box>
            {errors.pdpa && (
              <Box sx={{
                display: 'flex', alignItems: 'center', gap: 1,
                mt: 1.5, p: 1.25, borderRadius: '6px',
                bgcolor: 'var(--surface-2)', border: '1px solid var(--glass-border)',
              }}>
                <AlertTriangle size={15} strokeWidth={1.75} style={{ color: FORMAL.mutedIcon }} />
                <Typography sx={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{errors.pdpa}</Typography>
              </Box>
            )}
          </Box>
          )}
        </Box>
      </Box>

      {/* Bottom Submit Button */}
      <Box sx={{
        px: { xs: 2, sm: 2.5 },
        py: 1.5,
        borderTop: '1px solid var(--glass-border)',
        background: 'var(--background)',
        paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
      }}>
        <Box sx={{ maxWidth: 520, mx: 'auto' }}>
          <UiButton
            type="submit"
            onClick={handleSubmit}
            disabled={!pdpaAccepted}
            className={cn(
              'h-11 w-full rounded-md text-sm font-semibold',
              pdpaAccepted
                ? 'bg-[var(--foreground)] text-[var(--background)] hover:bg-[var(--foreground)]/90'
                : 'bg-[var(--surface-2)] text-[var(--text-muted)]',
            )}
          >
            {isFormValid ? (
              <>
                {t.profile.saveAndContinue}
                <ArrowRight className="size-4" />
              </>
            ) : (
              <>
                <Check className="size-4" />
                {t.profile.fillAllInfo}
              </>
            )}
          </UiButton>
          {!pdpaAccepted && (
            <Typography sx={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-muted)', mt: 1 }}>
              {t.profile.pdpaRequired}
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
        sx={{ zIndex: 1500 }}
        PaperProps={{
          sx: {
            bgcolor: 'var(--surface)',
            borderRadius: '10px',
            overflow: 'hidden',
            m: 1,
            border: '1px solid var(--glass-border)',
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
            {t.profile.cropProfile}
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
                width: 'min(280px, calc(100vw - 80px))',
                height: 'min(280px, calc(100vw - 80px))',
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
                {t.profile.dragToMove}
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
                color: 'var(--foreground)',
                '& .MuiSlider-thumb': { width: 16, height: 16, bgcolor: 'var(--background)', border: '2px solid var(--foreground)' },
                '& .MuiSlider-track': { height: 3 },
                '& .MuiSlider-rail': { height: 3, bgcolor: 'var(--glass-border)' },
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
                color: 'var(--foreground)',
                '& .MuiSlider-thumb': { width: 16, height: 16, bgcolor: 'var(--background)', border: '2px solid var(--foreground)' },
                '& .MuiSlider-track': { height: 3 },
                '& .MuiSlider-rail': { height: 3, bgcolor: 'var(--glass-border)' },
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
              py: 1, borderRadius: '6px',
              bgcolor: 'transparent', color: 'var(--foreground)',
              border: '1px solid var(--glass-border)',
              fontWeight: 600, fontSize: '0.85rem', textTransform: 'none',
              '&:hover': { bgcolor: 'var(--surface-2)' },
            }}
          >
            {t.common.cancel}
          </Button>
          <Button
            fullWidth
            onClick={handleCropConfirm}
            disabled={uploadingImage}
            startIcon={uploadingImage ? <CircularProgress size={16} sx={{ color: 'var(--background)' }} /> : <Check size={16} strokeWidth={1.75} />}
            sx={{
              py: 1, borderRadius: '6px',
              bgcolor: 'var(--foreground)',
              color: 'var(--background)',
              fontWeight: 650, fontSize: '0.85rem', textTransform: 'none',
              boxShadow: 'none',
              '&:hover': { bgcolor: 'var(--foreground)', opacity: 0.92, boxShadow: 'none' },
              '&:disabled': { opacity: 0.7 },
            }}
          >
            {uploadingImage ? t.profile.saving : t.profile.confirmSave}
          </Button>
        </Box>
      </Dialog>
    </Drawer>
  );
}
