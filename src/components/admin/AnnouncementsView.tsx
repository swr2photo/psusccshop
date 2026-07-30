'use client';

import React from 'react';
import {
  Plus as Add,
  Archive,
  BellRing as NotificationsActive,
  Copy as ContentCopy,
  FileText as FileTextIcon,
  History,
  Image as ImageIcon,
  Loader2,
  Megaphone as Announcement,
  Pencil as Edit,
  Radio,
  Save,
  Send,
  Sparkles,
  ToggleLeft as ToggleOff,
  ToggleRight as ToggleOn,
  Trash2 as Delete,
  Users as Groups,
} from 'lucide-react';

import { Product, ShopConfig } from '@/lib/config';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';

const glassCardClass =
  // overflow-visible so native datetime-local / select menus are not clipped
  'rounded-[20px] border border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--foreground)] shadow-[0_8px_32px_rgba(0,0,0,0.12)] backdrop-blur-[20px]';

const gradientBtnClass =
  'rounded-[10px] bg-gradient-to-br from-indigo-500 to-violet-500 font-bold text-white shadow-[0_4px_15px_rgba(139,92,246,0.3)] hover:opacity-90 disabled:opacity-50';

const secondaryBtnClass =
  'rounded-[10px] border border-[var(--glass-border)] bg-transparent text-[var(--text-muted)] hover:border-violet-500 hover:text-[var(--foreground)]';

const inputClass = 'rounded-[10px] border-[var(--glass-border)] bg-[var(--surface)] text-[var(--foreground)]';

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e', '#64748b', '#1e293b', '#000000',
];

export interface Announcement {
  id: string;
  enabled: boolean;
  message: string;
  color: string;
  imageUrl?: string;
  postedBy?: string;
  displayName?: string;
  postedAt: string;
  type?: 'text' | 'image' | 'both';
  showLogo?: boolean;
  priority?: number;
  isSpecial?: boolean;
  specialIcon?: string;
  link?: string;
  linkText?: string;
  linkedProductId?: string;
}

type AnnouncementHistoryItem = NonNullable<ShopConfig['announcementHistory']>[number];

type ToastSeverity = 'success' | 'error' | 'info' | 'warning';

export interface AnnouncementsViewProps {
  config: ShopConfig;
  saveConfig: (newConfig: ShopConfig) => Promise<void>;
  showToast: (type: ToastSeverity, message: string) => void;
  userEmail: string | null | undefined;
  onImageUpload: (file: File) => Promise<string | null>;
}

const SettingToggleRow = ({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) => (
  <div className="flex items-center justify-between py-1">
    <div>
      <p className="text-[0.95rem] font-medium text-[var(--foreground)]">{label}</p>
      {description && (
        <p className="text-xs text-[var(--text-muted)]">{description}</p>
      )}
    </div>
    <Switch
      checked={checked}
      onCheckedChange={onChange}
      className="data-[state=checked]:bg-emerald-500"
    />
  </div>
);

function ProductPicker({
  products,
  value,
  onSelect,
}: {
  products: Product[];
  value: string | undefined;
  onSelect: (product: Product | null) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const selected = products.find((p) => p.id === value);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? products.filter((p) => p.name?.toLowerCase().includes(q))
      : products;
    return list.slice(0, 30);
  }, [products, search]);

  return (
    <Popover modal={false} open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn('h-9 w-full justify-between font-normal', inputClass)}
        >
          <span className="truncate">{selected?.name || 'ค้นหาสินค้า...'}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-2" align="start">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ค้นหาสินค้า..."
          className={cn('mb-2 h-8', inputClass)}
        />
        <ScrollArea className="max-h-56">
          {filtered.length === 0 ? (
            <p className="px-2 py-3 text-center text-sm text-[var(--text-muted)]">ไม่พบสินค้า</p>
          ) : (
            <div className="flex flex-col gap-0.5">
              {selected && (
                <button
                  type="button"
                  className="rounded-md px-2 py-1.5 text-left text-sm text-[var(--text-muted)] hover:bg-accent"
                  onClick={() => {
                    onSelect(null);
                    setOpen(false);
                    setSearch('');
                  }}
                >
                  ล้างการเลือก
                </button>
              )}
              {filtered.map((product) => {
                const imgUrl = product.coverImage || product.images?.[0] || '';
                return (
                  <button
                    key={product.id}
                    type="button"
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-accent',
                      product.id === value && 'bg-violet-500/15',
                    )}
                    onClick={() => {
                      onSelect(product);
                      setOpen(false);
                      setSearch('');
                    }}
                  >
                    {imgUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={imgUrl}
                        alt=""
                        className="size-9 shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="size-9 shrink-0 rounded-lg bg-[var(--surface-2)]" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--foreground)]">
                        {product.name}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        ฿{product.basePrice?.toLocaleString()}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

export const AnnouncementsView = React.memo(function AnnouncementsView({
  config,
  saveConfig,
  showToast,
  userEmail,
  onImageUpload,
}: AnnouncementsViewProps) {
  const [announcements, setAnnouncements] = React.useState<Announcement[]>(config.announcements || []);
  const [history, setHistory] = React.useState<AnnouncementHistoryItem[]>(config.announcementHistory || []);
  const [editingAnn, setEditingAnn] = React.useState<Announcement | null>(null);
  const [showHistory, setShowHistory] = React.useState(false);
  const [uploadingImage, setUploadingImage] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const { confirm, ConfirmDialog } = useConfirmDialog();

  React.useEffect(() => {
    setAnnouncements(config.announcements || []);
    setHistory(config.announcementHistory || []);
  }, [config.announcements, config.announcementHistory]);

  const createNewAnnouncement = (): Announcement => ({
    id: `ann_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    enabled: true,
    message: '',
    color: '#3b82f6',
    postedAt: new Date().toISOString(),
    postedBy: userEmail || 'แอดมิน',
    displayName: '',
    type: 'text',
    showLogo: true,
    priority: 0,
  });

  const handleAddNew = () => {
    setEditingAnn(createNewAnnouncement());
  };

  const handleEdit = (ann: Announcement) => {
    setEditingAnn({ ...ann });
  };

  const handleDelete = async (ann: Announcement) => {
    const ok = await confirm({
      title: 'ยืนยันการลบ?',
      message: 'ประกาศนี้จะถูกย้ายไปประวัติ',
      variant: 'warning',
      confirmText: 'ลบ',
      cancelText: 'ยกเลิก',
      destructive: true,
    });

    if (ok) {
      setSaving(true);
      try {
        const newAnnouncements = announcements.filter((a) => a.id !== ann.id);
        const newHistory = [
          {
            ...ann,
            deletedAt: new Date().toISOString(),
            deletedBy: userEmail || 'แอดมิน',
          },
          ...history,
        ].slice(0, 50);

        await saveConfig({
          ...config,
          announcements: newAnnouncements,
          announcementHistory: newHistory,
        });

        setAnnouncements(newAnnouncements);
        setHistory(newHistory);
        showToast('success', 'ลบประกาศสำเร็จ');
      } catch {
        showToast('error', 'ไม่สามารถลบประกาศได้');
      } finally {
        setSaving(false);
      }
    }
  };

  const handleToggleEnabled = async (ann: Announcement) => {
    setSaving(true);
    try {
      const newAnnouncements = announcements.map((a) =>
        a.id === ann.id ? { ...a, enabled: !a.enabled } : a,
      );
      await saveConfig({ ...config, announcements: newAnnouncements });
      setAnnouncements(newAnnouncements);
      showToast('success', ann.enabled ? 'ปิดประกาศแล้ว' : 'เปิดประกาศแล้ว');
    } catch {
      showToast('error', 'ไม่สามารถเปลี่ยนสถานะได้');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAnnouncement = async () => {
    if (!editingAnn) return;
    if (!editingAnn.message && !editingAnn.imageUrl) {
      showToast('error', 'กรุณากรอกข้อความหรืออัพโหลดรูปภาพ');
      return;
    }

    setSaving(true);
    try {
      const isNew = !announcements.find((a) => a.id === editingAnn.id);
      let newAnnouncements: Announcement[];

      if (isNew) {
        newAnnouncements = [editingAnn, ...announcements];
      } else {
        newAnnouncements = announcements.map((a) =>
          a.id === editingAnn.id ? editingAnn : a,
        );
      }

      await saveConfig({ ...config, announcements: newAnnouncements });
      setAnnouncements(newAnnouncements);
      setEditingAnn(null);
      showToast('success', isNew ? 'สร้างประกาศสำเร็จ' : 'แก้ไขประกาศสำเร็จ');
    } catch {
      showToast('error', 'ไม่สามารถบันทึกประกาศได้');
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('error', 'กรุณาเลือกไฟล์รูปภาพเท่านั้น');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      showToast('error', 'ไฟล์รูปภาพต้องมีขนาดไม่เกิน 20MB (จะบีบอัดอัตโนมัติ)');
      return;
    }

    setUploadingImage(true);
    try {
      const imageUrl = await onImageUpload(file);
      if (imageUrl && editingAnn) {
        setEditingAnn({
          ...editingAnn,
          imageUrl,
          type: editingAnn.message ? 'both' : 'image',
        });
        showToast('success', 'อัพโหลดรูปภาพสำเร็จ');
      }
    } catch (err: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ {
      const message = err instanceof Error ? err.message : 'อัพโหลดรูปภาพล้มเหลว';
      showToast('error', message);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRestoreFromHistory = async (histItem: AnnouncementHistoryItem) => {
    const ok = await confirm({
      title: 'กู้คืนประกาศ?',
      message: 'ประกาศนี้จะถูกเพิ่มกลับไปยังรายการประกาศ',
      variant: 'question',
      confirmText: 'กู้คืน',
      cancelText: 'ยกเลิก',
      confirmColor: '#10b981',
    });

    if (ok) {
      setSaving(true);
      try {
        const restored: Announcement = {
          id: `ann_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          enabled: false,
          message: histItem.message,
          color: histItem.color,
          imageUrl: histItem.imageUrl,
          postedBy: userEmail || 'แอดมิน',
          displayName: histItem.displayName,
          postedAt: new Date().toISOString(),
          type: histItem.type,
          showLogo: true,
        };

        const newAnnouncements = [restored, ...announcements];
        const newHistory = history.filter((h) => h.id !== histItem.id);

        await saveConfig({
          ...config,
          announcements: newAnnouncements,
          announcementHistory: newHistory,
        });

        setAnnouncements(newAnnouncements);
        setHistory(newHistory);
        showToast('success', 'กู้คืนประกาศสำเร็จ');
      } catch {
        showToast('error', 'ไม่สามารถกู้คืนประกาศได้');
      } finally {
        setSaving(false);
      }
    }
  };

  const handleDeleteFromHistory = async (histItem: AnnouncementHistoryItem) => {
    const ok = await confirm({
      title: 'ลบถาวร?',
      message: 'ประกาศนี้จะถูกลบออกจากประวัติอย่างถาวร',
      variant: 'warning',
      confirmText: 'ลบถาวร',
      cancelText: 'ยกเลิก',
      destructive: true,
    });

    if (ok) {
      setSaving(true);
      try {
        const newHistory = history.filter((h) => h.id !== histItem.id);
        await saveConfig({ ...config, announcementHistory: newHistory });
        setHistory(newHistory);
        showToast('success', 'ลบประวัติสำเร็จ');
      } catch {
        showToast('error', 'ไม่สามารถลบประวัติได้');
      } finally {
        setSaving(false);
      }
    }
  };

  const activeCount = announcements.filter((a) => a.enabled).length;
  const isEditingExisting = editingAnn
    ? announcements.some((a) => a.id === editingAnn.id)
    : false;

  return (
    <TooltipProvider>
      <div className="flex max-w-[900px] flex-col gap-6">
        <ConfirmDialog />

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-extrabold text-[var(--foreground)]">
              <NotificationsActive size={28} />
              จัดการประกาศ
            </h2>
            <p className="text-sm text-[var(--text-muted)]">
              สร้าง แก้ไข และจัดการประกาศทั้งหมด • {announcements.length} รายการ ({activeCount} เปิดอยู่)
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowHistory(true)} className={cn(secondaryBtnClass, 'gap-2')}>
              <Archive size={18} />
              ประวัติ ({history.length})
            </Button>
            <Button onClick={handleAddNew} className={cn(gradientBtnClass, 'gap-2')}>
              <Add size={20} />
              สร้างประกาศใหม่
            </Button>
          </div>
        </div>

        {/* Active Announcements List */}
        {announcements.length === 0 ? (
          <div className={cn(glassCardClass, 'p-12 text-center')}>
            <Announcement size={64} className="mx-auto mb-4 text-slate-600" />
            <p className="mb-1 text-lg font-semibold text-[var(--text-muted)]">ยังไม่มีประกาศ</p>
            <p className="mb-6 text-sm text-[var(--text-muted)]">
              คลิกปุ่ม &quot;สร้างประกาศใหม่&quot; เพื่อเริ่มต้น
            </p>
            <Button onClick={handleAddNew} className={gradientBtnClass}>
              <Add className="mr-2" size={18} />
              สร้างประกาศแรก
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {announcements.map((ann) => (
              <div
                key={ann.id}
                className={cn(
                  glassCardClass,
                  'p-0 transition-opacity',
                  ann.enabled ? 'opacity-100' : 'opacity-60',
                )}
                style={{
                  borderColor: ann.enabled ? `${ann.color}40` : 'var(--glass-border)',
                }}
              >
                <div className="h-1" style={{ backgroundColor: ann.color }} />

                <div className="p-4">
                  <div className="flex items-start gap-4">
                    {ann.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={ann.imageUrl}
                        alt="Announcement"
                        className="h-[60px] w-20 shrink-0 rounded-lg object-cover"
                      />
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <span
                          className={cn(
                            'rounded-md px-2 py-0.5 text-[0.7rem] font-semibold',
                            ann.enabled
                              ? 'bg-emerald-500/15 text-emerald-500'
                              : 'bg-slate-500/15 text-slate-500',
                          )}
                        >
                          {ann.enabled ? 'เปิดอยู่' : 'ปิดอยู่'}
                        </span>
                        <span className="text-[0.7rem] text-[var(--text-muted)]">
                          {new Date(ann.postedAt).toLocaleDateString('th-TH', {
                            day: 'numeric',
                            month: 'short',
                            year: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      <p className="line-clamp-2 whitespace-pre-wrap text-sm text-[var(--foreground)]">
                        {ann.message || '(รูปภาพอย่างเดียว)'}
                      </p>

                      {ann.displayName && (
                        <p className="mt-1 text-xs text-[var(--text-muted)]">
                          ประกาศโดย: {ann.displayName}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className={cn(
                          'h-8 gap-1 border-slate-500/30 px-2 text-xs',
                          ann.enabled
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                            : 'bg-slate-500/10 text-slate-400 hover:bg-slate-500/20'
                        )}
                        onClick={() => handleToggleEnabled(ann)}
                        disabled={saving}
                      >
                        {ann.enabled ? <ToggleOn className="size-4" /> : <ToggleOff className="size-4" />}
                        <span>{ann.enabled ? 'เปิดอยู่' : 'ปิดอยู่'}</span>
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1 border-blue-500/30 bg-blue-500/10 px-2.5 text-xs text-blue-400 hover:bg-blue-500/20"
                        onClick={() => handleEdit(ann)}
                      >
                        <Edit size={14} />
                        <span>แก้ไข</span>
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1 border-red-500/30 bg-red-500/10 px-2.5 text-xs text-red-400 hover:bg-red-500/20 hover:text-red-300"
                        onClick={() => handleDelete(ann)}
                        disabled={saving}
                      >
                        <Delete size={14} />
                        <span>ลบ</span>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Edit/Create Dialog */}
        <Dialog open={!!editingAnn} onOpenChange={(open) => !open && setEditingAnn(null)}>
          <DialogContent
            className="max-h-[90vh] overflow-y-auto border-[var(--glass-border)] bg-[var(--glass-bg)] sm:max-w-lg"
            showCloseButton
          >
            <DialogHeader className="flex-row items-center gap-3 border-b border-[var(--glass-border)] pb-4">
              <div
                className={cn(
                  'flex size-10 items-center justify-center rounded-xl text-white',
                  isEditingExisting ? 'bg-blue-500' : 'bg-emerald-500',
                )}
              >
                {isEditingExisting ? <Edit size={18} /> : <Add size={18} />}
              </div>
              <DialogTitle className="text-[var(--foreground)]">
                {isEditingExisting ? 'แก้ไขประกาศ' : 'สร้างประกาศใหม่'}
              </DialogTitle>
            </DialogHeader>

            {editingAnn && (
              <div className="flex flex-col gap-5 py-2">
                <SettingToggleRow
                  label="เปิดใช้งานประกาศ"
                  description="เมื่อเปิด ประกาศจะแสดงบนหน้าร้าน"
                  checked={editingAnn.enabled}
                  onChange={(checked) => setEditingAnn({ ...editingAnn, enabled: checked })}
                />

                {/* Type Selection */}
                <div>
                  <p className="mb-2 text-xs text-[var(--text-muted)]">ประเภทประกาศ</p>
                  <div className="flex gap-2">
                    {([
                      { value: 'text' as const, label: 'ข้อความ', icon: <FileTextIcon size={14} /> },
                      { value: 'image' as const, label: 'รูปภาพ', icon: <ImageIcon size={14} /> },
                      { value: 'both' as const, label: 'ทั้งสอง', icon: <><FileTextIcon size={14} /><ImageIcon size={14} /></> },
                    ]).map((option) => {
                      const active = (editingAnn.type ?? 'text') === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setEditingAnn({ ...editingAnn, type: option.value })}
                          className={cn(
                            'flex-1 rounded-[10px] py-3 text-center transition-all',
                            active
                              ? 'border-2 border-violet-500 bg-violet-500/30'
                              : 'border-2 border-transparent bg-white/5 hover:bg-violet-500/15',
                          )}
                        >
                          <div className={cn('mb-1 flex items-center justify-center gap-1', active ? 'text-white' : 'text-slate-400')}>
                            {option.icon}
                          </div>
                          <span className={cn('text-sm font-semibold', active ? 'text-white' : 'text-slate-400')}>
                            {option.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {((editingAnn.type ?? 'text') === 'text' || editingAnn.type === 'both') && (
                  <div className="space-y-1.5">
                    <Label htmlFor="ann-message">ข้อความประกาศ</Label>
                    <Textarea
                      id="ann-message"
                      rows={4}
                      value={editingAnn.message}
                      onChange={(e) => setEditingAnn({ ...editingAnn, message: e.target.value })}
                      placeholder="พิมพ์ข้อความประกาศ..."
                      maxLength={500}
                      className={inputClass}
                    />
                    <p className="text-xs text-[var(--text-muted)]">{editingAnn.message.length}/500 ตัวอักษร</p>
                  </div>
                )}

                {((editingAnn.type ?? 'text') === 'image' || editingAnn.type === 'both') && (
                  <div>
                    <p className="mb-2 text-xs text-[var(--text-muted)]">รูปภาพประกาศ</p>
                    {editingAnn.imageUrl ? (
                      <div className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={editingAnn.imageUrl}
                          alt="Announcement"
                          className="max-h-[200px] w-full rounded-xl border border-[var(--glass-border)] object-cover"
                        />
                        <Button
                          type="button"
                          size="icon"
                          className="absolute top-2 right-2 size-8 bg-red-500/90 text-white hover:bg-red-500"
                          onClick={() =>
                            setEditingAnn({
                              ...editingAnn,
                              imageUrl: undefined,
                              type: editingAnn.message ? 'text' : 'text',
                            })
                          }
                        >
                          <Delete size={18} />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={uploadingImage}
                        className={cn(
                          secondaryBtnClass,
                          'h-auto w-full border-2 border-dashed py-6',
                          'hover:border-violet-500',
                        )}
                        asChild
                      >
                        <label className="cursor-pointer">
                          {uploadingImage ? (
                            <Loader2 className="size-6 animate-spin text-violet-500" />
                          ) : (
                            <>
                              <ImageIcon size={24} className="mr-2" />
                              คลิกเพื่ออัพโหลดรูปภาพ (สูงสุด 5MB)
                            </>
                          )}
                          <input
                            type="file"
                            hidden
                            accept="image/*"
                            onChange={handleImageUpload}
                          />
                        </label>
                      </Button>
                    )}
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="ann-display-name">ชื่อที่แสดงในประกาศ</Label>
                  <Input
                    id="ann-display-name"
                    value={editingAnn.displayName || ''}
                    onChange={(e) => setEditingAnn({ ...editingAnn, displayName: e.target.value })}
                    placeholder="เช่น ทีมงาน PSU SCC Shop"
                    className={inputClass}
                  />
                  <p className="text-xs text-[var(--text-muted)]">ถ้าไม่ระบุจะแสดงเป็น &apos;แอดมิน&apos;</p>
                </div>

                <SettingToggleRow
                  label="แสดงโลโก้เว็บไซต์"
                  description="แสดงโลโก้ของเว็บไซต์ในประกาศ"
                  checked={editingAnn.showLogo ?? true}
                  onChange={(checked) => setEditingAnn({ ...editingAnn, showLogo: checked })}
                />

                {/* Special Announcement */}
                <div className="rounded-xl border border-amber-400/20 bg-amber-400/8 p-4">
                  <p className="mb-3 flex items-center gap-1 text-sm font-bold text-amber-400">
                    <Sparkles size={16} />
                    ข้อความพิเศษ
                  </p>
                  <SettingToggleRow
                    label="ประกาศพิเศษ"
                    description="เน้นการแสดงผล ขอบเรืองแสง + ไอคอนพิเศษ"
                    checked={editingAnn.isSpecial ?? false}
                    onChange={(checked) => setEditingAnn({ ...editingAnn, isSpecial: checked })}
                  />
                  {editingAnn.isSpecial && (
                    <div className="mt-3 flex flex-col gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="ann-special-icon">ไอคอน Emoji</Label>
                        <Input
                          id="ann-special-icon"
                          value={editingAnn.specialIcon || ''}
                          onChange={(e) =>
                            setEditingAnn({ ...editingAnn, specialIcon: e.target.value.slice(0, 4) })
                          }
                          placeholder="🔥 🎉 ⚡ 🎊 💥 📢"
                          className={inputClass}
                        />
                        <p className="text-xs text-[var(--text-muted)]">
                          เลือก emoji ที่ต้องการแสดง (ว่าง = ✨)
                        </p>
                      </div>

                      <div>
                        <p className="mb-2 text-xs text-[var(--text-muted)]">
                          เชื่อมโยงสินค้า (เลือกแทนการใส่ลิงก์)
                        </p>
                        <ProductPicker
                          products={config.products || []}
                          value={editingAnn.linkedProductId}
                          onSelect={(product) => {
                            if (product) {
                              const imgUrl = product.coverImage || product.images?.[0] || '';
                              setEditingAnn({
                                ...editingAnn,
                                linkedProductId: product.id,
                                link: '',
                                linkText: editingAnn.linkText || 'ดูสินค้า →',
                                ...(!editingAnn.imageUrl && imgUrl
                                  ? { imageUrl: imgUrl, type: editingAnn.message ? 'both' : 'image' }
                                  : {}),
                              });
                            } else {
                              setEditingAnn({ ...editingAnn, linkedProductId: undefined });
                            }
                          }}
                        />
                        {editingAnn.linkedProductId && (
                          <p className="mt-1 text-xs text-emerald-500">
                            ✓ เชื่อมโยงกับสินค้า — คลิกที่ประกาศจะเปิดหน้าสินค้าโดยตรง
                          </p>
                        )}
                      </div>

                      {!editingAnn.linkedProductId && (
                        <div className="space-y-1.5">
                          <Label htmlFor="ann-link">ลิงก์แนบ (ไม่บังคับ)</Label>
                          <Input
                            id="ann-link"
                            value={editingAnn.link || ''}
                            onChange={(e) => setEditingAnn({ ...editingAnn, link: e.target.value })}
                            placeholder="https://..."
                            className={inputClass}
                          />
                        </div>
                      )}
                      {(editingAnn.link || editingAnn.linkedProductId) && (
                        <div className="space-y-1.5">
                          <Label htmlFor="ann-link-text">ข้อความปุ่ม</Label>
                          <Input
                            id="ann-link-text"
                            value={editingAnn.linkText || ''}
                            onChange={(e) => setEditingAnn({ ...editingAnn, linkText: e.target.value })}
                            placeholder={editingAnn.linkedProductId ? 'ดูสินค้า →' : 'ดูเพิ่มเติม →'}
                            className={inputClass}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Color Picker */}
                <div>
                  <p className="mb-3 text-xs text-[var(--text-muted)]">สีพื้นหลัง</p>
                  <div
                    className="mb-4 flex h-10 items-center justify-center rounded-xl shadow-md"
                    style={{ backgroundColor: editingAnn.color }}
                  >
                    <span className="text-sm font-semibold text-white drop-shadow-sm">
                      {editingAnn.color}
                    </span>
                  </div>
                  <div className="grid grid-cols-10 gap-1.5 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-3">
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setEditingAnn({ ...editingAnn, color })}
                        className={cn(
                          'aspect-square w-full rounded-lg transition-all hover:scale-110',
                          editingAnn.color === color ? 'border-[3px] border-white shadow-[0_0_10px_var(--swatch)]' : 'border-2 border-transparent',
                        )}
                        style={{ backgroundColor: color, ['--swatch' as string]: color }}
                      />
                    ))}
                  </div>
                  <div className="mt-4 flex items-center gap-3">
                    <Input
                      value={editingAnn.color}
                      onChange={(e) => {
                        if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) {
                          setEditingAnn({ ...editingAnn, color: e.target.value });
                        }
                      }}
                      placeholder="#3b82f6"
                      className={cn('flex-1', inputClass)}
                    />
                    <input
                      type="color"
                      aria-label="เลือกสี"
                      title="เลือกสี"
                      value={editingAnn.color}
                      onChange={(e) => setEditingAnn({ ...editingAnn, color: e.target.value })}
                      className="size-11 cursor-pointer rounded-[10px] border-none p-0"
                    />
                  </div>
                </div>

                {/* Preview */}
                {(editingAnn.message || editingAnn.imageUrl) && (
                  <div>
                    <p className="mb-2 text-xs text-[var(--text-muted)]">ตัวอย่างการแสดงผล:</p>
                    <div className="rounded-xl p-4" style={{ backgroundColor: editingAnn.color }}>
                      {editingAnn.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={editingAnn.imageUrl}
                          alt="Preview"
                          className={cn(
                            'max-h-[120px] w-full rounded-lg object-cover',
                            editingAnn.message ? 'mb-3' : '',
                          )}
                        />
                      )}
                      {editingAnn.message && (
                        <p className="whitespace-pre-wrap text-center text-sm text-white">
                          {editingAnn.message}
                        </p>
                      )}
                      <div className="mt-2 flex items-center justify-end gap-2">
                        {editingAnn.showLogo && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src="/logo.png"
                            alt="Logo"
                            className="theme-logo size-5 rounded"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        )}
                        <span className="text-xs text-[var(--foreground)]">
                          — {editingAnn.displayName || 'แอดมิน'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <DialogFooter className="gap-2 border-t border-[var(--glass-border)] pt-4">
              <Button variant="outline" onClick={() => setEditingAnn(null)} className={secondaryBtnClass}>
                ยกเลิก
              </Button>
              <Button
                onClick={handleSaveAnnouncement}
                disabled={saving || (!editingAnn?.message && !editingAnn?.imageUrl)}
                className={gradientBtnClass}
              >
                {saving ? (
                  <Loader2 className="mr-2 size-5 animate-spin" />
                ) : (
                  <Save className="mr-2" size={18} />
                )}
                บันทึก
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* History Dialog */}
        <Dialog open={showHistory} onOpenChange={setShowHistory}>
          <DialogContent
            className="max-h-[80vh] overflow-hidden border-[var(--glass-border)] bg-[var(--glass-bg)] sm:max-w-2xl"
            showCloseButton
          >
            <DialogHeader className="flex-row items-center gap-3 border-b border-[var(--glass-border)] pb-4">
              <div className="flex size-10 items-center justify-center rounded-xl bg-violet-500 text-white">
                <History size={18} />
              </div>
              <div>
                <DialogTitle className="text-[var(--foreground)]">ประวัติประกาศ</DialogTitle>
                <p className="text-xs text-[var(--text-muted)]">
                  ประกาศที่ถูกลบไปแล้ว {history.length} รายการ
                </p>
              </div>
            </DialogHeader>

            {history.length === 0 ? (
              <div className="p-12 text-center">
                <Archive size={64} className="mx-auto mb-4 text-slate-600" />
                <p className="text-[var(--text-muted)]">ยังไม่มีประวัติประกาศ</p>
              </div>
            ) : (
              <ScrollArea className="max-h-[50vh] py-4">
                <div className="flex flex-col gap-4 px-1">
                  {history.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="relative rounded-xl border border-[var(--glass-border)] bg-white/[0.03] p-4"
                    >
                      <div
                        className="absolute top-0 bottom-0 left-0 w-1 rounded-l-xl"
                        style={{ backgroundColor: item.color }}
                      />

                      <div className="flex items-start gap-4 pl-2">
                        {item.imageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.imageUrl}
                            alt=""
                            className="h-[45px] w-[60px] rounded-lg object-cover"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="mb-1 text-[0.7rem] text-[var(--text-muted)]">
                            ลบเมื่อ:{' '}
                            {item.deletedAt
                              ? new Date(item.deletedAt).toLocaleDateString('th-TH', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : '-'}
                          </p>
                          <p className="line-clamp-2 whitespace-pre-wrap text-sm text-[var(--text-muted)]">
                            {item.message || '(รูปภาพอย่างเดียว)'}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-8 text-emerald-500"
                                onClick={() => handleRestoreFromHistory(item)}
                                disabled={saving}
                              >
                                <ContentCopy size={18} />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>กู้คืน</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-8 text-red-500"
                                onClick={() => handleDeleteFromHistory(item)}
                                disabled={saving}
                              >
                                <Delete size={18} />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>ลบถาวร</TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            <DialogFooter className="border-t border-[var(--glass-border)] pt-4">
              <Button variant="outline" onClick={() => setShowHistory(false)} className={secondaryBtnClass}>
                ปิด
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Social Media News Section */}
        <div className="mt-2">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h3 className="flex items-center gap-2 text-xl font-extrabold text-[var(--foreground)]">
                <Radio size={22} />
                อัพเดตข่าวสาร / โซเชียลมีเดีย
              </h3>
              <p className="text-sm text-[var(--text-muted)]">
                แจ้งเตือนลูกค้าเมื่อมีโพสต์ใหม่บน IG, Facebook, TikTok
              </p>
            </div>
            <Button
              onClick={() => {
                const newNews = {
                  id: `news_${Date.now()}`,
                  platform: 'instagram' as const,
                  title: '',
                  description: '',
                  postUrl: '',
                  imageUrl: '',
                  postedAt: new Date().toISOString(),
                  enabled: true,
                  createdBy: userEmail || 'แอดมิน',
                };
                const current = config.socialMediaNews || [];
                saveConfig({ ...config, socialMediaNews: [newNews, ...current] });
              }}
              className={cn(gradientBtnClass, 'gap-2')}
            >
              <Add size={20} />
              เพิ่มข่าว
            </Button>
          </div>

          {(config.socialMediaNews || []).length === 0 ? (
            <div className={cn(glassCardClass, 'p-8 text-center')}>
              <Radio size={48} className="mx-auto mb-3 text-slate-600" />
              <p className="text-sm text-[var(--text-muted)]">
                ยังไม่มีข่าวสาร — เพิ่มข่าวเมื่อมีโพสต์ใหม่บนโซเชียลมีเดีย
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {(config.socialMediaNews || []).map((news, idx) => {
                const platformMap: Record<
                  string,
                  { label: string; icon: React.ReactNode; color: string }
                > = {
                  instagram: { label: 'Instagram', icon: <ImageIcon size={14} />, color: '#E4405F' },
                  facebook: { label: 'Facebook', icon: <Groups size={14} />, color: '#1877F2' },
                  tiktok: { label: 'TikTok', icon: <Radio size={14} />, color: '#ff0050' },
                  line: { label: 'LINE', icon: <Send size={14} />, color: '#06C755' },
                };
                const pf = platformMap[news.platform] || platformMap.instagram;

                return (
                  <div
                    key={news.id}
                    className={cn(glassCardClass, 'p-4 transition-opacity')}
                    style={{
                      borderLeftWidth: 3,
                      borderLeftColor: pf.color,
                      opacity: news.enabled ? 1 : 0.5,
                    }}
                  >
                    <div className="flex items-start gap-4">
                      {news.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={news.imageUrl}
                          alt=""
                          className="size-[60px] shrink-0 rounded-[10px] object-cover"
                        />
                      )}
                      <div className="flex min-w-0 flex-1 flex-col gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Select
                            value={news.platform}
                            onValueChange={(value) => {
                              const updated = [...(config.socialMediaNews || [])];
                              updated[idx] = {
                                ...news,
                                platform: value as typeof news.platform,
                              };
                              saveConfig({ ...config, socialMediaNews: updated });
                            }}
                          >
                            <SelectTrigger className={cn('h-8 min-w-[130px] text-xs', inputClass)}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(platformMap).map(([k, v]) => (
                                <SelectItem key={k} value={k}>
                                  <span className="flex items-center gap-2">
                                    <span style={{ color: v.color }}>{v.icon}</span>
                                    {v.label}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <span
                            className={cn(
                              'rounded-md px-2 py-0.5 text-[0.7rem] font-semibold',
                              news.enabled
                                ? 'bg-emerald-500/15 text-emerald-500'
                                : 'bg-slate-500/15 text-slate-500',
                            )}
                          >
                            {news.enabled ? 'เปิด' : 'ปิด'}
                          </span>
                        </div>

                        <Input
                          placeholder="หัวข้อข่าว เช่น 'โพสต์ใหม่! เสื้อคอลเลคชันใหม่'"
                          value={news.title}
                          onChange={(e) => {
                            const updated = [...(config.socialMediaNews || [])];
                            updated[idx] = { ...news, title: e.target.value };
                            saveConfig({ ...config, socialMediaNews: updated });
                          }}
                          className={cn('h-8', inputClass)}
                        />

                        <div className="flex flex-wrap gap-2">
                          <Input
                            placeholder="ลิงก์โพสต์ https://..."
                            value={news.postUrl}
                            onChange={(e) => {
                              const updated = [...(config.socialMediaNews || [])];
                              updated[idx] = { ...news, postUrl: e.target.value };
                              saveConfig({ ...config, socialMediaNews: updated });
                            }}
                            className={cn('h-8 min-w-[200px] flex-1', inputClass)}
                          />
                          <Input
                            placeholder="URL รูปภาพ (ไม่บังคับ)"
                            value={news.imageUrl || ''}
                            onChange={(e) => {
                              const updated = [...(config.socialMediaNews || [])];
                              updated[idx] = { ...news, imageUrl: e.target.value };
                              saveConfig({ ...config, socialMediaNews: updated });
                            }}
                            className={cn('h-8 min-w-[200px] flex-1', inputClass)}
                          />
                        </div>

                        <Input
                          placeholder="คำอธิบายสั้น ๆ (ไม่บังคับ)"
                          value={news.description || ''}
                          onChange={(e) => {
                            const updated = [...(config.socialMediaNews || [])];
                            updated[idx] = { ...news, description: e.target.value };
                            saveConfig({ ...config, socialMediaNews: updated });
                          }}
                          className={cn('h-8', inputClass)}
                        />
                      </div>

                      <div className="flex shrink-0 flex-col gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              onClick={() => {
                                const updated = [...(config.socialMediaNews || [])];
                                updated[idx] = { ...news, enabled: !news.enabled };
                                saveConfig({ ...config, socialMediaNews: updated });
                              }}
                            >
                              {news.enabled ? (
                                <ToggleOn className="size-5 text-emerald-500" />
                              ) : (
                                <ToggleOff className="size-5 text-slate-500" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{news.enabled ? 'ปิด' : 'เปิด'}</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-8 text-red-500"
                              onClick={async () => {
                                const ok = await confirm({
                                  title: 'ลบข่าวนี้?',
                                  variant: 'warning',
                                  confirmText: 'ลบ',
                                  cancelText: 'ยกเลิก',
                                  destructive: true,
                                });
                                if (ok) {
                                  const updated = (config.socialMediaNews || []).filter(
                                    (n) => n.id !== news.id,
                                  );
                                  saveConfig({ ...config, socialMediaNews: updated });
                                  showToast('success', 'ลบข่าวสำเร็จ');
                                }
                              }}
                            >
                              <Delete size={18} />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>ลบ</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
});
