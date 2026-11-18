'use client';

// Detailed multi-group AND/OR condition builder used by questions (visibility / required) and options.

import React from 'react';
import { AlertTriangle, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  CHOICE_QUESTION_TYPES,
  CONDITION_OPERATOR_LABELS,
  describeConditionSet,
  makeFormId,
  type FormConditionGroup,
  type FormConditionOperator,
  type FormConditionRule,
  type FormConditionSet,
  type FormQuestion,
} from '@/lib/forms';

function getOperatorsForQuestion(q?: FormQuestion): FormConditionOperator[] {
  if (!q) return ['equals', 'not_equals', 'is_not_empty', 'is_empty'];
  switch (q.type) {
    case 'single_choice':
    case 'dropdown':
      return ['equals', 'not_equals', 'in', 'not_in', 'is_not_empty', 'is_empty'];
    case 'multiple_choice':
      return ['contains', 'not_contains', 'in', 'all_of', 'not_in', 'equals', 'not_equals', 'is_not_empty', 'is_empty'];
    case 'rating':
      return ['equals', 'not_equals', 'gte', 'lte', 'gt', 'lt', 'in', 'is_not_empty', 'is_empty'];
    case 'date':
      return ['equals', 'not_equals', 'gte', 'lte', 'gt', 'lt', 'is_not_empty', 'is_empty'];
    case 'short_text':
    case 'long_text': {
      const ops: FormConditionOperator[] = ['equals', 'not_equals', 'contains', 'not_contains'];
      if (q.validation?.format === 'number') ops.push('gt', 'gte', 'lt', 'lte');
      ops.push('is_not_empty', 'is_empty');
      return ops;
    }
    default:
      return ['equals', 'not_equals', 'is_not_empty', 'is_empty'];
  }
}

function defaultRuleForQuestion(q: FormQuestion): FormConditionRule {
  const ops = getOperatorsForQuestion(q);
  const op = ops[0];
  const firstOptId = q.options?.[0]?.id;
  return {
    id: makeFormId('cr'),
    questionId: q.id,
    operator: op,
    ...(CHOICE_QUESTION_TYPES.includes(q.type) && firstOptId
      ? op === 'in' || op === 'not_in' || op === 'all_of'
        ? { values: [firstOptId] }
        : { value: firstOptId }
      : q.type === 'rating'
        ? { value: '5' }
        : { value: '' }),
  };
}

function isMultiValueOp(op: FormConditionOperator, q?: FormQuestion): boolean {
  if (op === 'in' || op === 'not_in' || op === 'all_of') return true;
  if ((op === 'equals' || op === 'not_equals') && q?.type === 'multiple_choice') return true;
  return false;
}

function isUnaryOp(op: FormConditionOperator): boolean {
  return op === 'is_empty' || op === 'is_not_empty';
}

function RuleValueEditor({
  rule,
  sourceQuestion,
  onChange,
}: {
  rule: FormConditionRule;
  sourceQuestion?: FormQuestion;
  onChange: (patch: Partial<FormConditionRule>) => void;
}) {
  if (isUnaryOp(rule.operator)) return null;
  if (!sourceQuestion) {
    return (
      <Input
        value={rule.value || ''}
        onChange={(e) => onChange({ value: e.target.value })}
        placeholder="ค่าเปรียบเทียบ"
        className="h-8 text-[0.8rem]"
      />
    );
  }

  const multi = isMultiValueOp(rule.operator, sourceQuestion);

  if (CHOICE_QUESTION_TYPES.includes(sourceQuestion.type)) {
    const opts = sourceQuestion.options || [];
    if (multi) {
      const picked = new Set(rule.values || (rule.value ? [rule.value] : []));
      const toggleVal = (id: string) => {
        const next = new Set(picked);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        onChange({ values: Array.from(next), value: undefined });
      };
      return (
        <div className="flex flex-wrap gap-1">
          {opts.map((o, idx) => {
            const active = picked.has(o.id);
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => toggleVal(o.id)}
                className={cn(
                  'rounded-lg border px-2 py-1 text-[0.74rem] font-medium transition-colors',
                  active
                    ? 'border-primary bg-primary/12 text-primary'
                    : 'border-border bg-card text-muted-foreground hover:text-foreground',
                )}
              >
                {o.label || `ตัวเลือก ${idx + 1}`}
              </button>
            );
          })}
        </div>
      );
    }

    return (
      <select
        value={rule.value || ''}
        onChange={(e) => onChange({ value: e.target.value, values: undefined })}
        aria-label="ค่าตัวเลือกเงื่อนไข"
        className="h-8 w-full min-w-[140px] rounded-lg border border-input bg-card px-2 text-[0.8rem] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <option value="">— เลือกตัวเลือก —</option>
        {opts.map((o, idx) => (
          <option key={o.id} value={o.id}>
            {o.label || `ตัวเลือก ${idx + 1}`}
          </option>
        ))}
      </select>
    );
  }

  if (sourceQuestion.type === 'rating') {
    if (multi) {
      const picked = new Set(rule.values || (rule.value ? [rule.value] : []));
      return (
        <div className="flex flex-wrap gap-1">
          {['1', '2', '3', '4', '5'].map((n) => {
            const active = picked.has(n);
            return (
              <button
                key={n}
                type="button"
                onClick={() => {
                  const next = new Set(picked);
                  if (next.has(n)) next.delete(n);
                  else next.add(n);
                  onChange({ values: Array.from(next), value: undefined });
                }}
                className={cn(
                  'rounded-lg border px-2.5 py-1 text-[0.75rem] font-semibold transition-colors',
                  active ? 'border-primary bg-primary/12 text-primary' : 'border-border bg-card text-muted-foreground',
                )}
              >
                {n} ★
              </button>
            );
          })}
        </div>
      );
    }
    return (
      <select
        value={rule.value || '5'}
        onChange={(e) => onChange({ value: e.target.value, values: undefined })}
        aria-label="คะแนนเงื่อนไข"
        className="h-8 rounded-lg border border-input bg-card px-2 text-[0.8rem] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        {['1', '2', '3', '4', '5'].map((n) => (
          <option key={n} value={n}>{n} ดาว</option>
        ))}
      </select>
    );
  }

  if (sourceQuestion.type === 'date') {
    return (
      <Input
        type="date"
        value={rule.value || ''}
        onChange={(e) => onChange({ value: e.target.value, values: undefined })}
        className="h-8 max-w-[170px] bg-card text-[0.8rem]"
      />
    );
  }

  const isNumericOp = rule.operator === 'gt' || rule.operator === 'gte' || rule.operator === 'lt' || rule.operator === 'lte';
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Input
        type={isNumericOp ? 'number' : 'text'}
        value={rule.value || ''}
        maxLength={200}
        onChange={(e) => onChange({ value: e.target.value, values: undefined })}
        placeholder={isNumericOp ? 'ตัวเลข' : 'ข้อความที่ต้องการเทียบ'}
        className="h-8 min-w-[140px] flex-1 bg-card text-[0.8rem]"
      />
      {!isNumericOp && (
        <label className="flex cursor-pointer items-center gap-1 text-[0.7rem] text-muted-foreground">
          <input
            type="checkbox"
            checked={Boolean(rule.caseSensitive)}
            onChange={(e) => onChange({ caseSensitive: e.target.checked })}
            className="accent-primary"
          />
          ตรงพิมพ์เล็ก-ใหญ่
        </label>
      )}
    </div>
  );
}

export default function FormConditionBuilder({
  value,
  onChange,
  availableQuestions,
  allQuestions,
  title,
  emptyLabel = 'ไม่มีเงื่อนไข (แสดงตลอด)',
}: {
  value?: FormConditionSet | null;
  onChange: (next: FormConditionSet | null) => void;
  availableQuestions: FormQuestion[];
  allQuestions: FormQuestion[];
  title: string;
  emptyLabel?: string;
}) {
  const qById = new Map(allQuestions.map((q) => [q.id, q]));
  const availableIds = new Set(availableQuestions.map((q) => q.id));
  const active = Boolean(value?.enabled);

  const enable = () => {
    const firstQ = availableQuestions[0];
    if (!firstQ) return;
    onChange({
      enabled: true,
      match: 'all',
      groups: [
        {
          id: makeFormId('cg'),
          match: 'all',
          rules: [defaultRuleForQuestion(firstQ)],
        },
      ],
    });
  };

  if (availableQuestions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border px-3 py-2.5 text-[0.78rem] text-muted-foreground">
        {title}: ต้องมีคำถามก่อนหน้าอย่างน้อย 1 ข้อจึงจะตั้งเงื่อนไขได้
      </div>
    );
  }

  if (!active || !value) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/80 bg-muted/25 px-3 py-2">
        <div className="text-[0.8rem]">
          <span className="font-semibold text-foreground">{title}: </span>
          <span className="text-muted-foreground">{emptyLabel}</span>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={enable} className="h-7 rounded-lg text-[0.75rem]">
          <Plus size={13} /> เพิ่มเงื่อนไข
        </Button>
      </div>
    );
  }

  const updateGroup = (groupId: string, updater: (g: FormConditionGroup) => FormConditionGroup) => {
    onChange({ ...value, groups: value.groups.map((g) => (g.id === groupId ? updater(g) : g)) });
  };

  const removeGroup = (groupId: string) => {
    const remaining = value.groups.filter((g) => g.id !== groupId);
    if (remaining.length === 0) onChange(null);
    else onChange({ ...value, groups: remaining });
  };

  const addGroup = () => {
    const firstQ = availableQuestions[0];
    if (!firstQ) return;
    onChange({
      ...value,
      groups: [...value.groups, { id: makeFormId('cg'), match: 'all', rules: [defaultRuleForQuestion(firstQ)] }],
    });
  };

  const summary = describeConditionSet(value, allQuestions);
  const hasInvalidRef = value.groups.some((g) => g.rules.some((r) => !availableIds.has(r.questionId)));

  return (
    <div className="rounded-xl border border-border bg-muted/20 p-3">
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[0.8rem] font-bold text-foreground">{title}</span>
          {value.groups.length > 1 && (
            <div className="inline-flex rounded-lg border border-border bg-card p-0.5 text-[0.72rem]">
              <button
                type="button"
                onClick={() => onChange({ ...value, match: 'all' })}
                className={cn('rounded-md px-2 py-0.5 font-semibold', value.match === 'all' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}
              >
                ทุกกลุ่ม (AND)
              </button>
              <button
                type="button"
                onClick={() => onChange({ ...value, match: 'any' })}
                className={cn('rounded-md px-2 py-0.5 font-semibold', value.match === 'any' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}
              >
                อย่างน้อย 1 กลุ่ม (OR)
              </button>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="inline-flex items-center gap-1 text-[0.74rem] font-medium text-muted-foreground hover:text-destructive"
        >
          <Trash2 size={13} /> ล้างเงื่อนไขทั้งหมด
        </button>
      </div>

      {hasInvalidRef && (
        <p className="mb-2 flex items-center gap-1.5 rounded-lg border border-warning/40 bg-warning/10 px-2.5 py-1.5 text-[0.74rem] text-warning">
          <AlertTriangle size={14} className="shrink-0" />
          มีเงื่อนไขที่อ้างอิงคำถามที่ถูกลบหรือถูกย้ายไปอยู่ด้านหลัง — กรุณาเลือกคำถามต้นทางใหม่ (มิฉะนั้นเงื่อนไขนั้นจะไม่ถูกบันทึก)
        </p>
      )}

      <div className="flex flex-col gap-2">
        {value.groups.map((group, gi) => (
          <React.Fragment key={group.id}>
            {gi > 0 && (
              <div className="flex items-center gap-2 px-1">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[0.7rem] font-bold tracking-wide text-primary uppercase">
                  {value.match === 'any' ? 'หรือ (OR)' : 'และ (AND)'}
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>
            )}

            <div className="rounded-xl border border-border bg-card p-2.5">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[0.75rem] text-muted-foreground">
                  {value.groups.length > 1 && <span className="font-bold text-foreground">กลุ่ม {gi + 1}:</span>}
                  <span>ตรงตาม</span>
                  <select
                    value={group.match}
                    onChange={(e) => updateGroup(group.id, (g) => ({ ...g, match: e.target.value === 'any' ? 'any' : 'all' }))}
                    aria-label="รูปแบบการรวมเงื่อนไขในกลุ่ม"
                    className="h-7 rounded-md border border-input bg-background px-2 text-[0.75rem] font-semibold text-foreground outline-none"
                  >
                    <option value="all">ทุกเงื่อนไข (AND)</option>
                    <option value="any">เงื่อนไขใดเงื่อนไขหนึ่ง (OR)</option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => removeGroup(group.id)}
                  aria-label="ลบกลุ่มเงื่อนไข"
                  className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="flex flex-col gap-2">
                {group.rules.map((rule) => {
                  const srcQ = qById.get(rule.questionId);
                  const validOps = getOperatorsForQuestion(srcQ);
                  const stale = !availableIds.has(rule.questionId);
                  return (
                    <div
                      key={rule.id}
                      className={cn(
                        'flex flex-col gap-1.5 rounded-lg border p-2 sm:flex-row sm:flex-wrap sm:items-center',
                        stale ? 'border-warning/60 bg-warning/5' : 'border-border/80 bg-muted/20',
                      )}
                    >
                      <select
                        value={stale ? '' : rule.questionId}
                        onChange={(e) => {
                          const targetQ = availableQuestions.find((aq) => aq.id === e.target.value);
                          if (!targetQ) return;
                          const def = defaultRuleForQuestion(targetQ);
                          updateGroup(group.id, (g) => ({
                            ...g,
                            rules: g.rules.map((r) => (r.id === rule.id ? { ...def, id: rule.id } : r)),
                          }));
                        }}
                        aria-label="เลือกคำถามต้นทาง"
                        className="h-8 max-w-full min-w-[160px] flex-1 rounded-lg border border-input bg-card px-2 text-[0.8rem] font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                      >
                        {stale && <option value="">— คำถามเดิมไม่อยู่ก่อนหน้าแล้ว —</option>}
                        {availableQuestions.map((aq) => {
                          const realIdx = allQuestions.findIndex((x) => x.id === aq.id);
                          return (
                            <option key={aq.id} value={aq.id}>
                              ข้อ {realIdx + 1}: {aq.title || '(ยังไม่มีหัวข้อ)'}
                            </option>
                          );
                        })}
                      </select>

                      <select
                        value={rule.operator}
                        onChange={(e) => {
                          const nextOp = e.target.value as FormConditionOperator;
                          const wasMulti = isMultiValueOp(rule.operator, srcQ);
                          const nowMulti = isMultiValueOp(nextOp, srcQ);
                          let value = rule.value;
                          let values = rule.values;
                          if (isUnaryOp(nextOp)) {
                            value = undefined;
                            values = undefined;
                          } else if (nowMulti && !wasMulti) {
                            values = rule.value ? [rule.value] : srcQ?.options?.[0]?.id ? [srcQ.options[0].id] : [];
                            value = undefined;
                          } else if (!nowMulti && wasMulti) {
                            value = rule.values?.[0] || srcQ?.options?.[0]?.id || '';
                            values = undefined;
                          }
                          updateGroup(group.id, (g) => ({
                            ...g,
                            rules: g.rules.map((r) => (r.id === rule.id ? { ...r, operator: nextOp, value, values } : r)),
                          }));
                        }}
                        aria-label="ตัวดำเนินการเงื่อนไข"
                        className="h-8 rounded-lg border border-input bg-card px-2 text-[0.8rem] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                      >
                        {validOps.map((op) => (
                          <option key={op} value={op}>{CONDITION_OPERATOR_LABELS[op]}</option>
                        ))}
                      </select>

                      <div className="min-w-[140px] flex-1">
                        <RuleValueEditor
                          rule={rule}
                          sourceQuestion={srcQ}
                          onChange={(patch) =>
                            updateGroup(group.id, (g) => ({
                              ...g,
                              rules: g.rules.map((r) => (r.id === rule.id ? { ...r, ...patch } : r)),
                            }))
                          }
                        />
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="ลบเงื่อนไขนี้"
                        onClick={() => {
                          if (group.rules.length <= 1) removeGroup(group.id);
                          else updateGroup(group.id, (g) => ({ ...g, rules: g.rules.filter((r) => r.id !== rule.id) }));
                        }}
                        className="self-end text-muted-foreground hover:text-destructive sm:self-center"
                      >
                        <X size={14} />
                      </Button>
                    </div>
                  );
                })}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    updateGroup(group.id, (g) => ({
                      ...g,
                      rules: [...g.rules, defaultRuleForQuestion(availableQuestions[0])],
                    }))
                  }
                  className="h-7 rounded-lg px-2 text-[0.75rem] text-primary"
                >
                  <Plus size={13} /> เพิ่มเงื่อนไขในกลุ่ม
                </Button>
              </div>
            </div>
          </React.Fragment>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <Button type="button" variant="outline" size="sm" onClick={addGroup} className="h-7 rounded-lg text-[0.74rem]">
          <Plus size={13} /> เพิ่มกลุ่มเงื่อนไข (OR / AND)
        </Button>
        {summary && (
          <p className="text-[0.72rem] text-muted-foreground break-words">
            สรุป: <span className="font-medium text-foreground">{summary}</span>
          </p>
        )}
      </div>
    </div>
  );
}
