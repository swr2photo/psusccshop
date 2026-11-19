'use client';

// Redesigned Admin Form Results, AI Insights, and Respondents workspace.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Crown,
  Download,
  Eye,
  LayoutGrid,
  List,
  Loader2,
  MessageSquareText,
  Radio,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Table2,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import FormResults from '@/components/forms/FormResults';
import { FormBannerThumb } from '@/components/forms/FormBanner';
import FormAiInsightsCard from '@/components/admin/forms/FormAiInsightsCard';
import {
  CHOICE_QUESTION_TYPES,
  formatAnswer,
  getFormPdpa,
  isAnonymousRespondent,
  isFormAcceptingResponses,
  otherAnswerKey,
  type FormDefinition,
  type FormQuestion,
  type FormResponse,
  type FormSummary,
} from '@/lib/forms';
import type { FormAiAnalysis } from '@/lib/form-ai-types';

type Toast = (type: 'success' | 'error' | 'info' | 'warning', message: string) => void;
type AdminResponse = FormResponse & { respondentId: string };
type TabKey = 'summary' | 'ai' | 'respondents';
type ViewMode = 'cards' | 'table';

const PAGE_SIZE = 20;

const NOISE_TEXT_RE = /^[-–—._/\\*•\s]+$/;

function hasMeaningfulText(val: string): boolean {
  const s = val.trim();
  if (s.length < 2) return false;
  if (NOISE_TEXT_RE.test(s)) return false;
  if (/^(ไม่มี|ไม่มีครับ|ไม่มีค่ะ|ไม่|none|n\/a|na|-)$/i.test(s)) return false;
  return true;
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

export default function FormResultsDashboard({
  formId,
  onBack,
  showToast,
}: {
  formId: string;
  onBack: () => void;
  showToast: Toast;
}) {
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const [data, setData] = useState<{ form: FormDefinition; responses: AdminResponse[]; summary: FormSummary } | null>(null);
  const [tab, setTab] = useState<TabKey>('summary');
  const [loading, setLoading] = useState(true);

  // AI state
  const [aiAnalysis, setAiAnalysis] = useState<FormAiAnalysis | null>(null);
  const [aiLoadingInitial, setAiLoadingInitial] = useState(true);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  // Respondents filters & view state
  const [searchQuery, setSearchQuery] = useState('');
  const [choiceFilterOptionId, setChoiceFilterOptionId] = useState<string>('ALL');
  const [onlyWithComments, setOnlyWithComments] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [page, setPage] = useState(1);
  const [showAllRows, setShowAllRows] = useState(false);
  const [inspectingResponse, setInspectingResponse] = useState<AdminResponse | null>(null);

  const load = useCallback(async () => {
    const res = await apiFetch(`/api/admin/forms/${encodeURIComponent(formId)}`, { cache: 'no-store' });
    const json = await readJson(res);
    setLoading(false);
    if (json?.status === 'success') setData(json);
    else showToast('error', json?.message || 'โหลดคำตอบไม่สำเร็จ');
  }, [formId, showToast]);

  const loadCachedAi = useCallback(async () => {
    setAiLoadingInitial(true);
    try {
      const res = await apiFetch(`/api/admin/forms/${encodeURIComponent(formId)}/ai-summary`, { cache: 'no-store' });
      const json = await readJson(res);
      if (json?.status === 'success') {
        setAiAnalysis(json.analysis || null);
        if (typeof json.aiEnabled === 'boolean') setAiEnabled(json.aiEnabled);
      }
    } finally {
      setAiLoadingInitial(false);
    }
  }, [formId]);

  useEffect(() => {
    const t = setTimeout(() => {
      void load();
      void loadCachedAi();
    }, 0);
    return () => clearTimeout(t);
  }, [load, loadCachedAi]);

  const runAiAnalysis = useCallback(async (jumpToAiTab = false) => {
    if (analyzing) return;
    if (jumpToAiTab) setTab('ai');
    setAnalyzing(true);
    try {
      const res = await apiFetch(`/api/admin/forms/${encodeURIComponent(formId)}/ai-summary`, {
        method: 'POST',
        cache: 'no-store',
      });
      const json = await readJson(res);
      if (json?.status === 'success' && json.analysis) {
        setAiAnalysis(json.analysis as FormAiAnalysis);
        showToast('success', 'วิเคราะห์และจัดระเบียบความคิดเห็นด้วย AI เรียบร้อยแล้ว');
      } else {
        showToast('error', json?.message || 'วิเคราะห์ด้วย AI ไม่สำเร็จ');
      }
    } catch {
      showToast('error', 'เชื่อมต่อ AI ไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setAnalyzing(false);
    }
  }, [analyzing, formId, showToast]);

  const answerText = useCallback(
    (q: FormQuestion, r: AdminResponse) =>
      formatAnswer(q, r.answers?.[q.id], r.answers?.[otherAnswerKey(q.id)], r.answers),
    [],
  );

  const hasPdpaData = Boolean(
    data && (getFormPdpa(data.form).enabled || data.responses.some((r) => Boolean(r.pdpaConsent))),
  );

  // Derived analytics for KPI strip & filters
  const analytics = useMemo(() => {
    if (!data) return null;
    const { form, responses, summary } = data;
    const textQuestions = form.questions.filter((q) => q.type === 'short_text' || q.type === 'long_text');
    const primaryChoiceQ = form.questions.find((q) => q.type === 'single_choice' || q.type === 'dropdown') || null;

    let totalMeaningfulComments = 0;
    let respondentsWithComment = 0;
    let latestSubmittedAt: string | null = null;

    for (const r of responses) {
      const ts = r.updatedAt || r.submittedAt;
      if (ts && (!latestSubmittedAt || ts > latestSubmittedAt)) latestSubmittedAt = ts;
      let wroteAny = false;
      for (const tq of textQuestions) {
        const txt = String(r.answers?.[tq.id] ?? '').trim();
        if (hasMeaningfulText(txt)) {
          totalMeaningfulComments += 1;
          wroteAny = true;
        }
      }
      if (wroteAny) respondentsWithComment += 1;
    }

    // Primary choice question leader & option counts
    let leader: { label: string; count: number; pct: number } | null = null;
    const primaryChoiceOptions: Array<{ id: string; label: string; count: number }> = [];
    if (primaryChoiceQ) {
      const qs = summary.questions.find((x) => x.questionId === primaryChoiceQ.id);
      const totalVotes = (primaryChoiceQ.options || []).reduce((acc, o) => acc + (qs?.counts?.[o.id] || 0), 0);
      for (const o of primaryChoiceQ.options || []) {
        const count = qs?.counts?.[o.id] || 0;
        primaryChoiceOptions.push({ id: o.id, label: o.label, count });
        if (!leader || count > leader.count) {
          leader = {
            label: o.label,
            count,
            pct: totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0,
          };
        }
      }
    }

    return {
      textQuestions,
      primaryChoiceQ,
      primaryChoiceOptions,
      totalMeaningfulComments,
      respondentsWithComment,
      latestSubmittedAt,
      leader,
    };
  }, [data]);

  // Filtered respondents list
  const filteredResponses = useMemo(() => {
    if (!data) return [];
    const q = searchQuery.trim().toLowerCase();
    const primaryQ = analytics?.primaryChoiceQ;
    const textQuestions = analytics?.textQuestions || [];

    return data.responses.filter((r) => {
      if (primaryQ && choiceFilterOptionId !== 'ALL') {
        const val = r.answers?.[primaryQ.id];
        if (String(val ?? '') !== choiceFilterOptionId) return false;
      }

      if (onlyWithComments) {
        const hasAny = textQuestions.some((tq) => hasMeaningfulText(String(r.answers?.[tq.id] ?? '')));
        if (!hasAny) return false;
      }

      if (!q) return true;
      const hayParts = [
        isAnonymousRespondent(r.email) ? 'ไม่ระบุตัวตน' : `${r.name || ''} ${r.email || ''}`,
        ...data.form.questions.map((question) => answerText(question, r)),
      ];
      return hayParts.join(' ').toLowerCase().includes(q);
    });
  }, [data, analytics, searchQuery, choiceFilterOptionId, onlyWithComments, answerText]);

  const totalPages = Math.max(1, Math.ceil(filteredResponses.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedResponses = useMemo(() => {
    if (showAllRows) return filteredResponses;
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredResponses.slice(start, start + PAGE_SIZE);
  }, [filteredResponses, showAllRows, safePage]);

  const exportCsv = () => {
    if (!data) return;
    const esc = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const pdpaCols = hasPdpaData
      ? ['สถานะ PDPA', 'เวลาที่ยินยอม PDPA', 'เวอร์ชัน PDPA', 'ยินยอมข่าวสารเพิ่มเติม', 'วันหมดอายุข้อมูล']
      : [];
    const header = ['เวลา', 'ชื่อ', 'อีเมล', ...pdpaCols, ...data.form.questions.map((q) => q.title)];
    const rows = data.responses.map((r) => {
      const pdpaVals = hasPdpaData
        ? [
            r.pdpaConsent?.accepted ? 'ยินยอม' : '-',
            r.pdpaConsent?.acceptedAt ? formatDate(r.pdpaConsent.acceptedAt) : '-',
            r.pdpaConsent?.policyVersion || '-',
            r.pdpaConsent?.marketingAccepted === undefined ? '-' : r.pdpaConsent.marketingAccepted ? 'ยินยอม' : 'ไม่ยินยอม',
            r.pdpaConsent?.expiresAt ? formatDate(r.pdpaConsent.expiresAt) : 'ไม่กำหนด',
          ]
        : [];
      return [
        formatDate(r.updatedAt || r.submittedAt),
        isAnonymousRespondent(r.email) ? 'ไม่ระบุตัวตน' : r.name || '',
        isAnonymousRespondent(r.email) ? '' : r.email,
        ...pdpaVals,
        ...data.form.questions.map((q) => answerText(q, r)),
      ];
    });
    const csv = '\uFEFF' + [header, ...rows].map((row) => row.map(esc).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.form.title.replace(/[\\/:*?"<>|]+/g, '_').slice(0, 60) || 'form'}-responses.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const removeResponse = async (r: AdminResponse) => {
    const ok = await confirm({
      title: 'ลบคำตอบนี้?',
      message: `คำตอบของ ${isAnonymousRespondent(r.email) ? 'ผู้ตอบไม่ระบุตัวตน' : r.name || r.email} จะถูกลบถาวร และผู้ตอบจะตอบใหม่ได้`,
      destructive: true,
      confirmText: 'ลบ',
    });
    if (!ok) return;
    const res = await apiFetch(`/api/admin/forms/${encodeURIComponent(formId)}?r=${encodeURIComponent(r.respondentId)}`, {
      method: 'DELETE',
    });
    const json = await readJson(res);
    if (json?.status === 'success') {
      if (inspectingResponse?.respondentId === r.respondentId) setInspectingResponse(null);
      showToast('success', 'ลบคำตอบแล้ว');
      void load();
    } else {
      showToast('error', json?.message || 'ลบไม่สำเร็จ');
    }
  };

  const isAccepting = data ? isFormAcceptingResponses(data.form) : false;

  return (
    <div className="mx-auto max-w-[1160px]">
      <ConfirmDialog />

      {/* Top action bar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2.5">
        <Button variant="ghost" onClick={onBack} className="-ml-2 gap-1.5">
          <ArrowLeft size={16} /> กลับรายการแบบฟอร์ม
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setLoading(true); void load(); }}
            disabled={loading}
            className="gap-1.5"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            รีเฟรช
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!data?.responses.length} className="gap-1.5">
            <Download size={14} /> ส่งออก CSV
          </Button>
          <Button
            size="sm"
            onClick={() => void runAiAnalysis(true)}
            disabled={analyzing || !data?.responses.length || !aiEnabled}
            className="gap-1.5 font-semibold"
          >
            {analyzing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {aiAnalysis ? 'วิเคราะห์ AI ใหม่' : 'วิเคราะห์ด้วย AI'}
          </Button>
        </div>
      </div>

      {!data ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-card py-20 text-muted-foreground">
          <Loader2 className="animate-spin text-primary" />
          <p className="text-sm">กำลังโหลดข้อมูลแบบสำรวจ...</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Form identity header card */}
          <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
            <FormBannerThumb banner={data.form.banner} className="h-14 w-24 shrink-0 sm:h-16 sm:w-28" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg leading-snug font-extrabold break-words text-foreground sm:text-xl">
                  {data.form.title}
                </h2>
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[0.72rem] font-bold',
                    isAccepting ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-400' : 'bg-muted text-muted-foreground',
                  )}
                >
                  {isAccepting ? <Radio size={11} className="animate-pulse" /> : <Check size={11} strokeWidth={3} />}
                  {isAccepting ? 'กำลังเปิดรับคำตอบ' : 'ปิดรับคำตอบแล้ว'}
                </span>
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                <span>ผู้ตอบทั้งหมด {data.responses.length.toLocaleString('th-TH')} คน</span>
                <span>·</span>
                <span>{data.form.questions.length} คำถาม</span>
                {analytics?.latestSubmittedAt && (
                  <>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock size={12} /> ล่าสุด {formatDate(analytics.latestSubmittedAt)}
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* 4 KPI Stat Cards */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                <span>ผู้ตอบทั้งหมด</span>
                <Users size={15} className="text-primary" />
              </div>
              <p className="mt-2 text-2xl font-black tracking-tight text-foreground tabular-nums">
                {data.responses.length.toLocaleString('th-TH')}
                <span className="ml-1 text-sm font-semibold text-muted-foreground">คน</span>
              </p>
              <p className="mt-0.5 truncate text-[0.72rem] text-muted-foreground">
                {analytics?.latestSubmittedAt ? `อัปเดต ${formatDate(analytics.latestSubmittedAt)}` : 'ยังไม่มีผู้ตอบ'}
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                <span>ความคิดเห็นข้อความ</span>
                <MessageSquareText size={15} className="text-primary" />
              </div>
              <p className="mt-2 text-2xl font-black tracking-tight text-foreground tabular-nums">
                {(analytics?.totalMeaningfulComments ?? 0).toLocaleString('th-TH')}
                <span className="ml-1 text-sm font-semibold text-muted-foreground">ข้อความ</span>
              </p>
              <p className="mt-0.5 truncate text-[0.72rem] text-muted-foreground">
                จาก {(analytics?.respondentsWithComment ?? 0).toLocaleString('th-TH')} คน (
                {data.responses.length > 0
                  ? Math.round(((analytics?.respondentsWithComment ?? 0) / data.responses.length) * 100)
                  : 0}
                %)
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                <span>{hasPdpaData ? 'ความยินยอม PDPA' : 'จำนวนคำถาม'}</span>
                <ShieldCheck size={15} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              {hasPdpaData ? (
                <>
                  <p className="mt-2 text-2xl font-black tracking-tight text-foreground tabular-nums">
                    {(data.summary.pdpaAcceptedCount ?? 0).toLocaleString('th-TH')}
                    <span className="ml-1 text-sm font-semibold text-muted-foreground">
                      / {data.responses.length.toLocaleString('th-TH')}
                    </span>
                  </p>
                  <p className="mt-0.5 truncate text-[0.72rem] text-muted-foreground">
                    ยินยอมแล้ว{' '}
                    {data.responses.length > 0
                      ? Math.round(((data.summary.pdpaAcceptedCount ?? 0) / data.responses.length) * 100)
                      : 0}
                    %
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-2 text-2xl font-black tracking-tight text-foreground tabular-nums">
                    {data.form.questions.length}
                    <span className="ml-1 text-sm font-semibold text-muted-foreground">ข้อ</span>
                  </p>
                  <p className="mt-0.5 truncate text-[0.72rem] text-muted-foreground">
                    คำถามข้อความ {analytics?.textQuestions.length ?? 0} ข้อ
                  </p>
                </>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                <span>ผลโหวตนำหลัก</span>
                <Crown size={15} className="text-amber-500" />
              </div>
              {analytics?.leader && analytics.leader.count > 0 ? (
                <>
                  <p className="mt-2 text-2xl font-black tracking-tight text-foreground tabular-nums">
                    {analytics.leader.pct}%
                    <span className="ml-1.5 text-sm font-semibold text-muted-foreground">
                      ({analytics.leader.count} เสียง)
                    </span>
                  </p>
                  <p className="mt-0.5 truncate text-[0.74rem] font-medium text-foreground/85" title={analytics.leader.label}>
                    {analytics.leader.label}
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-2 text-2xl font-black text-muted-foreground">—</p>
                  <p className="mt-0.5 text-[0.72rem] text-muted-foreground">ไม่มีข้อโหวตแบบเลือกตอบ</p>
                </>
              )}
            </div>
          </div>

          {/* 3-Tab Navigation */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
            <div className="inline-flex flex-wrap gap-1 rounded-xl bg-muted/80 p-1">
              {([
                { key: 'summary' as const, label: 'สรุปผล', icon: BarChart3, badge: null },
                {
                  key: 'ai' as const,
                  label: 'AI วิเคราะห์ความคิดเห็น',
                  icon: Sparkles,
                  badge: aiAnalysis ? `${aiAnalysis.themes.length} กลุ่ม` : null,
                },
                {
                  key: 'respondents' as const,
                  label: 'รายชื่อผู้ตอบ',
                  icon: List,
                  badge: data.responses.length.toLocaleString('th-TH'),
                },
              ]).map((item) => {
                const Icon = item.icon;
                const active = tab === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setTab(item.key)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[0.84rem] font-semibold transition-colors',
                      active
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <Icon size={15} className={cn(item.key === 'ai' && 'text-primary')} />
                    <span>{item.label}</span>
                    {item.badge && (
                      <span
                        className={cn(
                          'rounded-full px-1.5 py-0.2 text-[0.68rem] font-bold tabular-nums',
                          active ? 'bg-primary/12 text-primary' : 'bg-background/70 text-muted-foreground',
                        )}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── TAB 1: SUMMARY ── */}
          {tab === 'summary' && (
            <div className="flex flex-col gap-4">
              {/* Compact AI Executive Preview / CTA strip */}
              {aiAnalysis ? (
                <div className="rounded-2xl border border-primary/25 bg-card p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 text-xs font-bold text-primary">
                        <Sparkles size={14} /> บทสรุปโดย AI ({aiAnalysis.themes.length} ประเด็นสำคัญ · {aiAnalysis.commentCount} ความคิดเห็น)
                      </p>
                      <p className="mt-1.5 text-[0.88rem] leading-relaxed text-foreground">
                        {aiAnalysis.executiveSummary}
                      </p>
                      {aiAnalysis.themes.length > 0 && (
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          {aiAnalysis.themes.slice(0, 5).map((th) => (
                            <span
                              key={th.id}
                              className="rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-[0.72rem] font-medium text-foreground"
                            >
                              {th.title} ({th.count})
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setTab('ai')} className="shrink-0 gap-1">
                      ดูผลวิเคราะห์เต็ม <ArrowRight size={14} />
                    </Button>
                  </div>
                </div>
              ) : (
                data.responses.length > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-primary/35 bg-card px-4 py-3.5 sm:px-5">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Sparkles size={18} className="shrink-0 text-primary" />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-foreground">ให้ AI ช่วยอ่านและจัดระเบียบความคิดเห็นทั้งหมด</p>
                        <p className="text-xs text-muted-foreground">
                          สรุปภาพรวม จัดกลุ่มประเด็นสำคัญ แยกจุดสนับสนุน/ข้อกังวล และร่างรายงานทางการอัตโนมัติ
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => void runAiAnalysis(true)}
                      disabled={analyzing || !aiEnabled}
                      className="shrink-0 gap-1.5 font-semibold"
                    >
                      {analyzing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                      วิเคราะห์ด้วย AI
                    </Button>
                  </div>
                )
              )}

              <FormResults form={data.form} summary={data.summary} showTexts final={!isAccepting} />
            </div>
          )}

          {/* ── TAB 2: AI INSIGHTS ── */}
          {tab === 'ai' && (
            <FormAiInsightsCard
              analysis={aiAnalysis}
              loadingInitial={aiLoadingInitial}
              analyzing={analyzing}
              aiEnabled={aiEnabled}
              currentResponseCount={data.responses.length}
              onRunAnalysis={() => void runAiAnalysis(false)}
              showToast={showToast}
            />
          )}

          {/* ── TAB 3: RESPONDENTS ── */}
          {tab === 'respondents' && (
            <div className="flex flex-col gap-3">
              {data.responses.length === 0 ? (
                <div className="rounded-2xl border border-border bg-card py-14 text-center text-sm text-muted-foreground">
                  ยังไม่มีผู้ตอบแบบสำรวจ
                </div>
              ) : (
                <>
                  {/* Filter & View Toolbar */}
                  <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3.5 sm:p-4">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <div className="relative min-w-[220px] flex-1">
                        <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                          placeholder="ค้นหาชื่อ, อีเมล หรือข้อความในความคิดเห็น..."
                          className="h-9 w-full rounded-xl border border-border bg-background pr-8 pl-9 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                        />
                        {searchQuery && (
                          <button
                            type="button"
                            aria-label="ล้างคำค้นหา"
                            onClick={() => { setSearchQuery(''); setPage(1); }}
                            className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>

                      {analytics && analytics.textQuestions.length > 0 && (
                        <button
                          type="button"
                          onClick={() => { setOnlyWithComments((v) => !v); setPage(1); }}
                          className={cn(
                            'inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-colors',
                            onlyWithComments
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border bg-background text-muted-foreground hover:text-foreground',
                          )}
                        >
                          <MessageSquareText size={14} />
                          มีข้อความแสดงความคิดเห็น ({analytics.respondentsWithComment})
                        </button>
                      )}

                      {/* View mode switcher */}
                      <div className="ml-auto inline-flex rounded-xl border border-border bg-muted/60 p-0.5">
                        <button
                          type="button"
                          onClick={() => setViewMode('cards')}
                          className={cn(
                            'inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors',
                            viewMode === 'cards' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
                          )}
                        >
                          <LayoutGrid size={13} /> การ์ด
                        </button>
                        <button
                          type="button"
                          onClick={() => setViewMode('table')}
                          className={cn(
                            'inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors',
                            viewMode === 'table' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
                          )}
                        >
                          <Table2 size={13} /> ตาราง
                        </button>
                      </div>
                    </div>

                    {/* Primary choice filter pills */}
                    {analytics?.primaryChoiceQ && analytics.primaryChoiceOptions.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-2.5">
                        <span className="mr-1 text-xs font-medium text-muted-foreground">กรองตามคำตอบ:</span>
                        <button
                          type="button"
                          onClick={() => { setChoiceFilterOptionId('ALL'); setPage(1); }}
                          className={cn(
                            'rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors',
                            choiceFilterOptionId === 'ALL'
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border bg-background text-muted-foreground hover:text-foreground',
                          )}
                        >
                          ทั้งหมด ({data.responses.length})
                        </button>
                        {analytics.primaryChoiceOptions.map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => { setChoiceFilterOptionId(opt.id); setPage(1); }}
                            className={cn(
                              'rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors',
                              choiceFilterOptionId === opt.id
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-border bg-background text-muted-foreground hover:text-foreground',
                            )}
                          >
                            {opt.label} ({opt.count})
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Filter results count */}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>
                        แสดง {filteredResponses.length.toLocaleString('th-TH')} จาก {data.responses.length.toLocaleString('th-TH')} รายการ
                      </span>
                      {(searchQuery || choiceFilterOptionId !== 'ALL' || onlyWithComments) && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearchQuery('');
                            setChoiceFilterOptionId('ALL');
                            setOnlyWithComments(false);
                            setPage(1);
                          }}
                          className="font-semibold text-primary hover:underline"
                        >
                          ล้างตัวกรองทั้งหมด
                        </button>
                      )}
                    </div>
                  </div>

                  {filteredResponses.length === 0 ? (
                    <div className="rounded-2xl border border-border bg-card py-12 text-center text-sm text-muted-foreground">
                      ไม่พบรายชื่อผู้ตอบที่ตรงกับเงื่อนไขการค้นหา
                    </div>
                  ) : viewMode === 'cards' ? (
                    /* ── CARD VIEW (Clean, spacious, zero squished columns!) ── */
                    <div className="flex flex-col gap-2.5">
                      {paginatedResponses.map((r, idx) => {
                        const rowNumber = (showAllRows ? 0 : (safePage - 1) * PAGE_SIZE) + idx + 1;
                        const anon = isAnonymousRespondent(r.email);
                        const choiceItems = data.form.questions
                          .filter((q) => CHOICE_QUESTION_TYPES.includes(q.type) || q.type === 'rating' || q.type === 'date')
                          .map((q) => ({ q, val: answerText(q, r) }))
                          .filter((x) => Boolean(x.val));
                        const textItems = data.form.questions
                          .filter((q) => q.type === 'short_text' || q.type === 'long_text')
                          .map((q) => ({ q, val: answerText(q, r) }))
                          .filter((x) => hasMeaningfulText(x.val));

                        return (
                          <article
                            key={r.respondentId}
                            className="rounded-2xl border border-border bg-card p-4 transition-colors hover:border-border/80"
                          >
                            {/* Top respondent header row */}
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                                <span className="font-mono text-xs font-semibold text-muted-foreground tabular-nums">
                                  #{rowNumber}
                                </span>
                                <span className="text-[0.92rem] font-bold text-foreground">
                                  {anon ? 'ไม่ระบุตัวตน' : r.name || '-'}
                                </span>
                                {!anon && r.email && (
                                  <span className="text-xs text-muted-foreground break-all">{r.email}</span>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs text-muted-foreground tabular-nums">
                                  {formatDate(r.updatedAt || r.submittedAt)}
                                </span>
                                {hasPdpaData && r.pdpaConsent?.accepted && (
                                  <span
                                    title={r.pdpaConsent.expiresAt ? `หมดอายุ ${formatDate(r.pdpaConsent.expiresAt)}` : 'ไม่กำหนดหมดอายุ'}
                                    className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2 py-0.5 text-[0.7rem] font-semibold text-emerald-700 dark:text-emerald-400"
                                  >
                                    <ShieldCheck size={11} />
                                    PDPA v{r.pdpaConsent.policyVersion}
                                    {r.pdpaConsent.marketingAccepted ? ' · +ข่าวสาร' : ''}
                                  </span>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label="ลบคำตอบ"
                                  className="size-7 text-muted-foreground hover:text-destructive"
                                  onClick={() => void removeResponse(r)}
                                >
                                  <Trash2 size={14} />
                                </Button>
                              </div>
                            </div>

                            {/* Choice / Rating / Date summary pills */}
                            {choiceItems.length > 0 && (
                              <div className="mt-2.5 flex flex-wrap gap-1.5">
                                {choiceItems.map(({ q, val }) => (
                                  <span
                                    key={q.id}
                                    title={q.title}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/45 px-2.5 py-1 text-xs font-semibold text-foreground"
                                  >
                                    {choiceItems.length > 1 && (
                                      <span className="max-w-[140px] truncate font-normal text-muted-foreground">
                                        {q.title}:
                                      </span>
                                    )}
                                    <span>{val}</span>
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Free-text comments — full width, crisp & readable */}
                            {textItems.length > 0 && (
                              <div className="mt-3 flex flex-col gap-2 border-t border-border/60 pt-3">
                                {textItems.map(({ q, val }) => (
                                  <div key={q.id} className="rounded-xl bg-muted/35 px-3.5 py-2.5">
                                    <p className="text-[0.72rem] font-semibold text-muted-foreground">{q.title}</p>
                                    <p className="mt-1 text-[0.86rem] leading-relaxed whitespace-pre-wrap break-words text-foreground">
                                      {val}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    /* ── COMPACT TABLE VIEW (Numbered Q1/Q2/Q3 headers + legend + click-to-inspect!) ── */
                    <div className="flex flex-col gap-2.5">
                      <div className="rounded-xl border border-border bg-muted/30 px-3.5 py-2.5 text-xs text-muted-foreground">
                        <p className="font-semibold text-foreground">คำอธิบายคอลัมน์คำถาม:</p>
                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                          {data.form.questions.map((q, qi) => (
                            <span key={q.id}>
                              <strong className="text-foreground">Q{qi + 1}:</strong> {q.title}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
                        <table className="w-full min-w-[760px] text-left text-[0.82rem]">
                          <thead className="border-b border-border bg-muted/60 text-muted-foreground">
                            <tr>
                              <th className="w-10 px-3 py-2.5 font-semibold">#</th>
                              <th className="min-w-[180px] px-3 py-2.5 font-semibold">ผู้ตอบ</th>
                              <th className="whitespace-nowrap px-3 py-2.5 font-semibold">เวลา</th>
                              {hasPdpaData && <th className="whitespace-nowrap px-3 py-2.5 font-semibold">PDPA</th>}
                              {data.form.questions.map((q, qi) => (
                                <th
                                  key={q.id}
                                  title={q.title}
                                  className={cn(
                                    'px-3 py-2.5 font-semibold whitespace-nowrap',
                                    q.type === 'long_text' ? 'min-w-[240px]' : 'min-w-[130px]',
                                  )}
                                >
                                  Q{qi + 1}
                                </th>
                              ))}
                              <th className="w-20 px-3 py-2.5 text-right font-semibold">จัดการ</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {paginatedResponses.map((r, idx) => {
                              const rowNumber = (showAllRows ? 0 : (safePage - 1) * PAGE_SIZE) + idx + 1;
                              return (
                                <tr key={r.respondentId} className="align-top transition-colors hover:bg-muted/25">
                                  <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground tabular-nums">
                                    {rowNumber}
                                  </td>
                                  <td className="px-3 py-2.5">
                                    {isAnonymousRespondent(r.email) ? (
                                      <span className="font-semibold text-muted-foreground">ไม่ระบุตัวตน</span>
                                    ) : (
                                      <>
                                        <div className="font-semibold text-foreground">{r.name || '-'}</div>
                                        <div className="text-[0.74rem] text-muted-foreground">{r.email}</div>
                                      </>
                                    )}
                                  </td>
                                  <td className="px-3 py-2.5 whitespace-nowrap text-xs text-muted-foreground tabular-nums">
                                    {formatDate(r.updatedAt || r.submittedAt)}
                                  </td>
                                  {hasPdpaData && (
                                    <td className="px-3 py-2.5 whitespace-nowrap text-xs">
                                      {r.pdpaConsent?.accepted ? (
                                        <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                                          ยินยอม v{r.pdpaConsent.policyVersion}
                                        </span>
                                      ) : (
                                        <span className="text-muted-foreground">-</span>
                                      )}
                                    </td>
                                  )}
                                  {data.form.questions.map((q) => {
                                    const txt = answerText(q, r);
                                    return (
                                      <td key={q.id} className="max-w-[300px] px-3 py-2.5 text-foreground">
                                        <div className="line-clamp-3 whitespace-pre-wrap break-words">
                                          {txt || <span className="text-muted-foreground">-</span>}
                                        </div>
                                      </td>
                                    );
                                  })}
                                  <td className="px-3 py-2.5 text-right whitespace-nowrap">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      aria-label="ดูรายละเอียด"
                                      className="size-7 text-muted-foreground hover:text-foreground"
                                      onClick={() => setInspectingResponse(r)}
                                    >
                                      <Eye size={14} />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      aria-label="ลบคำตอบ"
                                      className="size-7 text-muted-foreground hover:text-destructive"
                                      onClick={() => void removeResponse(r)}
                                    >
                                      <Trash2 size={14} />
                                    </Button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Pagination bar */}
                  {filteredResponses.length > PAGE_SIZE && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-xs">
                      <span className="text-muted-foreground">
                        {showAllRows
                          ? `แสดงทั้งหมด ${filteredResponses.length.toLocaleString('th-TH')} รายการ`
                          : `หน้า ${safePage} / ${totalPages} (${filteredResponses.length.toLocaleString('th-TH')} รายการ)`}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {!showAllRows && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2"
                              disabled={safePage <= 1}
                              onClick={() => setPage((p) => Math.max(1, p - 1))}
                            >
                              <ChevronLeft size={14} />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2"
                              disabled={safePage >= totalPages}
                              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            >
                              <ChevronRight size={14} />
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs font-semibold text-primary"
                          onClick={() => { setShowAllRows((v) => !v); setPage(1); }}
                        >
                          {showAllRows ? 'แบ่งหน้า (20/หน้า)' : 'แสดงทั้งหมด'}
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Full Respondent Inspection Modal (used from Compact Table View) */}
      {inspectingResponse && data && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
          onClick={() => setInspectingResponse(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
              <div className="min-w-0">
                <h3 className="text-base font-bold text-foreground">
                  {isAnonymousRespondent(inspectingResponse.email) ? 'ผู้ตอบไม่ระบุตัวตน' : inspectingResponse.name || '-'}
                </h3>
                {!isAnonymousRespondent(inspectingResponse.email) && (
                  <p className="text-xs text-muted-foreground">{inspectingResponse.email}</p>
                )}
                <p className="mt-0.5 text-xs text-muted-foreground">
                  ส่งเมื่อ {formatDate(inspectingResponse.updatedAt || inspectingResponse.submittedAt)}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setInspectingResponse(null)} aria-label="ปิด">
                <X size={16} />
              </Button>
            </div>
            <div className="mt-4 flex flex-col gap-3">
              {data.form.questions.map((q, qi) => (
                <div key={q.id} className="rounded-xl border border-border/80 bg-muted/25 p-3">
                  <p className="text-xs font-semibold text-muted-foreground">
                    {qi + 1}. {q.title}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap break-words text-foreground">
                    {answerText(q, inspectingResponse) || '-'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
