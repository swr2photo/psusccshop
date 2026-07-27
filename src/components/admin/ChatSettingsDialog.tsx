'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Settings as SettingsIcon,
  Plus,
  Trash2,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Volume2,
  Bell,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  NOTIFICATION_SOUNDS,
  QUICK_REPLY_CATEGORIES,
  createEmptyQuickReply,
  normalizeSupportChatSettings,
  playNotificationTone,
  type QuickReplyCategory,
  type QuickReplyItem,
  type SupportChatSettings,
} from '@/lib/support-chat-settings';

type ChatSettingsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: SupportChatSettings;
  onChange: (settings: SupportChatSettings) => void;
  onSave: () => void | Promise<void>;
  saving?: boolean;
};

const DAY_LABELS = [
  { d: 1, label: 'จ' },
  { d: 2, label: 'อ' },
  { d: 3, label: 'พ' },
  { d: 4, label: 'พฤ' },
  { d: 5, label: 'ศ' },
  { d: 6, label: 'ส' },
  { d: 0, label: 'อา' },
];

function LivePreview({ settings }: { settings: SupportChatSettings }) {
  const reply =
    settings.working_hours_enabled
      ? settings.working_hours_message
      : settings.auto_reply_message;

  return (
    <div className="rounded-xl bg-slate-50 p-3.5 ring-1 ring-slate-200 dark:bg-[#0c1220] dark:ring-white/10">
      <p className="mb-2.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        ตัวอย่างฝั่งลูกค้า
      </p>
      <div className="overflow-hidden rounded-lg bg-white ring-1 ring-slate-200 dark:bg-[#111827] dark:ring-white/5">
        <div className="flex items-center gap-2.5 border-b border-slate-200 px-3 py-2.5 dark:border-white/5">
          <div className="flex size-8 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 dark:bg-sky-600/30 dark:text-sky-300">
            {(settings.admin_display_name || 'A').slice(0, 1)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{settings.admin_display_name || 'ทีมงาน'}</p>
            <p className="text-xs text-muted-foreground">แชทสนับสนุน</p>
          </div>
        </div>
        <div className="space-y-2.5 bg-slate-50/80 px-3 py-3.5 dark:bg-transparent">
          <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-blue-600 px-3 py-2 text-sm text-white">
            สวัสดีค่ะ อยากสอบถามออเดอร์
          </div>
          {settings.auto_reply_enabled && reply?.trim() && (
            <div className="max-w-[90%] rounded-2xl rounded-bl-md bg-slate-100 px-3 py-2 text-sm text-slate-900 ring-1 ring-slate-200 dark:bg-white/8 dark:text-foreground/90 dark:ring-white/5">
              <p className="mb-1 text-xs text-muted-foreground">{settings.admin_display_name}</p>
              {reply}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ChatSettingsDialog({
  open,
  onOpenChange,
  settings,
  onChange,
  onSave,
  saving,
}: ChatSettingsDialogProps) {
  const [tab, setTab] = useState('general');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<QuickReplyCategory | 'all'>('all');
  const [previewOpen, setPreviewOpen] = useState(true);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>(
    'default'
  );

  useEffect(() => {
    if (typeof Notification === 'undefined') {
      setNotifPermission('unsupported');
      return;
    }
    setNotifPermission(Notification.permission);
  }, [open]);

  const patch = (partial: Partial<SupportChatSettings>) => {
    onChange(normalizeSupportChatSettings({ ...settings, ...partial }));
  };

  const visibleReplies = useMemo(() => {
    if (categoryFilter === 'all') return settings.quick_replies.map((item, index) => ({ item, index }));
    return settings.quick_replies
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.category === categoryFilter);
  }, [settings.quick_replies, categoryFilter]);

  const updateReply = (index: number, partial: Partial<QuickReplyItem>) => {
    const next = settings.quick_replies.map((r, i) => (i === index ? { ...r, ...partial } : r));
    patch({ quick_replies: next });
  };

  const moveReply = (from: number, to: number) => {
    if (to < 0 || to >= settings.quick_replies.length) return;
    const next = [...settings.quick_replies];
    const [row] = next.splice(from, 1);
    next.splice(to, 0, row);
    patch({ quick_replies: next });
  };

  const removeReply = (index: number) => {
    patch({ quick_replies: settings.quick_replies.filter((_, i) => i !== index) });
  };

  const addReply = () => {
    const cat = categoryFilter === 'all' ? 'general' : categoryFilter;
    patch({ quick_replies: [...settings.quick_replies, createEmptyQuickReply(cat)] });
  };

  const requestDesktopPermission = async () => {
    if (typeof Notification === 'undefined') return;
    const result = await Notification.requestPermission();
    setNotifPermission(result);
    if (result === 'granted') {
      patch({ notification_desktop: true });
      try {
        new Notification('การแจ้งเตือนแชทพร้อมแล้ว', {
          body: 'คุณจะได้รับการแจ้งเตือนเมื่อมีข้อความใหม่',
          icon: '/favicon.png',
        });
      } catch {
        /* ignore */
      }
    }
  };

  const toggleDay = (day: number) => {
    const set = new Set(settings.working_days);
    if (set.has(day)) set.delete(day);
    else set.add(day);
    const days = [...set].sort((a, b) => a - b);
    patch({ working_days: days.length ? days : [1, 2, 3, 4, 5] });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-5xl flex-col gap-0 overflow-hidden bg-card p-0 text-foreground sm:max-w-5xl">
        <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
          <div className="flex items-center justify-between gap-3 pr-8">
            <DialogTitle className="flex items-center gap-2.5 text-lg">
              <SettingsIcon className="size-5" />
              ตั้งค่าแชท
            </DialogTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="hidden h-9 gap-1.5 text-sm md:inline-flex"
              onClick={() => setPreviewOpen((v) => !v)}
            >
              {previewOpen ? (
                <>
                  <PanelRightClose className="size-4" />
                  ซ่อนพรีวิว
                </>
              ) : (
                <>
                  <PanelRightOpen className="size-4" />
                  แสดงพรีวิว
                </>
              )}
            </Button>
          </div>
        </DialogHeader>

        <div
          className={cn(
            'grid min-h-0 flex-1 gap-0',
            previewOpen ? 'md:grid-cols-[minmax(0,65%)_minmax(0,35%)]' : 'md:grid-cols-1'
          )}
        >
          <Tabs
            value={tab}
            onValueChange={setTab}
            className="flex min-h-0 flex-col gap-0 overflow-hidden"
          >
            <div className="shrink-0 border-b border-border px-5 py-3">
              <TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-xl bg-slate-100 p-1.5 dark:bg-muted">
                <TabsTrigger
                  value="general"
                  className="rounded-lg px-4 py-2 text-sm data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm dark:data-[state=active]:bg-background dark:data-[state=active]:text-foreground"
                >
                  ทั่วไป
                </TabsTrigger>
                <TabsTrigger
                  value="replies"
                  className="rounded-lg px-4 py-2 text-sm data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm dark:data-[state=active]:bg-background dark:data-[state=active]:text-foreground"
                >
                  ข้อความตอบด่วน
                </TabsTrigger>
                <TabsTrigger
                  value="hours"
                  className="rounded-lg px-4 py-2 text-sm data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm dark:data-[state=active]:bg-background dark:data-[state=active]:text-foreground"
                >
                  เวลาทำการ
                </TabsTrigger>
                <TabsTrigger
                  value="notify"
                  className="rounded-lg px-4 py-2 text-sm data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm dark:data-[state=active]:bg-background dark:data-[state=active]:text-foreground"
                >
                  การแจ้งเตือน
                </TabsTrigger>
                <TabsTrigger
                  value="routing"
                  className="rounded-lg px-4 py-2 text-sm data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm dark:data-[state=active]:bg-background dark:data-[state=active]:text-foreground"
                >
                  Routing
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <TabsContent value="general" className="mt-0 space-y-5">
                <div className="space-y-2.5">
                  <Label htmlFor="admin-display-name" className="text-sm">
                    ชื่อทีมแอดมินที่แสดง
                  </Label>
                  <Input
                    id="admin-display-name"
                    className="h-10 text-sm"
                    value={settings.admin_display_name}
                    onChange={(e) => patch({ admin_display_name: e.target.value })}
                    placeholder="เช่น ทีมงาน PSU SCC"
                  />
                  <p className="text-sm text-muted-foreground">ชื่อที่ลูกค้าจะเห็นในหัวข้อแชท</p>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label htmlFor="auto-reply" className="text-sm">
                      ข้อความตอบอัตโนมัติตอนเปิดเคส
                    </Label>
                    <p className="text-sm text-muted-foreground">ส่งทันทีเมื่อลูกค้าเริ่มแชท (ในเวลาทำการ)</p>
                  </div>
                  <Switch
                    id="auto-reply"
                    checked={settings.auto_reply_enabled}
                    onCheckedChange={(checked) => patch({ auto_reply_enabled: checked })}
                  />
                </div>

                <div className="space-y-2.5">
                  <Label htmlFor="auto-reply-message" className="text-sm">
                    ข้อความต้อนรับ
                  </Label>
                  <Textarea
                    id="auto-reply-message"
                    rows={3}
                    className="min-h-[88px] text-sm"
                    value={settings.auto_reply_message}
                    onChange={(e) => patch({ auto_reply_message: e.target.value })}
                    disabled={!settings.auto_reply_enabled}
                  />
                </div>
              </TabsContent>

              <TabsContent value="replies" className="mt-0 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    พิมพ์ / ในช่องแชทเพื่อเรียกใช้ · ลากหรือใช้ลูกศรจัดลำดับ
                  </p>
                  <div className="flex items-center gap-2.5">
                    <Select
                      value={categoryFilter}
                      onValueChange={(v) => setCategoryFilter(v as QuickReplyCategory | 'all')}
                    >
                      <SelectTrigger className="h-10 w-[160px] text-sm">
                        <SelectValue placeholder="หมวดหมู่" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">ทุกหมวด</SelectItem>
                        {QUICK_REPLY_CATEGORIES.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button type="button" className="h-10 gap-1.5 text-sm" onClick={addReply}>
                      <Plus className="size-4" />
                      เพิ่ม
                    </Button>
                  </div>
                </div>

                <div className="space-y-3.5">
                  {visibleReplies.length === 0 ? (
                    <p className="rounded-xl bg-muted/40 px-4 py-8 text-center text-sm text-muted-foreground">
                      ยังไม่มีข้อความในหมวดนี้
                    </p>
                  ) : (
                    visibleReplies.map(({ item, index }) => (
                      <div
                        key={item.id}
                        draggable
                        onDragStart={() => setDragIndex(index)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => {
                          if (dragIndex === null || dragIndex === index) return;
                          moveReply(dragIndex, index);
                          setDragIndex(null);
                        }}
                        onDragEnd={() => setDragIndex(null)}
                        className={cn(
                          'rounded-xl border border-slate-200 bg-white p-3.5 dark:border-border/70 dark:bg-background/60',
                          dragIndex === index && 'opacity-60'
                        )}
                      >
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            className="inline-flex size-9 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-slate-100 active:cursor-grabbing dark:hover:bg-muted"
                            aria-label="ลากจัดลำดับ"
                          >
                            <GripVertical className="size-5" />
                          </button>
                          <div className="flex items-center gap-1.5 rounded-md bg-slate-50 px-2 ring-1 ring-slate-200 dark:bg-muted/40 dark:ring-border">
                            <span className="text-sm font-medium text-muted-foreground">/</span>
                            <Input
                              value={item.slash}
                              onChange={(e) =>
                                updateReply(index, {
                                  slash: e.target.value.replace(/^\//, '').toLowerCase(),
                                })
                              }
                              placeholder="hello"
                              className="h-9 w-28 border-0 bg-transparent font-mono text-sm shadow-none focus-visible:ring-0"
                            />
                          </div>
                          <Select
                            value={item.category}
                            onValueChange={(v) =>
                              updateReply(index, { category: v as QuickReplyCategory })
                            }
                          >
                            <SelectTrigger className="h-9 w-[130px] text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {QUICK_REPLY_CATEGORIES.map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div className="ml-auto flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-9"
                              onClick={() => moveReply(index, index - 1)}
                              disabled={index === 0}
                              aria-label="ย้ายขึ้น"
                            >
                              <ChevronUp className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-9"
                              onClick={() => moveReply(index, index + 1)}
                              disabled={index >= settings.quick_replies.length - 1}
                              aria-label="ย้ายลง"
                            >
                              <ChevronDown className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-9 text-destructive hover:text-destructive"
                              onClick={() => removeReply(index)}
                              aria-label="ลบ"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </div>
                        <Textarea
                          rows={2}
                          value={item.text}
                          onChange={(e) => updateReply(index, { text: e.target.value })}
                          placeholder="ข้อความที่จะส่ง..."
                          className="min-h-[72px] resize-none text-sm"
                        />
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="hours" className="mt-0 space-y-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label className="text-sm">ใช้เวลาทำการ</Label>
                    <p className="text-sm text-muted-foreground">
                      นอกเวลาจะใช้ข้อความตอบกลับนอกเวลาแทนข้อความต้อนรับ
                    </p>
                  </div>
                  <Switch
                    checked={settings.working_hours_enabled}
                    onCheckedChange={(checked) => patch({ working_hours_enabled: checked })}
                  />
                </div>

                <div className="space-y-2.5">
                  <Label className="text-sm">วันทำการ</Label>
                  <div className="flex flex-wrap gap-2">
                    {DAY_LABELS.map(({ d, label }) => {
                      const on = settings.working_days.includes(d);
                      return (
                        <button
                          key={d}
                          type="button"
                          disabled={!settings.working_hours_enabled}
                          onClick={() => toggleDay(d)}
                          className={cn(
                            'size-10 rounded-lg text-sm font-medium transition',
                            on
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-muted dark:text-muted-foreground dark:hover:bg-muted/80',
                            !settings.working_hours_enabled && 'opacity-50'
                          )}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2.5">
                    <Label htmlFor="wh-start" className="text-sm">
                      เปิด
                    </Label>
                    <Input
                      id="wh-start"
                      type="time"
                      className="h-10 text-sm"
                      value={settings.working_hours_start}
                      disabled={!settings.working_hours_enabled}
                      onChange={(e) => patch({ working_hours_start: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2.5">
                    <Label htmlFor="wh-end" className="text-sm">
                      ปิด
                    </Label>
                    <Input
                      id="wh-end"
                      type="time"
                      className="h-10 text-sm"
                      value={settings.working_hours_end}
                      disabled={!settings.working_hours_enabled}
                      onChange={(e) => patch({ working_hours_end: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2.5">
                  <Label htmlFor="off-hours-msg" className="text-sm">
                    ข้อความนอกเวลาทำการ
                  </Label>
                  <Textarea
                    id="off-hours-msg"
                    rows={3}
                    className="min-h-[88px] text-sm"
                    value={settings.working_hours_message}
                    disabled={!settings.working_hours_enabled}
                    onChange={(e) => patch({ working_hours_message: e.target.value })}
                    placeholder="ขณะนี้อยู่นอกเวลาทำการ..."
                  />
                </div>
              </TabsContent>

              <TabsContent value="notify" className="mt-0 space-y-5">
                <div className="flex items-center justify-between gap-4">
                  <Label className="text-sm">เสียงแจ้งเตือนในแอดมิน</Label>
                  <Switch
                    checked={settings.notification_sound}
                    onCheckedChange={(checked) => patch({ notification_sound: checked })}
                  />
                </div>

                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-[180px] flex-1 space-y-2.5">
                    <Label className="text-sm">เลือกเสียง</Label>
                    <Select
                      value={settings.notification_sound_id}
                      onValueChange={(v) =>
                        patch({ notification_sound_id: v as SupportChatSettings['notification_sound_id'] })
                      }
                      disabled={!settings.notification_sound}
                    >
                      <SelectTrigger className="h-10 w-full text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {NOTIFICATION_SOUNDS.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 gap-1.5 text-sm"
                    disabled={!settings.notification_sound}
                    onClick={() => playNotificationTone(settings.notification_sound_id)}
                  >
                    <Volume2 className="size-4" />
                    ทดสอบ
                  </Button>
                </div>

                <div className="space-y-4 rounded-xl border border-slate-200 p-4 dark:border-border/70">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <Label className="flex items-center gap-1.5 text-sm">
                        <Bell className="size-4" />
                        Desktop / Browser Notification
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        แจ้งเตือนมุมจอเมื่อมีข้อความใหม่ แม้แท็บไม่ได้โฟกัส
                      </p>
                    </div>
                    <Switch
                      checked={settings.notification_desktop}
                      onCheckedChange={(checked) => patch({ notification_desktop: checked })}
                      disabled={notifPermission === 'denied' || notifPermission === 'unsupported'}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5 text-sm text-muted-foreground">
                    <span>
                      สิทธิ์:{' '}
                      {notifPermission === 'unsupported'
                        ? 'ไม่รองรับ'
                        : notifPermission === 'granted'
                          ? 'อนุญาตแล้ว'
                          : notifPermission === 'denied'
                            ? 'ถูกปฏิเสธ'
                            : 'ยังไม่ขอ'}
                    </span>
                    {notifPermission !== 'granted' && notifPermission !== 'unsupported' && (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="h-9 text-sm"
                        onClick={requestDesktopPermission}
                      >
                        ขอสิทธิ์แจ้งเตือน
                      </Button>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="routing" className="mt-0 space-y-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label className="text-sm">Auto-Assign (Round-Robin)</Label>
                    <p className="text-sm text-muted-foreground">
                      ปิดใช้งานชั่วคราว — เคสใหม่จะอยู่สถานะรอรับเสมอ จนกว่าแอดมินจะกดรับเอง
                      (ไม่ให้ระบบ/บอทรับเคสแทน)
                    </p>
                  </div>
                  <Switch
                    checked={false}
                    disabled
                    onCheckedChange={() => {}}
                  />
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label className="text-sm">ปิดเคสอัตโนมัติเมื่อลูกค้าเงียบ</Label>
                    <p className="text-sm text-muted-foreground">
                      ปิดแชท active หากลูกค้าไม่ตอบเกิน X ชั่วโมง
                    </p>
                  </div>
                  <Switch
                    checked={settings.auto_close_enabled}
                    onCheckedChange={(checked) => patch({ auto_close_enabled: checked })}
                  />
                </div>

                <div className="space-y-2.5">
                  <Label htmlFor="auto-close-hours" className="text-sm">
                    จำนวนชั่วโมงที่รอ
                  </Label>
                  <Input
                    id="auto-close-hours"
                    type="number"
                    min={1}
                    max={720}
                    className="h-10 text-sm"
                    value={settings.auto_close_hours}
                    disabled={!settings.auto_close_enabled}
                    onChange={(e) =>
                      patch({ auto_close_hours: Math.max(1, Number(e.target.value) || 1) })
                    }
                  />
                </div>
              </TabsContent>
            </div>
          </Tabs>

          {previewOpen && (
            <aside className="hidden border-l border-slate-200 bg-slate-50/80 p-5 md:block dark:border-border dark:bg-muted/20">
              <LivePreview settings={settings} />
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                พรีวิวอัปเดตตามค่าที่แก้ — กดบันทึกเพื่อใช้งานจริง
              </p>
            </aside>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t border-border px-6 py-3.5">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="h-10 text-muted-foreground">
            ยกเลิก
          </Button>
          <Button
            onClick={() => void onSave()}
            disabled={saving}
            className="h-10 bg-blue-600 px-5 text-sm hover:bg-blue-700"
          >
            {saving ? 'กำลังบันทึก...' : 'บันทึก'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
