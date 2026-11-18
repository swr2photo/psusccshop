'use client';

import React from 'react';
import {
  AlertTriangle,
  Loader2,
  Minus,
  Package,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { STATUS_THEME } from '@/lib/adminTheme';
import { getProductShirtNameConfig, SIZES, type Product, type ShirtNameConfig } from '@/lib/config';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { DateTimePicker } from '@/components/ui/date-picker';

// ============== TYPES ==============
export interface OrderEditorCartItem {
  id?: string;
  productId?: string;
  productName?: string;
  size?: string;
  quantity: number;
  unitPrice: number;
  options?: {
    customName?: string;
    customNumber?: string;
    isLongSleeve?: boolean;
    pattern?: string;
  };
}

export interface OrderEditorState {
  open: boolean;
  ref: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  instagram: string;
  amount: number;
  status: string;
  date: string;
  cart: OrderEditorCartItem[];
  profileLoading?: boolean;
}

export interface OrderEditorDialogProps {
  editor: OrderEditorState;
  setEditor: React.Dispatch<React.SetStateAction<OrderEditorState>>;
  products: Product[];
  activeProducts: Product[];
  legacyShirtNameConfig?: ShirtNameConfig;
  statuses: string[];
  statusLabels: Record<string, string>;
  normalizeStatus: (s?: string) => string;
  saving: boolean;
  calcUnitPrice: (item: OrderEditorCartItem, product: Product | undefined) => number;
  onUpdateItem: (idx: number, updates: Partial<OrderEditorCartItem>) => void;
  onChangeProduct: (idx: number, productId: string) => void;
  onAddProduct: (productId: string) => void;
  onRecalculateAll: () => void;
  onLoadProfile: () => void;
  onClose: () => void;
  onSave: () => void;
}

const baht = (n: number) => `฿${(Number(n) || 0).toLocaleString()}`;
const MISSING = '__missing__';

// ============== SMALL PIECES ==============
function Field({
  label,
  htmlFor,
  hint,
  className,
  children,
}: {
  label: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <Label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      {children}
      {hint ? <p className="text-[0.7rem] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Section({
  title,
  action,
  children,
  className,
}: {
  title: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rounded-2xl border border-border bg-card p-4 md:p-5', className)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

// ============== CART ITEM ==============
function CartItemCard({
  item,
  idx,
  props,
}: {
  item: OrderEditorCartItem;
  idx: number;
  props: OrderEditorDialogProps;
}) {
  const { products, activeProducts, calcUnitPrice, onUpdateItem, onChangeProduct, setEditor } = props;
  const product = products.find((p) => p.id === item.productId);
  const catalogPrice = calcUnitPrice(item, product);
  const orderedPrice = Number(item.unitPrice) || 0;
  const priceDiff = catalogPrice - orderedPrice;
  const hasPriceDiff = !!product && orderedPrice !== catalogPrice;
  const productMissing = !product;
  const productInactive = !!product && product.isActive === false;
  const cover = product?.coverImage || product?.images?.[0];
  const patterns = product?.patterns?.filter((p) => p.isActive !== false) || [];
  const sc = getProductShirtNameConfig(product, props.legacyShirtNameConfig);
  const langs = [sc.allowThai ? 'ไทย' : null, sc.allowEnglish ? 'อังกฤษ' : null].filter(Boolean).join('/');
  const productValue = item.productId || MISSING;
  const showLegacyOption = productMissing || productInactive;
  const setOption = (patch: Partial<NonNullable<OrderEditorCartItem['options']>>) =>
    onUpdateItem(idx, { options: { ...item.options, ...patch } });

  const onNameChange = (raw: string) => {
    let pattern = '';
    if (sc.allowEnglish) pattern += 'a-zA-Z';
    if (sc.allowThai) pattern += '฀-๿';
    if (sc.allowSpecialChars && sc.allowedSpecialChars) {
      pattern += sc.allowedSpecialChars.replace(/[\\\]\^\-]/g, '\\$&');
    }
    pattern += '\\s';
    let val = raw.replace(new RegExp(`[^${pattern}]`, 'g'), '');
    if (sc.autoUppercase) val = val.toUpperCase();
    setOption({ customName: val.slice(0, sc.maxLength) });
  };

  return (
    <li
      className={cn(
        'rounded-xl border bg-background/50 p-3 md:p-4',
        hasPriceDiff ? 'border-warning/40' : showLegacyOption ? 'border-destructive/40' : 'border-border',
      )}
    >
      {/* product row */}
      <div className="flex items-start gap-3">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" className="size-14 shrink-0 rounded-lg object-cover ring-1 ring-border" />
        ) : (
          <span className="grid size-14 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
            <Package className="size-5" />
          </span>
        )}
        <div className="min-w-0 flex-1 space-y-1.5">
          <Select value={productValue} onValueChange={(v) => v && v !== MISSING && onChangeProduct(idx, v)}>
            <SelectTrigger className="h-9 w-full" aria-label="สินค้า">
              <SelectValue placeholder="เลือกสินค้า" />
            </SelectTrigger>
            <SelectContent>
              {showLegacyOption ? (
                <SelectItem value={item.productId || MISSING}>
                  {item.productName || product?.name || 'สินค้าเดิม'} {productInactive ? '(ปิดอยู่)' : '(ไม่พบในระบบ)'}
                </SelectItem>
              ) : null}
              {activeProducts.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} — {baht(p.basePrice || 0)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {showLegacyOption ? (
            <p className="flex items-center gap-1 text-[0.7rem] font-medium text-destructive">
              <AlertTriangle className="size-3" />
              {productMissing ? 'ไม่พบสินค้านี้ในระบบ — เลือกสินค้าที่เปิดอยู่แทน' : 'สินค้านี้ถูกปิดแล้ว — แนะนำให้เปลี่ยนเป็นสินค้าที่เปิดอยู่'}
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:text-destructive"
          aria-label="ลบรายการนี้"
          onClick={() => setEditor((prev) => ({ ...prev, cart: prev.cart.filter((_, i) => i !== idx) }))}
        >
          <Trash2 />
        </Button>
      </div>

      {/* options */}
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Field label="ไซส์">
          <Select value={item.size || ''} onValueChange={(v) => onUpdateItem(idx, { size: v })}>
            <SelectTrigger className="h-9 w-full" aria-label="ไซส์">
              <SelectValue placeholder="เลือกไซส์" />
            </SelectTrigger>
            <SelectContent>
              {item.size && !SIZES.includes(item.size as (typeof SIZES)[number]) ? (
                <SelectItem value={item.size}>{item.size}</SelectItem>
              ) : null}
              {SIZES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="จำนวน">
          <div className="flex h-9 items-center rounded-md border border-input dark:bg-input/30">
            <button
              type="button"
              aria-label="ลดจำนวน"
              disabled={item.quantity <= 1}
              onClick={() => onUpdateItem(idx, { quantity: Math.max(1, item.quantity - 1) })}
              className="grid h-full w-9 place-items-center text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
              <Minus className="size-3.5" />
            </button>
            <input
              type="number"
              min={1}
              inputMode="numeric"
              value={item.quantity}
              onChange={(e) => onUpdateItem(idx, { quantity: Math.max(1, Number(e.target.value) || 1) })}
              className="h-full w-full min-w-0 bg-transparent text-center text-sm tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
              aria-label="จำนวน"
            />
            <button
              type="button"
              aria-label="เพิ่มจำนวน"
              onClick={() => onUpdateItem(idx, { quantity: item.quantity + 1 })}
              className="grid h-full w-9 place-items-center text-muted-foreground hover:text-foreground"
            >
              <Plus className="size-3.5" />
            </button>
          </div>
        </Field>
        <Field label={`ชื่อติดเสื้อ (${langs || '—'}, ${sc.minLength}-${sc.maxLength} ตัว)`} className="col-span-2">
          <Input
            value={item.options?.customName || ''}
            onChange={(e) => onNameChange(e.target.value)}
            maxLength={sc.maxLength}
            placeholder={sc.allowThai ? 'เช่น สมชาย' : 'เช่น JOHN'}
            className="h-9"
          />
        </Field>
        <Field label="หมายเลขเสื้อ (0–99)">
          <Input
            value={item.options?.customNumber || ''}
            inputMode="numeric"
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, '');
              setOption({ customNumber: digits ? String(Math.min(99, Number(digits))) : '' });
            }}
            placeholder="เช่น 10"
            className="h-9"
          />
        </Field>
        {patterns.length > 0 ? (
          <Field label="ลายเสื้อ">
            <Select value={item.options?.pattern || ''} onValueChange={(v) => setOption({ pattern: v })}>
              <SelectTrigger className="h-9 w-full" aria-label="ลายเสื้อ">
                <SelectValue placeholder="เลือกลาย" />
              </SelectTrigger>
              <SelectContent>
                {patterns.map((p) => (
                  <SelectItem key={p.id} value={p.name}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : null}
        <label
          className={cn(
            'flex h-9 cursor-pointer items-center justify-between gap-2 self-end rounded-md border px-3 text-sm',
            patterns.length > 0 ? 'col-span-2' : 'col-span-1 md:col-span-3',
            item.options?.isLongSleeve ? 'border-warning/50 bg-warning/10' : 'border-input',
          )}
        >
          <span className="truncate">แขนยาว (+{baht(product?.options?.longSleevePrice ?? 50)})</span>
          <Switch
            checked={item.options?.isLongSleeve || false}
            onCheckedChange={(v) => setOption({ isLongSleeve: v })}
          />
        </label>
      </div>

      {/* price row */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-sm">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>
            {item.quantity} × {baht(orderedPrice)}
          </span>
          {hasPriceDiff ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/12 px-2 py-0.5 font-medium text-warning dark:text-warning">
              ราคาในระบบ {baht(catalogPrice)} ({priceDiff > 0 ? '+' : ''}
              {baht(priceDiff)})
              <button
                type="button"
                onClick={() => onUpdateItem(idx, { unitPrice: catalogPrice })}
                className="font-semibold underline underline-offset-2"
              >
                ใช้ราคานี้
              </button>
            </span>
          ) : product ? (
            <span className="text-success dark:text-success">ราคาตรงกับระบบ</span>
          ) : null}
        </div>
        <span className="font-semibold tabular-nums">{baht(item.quantity * orderedPrice)}</span>
      </div>
    </li>
  );
}

// ============== MAIN ==============
export function OrderEditorDialog(props: OrderEditorDialogProps) {
  const { editor, setEditor, activeProducts, statuses, statusLabels, normalizeStatus, saving } = props;
  const cartTotal = editor.cart.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0);
  const amountChanged = editor.amount > 0 && editor.amount !== cartTotal;
  const set = <K extends keyof OrderEditorState>(key: K, value: OrderEditorState[K]) =>
    setEditor((prev) => ({ ...prev, [key]: value }));

  return (
    <Dialog
      open={editor.open}
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
    >
      <DialogContent fullscreen showCloseButton={false} className="bg-background">
        {/* header */}
        <header className="flex shrink-0 items-center gap-3 border-b border-border bg-background px-4 py-3 md:px-6">
          <Button variant="ghost" size="icon-sm" onClick={props.onClose} aria-label="ปิด">
            <X />
          </Button>
          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate text-base font-semibold">แก้ไขออเดอร์</DialogTitle>
            <DialogDescription className="truncate font-mono text-xs">#{editor.ref}</DialogDescription>
          </div>
          <Button variant="outline" size="sm" onClick={props.onClose} className="hidden sm:inline-flex">
            ยกเลิก
          </Button>
          <Button size="sm" onClick={props.onSave} disabled={saving}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />}
            {saving ? 'กำลังบันทึก…' : 'บันทึก'}
          </Button>
        </header>

        {/* body */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto grid w-full max-w-6xl gap-4 p-4 md:p-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            {/* left: items */}
            <div className="flex min-w-0 flex-col gap-4">
              <Section
                title={`รายการสินค้า (${editor.cart.length})`}
                action={
                  <Button variant="outline" size="sm" onClick={props.onRecalculateAll} disabled={editor.cart.length === 0}>
                    <RefreshCw /> คำนวณราคาใหม่ทั้งหมด
                  </Button>
                }
              >
                {editor.cart.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                    ยังไม่มีสินค้าในออเดอร์นี้
                  </p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {editor.cart.map((item, idx) => (
                      <CartItemCard key={item.id || idx} item={item} idx={idx} props={props} />
                    ))}
                  </ul>
                )}
                <div className="mt-3 flex flex-col gap-2 rounded-xl border border-dashed border-border p-3 sm:flex-row sm:items-center">
                  <span className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-muted-foreground">
                    <Plus className="size-4" /> เพิ่มสินค้า
                  </span>
                  <Select value="" onValueChange={(v) => v && props.onAddProduct(v)}>
                    <SelectTrigger className="h-9 w-full" aria-label="เลือกสินค้าเพื่อเพิ่ม">
                      <SelectValue placeholder="เลือกสินค้าที่เปิดขายอยู่…" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeProducts.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} — {baht(p.basePrice || 0)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </Section>
            </div>

            {/* right: summary / status / customer */}
            <div className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-0 lg:self-start">
              <Section title="สรุปยอด">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-muted-foreground">ยอดชำระ (จากตะกร้า)</span>
                  <span className="text-2xl font-bold tabular-nums">{baht(cartTotal)}</span>
                </div>
                {amountChanged ? (
                  <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-warning/10 px-2.5 py-1.5 text-xs text-warning dark:text-warning">
                    <AlertTriangle className="size-3.5 shrink-0" />
                    ยอดเดิมในออเดอร์ {baht(editor.amount)} — จะถูกแทนด้วยยอดใหม่เมื่อบันทึก
                  </p>
                ) : null}
                <div className="mt-4">
                  <DateTimePicker
                    id="order-editor-date"
                    label="วันที่สั่งซื้อ"
                    value={editor.date}
                    onChange={(local) => set('date', local)}
                    placeholder="เลือกวันและเวลา"
                  />
                </div>
              </Section>

              <Section title="สถานะ">
                <div className="grid grid-cols-2 gap-1.5">
                  {statuses.map((status) => {
                    const t = STATUS_THEME[normalizeStatus(status)] || STATUS_THEME.PENDING;
                    const active = editor.status === status;
                    return (
                      <button
                        key={status}
                        type="button"
                        onClick={() => set('status', status)}
                        aria-pressed={active}
                        className={cn(
                          'flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs font-medium transition-colors',
                          active ? 'border-transparent' : 'border-border text-muted-foreground hover:bg-muted',
                        )}
                        style={active ? { backgroundColor: t.bg, color: t.text, boxShadow: `inset 0 0 0 1.5px ${t.border}` } : undefined}
                      >
                        <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: t.text }} />
                        <span className="truncate">{statusLabels[status] || status}</span>
                      </button>
                    );
                  })}
                </div>
              </Section>

              <Section
                title="ข้อมูลลูกค้า"
                action={
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={props.onLoadProfile}
                    disabled={!editor.email || editor.profileLoading}
                  >
                    {editor.profileLoading ? <Loader2 className="animate-spin" /> : <UserRound />}
                    ดึงจากโปรไฟล์
                  </Button>
                }
              >
                <div className="grid gap-3">
                  <Field label="ชื่อ-นามสกุล" htmlFor="oe-name">
                    <Input id="oe-name" value={editor.name} onChange={(e) => set('name', e.target.value)} />
                  </Field>
                  <Field label="อีเมล" htmlFor="oe-email">
                    <Input
                      id="oe-email"
                      type="email"
                      value={editor.email}
                      onChange={(e) => set('email', e.target.value)}
                      placeholder="example@email.com"
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="เบอร์โทร" htmlFor="oe-phone">
                      <Input
                        id="oe-phone"
                        inputMode="tel"
                        value={editor.phone}
                        onChange={(e) => set('phone', e.target.value)}
                        placeholder="08x-xxx-xxxx"
                      />
                    </Field>
                    <Field label="Instagram" htmlFor="oe-ig">
                      <Input
                        id="oe-ig"
                        value={editor.instagram}
                        onChange={(e) => set('instagram', e.target.value)}
                        placeholder="@username"
                      />
                    </Field>
                  </div>
                  <Field label="ที่อยู่จัดส่ง" htmlFor="oe-address">
                    <Textarea
                      id="oe-address"
                      rows={3}
                      value={editor.address}
                      onChange={(e) => set('address', e.target.value)}
                      placeholder="บ้านเลขที่ ถนน ตำบล อำเภอ จังหวัด รหัสไปรษณีย์"
                    />
                  </Field>
                </div>
              </Section>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
