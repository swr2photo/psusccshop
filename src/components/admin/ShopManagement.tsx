'use client';

import { apiFetch, uploadImageApi } from '@/lib/api-client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Store, Plus, Trash2, Edit, Save, Users, ChevronDown, ChevronUp, UserPlus,
  Image, Upload, ExternalLink, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

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

function normalizeShopDetail(shop: ShopDetail): ShopDetail {
  return {
    ...shop,
    settings: {
      isOpen: shop.settings?.isOpen ?? true,
      closeDate: shop.settings?.closeDate,
      closedMessage: shop.settings?.closedMessage,
      paymentEnabled: shop.settings?.paymentEnabled,
    },
    paymentInfo: {
      promptPayId: shop.paymentInfo?.promptPayId || '',
      bankName: shop.paymentInfo?.bankName || '',
      accountName: shop.paymentInfo?.accountName || '',
      accountNumber: shop.paymentInfo?.accountNumber || '',
    },
  };
}

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

const gradientBtnClass =
  'rounded-[10px] bg-gradient-to-br from-indigo-500 to-violet-500 font-bold text-white hover:opacity-90';

export default function ShopManagement({ showToast, isSuperAdmin }: ShopManagementProps) {
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingShop, setEditingShop] = useState<ShopDetail | null>(null);
  const [adminsShopId, setAdminsShopId] = useState<string | null>(null);
  const [shopAdmins, setShopAdmins] = useState<ShopAdmin[]>([]);
  const [expandedShopId, setExpandedShopId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState<'logo' | 'banner' | null>(null);

  const [newShop, setNewShop] = useState({
    name: '', nameEn: '', slug: '', description: '', descriptionEn: '',
    promptPayId: '', bankName: '', accountName: '', accountNumber: '',
  });

  const [newAdminEmail, setNewAdminEmail] = useState('');

  const fetchShops = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/api/shops');
      const data = await res.json();
      if (data.status === 'success') {
        setShops(data.shops || []);
      }
    } catch {
      showToast('error', 'โหลดรายชื่อร้านค้าไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { fetchShops(); }, [fetchShops]);

  const fetchShopDetail = async (shopId: string): Promise<ShopDetail | null> => {
    try {
      const res = await apiFetch(`/api/shops/${shopId}`);
      const data = await res.json();
      return data.status === 'success' ? data.shop : null;
    } catch { return null; }
  };

  const fetchShopAdmins = async (shopId: string) => {
    try {
      const res = await apiFetch(`/api/shops/${shopId}/admins`);
      const data = await res.json();
      if (data.status === 'success') {
        setShopAdmins(data.admins || []);
        setAdminsShopId(shopId);
      } else {
        showToast('error', data.message || 'โหลดรายชื่อแอดมินไม่สำเร็จ');
      }
    } catch {
      showToast('error', 'โหลดรายชื่อแอดมินไม่สำเร็จ');
    }
  };

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
      const res = await uploadImageApi({
        base64: base64Data,
        filename: `shop-${type}-${editingShop.id}-${Date.now()}.${file.name.split('.').pop()}`,
        mime: file.type,
      });
      const data = await res.json();
      const imageUrl = data.data?.url || data.url;
      if (data.status === 'success' && imageUrl) {
        setEditingShop(prev => prev ? { ...prev, [type === 'logo' ? 'logoUrl' : 'bannerUrl']: imageUrl } : null);
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

  const handleCreateShop = async () => {
    if (!newShop.name || !newShop.slug) {
      showToast('error', 'กรุณาระบุชื่อร้านและ URL slug');
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch('/api/shops', {
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
      const res = await apiFetch(`/api/shops/${editingShop.id}`, {
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
      const res = await apiFetch(`/api/shops/${shopId}`, { method: 'DELETE' });
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
      const res = await apiFetch(`/api/shops/${shopId}/admins`, {
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
      const res = await apiFetch(`/api/shops/${shopId}/admins?email=${encodeURIComponent(email)}`, { method: 'DELETE' });
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
      const res = await apiFetch(`/api/shops/${shopId}/admins`, {
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

  const SettingToggle = ({
    title,
    description,
    checked,
    onChange,
  }: {
    title: string;
    description: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
  }) => (
    <div className="flex items-center justify-between gap-2 rounded-[10px] border border-[var(--border)] bg-[var(--card)] p-1.5">
      <div className="min-w-0 flex-1">
        <p className="text-[0.9rem] font-semibold text-[var(--foreground)]">{title}</p>
        <p className="mt-0.5 text-[0.75rem] text-[var(--muted-foreground)]">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} className="shrink-0 data-[state=checked]:bg-emerald-500" />
    </div>
  );

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="size-8 animate-spin text-violet-500" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-1 text-2xl font-extrabold text-[var(--foreground)]">
            <Store className="size-6" />
            จัดการร้านค้า
          </h2>
          <p className="text-[0.85rem] text-[var(--muted-foreground)]">
            สร้างและจัดการร้านค้าแยก (สโมสร, ชุมนุม ฯลฯ)
          </p>
        </div>
        {isSuperAdmin && (
          <Button className={gradientBtnClass} onClick={() => setCreateOpen(true)}>
            <Plus className="size-[18px]" />
            สร้างร้านค้าใหม่
          </Button>
        )}
      </div>

      {shops.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 text-center">
          <Store className="mx-auto size-12 text-[var(--muted-foreground)]" />
          <p className="mt-2 text-[var(--muted-foreground)]">ยังไม่มีร้านค้า</p>
          {isSuperAdmin && (
            <Button variant="outline" className="mt-2 rounded-[10px] border-violet-500 text-violet-500" onClick={() => setCreateOpen(true)}>
              <Plus className="size-[18px]" />
              สร้างร้านค้าแรก
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {shops.map((shop) => {
            const isExpanded = expandedShopId === shop.id;
            return (
              <div key={shop.id} className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] transition-all">
                <div
                  onClick={() => setExpandedShopId(isExpanded ? null : shop.id)}
                  className="flex cursor-pointer items-center gap-2 p-2.5 hover:bg-[var(--card)]/80"
                >
                  <Avatar className="size-12">
                    <AvatarImage src={shop.logoUrl} />
                    <AvatarFallback className="bg-violet-500/20 text-[1.3rem]">{shop.name[0]}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <span className="text-base font-bold text-[var(--foreground)]">{shop.name}</span>
                      <Badge
                        className="h-[22px] text-[0.7rem] font-bold"
                        style={{
                          backgroundColor: shop.isActive ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                          color: shop.isActive ? 'var(--success)' : 'var(--error)',
                          borderColor: 'transparent',
                        }}
                      >
                        {shop.isActive ? 'เปิด' : 'ปิด'}
                      </Badge>
                    </div>
                    <p className="text-[0.8rem] text-[var(--muted-foreground)]">
                      /shop/{shop.slug} • {shop.productCount} สินค้า
                    </p>
                  </div>
                  {isExpanded ? <ChevronUp className="size-5 text-[var(--muted-foreground)]" /> : <ChevronDown className="size-5 text-[var(--muted-foreground)]" />}
                </div>

                {isExpanded && (
                  <div className="flex flex-col gap-1.5 px-2.5 pb-2.5">
                    <div className="flex flex-wrap gap-1">
                      <Button variant="ghost" size="sm" className="text-[0.8rem] text-blue-400" onClick={async () => {
                        const detail = await fetchShopDetail(shop.id);
                        if (detail) setEditingShop(normalizeShopDetail(detail));
                      }}>
                        <Edit className="size-[14px]" />
                        แก้ไขร้าน
                      </Button>
                      <Button variant="ghost" size="sm" className="text-[0.8rem] text-violet-400" onClick={() => fetchShopAdmins(shop.id)}>
                        <Users className="size-[14px]" />
                        จัดการแอดมิน
                      </Button>
                      <Button variant="ghost" size="sm" className="text-[0.8rem] text-emerald-400" onClick={() => window.open(`/shop/${shop.slug}`, '_blank')}>
                        <ExternalLink className="size-[14px]" />
                        ดูหน้าร้าน
                      </Button>
                      {isSuperAdmin && (
                        <Button variant="ghost" size="sm" className="text-[0.8rem] text-[var(--error)]" onClick={() => handleDeleteShop(shop.id, shop.name)}>
                          <Trash2 className="size-[14px]" />
                          ลบร้าน
                        </Button>
                      )}
                    </div>

                    {adminsShopId === shop.id && (
                      <div className="mt-1 rounded-xl border border-violet-500/15 bg-[var(--card)] p-2">
                        <p className="mb-1.5 flex items-center gap-1 text-[0.9rem] font-bold text-violet-400">
                          <Users className="size-4" /> แอดมินร้าน ({shopAdmins.length})
                        </p>

                        <div className="mb-2 flex gap-1">
                          <Input
                            placeholder="อีเมลแอดมินใหม่"
                            value={newAdminEmail}
                            onChange={(e) => setNewAdminEmail(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddAdmin(shop.id)}
                            className="flex-1"
                          />
                          <Button className={cn(gradientBtnClass, 'px-2')} onClick={() => handleAddAdmin(shop.id)} disabled={!newAdminEmail.trim()}>
                            <UserPlus className="size-4" />
                          </Button>
                        </div>

                        {shopAdmins.map((admin) => (
                          <div key={admin.id} className="mb-1 rounded-[10px] border border-[var(--border)] bg-[var(--card)] p-1.5">
                            <div className="mb-1 flex items-center gap-1">
                              <span className="flex-1 text-[0.85rem] font-semibold text-[var(--foreground)]">{admin.email}</span>
                              <Badge
                                className="h-5 text-[0.65rem] font-bold"
                                style={{
                                  backgroundColor: admin.role === 'owner' ? 'rgba(251,191,36,0.15)' : 'rgba(139,92,246,0.15)',
                                  color: admin.role === 'owner' ? '#fbbf24' : '#a78bfa',
                                  borderColor: 'transparent',
                                }}
                              >
                                {admin.role === 'owner' ? 'เจ้าของ' : 'แอดมิน'}
                              </Badge>
                              {admin.role !== 'owner' && (
                                <Button variant="ghost" size="icon" className="size-7 text-[var(--error)]" onClick={() => handleRemoveAdmin(shop.id, admin.email)}>
                                  <Trash2 className="size-[14px]" />
                                </Button>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-0.5">
                              {Object.entries(PERM_LABELS).map(([key, label]) => (
                                <Badge
                                  key={key}
                                  className={cn(
                                    'h-[22px] cursor-pointer text-[0.65rem] hover:opacity-80',
                                    admin.permissions[key]
                                      ? 'border-emerald-500/30 bg-emerald-500/15 text-[var(--success)]'
                                      : 'border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)]'
                                  )}
                                  onClick={() => handleTogglePermission(shop.id, admin.email, admin.permissions, key)}
                                >
                                  {label}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md border-[var(--border)] bg-[var(--card)] text-[var(--foreground)]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1 font-bold">
              <Store className="size-5" /> สร้างร้านค้าใหม่
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2 pt-1">
            <div>
              <Label>ชื่อร้านค้า *</Label>
              <Input
                value={newShop.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setNewShop(prev => ({
                    ...prev,
                    name,
                    slug: prev.slug || name.toLowerCase().replace(/[^a-z0-9ก-๛]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''),
                  }));
                }}
              />
            </div>
            <div>
              <Label>ชื่อภาษาอังกฤษ</Label>
              <Input value={newShop.nameEn} onChange={(e) => setNewShop(prev => ({ ...prev, nameEn: e.target.value }))} />
            </div>
            <div>
              <Label>URL Slug * (เช่น smosor, chumnoom-a)</Label>
              <Input
                value={newShop.slug}
                onChange={(e) => setNewShop(prev => ({ ...prev, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') }))}
              />
              {newShop.slug && (
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">จะเข้าถึงได้ที่ /shop/{newShop.slug}</p>
              )}
            </div>
            <div>
              <Label>คำอธิบาย (ไทย)</Label>
              <Textarea rows={2} value={newShop.description} onChange={(e) => setNewShop(prev => ({ ...prev, description: e.target.value }))} />
            </div>
            <div>
              <Label>คำอธิบาย (อังกฤษ)</Label>
              <Textarea rows={2} value={newShop.descriptionEn} onChange={(e) => setNewShop(prev => ({ ...prev, descriptionEn: e.target.value }))} />
            </div>
            <div className="rounded-[10px] border border-[var(--border)] bg-indigo-500/8 p-1.5">
              <p className="text-[0.78rem] leading-snug text-[var(--muted-foreground)]">
                การชำระเงินใช้บัญชี PromptPay ของร้านหลัก (SCC Shop) ร่วมกัน — ไม่ต้องตั้งค่าแยกต่อร้านย่อย
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)} className="text-[var(--muted-foreground)]">ยกเลิก</Button>
            <Button className={gradientBtnClass} onClick={handleCreateShop} disabled={saving || !newShop.name || !newShop.slug}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              สร้างร้าน
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingShop} onOpenChange={(open) => !open && setEditingShop(null)}>
        <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto border-[var(--border)] bg-[var(--card)] text-[var(--foreground)]">
          {editingShop && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-1 font-bold">
                  <Edit className="size-5" /> แก้ไขร้าน: {editingShop.name}
                </DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-2 pt-1">
                <p className="flex items-center gap-1 text-[0.9rem] font-bold text-blue-600">
                  <Image className="size-4" /> รูปภาพร้านค้า
                </p>

                <div>
                  <Label className="mb-0.75 text-[0.8rem]">รูปปกร้าน (แบนเนอร์)</Label>
                  <label
                    className={cn(
                      'relative block h-40 cursor-pointer overflow-hidden rounded-xl border-2 border-dashed bg-[var(--card)] transition-colors hover:border-blue-600',
                      editingShop.bannerUrl ? 'border-blue-600' : 'border-[var(--border)]',
                      uploadingImage === 'banner' && 'cursor-wait'
                    )}
                    style={editingShop.bannerUrl ? { backgroundImage: `url(${editingShop.bannerUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
                  >
                    <input
                      type="file"
                      hidden
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      disabled={uploadingImage === 'banner'}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(file, 'banner');
                        e.target.value = '';
                      }}
                    />
                    <div className={cn(
                      'absolute inset-0 flex flex-col items-center justify-center gap-1',
                      editingShop.bannerUrl ? 'bg-black/35 text-white' : 'text-[var(--muted-foreground)]'
                    )}>
                      {uploadingImage === 'banner' ? (
                        <Loader2 className="size-7 animate-spin" />
                      ) : (
                        <>
                          <Upload className="size-7" strokeWidth={1.75} />
                          <span className="text-[0.85rem] font-semibold">
                            {editingShop.bannerUrl ? 'คลิกเพื่อเปลี่ยนรูปปก' : 'คลิกเพื่อแนบรูปปกร้าน'}
                          </span>
                          <span className="text-[0.72rem] opacity-85">JPG, PNG, WebP — สูงสุด 5MB</span>
                        </>
                      )}
                    </div>
                  </label>
                </div>

                <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] p-1.5">
                  <Avatar className="size-16 border-2 border-[var(--border)]">
                    <AvatarImage src={editingShop.logoUrl} />
                    <AvatarFallback className="text-xl font-bold text-blue-600">{editingShop.name[0]}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <Label className="mb-0.5 text-[0.8rem]">โลโก้ร้าน</Label>
                    <Button variant="outline" size="sm" disabled={uploadingImage === 'logo'} asChild className="rounded-lg">
                      <label className="cursor-pointer">
                        {uploadingImage === 'logo' ? <Loader2 className="size-[14px] animate-spin" /> : <Upload className="size-[14px]" />}
                        {editingShop.logoUrl ? 'เปลี่ยนโลโก้' : 'แนบรูปโลโก้'}
                        <input
                          type="file"
                          hidden
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleImageUpload(file, 'logo');
                            e.target.value = '';
                          }}
                        />
                      </label>
                    </Button>
                  </div>
                </div>

                <div><Label>ชื่อร้านค้า</Label><Input value={editingShop.name} onChange={(e) => setEditingShop(prev => prev ? { ...prev, name: e.target.value } : null)} /></div>
                <div><Label>ชื่อภาษาอังกฤษ</Label><Input value={editingShop.nameEn || ''} onChange={(e) => setEditingShop(prev => prev ? { ...prev, nameEn: e.target.value } : null)} /></div>
                <div><Label>URL Slug</Label><Input value={editingShop.slug} onChange={(e) => setEditingShop(prev => prev ? { ...prev, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') } : null)} /></div>
                <div><Label>คำอธิบาย (ไทย)</Label><Textarea rows={2} value={editingShop.description || ''} onChange={(e) => setEditingShop(prev => prev ? { ...prev, description: e.target.value } : null)} /></div>
                <div><Label>คำอธิบาย (อังกฤษ)</Label><Textarea rows={2} value={editingShop.descriptionEn || ''} onChange={(e) => setEditingShop(prev => prev ? { ...prev, descriptionEn: e.target.value } : null)} /></div>

                <p className="mt-0.5 flex items-center gap-1 text-[0.9rem] font-bold text-blue-600">สถานะร้าน</p>
                <SettingToggle title="แสดงร้านบนเว็บ" description="ปิด = ซ่อนร้านจากหน้าร้านหลักและ /shop/slug" checked={editingShop.isActive} onChange={(checked) => setEditingShop(prev => prev ? { ...prev, isActive: checked } : null)} />
                <SettingToggle title="เปิดรับออเดอร์" description="ปิด = ลูกค้ายังดูสินค้าได้ แต่สั่งซื้อไม่ได้" checked={editingShop.settings.isOpen} onChange={(checked) => setEditingShop(prev => prev ? { ...prev, settings: { ...prev.settings, isOpen: checked } } : null)} />
                {!editingShop.settings.isOpen && (
                  <div>
                    <Label>ข้อความเมื่อปิดรับออเดอร์</Label>
                    <Textarea rows={2} placeholder="เช่น ปิดรับออเดอร์ชั่วคราว" value={editingShop.settings.closedMessage || ''} onChange={(e) => setEditingShop(prev => prev ? { ...prev, settings: { ...prev.settings, closedMessage: e.target.value } } : null)} />
                  </div>
                )}

                <p className="mt-1 flex items-center gap-1 text-[0.9rem] font-bold text-blue-600"><Users className="size-4" /> ข้อมูลติดต่อ</p>
                <div><Label>อีเมลติดต่อ</Label><Input value={editingShop.contactEmail || ''} onChange={(e) => setEditingShop(prev => prev ? { ...prev, contactEmail: e.target.value } : null)} /></div>
                <div><Label>เบอร์โทรติดต่อ</Label><Input value={editingShop.contactPhone || ''} onChange={(e) => setEditingShop(prev => prev ? { ...prev, contactPhone: e.target.value } : null)} /></div>

                <p className="mt-1 flex items-center gap-1 text-[0.9rem] font-bold text-blue-600"><Store className="size-4" /> การแสดงผล</p>
                <div>
                  <Label>ลำดับการแสดง (น้อย = ขึ้นก่อน)</Label>
                  <Input type="number" value={editingShop.sortOrder} onChange={(e) => setEditingShop(prev => prev ? { ...prev, sortOrder: Number(e.target.value) || 0 } : null)} />
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">ใช้เรียงร้านย่อยบนหน้าร้านหลัก</p>
                </div>
                <div className="rounded-[10px] border border-[var(--border)] bg-indigo-500/8 p-1.5">
                  <p className="text-[0.78rem] leading-snug text-[var(--muted-foreground)]">
                    การชำระเงินใช้บัญชี PromptPay ของร้านหลัก (SCC Shop) ร่วมกัน — ไม่ต้องตั้งค่าแยกต่อร้านย่อย
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setEditingShop(null)} className="text-[var(--muted-foreground)]">ยกเลิก</Button>
                <Button className={gradientBtnClass} onClick={handleUpdateShop} disabled={saving}>
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  บันทึก
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
