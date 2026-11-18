'use client';

// Respondent-side question card — shared by the public form page and the admin live preview.

import React from 'react';
import { AlertCircle, Check, RotateCcw, Star } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  FORM_LIMITS,
  optionDetailAnswerKey,
  validateTextFieldValue,
  type FormAnswers,
  type FormAnswerValue,
  type FormOption,
  type FormQuestion,
} from '@/lib/forms';

const RATING_LABELS = ['', 'ควรปรับปรุง', 'พอใช้', 'ปานกลาง', 'ดี', 'ดีมาก'];

export function isAnswerEmpty(v: FormAnswerValue | undefined): boolean {
  return v === undefined || v === null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0);
}

/**
 * Option grid by label length — phones get compact chips for tiny labels (sizes, years),
 * two columns for short ones, and a single readable column otherwise.
 */
function optionGridClass(options: FormOption[]): string {
  const plain = options.every((o) => !o.description && !o.maxChoices && !o.other && !o.requireDetail);
  const longest = Math.max(0, ...options.map((o) => o.label.length));
  if (plain && options.length >= 3 && longest <= 5) return 'grid-cols-3 sm:grid-cols-4';
  if (plain && options.length >= 4 && longest <= 12) return 'grid-cols-2';
  if (options.length >= 4 && options.every((o) => o.label.length <= 22 && !o.description && !o.maxChoices)) return 'sm:grid-cols-2';
  return '';
}

function ChoiceIndicator({ multi, checked }: { multi: boolean; checked: boolean }) {
  if (multi) {
    return (
      <span
        aria-hidden
        className={cn(
          'mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border-2 transition-colors',
          checked ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40 group-hover:border-primary/60',
        )}
      >
        {checked && <Check size={13} strokeWidth={3} />}
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2 transition-colors',
        checked ? 'border-primary' : 'border-muted-foreground/40 group-hover:border-primary/60',
      )}
    >
      <span className={cn('size-2.5 rounded-full bg-primary transition-transform', checked ? 'scale-100' : 'scale-0')} />
    </span>
  );
}

function ChoiceTiles({
  q,
  options,
  disabledOptionIds,
  fullQuotaOptionIds,
  optionCounts,
  value,
  otherText,
  allAnswers,
  onChange,
  onOtherChange,
  onDetailChange,
  disabled,
}: {
  q: FormQuestion;
  options: FormOption[];
  disabledOptionIds: Set<string>;
  fullQuotaOptionIds: Set<string>;
  optionCounts?: Record<string, number>;
  value: FormAnswerValue | undefined;
  otherText: string;
  allAnswers?: FormAnswers;
  onChange: (v: FormAnswerValue | undefined) => void;
  onOtherChange: (text: string) => void;
  onDetailChange?: (optionId: string, text: string) => void;
  disabled?: boolean;
}) {
  const multi = q.type === 'multiple_choice';
  const selected = multi ? (Array.isArray(value) ? value.map(String) : []) : value !== undefined ? [String(value)] : [];
  const atMax = Boolean(multi && q.maxSelections && selected.length >= q.maxSelections);
  const gridClass = optionGridClass(options);
  const compact = gridClass.startsWith('grid-cols-3');
  const otherOption = options.find((o) => o.other);
  const otherPicked = Boolean(otherOption && selected.includes(otherOption.id));
  const exclusiveIds = new Set(options.filter((o) => o.exclusive).map((o) => o.id));
  const detailPickedOptions = options.filter((o) => o.requireDetail && !o.other && selected.includes(o.id));

  const toggle = (opt: FormOption) => {
    if (multi) {
      if (selected.includes(opt.id)) {
        const next = selected.filter((x) => x !== opt.id);
        onChange(next.length ? next : undefined);
        return;
      }
      if (opt.exclusive) {
        onChange([opt.id]);
        return;
      }
      const next = [...selected.filter((x) => !exclusiveIds.has(x)), opt.id];
      onChange(next);
    } else {
      // Clicking the picked option again clears it
      onChange(selected[0] === opt.id ? undefined : opt.id);
    }
  };

  const selectionHint = (() => {
    if (!multi) return null;
    if (q.minSelections && q.maxSelections) {
      return `เลือก ${q.minSelections}–${q.maxSelections} ข้อ (เลือกแล้ว ${selected.length})`;
    }
    if (q.minSelections) {
      return `เลือกอย่างน้อย ${q.minSelections} ข้อ (เลือกแล้ว ${selected.length})`;
    }
    if (q.maxSelections) {
      return `เลือกได้สูงสุด ${q.maxSelections} ข้อ (เลือกแล้ว ${selected.length})`;
    }
    return 'เลือกได้หลายข้อ';
  })();

  return (
    <div>
      {selectionHint && <p className="mb-2 text-[0.78rem] text-muted-foreground">{selectionHint}</p>}
      {options.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-3 text-[0.84rem] text-muted-foreground">
          ไม่มีตัวเลือกที่ตรงตามเงื่อนไขในขณะนี้
        </p>
      ) : (
        <div role={multi ? 'group' : 'radiogroup'} aria-labelledby={`q-title-${q.id}`} className={cn('grid gap-2 sm:gap-2.5', gridClass)}>
          {options.map((o) => {
            const checked = selected.includes(o.id);
            const optDisabled = disabledOptionIds.has(o.id);
            const isFull = fullQuotaOptionIds.has(o.id);
            const hasExclusiveSelected = multi && selected.some((id) => exclusiveIds.has(id));
            const blocked = Boolean(
              disabled ||
              optDisabled ||
              (!checked && atMax && !o.exclusive && !hasExclusiveSelected),
            );
            const used = optionCounts?.[o.id] ?? 0;
            const remaining = o.maxChoices && o.maxChoices > 0 ? Math.max(0, o.maxChoices - used) : null;

            return (
              <button
                key={o.id}
                type="button"
                role={multi ? 'checkbox' : 'radio'}
                aria-checked={checked}
                disabled={blocked && !checked}
                onClick={() => toggle(o)}
                className={cn(
                  'group flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left text-[0.95rem] leading-6 transition-all outline-none active:scale-[0.985] sm:text-[0.92rem]',
                  compact && 'items-center justify-center gap-2 px-2 text-center',
                  'focus-visible:ring-[3px] focus-visible:ring-ring/50',
                  checked
                    ? 'border-primary bg-primary/10 font-semibold text-foreground shadow-[0_0_0_1px_var(--primary)]'
                    : 'border-border bg-card hover:border-primary/50 hover:bg-primary/[0.04]',
                  blocked && !checked && 'cursor-not-allowed opacity-50',
                )}
              >
                <ChoiceIndicator multi={multi} checked={checked} />
                <span className={cn('min-w-0', !compact && 'flex-1')}>
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="break-words">{o.label}</span>
                    {isFull ? (
                      <span className="rounded-full bg-destructive/12 px-2 py-0.5 text-[0.68rem] font-semibold text-destructive">เต็มแล้ว</span>
                    ) : o.disabled ? (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[0.68rem] font-medium text-muted-foreground">ปิดรับ</span>
                    ) : remaining !== null ? (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[0.68rem] font-medium text-muted-foreground tabular-nums">
                        เหลือ {remaining.toLocaleString('th-TH')}/{o.maxChoices?.toLocaleString('th-TH')}
                      </span>
                    ) : null}
                  </span>
                  {o.description && (
                    <span className="mt-0.5 block text-[0.78rem] font-normal leading-snug text-muted-foreground break-words">
                      {o.description}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {otherPicked && (
        <div className="mt-3">
          <Input
            autoFocus
            aria-label="โปรดระบุคำตอบอื่น ๆ"
            value={otherText}
            maxLength={FORM_LIMITS.maxOtherText}
            disabled={disabled}
            onChange={(e) => onOtherChange(e.target.value)}
            placeholder="โปรดระบุ..."
            className="h-11 rounded-xl text-base sm:text-sm"
          />
        </div>
      )}

      {detailPickedOptions.map((o) => {
        const dKey = optionDetailAnswerKey(q.id, o.id);
        const detVal = typeof allAnswers?.[dKey] === 'string' ? (allAnswers[dKey] as string) : '';
        return (
          <div key={o.id} className="mt-3">
            <label className="mb-1 block text-[0.78rem] font-medium text-muted-foreground">
              รายละเอียดเพิ่มเติมสำหรับ “{o.label}” <span className="text-destructive">*</span>
            </label>
            <Input
              aria-label={`รายละเอียดเพิ่มเติมสำหรับ ${o.label}`}
              value={detVal}
              maxLength={FORM_LIMITS.maxOtherText}
              disabled={disabled}
              onChange={(e) => onDetailChange?.(o.id, e.target.value)}
              placeholder={o.detailPlaceholder || 'โปรดระบุรายละเอียดเพิ่มเติม...'}
              className="h-11 rounded-xl text-base sm:text-sm"
            />
          </div>
        );
      })}
    </div>
  );
}

function RatingStars({ value, onChange, disabled }: { value?: number; onChange: (v: number | undefined) => void; disabled?: boolean }) {
  const [hover, setHover] = React.useState(0);
  const shown = hover || value || 0;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex gap-1" role="radiogroup" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} ดาว`}
            disabled={disabled}
            onMouseEnter={() => setHover(n)}
            onClick={() => onChange(value === n ? undefined : n)}
            className="rounded-lg p-1 transition-transform outline-none hover:scale-110 focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <Star size={32} fill={shown >= n ? '#f59e0b' : 'transparent'} color={shown >= n ? '#f59e0b' : 'currentColor'} className={shown >= n ? '' : 'text-muted-foreground/50'} />
          </button>
        ))}
      </div>
      {shown > 0 && <span className="text-[0.85rem] font-semibold text-muted-foreground">{shown}/5 · {RATING_LABELS[shown]}</span>}
    </div>
  );
}

function textValidationHint(q: FormQuestion): string | null {
  const v = q.validation;
  if (!v) return null;
  const parts: string[] = [];
  if (v.format === 'number') {
    if (v.minValue !== undefined && v.maxValue !== undefined) parts.push(`ตัวเลข ${v.minValue}–${v.maxValue}`);
    else if (v.minValue !== undefined) parts.push(`ตัวเลข ≥ ${v.minValue}`);
    else if (v.maxValue !== undefined) parts.push(`ตัวเลข ≤ ${v.maxValue}`);
    else parts.push('ระบุเป็นตัวเลข');
  } else if (v.format === 'email') parts.push('รูปแบบอีเมล');
  else if (v.format === 'phone') parts.push('หมายเลขโทรศัพท์');
  else if (v.format === 'url') parts.push('ลิงก์ขึ้นต้นด้วย http:// หรือ https://');
  if (v.minLength) parts.push(`อย่างน้อย ${v.minLength} ตัวอักษร`);
  if (v.maxLength) parts.push(`ไม่เกิน ${v.maxLength} ตัวอักษร`);
  return parts.length ? parts.join(' · ') : null;
}

function FieldInput({
  q,
  options,
  disabledOptionIds,
  fullQuotaOptionIds,
  optionCounts,
  value,
  otherText,
  allAnswers,
  onChange,
  onOtherChange,
  onDetailChange,
  disabled,
  invalid,
}: {
  q: FormQuestion;
  options: FormOption[];
  disabledOptionIds: Set<string>;
  fullQuotaOptionIds: Set<string>;
  optionCounts?: Record<string, number>;
  value: FormAnswerValue | undefined;
  otherText: string;
  allAnswers?: FormAnswers;
  onChange: (v: FormAnswerValue | undefined) => void;
  onOtherChange: (text: string) => void;
  onDetailChange?: (optionId: string, text: string) => void;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const text = typeof value === 'string' ? value : '';
  const setText = (v: string) => onChange(v === '' ? undefined : v);
  const hint = textValidationHint(q);

  switch (q.type) {
    case 'short_text': {
      const maxLen = q.validation?.maxLength ? Math.min(FORM_LIMITS.maxShortText, q.validation.maxLength) : FORM_LIMITS.maxShortText;
      const inputType = q.validation?.format === 'email' ? 'email' : q.validation?.format === 'url' ? 'url' : q.validation?.format === 'phone' ? 'tel' : 'text';
      return (
        <div>
          <Input
            type={inputType}
            inputMode={q.validation?.format === 'number' ? 'decimal' : q.validation?.format === 'phone' ? 'tel' : undefined}
            id={`q-input-${q.id}`}
            aria-labelledby={`q-title-${q.id}`}
            aria-invalid={invalid || undefined}
            value={text}
            disabled={disabled}
            maxLength={maxLen}
            placeholder="คำตอบของคุณ"
            onChange={(e) => setText(e.target.value)}
            className="h-11 rounded-xl text-base sm:text-sm"
          />
          {hint && <p className="mt-1 text-[0.72rem] text-muted-foreground">{hint}</p>}
        </div>
      );
    }
    case 'long_text': {
      const maxLen = q.validation?.maxLength ? Math.min(FORM_LIMITS.maxLongText, q.validation.maxLength) : FORM_LIMITS.maxLongText;
      return (
        <div>
          <Textarea
            id={`q-input-${q.id}`}
            aria-labelledby={`q-title-${q.id}`}
            aria-invalid={invalid || undefined}
            value={text}
            disabled={disabled}
            maxLength={maxLen}
            rows={4}
            placeholder="พิมพ์คำตอบหรือความคิดเห็นของคุณ..."
            onChange={(e) => setText(e.target.value)}
            className="min-h-28 rounded-xl"
          />
          <div className="mt-1 flex items-center justify-between text-[0.72rem] text-muted-foreground">
            <span>{hint || ''}</span>
            <span className="tabular-nums">{text.length}/{maxLen}</span>
          </div>
        </div>
      );
    }
    case 'date':
      return <Input type="date" id={`q-input-${q.id}`} aria-labelledby={`q-title-${q.id}`} aria-invalid={invalid || undefined} value={text} disabled={disabled} onChange={(e) => setText(e.target.value)} className="h-11 max-w-xs rounded-xl text-base sm:text-sm" />;
    case 'rating':
      return <RatingStars value={typeof value === 'number' ? value : undefined} onChange={onChange} disabled={disabled} />;
    case 'dropdown': {
      const pickedOpt = options.find((o) => o.id === text);
      return (
        <div>
          <select
            id={`q-input-${q.id}`}
            aria-labelledby={`q-title-${q.id}`}
            aria-invalid={invalid || undefined}
            value={text}
            disabled={disabled}
            onChange={(e) => setText(e.target.value)}
            className="h-11 w-full max-w-md rounded-xl border border-input bg-transparent px-3 text-base text-foreground sm:text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30"
          >
            <option value="">— เลือกคำตอบ —</option>
            {options.map((o) => {
              const optDis = disabledOptionIds.has(o.id);
              const isFull = fullQuotaOptionIds.has(o.id);
              const used = optionCounts?.[o.id] ?? 0;
              const rem = o.maxChoices && o.maxChoices > 0 ? Math.max(0, o.maxChoices - used) : null;
              const suffix = isFull ? ' (เต็มแล้ว)' : optDis ? ' (ปิดรับ)' : rem !== null ? ` (เหลือ ${rem}/${o.maxChoices})` : '';
              return (
                <option key={o.id} value={o.id} disabled={optDis && text !== o.id}>
                  {o.label}{suffix}
                </option>
              );
            })}
          </select>
          {pickedOpt?.description && (
            <p className="mt-1.5 text-[0.78rem] text-muted-foreground">{pickedOpt.description}</p>
          )}
          {pickedOpt?.other && (
            <Input autoFocus aria-label="โปรดระบุคำตอบอื่น ๆ" value={otherText} maxLength={FORM_LIMITS.maxOtherText} disabled={disabled} onChange={(e) => onOtherChange(e.target.value)} placeholder="โปรดระบุ..." className="mt-3 h-11 max-w-md rounded-xl text-base sm:text-sm" />
          )}
          {pickedOpt?.requireDetail && !pickedOpt.other && (
            <div className="mt-3 max-w-md">
              <label className="mb-1 block text-[0.78rem] font-medium text-muted-foreground">
                รายละเอียดเพิ่มเติมสำหรับ “{pickedOpt.label}” <span className="text-destructive">*</span>
              </label>
              <Input
                value={typeof allAnswers?.[optionDetailAnswerKey(q.id, pickedOpt.id)] === 'string' ? (allAnswers[optionDetailAnswerKey(q.id, pickedOpt.id)] as string) : ''}
                maxLength={FORM_LIMITS.maxOtherText}
                disabled={disabled}
                onChange={(e) => onDetailChange?.(pickedOpt.id, e.target.value)}
                placeholder={pickedOpt.detailPlaceholder || 'โปรดระบุรายละเอียดเพิ่มเติม...'}
                className="h-11 rounded-xl text-base sm:text-sm"
              />
            </div>
          )}
        </div>
      );
    }
    default:
      return (
        <ChoiceTiles
          q={q}
          options={options}
          disabledOptionIds={disabledOptionIds}
          fullQuotaOptionIds={fullQuotaOptionIds}
          optionCounts={optionCounts}
          value={value}
          otherText={otherText}
          allAnswers={allAnswers}
          onChange={onChange}
          onOtherChange={onOtherChange}
          onDetailChange={onDetailChange}
          disabled={disabled}
        />
      );
  }
}

export default function FormQuestionField({
  q,
  index,
  required,
  visibleOptions,
  disabledOptionIds,
  fullQuotaOptionIds,
  optionCounts,
  value,
  otherText = '',
  allAnswers,
  onChange,
  onOtherChange,
  onDetailChange,
  disabled,
  missing,
  errorMessage,
}: {
  q: FormQuestion;
  index: number;
  required?: boolean;
  visibleOptions?: FormOption[];
  disabledOptionIds?: Set<string>;
  fullQuotaOptionIds?: Set<string>;
  optionCounts?: Record<string, number>;
  value: FormAnswerValue | undefined;
  otherText?: string;
  allAnswers?: FormAnswers;
  onChange: (v: FormAnswerValue | undefined) => void;
  onOtherChange?: (text: string) => void;
  onDetailChange?: (optionId: string, text: string) => void;
  disabled?: boolean;
  /** Required or invalid question after the respondent tried to submit */
  missing?: boolean;
  errorMessage?: string;
}) {
  const answered = !isAnswerEmpty(value);
  const isReq = required ?? q.required;
  const inlineTextErr =
    answered && (q.type === 'short_text' || q.type === 'long_text') && typeof value === 'string'
      ? validateTextFieldValue(q, value.trim())
      : null;
  const flagged = Boolean(missing || errorMessage || (missing && inlineTextErr));
  const displayError = errorMessage || (missing ? inlineTextErr || 'กรุณาตอบข้อนี้ให้ครบถ้วนถูกต้อง' : undefined);

  return (
    <section
      id={`q-${q.id}`}
      tabIndex={-1}
      className={cn(
        'scroll-mt-24 rounded-2xl border bg-card p-4 transition-all outline-none sm:p-6',
        flagged ? 'border-destructive/70 ring-4 ring-destructive/10' : 'border-border',
      )}
    >
      <div className="mb-4 flex items-baseline gap-2.5">
        <span
          className={cn(
            'shrink-0 text-[0.95rem] font-extrabold tabular-nums transition-colors',
            answered ? 'text-primary' : 'text-muted-foreground',
          )}
        >
          {index + 1}.
        </span>
        <div className="min-w-0 flex-1">
          <h3 id={`q-title-${q.id}`} className="text-[1rem] leading-snug font-bold break-words text-foreground">
            {q.title}
            {isReq ? (
              <span className="ml-1 text-destructive" aria-label="จำเป็นต้องตอบ">*</span>
            ) : (
              <span className="ml-2 align-middle text-[0.72rem] font-medium text-muted-foreground">(ไม่บังคับ)</span>
            )}
          </h3>
          {q.description && <p className="mt-1 text-[0.85rem] leading-relaxed whitespace-pre-wrap break-words text-muted-foreground">{q.description}</p>}
        </div>
        {answered && !disabled && (
          <button
            type="button"
            onClick={() => { onChange(undefined); onOtherChange?.(''); }}
            title="ล้างคำตอบข้อนี้"
            className="flex shrink-0 items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[0.72rem] text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
          >
            <RotateCcw size={12} /> <span className="hidden sm:inline">ล้าง</span>
          </button>
        )}
      </div>

      <FieldInput
        q={q}
        options={visibleOptions ?? q.options ?? []}
        disabledOptionIds={disabledOptionIds ?? new Set()}
        fullQuotaOptionIds={fullQuotaOptionIds ?? new Set()}
        optionCounts={optionCounts}
        value={value}
        otherText={otherText}
        allAnswers={allAnswers}
        onChange={onChange}
        onOtherChange={onOtherChange || (() => {})}
        onDetailChange={onDetailChange}
        disabled={disabled}
        invalid={flagged}
      />

      {flagged && displayError && (
        <p className="mt-3 flex items-center gap-1.5 text-[0.8rem] font-semibold text-destructive">
          <AlertCircle size={14} /> {displayError}
        </p>
      )}
    </section>
  );
}
