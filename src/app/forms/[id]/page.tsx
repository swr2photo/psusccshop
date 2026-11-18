'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import {
  AlertCircle,
  ArrowLeft,
  AtSign,
  CalendarClock,
  CheckCircle2,
  Globe,
  Info,
  ListChecks,
  Loader2,
  LogIn,
  LogOut,
  Lock,
  Pencil,
  Send,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react';
import StorefrontNavbar from '@/components/StorefrontNavbar';
import MobileBottomNav from '@/components/MobileBottomNav';
import FormResults from '@/components/forms/FormResults';
import FormQuestionField, { isAnswerEmpty } from '@/components/forms/FormQuestionField';
import FormPdpaConsentBox from '@/components/forms/FormPdpaConsentBox';
import { FormBannerView } from '@/components/forms/FormBanner';
import { useFormFont } from '@/components/forms/useFormFont';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import {
  CHOICE_QUESTION_TYPES,
  evaluateFormLogic,
  getFormPdpa,
  optionDetailAnswerKey,
  otherAnswerKey,
  validateTextFieldValue,
  type FormAnswers,
  type FormDefinition,
  type FormOption,
  type FormPdpaConsentRecord,
  type FormQuestion,
  type FormSummary,
} from '@/lib/forms';

const LoginScreen = dynamic(() => import('@/components/LoginScreen'), { ssr: false });

interface FormPayload {
  form: FormDefinition;
  isAcceptingResponses: boolean;
  loggedIn: boolean;
  viewerEmail?: string | null;
  accessMode?: 'login' | 'public';
  accessNote?: string | null;
  /** null = not signed in (login mode); false = signed-in account not allowed */
  canRespond?: boolean | null;
  myResponse: {
    answers: FormAnswers;
    pdpaConsent?: FormPdpaConsentRecord | null;
    submittedAt: string;
    updatedAt: string;
  } | null;
  summary: FormSummary | null;
  optionCounts?: Record<string, Record<string, number>>;
}

function formatDate(iso?: string | null) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

/** Required + text validation + minSelections + option detail text must be valid. */
function isQuestionComplete(
  q: FormQuestion,
  answers: FormAnswers,
  opts: { required: boolean; visibleOptions?: FormOption[] },
) {
  const v = answers[q.id];
  if (isAnswerEmpty(v)) return !opts.required;

  if (q.type === 'short_text' || q.type === 'long_text') {
    return typeof v === 'string' ? validateTextFieldValue(q, v.trim()) === null : false;
  }

  if (CHOICE_QUESTION_TYPES.includes(q.type)) {
    const picked = Array.isArray(v) ? v.map(String) : [String(v)];
    const visibleOpts = opts.visibleOptions || q.options || [];
    const hasExclusive = visibleOpts.some((o) => o.exclusive && picked.includes(o.id));
    if (q.type === 'multiple_choice' && q.minSelections && !hasExclusive && picked.length < q.minSelections) {
      return false;
    }
    const other = visibleOpts.find((o) => o.other);
    if (other && picked.includes(other.id) && isAnswerEmpty(answers[otherAnswerKey(q.id)])) {
      return false;
    }
    for (const o of visibleOpts) {
      if (o.requireDetail && !o.other && picked.includes(o.id) && isAnswerEmpty(answers[optionDetailAnswerKey(q.id, o.id)])) {
        return false;
      }
    }
  }
  return true;
}

/** Strip option picks inside visible questions that became hidden due to conditional logic. */
function pruneHiddenOptionSelections(
  form: FormDefinition,
  answers: FormAnswers,
  optionCounts?: Record<string, Record<string, number>>,
): FormAnswers {
  const logic = evaluateFormLogic(form, answers, { optionCounts });
  let changed = false;
  const next: FormAnswers = { ...answers };

  for (const q of logic.visibleQuestions) {
    if (!CHOICE_QUESTION_TYPES.includes(q.type)) continue;
    const visibleIds = new Set((logic.visibleOptionsByQuestion.get(q.id) || []).map((o) => o.id));
    const cur = next[q.id];
    if (cur === undefined) continue;
    if (Array.isArray(cur)) {
      const filtered = cur.filter((id) => visibleIds.has(String(id)));
      if (filtered.length !== cur.length) {
        changed = true;
        if (filtered.length) next[q.id] = filtered;
        else delete next[q.id];
      }
    } else if (!visibleIds.has(String(cur))) {
      changed = true;
      delete next[q.id];
    }
  }
  return changed ? next : answers;
}

export default function FormFillPage() {
  const params = useParams<{ id: string }>();
  const formId = String(params?.id || '');
  const { status: sessionStatus } = useSession();

  const [data, setData] = useState<FormPayload | null>(null);
  const [loadError, setLoadError] = useState('');
  const [answers, setAnswers] = useState<FormAnswers>({});
  const [pdpaAccepted, setPdpaAccepted] = useState(false);
  const [marketingAccepted, setMarketingAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [withdrawnNotice, setWithdrawnNotice] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [serverError, setServerError] = useState<{ id: string; message: string } | null>(null);
  const [triedSubmit, setTriedSubmit] = useState(false);
  const [editing, setEditing] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [descOpen, setDescOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/forms/${encodeURIComponent(formId)}`, { cache: 'no-store' });
      const json = await res.json();
      if (json?.status !== 'success') {
        setLoadError(json?.message || 'ไม่พบแบบฟอร์มนี้');
        return;
      }
      setData(json);
      setAnswers(json.myResponse?.answers || {});
      setPdpaAccepted(Boolean(json.myResponse?.pdpaConsent?.accepted));
      setMarketingAccepted(Boolean(json.myResponse?.pdpaConsent?.marketingAccepted));
    } catch {
      setLoadError('โหลดแบบฟอร์มไม่สำเร็จ');
    }
  }, [formId]);

  // Wait for the session so the API sees the cookie and returns the viewer's own answer
  useEffect(() => {
    if (sessionStatus === 'loading') return;
    void load();
  }, [load, sessionStatus]);

  const form = data?.form;
  const pdpa = useMemo(() => getFormPdpa(form), [form]);
  const answered = Boolean(data?.myResponse);
  const isPublic = data?.accessMode === 'public';
  const blocked = data?.canRespond === false && !answered;
  const canEdit = Boolean(form?.allowEditResponse && data?.isAcceptingResponses && data?.canRespond !== false);
  const showForm = Boolean(data?.isAcceptingResponses && !blocked && (!answered || editing));
  const fontFamily = useFormFont(form?.fontFamily);

  const logic = useMemo(
    () => (form ? evaluateFormLogic(form, answers, { optionCounts: data?.optionCounts }) : null),
    [form, answers, data?.optionCounts],
  );

  const progress = useMemo(() => {
    if (!form || !logic) return { done: 0, total: 0, incomplete: [] as string[] };
    const incomplete = logic.visibleQuestions
      .filter(
        (q) =>
          !isQuestionComplete(q, answers, {
            required: logic.requiredQuestionIds.has(q.id),
            visibleOptions: logic.visibleOptionsByQuestion.get(q.id),
          }),
      )
      .map((q) => q.id);
    const done = logic.visibleQuestions.filter((q) => !isAnswerEmpty(answers[q.id])).length;
    return { done, total: logic.visibleQuestions.length, incomplete };
  }, [form, logic, answers]);

  const setAnswer = (id: string, v: FormAnswers[string] | undefined) => {
    setAnswers((a) => {
      const next = { ...a };
      if (v === undefined) delete next[id];
      else next[id] = v;
      return form ? pruneHiddenOptionSelections(form, next, data?.optionCounts) : next;
    });
    if (serverError?.id && (id === serverError.id || id === otherAnswerKey(serverError.id))) setServerError(null);
  };

  const scrollTo = (elId: string) => {
    const el = document.getElementById(elId);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el?.focus({ preventScroll: true });
  };

  const pdpaMissing = pdpa.enabled && pdpa.requireConsent && !pdpaAccepted;

  const submit = async () => {
    if (!form || !logic) return;
    setTriedSubmit(true);
    setSubmitError('');
    setWithdrawnNotice('');
    if (progress.incomplete.length) {
      scrollTo(`q-${progress.incomplete[0]}`);
      return;
    }
    if (pdpaMissing) {
      scrollTo('pdpa-consent');
      return;
    }

    // Only submit answers for currently visible questions
    const visibleAnswers: FormAnswers = {};
    for (const q of logic.visibleQuestions) {
      if (answers[q.id] !== undefined) visibleAnswers[q.id] = answers[q.id];
      const oKey = otherAnswerKey(q.id);
      if (answers[oKey] !== undefined) visibleAnswers[oKey] = answers[oKey];
      for (const opt of q.options || []) {
        const dKey = optionDetailAnswerKey(q.id, opt.id);
        if (answers[dKey] !== undefined) visibleAnswers[dKey] = answers[dKey];
      }
    }

    setSubmitting(true);
    setServerError(null);
    try {
      const res = await apiFetch(`/api/forms/${encodeURIComponent(form.id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: visibleAnswers,
          pdpaConsent: pdpa.enabled ? { accepted: pdpaAccepted, marketingAccepted } : undefined,
        }),
      });
      const json = await res.json();
      if (json?.status !== 'success') {
        const message = json?.message || 'ส่งคำตอบไม่สำเร็จ';
        if (json?.questionId) {
          setServerError({ id: json.questionId, message });
          scrollTo(`q-${json.questionId}`);
        } else if (json?.code === 'PDPA_CONSENT_REQUIRED') {
          scrollTo('pdpa-consent');
          setSubmitError(message);
        } else {
          setSubmitError(message);
        }
        if (res.status === 409 || res.status === 403) void load();
        return;
      }
      const now = new Date().toISOString();
      setData((d) =>
        d && {
          ...d,
          myResponse: {
            answers: visibleAnswers,
            pdpaConsent: json.pdpaConsent ?? d.myResponse?.pdpaConsent ?? null,
            submittedAt: d.myResponse?.submittedAt || now,
            updatedAt: now,
          },
          summary: json.summary ?? d.summary,
          optionCounts: json.optionCounts ?? d.optionCounts,
        },
      );
      setAnswers(visibleAnswers);
      setEditing(false);
      setTriedSubmit(false);
      setJustSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setSubmitError('ส่งคำตอบไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่');
    } finally {
      setSubmitting(false);
    }
  };

  const withdrawConsent = async () => {
    if (!form) return;
    setWithdrawing(true);
    try {
      const res = await apiFetch(`/api/forms/${encodeURIComponent(form.id)}`, { method: 'DELETE' });
      const json = await res.json();
      if (json?.status === 'success') {
        setConfirmWithdraw(false);
        setJustSubmitted(false);
        setEditing(false);
        setAnswers({});
        setPdpaAccepted(false);
        setMarketingAccepted(false);
        setWithdrawnNotice(json?.message || 'ถอนความยินยอมและลบข้อมูลคำตอบของท่านเรียบร้อยแล้ว');
        await load();
      } else {
        setSubmitError(json?.message || 'ดำเนินการไม่สำเร็จ');
      }
    } catch {
      setSubmitError('ดำเนินการไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setWithdrawing(false);
    }
  };

  // Login-mode forms: reuse the site's login screen (returns here after sign-in). Public forms skip it.
  if (data?.isAcceptingResponses && !isPublic && (sessionStatus === 'unauthenticated' || data.canRespond === null)) {
    return <LoginScreen />;
  }

  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
  const visibleQuestions = logic?.visibleQuestions || [];
  const requiredCount = visibleQuestions.filter((q) => logic?.requiredQuestionIds.has(q.id)).length;
  const pdpaLocked = Boolean(pdpa.enabled && pdpa.requireConsent && !pdpaAccepted);
  const longDescription = (form?.description?.length || 0) > 220;

  return (
    <div className={cn('min-h-screen bg-background text-foreground', showForm && !pdpaLocked ? 'pb-36 md:pb-28' : 'pb-28')}>
      <StorefrontNavbar />
      <main className="mx-auto w-full max-w-[680px] px-3 pt-3 pb-10 sm:px-4 md:pt-8" style={{ fontFamily }}>
        <Link href="/forms" className="mb-2 -ml-1 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[0.85rem] font-semibold text-primary hover:bg-primary/10 sm:mb-4">
          <ArrowLeft size={16} /> แบบสำรวจทั้งหมด
        </Link>

        {loadError && (
          <div className="flex items-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-[0.9rem] text-destructive">
            <AlertCircle size={18} /> {loadError}
          </div>
        )}

        {!data && !loadError && (
          <div className="flex flex-col gap-3">
            {[150, 180, 180].map((h, i) => <div key={i} className="animate-pulse rounded-2xl bg-muted" style={{ height: h }} />)}
          </div>
        )}

        {form && data && (
          <>
            {/* Header */}
            <header className="relative mb-4 overflow-hidden rounded-2xl border border-border bg-card">
              <FormBannerView banner={form.banner} title={form.title} />
              <div className="p-4 sm:p-7">
                <h1 className="text-[1.25rem] leading-snug font-extrabold break-words sm:text-[1.6rem]">{form.title}</h1>
                {form.description && (
                  <>
                    <p className={cn('mt-2 text-[0.92rem] leading-relaxed whitespace-pre-wrap break-words text-muted-foreground', longDescription && !descOpen && 'line-clamp-4 sm:line-clamp-none')}>
                      {form.description}
                    </p>
                    {longDescription && (
                      <button type="button" onClick={() => setDescOpen((v) => !v)} className="mt-1 text-[0.82rem] font-semibold text-primary sm:hidden">
                        {descOpen ? 'ย่อ' : 'อ่านต่อ'}
                      </button>
                    )}
                  </>
                )}
                {/* Phones: one swipeable row of chips instead of three wrapped lines */}
                <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-0.5 text-[0.75rem] font-semibold [scrollbar-width:none] sm:mx-0 sm:mt-4 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden [&>span]:shrink-0 [&>span]:whitespace-nowrap">
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-muted-foreground"><ListChecks size={13} /> {visibleQuestions.length} คำถาม{requiredCount ? ` · บังคับ ${requiredCount}` : ''}</span>
                  {form.closesAt && data.isAcceptingResponses && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-muted-foreground"><CalendarClock size={13} /> ปิด {formatDate(form.closesAt)}</span>
                  )}
                  {data.isAcceptingResponses ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-1 text-success"><span className="size-1.5 rounded-full bg-success" /> เปิดรับคำตอบ</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-muted-foreground"><Lock size={12} /> ปิดรับคำตอบแล้ว</span>
                  )}
                  {isPublic ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-muted-foreground"><Globe size={12} /> ไม่ต้องเข้าสู่ระบบ · ไม่ระบุตัวตน</span>
                  ) : data.accessNote ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-primary"><AtSign size={12} /> {data.accessNote}</span>
                  ) : null}
                  {pdpa.enabled && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-muted-foreground"><ShieldCheck size={12} className="text-primary" /> มีข้อตกลง PDPA</span>
                  )}
                </div>
                {showForm && (
                  <p className="mt-3 text-[0.75rem] text-muted-foreground sm:mt-4">
                    <span className="text-destructive">*</span> = จำเป็นต้องตอบ · {isPublic ? 'ตอบได้ 1 ครั้งต่ออุปกรณ์' : `ตอบในนาม ${data.viewerEmail || 'บัญชีของคุณ'} · ตอบได้ 1 ครั้งต่อบัญชี`}
                  </p>
                )}
              </div>
            </header>

            {withdrawnNotice && (
              <div className="mb-4 flex items-center gap-2 rounded-2xl border border-border bg-card p-4 text-[0.88rem] text-foreground">
                <CheckCircle2 size={18} className="shrink-0 text-success" />
                <span>{withdrawnNotice}</span>
              </div>
            )}

            {blocked && data.isAcceptingResponses && (
              <div className="mb-4 rounded-2xl border border-warning/40 bg-warning/10 p-5">
                <div className="flex items-start gap-2.5">
                  <ShieldAlert size={20} className="mt-0.5 shrink-0 text-warning" />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">บัญชีนี้ไม่มีสิทธิ์ตอบแบบฟอร์มนี้</p>
                    <p className="mt-1 text-[0.85rem] break-words text-muted-foreground">
                      คุณเข้าสู่ระบบด้วย <b className="text-foreground">{data.viewerEmail}</b> แต่แบบฟอร์มนี้รับ{data.accessNote || 'เฉพาะผู้ที่ได้รับเชิญ'}
                    </p>
                    <Button variant="outline" size="sm" className="mt-3 rounded-xl" onClick={() => void signOut({ callbackUrl: window.location.href })}>
                      <LogOut size={14} /> ออกจากระบบและเปลี่ยนบัญชี
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {answered && !editing && (
              <div className={cn('mb-4 rounded-2xl border p-4 sm:p-5', justSubmitted ? 'border-success/40 bg-success/10' : 'border-border bg-card')}>
                <div className="flex flex-wrap items-center gap-2.5">
                  <CheckCircle2 size={20} className="shrink-0 text-success" />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{justSubmitted ? 'ส่งคำตอบเรียบร้อย ขอบคุณที่ร่วมตอบ!' : 'คุณตอบแบบฟอร์มนี้แล้ว'}</p>
                    {data.myResponse?.updatedAt && <p className="text-[0.8rem] text-muted-foreground">เมื่อ {formatDate(data.myResponse.updatedAt)}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {canEdit && (
                      <Button variant="outline" size="sm" className="rounded-xl" onClick={() => { setEditing(true); setJustSubmitted(false); }}>
                        <Pencil size={14} /> แก้ไขคำตอบ
                      </Button>
                    )}
                    {pdpa.enabled && pdpa.allowWithdrawConsent && !confirmWithdraw && (
                      <Button variant="ghost" size="sm" className="rounded-xl text-muted-foreground hover:text-destructive" onClick={() => setConfirmWithdraw(true)}>
                        <Trash2 size={14} /> ถอนความยินยอมและลบคำตอบ
                      </Button>
                    )}
                  </div>
                </div>

                {data.myResponse?.pdpaConsent?.accepted && (
                  <p className="mt-2.5 border-t border-border/60 pt-2.5 text-[0.75rem] text-muted-foreground">
                    บันทึกความยินยอม PDPA (v{data.myResponse.pdpaConsent.policyVersion}) เมื่อ {formatDate(data.myResponse.pdpaConsent.acceptedAt)}
                    {data.myResponse.pdpaConsent.expiresAt ? ` · เก็บรักษาถึง ${formatDate(data.myResponse.pdpaConsent.expiresAt)}` : ''}
                  </p>
                )}

                {confirmWithdraw && (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-[0.82rem]">
                    <span className="text-foreground">ยืนยันการถอนความยินยอม PDPA และลบคำตอบของท่านออกจากระบบ?</span>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setConfirmWithdraw(false)} disabled={withdrawing}>ยกเลิก</Button>
                      <Button size="sm" variant="destructive" onClick={() => void withdrawConsent()} disabled={withdrawing}>
                        {withdrawing ? <Loader2 size={14} className="animate-spin" /> : null} ยืนยันลบคำตอบ
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {showForm && (
              <>
                {pdpa.enabled && (
                  <div className="mb-3">
                    <FormPdpaConsentBox
                      pdpa={pdpa}
                      formTitle={form.title}
                      accepted={pdpaAccepted}
                      onAcceptedChange={setPdpaAccepted}
                      marketingAccepted={marketingAccepted}
                      onMarketingAcceptedChange={setMarketingAccepted}
                      disabled={submitting}
                      missing={triedSubmit && pdpaMissing}
                      lockedQuestionCount={visibleQuestions.length}
                    />
                  </div>
                )}

                {!pdpaLocked && (
                  <>
                    {/* Sticky progress (desktop — phones get the bottom action bar) */}
                    <div className="sticky top-[64px] z-20 -mx-4 mb-3 hidden bg-background/85 px-4 py-2 backdrop-blur-md md:block">
                      <div className="flex items-center gap-3">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[0.75rem] font-semibold tabular-nums text-muted-foreground">ตอบแล้ว {progress.done}/{progress.total}</span>
                      </div>
                    </div>

                    <form id="form-answer" onSubmit={(e) => { e.preventDefault(); void submit(); }} className="flex flex-col gap-3" noValidate>
                      {visibleQuestions.map((q, idx) => (
                        <FormQuestionField
                          key={q.id}
                          q={q}
                          index={idx}
                          required={logic?.requiredQuestionIds.has(q.id)}
                          visibleOptions={logic?.visibleOptionsByQuestion.get(q.id)}
                          disabledOptionIds={logic?.disabledOptionIdsByQuestion.get(q.id)}
                          fullQuotaOptionIds={logic?.fullQuotaOptionIdsByQuestion.get(q.id)}
                          optionCounts={data.optionCounts?.[q.id]}
                          value={answers[q.id]}
                          otherText={typeof answers[otherAnswerKey(q.id)] === 'string' ? (answers[otherAnswerKey(q.id)] as string) : ''}
                          allAnswers={answers}
                          onChange={(v) => setAnswer(q.id, v)}
                          onOtherChange={(t) => setAnswer(otherAnswerKey(q.id), t || undefined)}
                          onDetailChange={(optId, t) => setAnswer(optionDetailAnswerKey(q.id, optId), t || undefined)}
                          disabled={submitting}
                          missing={triedSubmit && progress.incomplete.includes(q.id)}
                          errorMessage={serverError?.id === q.id ? serverError.message : undefined}
                        />
                      ))}

                      {logic?.endedEarly && (
                        <div className="flex items-start gap-2.5 rounded-2xl border border-border bg-muted/40 p-4 text-[0.86rem] text-muted-foreground">
                          <Info size={18} className="mt-0.5 shrink-0 text-primary" />
                          <span>{logic.endNotice || 'สิ้นสุดคำถามตามตัวเลือกที่ท่านเลือก กรุณาตรวจสอบข้อมูลและกดส่งคำตอบด้านล่าง'}</span>
                        </div>
                      )}

                      {submitError && (
                        <div className="flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-[0.85rem] text-destructive">
                          <AlertCircle size={16} /> {submitError}
                        </div>
                      )}

                      <div className="mt-2 hidden flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4 md:flex">
                        <Button type="submit" disabled={submitting} className="h-11 rounded-xl px-6 text-[0.95rem] font-bold">
                          {submitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={16} />}
                          {editing ? 'บันทึกคำตอบใหม่' : 'ส่งคำตอบ'}
                        </Button>
                        {editing && (
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-11 rounded-xl"
                            onClick={() => {
                              setEditing(false);
                              setTriedSubmit(false);
                              setAnswers(data.myResponse?.answers || {});
                              setPdpaAccepted(Boolean(data.myResponse?.pdpaConsent?.accepted));
                              setMarketingAccepted(Boolean(data.myResponse?.pdpaConsent?.marketingAccepted));
                            }}
                          >
                            ยกเลิก
                          </Button>
                        )}
                        <span className={cn('text-[0.82rem]', triedSubmit && (progress.incomplete.length || pdpaMissing) ? 'font-semibold text-destructive' : 'text-muted-foreground')}>
                          {progress.incomplete.length
                            ? `ยังเหลือ ${progress.incomplete.length} ข้อที่ต้องตอบ`
                            : pdpaMissing
                              ? 'กรุณายืนยันความยินยอม PDPA'
                              : 'ตอบครบแล้ว พร้อมส่ง'}
                        </span>
                      </div>
                    </form>
                  </>
                )}
              </>
            )}

            {!showForm && data.summary && (
              <section className="mt-2">
                <h2 className="mb-3 flex items-center gap-2 text-[1.05rem] font-extrabold"><Users size={18} className="text-primary" /> ผลลัพธ์</h2>
                <FormResults form={form} summary={data.summary} myAnswers={data.myResponse?.answers} final={!data.isAcceptingResponses} />
              </section>
            )}

            {!showForm && !data.summary && answered && (
              <p className="text-[0.9rem] text-muted-foreground">ผู้ดูแลยังไม่เปิดให้ดูผลลัพธ์</p>
            )}

            {!data.loggedIn && !data.isAcceptingResponses && (
              <Link href="/" className="mt-3 inline-flex items-center gap-1.5 text-[0.9rem] font-semibold text-primary"><LogIn size={16} /> เข้าสู่ระบบ</Link>
            )}
          </>
        )}
      </main>

      {/* Phones: answering mode — the site nav steps aside for a progress + submit bar */}
      {showForm && !pdpaLocked && form && (
        <div className="fixed inset-x-0 bottom-0 z-[1101] border-t border-border bg-background/95 backdrop-blur-md md:hidden" style={{ fontFamily }}>
          <div className="h-1 bg-muted">
            <div className="h-full bg-primary transition-[width] duration-300" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex items-center gap-2 px-3 pt-2.5 pb-[max(env(safe-area-inset-bottom),10px)]">
            <div className="min-w-0 flex-1">
              <p className="text-[0.8rem] font-bold tabular-nums">ตอบแล้ว {progress.done}/{progress.total}</p>
              {progress.incomplete.length ? (
                <button
                  type="button"
                  onClick={() => scrollTo(`q-${progress.incomplete[0]}`)}
                  className={cn('text-left text-[0.74rem] font-semibold underline-offset-2 active:underline', triedSubmit ? 'text-destructive' : 'text-primary')}
                >
                  ไปข้อที่ยังไม่ตอบ ({progress.incomplete.length}) ↓
                </button>
              ) : (
                <p className={cn('text-[0.74rem]', pdpaMissing && triedSubmit ? 'font-semibold text-destructive' : 'text-success')}>
                  {pdpaMissing ? 'กรุณายืนยันความยินยอม PDPA' : 'ตอบครบแล้ว พร้อมส่ง'}
                </p>
              )}
            </div>
            {editing && (
              <Button
                type="button"
                variant="ghost"
                className="h-11 rounded-xl px-3"
                onClick={() => {
                  setEditing(false);
                  setTriedSubmit(false);
                  setAnswers(data?.myResponse?.answers || {});
                  setPdpaAccepted(Boolean(data?.myResponse?.pdpaConsent?.accepted));
                  setMarketingAccepted(Boolean(data?.myResponse?.pdpaConsent?.marketingAccepted));
                }}
              >
                ยกเลิก
              </Button>
            )}
            <Button type="submit" form="form-answer" disabled={submitting} className="h-11 shrink-0 rounded-xl px-5 text-[0.95rem] font-bold">
              {submitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={16} />}
              {editing ? 'บันทึก' : 'ส่งคำตอบ'}
            </Button>
          </div>
        </div>
      )}

      <MobileBottomNav hidden={showForm && !pdpaLocked} />
    </div>
  );
}
