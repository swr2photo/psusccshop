'use client';

// Admin question editor: grouped type picker, drag-to-reorder options, presets, detailed option rules, and conditional logic.

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  AlignLeft,
  ArrowDown,
  ArrowUp,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronsUpDown,
  CircleDot,
  Copy,
  CornerDownLeft,
  GitBranch,
  GripVertical,
  MessageSquarePlus,
  MoreHorizontal,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  SquareCheck,
  Star,
  Trash2,
  Type,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import FormConditionBuilder from '@/components/admin/forms/FormConditionBuilder';
import { cn } from '@/lib/utils';
import {
  CHOICE_QUESTION_TYPES,
  FORM_LIMITS,
  FORM_TEXT_FORMATS,
  FORM_TEXT_FORMAT_LABELS,
  OTHER_OPTION_LABEL,
  createEmptyQuestion,
  describeConditionSet,
  makeFormId,
  type FormConditionSet,
  type FormOption,
  type FormOptionActionType,
  type FormQuestion,
  type FormQuestionType,
  type FormTextFormat,
  type FormTextValidation,
} from '@/lib/forms';
import { FORM_OPTION_PRESETS, FORM_PRESET_CATEGORIES, type FormOptionPreset } from '@/lib/form-presets';

// ───────────────────────── Question types ─────────────────────────

type TypeMeta = { label: string; hint: string; icon: React.ComponentType<{ size?: number; className?: string }> };

export const QUESTION_TYPE_META: Record<FormQuestionType, TypeMeta> = {
  single_choice: { label: 'เลือกตอบ 1 ข้อ', hint: 'โหวต / Radio button', icon: CircleDot },
  multiple_choice: { label: 'เลือกได้หลายข้อ', hint: 'Checkbox กำหนดขั้นต่ำ-สูงสุดได้', icon: SquareCheck },
  dropdown: { label: 'รายการแบบเลื่อนลง', hint: 'Dropdown เหมาะกับตัวเลือกเยอะ', icon: ChevronsUpDown },
  short_text: { label: 'ข้อความสั้น', hint: 'ชื่อ รหัสนักศึกษา ตัวเลข อีเมล', icon: Type },
  long_text: { label: 'ข้อความยาว', hint: 'เหตุผล ความคิดเห็น ข้อเสนอแนะ', icon: AlignLeft },
  rating: { label: 'ให้คะแนน 1–5 ดาว', hint: 'วัดความพึงพอใจ', icon: Star },
  date: { label: 'วันที่', hint: 'เลือกวัน/เดือน/ปี', icon: CalendarDays },
};

const TYPE_GROUPS: { label: string; types: FormQuestionType[] }[] = [
  { label: 'ตัวเลือก / โหวต', types: ['single_choice', 'multiple_choice', 'dropdown'] },
  { label: 'ข้อความ', types: ['short_text', 'long_text'] },
  { label: 'คะแนนและวันที่', types: ['rating', 'date'] },
];

function QuestionTypePicker({ value, onChange }: { value: FormQuestionType; onChange: (t: FormQuestionType) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const meta = QUESTION_TYPE_META[value];
  const Icon = meta.icon;
  const q = query.trim().toLowerCase();
  const groups = TYPE_GROUPS.map((g) => ({
    ...g,
    types: g.types.filter((t) => !q || `${QUESTION_TYPE_META[t].label} ${QUESTION_TYPE_META[t].hint}`.toLowerCase().includes(q)),
  })).filter((g) => g.types.length);

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery(''); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="ประเภทคำถาม"
          className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-input bg-transparent px-3 text-left text-sm font-semibold shadow-xs outline-none hover:bg-muted/60 focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:w-[210px] sm:flex-none"
        >
          <Icon size={16} className="shrink-0 text-primary" />
          <span className="flex-1 truncate">{meta.label}</span>
          <ChevronDown size={14} className={cn('text-muted-foreground transition-transform', open && 'rotate-180')} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[300px] p-2">
        <div className="relative mb-2">
          <Search size={14} className="absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground" />
          <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหาประเภทคำถาม..." className="h-8 pl-8 text-[0.82rem]" />
        </div>
        <div className="max-h-[320px] overflow-y-auto">
          {groups.length === 0 && <p className="px-2 py-4 text-center text-[0.8rem] text-muted-foreground">ไม่พบประเภทที่ค้นหา</p>}
          {groups.map((g) => (
            <div key={g.label} className="mb-1">
              <p className="px-2 pt-1.5 pb-1 text-[0.68rem] font-bold tracking-wide text-muted-foreground uppercase">{g.label}</p>
              {g.types.map((t) => {
                const m = QUESTION_TYPE_META[t];
                const TIcon = m.icon;
                const active = t === value;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => { onChange(t); setOpen(false); setQuery(''); }}
                    className={cn('flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors', active ? 'bg-primary/12 text-primary' : 'hover:bg-muted')}
                  >
                    <TIcon size={16} className={cn('shrink-0', active ? 'text-primary' : 'text-muted-foreground')} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[0.85rem] font-semibold">{m.label}</span>
                      <span className="block truncate text-[0.72rem] text-muted-foreground">{m.hint}</span>
                    </span>
                    {active && <Check size={15} />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ───────────────────────── Pointer-based reordering (mouse + touch) ─────────────────────────

export function useReorder(length: number, onMove: (from: number, to: number) => void) {
  const listId = useId();
  const [drag, setDrag] = useState<{ from: number; over: number } | null>(null);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= length || from === to) return;
    onMove(from, to);
  };

  const handleProps = (i: number) => ({
    'aria-roledescription': 'ปุ่มลากเพื่อสลับลำดับ',
    style: { touchAction: 'none' as const },
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      setDrag({ from: i, over: i });
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      if (!drag) return;
      const row = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>(`[data-reorder="${listId}"]`);
      if (!row) return;
      const over = Number(row.dataset.index);
      if (Number.isFinite(over) && over !== drag.over) setDrag({ ...drag, over });
    },
    onPointerUp: () => {
      if (drag) move(drag.from, drag.over);
      setDrag(null);
    },
    onPointerCancel: () => setDrag(null),
    onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.key === 'ArrowUp') { e.preventDefault(); move(i, i - 1); }
      if (e.key === 'ArrowDown') { e.preventDefault(); move(i, i + 1); }
    },
  });

  const rowProps = (i: number) => ({ 'data-reorder': listId, 'data-index': i });

  /** Classes for the row being dragged / the drop target. */
  const rowState = (i: number) => {
    if (!drag) return '';
    if (i === drag.from) return 'opacity-50';
    if (i === drag.over) return drag.over < drag.from ? 'shadow-[0_-3px_0_0_var(--primary)]' : 'shadow-[0_3px_0_0_var(--primary)]';
    return '';
  };

  return { handleProps, rowProps, rowState, dragging: Boolean(drag) };
}

function arrayMove<T>(arr: T[], from: number, to: number): T[] {
  const next = [...arr];
  const [m] = next.splice(from, 1);
  next.splice(to, 0, m);
  return next;
}

// ───────────────────────── Presets ─────────────────────────

function PresetPicker({ onApply }: { onApply: (preset: FormOptionPreset) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState<string>('all');
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return FORM_OPTION_PRESETS.filter((p) => {
      if (cat !== 'all' && p.category !== cat) return false;
      if (!q) return true;
      return [p.name, p.description || '', ...p.options].join(' ').toLowerCase().includes(q);
    });
  }, [query, cat]);

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setQuery(''); setCat('all'); } }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex h-8 items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 text-[0.8rem] font-semibold text-primary transition-colors hover:border-primary/50 hover:bg-primary/10',
            open && 'border-primary bg-primary/15',
          )}
        >
          <Sparkles size={14} /> ชุดตัวเลือกสำเร็จรูป
          <ChevronDown size={13} className={cn('transition-transform', open && 'rotate-180')} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(360px,calc(100vw-32px))] p-0">
        <div className="border-b border-border p-2.5">
          <div className="relative">
            <Search size={14} className="absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground" />
            <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหา เช่น ไซซ์, ควร, ชั้นปี..." className="h-8 pl-8 text-[0.82rem]" />
          </div>
          <div className="mt-2 flex gap-1 overflow-x-auto pb-0.5">
            {FORM_PRESET_CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCat(c.id)}
                className={cn('shrink-0 rounded-full px-2.5 py-1 text-[0.72rem] font-semibold transition-colors', cat === c.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground')}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
        <div className="max-h-[340px] overflow-y-auto p-1.5">
          {list.length === 0 && <p className="py-6 text-center text-[0.8rem] text-muted-foreground">ไม่พบชุดตัวเลือก</p>}
          {list.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => { onApply(p); setOpen(false); }}
              className="group w-full rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-muted"
            >
              <span className="flex items-center gap-2 text-[0.85rem] font-semibold">
                {p.name}
                <span className="ml-auto text-[0.7rem] font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">ใช้ชุดนี้</span>
              </span>
              {p.description && <span className="block text-[0.72rem] text-muted-foreground">{p.description}</span>}
              <span className="mt-1.5 flex flex-wrap gap-1">
                {p.options.map((o) => <span key={o} className="rounded-md bg-muted px-1.5 py-0.5 text-[0.7rem] text-muted-foreground group-hover:bg-background">{o}</span>)}
                {p.withOther && <span className="rounded-md border border-dashed border-border px-1.5 py-0.5 text-[0.7rem] text-muted-foreground">อื่น ๆ</span>}
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ───────────────────────── Option helpers ─────────────────────────

function getOptionRuleTags(o: FormOption, allQuestions: FormQuestion[]): string[] {
  const tags: string[] = [];
  if (o.description) tags.push('มีคำอธิบาย');
  if (o.condition?.enabled) tags.push('มีเงื่อนไขแสดง');
  if (o.maxChoices && o.maxChoices > 0) tags.push(`จำกัด ${o.maxChoices} คน`);
  if (o.requireDetail) tags.push('กรอกเพิ่มเติม');
  if (o.exclusive) tags.push('ล้างข้ออื่น');
  if (o.disabled) tags.push('ปิดรับ');
  if (o.action === 'end_form') tags.push('จบฟอร์ม');
  else if (o.action === 'skip_to' && o.skipToQuestionId) {
    const idx = allQuestions.findIndex((q) => q.id === o.skipToQuestionId);
    if (idx >= 0) tags.push(`ข้ามไปข้อ ${idx + 1}`);
  }
  return tags;
}

function OptionRulesPanel({
  o,
  qType,
  earlierQuestions,
  laterQuestions,
  allQuestions,
  onChange,
}: {
  o: FormOption;
  qType: FormQuestionType;
  earlierQuestions: FormQuestion[];
  laterQuestions: FormQuestion[];
  allQuestions: FormQuestion[];
  onChange: (patch: Partial<FormOption>) => void;
}) {
  const allowBranch = qType === 'single_choice' || qType === 'dropdown';
  return (
    <div className="mt-1.5 mb-2 flex flex-col gap-3 rounded-xl border border-border bg-card p-3 text-[0.8rem]">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="mb-1 block text-[0.74rem] text-muted-foreground">คำอธิบายเพิ่มเติมใต้ตัวเลือก</Label>
          <Input
            value={o.description || ''}
            maxLength={250}
            onChange={(e) => onChange({ description: e.target.value || undefined })}
            placeholder="เช่น สำหรับนักศึกษาที่รับที่ตึกคณะวิทย์"
            className="h-8 text-[0.8rem]"
          />
        </div>

        <div>
          <Label className="mb-1 block text-[0.74rem] text-muted-foreground">จำกัดโควต้า / จำนวนผู้เลือกสูงสุด (คน)</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              max={100000}
              value={o.maxChoices || ''}
              placeholder="ไม่จำกัด"
              onChange={(e) => {
                const n = Number(e.target.value);
                onChange({
                  maxChoices: n > 0 ? Math.round(n) : null,
                  quotaFullBehavior: n > 0 ? (o.quotaFullBehavior || 'disable') : undefined,
                });
              }}
              className="h-8 w-28 text-[0.8rem]"
            />
            {o.maxChoices && o.maxChoices > 0 ? (
              <select
                value={o.quotaFullBehavior || 'disable'}
                onChange={(e) => onChange({ quotaFullBehavior: e.target.value === 'hide' ? 'hide' : 'disable' })}
                aria-label="เมื่อโควต้าเต็ม"
                className="h-8 flex-1 rounded-lg border border-input bg-background px-2 text-[0.76rem]"
              >
                <option value="disable">แสดงว่าเต็มแล้ว (เลือกไม่ได้)</option>
                <option value="hide">ซ่อนตัวเลือกนี้</option>
              </select>
            ) : null}
          </div>
        </div>
      </div>

      {/* Flags */}
      <div className="flex flex-col gap-2 rounded-lg border border-border/70 bg-muted/25 p-2.5">
        {!o.other && (
          <div className="flex flex-col gap-2">
            <label className="flex cursor-pointer items-center justify-between gap-2 text-[0.78rem]">
              <span>บังคับกรอกข้อความเพิ่มเติมเมื่อเลือกข้อนี้</span>
              <Switch
                checked={Boolean(o.requireDetail)}
                onCheckedChange={(v) => onChange({ requireDetail: Boolean(v) })}
              />
            </label>
            {o.requireDetail && (
              <Input
                value={o.detailPlaceholder || ''}
                maxLength={120}
                onChange={(e) => onChange({ detailPlaceholder: e.target.value || undefined })}
                placeholder="Placeholder เช่น โปรดระบุอาหารที่แพ้..."
                className="h-8 bg-card text-[0.78rem]"
              />
            )}
          </div>
        )}

        {qType === 'multiple_choice' && (
          <label className="flex cursor-pointer items-center justify-between gap-2 text-[0.78rem]">
            <span>เลือกข้อนี้แล้วล้างตัวเลือกอื่นทั้งหมด (เช่น “ไม่มี / ไม่ประสงค์ระบุ”)</span>
            <Switch
              checked={Boolean(o.exclusive)}
              onCheckedChange={(v) => onChange({ exclusive: Boolean(v) })}
            />
          </label>
        )}

        <label className="flex cursor-pointer items-center justify-between gap-2 text-[0.78rem]">
          <span>ปิดไม่ให้เลือกตัวเลือกนี้ชั่วคราว</span>
          <Switch
            checked={Boolean(o.disabled)}
            onCheckedChange={(v) => onChange({ disabled: Boolean(v) })}
          />
        </label>
      </div>

      {/* Branching for single_choice / dropdown */}
      {allowBranch && (
        <div className="rounded-lg border border-border/70 bg-muted/25 p-2.5">
          <Label className="mb-1.5 flex items-center gap-1.5 text-[0.76rem] font-semibold">
            <GitBranch size={13} className="text-primary" /> การกระทำเมื่อผู้ตอบเลือกข้อนี้
          </Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              value={o.action || 'next'}
              onChange={(e) => {
                const action = e.target.value as FormOptionActionType;
                onChange({
                  action,
                  skipToQuestionId: action === 'skip_to' ? (o.skipToQuestionId || laterQuestions[0]?.id || null) : null,
                  endMessage: action === 'end_form' ? o.endMessage : undefined,
                });
              }}
              aria-label="การกระทำเมื่อเลือกตัวเลือกนี้"
              className="h-8 rounded-lg border border-input bg-card px-2 text-[0.78rem]"
            >
              <option value="next">ดำเนินการต่อตามลำดับปกติ</option>
              <option value="skip_to" disabled={laterQuestions.length === 0}>
                ข้ามไปยังคำถามข้อ... {laterQuestions.length === 0 ? '(ไม่มีข้อถัดไป)' : ''}
              </option>
              <option value="end_form">จบแบบฟอร์มทันทีหลังข้อนี้</option>
            </select>

            {o.action === 'skip_to' && laterQuestions.length > 0 && (
              <select
                value={o.skipToQuestionId || ''}
                onChange={(e) => onChange({ skipToQuestionId: e.target.value || null })}
                aria-label="ข้ามไปยังคำถาม"
                className="h-8 flex-1 rounded-lg border border-input bg-card px-2 text-[0.78rem]"
              >
                {laterQuestions.map((lq) => {
                  const realIdx = allQuestions.findIndex((x) => x.id === lq.id);
                  return (
                    <option key={lq.id} value={lq.id}>
                      ข้อ {realIdx + 1}: {lq.title || '(ยังไม่มีหัวข้อ)'}
                    </option>
                  );
                })}
              </select>
            )}

            {o.action === 'end_form' && (
              <Input
                value={o.endMessage || ''}
                maxLength={300}
                onChange={(e) => onChange({ endMessage: e.target.value || undefined })}
                placeholder="ข้อความแจ้งเมื่อจบฟอร์ม (ไม่บังคับ)"
                className="h-8 flex-1 bg-card text-[0.78rem]"
              />
            )}
          </div>
        </div>
      )}

      {/* Conditional visibility of this option */}
      <FormConditionBuilder
        value={o.condition}
        onChange={(cond) => onChange({ condition: cond })}
        availableQuestions={earlierQuestions}
        allQuestions={allQuestions}
        title="เงื่อนไขการแสดงตัวเลือกนี้"
        emptyLabel="แสดงตัวเลือกนี้ตลอด"
      />
    </div>
  );
}

// ───────────────────────── Options editor ─────────────────────────

function OptionMarker({ type, index }: { type: FormQuestionType; index: number }) {
  // Hidden on phones — the question header already shows the type, and the label needs the width
  if (type === 'dropdown') return <span className="hidden w-5 text-center text-[0.75rem] font-semibold text-muted-foreground tabular-nums sm:block">{index + 1}.</span>;
  return <span className={cn('hidden size-4 shrink-0 border-2 border-muted-foreground/40 sm:block', type === 'multiple_choice' ? 'rounded-[4px]' : 'rounded-full')} />;
}

function OptionsEditor({
  q,
  earlierQuestions,
  laterQuestions,
  allQuestions,
  onChange,
}: {
  q: FormQuestion;
  earlierQuestions: FormQuestion[];
  laterQuestions: FormQuestion[];
  allQuestions: FormQuestion[];
  onChange: (q: FormQuestion) => void;
}) {
  const options = q.options || [];
  const hasOther = options.some((o) => o.other);
  const full = options.length >= FORM_LIMITS.maxOptions;
  const [expandedOptId, setExpandedOptId] = useState<string | null>(null);

  /** Focus an option input once React has rendered it. */
  const pendingFocus = useRef<string | null>(null);
  const setFocusId = (id: string) => { pendingFocus.current = id; };
  useEffect(() => {
    if (!pendingFocus.current) return;
    document.querySelector<HTMLInputElement>(`[data-option-input="${pendingFocus.current}"]`)?.focus();
    pendingFocus.current = null;
  });

  /** Normal options first, "other" always last. */
  const setOptions = (next: FormOption[]) =>
    onChange({ ...q, options: [...next.filter((o) => !o.other), ...next.filter((o) => o.other)] });

  const updateOption = (optId: string, patch: Partial<FormOption>) => {
    setOptions(options.map((x) => (x.id === optId ? { ...x, ...patch } : x)));
  };

  const reorder = useReorder(options.length, (from, to) => {
    if (options[from]?.other || options[to]?.other) return;
    setOptions(arrayMove(options, from, to));
  });

  const addAfter = (index: number, labels: string[] = ['']) => {
    const room = FORM_LIMITS.maxOptions - options.length;
    if (room <= 0) return;
    const added = labels.slice(0, room).map((label) => ({ id: makeFormId('o'), label }));
    const next = [...options];
    next.splice(index + 1, 0, ...added);
    setOptions(next);
    setFocusId(added[added.length - 1].id);
  };

  const lastNormalIndex = options.filter((o) => !o.other).length - 1;

  const applyPreset = (p: FormOptionPreset) => {
    const next: FormOption[] = p.options.map((label) => ({ id: makeFormId('o'), label }));
    if (p.withOther && q.type !== 'dropdown') next.push({ id: makeFormId('o'), label: OTHER_OPTION_LABEL, other: true });
    onChange({ ...q, options: next, minSelections: undefined, maxSelections: undefined });
  };

  return (
    <div className="mb-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[0.78rem] font-semibold text-muted-foreground">ตัวเลือก ({options.length})</span>
        <PresetPicker onApply={applyPreset} />
      </div>

      <div className="flex flex-col gap-1.5">
        {options.map((o, oi) => {
          const ruleTags = getOptionRuleTags(o, allQuestions);
          const isExpanded = expandedOptId === o.id;
          return (
            <div key={o.id} {...reorder.rowProps(oi)} className={cn(reorder.rowState(oi))}>
              <div className="group flex items-center gap-2 rounded-xl border border-transparent bg-muted/40 py-1 pr-1 pl-1 transition-[opacity,box-shadow] focus-within:border-primary/40 focus-within:bg-card hover:bg-muted/70">
                {o.other ? (
                  <span className="grid w-7 place-items-center text-muted-foreground/40"><MessageSquarePlus size={15} /></span>
                ) : (
                  <button
                    type="button"
                    aria-label={`ลากเพื่อสลับลำดับตัวเลือก ${oi + 1} (หรือกดลูกศรขึ้น/ลง)`}
                    className="grid h-8 w-7 cursor-grab place-items-center rounded-md text-muted-foreground/60 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 active:cursor-grabbing"
                    {...reorder.handleProps(oi)}
                  >
                    <GripVertical size={16} />
                  </button>
                )}
                <OptionMarker type={q.type} index={oi} />
                {o.other ? (
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <Input
                      data-option-input={o.id}
                      value={o.label}
                      maxLength={200}
                      aria-label="ข้อความตัวเลือกอื่น ๆ"
                      onChange={(e) => updateOption(o.id, { label: e.target.value })}
                      className="h-9 border-dashed bg-transparent text-[0.88rem] italic"
                    />
                    <span className="hidden shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 text-[0.68rem] font-semibold text-primary sm:inline">ผู้ตอบพิมพ์เอง</span>
                  </div>
                ) : (
                  <Input
                    data-option-input={o.id}
                    value={o.label}
                    maxLength={200}
                    placeholder={`ตัวเลือก ${oi + 1}`}
                    aria-label={`ข้อความตัวเลือก ${oi + 1}`}
                    onChange={(e) => updateOption(o.id, { label: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); addAfter(oi); }
                      if (e.key === 'Backspace' && o.label === '' && options.length > 2) {
                        e.preventDefault();
                        const prev = options[oi - 1] || options[oi + 1];
                        setOptions(options.filter((x) => x.id !== o.id));
                        if (prev) setFocusId(prev.id);
                      }
                    }}
                    onPaste={(e) => {
                      // Paste several lines → one option per line
                      const lines = e.clipboardData.getData('text').split(/\r?\n/).map((s) => s.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim()).filter(Boolean);
                      if (lines.length < 2) return;
                      e.preventDefault();
                      const next = [...options];
                      const [first, ...rest] = lines;
                      next[oi] = { ...o, label: o.label ? o.label : first };
                      const extra = (o.label ? lines : rest).slice(0, FORM_LIMITS.maxOptions - options.length).map((label) => ({ id: makeFormId('o'), label }));
                      next.splice(oi + 1, 0, ...extra);
                      setOptions(next);
                    }}
                    className="h-9 border-transparent bg-transparent text-[0.9rem] shadow-none focus-visible:border-ring dark:bg-transparent"
                  />
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="ตั้งค่าเงื่อนไขตัวเลือก"
                  title="ตั้งค่าเงื่อนไขและโควต้าตัวเลือกนี้"
                  onClick={() => setExpandedOptId(isExpanded ? null : o.id)}
                  className={cn(
                    'transition-opacity',
                    isExpanded || ruleTags.length > 0
                      ? 'text-primary opacity-100'
                      : 'text-muted-foreground opacity-60 group-hover:opacity-100',
                  )}
                >
                  <SlidersHorizontal size={15} />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="ลบตัวเลือก"
                  disabled={options.length <= 2}
                  onClick={() => setOptions(options.filter((x) => x.id !== o.id))}
                  className="text-muted-foreground opacity-60 hover:text-destructive group-hover:opacity-100"
                >
                  <X size={16} />
                </Button>
              </div>

              {!isExpanded && ruleTags.length > 0 && (
                <div className="mt-1 ml-12 flex flex-wrap items-center gap-1.5">
                  {ruleTags.map((tag) => (
                    <span key={tag} className="rounded-md bg-muted px-2 py-0.5 text-[0.68rem] font-medium text-muted-foreground">
                      {tag}
                    </span>
                  ))}
                  {o.condition?.enabled && (
                    <span className="text-[0.68rem] text-muted-foreground">
                      · {describeConditionSet(o.condition, allQuestions)}
                    </span>
                  )}
                </div>
              )}

              {isExpanded && (
                <OptionRulesPanel
                  o={o}
                  qType={q.type}
                  earlierQuestions={earlierQuestions}
                  laterQuestions={laterQuestions}
                  allQuestions={allQuestions}
                  onChange={(patch) => updateOption(o.id, patch)}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" disabled={full} onClick={() => addAfter(lastNormalIndex)} className="rounded-lg">
          <Plus size={14} /> เพิ่มตัวเลือก
        </Button>
        {!hasOther && q.type !== 'dropdown' && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={full}
            className="rounded-lg text-muted-foreground"
            onClick={() => setOptions([...options, { id: makeFormId('o'), label: OTHER_OPTION_LABEL, other: true }])}
          >
            <MessageSquarePlus size={14} /> เพิ่ม “อื่น ๆ (โปรดระบุ)”
          </Button>
        )}
        {q.type === 'multiple_choice' && (
          <div className="ml-auto flex flex-wrap items-center gap-3 text-[0.78rem] text-muted-foreground">
            <label className="flex items-center gap-1.5">
              ขั้นต่ำ
              <Input
                type="number"
                min={0}
                max={options.length}
                className="h-8 w-16 text-center"
                value={q.minSelections || ''}
                placeholder="0"
                onChange={(e) => onChange({ ...q, minSelections: Number(e.target.value) || undefined })}
              />
            </label>
            <label className="flex items-center gap-1.5">
              สูงสุด
              <Input
                type="number"
                min={0}
                max={options.length}
                className="h-8 w-16 text-center"
                value={q.maxSelections || ''}
                placeholder="∞"
                onChange={(e) => onChange({ ...q, maxSelections: Number(e.target.value) || undefined })}
              />
              ข้อ
            </label>
          </div>
        )}
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-1 text-[0.7rem] text-muted-foreground/80">
        <CornerDownLeft size={11} /> Enter = เพิ่มตัวเลือก · กด <SlidersHorizontal size={11} /> ท้ายตัวเลือกเพื่อตั้งเงื่อนไข/โควต้า/การข้ามข้อ · ลาก <GripVertical size={11} /> สลับลำดับ
      </p>
    </div>
  );
}

// ───────────────────────── Text validation panel ─────────────────────────

function TextValidationEditor({
  type,
  value,
  onChange,
}: {
  type: FormQuestionType;
  value?: FormTextValidation | null;
  onChange: (v: FormTextValidation | null) => void;
}) {
  const v = value || {};
  const format: FormTextFormat = v.format || 'none';
  const maxAllowed = type === 'long_text' ? FORM_LIMITS.maxLongText : FORM_LIMITS.maxShortText;
  const update = (patch: Partial<FormTextValidation>) => {
    const next = { ...v, ...patch };
    if (
      (!next.format || next.format === 'none') &&
      !next.minLength &&
      !next.maxLength &&
      next.minValue === undefined &&
      next.maxValue === undefined &&
      !next.pattern &&
      !next.patternMessage
    ) {
      onChange(null);
    } else {
      onChange(next);
    }
  };

  return (
    <div className="mb-3 flex flex-col gap-2.5 rounded-xl border border-border bg-muted/25 p-3 text-[0.8rem]">
      <p className="font-semibold text-foreground">กติกาการตรวจสอบคำตอบ</p>
      <div className="grid gap-2.5 sm:grid-cols-3">
        {type === 'short_text' && (
          <div>
            <Label className="mb-1 block text-[0.74rem] text-muted-foreground">รูปแบบข้อมูล</Label>
            <select
              value={format}
              onChange={(e) => update({ format: e.target.value as FormTextFormat })}
              className="h-8 w-full rounded-lg border border-input bg-card px-2 text-[0.8rem]"
            >
              {FORM_TEXT_FORMATS.map((f) => (
                <option key={f} value={f}>{FORM_TEXT_FORMAT_LABELS[f]}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <Label className="mb-1 block text-[0.74rem] text-muted-foreground">ความยาวขั้นต่ำ (ตัวอักษร)</Label>
          <Input
            type="number"
            min={0}
            max={maxAllowed}
            value={v.minLength || ''}
            placeholder="ไม่จำกัด"
            onChange={(e) => update({ minLength: Number(e.target.value) > 0 ? Number(e.target.value) : undefined })}
            className="h-8 bg-card text-[0.8rem]"
          />
        </div>
        <div>
          <Label className="mb-1 block text-[0.74rem] text-muted-foreground">ความยาวสูงสุด (ตัวอักษร)</Label>
          <Input
            type="number"
            min={0}
            max={maxAllowed}
            value={v.maxLength || ''}
            placeholder={String(maxAllowed)}
            onChange={(e) => update({ maxLength: Number(e.target.value) > 0 ? Number(e.target.value) : undefined })}
            className="h-8 bg-card text-[0.8rem]"
          />
        </div>
      </div>

      {format === 'number' && (
        <div className="grid gap-2.5 sm:grid-cols-2">
          <div>
            <Label className="mb-1 block text-[0.74rem] text-muted-foreground">ค่าต่ำสุด</Label>
            <Input
              type="number"
              value={v.minValue ?? ''}
              placeholder="ไม่จำกัด"
              onChange={(e) => update({ minValue: e.target.value === '' ? undefined : Number(e.target.value) })}
              className="h-8 bg-card text-[0.8rem]"
            />
          </div>
          <div>
            <Label className="mb-1 block text-[0.74rem] text-muted-foreground">ค่าสูงสุด</Label>
            <Input
              type="number"
              value={v.maxValue ?? ''}
              placeholder="ไม่จำกัด"
              onChange={(e) => update({ maxValue: e.target.value === '' ? undefined : Number(e.target.value) })}
              className="h-8 bg-card text-[0.8rem]"
            />
          </div>
        </div>
      )}

      {format === 'regex' && (
        <div>
          <Label className="mb-1 block text-[0.74rem] text-muted-foreground">Regular Expression (เช่น ^[0-9]{10}$ สำหรับรหัสนักศึกษา)</Label>
          <Input
            value={v.pattern || ''}
            maxLength={200}
            onChange={(e) => update({ pattern: e.target.value || undefined })}
            placeholder="^[0-9]{10}$"
            className="h-8 bg-card font-mono text-[0.8rem]"
          />
        </div>
      )}

      <div>
        <Label className="mb-1 block text-[0.74rem] text-muted-foreground">ข้อความแจ้งเตือนเมื่อไม่ตรงรูปแบบ (ไม่บังคับ)</Label>
        <Input
          value={v.patternMessage || ''}
          maxLength={200}
          onChange={(e) => update({ patternMessage: e.target.value || undefined })}
          placeholder="เช่น กรุณากรอกรหัสนักศึกษา 10 หลักให้ถูกต้อง"
          className="h-8 bg-card text-[0.8rem]"
        />
      </div>
    </div>
  );
}

// ───────────────────────── Question card ─────────────────────────

export function QuestionEditor({
  q,
  index,
  total,
  allQuestions,
  onChange,
  onMove,
  onDuplicate,
  onRemove,
  dragHandle,
  className,
  rowProps,
}: {
  q: FormQuestion;
  index: number;
  total: number;
  allQuestions?: FormQuestion[];
  onChange: (q: FormQuestion) => void;
  onMove: (dir: -1 | 1) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  dragHandle?: React.HTMLAttributes<HTMLElement> & { style?: React.CSSProperties };
  className?: string;
  rowProps?: Record<string, unknown>;
}) {
  const questionsList = allQuestions || [q];
  const earlierQuestions = questionsList.slice(0, index);
  const laterQuestions = questionsList.slice(index + 1);
  const isChoice = CHOICE_QUESTION_TYPES.includes(q.type);
  const isText = q.type === 'short_text' || q.type === 'long_text';

  const [showCondition, setShowCondition] = useState(Boolean(q.condition?.enabled));
  const [showValidation, setShowValidation] = useState(Boolean(q.validation));

  const requiredMode: 'optional' | 'required' | 'conditional' = q.requiredCondition?.enabled
    ? 'conditional'
    : q.required
      ? 'required'
      : 'optional';

  const setRequiredMode = (mode: 'optional' | 'required' | 'conditional') => {
    if (mode === 'optional') {
      onChange({ ...q, required: false, requiredCondition: null });
    } else if (mode === 'required') {
      onChange({ ...q, required: true, requiredCondition: null });
    } else {
      const firstEarlier = earlierQuestions[0];
      const cond: FormConditionSet = q.requiredCondition?.enabled
        ? q.requiredCondition
        : {
            enabled: true,
            match: 'all',
            groups: firstEarlier
              ? [
                  {
                    id: makeFormId('cg'),
                    match: 'all',
                    rules: [
                      {
                        id: makeFormId('cr'),
                        questionId: firstEarlier.id,
                        operator: CHOICE_QUESTION_TYPES.includes(firstEarlier.type) ? 'equals' : 'is_not_empty',
                        ...(CHOICE_QUESTION_TYPES.includes(firstEarlier.type) && firstEarlier.options?.[0]?.id
                          ? { value: firstEarlier.options[0].id }
                          : {}),
                      },
                    ],
                  },
                ]
              : [],
          };
      onChange({ ...q, required: false, requiredCondition: cond });
    }
  };

  const changeType = (type: FormQuestionType) => {
    const next: FormQuestion = { ...q, type };
    if (CHOICE_QUESTION_TYPES.includes(type)) {
      const kept = q.options?.length ? q.options : createEmptyQuestion(type).options;
      // Dropdowns can't show a free-text box inline nicely — drop "other" there
      next.options = type === 'dropdown' ? kept?.filter((o) => !o.other) : kept;
      if ((next.options?.length || 0) < 2) next.options = createEmptyQuestion(type).options;
      if (type === 'multiple_choice') {
        next.options = next.options?.map((o) => ({ ...o, action: undefined, skipToQuestionId: undefined, endMessage: undefined }));
      } else {
        next.options = next.options?.map((o) => ({ ...o, exclusive: undefined }));
      }
    } else {
      delete next.options;
    }
    if (type !== 'multiple_choice') {
      delete next.minSelections;
      delete next.maxSelections;
    }
    if (type !== 'short_text' && type !== 'long_text') {
      delete next.validation;
    }
    onChange(next);
  };

  const conditionSummary = q.condition?.enabled ? describeConditionSet(q.condition, questionsList) : '';

  return (
    <div {...rowProps} className={cn('rounded-2xl border border-border bg-card shadow-xs transition-[opacity,box-shadow]', className)}>
      <div className="flex items-center gap-1.5 border-b border-border px-2.5 py-2 sm:flex-wrap sm:gap-2 sm:px-4 sm:py-2.5">
        <button
          type="button"
          aria-label={`ลากเพื่อย้ายคำถามข้อ ${index + 1} (หรือกดลูกศรขึ้น/ลง)`}
          className="grid h-8 w-6 cursor-grab place-items-center rounded-md text-muted-foreground/60 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 active:cursor-grabbing"
          {...dragHandle}
        >
          <GripVertical size={16} />
        </button>
        <span className="shrink-0 text-[0.82rem] font-extrabold whitespace-nowrap text-muted-foreground tabular-nums">ข้อ {index + 1}</span>
        <QuestionTypePicker value={q.type} onChange={changeType} />
        {q.condition?.enabled && (
          <span title="มีเงื่อนไข" className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[0.68rem] font-semibold text-primary">
            <GitBranch size={11} /> <span className="hidden sm:inline">มีเงื่อนไข</span>
          </span>
        )}
        {/* Phones: one compact menu instead of a second row of four icons */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon-sm" aria-label={`ตัวเลือกของคำถามข้อ ${index + 1}`} className="ml-auto shrink-0 sm:hidden">
              <MoreHorizontal size={18} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[11rem]">
            <DropdownMenuItem disabled={index === 0} onSelect={() => onMove(-1)} className="py-2.5"><ArrowUp /> เลื่อนขึ้น</DropdownMenuItem>
            <DropdownMenuItem disabled={index === total - 1} onSelect={() => onMove(1)} className="py-2.5"><ArrowDown /> เลื่อนลง</DropdownMenuItem>
            <DropdownMenuItem onSelect={onDuplicate} className="py-2.5"><Copy /> ทำสำเนา</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" disabled={total <= 1} onSelect={onRemove} className="py-2.5"><Trash2 /> ลบคำถาม</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="ml-auto hidden items-center sm:flex">
          <Button type="button" variant="ghost" size="icon-sm" aria-label="เลื่อนขึ้น" disabled={index === 0} onClick={() => onMove(-1)}><ArrowUp size={15} /></Button>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="เลื่อนลง" disabled={index === total - 1} onClick={() => onMove(1)}><ArrowDown size={15} /></Button>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="ทำสำเนา" onClick={onDuplicate}><Copy size={15} /></Button>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="ลบคำถาม" disabled={total <= 1} onClick={onRemove} className="text-destructive hover:text-destructive"><Trash2 size={15} /></Button>
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <Input
          value={q.title}
          onChange={(e) => onChange({ ...q, title: e.target.value })}
          placeholder="พิมพ์คำถาม เช่น ควรจัดทำเสื้อรุ่นปีนี้หรือไม่?"
          maxLength={FORM_LIMITS.maxTitle}
          aria-label="หัวข้อคำถาม"
          className={cn('mb-2 h-11 text-[1rem] font-semibold', !q.title.trim() && 'border-warning/60')}
        />
        <Input
          value={q.description || ''}
          onChange={(e) => onChange({ ...q, description: e.target.value })}
          placeholder="คำอธิบายเพิ่มเติม (ไม่บังคับ)"
          maxLength={500}
          aria-label="คำอธิบายคำถาม"
          className="mb-4 text-[0.85rem]"
        />

        {isChoice && (
          <OptionsEditor
            q={q}
            earlierQuestions={earlierQuestions}
            laterQuestions={laterQuestions}
            allQuestions={questionsList}
            onChange={onChange}
          />
        )}

        {!isChoice && (
          <div className="mb-3 rounded-xl border border-dashed border-border px-4 py-3 text-[0.82rem] text-muted-foreground">
            {q.type === 'rating' ? '★★★★★ ผู้ตอบให้คะแนน 1–5 ดาว' : q.type === 'date' ? 'ผู้ตอบเลือกวันที่' : q.type === 'long_text' ? 'ผู้ตอบพิมพ์คำตอบยาวได้สูงสุด 3,000 ตัวอักษร' : 'ผู้ตอบพิมพ์คำตอบสั้นได้สูงสุด 300 ตัวอักษร'}
          </div>
        )}

        {isText && showValidation && (
          <TextValidationEditor
            type={q.type}
            value={q.validation}
            onChange={(validation) => onChange({ ...q, validation })}
          />
        )}

        {(showCondition || q.condition?.enabled) && (
          <div className="mb-3">
            <FormConditionBuilder
              value={q.condition}
              onChange={(condition) => {
                onChange({ ...q, condition });
                if (!condition) setShowCondition(false);
              }}
              availableQuestions={earlierQuestions}
              allQuestions={questionsList}
              title="เงื่อนไขการแสดงคำถามนี้"
              emptyLabel="แสดงคำถามนี้เสมอ"
            />
          </div>
        )}

        {requiredMode === 'conditional' && (
          <div className="mb-3">
            <FormConditionBuilder
              value={q.requiredCondition}
              onChange={(requiredCondition) => onChange({ ...q, requiredCondition })}
              availableQuestions={earlierQuestions}
              allQuestions={questionsList}
              title="บังคับตอบคำถามนี้เมื่อ"
              emptyLabel="เลือกเงื่อนไขเพื่อบังคับตอบ"
            />
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowCondition((v) => !v)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[0.76rem] font-semibold transition-colors',
                q.condition?.enabled || showCondition
                  ? 'border-primary/40 bg-primary/10 text-primary'
                  : 'border-border bg-background text-muted-foreground hover:text-foreground',
              )}
            >
              <GitBranch size={13} />
              {q.condition?.enabled ? `เงื่อนไขแสดง (${conditionSummary || 'ตั้งค่าแล้ว'})` : 'ตั้งเงื่อนไขการแสดง'}
            </button>

            {isText && (
              <button
                type="button"
                onClick={() => setShowValidation((v) => !v)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[0.76rem] font-semibold transition-colors',
                  q.validation || showValidation
                    ? 'border-primary/40 bg-primary/10 text-primary'
                    : 'border-border bg-background text-muted-foreground hover:text-foreground',
                )}
              >
                <SlidersHorizontal size={13} />
                {q.validation ? 'ตรวจรูปแบบ (เปิดอยู่)' : 'ตรวจรูปแบบคำตอบ'}
              </button>
            )}
          </div>

          <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5 text-[0.76rem]">
            {([
              ['optional', 'ไม่บังคับ'],
              ['required', 'บังคับตอบ'],
              ['conditional', 'ตามเงื่อนไข'],
            ] as const).map(([m, label]) => (
              <button
                key={m}
                type="button"
                disabled={m === 'conditional' && earlierQuestions.length === 0}
                title={m === 'conditional' && earlierQuestions.length === 0 ? 'ต้องมีคำถามก่อนหน้าอย่างน้อย 1 ข้อ' : undefined}
                onClick={() => setRequiredMode(m)}
                className={cn(
                  'rounded-md px-2.5 py-1 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                  requiredMode === m ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export { arrayMove };
