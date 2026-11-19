'use client';

import React, { useState, useEffect, useMemo, useSyncExternalStore } from 'react';
import type { JSX } from 'react';
import {
  Plus as Add,
  Trash2 as Delete,
  Pencil as Edit,
  X as Close,
  Search,
  Check,
  Clock as AccessTime,
  CircleDot as FiberManualRecord,
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
  MoreHorizontal,
  Copy,
  Link as LinkIcon,
  LayoutGrid,
  List,
  RefreshCw,
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { DateTimePicker } from '@/components/ui/date-picker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmptyState, StatCard } from '@/components/admin/admin-ui';

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

/** Primary action inside the editor — plain theme primary (kept as a name for existing call sites) */
const gradientBtnClass = '';

const inputClass = 'w-full';

const sectionClass =
  'flex scroll-mt-4 flex-col gap-3 rounded-2xl border border-border bg-card p-4 md:p-5';

// ============== HELPERS ==============
function sanitizeInput(str?: string): string {
  if (!str) return '';
  return str.trim();
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


/** Problems that block saving — shown in the editor and as a toast on save */
function getProductIssues(product: Product): string[] {
  const issues: string[] = [];
  if (!product.name?.trim()) issues.push('กรุณาตั้งชื่อสินค้า');
  if (!validatePrice(Number(product.basePrice))) issues.push('ราคาพื้นฐานต้องอยู่ระหว่าง 0–999,999 บาท');
  const badSizes = Object.entries(product.sizePricing || {})
    .filter(([, price]) => !validatePrice(Number(price)))
    .map(([size]) => size);
  if (badSizes.length) issues.push(`ราคาไซส์ ${badSizes.join(', ')} ไม่ถูกต้อง`);
  return issues;
}

// ============== TYPES ==============
export interface ProductsViewProps {
  config: ShopConfig;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  saveFullConfig: (config: ShopConfig, options?: { deletedProductIds?: string[] }) => Promise<boolean> | void;
  showToast: (type: 'success' | 'error' | 'info' | 'warning', message: string) => void;
  addLog: (action: string, detail: string, overrides?: { config?: ShopConfig }) => void;
  saving: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
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

// ============== PRODUCT LIST ITEMS ==============
type SaleState = 'selling' | 'upcoming' | 'ended' | 'hidden';

const SALE_STATE: Record<SaleState, { label: string; className: string; dot: string }> = {
  selling: { label: 'กำลังขาย', className: 'bg-success/12 text-success dark:text-success', dot: 'bg-success' },
  upcoming: { label: 'รอเปิดขาย', className: 'bg-warning/14 text-warning dark:text-warning', dot: 'bg-warning' },
  ended: { label: 'หมดเวลาขาย', className: 'bg-destructive/12 text-destructive dark:text-destructive', dot: 'bg-destructive' },
  hidden: { label: 'ปิดขาย / แบบร่าง', className: 'bg-muted text-muted-foreground', dot: 'bg-muted-foreground/60' },
};

function getSaleState(product: Product): SaleState {
  if (!product.isActive) return 'hidden';
  const { status } = isProductOpen(product);
  if (status === 'upcoming') return 'upcoming';
  if (status === 'ended') return 'ended';
  return 'selling';
}

function productCategory(product: Product): string {
  return product.category || (product.type === 'OTHER' ? 'OTHER' : 'APPAREL');
}

function productMeta(product: Product): string {
  const p = product as Product & { stock?: number | null };
  const parts = [CATEGORY_LABELS[productCategory(product)] || productCategory(product)];
  const sizes = Object.keys(product.sizePricing || {}).length;
  if (sizes) parts.push(`${sizes} ไซส์`);
  if (p.stock != null) parts.push(`สต็อก ${p.stock}`);
  return parts.join(' · ');
}

function SaleBadge({ state, className }: { state: SaleState; className?: string }) {
  const s = SALE_STATE[state];
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[0.7rem] font-semibold', s.className, className)}>
      <span className={cn('size-1.5 rounded-full', s.dot)} />
      {s.label}
    </span>
  );
}

type ProductActions = {
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  onPickupSetting: () => void;
  onDuplicate: () => void;
  onCopyLink: () => void;
};

function ProductMenu({ product, actions }: { product: Product; actions: ProductActions }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="ตัวเลือกเพิ่มเติม">
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onSelect={actions.onEdit}>
          <Edit /> แก้ไขสินค้า
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={actions.onDuplicate}>
          <Copy /> ทำสำเนา
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={actions.onCopyLink}>
          <LinkIcon /> คัดลอกลิงก์สินค้า
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={actions.onPickupSetting}>
          <LocalMall />
          {product.pickup?.enabled ? 'รับหน้าร้าน (เปิดอยู่)' : 'ตั้งค่ารับหน้าร้าน'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={actions.onDelete}>
          <Delete /> ลบสินค้า
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ProductThumb({ product, className }: { product: Product; className?: string }) {
  const img = product.coverImage || product.images?.[0];
  return img ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={img} alt="" loading="lazy" className={cn('object-cover', className)} />
  ) : (
    <div className={cn('grid place-items-center bg-muted text-muted-foreground', className)}>
      {CATEGORY_ICON_COMPONENTS[productCategory(product)] || <Inventory size={18} />}
    </div>
  );
}

const ProductCardItem = ({ product, actions }: { product: Product; actions: ProductActions }): JSX.Element => {
  const state = getSaleState(product);
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors hover:border-primary/40">
      <button type="button" onClick={actions.onEdit} className="relative block aspect-[4/3] w-full overflow-hidden bg-muted text-left">
        <ProductThumb product={product} className={cn('size-full transition-transform duration-300 group-hover:scale-[1.03]', state !== 'selling' && 'opacity-60')} />
        <SaleBadge state={state} className="absolute top-2.5 left-2.5 bg-background/90 shadow-sm backdrop-blur" />
        {product.pickup?.enabled ? (
          <span className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5 text-[0.7rem] font-medium shadow-sm backdrop-blur">
            <LocalMall size={11} /> รับหน้าร้าน
          </span>
        ) : null}
      </button>
      <div className="flex flex-1 flex-col gap-1 p-3.5">
        <button type="button" onClick={actions.onEdit} className="text-left">
          <h3 className="line-clamp-1 text-sm font-semibold hover:underline" title={product.name}>
            {product.name || 'ไม่มีชื่อสินค้า'}
          </h3>
        </button>
        <p className="truncate text-xs text-muted-foreground">{productMeta(product)}</p>
        <p className="mt-1 text-base font-bold tabular-nums">฿{Number(product.basePrice || 0).toLocaleString()}</p>
      </div>
      <div className="flex items-center gap-2 border-t border-border px-3.5 py-2">
        <label className="flex flex-1 cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <Switch checked={!!product.isActive} onCheckedChange={actions.onToggle} aria-label="เปิด/ปิดการขาย" />
          {product.isActive ? 'เปิดขาย' : 'ปิดขาย'}
        </label>
        <Button variant="ghost" size="sm" onClick={actions.onEdit}>
          <Edit /> แก้ไข
        </Button>
        <ProductMenu product={product} actions={actions} />
      </div>
    </article>
  );
};

const ProductRowItem = ({ product, actions }: { product: Product; actions: ProductActions }): JSX.Element => {
  const state = getSaleState(product);
  return (
    <li className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/40 md:px-4">
      <button type="button" onClick={actions.onEdit} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <ProductThumb product={product} className="size-12 shrink-0 rounded-lg" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{product.name || 'ไม่มีชื่อสินค้า'}</span>
          <span className="block truncate text-xs text-muted-foreground">{productMeta(product)}</span>
        </span>
      </button>
      <span className="hidden sm:block">
        <SaleBadge state={state} />
      </span>
      <span className="w-20 shrink-0 text-right text-sm font-semibold tabular-nums">
        ฿{Number(product.basePrice || 0).toLocaleString()}
      </span>
      <Switch checked={!!product.isActive} onCheckedChange={actions.onToggle} aria-label="เปิด/ปิดการขาย" />
      <ProductMenu product={product} actions={actions} />
    </li>
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
            <LocalMall className="text-primary" />
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
                ? 'border border-success/30 bg-success/10'
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
              className="data-[state=checked]:bg-success"
            />
          </div>

          {pickup.enabled && (
            <div className="flex flex-col gap-4">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1 text-primary">
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
                <div className="min-w-0 space-y-1.5">
                  <Label className="flex items-center gap-1 text-primary">
                    <CalendarDays size={14} /> วันเริ่มรับสินค้า
                  </Label>
                  <DateTimePicker
                    id="product-pickup-start"
                    value={pickup.startDate}
                    onChange={(local) => setPickup({ ...pickup, startDate: local })}
                    placeholder="เลือกวันและเวลาเริ่มรับ"
                    buttonClassName={cn(inputClass, 'h-10')}
                  />
                </div>
                <div className="min-w-0 space-y-1.5">
                  <Label className="flex items-center gap-1 text-primary">
                    <CalendarDays size={14} /> วันสิ้นสุดรับสินค้า
                  </Label>
                  <DateTimePicker
                    id="product-pickup-end"
                    value={pickup.endDate}
                    onChange={(local) => setPickup({ ...pickup, endDate: local })}
                    placeholder="เลือกวันและเวลาสิ้นสุดรับ"
                    buttonClassName={cn(inputClass, 'h-10')}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="flex items-center gap-1 text-primary">
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

              <div className="rounded-xl border border-primary/20 bg-primary/10 p-4">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="auto-update-orders"
                    checked={autoUpdateOrders}
                    onCheckedChange={(checked) => setAutoUpdateOrders(checked === true)}
                    className="mt-0.5 border-primary data-[state=checked]:bg-primary"
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
  isNew,
}: {
  product: Product;
  isNew: boolean;
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
  const [triedSave, setTriedSave] = useState(false);
  const save = (mode: 'publish' | 'draft') => {
    setTriedSave(true);
    onSave(mode);
  };
  const MAX_IMAGE_SIZE = 3 * 1024 * 1024;

  const productAny = product as Product & Record<string, unknown>;

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
    const nextChart = { ...(product.sizeChart || {}) };
    delete nextChart[size];
    onChange({
      ...product,
      sizePricing: next,
      sizeChart: Object.keys(nextChart).length ? nextChart : undefined,
    });
  };

  const handleSizeChartChange = (size: string, field: 'chest' | 'length', value: number) => {
    if (!size || Number.isNaN(value)) return;
    const prev = product.sizeChart?.[size] || { chest: 0, length: 0 };
    const next = {
      ...(product.sizeChart || {}),
      [size]: { ...prev, [field]: Math.max(0, value) },
    };
    onChange({ ...product, sizeChart: next });
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
    upcoming: {
      icon: <AccessTime size={16} />,
      text: product.showStartDate === false
        ? 'สินค้าจะเปิดขายเมื่อถึงเวลาที่กำหนด (ไม่แสดงวันเปิดขายบนหน้าร้าน)'
        : 'สินค้าจะเปิดขายเมื่อถึงเวลาที่กำหนด (แสดงวันเปิดขายบนหน้าร้าน)',
      color: '#f59e0b',
    },
    active: { icon: <FiberManualRecord size={12} className="text-success" />, text: 'สินค้ากำลังเปิดขายอยู่', color: '#10b981' },
    ended: { icon: <FiberManualRecord size={12} className="text-destructive" />, text: 'หมดเวลาขายแล้ว', color: '#ef4444' },
    always: { icon: <DateRange size={16} />, text: 'ไม่มีกำหนดเวลา (เปิดตลอด)', color: 'var(--text-muted)' },
  };
  const schedulePreview = scheduleInfo[scheduleStatus];
  const previewCover = product.coverImage || product.images?.[0] || '';
  const isApparel = category === 'APPAREL' || !productAny.category;
  const navSections = [
    { id: 'pe-basic', label: 'ข้อมูลพื้นฐาน', show: true },
    { id: 'pe-camp', label: 'ข้อมูลค่าย', show: category === 'CAMP_FEE' || subType === 'CAMP_REGISTRATION' },
    { id: 'pe-event', label: 'ข้อมูลอีเวนต์', show: category === 'EVENT' || subType === 'EVENT_TICKET' },
    { id: 'pe-pricing', label: 'ราคาและสต็อก', show: true },
    { id: 'pe-apparel', label: 'ตัวเลือกเสื้อ', show: isApparel },
    { id: 'pe-sizes', label: 'ราคาต่อไซส์', show: isApparel && productAny.options?.requiresSize !== false },
    { id: 'pe-variants', label: 'ตัวเลือกสินค้า', show: needsVariants() },
    { id: 'pe-schedule', label: 'กำหนดเวลาขาย', show: true },
    { id: 'pe-images', label: 'รูปภาพ', show: true },
    { id: 'pe-patterns', label: 'ลายเสื้อ', show: category === 'APPAREL' || (!productAny.category && product.type !== 'OTHER') },
    { id: 'pe-options', label: 'ตัวเลือกเพิ่มเติม', show: true },
    { id: 'pe-tags', label: 'แท็ก', show: true },
  ].filter((x) => x.show);
  const issues = getProductIssues(product);
  const checklist = [
    { ok: Boolean(product.name?.trim()), label: 'ตั้งชื่อสินค้า', target: 'pe-basic' },
    { ok: validatePrice(product.basePrice) && Number(product.basePrice) > 0, label: 'กำหนดราคา', target: 'pe-pricing' },
    { ok: Boolean(previewCover), label: 'เพิ่มรูปสินค้า', target: 'pe-images' },
    { ok: scheduleStatus !== 'ended', label: 'ช่วงเวลาขายยังไม่หมด', target: 'pe-schedule' },
  ];
  const jumpTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <Dialog open={!!product} onOpenChange={() => {}}>
      <DialogContent
        fullscreen
        showCloseButton={false}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => {
          e.preventDefault();
          onClose();
        }}
        className="gap-0 bg-[var(--background)] text-[var(--foreground)]"
      >
        <header className="flex shrink-0 items-center gap-3 border-b border-border bg-background px-4 py-3 sm:px-6">
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="ปิด">
            <Close />
          </Button>
          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate text-left text-base font-semibold">
              {isNew ? 'เพิ่มสินค้าใหม่' : 'แก้ไขสินค้า'}
            </DialogTitle>
            <p className="truncate text-xs text-muted-foreground">
              {product.name?.trim() || 'ยังไม่ได้ตั้งชื่อ'}
              <span className="mx-1.5">·</span>
              {product.isActive ? 'เผยแพร่' : 'แบบร่าง'}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => save('draft')} disabled={isSaving} className="hidden sm:inline-flex">
            บันทึกแบบร่าง
          </Button>
          <Button size="sm" onClick={() => save('publish')} disabled={isSaving}>
            {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
            {isSaving ? 'กำลังบันทึก…' : 'บันทึกและเผยแพร่'}
          </Button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto grid w-full max-w-6xl gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-6">
            <div className="flex min-w-0 flex-col gap-5">
              <section id="pe-basic" className={sectionClass}>
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
                <section id="pe-camp" className="scroll-mt-4 space-y-3 rounded-2xl border border-warning/30 bg-warning/10 p-4">
                  <p className="flex items-center gap-2 text-sm font-bold text-warning">
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
                <section id="pe-event" className="scroll-mt-4 space-y-3 rounded-2xl border border-primary/30 bg-primary/10 p-4">
                  <p className="flex items-center gap-2 text-sm font-bold text-primary">
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

              <section id="pe-pricing" className={sectionClass}>
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
                <section id="pe-apparel" className={sectionClass}>
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
                      className="data-[state=checked]:bg-success"
                    />
                  </div>
                </section>
              )}

              {(category === 'APPAREL' || !productAny.category) &&
                productAny.options?.requiresSize !== false && (
                  <section id="pe-sizes" className={sectionClass}>
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
                            product.sizePricing?.[size] && 'border-primary/40 bg-primary/15'
                          )}
                          onClick={() => handleSizePriceChange(size, product.basePrice || 0)}
                        >
                          {product.sizePricing?.[size]
                            ? `${size}: ${product.sizePricing[size]?.toLocaleString()}฿`
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
                          className="text-destructive"
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
                    {Object.keys(product.sizePricing || {}).length > 0 && (
                      <div className="mt-3 space-y-2 rounded-lg border border-[var(--glass-border)] bg-[var(--surface)] p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-bold">ตารางวัดไซส์ (นิ้ว)</p>
                          <p className="text-xs text-[var(--text-muted)]">รอบอก / ความยาว — ว่างได้ถ้าใช้ค่ามาตรฐาน</p>
                        </div>
                        {Object.keys(product.sizePricing || {}).map((size) => (
                          <div key={`chart-${size}`} className="grid grid-cols-[64px_1fr_1fr] items-center gap-2">
                            <span className="text-xs font-bold text-[var(--foreground)]">{size}</span>
                            <Input
                              type="number"
                              min={0}
                              className={inputClass}
                              placeholder="รอบอก"
                              value={product.sizeChart?.[size]?.chest ?? ''}
                              onChange={(e) =>
                                handleSizeChartChange(
                                  size,
                                  'chest',
                                  e.target.value === '' ? 0 : Number(e.target.value)
                                )
                              }
                            />
                            <Input
                              type="number"
                              min={0}
                              className={inputClass}
                              placeholder="ยาว"
                              value={product.sizeChart?.[size]?.length ?? ''}
                              onChange={(e) =>
                                handleSizeChartChange(
                                  size,
                                  'length',
                                  e.target.value === '' ? 0 : Number(e.target.value)
                                )
                              }
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                )}

              {needsVariants() && (
                <section id="pe-variants" className="scroll-mt-4 space-y-3 rounded-2xl border border-primary/30 bg-primary/10 p-4">
                  <p className="flex items-center gap-2 text-sm font-bold text-primary">
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
                            className={variant.isActive ? 'text-success' : 'text-slate-500'}
                          >
                            {variant.isActive ? <Visibility size={18} /> : <VisibilityOff size={18} />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveVariant(String(variant.id))}
                            className="text-destructive"
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
                      className="bg-primary text-white"
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
                              'cursor-pointer border-dashed border-primary/50 text-primary',
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

              <section id="pe-schedule" className={sectionClass}>
                <div className="flex items-center gap-3">
                  <div className="inline-flex shrink-0 items-center justify-center text-primary">
                    <DateRange size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-bold">กำหนดเวลาขาย</p>
                    <p className="text-xs text-[var(--text-muted)]">ตั้งเวลาเปิด-ปิดขายอัตโนมัติ</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="min-w-0 space-y-1.5">
                    <Label className="flex items-center gap-1 text-[var(--text-muted)]">
                      <FiberManualRecord size={10} className="text-success" /> เปิดขายเมื่อ
                    </Label>
                    <DateTimePicker
                      id="product-sale-start"
                      value={product.startDate}
                      onChange={(local) => onChange({ ...product, startDate: local })}
                      placeholder="เลือกวันและเวลาเปิดขาย"
                      buttonClassName={cn(inputClass, 'h-10')}
                    />
                    {product.startDate && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 text-xs text-[var(--text-muted)]"
                        onClick={() => onChange({ ...product, startDate: '' })}
                      >
                        ✕ ล้างวันเริ่ม
                      </Button>
                    )}
                  </div>
                  <div className="min-w-0 space-y-1.5">
                    <Label className="flex items-center gap-1 text-[var(--text-muted)]">
                      <FiberManualRecord size={10} className="text-destructive" /> ปิดขายเมื่อ
                    </Label>
                    <DateTimePicker
                      id="product-sale-end"
                      value={product.endDate}
                      onChange={(local) => onChange({ ...product, endDate: local })}
                      placeholder="เลือกวันและเวลาปิดขาย"
                      buttonClassName={cn(inputClass, 'h-10')}
                    />
                    {product.endDate && (
                      <Button
                        type="button"
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
                <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-3.5 py-2.5">
                  <div className="min-w-0">
                    <Label htmlFor="product-show-start-date" className="cursor-pointer text-sm font-medium text-foreground">
                      แสดงวันเปิดขายบนหน้าร้าน
                    </Label>
                    <p className="text-xs text-[var(--text-muted)]">
                      {product.showStartDate !== false
                        ? 'แสดงวันเปิดขาย (เช่น เปิด 31/12/2569) ใต้ป้ายเปิดขายเร็วๆ นี้'
                        : 'ไม่แสดงวันเปิดขาย — แสดงเฉพาะข้อความ เปิดขายเร็วๆ นี้'}
                    </p>
                  </div>
                  <Switch
                    id="product-show-start-date"
                    checked={product.showStartDate !== false}
                    onCheckedChange={(checked) => onChange({ ...product, showStartDate: checked })}
                  />
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

              <section id="pe-images" className={sectionClass}>
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
                            ? 'border-primary ring-2 ring-primary/35'
                            : 'border-[var(--glass-border)]'
                        )}
                      >
                        {isCover && (
                          <Badge className="absolute left-1.5 top-1.5 z-10 bg-primary">รูปปก</Badge>
                        )}
                        <img src={img} alt={`product-${idx}`} className="block h-[140px] w-full object-cover" />
                        <div className="absolute inset-0 flex flex-col justify-end gap-1 bg-gradient-to-t from-black/70 to-transparent p-2">
                          <Button
                            size="sm"
                            className="bg-primary/90 text-white"
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
                <section id="pe-patterns" className="scroll-mt-4 space-y-3 rounded-2xl border border-primary/30 bg-primary/10 p-4">
                  <p className="flex items-center gap-2 text-sm font-bold text-primary">
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
                                ? 'border-primary ring-2 ring-primary/35'
                                : 'border-[var(--glass-border)]'
                            )}
                          >
                            <div className="relative flex h-[90px] w-full items-center justify-center overflow-hidden rounded-lg border border-[var(--glass-border)] bg-slate-900/40">
                              {isPatternCover && (
                                <Badge className="absolute left-1 top-1 z-10 h-5 bg-primary text-[0.65rem]">
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
                                    className="bg-primary/90"
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
                                className={isActive ? 'text-success' : 'text-slate-500'}
                              >
                                {isActive ? <Visibility size={18} /> : <VisibilityOff size={18} />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemovePattern(String(pattern.id))}
                                className="text-destructive"
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
                      className="bg-primary text-white"
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

              <section id="pe-options" className={sectionClass}>
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

              <section id="pe-tags" className={sectionClass}>
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
                    className="bg-primary"
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
                  className="data-[state=checked]:bg-success"
                />
              </div>
            </div>

            <aside className="order-first flex flex-col gap-4 lg:order-none lg:sticky lg:top-0 lg:self-start">
              {triedSave && issues.length > 0 ? (
                <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
                  <p className="mb-1.5 font-semibold text-destructive">ยังบันทึกไม่ได้</p>
                  <ul className="list-disc space-y-0.5 pl-5 text-xs text-destructive">
                    {issues.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="hidden rounded-2xl border border-border bg-card p-4 lg:block">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">ความพร้อม</p>
                <ul className="space-y-1.5">
                  {checklist.map((c) => (
                    <li key={c.label}>
                      <button
                        type="button"
                        onClick={() => jumpTo(c.target)}
                        className="flex w-full items-center gap-2 text-left text-sm hover:underline"
                      >
                        <span
                          className={cn(
                            'grid size-4 shrink-0 place-items-center rounded-full',
                            c.ok ? 'bg-success text-white' : 'border border-border',
                          )}
                        >
                          {c.ok ? <Check size={11} strokeWidth={3} /> : null}
                        </span>
                        <span className={c.ok ? 'text-muted-foreground' : ''}>{c.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">ไปที่ส่วน</p>
                <nav className="flex flex-col">
                  {navSections.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => jumpTo(n.id)}
                      className="rounded-md px-2 py-1 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      {n.label}
                    </button>
                  ))}
                </nav>
              </div>

              <div className="hidden rounded-2xl border border-border bg-card lg:block">
                <p className="px-4 pt-3 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">ตัวอย่างในร้าน</p>
                <div className="mx-4 aspect-[4/3] overflow-hidden rounded-xl bg-muted">
                  {previewCover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previewCover} alt="" className="size-full object-cover" />
                  ) : (
                    <div className="grid size-full place-items-center text-muted-foreground">
                      <ImageIcon size={28} />
                    </div>
                  )}
                </div>
                <div className="space-y-1 p-4">
                  <p className="line-clamp-2 text-sm font-semibold">{product.name || 'ชื่อสินค้า'}</p>
                  <p className="text-lg font-bold tabular-nums">฿{(product.basePrice || 0)?.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">
                    {CATEGORY_LABELS[category] || category} · {SUBTYPE_LABELS[subType] || subType}
                  </p>
                </div>
              </div>
            </aside>
          </div>
        </div>

        <DialogFooter className="shrink-0 flex-row gap-2 border-t border-border bg-background px-4 py-3 sm:hidden">
          <Button variant="outline" className="flex-1" onClick={() => save('draft')} disabled={isSaving}>
            บันทึกแบบร่าง
          </Button>
          <Button className="flex-1" onClick={() => save('publish')} disabled={isSaving}>
            {isSaving ? 'กำลังบันทึก…' : 'เผยแพร่'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ============== PRODUCTS VIEW ==============
const VIEW_MODE_KEY = 'admin-products-view';
type ViewMode = 'grid' | 'list';
const viewModeListeners = new Set<() => void>();
function readViewMode(): ViewMode {
  try {
    return window.localStorage.getItem(VIEW_MODE_KEY) === 'list' ? 'list' : 'grid';
  } catch {
    return 'grid';
  }
}
function writeViewMode(mode: ViewMode) {
  try {
    window.localStorage.setItem(VIEW_MODE_KEY, mode);
  } catch {
    /* ignore */
  }
  viewModeListeners.forEach((l) => l());
}
function subscribeViewMode(listener: () => void) {
  viewModeListeners.add(listener);
  return () => {
    viewModeListeners.delete(listener);
  };
}

export function ProductsView({
  config,
  searchTerm,
  setSearchTerm,
  saveFullConfig,
  showToast,
  addLog,
  saving,
  onRefresh,
  isRefreshing,
}: ProductsViewProps): JSX.Element {
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingSnapshot, setEditingSnapshot] = useState('');
  const [discardPromptOpen, setDiscardPromptOpen] = useState(false);
  const [pickupSettingProduct, setPickupSettingProduct] = useState<Product | null>(null);
  const [pickupSaving, setPickupSaving] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [stateFilter, setStateFilter] = useState<'ALL' | SaleState>('ALL');
  // Server snapshot is always 'grid' so SSR markup matches the first client render
  const viewMode = useSyncExternalStore(subscribeViewMode, readViewMode, () => 'grid' as ViewMode);
  const { confirm, ConfirmDialog: ProductConfirmDialog } = useConfirmDialog();

  // Auto-fetch latest product data when component mounts
  useEffect(() => {
    onRefresh?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const products = config.products;

  const stateCounts = useMemo(() => {
    const counts: Record<SaleState, number> = { selling: 0, upcoming: 0, ended: 0, hidden: 0 };
    for (const p of products) counts[getSaleState(p)] += 1;
    return counts;
  }, [products]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of products) {
      const c = productCategory(p);
      counts[c] = (counts[c] || 0) + 1;
    }
    return counts;
  }, [products]);

  const filteredProducts = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return products.filter((p) => {
      if (selectedCategory !== 'ALL' && productCategory(p) !== selectedCategory) return false;
      if (stateFilter !== 'ALL' && getSaleState(p) !== stateFilter) return false;
      if (!term) return true;
      return (
        (p.name || '').toLowerCase().includes(term) ||
        p.id.toLowerCase().includes(term) ||
        (p.type || '').toLowerCase().includes(term) ||
        (p.category || '').toLowerCase().includes(term) ||
        (CATEGORY_LABELS[productCategory(p)] || '').includes(term)
      );
    });
  }, [searchTerm, selectedCategory, stateFilter, products]);

  const setMode = (mode: ViewMode) => writeViewMode(mode);

  const openEditor = (product: Product) => {
    setEditingProduct(product);
    setEditingSnapshot(JSON.stringify(product));
  };

  // The discard prompt must be a Radix dialog: it opens on top of the (Radix, modal) editor,
  // which disables pointer events outside Radix layers — an MUI confirm would be unclickable.
  const closeEditor = () => {
    if (editingProduct && JSON.stringify(editingProduct) !== editingSnapshot) {
      setDiscardPromptOpen(true);
      return;
    }
    setEditingProduct(null);
  };

  const createNewProduct = () => {
    const now = new Date().toISOString();
    openEditor({
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
      showStartDate: true,
      isActive: true,
      options: { hasCustomName: false, hasCustomNumber: false, hasLongSleeve: false, longSleevePrice: 50 },
      customTags: [],
      createdAt: now,
      updatedAt: now,
    });
  };

  const duplicateProduct = (product: Product) => {
    const now = new Date().toISOString();
    const copy = JSON.parse(JSON.stringify(product)) as Product & { slug?: string };
    copy.id = `prod_${Date.now()}`;
    copy.name = `${product.name} (สำเนา)`;
    copy.isActive = false;
    copy.slug = undefined;
    copy.pickup = undefined;
    copy.createdAt = now;
    copy.updatedAt = now;
    openEditor(copy);
    showToast('info', 'สร้างสำเนาแล้ว — ตรวจสอบและกดบันทึก');
  };

  const copyProductLink = async (product: Product) => {
    const url = `${window.location.origin}/?p=${product.id}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast('success', 'คัดลอกลิงก์สินค้าแล้ว');
    } catch {
      showToast('error', 'คัดลอกไม่สำเร็จ');
    }
  };

  const handleDelete = async (product: Product) => {
    const ok = await confirm({
      title: `ลบ "${product.name || 'สินค้า'}"?`,
      message: 'การลบสินค้าจะไม่สามารถย้อนกลับได้ ถ้าแค่ต้องการหยุดขาย ให้ปิดสวิตช์ "เปิดขาย" แทน',
      variant: 'warning',
      confirmText: 'ลบเลย',
      cancelText: 'ยกเลิก',
      destructive: true,
    });
    if (ok) {
      const newProducts = config.products.filter((p) => p.id !== product.id);
      // Name the deleted product so the server accepts removing the last one too
      const saved = await saveFullConfig({ ...config, products: newProducts }, { deletedProductIds: [product.id] });
      if (saved !== false) showToast('success', 'ลบสินค้าเรียบร้อยแล้ว');
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

    const issues = getProductIssues(nextProduct);
    if (issues.length > 0) {
      showToast('warning', issues[0]);
      return;
    }

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

  const actionsFor = (p: Product): ProductActions => ({
    onEdit: () => openEditor(p),
    onDelete: () => handleDelete(p),
    onToggle: () => handleToggleActive(p.id),
    onPickupSetting: () => setPickupSettingProduct(p),
    onDuplicate: () => duplicateProduct(p),
    onCopyLink: () => copyProductLink(p),
  });

  const stateTabs: { key: 'ALL' | SaleState; label: string; count: number }[] = [
    { key: 'ALL', label: 'ทั้งหมด', count: products.length },
    { key: 'selling', label: SALE_STATE.selling.label, count: stateCounts.selling },
    { key: 'upcoming', label: SALE_STATE.upcoming.label, count: stateCounts.upcoming },
    { key: 'hidden', label: 'ปิดขาย / แบบร่าง', count: stateCounts.hidden },
    { key: 'ended', label: SALE_STATE.ended.label, count: stateCounts.ended },
  ];
  const hasFilters = Boolean(searchTerm) || selectedCategory !== 'ALL' || stateFilter !== 'ALL';

  return (
    <div className="flex flex-col gap-4">
      <ProductConfirmDialog />

      <Dialog open={discardPromptOpen} onOpenChange={setDiscardPromptOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>ทิ้งการแก้ไข?</DialogTitle>
            <DialogDescription>
              คุณยังไม่ได้บันทึกการเปลี่ยนแปลง ถ้าปิดตอนนี้ข้อมูลที่แก้จะหายไป
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscardPromptOpen(false)} autoFocus>
              กลับไปแก้ต่อ
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setDiscardPromptOpen(false);
                setEditingProduct(null);
              }}
            >
              ทิ้งการแก้ไข
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="สินค้าทั้งหมด" value={products.length} icon={<Inventory />} />
        <StatCard
          label="กำลังขาย"
          value={stateCounts.selling}
          icon={<FiberManualRecord />}
          tone="success"
          onClick={() => setStateFilter(stateFilter === 'selling' ? 'ALL' : 'selling')}
          actionLabel="กรองเฉพาะสินค้าที่กำลังขาย"
        />
        <StatCard
          label="รอเปิดขาย"
          value={stateCounts.upcoming}
          icon={<AccessTime />}
          tone="warning"
          onClick={() => setStateFilter(stateFilter === 'upcoming' ? 'ALL' : 'upcoming')}
          actionLabel="กรองเฉพาะสินค้าที่รอเปิดขาย"
        />
        <StatCard
          label="ปิดขาย / หมดเวลา"
          value={stateCounts.hidden + stateCounts.ended}
          icon={<VisibilityOff />}
          onClick={() => setStateFilter(stateFilter === 'hidden' ? 'ALL' : 'hidden')}
          actionLabel="กรองเฉพาะสินค้าที่ปิดขาย"
        />
      </div>

      {/* Toolbar */}
      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)] md:p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="ค้นหาชื่อสินค้า, หมวดหมู่ หรือรหัส…"
              className="h-9 pr-9 pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="ค้นหาสินค้า"
            />
            {searchTerm ? (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                aria-label="ล้างคำค้นหา"
                className="absolute top-1/2 right-2 grid size-6 !min-h-0 !min-w-0 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Close size={14} />
              </button>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="h-9 min-w-0 flex-1 sm:w-[190px] sm:flex-none" aria-label="หมวดหมู่">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="ALL">ทุกหมวดหมู่ ({products.length})</SelectItem>
                {PRODUCT_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    <span className="inline-flex items-center gap-2">
                      {CATEGORY_ICON_COMPONENTS[c]}
                      {CATEGORY_LABELS[c] || c} ({categoryCounts[c] || 0})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex h-9 shrink-0 items-center rounded-md border border-input p-0.5" role="group" aria-label="รูปแบบการแสดงผล">
              <button
                type="button"
                onClick={() => setMode('grid')}
                aria-pressed={viewMode === 'grid'}
                aria-label="แสดงแบบการ์ด"
                className={cn('grid h-full w-8 !min-h-0 !min-w-0 place-items-center rounded-[5px]', viewMode === 'grid' ? 'bg-muted text-foreground' : 'text-muted-foreground')}
              >
                <LayoutGrid size={16} />
              </button>
              <button
                type="button"
                onClick={() => setMode('list')}
                aria-pressed={viewMode === 'list'}
                aria-label="แสดงแบบรายการ"
                className={cn('grid h-full w-8 !min-h-0 !min-w-0 place-items-center rounded-[5px]', viewMode === 'list' ? 'bg-muted text-foreground' : 'text-muted-foreground')}
              >
                <List size={16} />
              </button>
            </div>
            <Button variant="outline" size="icon" onClick={() => onRefresh?.()} disabled={isRefreshing} aria-label="ดึงข้อมูลล่าสุด" title="ดึงข้อมูลล่าสุด">
              <RefreshCw className={cn(isRefreshing && 'animate-spin')} />
            </Button>
            <Button onClick={createNewProduct} className="shrink-0">
              <Add /> <span className="hidden sm:inline">เพิ่มสินค้า</span>
            </Button>
          </div>
        </div>

        <div className="-mx-3 overflow-x-auto px-3 md:-mx-4 md:px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex w-max items-center gap-1.5" role="tablist" aria-label="กรองตามสถานะการขาย">
            {stateTabs.map((t) => {
              const active = stateFilter === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setStateFilter(t.key)}
                  className={cn(
                    'inline-flex h-8 !min-h-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium whitespace-nowrap transition-colors',
                    active ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  {t.key !== 'ALL' ? <span className={cn('size-1.5 rounded-full', SALE_STATE[t.key].dot)} /> : null}
                  {t.label}
                  <span className={cn('rounded-full px-1.5 text-[0.65rem] font-semibold tabular-nums', active ? 'bg-background/20' : 'bg-muted')}>
                    {t.count}
                  </span>
                </button>
              );
            })}
            {hasFilters ? (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('ALL');
                  setStateFilter('ALL');
                }}
                className="ml-1 !min-h-0 text-xs font-medium text-primary hover:underline"
              >
                ล้างตัวกรอง
              </button>
            ) : null}
          </div>
        </div>
      </section>

      {/* Products */}
      {filteredProducts.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card">
          <EmptyState
            icon={<Inventory />}
            title={products.length === 0 ? 'ยังไม่มีสินค้า' : 'ไม่พบสินค้า'}
            description={
              products.length === 0
                ? 'เริ่มจากเพิ่มสินค้าชิ้นแรกของร้าน'
                : searchTerm
                  ? `ไม่พบสินค้าที่ตรงกับ "${searchTerm}"`
                  : 'ลองเปลี่ยนตัวกรอง'
            }
            action={
              products.length === 0 ? (
                <Button onClick={createNewProduct}>
                  <Add /> เพิ่มสินค้า
                </Button>
              ) : null
            }
          />
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {filteredProducts.map((p) => (
            <ProductCardItem key={p.id} product={p} actions={actionsFor(p)} />
          ))}
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {filteredProducts.map((p) => (
            <ProductRowItem key={p.id} product={p} actions={actionsFor(p)} />
          ))}
        </ul>
      )}

      {editingProduct && (
        <ProductEditDialog
          product={editingProduct}
          isNew={!config.products.some((p) => p.id === editingProduct.id)}
          onClose={closeEditor}
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
