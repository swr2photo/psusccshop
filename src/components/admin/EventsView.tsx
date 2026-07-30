'use client';

import React from 'react';
import {
  Plus as Add,
  Trash2 as Delete,
  Pencil as Edit,
  X as Close,
  Save,
  Sparkles,
  Calendar as CalendarIcon,
  Clock as AccessTime,
  Megaphone as Campaign,
  Tag as LocalOffer,
  PartyPopper,
  Image as ImageIcon,
  ToggleRight as ToggleOn,
  ToggleLeft as ToggleOff,
  Loader2,
} from 'lucide-react';

import { ShopConfig, type Product } from '@/lib/config';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

type ShopEvent = NonNullable<ShopConfig['events']>[number];

export interface EventsViewProps {
  config: ShopConfig;
  saveConfig: (newConfig: ShopConfig) => Promise<void>;
  showToast: (type: 'success' | 'error' | 'info' | 'warning', message: string) => void;
  userEmail: string | null | undefined;
  onImageUpload: (file: File) => Promise<string | null>;
}

const EVENT_TYPE_OPTIONS = [
  { value: 'event', label: 'อีเวนท์', icon: 'PartyPopper', color: '#bf5af2' },
  { value: 'promotion', label: 'โปรโมชั่น', icon: 'Sparkles', color: '#ff9f0a' },
  { value: 'sale', label: 'ลดราคา', icon: 'Tag', color: '#ff453a' },
  { value: 'announcement', label: 'ประกาศพิเศษ', icon: 'Megaphone', color: '#0071e3' },
] as const;

const EVENT_TYPE_ICON_MAP: Record<string, React.ReactElement> = {
  PartyPopper: <PartyPopper size={16} />,
  Sparkles: <Sparkles size={16} />,
  Tag: <LocalOffer size={16} />,
  Megaphone: <Campaign size={16} />,
};

const EVENT_COLORS = [
  '#0071e3', '#3b82f6', '#5e5ce6', '#bf5af2',
  '#ff375f', '#ff453a', '#ff9f0a', '#ffd60a',
  '#30d158', '#34c759', '#64d2ff', '#06b6d4',
  '#ec4899', '#f472b6', '#a78bfa', '#fb923c',
];

/** Convert ISO string to local datetime-local value (YYYY-MM-DDTHH:MM) */
function isoToLocalDatetime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Convert local datetime-local value to ISO string (Safari-safe). */
function localDatetimeToIso(localStr?: string): string {
  if (!localStr) return '';
  try {
    const d = new Date(localStr);
    if (isNaN(d.getTime())) return '';
    return d.toISOString();
  } catch {
    return '';
  }
}

function ProductSearchSelect({
  products,
  value,
  onChange,
}: {
  products: Product[];
  value: string;
  onChange: (productId: string) => void;
}) {
  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);

  const selected = products.find((p) => p.id === value) ?? null;

  React.useEffect(() => {
    if (selected) {
      setQuery(selected.name || '');
    } else if (!value) {
      setQuery('');
    }
  }, [selected, value]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => (p.name || '').toLowerCase().includes(q));
  }, [products, query]);

  return (
    <Popover modal={false} open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div>
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              if (!e.target.value.trim()) onChange('');
            }}
            onFocus={() => setOpen(true)}
            placeholder="ค้นหาสินค้า..."
            className="rounded-xl bg-[var(--surface)]"
          />
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="max-h-48 w-[var(--radix-popover-trigger-width)] overflow-y-auto p-1"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {filtered.length === 0 ? (
          <p className="px-3 py-2 text-sm text-[var(--text-muted)]">ไม่พบสินค้า</p>
        ) : (
          filtered.map((option) => {
            const imageUrl = option.coverImage || option.images?.[0];
            return (
              <button
                key={option.id}
                type="button"
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-[var(--glass-bg)]"
                onClick={() => {
                  onChange(option.id);
                  setQuery(option.name || '');
                  setOpen(false);
                }}
              >
                {imageUrl && (
                  <img
                    src={imageUrl}
                    alt=""
                    className="size-9 shrink-0 rounded-lg object-cover"
                  />
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--foreground)]">
                    {option.name}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    ฿{option.basePrice?.toLocaleString()}
                  </p>
                </div>
              </button>
            );
          })
        )}
      </PopoverContent>
    </Popover>
  );
}

export const EventsView = React.memo(function EventsView({
  config,
  saveConfig,
  showToast,
  userEmail,
  onImageUpload,
}: EventsViewProps) {
  const [events, setEvents] = React.useState<ShopEvent[]>(config.events || []);
  const [editingEvent, setEditingEvent] = React.useState<ShopEvent | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [uploadingImage, setUploadingImage] = React.useState(false);
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const configRef = React.useRef(config);
  configRef.current = config;
  const savingRef = React.useRef(false);

  React.useEffect(() => {
    if (savingRef.current) return;
    setEvents(config.events || []);
  }, [config.events]);

  const createNewEvent = (): ShopEvent => ({
    id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    enabled: true,
    title: '',
    description: '',
    color: '#0071e3',
    type: 'promotion',
    ctaText: '',
    ctaLink: '',
    badge: '',
    priority: events.length,
    createdBy: userEmail || 'แอดมิน',
    createdAt: new Date().toISOString(),
  });

  const handleSave = async (event: ShopEvent) => {
    setSaving(true);
    savingRef.current = true;
    try {
      const latestConfig = configRef.current;
      const latestEvents = latestConfig.events || [];
      const existingIndex = latestEvents.findIndex((e) => e.id === event.id);
      let newEvents: ShopEvent[];
      if (existingIndex >= 0) {
        newEvents = latestEvents.map((e) =>
          e.id === event.id ? { ...event, updatedAt: new Date().toISOString() } : e,
        );
      } else {
        newEvents = [...latestEvents, event];
      }
      await saveConfig({ ...latestConfig, events: newEvents });
      setEvents(newEvents);
      setEditingEvent(null);
      showToast('success', existingIndex >= 0 ? 'อัปเดตอีเวนต์แล้ว' : 'สร้างอีเวนต์แล้ว');
    } catch {
      showToast('error', 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
      setTimeout(() => {
        savingRef.current = false;
      }, 2000);
    }
  };

  const handleDelete = async (event: ShopEvent) => {
    const ok = await confirm({
      title: 'ยืนยันการลบ?',
      message: `ลบ "${event.title}" ออกจากระบบ`,
      variant: 'warning',
      confirmText: 'ลบ',
      cancelText: 'ยกเลิก',
      destructive: true,
    });
    if (!ok) return;

    setSaving(true);
    savingRef.current = true;
    try {
      const latestConfig = configRef.current;
      const newEvents = (latestConfig.events || []).filter((e) => e.id !== event.id);
      await saveConfig({ ...latestConfig, events: newEvents });
      setEvents(newEvents);
      showToast('success', 'ลบอีเวนต์แล้ว');
    } catch {
      showToast('error', 'ลบไม่สำเร็จ');
    } finally {
      setSaving(false);
      setTimeout(() => {
        savingRef.current = false;
      }, 2000);
    }
  };

  const handleToggle = async (event: ShopEvent) => {
    savingRef.current = true;
    const latestConfig = configRef.current;
    const currentEvents = latestConfig.events || [];
    const newEvents = currentEvents.map((e) =>
      e.id === event.id ? { ...e, enabled: !e.enabled } : e,
    );
    setEvents(newEvents);
    try {
      await saveConfig({ ...latestConfig, events: newEvents });
      showToast('success', event.enabled ? 'ปิดอีเวนต์แล้ว' : 'เปิดอีเวนต์แล้ว');
    } catch {
      showToast('error', 'บันทึกไม่สำเร็จ');
      setEvents(currentEvents);
    } finally {
      setTimeout(() => {
        savingRef.current = false;
      }, 2000);
    }
  };

  const handleImageUpload = async (file: File) => {
    if (!editingEvent) return;
    if (!file.type.startsWith('image/')) {
      showToast('error', 'กรุณาเลือกไฟล์รูปภาพเท่านั้น');
      return;
    }
    setUploadingImage(true);
    try {
      const url = await onImageUpload(file);
      if (url) {
        setEditingEvent((prev) => (prev ? { ...prev, imageUrl: url } : null));
        showToast('success', 'อัปโหลดรูปสำเร็จ');
      }
    } catch (err: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ {
      const message = err instanceof Error ? err.message : 'อัปโหลดรูปไม่สำเร็จ';
      showToast('error', message);
    } finally {
      setUploadingImage(false);
    }
  };

  return (
    <TooltipProvider>
      <div className="mx-auto max-w-[900px]">
        <ConfirmDialog />

        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-[14px] bg-gradient-to-br from-amber-400 to-amber-500 shadow-[0_4px_16px_rgba(251,191,36,0.3)]">
              <Sparkles size={22} className="text-white" />
            </div>
            <div>
              <h2 className="text-[1.3rem] font-extrabold text-[var(--foreground)]">
                อีเวนต์ & โปรโมชั่น
              </h2>
              <p className="text-[0.8rem] text-[var(--text-muted)]">
                จัดการแบนเนอร์โฆษณาและอีเวนต์ ({events.length} รายการ)
              </p>
            </div>
          </div>
          <Button
            onClick={() => setEditingEvent(createNewEvent())}
            className="rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 px-5 font-bold text-black hover:from-amber-500 hover:to-amber-600"
          >
            <Add size={18} />
            สร้างอีเวนต์ใหม่
          </Button>
        </div>

        {/* Events List */}
        {events.length === 0 ? (
          <div className="rounded-[20px] border border-[var(--glass-border)] bg-[var(--surface-2)] py-16 text-center">
            <Sparkles size={56} className="mx-auto mb-4 text-[var(--text-muted)] opacity-20" />
            <p className="text-[1.1rem] font-semibold text-[var(--text-muted)]">ยังไม่มีอีเวนต์</p>
            <p className="mt-1 text-[0.85rem] text-[var(--text-muted)]">
              สร้างอีเวนต์แรกเพื่อโปรโมทสินค้า
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {[...events]
              .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))
              .map((event) => {
                const typeInfo =
                  EVENT_TYPE_OPTIONS.find((t) => t.value === event.type) ||
                  EVENT_TYPE_OPTIONS[0];
                const nowMs = Date.now();
                const endMs = event.endDate ? new Date(event.endDate).getTime() : NaN;
                const isExpired = !isNaN(endMs) && endMs <= nowMs;
                const isActive = event.enabled && !isExpired;

                return (
                  <div
                    key={event.id}
                    className={cn(
                      'rounded-2xl border bg-[var(--surface-2)] p-4 transition-all duration-200',
                      isActive ? '' : 'border-[var(--glass-border)]',
                      isExpired && 'opacity-60',
                    )}
                    style={{
                      borderColor: isActive ? `${event.color}30` : undefined,
                    }}
                    onMouseEnter={(e) => {
                      if (isActive) {
                        (e.currentTarget as HTMLDivElement).style.borderColor = `${event.color}50`;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (isActive) {
                        (e.currentTarget as HTMLDivElement).style.borderColor = `${event.color}30`;
                      }
                    }}
                  >
                    <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-start">
                      {event.imageUrl && (
                        <div className="h-[120px] w-full shrink-0 overflow-hidden rounded-[10px] border border-[var(--glass-border)] sm:h-14 sm:w-20">
                          <img
                            src={event.imageUrl}
                            alt=""
                            className="size-full object-cover"
                          />
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <Badge
                            className="h-[22px] text-[0.7rem] font-bold"
                            style={{
                              backgroundColor: `${typeInfo.color}18`,
                              color: typeInfo.color,
                              borderColor: 'transparent',
                            }}
                          >
                            {EVENT_TYPE_ICON_MAP[typeInfo.icon]}
                            {typeInfo.label}
                          </Badge>
                          {event.badge && (
                            <Badge
                              className="h-[22px] text-[0.7rem] font-bold"
                              style={{
                                backgroundColor: `${event.color}18`,
                                color: event.color,
                                borderColor: 'transparent',
                              }}
                            >
                              {event.badge}
                            </Badge>
                          )}
                          {isExpired && (
                            <Badge className="h-5 border-transparent bg-red-500/10 text-[0.65rem] font-bold text-red-500">
                              หมดอายุ
                            </Badge>
                          )}
                          <Badge
                            className={cn(
                              'h-5 text-[0.65rem] font-bold',
                              event.enabled
                                ? 'border-transparent bg-emerald-500/10 text-emerald-500'
                                : 'border-transparent bg-gray-500/10 text-gray-500',
                            )}
                          >
                            {event.enabled ? 'เปิด' : 'ปิด'}
                          </Badge>
                        </div>

                        <p className="mb-0.5 truncate text-base font-bold text-[var(--foreground)]">
                          {event.title || '(ไม่มีชื่อ)'}
                        </p>

                        {event.description && (
                          <p className="truncate text-[0.8rem] text-[var(--text-muted)]">
                            {event.description}
                          </p>
                        )}

                        <div className="mt-1 flex flex-wrap gap-3">
                          {event.startDate && (
                            <span className="flex items-center gap-1 text-[0.7rem] text-[var(--text-muted)]">
                              <CalendarIcon size={11} />
                              เริ่ม:{' '}
                              {new Date(event.startDate).toLocaleDateString('th-TH', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}{' '}
                              {new Date(event.startDate).toLocaleTimeString('th-TH', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          )}
                          {event.endDate && (
                            <span
                              className={cn(
                                'flex items-center gap-1 text-[0.7rem]',
                                isExpired ? 'text-red-500' : 'text-[var(--text-muted)]',
                              )}
                            >
                              <AccessTime size={11} />
                              สิ้นสุด:{' '}
                              {new Date(event.endDate).toLocaleDateString('th-TH', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}{' '}
                              {new Date(event.endDate).toLocaleTimeString('th-TH', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 gap-1 self-end sm:self-start">
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn(
                            'h-8 gap-1 border-slate-500/30 px-2 text-xs',
                            event.enabled
                              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                              : 'bg-slate-500/10 text-slate-400 hover:bg-slate-500/20'
                          )}
                          onClick={() => handleToggle(event)}
                        >
                          {event.enabled ? <ToggleOn className="size-4" /> : <ToggleOff className="size-4" />}
                          <span>{event.enabled ? 'เปิดอยู่' : 'ปิดอยู่'}</span>
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1 border-blue-500/30 bg-blue-500/10 px-2.5 text-xs text-blue-400 hover:bg-blue-500/20"
                          onClick={() => setEditingEvent({ ...event })}
                        >
                          <Edit size={14} />
                          <span>แก้ไข</span>
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1 border-red-500/30 bg-red-500/10 px-2.5 text-xs text-red-400 hover:bg-red-500/20 hover:text-red-300"
                          onClick={() => handleDelete(event)}
                        >
                          <Delete size={14} />
                          <span>ลบ</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}

        {/* Edit/Create Dialog */}
        <Dialog
          open={!!editingEvent}
          onOpenChange={(open) => {
            if (!open && !saving) setEditingEvent(null);
          }}
        >
          <DialogContent
            showCloseButton={false}
            className="flex max-h-[90vh] flex-col gap-0 overflow-hidden border-[var(--glass-border)] bg-[var(--surface)] p-0 sm:max-w-lg"
          >
            {editingEvent && (
              <>
                <div className="min-h-0 flex-1 overflow-y-auto overflow-x-visible p-6">
                <DialogHeader className="border-b border-[var(--glass-border)] pb-4">
                  <div className="flex items-center gap-3">
                    <div className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-500">
                      <Sparkles size={20} className="text-white" />
                    </div>
                    <DialogTitle className="text-[1.1rem] font-bold text-[var(--foreground)]">
                      {events.some((e) => e.id === editingEvent.id)
                        ? 'แก้ไขอีเวนต์'
                        : 'สร้างอีเวนต์ใหม่'}
                    </DialogTitle>
                  </div>
                </DialogHeader>

                <div className="flex flex-col gap-4 py-2">
                  <div className="flex items-center justify-between gap-4">
                    <Label className="text-[0.9rem] font-semibold">เปิดใช้งาน</Label>
                    <Switch
                      checked={editingEvent.enabled}
                      onCheckedChange={(checked) =>
                        setEditingEvent((prev) => (prev ? { ...prev, enabled: checked } : null))
                      }
                      className="data-[state=checked]:bg-emerald-500"
                    />
                  </div>

                  <div>
                    <Label className="mb-2 block text-[0.85rem] font-semibold">ประเภท</Label>
                    <div className="flex flex-wrap gap-2">
                      {EVENT_TYPE_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() =>
                            setEditingEvent((prev) =>
                              prev ? { ...prev, type: opt.value } : null,
                            )
                          }
                          className={cn(
                            'inline-flex cursor-pointer items-center gap-1 rounded-md border-2 px-3 py-1 text-[0.8rem] font-bold transition-all',
                            editingEvent.type === opt.value
                              ? 'border-opacity-50'
                              : 'border-transparent bg-[var(--glass-bg)] text-[var(--text-muted)] hover:opacity-90',
                          )}
                          style={
                            editingEvent.type === opt.value
                              ? {
                                  backgroundColor: `${opt.color}20`,
                                  color: opt.color,
                                  borderColor: `${opt.color}50`,
                                }
                              : undefined
                          }
                        >
                          {EVENT_TYPE_ICON_MAP[opt.icon]}
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="event-title">ชื่ออีเวนต์ / โปรโมชั่น</Label>
                    <Input
                      id="event-title"
                      value={editingEvent.title}
                      onChange={(e) =>
                        setEditingEvent((prev) =>
                          prev ? { ...prev, title: e.target.value } : null,
                        )
                      }
                      placeholder="เช่น Flash Sale วันนี้เท่านั้น!"
                      className="rounded-xl bg-[var(--surface)]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="event-description">รายละเอียด (ไม่บังคับ)</Label>
                    <Textarea
                      id="event-description"
                      rows={2}
                      value={editingEvent.description || ''}
                      onChange={(e) =>
                        setEditingEvent((prev) =>
                          prev ? { ...prev, description: e.target.value } : null,
                        )
                      }
                      placeholder="รายละเอียดเพิ่มเติม..."
                      className="rounded-xl bg-[var(--surface)]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="event-badge">ป้ายข้อความ เช่น ลด 20%, ฟรีค่าส่ง</Label>
                    <Input
                      id="event-badge"
                      value={editingEvent.badge || ''}
                      onChange={(e) =>
                        setEditingEvent((prev) =>
                          prev ? { ...prev, badge: e.target.value } : null,
                        )
                      }
                      placeholder="ลด 30%"
                      className="rounded-xl bg-[var(--surface)]"
                    />
                  </div>

                  <div className="flex flex-col gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="event-cta-text">ข้อความปุ่ม</Label>
                      <Input
                        id="event-cta-text"
                        value={editingEvent.ctaText || ''}
                        onChange={(e) =>
                          setEditingEvent((prev) =>
                            prev ? { ...prev, ctaText: e.target.value } : null,
                          )
                        }
                        placeholder="ดูรายละเอียด"
                        className="rounded-xl bg-[var(--surface)]"
                      />
                    </div>
                    <div>
                      <p className="mb-2 text-[0.8rem] text-[var(--text-muted)]">
                        เชื่อมโยงสินค้า (คลิกปุ่มจะเปิดหน้าสินค้า)
                      </p>
                      <ProductSearchSelect
                        products={config.products || []}
                        value={editingEvent.ctaLink || ''}
                        onChange={(productId) =>
                          setEditingEvent((prev) =>
                            prev ? { ...prev, ctaLink: productId } : null,
                          )
                        }
                      />
                      {editingEvent.ctaLink && !editingEvent.ctaLink.startsWith('http') && (
                        <p className="mt-1 text-[0.7rem] text-emerald-500">
                          ✓ เชื่อมโยงกับสินค้า:{' '}
                          {(config.products || []).find((p) => p.id === editingEvent.ctaLink)
                            ?.name || editingEvent.ctaLink}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <div className="flex-1 space-y-2">
                      <Label htmlFor="event-start">วันเริ่มต้น</Label>
                      <Input
                        id="event-start"
                        type="datetime-local"
                        value={isoToLocalDatetime(editingEvent.startDate)}
                        onChange={(e) =>
                          setEditingEvent((prev) =>
                            prev
                              ? { ...prev, startDate: localDatetimeToIso(e.target.value) }
                              : null,
                          )
                        }
                        className="rounded-xl bg-[var(--surface)]"
                      />
                    </div>
                    <div className="flex-1 space-y-2">
                      <Label htmlFor="event-end">วันสิ้นสุด</Label>
                      <Input
                        id="event-end"
                        type="datetime-local"
                        value={isoToLocalDatetime(editingEvent.endDate)}
                        onChange={(e) =>
                          setEditingEvent((prev) =>
                            prev
                              ? { ...prev, endDate: localDatetimeToIso(e.target.value) }
                              : null,
                          )
                        }
                        className="rounded-xl bg-[var(--surface)]"
                      />
                    </div>
                  </div>

                  <div className="rounded-xl border border-red-500/20 bg-red-500/[0.08] p-4">
                    <p className="mb-3 flex items-center gap-1 text-[0.9rem] font-bold text-[#ff453a]">
                      <LocalOffer size={16} />
                      ส่วนลดสินค้า (ลดราคาอัตโนมัติเมื่ออีเวนต์เปิด)
                    </p>
                    <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                      <div className="flex gap-1">
                        {(
                          [
                            { value: 'percent' as const, label: 'ลด %' },
                            { value: 'fixed' as const, label: 'ลด ฿' },
                          ] as const
                        ).map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() =>
                              setEditingEvent((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      discountType:
                                        prev.discountType === opt.value ? undefined : opt.value,
                                    }
                                  : null,
                              )
                            }
                            className={cn(
                              'cursor-pointer rounded-md border px-3 py-1 text-sm font-bold transition-colors',
                              editingEvent.discountType === opt.value
                                ? 'border-red-500/40 bg-red-500/20 text-[#ff453a]'
                                : 'border-[var(--glass-border)] bg-[var(--surface)] text-[var(--text-muted)]',
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      {editingEvent.discountType && (
                        <div className="w-full space-y-2 sm:w-40">
                          <Label htmlFor="event-discount">
                            {editingEvent.discountType === 'percent'
                              ? 'เปอร์เซ็นต์ลด'
                              : 'จำนวนเงินลด (฿)'}
                          </Label>
                          <Input
                            id="event-discount"
                            type="number"
                            min={0}
                            max={editingEvent.discountType === 'percent' ? 100 : 99999}
                            value={editingEvent.discountValue || ''}
                            onChange={(e) =>
                              setEditingEvent((prev) =>
                                prev
                                  ? { ...prev, discountValue: Number(e.target.value) || 0 }
                                  : null,
                              )
                            }
                            className="rounded-[10px] bg-[var(--surface)]"
                          />
                        </div>
                      )}
                    </div>

                    <p className="mb-2 text-[0.8rem] font-semibold text-[var(--text-muted)]">
                      สินค้าที่เข้าร่วม (คลิกเพื่อเลือก/ยกเลิก)
                    </p>
                    <div className="flex max-h-[150px] flex-wrap gap-1 overflow-y-auto">
                      {(config.products || []).map((p) => {
                        const isLinked = editingEvent.linkedProducts?.includes(p.id);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() =>
                              setEditingEvent((prev) => {
                                if (!prev) return null;
                                const current = prev.linkedProducts || [];
                                const next = isLinked
                                  ? current.filter((id) => id !== p.id)
                                  : [...current, p.id];
                                return { ...prev, linkedProducts: next };
                              })
                            }
                            className={cn(
                              'cursor-pointer rounded-md border px-2 py-0.5 text-[0.7rem] transition-colors',
                              isLinked
                                ? 'border-red-500/40 bg-red-500/15 font-bold text-[#ff453a]'
                                : 'border-[var(--glass-border)] bg-[var(--surface)] font-medium text-[var(--text-muted)]',
                            )}
                          >
                            {p.name}
                            {p.basePrice ? ` ฿${p.basePrice}` : ''}
                          </button>
                        );
                      })}
                    </div>
                    {editingEvent.linkedProducts?.length ? (
                      <p className="mt-1 text-[0.7rem] text-[var(--text-muted)]">
                        เลือก {editingEvent.linkedProducts.length} สินค้า
                        {editingEvent.discountType && editingEvent.discountValue
                          ? ` • ลด${
                              editingEvent.discountType === 'percent'
                                ? ` ${editingEvent.discountValue}%`
                                : ` ฿${editingEvent.discountValue}`
                            }`
                          : ''}
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <Label className="mb-2 block text-[0.85rem] font-semibold">สีธีม</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {EVENT_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() =>
                            setEditingEvent((prev) => (prev ? { ...prev, color: c } : null))
                          }
                          className={cn(
                            'size-7 cursor-pointer rounded-lg transition-all hover:scale-110',
                            editingEvent.color === c
                              ? 'border-[3px] border-[var(--foreground)]'
                              : 'border-2 border-transparent',
                          )}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className="mb-2 block text-[0.85rem] font-semibold">รูปแบนเนอร์</Label>
                    {editingEvent.imageUrl ? (
                      <div className="relative overflow-hidden rounded-xl border border-[var(--glass-border)]">
                        <img
                          src={editingEvent.imageUrl}
                          alt=""
                          className="h-[150px] w-full object-cover"
                        />
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() =>
                            setEditingEvent((prev) =>
                              prev ? { ...prev, imageUrl: undefined } : null,
                            )
                          }
                          className="absolute top-2 right-2 bg-black/50 text-white hover:bg-red-500/80"
                        >
                          <Close size={14} />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        disabled={uploadingImage}
                        className="h-auto w-full rounded-xl border-dashed border-[var(--glass-border)] py-8 font-semibold text-[var(--text-muted)] hover:border-amber-400 hover:text-amber-400"
                        asChild
                      >
                        <label className="cursor-pointer">
                          {uploadingImage ? (
                            <>
                              <Loader2 className="animate-spin" />
                              กำลังอัปโหลด...
                            </>
                          ) : (
                            <>
                              <ImageIcon size={18} />
                              เลือกรูปภาพ
                            </>
                          )}
                          <input
                            type="file"
                            hidden
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleImageUpload(file);
                              e.target.value = '';
                            }}
                          />
                        </label>
                      </Button>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="event-priority">
                      ลำดับการแสดง (ตัวเลขน้อย = แสดงก่อน)
                    </Label>
                    <Input
                      id="event-priority"
                      type="number"
                      min={0}
                      max={99}
                      value={editingEvent.priority ?? 0}
                      onChange={(e) =>
                        setEditingEvent((prev) =>
                          prev ? { ...prev, priority: parseInt(e.target.value) || 0 } : null,
                        )
                      }
                      className="rounded-xl bg-[var(--surface)]"
                    />
                  </div>
                </div>
                </div>

                <DialogFooter className="gap-2 border-t border-[var(--glass-border)] p-6 pt-4">
                  <Button
                    variant="ghost"
                    onClick={() => setEditingEvent(null)}
                    disabled={saving}
                    className="rounded-[10px] text-[var(--text-muted)]"
                  >
                    ยกเลิก
                  </Button>
                  <Button
                    onClick={() => handleSave(editingEvent)}
                    disabled={saving || !editingEvent.title.trim()}
                    className="rounded-[10px] bg-gradient-to-br from-amber-400 to-amber-500 px-6 font-bold text-black hover:from-amber-500 hover:to-amber-600 disabled:opacity-50"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="animate-spin" />
                        กำลังบันทึก...
                      </>
                    ) : (
                      <>
                        <Save size={16} />
                        บันทึก
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
});
