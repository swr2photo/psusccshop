// src/components/admin/ShopManagement.tsx
// Multi-shop management panel for Admin page
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Button, TextField, Dialog, DialogTitle, DialogContent,
  DialogActions, IconButton, Switch, Chip, Avatar, Tooltip, CircularProgress,
} from '@mui/material';
import {
  Store, Plus, Trash2, Edit, Save, X, Users, ShieldCheck, Eye, EyeOff, Copy,
  ExternalLink, Settings, DollarSign, ChevronDown, ChevronUp, UserPlus, Check,
  Image, Upload,
} from 'lucide-react';

// ==================== TYPES ====================
interface Shop {
  id: string;
  slug: string;
  name: string;
  nameEn?: string;
  description?: string;
  logoUrl?: string;
  isActive: boolean;
  productCount: number;
  adminCount: number;
  ownerEmail: string;
}

interface ShopDetail {
  id: string;
  slug: string;
  name: string;
  nameEn?: string;
  description?: string;
  descriptionEn?: string;
  logoUrl?: string;
  bannerUrl?: string;
  ownerEmail: string;
  isActive: boolean;
  settings: {
    isOpen: boolean;
    closeDate?: string;
    closedMessage?: string;
    paymentEnabled?: boolean;
  };
  paymentInfo: {
    promptPayId: string;
    bankName: string;
    accountName: string;
    accountNumber: string;
  };
  products: any[];
  contactEmail?: string;
  contactPhone?: string;
  sortOrder: number;
}

interface ShopAdmin {
  id: string;
  shopId: string;
  email: string;
  role: 'owner' | 'admin';
  permissions: Record<string, boolean>;
  addedBy?: string;
  createdAt: string;
}

interface ShopManagementProps {
  showToast: (type: 'success' | 'error' | 'info' | 'warning', message: string) => void;
  isSuperAdmin: boolean;
  userEmail: string;
}

// ==================== THEME ====================
const ADMIN_THEME = {
  gradient: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
  glass: 'rgba(255,255,255,0.03)',
  border: 'rgba(255,255,255,0.08)',
  muted: '#94a3b8',
  accent: '#8b5cf6',
};

const PERM_LABELS: Record<string, string> = {
  canManageProducts: 'จัดการสินค้า',
  canManageOrders: 'จัดการออเดอร์',
  canManagePickup: 'จัดการรับสินค้า',
  canManageTracking: 'ติดตามพัสดุ',
  canManageRefunds: 'จัดการคืนเงิน',
  canManageAnnouncement: 'จัดการประกาศ',
  canManageEvents: 'จัดการอีเวนต์',
  canManageSupport: 'แชทสนับสนุน',
  canManageShop: 'ตั้งค่าร้านค้า',
  canManagePayment: 'ตั้งค่าชำระเงิน',
  canManageShipping: 'ตั้งค่าจัดส่ง',
  canAddAdmins: 'เพิ่มแอดมิน',
};

// ==================== COMPONENT ====================
export default function ShopManagement({ showToast, isSuperAdmin, userEmail }: ShopManagementProps) {
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingShop, setEditingShop] = useState<ShopDetail | null>(null);
  const [adminsShopId, setAdminsShopId] = useState<string | null>(null);
  const [shopAdmins, setShopAdmins] = useState<ShopAdmin[]>([]);
  const [expandedShopId, setExpandedShopId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState<'logo' | 'banner' | null>(null);

  // Create form state
  const [newShop, setNewShop] = useState({
    name: '', nameEn: '', slug: '', description: '', descriptionEn: '',
    promptPayId: '', bankName: '', accountName: '', accountNumber: '',
  });

  // New admin form state
  const [newAdminEmail, setNewAdminEmail] = useState('');

  // ==================== DATA FETCHING ====================
  const fetchShops = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/shops');
      const data = await res.json();
      if (data.status === 'success') {
        setShops(data.shops || []);
      }
    } catch (e) {
      showToast('error', 'โหลดรายชื่อร้านค้าไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { fetchShops(); }, [fetchShops]);

  const fetchShopDetail = async (shopId: string): Promise<ShopDetail | null> => {
    try {
      const res = await fetch(`/api/shops/${shopId}`);
      const data = await res.json();
      return data.status === 'success' ? data.shop : null;
    } catch { return null; }
  };

  const fetchShopAdmins = async (shopId: string) => {
    try {
      const res = await fetch(`/api/shops/${shopId}/admins`);
      const data = await res.json();
      if (data.status === 'success') {
        setShopAdmins(data.admins || []);
        setAdminsShopId(shopId);
      }
    } catch {
      showToast('error', 'โหลดรายชื่อแอดมินไม่สำเร็จ');
    }
  };

  // ==================== IMAGE UPLOAD ====================
  const handleImageUpload = async (file: File, type: 'logo' | 'banner') => {
    if (!file || !editingShop) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('error', 'ไฟล์ต้องมีขนาดไม่เกิน 5MB');
      return;
    }
    if (!file.type.startsWith('image/')) {
      showToast('error', 'กรุณาเลือกไฟล์รูปภาพ');
      return;
    }
    setUploadingImage(type);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const base64Data = base64.split(',')[1];
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base64: base64Data,
          filename: `shop-${type}-${editingShop.id}-${Date.now()}.${file.name.split('.').pop()}`,
          mime: file.type,
        }),
      });
      const data = await res.json();
      if (data.status === 'success' && data.url) {
        setEditingShop(prev => prev ? { ...prev, [type === 'logo' ? 'logoUrl' : 'bannerUrl']: data.url } : null);
        showToast('success', `อัปโหลด${type === 'logo' ? 'โลโก้' : 'แบนเนอร์'}สำเร็จ`);
      } else {
        showToast('error', data.message || 'อัปโหลดไม่สำเร็จ');
      }
    } catch {
      showToast('error', 'เกิดข้อผิดพลาดในการอัปโหลด');
    } finally {
      setUploadingImage(null);
    }
  };

  // ==================== ACTIONS ====================
  const handleCreateShop = async () => {
    if (!newShop.name || !newShop.slug) {
      showToast('error', 'กรุณาระบุชื่อร้านและ URL slug');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/shops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newShop.name,
          nameEn: newShop.nameEn || undefined,
          slug: newShop.slug,
          description: newShop.description || undefined,
          descriptionEn: newShop.descriptionEn || undefined,
          paymentInfo: {
            promptPayId: newShop.promptPayId,
            bankName: newShop.bankName,
            accountName: newShop.accountName,
            accountNumber: newShop.accountNumber,
          },
        }),
      });
      const data = await res.json();
      if (data.status === 'success') {
        showToast('success', `สร้างร้าน "${newShop.name}" สำเร็จ`);
        setCreateOpen(false);
        setNewShop({ name: '', nameEn: '', slug: '', description: '', descriptionEn: '', promptPayId: '', bankName: '', accountName: '', accountNumber: '' });
        fetchShops();
      } else {
        showToast('error', data.message || 'สร้างร้านไม่สำเร็จ');
      }
    } catch {
      showToast('error', 'เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateShop = async () => {
    if (!editingShop) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/shops/${editingShop.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingShop.name,
          nameEn: editingShop.nameEn,
          slug: editingShop.slug,
          description: editingShop.description,
          descriptionEn: editingShop.descriptionEn,
          isActive: editingShop.isActive,
          settings: editingShop.settings,
          paymentInfo: editingShop.paymentInfo,
          contactEmail: editingShop.contactEmail,
          contactPhone: editingShop.contactPhone,
          sortOrder: editingShop.sortOrder,
          logoUrl: editingShop.logoUrl,
          bannerUrl: editingShop.bannerUrl,
        }),
      });
      const data = await res.json();
      if (data.status === 'success') {
        showToast('success', 'บันทึกสำเร็จ');
        setEditingShop(null);
        fetchShops();
      } else {
        showToast('error', data.message || 'บันทึกไม่สำเร็จ');
      }
    } catch {
      showToast('error', 'เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteShop = async (shopId: string, shopName: string) => {
    if (!confirm(`ต้องการลบร้าน "${shopName}" จริงหรือ? การดำเนินการนี้ย้อนกลับไม่ได้`)) return;
    try {
      const res = await fetch(`/api/shops/${shopId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.status === 'success') {
        showToast('success', `ลบร้าน "${shopName}" แล้ว`);
        fetchShops();
      } else {
        showToast('error', data.message || 'ลบไม่สำเร็จ');
      }
    } catch {
      showToast('error', 'เกิดข้อผิดพลาด');
    }
  };

  const handleAddAdmin = async (shopId: string) => {
    if (!newAdminEmail.trim()) return;
    try {
      const res = await fetch(`/api/shops/${shopId}/admins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newAdminEmail.trim() }),
      });
      const data = await res.json();
      if (data.status === 'success') {
        showToast('success', `เพิ่ม ${newAdminEmail.trim()} เป็นแอดมินร้านแล้ว`);
        setNewAdminEmail('');
        fetchShopAdmins(shopId);
      } else {
        showToast('error', data.message || 'เพิ่มแอดมินไม่สำเร็จ');
      }
    } catch {
      showToast('error', 'เกิดข้อผิดพลาด');
    }
  };

  const handleRemoveAdmin = async (shopId: string, email: string) => {
    if (!confirm(`ลบ ${email} ออกจากร้านนี้?`)) return;
    try {
      const res = await fetch(`/api/shops/${shopId}/admins?email=${encodeURIComponent(email)}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.status === 'success') {
        showToast('success', `ลบ ${email} แล้ว`);
        fetchShopAdmins(shopId);
      } else {
        showToast('error', data.message || 'ลบไม่สำเร็จ');
      }
    } catch {
      showToast('error', 'เกิดข้อผิดพลาด');
    }
  };

  const handleTogglePermission = async (shopId: string, email: string, currentPerms: Record<string, boolean>, key: string) => {
    const newPerms = { ...currentPerms, [key]: !currentPerms[key] };
    try {
      const res = await fetch(`/api/shops/${shopId}/admins`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, permissions: newPerms }),
      });
      const data = await res.json();
      if (data.status === 'success') {
        setShopAdmins(prev => prev.map(a => a.email === email ? { ...a, permissions: newPerms } : a));
      }
    } catch {
      showToast('error', 'อัปเดตสิทธิ์ไม่สำเร็จ');
    }
  };

  // ==================== INPUT STYLES ====================
  const inputSx = {
    '& .MuiOutlinedInput-root': {
      borderRadius: '10px',
      bgcolor: 'rgba(255,255,255,0.03)',
      '& fieldset': { borderColor: ADMIN_THEME.border },
      '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
      '&.Mui-focused fieldset': { borderColor: ADMIN_THEME.accent },
    },
    '& .MuiInputLabel-root': { color: ADMIN_THEME.muted },
    '& .MuiInputBase-input': { color: 'var(--foreground)', fontSize: '0.9rem' },
  };

  // ==================== RENDER ====================
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress sx={{ color: ADMIN_THEME.accent }} />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography sx={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: 1 }}>
            <Store size={24} />
            จัดการร้านค้า
          </Typography>
          <Typography sx={{ fontSize: '0.85rem', color: ADMIN_THEME.muted }}>
            สร้างและจัดการร้านค้าแยก (สโมสร, ชุมนุม ฯลฯ)
          </Typography>
        </Box>
        {isSuperAdmin && (
          <Button
            variant="contained"
            startIcon={<Plus size={18} />}
            onClick={() => setCreateOpen(true)}
            sx={{
              background: ADMIN_THEME.gradient,
              borderRadius: '10px',
              textTransform: 'none',
              fontWeight: 700,
            }}
          >
            สร้างร้านค้าใหม่
          </Button>
        )}
      </Box>

      {/* Shop List */}
      {shops.length === 0 ? (
        <Box sx={{
          p: 6, textAlign: 'center', borderRadius: '16px',
          bgcolor: ADMIN_THEME.glass, border: `1px solid ${ADMIN_THEME.border}`,
        }}>
          <Store size={48} color={ADMIN_THEME.muted} />
          <Typography sx={{ mt: 2, color: ADMIN_THEME.muted }}>ยังไม่มีร้านค้า</Typography>
          {isSuperAdmin && (
            <Button
              variant="outlined"
              startIcon={<Plus size={18} />}
              onClick={() => setCreateOpen(true)}
              sx={{ mt: 2, borderColor: ADMIN_THEME.accent, color: ADMIN_THEME.accent, borderRadius: '10px', textTransform: 'none' }}
            >
              สร้างร้านค้าแรก
            </Button>
          )}
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {shops.map((shop) => {
            const isExpanded = expandedShopId === shop.id;
            return (
              <Box key={shop.id} sx={{
                borderRadius: '16px',
                bgcolor: ADMIN_THEME.glass,
                border: `1px solid ${ADMIN_THEME.border}`,
                overflow: 'hidden',
                transition: 'all 0.2s',
              }}>
                {/* Shop Header */}
                <Box
                  onClick={() => setExpandedShopId(isExpanded ? null : shop.id)}
                  sx={{
                    p: 2.5, display: 'flex', alignItems: 'center', gap: 2,
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
                  }}
                >
                  <Avatar
                    src={shop.logoUrl}
                    sx={{ width: 48, height: 48, bgcolor: 'rgba(139,92,246,0.2)', fontSize: '1.3rem' }}
                  >
                    {shop.name[0]}
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography sx={{ fontWeight: 700, color: 'var(--foreground)', fontSize: '1rem' }}>
                        {shop.name}
                      </Typography>
                      <Chip
                        label={shop.isActive ? 'เปิด' : 'ปิด'}
                        size="small"
                        sx={{
                          height: 22,
                          bgcolor: shop.isActive ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                          color: shop.isActive ? '#10b981' : '#ef4444',
                          fontSize: '0.7rem', fontWeight: 700,
                        }}
                      />
                    </Box>
                    <Typography sx={{ fontSize: '0.8rem', color: ADMIN_THEME.muted }}>
                      /shop/{shop.slug} • {shop.productCount} สินค้า
                    </Typography>
                  </Box>
                  {isExpanded ? <ChevronUp size={20} color={ADMIN_THEME.muted} /> : <ChevronDown size={20} color={ADMIN_THEME.muted} />}
                </Box>

                {/* Expanded Actions */}
                {isExpanded && (
                  <Box sx={{ px: 2.5, pb: 2.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <Button
                        size="small"
                        startIcon={<Edit size={14} />}
                        onClick={async () => {
                          const detail = await fetchShopDetail(shop.id);
                          if (detail) setEditingShop(detail);
                        }}
                        sx={{ color: '#60a5fa', textTransform: 'none', fontSize: '0.8rem' }}
                      >
                        แก้ไขร้าน
                      </Button>
                      <Button
                        size="small"
                        startIcon={<Users size={14} />}
                        onClick={() => fetchShopAdmins(shop.id)}
                        sx={{ color: '#a78bfa', textTransform: 'none', fontSize: '0.8rem' }}
                      >
                        จัดการแอดมิน
                      </Button>
                      <Button
                        size="small"
                        startIcon={<ExternalLink size={14} />}
                        onClick={() => window.open(`/shop/${shop.slug}`, '_blank')}
                        sx={{ color: '#34d399', textTransform: 'none', fontSize: '0.8rem' }}
                      >
                        ดูหน้าร้าน
                      </Button>
                      {isSuperAdmin && (
                        <Button
                          size="small"
                          startIcon={<Trash2 size={14} />}
                          onClick={() => handleDeleteShop(shop.id, shop.name)}
                          sx={{ color: '#ef4444', textTransform: 'none', fontSize: '0.8rem' }}
                        >
                          ลบร้าน
                        </Button>
                      )}
                    </Box>

                    {/* Inline Admin Management */}
                    {adminsShopId === shop.id && (
                      <Box sx={{
                        mt: 1, p: 2, borderRadius: '12px',
                        bgcolor: 'rgba(139,92,246,0.05)',
                        border: '1px solid rgba(139,92,246,0.15)',
                      }}>
                        <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: '#a78bfa', mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Users size={16} /> แอดมินร้าน ({shopAdmins.length})
                        </Typography>

                        {/* Add admin */}
                        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                          <TextField
                            size="small"
                            placeholder="อีเมลแอดมินใหม่"
                            value={newAdminEmail}
                            onChange={(e) => setNewAdminEmail(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddAdmin(shop.id)}
                            sx={{ flex: 1, ...inputSx }}
                          />
                          <Button
                            variant="contained"
                            size="small"
                            onClick={() => handleAddAdmin(shop.id)}
                            disabled={!newAdminEmail.trim()}
                            sx={{
                              background: ADMIN_THEME.gradient,
                              borderRadius: '10px',
                              textTransform: 'none',
                              minWidth: 'auto',
                              px: 2,
                            }}
                          >
                            <UserPlus size={16} />
                          </Button>
                        </Box>

                        {/* Admin list */}
                        {shopAdmins.map((admin) => (
                          <Box key={admin.id} sx={{
                            p: 1.5, mb: 1, borderRadius: '10px',
                            bgcolor: 'rgba(255,255,255,0.02)',
                            border: `1px solid ${ADMIN_THEME.border}`,
                          }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                              <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--foreground)', flex: 1 }}>
                                {admin.email}
                              </Typography>
                              <Chip
                                label={admin.role === 'owner' ? 'เจ้าของ' : 'แอดมิน'}
                                size="small"
                                sx={{
                                  height: 20, fontSize: '0.65rem', fontWeight: 700,
                                  bgcolor: admin.role === 'owner' ? 'rgba(251,191,36,0.15)' : 'rgba(139,92,246,0.15)',
                                  color: admin.role === 'owner' ? '#fbbf24' : '#a78bfa',
                                }}
                              />
                              {admin.role !== 'owner' && (
                                <IconButton
                                  size="small"
                                  onClick={() => handleRemoveAdmin(shop.id, admin.email)}
                                  sx={{ color: '#ef4444', p: 0.5 }}
                                >
                                  <Trash2 size={14} />
                                </IconButton>
                              )}
                            </Box>
                            {/* Permissions toggle */}
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                              {Object.entries(PERM_LABELS).map(([key, label]) => (
                                <Chip
                                  key={key}
                                  label={label}
                                  size="small"
                                  onClick={() => handleTogglePermission(shop.id, admin.email, admin.permissions, key)}
                                  sx={{
                                    height: 22, fontSize: '0.65rem', cursor: 'pointer',
                                    bgcolor: admin.permissions[key]
                                      ? 'rgba(16,185,129,0.15)'
                                      : 'rgba(255,255,255,0.05)',
                                    color: admin.permissions[key] ? '#10b981' : '#64748b',
                                    border: `1px solid ${admin.permissions[key] ? 'rgba(16,185,129,0.3)' : 'transparent'}`,
                                    '&:hover': {
                                      bgcolor: admin.permissions[key]
                                        ? 'rgba(16,185,129,0.25)'
                                        : 'rgba(255,255,255,0.1)',
                                    },
                                  }}
                                />
                              ))}
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    )}
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      )}

      {/* ==================== CREATE SHOP DIALOG ==================== */}
      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#1a1a2e',
            color: 'var(--foreground)',
            borderRadius: '16px',
            border: `1px solid ${ADMIN_THEME.border}`,
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Store size={20} /> สร้างร้านค้าใหม่
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '12px !important' }}>
          <TextField
            label="ชื่อร้านค้า *"
            value={newShop.name}
            onChange={(e) => {
              const name = e.target.value;
              setNewShop(prev => ({
                ...prev,
                name,
                // Auto-generate slug from name
                slug: prev.slug || name.toLowerCase().replace(/[^a-z0-9ก-๛]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''),
              }));
            }}
            fullWidth
            sx={inputSx}
          />
          <TextField
            label="ชื่อภาษาอังกฤษ"
            value={newShop.nameEn}
            onChange={(e) => setNewShop(prev => ({ ...prev, nameEn: e.target.value }))}
            fullWidth
            sx={inputSx}
          />
          <TextField
            label="URL Slug * (เช่น smosor, chumnoom-a)"
            value={newShop.slug}
            onChange={(e) => setNewShop(prev => ({ ...prev, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') }))}
            fullWidth
            helperText={newShop.slug ? `จะเข้าถึงได้ที่ /shop/${newShop.slug}` : ''}
            sx={inputSx}
          />
          <TextField
            label="คำอธิบายร้าน"
            value={newShop.description}
            onChange={(e) => setNewShop(prev => ({ ...prev, description: e.target.value }))}
            fullWidth
            multiline
            rows={2}
            sx={inputSx}
          />

          {/* Payment Section */}
          <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: '#a78bfa', mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <DollarSign size={16} /> ข้อมูลการชำระเงิน
          </Typography>
          <TextField
            label="PromptPay ID"
            value={newShop.promptPayId}
            onChange={(e) => setNewShop(prev => ({ ...prev, promptPayId: e.target.value }))}
            fullWidth
            sx={inputSx}
          />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              label="ชื่อธนาคาร"
              value={newShop.bankName}
              onChange={(e) => setNewShop(prev => ({ ...prev, bankName: e.target.value }))}
              fullWidth
              sx={inputSx}
            />
            <TextField
              label="เลขบัญชี"
              value={newShop.accountNumber}
              onChange={(e) => setNewShop(prev => ({ ...prev, accountNumber: e.target.value }))}
              fullWidth
              sx={inputSx}
            />
          </Box>
          <TextField
            label="ชื่อบัญชี"
            value={newShop.accountName}
            onChange={(e) => setNewShop(prev => ({ ...prev, accountName: e.target.value }))}
            fullWidth
            sx={inputSx}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCreateOpen(false)} sx={{ color: ADMIN_THEME.muted, textTransform: 'none' }}>
            ยกเลิก
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateShop}
            disabled={saving || !newShop.name || !newShop.slug}
            startIcon={saving ? <CircularProgress size={16} /> : <Save size={16} />}
            sx={{ background: ADMIN_THEME.gradient, borderRadius: '10px', textTransform: 'none', fontWeight: 700 }}
          >
            สร้างร้าน
          </Button>
        </DialogActions>
      </Dialog>

      {/* ==================== EDIT SHOP DIALOG ==================== */}
      <Dialog
        open={!!editingShop}
        onClose={() => setEditingShop(null)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#1a1a2e',
            color: 'var(--foreground)',
            borderRadius: '16px',
            border: `1px solid ${ADMIN_THEME.border}`,
          },
        }}
      >
        {editingShop && (
          <>
            <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Edit size={20} /> แก้ไขร้าน: {editingShop.name}
            </DialogTitle>
            <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '12px !important' }}>
              {/* Banner & Logo Upload */}
              <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: '#a78bfa', display: 'flex', alignItems: 'center', gap: 1 }}>
                <Image size={16} /> รูปภาพร้านค้า
              </Typography>
              {/* Banner Preview & Upload */}
              <Box sx={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', border: `1px solid ${ADMIN_THEME.border}` }}>
                <Box sx={{
                  height: 120,
                  background: editingShop.bannerUrl
                    ? `url(${editingShop.bannerUrl}) center/cover`
                    : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Button
                    component="label"
                    variant="contained"
                    size="small"
                    disabled={uploadingImage === 'banner'}
                    startIcon={uploadingImage === 'banner' ? <CircularProgress size={14} /> : <Upload size={14} />}
                    sx={{ bgcolor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', textTransform: 'none', borderRadius: '8px', fontSize: '0.75rem' }}
                  >
                    {editingShop.bannerUrl ? 'เปลี่ยนแบนเนอร์' : 'อัปโหลดแบนเนอร์'}
                    <input type="file" hidden accept="image/*" onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'banner')} />
                  </Button>
                </Box>
                {/* Logo overlay */}
                <Box sx={{ position: 'absolute', bottom: -20, left: 16 }}>
                  <Box sx={{ position: 'relative', display: 'inline-block' }}>
                    <Avatar
                      src={editingShop.logoUrl}
                      sx={{ width: 56, height: 56, border: '3px solid #1a1a2e', bgcolor: '#2a2a3e', fontSize: '1.2rem', fontWeight: 700 }}
                    >
                      {editingShop.name[0]}
                    </Avatar>
                    <IconButton
                      component="label"
                      size="small"
                      disabled={uploadingImage === 'logo'}
                      sx={{ position: 'absolute', bottom: -4, right: -4, bgcolor: '#8b5cf6', color: 'white', width: 22, height: 22, '&:hover': { bgcolor: '#7c3aed' } }}
                    >
                      {uploadingImage === 'logo' ? <CircularProgress size={10} sx={{ color: 'white' }} /> : <Upload size={10} />}
                      <input type="file" hidden accept="image/*" onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'logo')} />
                    </IconButton>
                  </Box>
                </Box>
              </Box>
              <Box sx={{ height: 16 }} />

              <TextField
                label="ชื่อร้านค้า"
                value={editingShop.name}
                onChange={(e) => setEditingShop(prev => prev ? { ...prev, name: e.target.value } : null)}
                fullWidth
                sx={inputSx}
              />
              <TextField
                label="ชื่อภาษาอังกฤษ"
                value={editingShop.nameEn || ''}
                onChange={(e) => setEditingShop(prev => prev ? { ...prev, nameEn: e.target.value } : null)}
                fullWidth
                sx={inputSx}
              />
              <TextField
                label="URL Slug"
                value={editingShop.slug}
                onChange={(e) => setEditingShop(prev => prev ? { ...prev, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') } : null)}
                fullWidth
                sx={inputSx}
              />
              <TextField
                label="คำอธิบาย"
                value={editingShop.description || ''}
                onChange={(e) => setEditingShop(prev => prev ? { ...prev, description: e.target.value } : null)}
                fullWidth
                multiline
                rows={2}
                sx={inputSx}
              />

              {/* Active Toggle */}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.5, borderRadius: '10px', bgcolor: 'rgba(255,255,255,0.02)' }}>
                <Typography sx={{ fontSize: '0.9rem', color: 'var(--foreground)' }}>เปิดร้าน</Typography>
                <Switch
                  checked={editingShop.isActive}
                  onChange={(e) => setEditingShop(prev => prev ? { ...prev, isActive: e.target.checked } : null)}
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': { color: '#10b981' },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#10b981' },
                  }}
                />
              </Box>

              {/* Shop Open Toggle */}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.5, borderRadius: '10px', bgcolor: 'rgba(255,255,255,0.02)' }}>
                <Typography sx={{ fontSize: '0.9rem', color: 'var(--foreground)' }}>เปิดรับออเดอร์</Typography>
                <Switch
                  checked={editingShop.settings.isOpen}
                  onChange={(e) => setEditingShop(prev => prev ? { ...prev, settings: { ...prev.settings, isOpen: e.target.checked } } : null)}
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': { color: '#10b981' },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#10b981' },
                  }}
                />
              </Box>

              {/* Payment Info */}
              <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: '#a78bfa', mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <DollarSign size={16} /> ข้อมูลการชำระเงิน
              </Typography>
              <TextField
                label="PromptPay ID"
                value={editingShop.paymentInfo.promptPayId}
                onChange={(e) => setEditingShop(prev => prev ? { ...prev, paymentInfo: { ...prev.paymentInfo, promptPayId: e.target.value } } : null)}
                fullWidth
                sx={inputSx}
              />
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  label="ชื่อธนาคาร"
                  value={editingShop.paymentInfo.bankName}
                  onChange={(e) => setEditingShop(prev => prev ? { ...prev, paymentInfo: { ...prev.paymentInfo, bankName: e.target.value } } : null)}
                  fullWidth
                  sx={inputSx}
                />
                <TextField
                  label="เลขบัญชี"
                  value={editingShop.paymentInfo.accountNumber}
                  onChange={(e) => setEditingShop(prev => prev ? { ...prev, paymentInfo: { ...prev.paymentInfo, accountNumber: e.target.value } } : null)}
                  fullWidth
                  sx={inputSx}
                />
              </Box>
              <TextField
                label="ชื่อบัญชี"
                value={editingShop.paymentInfo.accountName}
                onChange={(e) => setEditingShop(prev => prev ? { ...prev, paymentInfo: { ...prev.paymentInfo, accountName: e.target.value } } : null)}
                fullWidth
                sx={inputSx}
              />
              <TextField
                label="อีเมลติดต่อ"
                value={editingShop.contactEmail || ''}
                onChange={(e) => setEditingShop(prev => prev ? { ...prev, contactEmail: e.target.value } : null)}
                fullWidth
                sx={inputSx}
              />
              <TextField
                label="เบอร์โทรติดต่อ"
                value={editingShop.contactPhone || ''}
                onChange={(e) => setEditingShop(prev => prev ? { ...prev, contactPhone: e.target.value } : null)}
                fullWidth
                sx={inputSx}
              />
              <TextField
                label="ลำดับการแสดง"
                type="number"
                value={editingShop.sortOrder}
                onChange={(e) => setEditingShop(prev => prev ? { ...prev, sortOrder: Number(e.target.value) || 0 } : null)}
                fullWidth
                sx={inputSx}
              />
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={() => setEditingShop(null)} sx={{ color: ADMIN_THEME.muted, textTransform: 'none' }}>
                ยกเลิก
              </Button>
              <Button
                variant="contained"
                onClick={handleUpdateShop}
                disabled={saving}
                startIcon={saving ? <CircularProgress size={16} /> : <Save size={16} />}
                sx={{ background: ADMIN_THEME.gradient, borderRadius: '10px', textTransform: 'none', fontWeight: 700 }}
              >
                บันทึก
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}
