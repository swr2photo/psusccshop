'use client';

// AI-powered survey comment analyzer & organizer panel for admins.

import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  FileText,
  Lightbulb,
  Loader2,
  MessageSquareQuote,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Tag,
  ThumbsUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { FormAiAnalysis, FormAiSentiment, FormAiThemeSentiment } from '@/lib/form-ai-types';

type Toast = (type: 'success' | 'error' | 'info' | 'warning', message: string) => void;

interface Props {
  analysis: FormAiAnalysis | null;
  loadingInitial: boolean;
  analyzing: boolean;
  aiEnabled: boolean;
  currentResponseCount: number;
  onRunAnalysis: () => void;
  showToast: Toast;
}

const SENTIMENT_META: Record<FormAiThemeSentiment, { label: string; className: string; dotClass: string }> = {
  positive: {
    label: 'เชิงสนับสนุน',
    className: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-400',
    dotClass: 'bg-emerald-500',
  },
  neutral: {
    label: 'เป็นกลาง / ทั่วไป',
    className: 'bg-slate-500/12 text-slate-700 dark:text-slate-300',
    dotClass: 'bg-slate-400',
  },
  negative: {
    label: 'ข้อกังวล / คัดค้าน',
    className: 'bg-rose-500/12 text-rose-700 dark:text-rose-400',
    dotClass: 'bg-rose-500',
  },
  mixed: {
    label: 'ความเห็นหลากหลาย',
    className: 'bg-amber-500/12 text-amber-700 dark:text-amber-400',
    dotClass: 'bg-amber-500',
  },
};

function formatDateTime(iso?: string | null) {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

export default function FormAiInsightsCard({
  analysis,
  loadingInitial,
  analyzing,
  aiEnabled,
  currentResponseCount,
  onRunAnalysis,
  showToast,
}: Props) {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedSentiment, setSelectedSentiment] = useState<'ALL' | FormAiSentiment>('ALL');
  const [commentQuery, setCommentQuery] = useState('');
  const [copiedDraft, setCopiedDraft] = useState(false);

  const categories = useMemo(() => {
    if (!analysis?.organizedComments?.length) return [];
    const map = new Map<string, number>();
    for (const c of analysis.organizedComments) {
      map.set(c.category, (map.get(c.category) || 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [analysis]);

  const filteredComments = useMemo(() => {
    if (!analysis?.organizedComments?.length) return [];
    const q = commentQuery.trim().toLowerCase();
    return analysis.organizedComments.filter((c) => {
      if (selectedCategory !== 'ALL' && c.category !== selectedCategory) return false;
      if (selectedSentiment !== 'ALL' && c.sentiment !== selectedSentiment) return false;
      if (!q) return true;
      return (
        c.originalText.toLowerCase().includes(q) ||
        c.shortSummary.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        (c.choiceContext || '').toLowerCase().includes(q)
      );
    });
  }, [analysis, selectedCategory, selectedSentiment, commentQuery]);

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedDraft(true);
      showToast('success', `คัดลอก${label}แล้ว`);
      window.setTimeout(() => setCopiedDraft(false), 2000);
    } catch {
      showToast('error', 'คัดลอกไม่สำเร็จ');
    }
  };

  if (loadingInitial) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-card py-16 text-muted-foreground">
        <Loader2 size={22} className="animate-spin text-primary" />
        <p className="text-sm">กำลังโหลดข้อมูลวิเคราะห์ AI...</p>
      </div>
    );
  }

  if (analyzing) {
    return (
      <div className="rounded-2xl border border-primary/25 bg-card p-6 sm:p-8">
        <div className="flex flex-col items-center text-center">
          <Loader2 size={28} className="animate-spin text-primary" />
          <h3 className="mt-3 text-base font-bold text-foreground">AI กำลังอ่านและจัดระเบียบความคิดเห็นทั้งหมด</h3>
          <p className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
            กำลังสรุปภาพรวม จัดกลุ่มประเด็นสำคัญ แยกจุดสนับสนุน ข้อกังวล ข้อเสนอแนะ และร่างบทสรุปทางการ (ใช้เวลาประมาณ 5–15 วินาที)
          </p>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-muted/60" />
          ))}
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
        <div className="mx-auto flex max-w-xl flex-col items-center text-center">
          <Sparkles size={30} className="text-primary" />
          <h3 className="mt-3 text-lg font-extrabold text-foreground">ให้ AI ช่วยอ่านความคิดเห็นและจัดระเบียบ</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            วิเคราะห์คำตอบทั้งหมด {currentResponseCount.toLocaleString('th-TH')} คน เพื่อจัดหมวดหมู่ประเด็นสำคัญ แยกเหตุผลสนับสนุน ข้อกังวล ข้อเสนอแนะ และร่างบทสรุปทางการพร้อมนำไปเสนอพิจารณา
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button
              onClick={onRunAnalysis}
              disabled={currentResponseCount === 0 || !aiEnabled}
              className="gap-2 rounded-xl px-5 font-bold"
            >
              <Sparkles size={16} /> เริ่มวิเคราะห์ด้วย AI
            </Button>
          </div>
          {!aiEnabled && (
            <p className="mt-3 text-xs text-destructive">ยังไม่ได้ตั้งค่า GEMINI_API_KEY บนเซิร์ฟเวอร์</p>
          )}
          <p className="mt-4 inline-flex items-center gap-1.5 text-[0.74rem] text-muted-foreground">
            <ShieldCheck size={14} className="shrink-0 text-primary" />
            ปลอดภัยตาม PDPA — ส่งเฉพาะข้อความความคิดเห็นแบบไม่ระบุตัวตน ไม่ส่งชื่อหรืออีเมลผู้ตอบ
          </p>
        </div>
      </div>
    );
  }

  const newResponseDiff = Math.max(0, currentResponseCount - analysis.responseCount);

  return (
    <div className="flex flex-col gap-4">
      {/* Meta & refresh header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 sm:px-5">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1.5 text-sm font-bold text-foreground">
            <Sparkles size={16} className="text-primary" /> ผลวิเคราะห์โดย AI
          </span>
          <span className="text-xs text-muted-foreground">
            วิเคราะห์ล่าสุด {formatDateTime(analysis.generatedAt)} · {analysis.responseCount.toLocaleString('th-TH')} ผู้ตอบ · {analysis.commentCount.toLocaleString('th-TH')} ความคิดเห็น
          </span>
          <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.68rem] text-muted-foreground">
            {analysis.model}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {newResponseDiff > 0 && (
            <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-[0.72rem] font-semibold text-amber-700 dark:text-amber-400">
              มีคำตอบใหม่ +{newResponseDiff} คน
            </span>
          )}
          <Button variant="outline" size="sm" onClick={onRunAnalysis} disabled={analyzing || !aiEnabled} className="gap-1.5">
            <RefreshCw size={14} /> วิเคราะห์ใหม่
          </Button>
        </div>
      </div>

      {/* 1. Executive Summary + Sentiment Bar */}
      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <h3 className="text-sm font-bold text-foreground">บทสรุปภาพรวม (Executive Summary)</h3>
        <p className="mt-2 text-[0.9rem] leading-relaxed whitespace-pre-wrap text-foreground/95">
          {analysis.executiveSummary || 'ไม่มีข้อความสรุป'}
        </p>

        {/* Sentiment bar */}
        <div className="mt-4 border-t border-border/70 pt-3.5">
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-muted-foreground">แนวโน้มความคิดเห็นโดยรวม</span>
            <div className="flex flex-wrap items-center gap-3 tabular-nums">
              <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400">
                <span className="size-2 rounded-full bg-emerald-500" /> สนับสนุน {analysis.sentiment.positive}%
              </span>
              <span className="inline-flex items-center gap-1.5 font-semibold text-slate-600 dark:text-slate-300">
                <span className="size-2 rounded-full bg-slate-400" /> เป็นกลาง {analysis.sentiment.neutral}%
              </span>
              <span className="inline-flex items-center gap-1.5 font-semibold text-rose-700 dark:text-rose-400">
                <span className="size-2 rounded-full bg-rose-500" /> ข้อกังวล {analysis.sentiment.negative}%
              </span>
            </div>
          </div>
          <div className="flex h-2.5 w-full gap-[2px] overflow-hidden rounded-full bg-muted">
            {analysis.sentiment.positive > 0 && (
              <div className="h-full bg-emerald-500" style={{ width: `${analysis.sentiment.positive}%` }} />
            )}
            {analysis.sentiment.neutral > 0 && (
              <div className="h-full bg-slate-400" style={{ width: `${analysis.sentiment.neutral}%` }} />
            )}
            {analysis.sentiment.negative > 0 && (
              <div className="h-full bg-rose-500" style={{ width: `${analysis.sentiment.negative}%` }} />
            )}
          </div>
        </div>
      </section>

      {/* 2. Organized Themes */}
      {analysis.themes.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Tag size={15} className="text-primary" /> ประเด็นสำคัญที่ AI จัดหมวดหมู่ ({analysis.themes.length} กลุ่ม)
            </h3>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {analysis.themes.map((theme) => {
              const meta = SENTIMENT_META[theme.sentiment] || SENTIMENT_META.neutral;
              return (
                <article
                  key={theme.id}
                  className="flex flex-col gap-2.5 rounded-2xl border border-border bg-card p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-[0.95rem] leading-snug font-bold text-foreground">{theme.title}</h4>
                    <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-[0.72rem] font-bold text-foreground tabular-nums">
                      ~{theme.count} ความเห็น
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.7rem] font-semibold', meta.className)}>
                      <span className={cn('size-1.5 rounded-full', meta.dotClass)} />
                      {meta.label}
                    </span>
                    {theme.tags.map((tag, ti) => (
                      <span key={ti} className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[0.68rem] text-muted-foreground">
                        #{tag}
                      </span>
                    ))}
                  </div>

                  <p className="text-[0.84rem] leading-relaxed text-muted-foreground">{theme.summary}</p>

                  {theme.quotes.length > 0 && (
                    <div className="mt-auto flex flex-col gap-1.5 border-t border-border/60 pt-2.5">
                      {theme.quotes.map((quote, qi) => (
                        <blockquote
                          key={qi}
                          className="border-l-2 border-primary/40 pl-2.5 text-[0.78rem] leading-relaxed text-foreground/85"
                        >
                          &ldquo;{quote}&rdquo;
                        </blockquote>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* 3. Three-Column Highlights: Supporting / Concerns / Suggestions */}
      {(analysis.highlights.supporting.length > 0 ||
        analysis.highlights.concerns.length > 0 ||
        analysis.highlights.suggestions.length > 0) && (
        <section className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-4">
            <h4 className="flex items-center gap-1.5 text-sm font-bold text-emerald-700 dark:text-emerald-400">
              <ThumbsUp size={15} /> เหตุผลสนับสนุนหลัก
            </h4>
            {analysis.highlights.supporting.length > 0 ? (
              <ul className="mt-2.5 flex flex-col gap-2 text-[0.83rem] leading-relaxed text-foreground/90">
                {analysis.highlights.supporting.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <CheckCircle2 size={14} className="mt-1 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">ไม่พบข้อมูลเพิ่มเติม</p>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <h4 className="flex items-center gap-1.5 text-sm font-bold text-rose-700 dark:text-rose-400">
              <AlertTriangle size={15} /> ข้อกังวล / ข้อควรพิจารณา
            </h4>
            {analysis.highlights.concerns.length > 0 ? (
              <ul className="mt-2.5 flex flex-col gap-2 text-[0.83rem] leading-relaxed text-foreground/90">
                {analysis.highlights.concerns.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-rose-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">ไม่พบข้อคัดค้านหรือข้อกังวลหลัก</p>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <h4 className="flex items-center gap-1.5 text-sm font-bold text-primary">
              <Lightbulb size={15} /> ข้อเสนอแนะเชิงสร้างสรรค์
            </h4>
            {analysis.highlights.suggestions.length > 0 ? (
              <ul className="mt-2.5 flex flex-col gap-2 text-[0.83rem] leading-relaxed text-foreground/90">
                {analysis.highlights.suggestions.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">ยังไม่มีข้อเสนอแนะเพิ่มเติม</p>
            )}
          </div>
        </section>
      )}

      {/* 4. Actionable Recommendations + 5. Formal Proposal Draft */}
      <div className="grid gap-4 lg:grid-cols-12">
        {analysis.recommendations.length > 0 && (
          <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 lg:col-span-5">
            <h3 className="text-sm font-bold text-foreground">แนวทางดำเนินการที่แนะนำ</h3>
            <ol className="mt-3 flex flex-col gap-2.5 text-[0.84rem] leading-relaxed text-foreground/90">
              {analysis.recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="mt-0.5 shrink-0 font-bold text-primary tabular-nums">{i + 1}.</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {analysis.formalDraft && (
          <section
            className={cn(
              'rounded-2xl border border-border bg-card p-4 sm:p-5',
              analysis.recommendations.length > 0 ? 'lg:col-span-7' : 'lg:col-span-12',
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                <FileText size={15} className="text-primary" /> ร่างบทสรุปทางการสำหรับแนบเอกสารเสนอพิจารณา
              </h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={() => void copyText(analysis.formalDraft, 'ร่างบทสรุปทางการ')}
              >
                {copiedDraft ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                {copiedDraft ? 'คัดลอกแล้ว' : 'คัดลอกข้อความ'}
              </Button>
            </div>
            <div className="mt-3 rounded-xl border border-border/80 bg-muted/30 p-3.5 text-[0.86rem] leading-relaxed whitespace-pre-wrap text-foreground">
              {analysis.formalDraft}
            </div>
          </section>
        )}
      </div>

      {/* 6. Organized Comments Explorer */}
      {analysis.organizedComments.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-sm font-bold text-foreground">
              <MessageSquareQuote size={16} className="text-primary" />
              ความคิดเห็นที่จัดระเบียบแล้ว ({filteredComments.length.toLocaleString('th-TH')} / {analysis.organizedComments.length.toLocaleString('th-TH')})
            </h3>
            <div className="relative w-full sm:w-64">
              <Search size={14} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={commentQuery}
                onChange={(e) => setCommentQuery(e.target.value)}
                placeholder="ค้นหาความคิดเห็น..."
                className="h-8 w-full rounded-lg border border-border bg-background pr-3 pl-8 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          {/* Category filter pills */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedCategory('ALL')}
              className={cn(
                'rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors',
                selectedCategory === 'ALL'
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-muted-foreground hover:text-foreground',
              )}
            >
              ทุกหมวดหมู่ ({analysis.organizedComments.length})
            </button>
            {categories.map(([cat, count]) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors',
                  selectedCategory === cat
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background text-muted-foreground hover:text-foreground',
                )}
              >
                {cat} ({count})
              </button>
            ))}
          </div>

          {/* Sentiment filter strip */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {([
              ['ALL', 'ทุกแนวโน้ม'],
              ['positive', 'เชิงสนับสนุน'],
              ['neutral', 'เป็นกลาง'],
              ['negative', 'ข้อกังวล'],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedSentiment(key)}
                className={cn(
                  'rounded-lg px-2.5 py-1 text-[0.74rem] font-medium transition-colors',
                  selectedSentiment === key
                    ? 'bg-muted font-bold text-foreground'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Organized comments list */}
          <div className="mt-3 flex max-h-[540px] flex-col gap-2 overflow-y-auto pr-1">
            {filteredComments.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">ไม่พบความคิดเห็นตามตัวกรองที่เลือก</p>
            ) : (
              filteredComments.map((c) => {
                const meta = SENTIMENT_META[c.sentiment] || SENTIMENT_META.neutral;
                return (
                  <div key={c.index} className="rounded-xl border border-border/80 bg-muted/20 p-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-[0.7rem] font-semibold text-muted-foreground">#{c.index}</span>
                      <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[0.7rem] font-semibold text-foreground">
                        {c.category}
                      </span>
                      <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.68rem] font-semibold', meta.className)}>
                        <span className={cn('size-1.5 rounded-full', meta.dotClass)} />
                        {meta.label}
                      </span>
                      {c.choiceContext && (
                        <span className="ml-auto text-[0.7rem] text-muted-foreground">เลือก: {c.choiceContext}</span>
                      )}
                    </div>
                    <p className="mt-1.5 text-[0.83rem] font-semibold text-foreground">{c.shortSummary}</p>
                    {c.originalText !== c.shortSummary && (
                      <p className="mt-1 text-[0.8rem] leading-relaxed whitespace-pre-wrap text-muted-foreground">
                        {c.originalText}
                      </p>
                    )}
                    <p className="mt-1.5 text-[0.68rem] text-muted-foreground/80">คำถาม: {c.questionTitle}</p>
                  </div>
                );
              })
            )}
          </div>
        </section>
      )}
    </div>
  );
}
