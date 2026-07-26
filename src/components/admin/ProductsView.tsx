'use client';

import React, { useState, useEffect, useMemo } from 'react';
import type { JSX } from 'react';
import {
  Plus as Add,
  Trash2 as Delete,
  Pencil as Edit,
  X as Close,
  Search,
  History,
  XCircle as Clear,
  Check,
  Clock as AccessTime,
  CircleDot as FiberManualRecord,
  Calendar as CalendarToday,
  ShoppingBag as LocalMall,
  Save,
  Package as Inventory,
  Settings,
  CalendarRange as DateRange,
  Image as ImageIcon,
  Eye as Visibility,
  EyeOff as VisibilityOff,
  Tag as LocalOffer,
  Shirt,
  Gift,
  Tent,
  Ticket,
  Wrench,
  Palette,
  Target as Crosshair,
  CalendarDays,
  StickyNote,
  Loader2,
} from 'lucide-react';

import {
  Product,
  ShopConfig,
  SIZES,
  getProductShirtNameConfig,
  validatePrice,
} from '@/lib/config';
import { apiFetch } from '@/lib/api-client';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import ShirtNameConfigFields from '@/components/admin/ShirtNameConfigFields';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ============== CONSTANTS ==============
const PRODUCT_CATEGORIES = ['APPAREL', 'MERCHANDISE', 'CAMP_FEE', 'EVENT', 'SERVICE', 'OTHER'] as const;
const PRODUCT_SUBTYPES: Record<string, string[]> = {
  APPAREL: ['JERSEY', 'CREW', 'HOODIE', 'TSHIRT', 'POLO', 'JACKET', 'CAP'],
  MERCHANDISE: ['STICKER', 'KEYCHAIN', 'MUG', 'BADGE', 'POSTER', 'NOTEBOOK'],
  CAMP_FEE: ['CAMP_REGISTRATION'],
  EVENT: ['EVENT_TICKET'],
  SERVICE: ['CUSTOM'],
  OTHER: ['OTHER'],
};

const CATEGORY_LABELS: Record<string, string> = {
  APPAREL: 'เสื้อผ้า',
  MERCHANDISE: 'ของที่ระลึก',
  CAMP_FEE: 'ค่าสมัครค่าย',
  EVENT: 'กิจกรรม/อีเวนต์',
  SERVICE: 'บริการ',
  OTHER: 'อื่นๆ',
};

const SUBTYPE_LABELS: Record<string, string> = {
  JERSEY: 'เสื้อกีฬา',
  CREW: 'เสื้อ Crew',
  HOODIE: 'ฮู้ดดี้',
  TSHIRT: 'เสื้อยืด',
  POLO: 'เสื้อโปโล',
  JACKET: 'แจ็กเก็ต',
  CAP: 'หมวก',
  STICKER: 'สติกเกอร์',
  KEYCHAIN: 'พวงกุญแจ',
  MUG: 'แก้ว',
  BADGE: 'เข็มกลัด/ตรา',
  POSTER: 'โปสเตอร์',
  NOTEBOOK: 'สมุด',
  CAMP_REGISTRATION: 'ค่าสมัครค่าย',
  EVENT_TICKET: 'ตั๋วเข้างาน',
  CUSTOM: 'กำหนดเอง',
  OTHER: 'อื่นๆ',
};

const CATEGORY_ICON_COMPONENTS: Record<string, React.ReactNode> = {
  APPAREL: <Shirt size={16} />,
  MERCHANDISE: <Gift size={16} />,
  CAMP_FEE: <Tent size={16} />,
  EVENT: <Ticket size={16} />,
  SERVICE: <Wrench size={16} />,
  OTHER: <Inventory size={16} />,
};

const glassCardClass =
  // overflow-visible so native datetime-local / select menus are not clipped
  'rounded-[20px] border border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--foreground)] shadow-[0_8px_32px_rgba(0,0,0,0.12)] backdrop-blur-[20px]';

const gradientBtnClass =
  'rounded-[10px] bg-gradient-to-br from-indigo-500 to-violet-500 font-bold text-white shadow-[0_4px_15px_rgba(139,92,246,0.3)] hover:opacity-90';

const inputClass = 'rounded-[10px] w-full';

const sectionClass =
  'flex flex-col gap-3 rounded-lg border border-[var(--glass-border)] bg-[var(--surface-2)] p-4';

// ============== HELPERS ==============
function toDateTimeLocal(dateInput?: Date | string | null): string {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

function sanitizeInput(str?: string): string {
  if (!str) return '';
  return str.trim();
}

function useIsMobile(breakpoint = 600): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [breakpoint]);
  return isMobile;
}

const isProductOpen = (product: Product): { isOpen: boolean; status: 'upcoming' | 'active' | 'ended' | 'always' } => {
  const now = new Date();
  const start = product.startDate ? new Date(product.startDate) : null;
  const end = product.endDate ? new Date(product.endDate) : null;

  if (!start && !end) return { isOpen: !!product.isActive, status: 'always' };
  if (start && now < start) return { isOpen: false, status: 'upcoming' };
  if (end && now > end) return { isOpen: false, status: 'ended' };
  return { isOpen: !!product.isActive, status: 'active' };
};

const formatDateTime = (dateStr: string | undefined): string => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleString('th-TH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// ============== TYPES ==============
type AdminOrder = Record<string, unknown>;

export interface ProductsViewProps {
  config: ShopConfig;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  saveFullConfig: (config: ShopConfig) => void;
  showToast: (type: 'success' | 'error' | 'info' | 'warning', message: string) => void;
  addLog: (action: string, detail: string, overrides?: { config?: ShopConfig; orders?: any[] }) => void;
  saving: boolean;
}

interface ProductPickupSettings {
  enabled: boolean;
  location?: string;
  startDate?: string;
  endDate?: string;
  notes?: string;
  updatedBy?: string;
  updatedAt?: string;
}

// ============== PRODUCT CARD ==============
const ProductCardItem = ({
  product,
  onEdit,
  onDelete,
  onToggle,
  onPickupSetting,
}: {
  product: Product;
  onEdit: () => void;
  onDelete: () => void;
  onToggle?: () => void;
  onPickupSetting?: () => void;
}): JSX.Element => {
  const { isOpen, status } = isProductOpen(product);

  const statusConfig = {
    upcoming: { label: 'รอเปิด', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', icon: <AccessTime size={12} /> },
    active: { label: 'กำลังขาย', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', icon: <FiberManualRecord size={10} className="text-green-500" /> },
    ended: { label: 'หมดเวลา', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', icon: <FiberManualRecord size={10} className="text-red-500" /> },
    always: {
      label: product.isActive ? 'เปิดขาย' : 'ปิดขาย',
      color: product.isActive ? '#10b981' : '#64748b',
      bg: product.isActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(100, 116, 139, 0.15)',
      icon: product.isActive ? <Check size={12} /> : <Close size={12} />,
    },
  };

  const currentStatus = statusConfig[status];
  const coverBg = product.coverImage
    ? `url(${product.coverImage})`
    : product.images?.[0]
      ? `url(${product.images[0]})`
      : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)';

  return (
    <Card className={cn(glassCardClass, 'flex h-full flex-col gap-0 py-0')}>
      <div
        className="relative flex h-[150px] items-center justify-center overflow-hidden border-b border-[var(--glass-border)] bg-[var(--surface-2)] bg-cover bg-center"
        style={{ backgroundImage: coverBg }}
      >
        <div
          className="absolute left-2 top-2 flex items-center gap-1 rounded-lg px-2 py-0.5 backdrop-blur-md"
          style={{ backgroundColor: currentStatus.bg, border: `1px solid ${currentStatus.color}40` }}
        >
          <span className="flex items-center gap-1 text-[0.7rem] font-bold" style={{ color: currentStatus.color }}>
            {currentStatus.icon} {currentStatus.label}
          </span>
        </div>

        {(product.startDate || product.endDate) && (
          <div className="absolute right-2 top-2 rounded-md bg-black/60 px-2 py-0.5 backdrop-blur-md">
            <span className="flex items-center gap-1 text-[0.65rem] text-[var(--foreground)]">
              <CalendarToday size={12} />
              {product.startDate ? formatDateTime(product.startDate).split(' ')[0] : '...'} -{' '}
              {product.endDate ? formatDateTime(product.endDate).split(' ')[0] : '...'}
            </span>
          </div>
        )}

        {!isOpen && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <span
              className="text-sm font-bold uppercase"
              style={{ color: status === 'upcoming' ? '#f59e0b' : '#ff6b6b' }}
            >
              {status === 'upcoming' ? 'Coming Soon' : status === 'ended' ? 'Ended' : 'Inactive'}
            </span>
          </div>
        )}
      </div>

      <CardContent className="flex flex-1 flex-col gap-3 px-4 py-4">
        <p className="text-sm font-bold text-[var(--foreground)]">{product.name}</p>
        <p className="text-xs text-[var(--text-muted)]">{product.type}</p>
        <p className="text-lg font-bold text-emerald-500">฿{product.basePrice}</p>

        <div className="flex flex-col gap-2">
          <Button variant="outline" size="sm" onClick={onEdit} className="w-full border-[var(--glass-border)]">
            <Edit size={16} className="mr-1" /> แก้ไข
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onDelete}
            className="w-full border-red-500/45 text-red-400 hover:bg-red-500/10"
          >
            <Delete size={16} className="mr-1" /> ลบ
          </Button>
        </div>

        {onToggle && (
          <div className="mt-1 flex items-center justify-between rounded-lg border border-[var(--glass-border)] bg-white/[0.03] p-2">
            <span className="text-xs font-semibold text-[var(--text-muted)]">เปิด/ปิดขาย</span>
            <Switch
              checked={product.isActive}
              onCheckedChange={onToggle}
              className="data-[state=checked]:bg-emerald-500"
            />
          </div>
        )}

        {onPickupSetting && (
          <Button
            variant="outline"
            size="sm"
            onClick={onPickupSetting}
            className={cn(
              'mt-1 w-full text-xs',
              product.pickup?.enabled
                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500'
                : 'border-[var(--glass-border)] text-[var(--text-muted)]'
            )}
          >
            <LocalMall size={16} className="mr-1" />
            {product.pickup?.enabled ? '✓ รับสินค้า' : 'ตั้งค่ารับสินค้า'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

// ============== PRODUCT PICKUP DIALOG ==============
const ProductPickupDialog = ({
  product,
  onClose,
  saving,
  onSave,
}: {
  product: Product;
  onClose: () => void;
  saving: boolean;
  onSave: (pickup: ProductPickupSettings, autoUpdateOrders: boolean) => Promise<void>;
}): JSX.Element => {
  const [pickup, setPickup] = useState<ProductPickupSettings>({
    enabled: product.pickup?.enabled || false,
    location: product.pickup?.location || '',
    startDate: product.pickup?.startDate || '',
    endDate: product.pickup?.endDate || '',
    notes: product.pickup?.notes || '',
  });
  const [autoUpdateOrders, setAutoUpdateOrders] = useState(true);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="flex max-h-[90vh] max-w-lg flex-col gap-0 overflow-hidden rounded-2xl border-[var(--glass-border)] bg-[var(--glass-bg)] p-0 text-[var(--foreground)]">
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-visible p-6">
        <DialogHeader className="border-b border-[var(--glass-border)] pb-4">
          <DialogTitle className="flex items-center gap-3 text-left">
            <LocalMall className="text-cyan-400" />
            <div>
              <p className="font-bold">ตั้งค่ารับสินค้า</p>
              <p className="text-sm font-normal text-[var(--text-muted)]">{product.name}</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div
            className={cn(
              'flex items-center justify-between rounded-xl p-4',
              pickup.enabled
                ? 'border border-emerald-500/30 bg-emerald-500/10'
                : 'border border-[var(--glass-border)] bg-white/[0.03]'
            )}
          >
            <div>
              <p className="font-semibold">เปิดรับสินค้า</p>
              <p className="text-sm text-[var(--text-muted)]">
                {pickup.enabled ? 'ลูกค้าสามารถมารับสินค้าได้' : 'ยังไม่เปิดรับสินค้า'}
              </p>
            </div>
            <Switch
              checked={pickup.enabled}
              onCheckedChange={(checked) => setPickup({ ...pickup, enabled: checked })}
              className="data-[state=checked]:bg-emerald-500"
            />
          </div>

          {pickup.enabled && (
            <div className="flex flex-col gap-4">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1 text-cyan-400">
                  <Crosshair size={14} /> สถานที่รับสินค้า
                </Label>
                <Input
                  className={inputClass}
                  placeholder="เช่น: ห้อง 123 ตึก A คณะวิศวกรรมศาสตร์"
                  value={pickup.location}
                  onChange={(e) => setPickup({ ...pickup, location: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1 text-cyan-400">
                    <CalendarDays size={14} /> วันเริ่มรับสินค้า
                  </Label>
                  <Input
                    type="datetime-local"
                    className={inputClass}
                    value={pickup.startDate}
                    onChange={(e) => setPickup({ ...pickup, startDate: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1 text-cyan-400">
                    <CalendarDays size={14} /> วันสิ้นสุดรับสินค้า
                  </Label>
                  <Input
                    type="datetime-local"
                    className={inputClass}
                    value={pickup.endDate}
                    onChange={(e) => setPickup({ ...pickup, endDate: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="flex items-center gap-1 text-cyan-400">
                  <StickyNote size={14} /> หมายเหตุเพิ่มเติม
                </Label>
                <Textarea
                  className={inputClass}
                  placeholder="เช่น: กรุณานำบัตรนักศึกษามาด้วย"
                  value={pickup.notes}
                  onChange={(e) => setPickup({ ...pickup, notes: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-4">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="auto-update-orders"
                    checked={autoUpdateOrders}
                    onCheckedChange={(checked) => setAutoUpdateOrders(checked === true)}
                    className="mt-0.5 border-indigo-400 data-[state=checked]:bg-indigo-500"
                  />
                  <div>
                    <Label htmlFor="auto-update-orders" className="cursor-pointer font-semibold">
                      อัปเดตออเดอร์ที่จ่ายแล้วเป็น &quot;พร้อมรับ&quot; อัตโนมัติ
                    </Label>
                    <p className="text-xs text-[var(--text-muted)]">
                      ออเดอร์สถานะ PAID ที่มีสินค้านี้จะเปลี่ยนเป็น READY ทันที
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        </div>

        <DialogFooter className="gap-2 border-t border-[var(--glass-border)] p-6 pt-4">
          <Button variant="ghost" onClick={onClose} className="text-[var(--text-muted)]">
            ยกเลิก
          </Button>
          <Button onClick={() => onSave(pickup, autoUpdateOrders)} disabled={saving} className={gradientBtnClass}>
            {saving ? <Loader2 size={16} className="mr-1 animate-spin" /> : <Save size={16} className="mr-1" />}
            {saving ? 'กำลังบันทึก...' : 'บันทึก'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const ProductEditDialog = ({
  product,
  onClose,
  onChange,
  onSave,
  isSaving,
  showToast,
}: {
  product: Product;
  onClose: () => void;
  onChange: (p: Product) => void;
  onSave: (mode?: 'publish' | 'draft') => void;
  isSaving: boolean;
  showToast?: (type: 'success' | 'error' | 'info' | 'warning', message: string) => void;
}): JSX.Element => {
  const [newSizeKey, setNewSizeKey] = useState('');
  const [newSizePrice, setNewSizePrice] = useState<number | ''>('');
  const [coverUploadLoading, setCoverUploadLoading] = useState(false);
  const [newVariantName, setNewVariantName] = useState('');
  const [newVariantPrice, setNewVariantPrice] = useState<number | ''>('');
  const [newVariantStock, setNewVariantStock] = useState<number | ''>('');
  const [newPatternName, setNewPatternName] = useState('');
  const [newPatternImage, setNewPatternImage] = useState('');
  const [newTagText, setNewTagText] = useState('');
  const [newTagColor, setNewTagColor] = useState('#10b981');
  const MAX_IMAGE_SIZE = 3 * 1024 * 1024;

  const productAny = product as Product & Record<string, unknown>;
  const isMobileDevice = useIsMobile(600);

  const needsVariants = () => {
    const category = productAny.category as string | undefined;
    return category && category !== 'APPAREL';
  };

  useEffect(() => {
    if (product && !product.coverImage && Array.isArray(product.images) && product.images.length > 0) {
      onChange({ ...product, coverImage: product.images[0] });
    }
  }, [product, onChange]);

  const filterValidFiles = (files: FileList | null) => {
    if (!files) return [];
    return Array.from(files).filter((file) => file.type.startsWith('image/') && file.size <= MAX_IMAGE_SIZE);
  };

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleAddVariant = () => {
    if (!newVariantName.trim()) return;
    const newVariant = {
      id: `var_${Date.now()}`,
      name: newVariantName.trim(),
      price: typeof newVariantPrice === 'number' ? newVariantPrice : product.basePrice || 0,
      stock: typeof newVariantStock === 'number' ? newVariantStock : null,
      isActive: true,
    };
    const variants = [...((productAny.variants as unknown[]) || []), newVariant];
    onChange({ ...product, variants } as unknown as Product);
    setNewVariantName('');
    setNewVariantPrice('');
    setNewVariantStock('');
  };

  const handleUpdateVariant = (variantId: string, field: string, value: unknown) => {
    const variants = ((productAny.variants as unknown as Array<Record<string, unknown>>) || []).map((v) =>
      v.id === variantId ? { ...v, [field]: value } : v
    );
    onChange({ ...product, variants } as unknown as Product);
  };

  const handleRemoveVariant = (variantId: string) => {
    const variants = ((productAny.variants as unknown as Array<{ id: string }>) || []).filter((v) => v.id !== variantId);
    onChange({ ...product, variants } as unknown as Product);
  };

  const handleAddPattern = () => {
    if (!newPatternName.trim()) return;
    const names = newPatternName.split(/[\n,;]+/).map((n) => n.trim()).filter((n) => n.length > 0);
    if (names.length === 0) return;
    const newPatterns = names.map((name, index) => ({
      id: `pat_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 6)}`,
      name,
      image: index === 0 && newPatternImage ? newPatternImage : undefined,
      isActive: true,
    }));
    const patterns = [...((productAny.patterns as unknown[]) || []), ...newPatterns];
    onChange({ ...product, patterns } as unknown as Product);
    setNewPatternName('');
    setNewPatternImage('');
    if (names.length > 1) showToast?.('success', `เพิ่มสำเร็จ ${names.length} ลาย`);
  };

  const handleUpdatePattern = (patternId: string, field: string, value: unknown) => {
    const patterns = ((productAny.patterns as unknown as Array<Record<string, unknown>>) || []).map((p) =>
      p.id === patternId ? { ...p, [field]: value } : p
    );
    onChange({ ...product, patterns } as unknown as Product);
  };

  const handleRemovePattern = (patternId: string) => {
    const allPatterns = (productAny.patterns as Array<{ id: string; image?: string }>) || [];
    const removed = allPatterns.find((p) => p.id === patternId);
    const patterns = allPatterns.filter((p) => p.id !== patternId);
    const nextCover =
      removed?.image && removed.image === product.coverImage
        ? (product.images || []).find((img) => img !== removed.image) || ''
        : product.coverImage;
    onChange({ ...product, patterns, coverImage: nextCover } as Product);
  };

  const handlePatternImageUpload = async (patternId: string, files: FileList | null) => {
    const validFiles = filterValidFiles(files);
    if (validFiles.length === 0) return;
    handleUpdatePattern(patternId, 'image', await readFileAsDataUrl(validFiles[0]));
  };

  const handleNewPatternImageUpload = async (files: FileList | null) => {
    const validFiles = filterValidFiles(files);
    if (validFiles.length === 0) return;
    if (validFiles.length === 1) {
      setNewPatternImage(await readFileAsDataUrl(validFiles[0]));
    } else {
      const newPatterns = await Promise.all(
        validFiles.map(async (file, index) => {
          const dataUrl = await readFileAsDataUrl(file);
          const name = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
          return { id: `pat_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 6)}`, name: name.trim(), image: dataUrl, isActive: true };
        })
      );
      onChange({ ...product, patterns: [...((productAny.patterns as unknown[]) || []), ...newPatterns] } as Product);
      showToast?.('success', `เพิ่มสำเร็จ ${newPatterns.length} ลายจากไฟล์ภาพ`);
    }
  };

  const handleSizePriceChange = (size: string, price: number) => {
    if (!size || Number.isNaN(price)) return;
    const next = { ...(product.sizePricing || {}) };
    next[size] = Math.max(0, price);
    onChange({ ...product, sizePricing: next });
  };

  const handleRemoveSize = (size: string) => {
    const next = { ...(product.sizePricing || {}) };
    delete next[size];
    onChange({ ...product, sizePricing: next });
  };

  const handleAddSize = () => {
    const key = newSizeKey.trim();
    if (!key) return;
    handleSizePriceChange(key, typeof newSizePrice === 'number' ? newSizePrice : product.basePrice || 0);
    setNewSizeKey('');
    setNewSizePrice('');
  };

  const handleImagesUpload = async (files: FileList | null) => {
    const validFiles = filterValidFiles(files);
    if (validFiles.length === 0) return;
    const dataUrls = await Promise.all(validFiles.map(readFileAsDataUrl));
    const merged = [...(product.images || []), ...dataUrls];
    onChange({ ...product, images: merged, coverImage: product.coverImage || merged[0] || '' });
  };

  const handleRemoveImage = (imgUrl: string) => {
    const nextImages = (product.images || []).filter((img) => img !== imgUrl);
    onChange({ ...product, images: nextImages, coverImage: imgUrl === product.coverImage ? nextImages[0] || '' : product.coverImage || '' });
  };

  const handleSetCover = (img: string) => {
    if (!img) return;
    const images = product.images || [];
    onChange({ ...product, coverImage: img, images: images.includes(img) ? images : [img, ...images] });
  };

  const handleCoverUpload = async (files: FileList | null) => {
    const validFiles = filterValidFiles(files);
    if (validFiles.length === 0) return;
    setCoverUploadLoading(true);
    try {
      const dataUrl = await readFileAsDataUrl(validFiles[0]);
      const merged = [...(product.images || []), dataUrl];
      onChange({ ...product, images: merged, coverImage: dataUrl });
    } finally {
      setCoverUploadLoading(false);
    }
  };

  const category = (PRODUCT_CATEGORIES as readonly string[]).includes(String(productAny.category))
    ? String(productAny.category)
    : 'APPAREL';
  const subtypeOptions = PRODUCT_SUBTYPES[category] || ['OTHER'];
  const rawSubType = String(productAny.subType || product.type || subtypeOptions[0]);
  const subType = subtypeOptions.includes(rawSubType) ? rawSubType : subtypeOptions[0];

  const mapTypeFromCategory = (cat: string, sub: string): Product['type'] => {
    if (cat === 'APPAREL' && (sub === 'JERSEY' || sub === 'CREW')) return sub as Product['type'];
    return 'OTHER';
  };

  const applyCategory = (newCategory: string) => {
    const nextSubs = PRODUCT_SUBTYPES[newCategory] || ['OTHER'];
    const nextSub = nextSubs[0] || 'OTHER';
    onChange({
      ...product,
      category: newCategory,
      subType: nextSub,
      type: mapTypeFromCategory(newCategory, nextSub),
    } as Product);
  };

  const applySubType = (nextSub: string) => {
    onChange({
      ...product,
      subType: nextSub,
      type: mapTypeFromCategory(category, nextSub),
    } as Product);
  };

  const sortedImages = (() => {
    const images = product.images || [];
    const coverImage = product.coverImage;
    const merged = coverImage && !images.includes(coverImage) ? [coverImage, ...images] : images;
    return coverImage ? [coverImage, ...merged.filter((img) => img !== coverImage)] : merged;
  })();

  const { status: scheduleStatus } = isProductOpen(product);
  const scheduleInfo: Record<string, { icon: React.ReactNode; text: string; color: string }> = {
    upcoming: { icon: <AccessTime size={16} />, text: 'สินค้าจะเปิดขายเมื่อถึงเวลาที่กำหนด', color: '#f59e0b' },
    active: { icon: <FiberManualRecord size={12} className="text-green-500" />, text: 'สินค้ากำลังเปิดขายอยู่', color: '#10b981' },
    ended: { icon: <FiberManualRecord size={12} className="text-red-500" />, text: 'หมดเวลาขายแล้ว', color: '#ef4444' },
    always: { icon: <DateRange size={16} />, text: 'ไม่มีกำหนดเวลา (เปิดตลอด)', color: 'var(--text-muted)' },
  };
  const schedulePreview = scheduleInfo[scheduleStatus];
  const isNew = product.id.startsWith('prod_');
  const previewCover = product.coverImage || product.images?.[0] || '';

  return (
    <Dialog open={!!product} onOpenChange={() => {}}>
      <DialogContent
        showCloseButton={false}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        className={cn(
          'flex max-h-[95vh] flex-col gap-0 overflow-hidden border-[var(--glass-border)] bg-[var(--background)] p-0 text-[var(--foreground)]',
          isMobileDevice ? 'h-full max-w-full rounded-none' : 'max-w-4xl rounded-2xl'
        )}
      >
        <div className="relative shrink-0 border-b border-[var(--glass-border)] bg-gradient-to-br from-indigo-500 to-violet-500 px-5 py-4 sm:px-6">
          <DialogTitle className="pr-10 text-left text-lg font-bold text-white">
            {isNew ? 'สินค้าใหม่' : 'แก้ไขสินค้า'}
          </DialogTitle>
          <p className="mt-0.5 text-sm text-white/80">
            {product.name?.trim() || 'กรอกข้อมูลสินค้าด้านล่าง'}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 rounded-lg p-1.5 text-white/90 hover:bg-white/15"
            aria-label="ปิด"
          >
            <Close size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(260px,0.9fr)]">
            <div className="flex min-w-0 flex-col gap-5">
              <section className={sectionClass}>
                <p className="text-sm font-bold">ข้อมูลพื้นฐาน</p>
                <div className="space-y-1.5">
                  <Label>ชื่อสินค้า</Label>
                  <Input
                    className={inputClass}
                    value={product.name}
                    onChange={(e) => onChange({ ...product, name: e.target.value })}
                    placeholder="เช่น NEW JERSEY 2026"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Slug (ลิงก์สินค้า)</Label>
                  <Input
                    className={inputClass}
                    value={(productAny.slug as string) || ''}
                    placeholder={
                      product.name
                        .replace(/[^\u0E00-\u0E7Fa-zA-Z0-9\s-]/g, '')
                        .replace(/\s+/g, '-')
                        .toLowerCase() || 'auto-generated'
                    }
                    onChange={(e) =>
                      onChange({
                        ...product,
                        slug: e.target.value
                          .replace(/[^a-zA-Z0-9\u0E00-\u0E7F\s-]/g, '')
                          .replace(/\s+/g, '-')
                          .toLowerCase(),
                      } as Product)
                    }
                  />
                  <p className="break-all text-xs text-[var(--text-muted)]">
                    ลิงก์: {typeof window !== 'undefined' ? window.location.origin : ''}/?p={product.id}
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>หมวดหมู่</Label>
                    <Select value={category} onValueChange={applyCategory}>
                      <SelectTrigger className={cn(inputClass, 'h-10 w-full')}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRODUCT_CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            <span className="inline-flex items-center gap-2">
                              {CATEGORY_ICON_COMPONENTS[c]}
                              {CATEGORY_LABELS[c] || c}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>ประเภทย่อย</Label>
                    <Select value={subType} onValueChange={applySubType}>
                      <SelectTrigger className={cn(inputClass, 'h-10 w-full')}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {subtypeOptions.map((s) => (
                          <SelectItem key={s} value={s}>
                            {SUBTYPE_LABELS[s] || s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>คำอธิบาย</Label>
                  <Textarea
                    className={inputClass}
                    rows={4}
                    value={product.description}
                    onChange={(e) => onChange({ ...product, description: e.target.value })}
                    placeholder={'เช่น:\nเสื้อ Jersey รุ่นใหม่\nเนื้อผ้า: Cool Elite'}
                  />
                  <p className="text-xs text-[var(--text-muted)]">กด Enter เพื่อเว้นบรรทัดใหม่</p>
                </div>
              </section>

              {(category === 'CAMP_FEE' || subType === 'CAMP_REGISTRATION') && (
                <section className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
                  <p className="flex items-center gap-2 text-sm font-bold text-amber-400">
                    <Tent size={16} /> ข้อมูลค่าย
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {[
                      { key: 'campName', label: 'ชื่อค่าย', type: 'text' },
                      { key: 'campDate', label: 'วันที่จัดค่าย', type: 'date' },
                      { key: 'location', label: 'สถานที่', type: 'text' },
                      { key: 'organizer', label: 'ผู้จัด', type: 'text' },
                      { key: 'maxParticipants', label: 'จำนวนรับสูงสุด', type: 'number' },
                    ].map(({ key, label, type }) => (
                      <div key={key} className="space-y-1.5">
                        <Label>{label}</Label>
                        <Input
                          type={type}
                          className={inputClass}
                          value={String((productAny.campInfo as Record<string, unknown>)?.[key] ?? '')}
                          onChange={(e) =>
                            onChange({
                              ...product,
                              campInfo: {
                                ...((productAny.campInfo as Record<string, unknown>) || {}),
                                [key]: type === 'number' ? Number(e.target.value) || 0 : e.target.value,
                              },
                            } as Product)
                          }
                        />
                      </div>
                    ))}
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>เงื่อนไข/ข้อกำหนด</Label>
                      <Textarea
                        className={inputClass}
                        rows={2}
                        value={String((productAny.campInfo as Record<string, unknown>)?.requirements ?? '')}
                        onChange={(e) =>
                          onChange({
                            ...product,
                            campInfo: {
                              ...((productAny.campInfo as Record<string, unknown>) || {}),
                              requirements: e.target.value,
                            },
                          } as Product)
                        }
                      />
                    </div>
                  </div>
                </section>
              )}

              {(category === 'EVENT' || subType === 'EVENT_TICKET') && (
                <section className="space-y-3 rounded-lg border border-pink-500/30 bg-pink-500/10 p-4">
                  <p className="flex items-center gap-2 text-sm font-bold text-pink-400">
                    <Ticket size={16} /> ข้อมูลอีเวนต์
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {[
                      { key: 'eventName', label: 'ชื่ออีเวนต์', type: 'text' },
                      { key: 'eventDate', label: 'วันที่จัดงาน', type: 'datetime-local' },
                      { key: 'venue', label: 'สถานที่', type: 'text' },
                      { key: 'organizer', label: 'ผู้จัด', type: 'text' },
                    ].map(({ key, label, type }) => (
                      <div key={key} className="space-y-1.5">
                        <Label>{label}</Label>
                        <Input
                          type={type}
                          className={inputClass}
                          value={String((productAny.eventInfo as Record<string, unknown>)?.[key] ?? '')}
                          onChange={(e) =>
                            onChange({
                              ...product,
                              eventInfo: {
                                ...((productAny.eventInfo as Record<string, unknown>) || {}),
                                [key]: e.target.value,
                              },
                            } as Product)
                          }
                        />
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section className={sectionClass}>
                <p className="flex items-center gap-1 text-sm font-bold">
                  <Inventory size={16} /> ราคาและสต็อก
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label>ราคาพื้นฐาน (฿)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={999999}
                      className={inputClass}
                      value={product.basePrice}
                      onChange={(e) => onChange({ ...product, basePrice: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>จำนวนในสต็อก</Label>
                    <Input
                      type="number"
                      min={0}
                      className={inputClass}
                      placeholder="ว่าง = ไม่จำกัด"
                      value={productAny.stock != null ? String(productAny.stock) : ''}
                      onChange={(e) =>
                        onChange({
                          ...product,
                          stock: e.target.value === '' ? null : Number(e.target.value),
                        } as Product)
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>สูงสุดต่อออเดอร์</Label>
                    <Input
                      type="number"
                      min={1}
                      className={inputClass}
                      placeholder="ว่าง = ไม่จำกัด"
                      value={productAny.maxPerOrder != null ? String(productAny.maxPerOrder) : ''}
                      onChange={(e) =>
                        onChange({
                          ...product,
                          maxPerOrder: e.target.value === '' ? null : Number(e.target.value),
                        } as Product)
                      }
                    />
                  </div>
                </div>
              </section>

              {(category === 'APPAREL' || !productAny.category) && (
                <section className={sectionClass}>
                  <p className="flex items-center gap-1 text-sm font-bold">
                    <Settings size={16} /> ตัวเลือกเสื้อ
                  </p>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <Label>ต้องเลือกไซส์</Label>
                      <p className="text-xs text-[var(--text-muted)]">ลูกค้าต้องเลือกไซส์ก่อนสั่งซื้อ</p>
                    </div>
                    <Switch
                      checked={product.options?.requiresSize !== false}
                      onCheckedChange={(checked) =>
                        onChange({
                          ...product,
                          options: { ...product.options, requiresSize: checked },
                        } as Product)
                      }
                      className="data-[state=checked]:bg-emerald-500"
                    />
                  </div>
                </section>
              )}

              {(category === 'APPAREL' || !productAny.category) &&
                productAny.options?.requiresSize !== false && (
                  <section className={sectionClass}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold">ราคาต่อไซส์</p>
                      <p className="text-xs text-[var(--text-muted)]">ปล่อยว่างจะใช้ราคาพื้นฐาน</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {SIZES.map((size) => (
                        <Badge
                          key={size}
                          variant="outline"
                          className={cn(
                            'cursor-pointer font-bold',
                            product.sizePricing?.[size] && 'border-indigo-500/40 bg-indigo-500/15'
                          )}
                          onClick={() => handleSizePriceChange(size, product.basePrice || 0)}
                        >
                          {product.sizePricing?.[size]
                            ? `${size}: ${product.sizePricing[size].toLocaleString()}฿`
                            : `ตั้งราคา ${size}`}
                        </Badge>
                      ))}
                    </div>
                    {Object.entries(product.sizePricing || {}).map(([size, price]) => (
                      <div key={size} className="grid grid-cols-[1fr_auto] items-center gap-2">
                        <Input
                          type="number"
                          min={0}
                          className={inputClass}
                          value={price}
                          onChange={(e) => handleSizePriceChange(size, Number(e.target.value))}
                          placeholder={`ไซส์ ${size}`}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveSize(size)}
                          className="text-red-400"
                        >
                          <Delete size={18} />
                        </Button>
                      </div>
                    ))}
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
                      <Input
                        className={inputClass}
                        placeholder="เพิ่มไซส์ใหม่"
                        value={newSizeKey}
                        onChange={(e) => setNewSizeKey(e.target.value.trimStart())}
                      />
                      <Input
                        type="number"
                        className={inputClass}
                        placeholder="ราคา (฿)"
                        value={newSizePrice}
                        onChange={(e) =>
                          setNewSizePrice(e.target.value === '' ? '' : Number(e.target.value))
                        }
                      />
                      <Button onClick={handleAddSize} className={gradientBtnClass}>
                        <Add size={16} className="mr-1" /> เพิ่มไซส์
                      </Button>
                    </div>
                  </section>
                )}

              {needsVariants() && (
                <section className="space-y-3 rounded-lg border border-violet-500/30 bg-violet-500/10 p-4">
                  <p className="flex items-center gap-2 text-sm font-bold text-violet-400">
                    <Palette size={16} /> ตัวเลือกสินค้า (Variants)
                  </p>
                  {((productAny.variants as unknown as Array<Record<string, unknown>>) || []).map(
                    (variant) => (
                      <div
                        key={String(variant.id)}
                        className="grid grid-cols-1 items-center gap-2 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] p-3 sm:grid-cols-[2fr_1fr_1fr_auto]"
                      >
                        <Input
                          className={inputClass}
                          value={String(variant.name)}
                          onChange={(e) =>
                            handleUpdateVariant(String(variant.id), 'name', e.target.value)
                          }
                          placeholder="ชื่อตัวเลือก"
                        />
                        <Input
                          type="number"
                          className={inputClass}
                          value={Number(variant.price)}
                          onChange={(e) =>
                            handleUpdateVariant(String(variant.id), 'price', Number(e.target.value))
                          }
                          placeholder="ราคา"
                        />
                        <Input
                          type="number"
                          className={inputClass}
                          value={variant.stock != null ? String(variant.stock) : ''}
                          onChange={(e) =>
                            handleUpdateVariant(
                              String(variant.id),
                              'stock',
                              e.target.value === '' ? null : Number(e.target.value)
                            )
                          }
                          placeholder="ไม่จำกัด"
                        />
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              handleUpdateVariant(String(variant.id), 'isActive', !variant.isActive)
                            }
                            className={variant.isActive ? 'text-green-500' : 'text-slate-500'}
                          >
                            {variant.isActive ? <Visibility size={18} /> : <VisibilityOff size={18} />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveVariant(String(variant.id))}
                            className="text-red-400"
                          >
                            <Delete size={18} />
                          </Button>
                        </div>
                      </div>
                    )
                  )}
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr_1fr_1fr_auto]">
                    <Input
                      className={inputClass}
                      value={newVariantName}
                      onChange={(e) => setNewVariantName(e.target.value)}
                      placeholder="ชื่อตัวเลือกใหม่"
                    />
                    <Input
                      type="number"
                      className={inputClass}
                      value={newVariantPrice}
                      onChange={(e) =>
                        setNewVariantPrice(e.target.value === '' ? '' : Number(e.target.value))
                      }
                      placeholder={`${product.basePrice || 0}`}
                    />
                    <Input
                      type="number"
                      className={inputClass}
                      value={newVariantStock}
                      onChange={(e) =>
                        setNewVariantStock(e.target.value === '' ? '' : Number(e.target.value))
                      }
                      placeholder="ไม่จำกัด"
                    />
                    <Button
                      onClick={handleAddVariant}
                      className="bg-gradient-to-br from-violet-500 to-indigo-500 text-white"
                    >
                      <Add size={16} /> เพิ่ม
                    </Button>
                  </div>
                  <div>
                    <p className="mb-2 text-xs text-[var(--text-muted)]">เพิ่มตัวเลือกด่วน:</p>
                    <div className="flex flex-wrap gap-1">
                      {[
                        { name: 'ขนาด S', price: product.basePrice },
                        { name: 'ขนาด M', price: product.basePrice },
                        { name: 'ขนาด L', price: product.basePrice },
                        { name: 'สีดำ', price: product.basePrice },
                        { name: 'สีขาว', price: product.basePrice },
                        { name: 'ปกติ', price: product.basePrice },
                        { name: 'พิเศษ', price: Math.round((product.basePrice || 0) * 1.2) },
                      ].map((preset) => {
                        const exists = (
                          (productAny.variants as Array<{ name: string }>) || []
                        ).some((v) => v.name === preset.name);
                        return (
                          <Badge
                            key={preset.name}
                            variant="outline"
                            className={cn(
                              'cursor-pointer border-dashed border-violet-500/50 text-violet-400',
                              exists && 'opacity-50'
                            )}
                            onClick={() => {
                              if (exists) return;
                              onChange({
                                ...product,
                                variants: [
                                  ...((productAny.variants as unknown[]) || []),
                                  {
                                    id: `var_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                                    name: preset.name,
                                    price: preset.price || 0,
                                    stock: null,
                                    isActive: true,
                                  },
                                ],
                              } as Product);
                            }}
                          >
                            {preset.name}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                </section>
              )}

              <section className={sectionClass}>
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-amber-600">
                    <DateRange size={20} className="text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">กำหนดเวลาขาย</p>
                    <p className="text-xs text-[var(--text-muted)]">ตั้งเวลาเปิด-ปิดขายอัตโนมัติ</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1 text-[var(--text-muted)]">
                      <FiberManualRecord size={10} className="text-green-500" /> เปิดขายเมื่อ
                    </Label>
                    <Input
                      type="datetime-local"
                      className={inputClass}
                      value={toDateTimeLocal(product.startDate)}
                      onChange={(e) => onChange({ ...product, startDate: e.target.value })}
                    />
                    {product.startDate && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 text-xs text-[var(--text-muted)]"
                        onClick={() => onChange({ ...product, startDate: '' })}
                      >
                        ✕ ล้างวันเริ่ม
                      </Button>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1 text-[var(--text-muted)]">
                      <FiberManualRecord size={10} className="text-red-500" /> ปิดขายเมื่อ
                    </Label>
                    <Input
                      type="datetime-local"
                      className={inputClass}
                      value={toDateTimeLocal(product.endDate)}
                      onChange={(e) => onChange({ ...product, endDate: e.target.value })}
                    />
                    {product.endDate && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 text-xs text-[var(--text-muted)]"
                        onClick={() => onChange({ ...product, endDate: '' })}
                      >
                        ✕ ล้างวันสิ้นสุด
                      </Button>
                    )}
                  </div>
                </div>
                <div
                  className="flex items-center gap-3 rounded-lg p-3"
                  style={{
                    backgroundColor: `${schedulePreview.color}15`,
                    border: `1px solid ${schedulePreview.color}30`,
                  }}
                >
                  <span style={{ color: schedulePreview.color }}>{schedulePreview.icon}</span>
                  <p className="text-sm font-medium" style={{ color: schedulePreview.color }}>
                    {schedulePreview.text}
                  </p>
                </div>
              </section>

              <section className={sectionClass}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-bold">รูปภาพสินค้า</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" asChild className="border-[var(--glass-border)]">
                      <label>
                        เพิ่มหลายรูป
                        <input
                          hidden
                          accept="image/*"
                          multiple
                          type="file"
                          onChange={(e) => handleImagesUpload(e.target.files)}
                        />
                      </label>
                    </Button>
                    <Button size="sm" disabled={coverUploadLoading} asChild className={gradientBtnClass}>
                      <label>
                        {coverUploadLoading ? '...' : 'ตั้งรูปปก'}
                        <input
                          hidden
                          accept="image/*"
                          type="file"
                          onChange={(e) => handleCoverUpload(e.target.files)}
                        />
                      </label>
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-[var(--text-muted)]">
                  รองรับหลายไฟล์ · ตั้งปกได้จากรูปสินค้าหรือรูปลายเสื้อ
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {sortedImages.map((img, idx) => {
                    const isCover = product.coverImage === img;
                    return (
                      <div
                        key={idx}
                        className={cn(
                          'relative overflow-hidden rounded-xl border',
                          isCover
                            ? 'border-indigo-500 ring-2 ring-indigo-500/35'
                            : 'border-[var(--glass-border)]'
                        )}
                      >
                        {isCover && (
                          <Badge className="absolute left-1.5 top-1.5 z-10 bg-indigo-500">รูปปก</Badge>
                        )}
                        <img src={img} alt={`product-${idx}`} className="block h-[140px] w-full object-cover" />
                        <div className="absolute inset-0 flex flex-col justify-end gap-1 bg-gradient-to-t from-black/70 to-transparent p-2">
                          <Button
                            size="sm"
                            className="bg-indigo-500/90 text-white"
                            onClick={() => handleSetCover(img)}
                          >
                            ตั้งเป็นปก
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-white/30 text-white"
                            onClick={() => handleRemoveImage(img)}
                          >
                            ลบรูป
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {(category === 'APPAREL' ||
                (!productAny.category && product.type !== 'OTHER')) && (
                <section className="space-y-3 rounded-lg border border-sky-500/30 bg-sky-500/10 p-4">
                  <p className="flex items-center gap-2 text-sm font-bold text-sky-400">
                    <Palette size={16} /> ลายเสื้อ (Patterns)
                  </p>
                  {(((productAny.patterns as unknown as Array<Record<string, unknown>>) ||
                    []) as Array<Record<string, unknown>>).length === 0 ? (
                    <p className="text-xs italic text-[var(--text-muted)]">ยังไม่มีลายสินค้า</p>
                  ) : (
                    ((productAny.patterns as unknown as Array<Record<string, unknown>>) || []).map(
                      (pattern) => {
                        const isActive = pattern.isActive !== false;
                        const isPatternCover = Boolean(
                          pattern.image && product.coverImage === pattern.image
                        );
                        return (
                          <div
                            key={String(pattern.id)}
                            className={cn(
                              'grid grid-cols-1 items-center gap-2 rounded-lg border bg-[var(--glass-bg)] p-3 sm:grid-cols-[140px_1fr_auto]',
                              isPatternCover
                                ? 'border-indigo-500 ring-2 ring-indigo-500/35'
                                : 'border-[var(--glass-border)]'
                            )}
                          >
                            <div className="relative flex h-[90px] w-full items-center justify-center overflow-hidden rounded-lg border border-[var(--glass-border)] bg-slate-900/40">
                              {isPatternCover && (
                                <Badge className="absolute left-1 top-1 z-10 h-5 bg-indigo-500 text-[0.65rem]">
                                  รูปปก
                                </Badge>
                              )}
                              {pattern.image ? (
                                <img
                                  src={String(pattern.image)}
                                  alt={String(pattern.name)}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <ImageIcon size={20} className="text-[var(--text-muted)]" />
                              )}
                            </div>
                            <div className="space-y-2">
                              <Input
                                className={inputClass}
                                value={String(pattern.name)}
                                onChange={(e) =>
                                  handleUpdatePattern(String(pattern.id), 'name', e.target.value)
                                }
                                placeholder="ชื่อลาย"
                              />
                              <div className="flex flex-wrap gap-2">
                                <Button variant="outline" size="sm" asChild>
                                  <label>
                                    แนบ/เปลี่ยนรูปลาย
                                    <input
                                      hidden
                                      accept="image/*"
                                      type="file"
                                      onChange={(e) =>
                                        handlePatternImageUpload(String(pattern.id), e.target.files)
                                      }
                                    />
                                  </label>
                                </Button>
                                {Boolean(pattern.image) && (
                                  <Button
                                    size="sm"
                                    disabled={isPatternCover}
                                    className="bg-indigo-500/90"
                                    onClick={() => handleSetCover(String(pattern.image))}
                                  >
                                    {isPatternCover ? 'เป็นปกแล้ว' : 'ตั้งเป็นปก'}
                                  </Button>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                  handleUpdatePattern(String(pattern.id), 'isActive', !isActive)
                                }
                                className={isActive ? 'text-green-500' : 'text-slate-500'}
                              >
                                {isActive ? <Visibility size={18} /> : <VisibilityOff size={18} />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemovePattern(String(pattern.id))}
                                className="text-red-400"
                              >
                                <Delete size={18} />
                              </Button>
                            </div>
                          </div>
                        );
                      }
                    )
                  )}
                  <div className="grid grid-cols-1 items-center gap-2 md:grid-cols-[2fr_1fr_auto]">
                    <Input
                      className={inputClass}
                      value={newPatternName}
                      onChange={(e) => setNewPatternName(e.target.value)}
                      placeholder="ชื่อลายใหม่ (คั่นด้วย ,)"
                    />
                    <Button variant="outline" size="sm" asChild>
                      <label>
                        แนบรูปลาย
                        <input
                          hidden
                          accept="image/*"
                          type="file"
                          multiple
                          onChange={(e) => handleNewPatternImageUpload(e.target.files)}
                        />
                      </label>
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleAddPattern}
                      className="bg-gradient-to-br from-sky-400 to-sky-500 text-white"
                    >
                      <Add size={16} /> เพิ่มลาย
                    </Button>
                  </div>
                  {newPatternImage && (
                    <div className="flex items-center gap-2">
                      <img
                        src={newPatternImage}
                        alt="new-pattern"
                        className="h-[60px] w-[90px] rounded-lg border border-[var(--glass-border)] object-cover"
                      />
                      <Button variant="outline" size="sm" onClick={() => setNewPatternImage('')}>
                        ลบรูปลาย
                      </Button>
                    </div>
                  )}
                </section>
              )}

              <section className={sectionClass}>
                <p className="text-sm font-bold">ตัวเลือกเพิ่มเติม</p>
                {[
                  { key: 'hasCustomName', label: 'อนุญาตใส่ชื่อบนเสื้อ' },
                  { key: 'hasCustomNumber', label: 'อนุญาตใส่หมายเลข' },
                  { key: 'hasLongSleeve', label: 'มีตัวเลือกแขนยาว' },
                ].map((opt) => (
                  <div key={opt.key} className="flex items-center gap-2">
                    <Checkbox
                      id={opt.key}
                      checked={Boolean((product.options as Record<string, unknown>)?.[opt.key])}
                      onCheckedChange={(checked) =>
                        onChange({
                          ...product,
                          options: {
                            ...(product.options || {
                              hasCustomName: false,
                              hasCustomNumber: false,
                              hasLongSleeve: false,
                              longSleevePrice: 50,
                            }),
                            [opt.key]: checked === true,
                          },
                        })
                      }
                    />
                    <Label htmlFor={opt.key}>{opt.label}</Label>
                  </div>
                ))}
                {product.options?.hasLongSleeve && (
                  <div className="ml-6 space-y-1.5">
                    <Label>ราคาเพิ่มแขนยาว (฿)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={999999}
                      className={cn(inputClass, 'w-44')}
                      value={product.options?.longSleevePrice ?? 50}
                      onChange={(e) =>
                        onChange({
                          ...product,
                          options: {
                            hasCustomName: !!product.options?.hasCustomName,
                            hasCustomNumber: !!product.options?.hasCustomNumber,
                            hasLongSleeve: !!product.options?.hasLongSleeve,
                            ...product.options,
                            longSleevePrice: Math.max(0, Number(e.target.value)),
                          },
                        })
                      }
                    />
                  </div>
                )}
                {product.options?.hasCustomName && (
                  <div className="mt-3 border-t border-[var(--glass-border)] pt-3">
                    <p className="mb-3 flex items-center gap-2 text-sm font-bold">
                      <Shirt size={18} /> ตั้งค่าชื่อบนเสื้อ
                    </p>
                    <ShirtNameConfigFields
                      compact
                      value={getProductShirtNameConfig(product)}
                      onChange={(shirtNameConfig) => onChange({ ...product, shirtNameConfig })}
                    />
                  </div>
                )}
              </section>

              <section className={sectionClass}>
                <p className="flex items-center gap-2 text-sm font-bold">
                  <LocalOffer size={20} /> แท็กสินค้า
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  ถ้าไม่ตั้งค่า จะใช้แท็กอัตโนมัติจากตัวเลือกสินค้า
                </p>
                <div className="flex flex-wrap gap-2">
                  {(
                    (product.customTags || []) as Array<{
                      text: string;
                      color: string;
                      bgColor?: string;
                    }>
                  ).map((tag, idx) => (
                    <Badge
                      key={idx}
                      style={{
                        backgroundColor: tag.bgColor || `${tag.color}20`,
                        color: tag.color,
                        border: `1px solid ${tag.color}40`,
                      }}
                      className="gap-1"
                    >
                      {tag.text}
                      <button
                        type="button"
                        onClick={() => {
                          const newTags = [...(product.customTags || [])];
                          newTags.splice(idx, 1);
                          onChange({ ...product, customTags: newTags });
                        }}
                        className="ml-1"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                  {(!product.customTags || product.customTags.length === 0) && (
                    <p className="text-xs italic text-[var(--text-muted)]">
                      ยังไม่มีแท็ก (ใช้แท็กอัตโนมัติ)
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-[150px] flex-1 space-y-1.5">
                    <Label>ข้อความแท็ก</Label>
                    <Input
                      className={inputClass}
                      value={newTagText}
                      onChange={(e) => setNewTagText(e.target.value)}
                      placeholder="เช่น สินค้ามาใหม่"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>สี</Label>
                    <Input
                      type="color"
                      className={cn(inputClass, 'w-20')}
                      value={newTagColor}
                      onChange={(e) => setNewTagColor(e.target.value)}
                    />
                  </div>
                  <Button
                    size="sm"
                    className="bg-indigo-500"
                    onClick={() => {
                      if (!newTagText.trim()) return;
                      onChange({
                        ...product,
                        customTags: [
                          ...(product.customTags || []),
                          {
                            text: newTagText.trim(),
                            color: newTagColor,
                            bgColor: `${newTagColor}20`,
                          },
                        ],
                      });
                      setNewTagText('');
                    }}
                  >
                    เพิ่ม
                  </Button>
                </div>
                <div>
                  <p className="mb-2 text-xs text-[var(--text-muted)]">แท็กยอดนิยม:</p>
                  <div className="flex flex-wrap gap-1">
                    {[
                      { text: 'สินค้ามาใหม่', color: '#f59e0b' },
                      { text: 'ขายดี', color: '#ef4444' },
                      { text: 'Limited', color: '#8b5cf6' },
                      { text: 'Pre-order', color: '#3b82f6' },
                      { text: 'พร้อมส่ง', color: '#10b981' },
                    ].map((preset) => {
                      const isAdded = (
                        (product.customTags || []) as Array<{ text: string }>
                      ).some((t) => t.text === preset.text);
                      return (
                        <Badge
                          key={preset.text}
                          variant="outline"
                          className={cn('cursor-pointer border-dashed', isAdded && 'opacity-50')}
                          style={{ color: preset.color, borderColor: `${preset.color}60` }}
                          onClick={() => {
                            if (isAdded) return;
                            onChange({
                              ...product,
                              customTags: [
                                ...(product.customTags || []),
                                { ...preset, bgColor: `${preset.color}20` },
                              ],
                            });
                          }}
                        >
                          {preset.text}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              </section>

              <div className="flex items-center justify-between rounded-lg border border-[var(--glass-border)] bg-[var(--surface-2)] px-4 py-3">
                <div>
                  <Label className="text-sm font-semibold">สถานะเผยแพร่</Label>
                  <p className="text-xs text-[var(--text-muted)]">
                    {product.isActive ? 'ลูกค้าเห็นสินค้านี้ในร้าน' : 'ซ่อนจากหน้าร้าน (แบบร่าง)'}
                  </p>
                </div>
                <Switch
                  checked={product.isActive}
                  onCheckedChange={(checked) => onChange({ ...product, isActive: checked })}
                  className="data-[state=checked]:bg-emerald-500"
                />
              </div>
            </div>

            <aside className="lg:sticky lg:top-4 lg:self-start">
              <p className="mb-2 text-sm font-bold">ตัวอย่างการ์ดสินค้า</p>
              <Card className={cn(glassCardClass, 'gap-0 overflow-hidden py-0')}>
                <div
                  className="h-[200px] bg-cover bg-center"
                  style={{
                    backgroundImage: previewCover
                      ? `url(${previewCover})`
                      : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                  }}
                />
                <CardContent className="flex flex-col gap-2 px-4 py-4">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="secondary" className="gap-1">
                      {CATEGORY_ICON_COMPONENTS[category]}
                      {CATEGORY_LABELS[category] || category}
                    </Badge>
                    <Badge variant="outline">{SUBTYPE_LABELS[subType] || subType}</Badge>
                  </div>
                  <p className="text-base font-bold leading-snug">
                    {product.name || 'ชื่อสินค้า'}
                  </p>
                  <p className="text-xl font-bold text-emerald-500">
                    ฿{(product.basePrice || 0).toLocaleString()}
                  </p>
                  {Object.keys(product.sizePricing || {}).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(product.sizePricing || {})
                        .slice(0, 5)
                        .map(([size, raw]) => (
                          <Badge key={size} variant="secondary">
                            {size}: ฿{Number(raw) || 0}
                          </Badge>
                        ))}
                    </div>
                  )}
                  <Badge className={product.isActive ? 'w-fit bg-emerald-500' : 'w-fit'}>
                    {product.isActive ? 'เผยแพร่แล้ว' : 'แบบร่าง'}
                  </Badge>
                </CardContent>
              </Card>
            </aside>
          </div>
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t border-[var(--glass-border)] bg-[var(--background)] p-4 sm:justify-end">
          <Button variant="outline" onClick={onClose} className="border-[var(--glass-border)]">
            ยกเลิก
          </Button>
          <Button
            variant="outline"
            onClick={() => onSave('draft')}
            disabled={isSaving}
            className="border-[var(--glass-border)]"
          >
            {isSaving ? 'กำลังบันทึก...' : 'บันทึกแบบร่าง'}
          </Button>
          <Button onClick={() => onSave('publish')} disabled={isSaving} className={gradientBtnClass}>
            {isSaving ? 'กำลังบันทึก...' : 'บันทึกและเผยแพร่'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ============== PRODUCTS VIEW ==============
export function ProductsView({
  config,
  searchTerm,
  setSearchTerm,
  saveFullConfig,
  showToast,
  addLog,
  saving,
}: ProductsViewProps): JSX.Element {
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [pickupSettingProduct, setPickupSettingProduct] = useState<Product | null>(null);
  const [pickupSaving, setPickupSaving] = useState(false);
  const { confirm, ConfirmDialog: ProductConfirmDialog } = useConfirmDialog();

  const filteredProducts = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return config.products.filter(
      (p) => p.name.toLowerCase().includes(term) || p.id.toLowerCase().includes(term)
    );
  }, [searchTerm, config.products]);

  const createNewProduct = () => {
    const now = new Date().toISOString();
    const newP: Product = {
      id: `prod_${Date.now()}`,
      name: '',
      description: '',
      type: 'CREW',
      category: 'APPAREL',
      subType: 'CREW',
      images: [],
      coverImage: '',
      basePrice: 0,
      sizePricing: {},
      patterns: [],
      startDate: '',
      endDate: '',
      isActive: true,
      options: { hasCustomName: false, hasCustomNumber: false, hasLongSleeve: false, longSleevePrice: 50 },
      customTags: [],
      createdAt: now,
      updatedAt: now,
    };
    setEditingProduct(newP);
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: 'Delete Product?',
      message: 'This action cannot be undone',
      variant: 'warning',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      destructive: true,
    });
    if (ok) {
      const newProducts = config.products.filter((p) => p.id !== id);
      saveFullConfig({ ...config, products: newProducts });
      showToast('success', 'Product deleted');
    }
  };

  const handleToggleActive = (id: string) => {
    const newProducts = config.products.map((p) => (p.id === id ? { ...p, isActive: !p.isActive } : p));
    saveFullConfig({ ...config, products: newProducts });
    const target = newProducts.find((p) => p.id === id);
    showToast('success', target?.isActive ? 'เปิดขายสินค้าแล้ว' : 'ปิดขายสินค้าแล้ว');
  };

  const handleSaveEdit = async (mode?: 'publish' | 'draft') => {
    if (!editingProduct) return;

    const nextProduct = {
      ...editingProduct,
      name: sanitizeInput(editingProduct.name),
      description: sanitizeInput(editingProduct.description || ''),
    };
    if (mode === 'publish') {
      nextProduct.isActive = true;
    } else if (mode === 'draft') {
      nextProduct.isActive = false;
    }

    if (!nextProduct.name.trim()) return;
    if (!validatePrice(nextProduct.basePrice)) return;

    const invalidSizePrice = Object.values(nextProduct.sizePricing || {}).some((p) => !validatePrice(Number(p)));
    if (invalidSizePrice) return;

    const idx = config.products.findIndex((p) => p.id === nextProduct.id);
    const newProducts = [...config.products];
    const now = new Date().toISOString();

    if (idx >= 0) {
      newProducts[idx] = { ...nextProduct, updatedAt: now };
    } else {
      newProducts.unshift({
        ...nextProduct,
        createdAt: nextProduct.createdAt || now,
        updatedAt: now,
      });
    }

    setEditingProduct(null);
    addLog(idx >= 0 ? 'EDIT_PRODUCT' : 'CREATE_PRODUCT', nextProduct.id, {
      config: { ...config, products: newProducts },
    });
    saveFullConfig({ ...config, products: newProducts });
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <ProductConfirmDialog />

      <div className="sticky top-0 z-10 bg-[var(--background)] px-0 pb-3 pt-1 md:-mx-3 md:px-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-extrabold text-[var(--foreground)] md:text-2xl">
            สินค้า ({filteredProducts.length}/{config.products.length})
          </h2>
          <Button size="sm" onClick={createNewProduct} className={gradientBtnClass}>
            <Add size={18} className="mr-1" /> เพิ่มสินค้า
          </Button>
        </div>

        <div className="relative">
          <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <Input
            placeholder="ค้นหาชื่อหรือ ID..."
            className={cn(inputClass, 'rounded-xl py-2 pl-10 pr-10')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
            >
              <Clear size={18} />
            </button>
          )}
        </div>
      </div>

      {filteredProducts.length === 0 ? (
        <div className="py-8 text-center">
          <History size={48} className="mx-auto mb-2 text-[var(--text-muted)]" />
          <p className="text-[var(--text-muted)]">No logs found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {filteredProducts.map((p) => (
            <ProductCardItem
              key={p.id}
              product={p}
              onEdit={() => setEditingProduct(p)}
              onDelete={() => handleDelete(p.id)}
              onToggle={() => handleToggleActive(p.id)}
              onPickupSetting={() => setPickupSettingProduct(p)}
            />
          ))}
        </div>
      )}

      {editingProduct && (
        <ProductEditDialog
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onChange={setEditingProduct}
          onSave={handleSaveEdit}
          isSaving={saving}
          showToast={showToast}
        />
      )}

      {pickupSettingProduct && (
        <ProductPickupDialog
          product={pickupSettingProduct}
          onClose={() => setPickupSettingProduct(null)}
          saving={pickupSaving}
          onSave={async (pickup, autoUpdateOrders) => {
            setPickupSaving(true);
            try {
              const res = await apiFetch('/api/pickup/enable', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  productId: pickupSettingProduct.id,
                  pickup,
                  autoUpdateOrders,
                }),
              });

              const data = await res.json();
              if (!res.ok) throw new Error(data.error || 'Failed to update');

              const newProducts = config.products.map((p) =>
                p.id === pickupSettingProduct.id ? { ...p, pickup } : p
              );
              saveFullConfig({ ...config, products: newProducts });

              if (data.updatedCount > 0) {
                showToast('success', `เปิดรับสินค้าแล้ว และอัปเดต ${data.updatedCount} ออเดอร์เป็น "พร้อมรับ"`);
              } else {
                showToast('success', pickup.enabled ? 'เปิดรับสินค้าแล้ว' : 'ปิดรับสินค้าแล้ว');
              }

              setPickupSettingProduct(null);
            } catch (err: unknown) {
              const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด';
              showToast('error', message);
            } finally {
              setPickupSaving(false);
            }
          }}
        />
      )}
    </div>
  );
}
