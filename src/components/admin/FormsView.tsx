'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BarChart3,
  ClipboardList,
  ExternalLink,
  Eye,
  GitBranch,
  Globe,
  Info,
  Link2,
  ListChecks,
  Loader2,
  Lock,
  PenLine,
  Plus,
  Save,
  Settings2,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import FormQuestionField from '@/components/forms/FormQuestionField';
import FormPdpaConsentBox from '@/components/forms/FormPdpaConsentBox';
import { FormBannerThumb, FormBannerView } from '@/components/forms/FormBanner';
import FormBannerEditor from '@/components/admin/forms/FormBannerEditor';
import FormAccessSettings from '@/components/admin/forms/FormAccessSettings';
import FormFontPicker from '@/components/admin/forms/FormFontPicker';
import FormPdpaSettings from '@/components/admin/forms/FormPdpaSettings';
import FormResultsDashboard from '@/components/admin/forms/FormResultsDashboard';
import { useFormFont } from '@/components/forms/useFormFont';
import { QuestionEditor, QUESTION_TYPE_META, arrayMove, useReorder } from '@/components/admin/forms/FormQuestionEditor';
import {
  FORM_QUESTION_TYPES,
  createEmptyForm,
  createEmptyQuestion,
  describeAccess,
  evaluateFormLogic,
  getFormAccess,
  getFormPdpa,
  isFormAcceptingResponses,
  makeFormId,
  optionDetailAnswerKey,
  otherAnswerKey,
  type FormAnswers,
  type FormDefinition,
  type FormQuestion,
  type FormQuestionType,
  type FormStatus,
} from '@/lib/forms';

type Toast = (type: 'success' | 'error' | 'info' | 'warning', message: string) => void;

interface Props {
  showToast: Toast;
}

const STATUS_LABEL: Record<FormStatus, string> = { draft: 'ฉบับร่าง', open: 'เปิดรับคำตอบ', closed: 'ปิดแล้ว' };
const STATUS_HINT: Record<FormStatus, string> = {
  draft: 'ยังไม่แสดงให้นักศึกษาเห็น',
  open: 'นักศึกษาเห็นและตอบได้',
  closed: 'เห็นได้แต่ตอบไม่ได้',
};
const STATUS_CLASS: Record<FormStatus, string> = {
  draft: 'bg-slate-500/15 text-slate-500',
  open: 'bg-success/15 text-success',
  closed: 'bg-destructive/15 text-destructive',
};

function isoToLocal(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function localToIso(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
function formatDate(iso?: string | null) {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

async function readJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

function countFormRules(form: FormDefinition): number {
  let n = 0;
  for (const q of form.questions) {
    if (q.condition?.enabled) n += 1;
    if (q.requiredCondition?.enabled) n += 1;
    for (const o of q.options || []) {
      if (o.condition?.enabled || o.maxChoices || o.exclusive || o.requireDetail || (o.action && o.action !== 'next')) n += 1;
    }
  }
  return n;
}

// ───────────────────────── Editor ─────────────────────────

const QUICK_ADD: FormQuestionType[] = ['single_choice', 'multiple_choice', 'long_text', 'short_text', 'rating', 'dropdown', 'date'];

function FormPreview({ form }: { form: FormDefinition }) {
  const [answers, setAnswers] = useState<FormAnswers>({});
  const [pdpaAccepted, setPdpaAccepted] = useState(false);
  const [marketingAccepted, setMarketingAccepted] = useState(false);

  const set = (id: string, v: FormAnswers[string] | undefined) =>
    setAnswers((a) => {
      const next = { ...a };
      if (v === undefined) delete next[id];
      else next[id] = v;
      return next;
    });
  const fontFamily = useFormFont(form.fontFamily);
  const pdpa = getFormPdpa(form);
  const logic = useMemo(() => evaluateFormLogic(form, answers), [form, answers]);
  const pdpaLocked = Boolean(pdpa.enabled && pdpa.requireConsent && !pdpaAccepted);

  return (
    <div className="flex flex-col gap-3" style={{ fontFamily }}>
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <FormBannerView banner={form.banner} title={form.title} />
        <div className="p-5 sm:p-6">
          <h2 className="text-[1.35rem] font-extrabold break-words">{form.title || 'ยังไม่มีชื่อแบบฟอร์ม'}</h2>
          {form.description && <p className="mt-2 text-[0.9rem] whitespace-pre-wrap break-words text-muted-foreground">{form.description}</p>}
        </div>
      </div>
      {pdpa.enabled && (
        <FormPdpaConsentBox
          pdpa={pdpa}
          formTitle={form.title}
          accepted={pdpaAccepted}
          onAcceptedChange={setPdpaAccepted}
          marketingAccepted={marketingAccepted}
          onMarketingAcceptedChange={setMarketingAccepted}
          lockedQuestionCount={logic.visibleQuestions.length}
        />
      )}
      {!pdpaLocked && (
        <>
          {logic.visibleQuestions.map((q, i) => (
            <FormQuestionField
              key={q.id}
              q={{
                ...q,
                title: q.title || `คำถามข้อ ${i + 1}`,
                options: q.options?.map((o, oi) => ({ ...o, label: o.label || `ตัวเลือก ${oi + 1}` })),
              }}
              index={i}
              required={logic.requiredQuestionIds.has(q.id)}
              visibleOptions={(logic.visibleOptionsByQuestion.get(q.id) || q.options || []).map((o, oi) => ({
                ...o,
                label: o.label || `ตัวเลือก ${oi + 1}`,
              }))}
              disabledOptionIds={logic.disabledOptionIdsByQuestion.get(q.id)}
              value={answers[q.id]}
              otherText={typeof answers[otherAnswerKey(q.id)] === 'string' ? (answers[otherAnswerKey(q.id)] as string) : ''}
              allAnswers={answers}
              onChange={(v) => set(q.id, v)}
              onOtherChange={(t) => set(otherAnswerKey(q.id), t || undefined)}
              onDetailChange={(optId, t) => set(optionDetailAnswerKey(q.id, optId), t || undefined)}
            />
          ))}
          {logic.endedEarly && (
            <div className="flex items-start gap-2.5 rounded-2xl border border-border bg-muted/40 p-4 text-[0.85rem] text-muted-foreground">
              <Info size={16} className="mt-0.5 shrink-0 text-primary" />
              <span>{logic.endNotice || 'สิ้นสุดคำถามตามตัวเลือกที่เลือก (ข้อความตัวอย่าง)'}</span>
            </div>
          )}
        </>
      )}
      <p className="text-center text-[0.75rem] text-muted-foreground">นี่คือตัวอย่างแบบโต้ตอบได้ — เงื่อนไขและ PDPA ทำงานจริงแต่คำตอบในหน้านี้ไม่ถูกบันทึก</p>
    </div>
  );
}

function FormEditor({
  initial, isNew, saving, onCancel, onSave, showToast,
}: {
  initial: FormDefinition;
  isNew: boolean;
  saving: boolean;
  onCancel: () => void;
  onSave: (form: FormDefinition) => void;
  showToast: Toast;
}) {
  const [form, setForm] = useState<FormDefinition>(initial);
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [showSettings, setShowSettings] = useState(isNew);
  const [settingsTab, setSettingsTab] = useState<'general' | 'pdpa'>('general');

  const setQuestions = (fn: (qs: FormQuestion[]) => FormQuestion[]) => setForm((f) => ({ ...f, questions: fn(f.questions) }));
  const reorder = useReorder(form.questions.length, (from, to) => setQuestions((qs) => arrayMove(qs, from, to)));

  const addQuestion = (type: FormQuestionType) => {
    const q = createEmptyQuestion(type);
    setQuestions((qs) => [...qs, q]);
    setTimeout(() => document.querySelector<HTMLInputElement>(`[data-question="${q.id}"] input[aria-label="หัวข้อคำถาม"]`)?.focus(), 50);
  };

  const requiredCount = form.questions.filter((q) => q.required || q.requiredCondition?.enabled).length;
  const pdpaEnabled = getFormPdpa(form).enabled;
  const ruleCount = countFormRules(form);

  return (
    <div className="mx-auto max-w-[820px]">
      {/* Sticky action bar */}
      <div className="sticky top-0 z-30 -mx-2 mb-4 flex items-center gap-1.5 rounded-b-2xl bg-background/85 px-2 py-2 backdrop-blur-md sm:flex-wrap sm:gap-2 sm:py-2.5">
        <Button variant="ghost" onClick={onCancel} aria-label="ยกเลิก" className="px-2.5 sm:px-4"><ArrowLeft size={16} /> <span className="hidden sm:inline">ยกเลิก</span></Button>
        <div className="inline-flex rounded-xl bg-muted p-1">
          {([['edit', 'แก้ไข', PenLine], ['preview', 'ตัวอย่าง', Eye]] as const).map(([m, label, Icon]) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-label={label}
              title={label}
              className={cn('flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[0.82rem] font-semibold transition-colors sm:px-3', mode === m ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
            >
              <Icon size={14} /> <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
        <div className="ml-auto flex shrink-0 gap-1.5 sm:gap-2">
          {form.status === 'draft' && (
            <Button variant="outline" disabled={saving} onClick={() => onSave({ ...form, status: 'open' })} className="px-3 sm:px-4">
              <span className="sm:hidden">เปิดรับ</span><span className="hidden sm:inline">บันทึกและเปิดรับ</span>
            </Button>
          )}
          <Button disabled={saving} onClick={() => onSave(form)} className="px-3 font-bold sm:px-4">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} บันทึก
          </Button>
        </div>
      </div>

      {mode === 'preview' ? (
        <FormPreview form={form} />
      ) : (
        <>
          {/* Form header */}
          <div className="mb-4 overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
            <FormBannerEditor banner={form.banner} title={form.title} onChange={(banner) => setForm((f) => ({ ...f, banner }))} showToast={showToast} />
            <div className="p-4 sm:p-5">
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="ชื่อแบบฟอร์ม เช่น โพลสำรวจเสื้อรุ่น 2569" maxLength={200} aria-label="ชื่อแบบฟอร์ม" className="mb-3 h-12 text-[1.1rem] font-bold" />
              <Textarea value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="รายละเอียด / คำชี้แจงสำหรับผู้ตอบ" maxLength={2000} rows={3} aria-label="รายละเอียดแบบฟอร์ม" />

              <div className="mt-3 flex flex-wrap items-center gap-2 text-[0.75rem] font-semibold">
                <span className={cn('rounded-full px-2.5 py-1', STATUS_CLASS[form.status])}>{STATUS_LABEL[form.status]}</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-muted-foreground"><ListChecks size={13} /> {form.questions.length} คำถาม · บังคับ {requiredCount}</span>
                {ruleCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-muted-foreground"><GitBranch size={12} className="text-primary" /> {ruleCount} เงื่อนไข</span>
                )}
                <button
                  type="button"
                  onClick={() => { setShowSettings(true); setSettingsTab('pdpa'); }}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2.5 py-1 transition-colors',
                    pdpaEnabled ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground hover:text-foreground',
                  )}
                >
                  <ShieldCheck size={13} /> {pdpaEnabled ? 'PDPA เปิดใช้' : 'PDPA ปิด'}
                </button>
                <button type="button" onClick={() => setShowSettings((v) => !v)} className="ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-primary hover:bg-primary/10">
                  <Settings2 size={13} /> {showSettings ? 'ซ่อนการตั้งค่า' : 'การตั้งค่า'}
                </button>
              </div>

              {showSettings && (
                <div className="mt-4 border-t border-border pt-4">
                  <div className="mb-4 inline-flex rounded-xl bg-muted p-1 text-[0.82rem]">
                    <button
                      type="button"
                      onClick={() => setSettingsTab('general')}
                      className={cn('rounded-lg px-3.5 py-1.5 font-semibold transition-colors', settingsTab === 'general' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground')}
                    >
                      ทั่วไปและการเข้าถึง
                    </button>
                    <button
                      type="button"
                      onClick={() => setSettingsTab('pdpa')}
                      className={cn('flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 font-semibold transition-colors', settingsTab === 'pdpa' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground')}
                    >
                      <ShieldCheck size={14} className={pdpaEnabled ? 'text-primary' : ''} />
                      PDPA & ความยินยอม
                    </button>
                  </div>

                  {settingsTab === 'pdpa' ? (
                    <FormPdpaSettings
                      pdpa={form.pdpa}
                      access={form.access}
                      questions={form.questions}
                      onChange={(pdpa) => setForm((f) => ({ ...f, pdpa }))}
                    />
                  ) : (
                    <>
                      <Label className="mb-2 block text-[0.8rem]">สถานะ</Label>
                      <div className="mb-4 grid gap-2 sm:grid-cols-3">
                        {(['draft', 'open', 'closed'] as FormStatus[]).map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setForm({ ...form, status: s })}
                            className={cn('rounded-xl border px-3 py-2.5 text-left transition-colors', form.status === s ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/60')}
                          >
                            <span className="block text-[0.85rem] font-bold">{STATUS_LABEL[s]}</span>
                            <span className="block text-[0.72rem] text-muted-foreground">{STATUS_HINT[s]}</span>
                          </button>
                        ))}
                      </div>

                      <div className="mb-4 grid gap-3 sm:grid-cols-2">
                        <div>
                          <Label className="mb-1 block text-[0.8rem]">เปิดรับตั้งแต่ (ไม่บังคับ)</Label>
                          <Input type="datetime-local" value={isoToLocal(form.opensAt)} onChange={(e) => setForm({ ...form, opensAt: localToIso(e.target.value) })} />
                        </div>
                        <div>
                          <Label className="mb-1 block text-[0.8rem]">ปิดรับเมื่อ (ไม่บังคับ)</Label>
                          <Input type="datetime-local" value={isoToLocal(form.closesAt)} onChange={(e) => setForm({ ...form, closesAt: localToIso(e.target.value) })} />
                        </div>
                      </div>

                      <div className="flex flex-col gap-2.5">
                        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-muted/50 px-3 py-2.5 text-[0.85rem]">
                          <span>ให้ผู้ตอบเห็นผลโหวต/สรุปผลหลังตอบ<span className="block text-[0.72rem] text-muted-foreground">คำตอบแบบข้อความเห็นได้เฉพาะผู้ดูแล</span></span>
                          <Switch checked={form.showResultsToRespondents} onCheckedChange={(v) => setForm({ ...form, showResultsToRespondents: Boolean(v) })} />
                        </label>
                        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-muted/50 px-3 py-2.5 text-[0.85rem]">
                          <span>ให้แก้ไขคำตอบได้ระหว่างเปิดรับ<span className="block text-[0.72rem] text-muted-foreground">ผู้ตอบกลับมาแก้คำตอบเดิมได้จนกว่าจะปิดรับ</span></span>
                          <Switch checked={form.allowEditResponse} onCheckedChange={(v) => setForm({ ...form, allowEditResponse: Boolean(v) })} />
                        </label>
                      </div>

                      <div className="mt-5 border-t border-border pt-4">
                        <FormAccessSettings access={form.access} onChange={(access) => setForm((f) => ({ ...f, access }))} />
                      </div>

                      <div className="mt-5 border-t border-border pt-4">
                        <p className="mb-2 text-[0.8rem] font-semibold">ฟอนต์ของแบบฟอร์ม</p>
                        <FormFontPicker value={form.fontFamily} onChange={(fontFamily) => setForm((f) => ({ ...f, fontFamily }))} />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Questions */}
          <div className="flex flex-col gap-3">
            {form.questions.map((q, i) => (
              <div key={q.id} data-question={q.id}>
                <QuestionEditor
                  q={q}
                  index={i}
                  total={form.questions.length}
                  allQuestions={form.questions}
                  rowProps={reorder.rowProps(i)}
                  className={reorder.rowState(i)}
                  dragHandle={reorder.handleProps(i)}
                  onChange={(nq) => setQuestions((qs) => qs.map((x, k) => (k === i ? nq : x)))}
                  onMove={(dir) => setQuestions((qs) => (i + dir < 0 || i + dir >= qs.length ? qs : arrayMove(qs, i, i + dir)))}
                  onDuplicate={() => setQuestions((qs) => {
                    const copy: FormQuestion = {
                      ...q,
                      id: makeFormId('q'),
                      options: q.options?.map((o) => ({ ...o, id: makeFormId('o') })),
                    };
                    const next = [...qs];
                    next.splice(i + 1, 0, copy);
                    return next;
                  })}
                  onRemove={() => setQuestions((qs) => qs.filter((_, k) => k !== i))}
                />
              </div>
            ))}
          </div>

          {/* Add question */}
          <div className="mt-3 rounded-2xl border-2 border-dashed border-border p-3">
            <p className="mb-2 flex items-center gap-1.5 px-1 text-[0.8rem] font-semibold text-muted-foreground"><Plus size={14} /> เพิ่มคำถาม</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {QUICK_ADD.filter((t) => FORM_QUESTION_TYPES.includes(t)).map((t) => {
                const m = QUESTION_TYPE_META[t];
                const Icon = m.icon;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => addQuestion(t)}
                    className="flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2.5 text-left text-[0.8rem] font-semibold transition-colors hover:bg-primary/10 hover:text-primary"
                  >
                    <Icon size={16} className="shrink-0" /> <span className="truncate">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ───────────────────────── Main view ─────────────────────────

export function FormsView({ showToast }: Props) {
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const [forms, setForms] = useState<FormDefinition[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [editing, setEditing] = useState<FormDefinition | null>(null);
  const [viewingResults, setViewingResults] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await apiFetch('/api/admin/forms', { cache: 'no-store' });
    const json = await readJson(res);
    if (json?.status === 'success') {
      setForms(json.forms || []);
      setCounts(json.counts || {});
    } else {
      setForms([]);
      showToast('error', json?.message || 'โหลดแบบฟอร์มไม่สำเร็จ');
    }
  }, [showToast]);

  useEffect(() => { void load(); }, [load]);

  const editingIsNew = useMemo(() => Boolean(editing && !forms?.some((f) => f.id === editing.id)), [editing, forms]);

  const save = async (form: FormDefinition) => {
    setSaving(true);
    try {
      const res = await apiFetch('/api/admin/forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ form }),
      });
      const json = await readJson(res);
      if (json?.status !== 'success') {
        showToast('error', json?.message || 'บันทึกไม่สำเร็จ');
        return;
      }
      showToast('success', editingIsNew ? 'สร้างแบบฟอร์มแล้ว' : 'บันทึกแบบฟอร์มแล้ว');
      setEditing(null);
      void load();
    } finally {
      setSaving(false);
    }
  };

  const quickStatus = async (form: FormDefinition, status: FormStatus) => {
    const res = await apiFetch('/api/admin/forms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ form: { ...form, status } }),
    });
    const json = await readJson(res);
    if (json?.status === 'success') { showToast('success', `เปลี่ยนเป็น "${STATUS_LABEL[status]}" แล้ว`); void load(); }
    else showToast('error', json?.message || 'เปลี่ยนสถานะไม่สำเร็จ');
  };

  const remove = async (form: FormDefinition) => {
    const n = counts[form.id] || 0;
    const ok = await confirm({
      title: `ลบ "${form.title}"?`,
      message: n > 0 ? `คำตอบทั้งหมด ${n} รายการจะถูกลบด้วย และกู้คืนไม่ได้` : 'แบบฟอร์มนี้จะถูกลบถาวร',
      destructive: true,
      confirmText: 'ลบ',
    });
    if (!ok) return;
    const res = await apiFetch(`/api/admin/forms?id=${encodeURIComponent(form.id)}`, { method: 'DELETE' });
    const json = await readJson(res);
    if (json?.status === 'success') { showToast('success', 'ลบแบบฟอร์มแล้ว'); void load(); }
    else showToast('error', json?.message || 'ลบไม่สำเร็จ');
  };

  const copyLink = async (form: FormDefinition) => {
    const url = `${window.location.origin}/forms/${form.id}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast('success', 'คัดลอกลิงก์แล้ว');
    } catch {
      showToast('info', url);
    }
  };

  if (viewingResults) {
    return <FormResultsDashboard formId={viewingResults} onBack={() => { setViewingResults(null); void load(); }} showToast={showToast} />;
  }

  if (editing) {
    return <FormEditor key={editing.id} initial={editing} isNew={editingIsNew} saving={saving} onCancel={() => setEditing(null)} onSave={(f) => void save(f)} showToast={showToast} />;
  }

  const stats = {
    open: forms?.filter((f) => isFormAcceptingResponses(f)).length || 0,
    responses: Object.values(counts).reduce((a, b) => a + b, 0),
  };

  // ── List ──
  return (
    <div className="mx-auto max-w-[900px]">
      <ConfirmDialog />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <ClipboardList size={22} className="shrink-0 text-primary" />
          <div>
            <h2 className="text-[1.3rem] font-extrabold text-foreground">แบบสำรวจ & โหวต</h2>
            <p className="text-[0.8rem] text-muted-foreground">ฟอร์มให้นักศึกษาลงชื่อ โหวต และแสดงความคิดเห็น</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.open('/forms', '_blank')}><ExternalLink size={16} /> ดูหน้านักศึกษา</Button>
          <Button onClick={() => setEditing(createEmptyForm())} className="rounded-xl px-5 font-bold">
            <Plus size={18} /> สร้างฟอร์มใหม่
          </Button>
        </div>
      </div>

      {forms && forms.length > 0 && (
        <div className="mb-4 grid grid-cols-3 gap-2">
          {[
            ['ฟอร์มทั้งหมด', forms.length],
            ['กำลังเปิดรับ', stats.open],
            ['คำตอบรวม', stats.responses],
          ].map(([label, n]) => (
            <div key={label} className="rounded-2xl border border-border bg-card px-4 py-3">
              <div className="text-[1.35rem] font-extrabold tabular-nums">{n}</div>
              <div className="text-[0.75rem] text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>
      )}

      {!forms ? (
        <div className="py-16 text-center text-muted-foreground"><Loader2 className="mx-auto animate-spin" /></div>
      ) : forms.length === 0 ? (
        <div className="rounded-[20px] border border-border bg-muted/40 py-16 text-center">
          <ClipboardList size={44} className="mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-[1.1rem] font-semibold text-muted-foreground">ยังไม่มีแบบฟอร์ม</p>
          <p className="mt-1 text-[0.85rem] text-muted-foreground">สร้างแบบสำรวจหรือโหวตแรก แล้วแชร์ลิงก์ให้นักศึกษา</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {forms.map((f) => {
            const live = isFormAcceptingResponses(f);
            const n = counts[f.id] || 0;
            const pdpaOn = getFormPdpa(f).enabled;
            const rules = countFormRules(f);
            return (
              <div key={f.id} className="rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/30">
                <div className="flex items-start gap-3">
                  <FormBannerThumb banner={f.banner} className="h-14 w-24 sm:h-16 sm:w-28" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold break-words text-foreground">{f.title}</span>
                      <span className={cn('rounded-full px-2 py-0.5 text-[0.7rem] font-bold', STATUS_CLASS[f.status])}>{STATUS_LABEL[f.status]}</span>
                      {f.status === 'open' && !live && <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[0.7rem] font-bold text-warning">นอกช่วงเวลา</span>}
                    </div>
                    <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[0.78rem] text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><ListChecks size={13} /> {f.questions.length} คำถาม</span>
                      <span className="inline-flex items-center gap-1"><Users size={13} /> {n} คนตอบ</span>
                      <span className="inline-flex items-center gap-1">{getFormAccess(f).mode === 'public' ? <><Globe size={12} /> ไม่ต้องเข้าสู่ระบบ</> : <><Lock size={12} /> {describeAccess(getFormAccess(f)) || 'ต้องเข้าสู่ระบบ'}</>}</span>
                      {pdpaOn && <span className="inline-flex items-center gap-1 text-foreground"><ShieldCheck size={12} className="text-primary" /> PDPA</span>}
                      {rules > 0 && <span className="inline-flex items-center gap-1"><GitBranch size={12} /> {rules} เงื่อนไข</span>}
                      {f.closesAt && <span className="inline-flex items-center gap-1"><Lock size={12} /> ปิด {formatDate(f.closesAt)}</span>}
                      <span>แก้ไขล่าสุด {formatDate(f.updatedAt)}</span>
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                  <Button size="sm" variant="outline" onClick={() => setViewingResults(f.id)}><BarChart3 size={14} /> ผลลัพธ์ ({n})</Button>
                  <Button size="sm" variant="outline" onClick={() => setEditing(structuredClone(f))}><PenLine size={14} /> แก้ไข</Button>
                  <Button size="sm" variant="outline" onClick={() => void copyLink(f)}><Link2 size={14} /> คัดลอกลิงก์</Button>
                  {f.status !== 'open' ? (
                    <Button size="sm" variant="outline" className="border-success/40 text-success hover:bg-success/10 hover:text-success" onClick={() => void quickStatus(f, 'open')}>เปิดรับ</Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => void quickStatus(f, 'closed')}>ปิดรับ</Button>
                  )}
                  <Button size="sm" variant="ghost" className="ml-auto text-destructive" onClick={() => void remove(f)}><Trash2 size={14} /> ลบ</Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default FormsView;
