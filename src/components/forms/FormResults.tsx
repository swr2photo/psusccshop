'use client';

// Election-style results: leader card, majority strip, donut and ranked tallies per question.
// Category colours = the validated 8-slot reference palette (light/dark stepped), assigned by
// option order (never by rank), so a choice keeps its colour as the votes move.

import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Crown, MessageSquareText, Radio, Scale, Search, ShieldCheck, Star, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CHOICE_QUESTION_TYPES, getFormPdpa, type FormDefinition, type FormQuestion, type FormSummary, type QuestionSummary } from '@/lib/forms';

interface Props {
  form: FormDefinition;
  summary: FormSummary;
  /** Highlight the viewer's own choices */
  myAnswers?: Record<string, unknown> | null;
  /** Show free-text answers (admin) */
  showTexts?: boolean;
  /** Voting closed → "final result" wording */
  final?: boolean;
}

const SERIES = 8;
const VIZ_CSS = `
.form-viz{--s1:#3987e5;--s2:#d95926;--s3:#199e70;--s4:#c98500;--s5:#d55181;--s6:#0ca30c;--s7:#9085e9;--s8:#e66767;--s-other:#6b6b70;--star:#f5a524}
[data-theme="light"] .form-viz{--s1:#2a78d6;--s2:#eb6834;--s3:#1baf7a;--s4:#eda100;--s5:#e87ba4;--s6:#008300;--s7:#6250d6;--s8:#e34948;--s-other:#a1a1a6;--star:#eda100}
`;

/** Fixed slot by option position; a 9th+ option folds to neutral "other" grey (never a generated hue). */
const colorAt = (i: number) => (i < SERIES ? `var(--s${i + 1})` : 'var(--s-other)');

const pct = (n: number, total: number) => (total > 0 ? (n / total) * 100 : 0);
const fmtPct = (p: number) => (p >= 10 || p === 0 ? Math.round(p) : Math.round(p * 10) / 10).toString();

function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setM(true), 30);
    return () => clearTimeout(t);
  }, []);
  return m;
}

type Entry = { id: string; label: string; count: number; color: string; index: number; mine: boolean };

// ───────────── Donut ─────────────

function Donut({ entries, total, unit, hovered, onHover }: { entries: Entry[]; total: number; unit: string; hovered: string | null; onHover: (id: string | null) => void }) {
  const mounted = useMounted();
  const sum = entries.reduce((a, e) => a + e.count, 0);
  const visible = entries.filter((e) => e.count > 0);
  const gap = visible.length > 1 ? 0.8 : 0;
  let start = 0;
  const focus = entries.find((e) => e.id === hovered);
  return (
    <div className="relative size-[108px] shrink-0 sm:size-[168px]">
      <svg viewBox="0 0 120 120" className="size-full -rotate-90" role="img" aria-label="สัดส่วนคะแนน">
        <circle cx="60" cy="60" r="46" fill="none" stroke="var(--muted)" strokeWidth="16" />
        {sum > 0 && entries.map((e) => {
          const share = (e.count / sum) * 100;
          const segLen = Math.max(0.5, share - Math.min(gap, share * 0.35));
          const seg = (
            <circle
              key={e.id}
              cx="60"
              cy="60"
              r="46"
              fill="none"
              pathLength={100}
              stroke={e.color}
              strokeWidth={hovered === e.id ? 19 : 16}
              strokeDasharray={`${mounted ? segLen : 0} ${100}`}
              strokeDashoffset={-start}
              className="cursor-pointer transition-[stroke-dasharray,stroke-width,opacity] duration-700 ease-out"
              style={{ opacity: hovered && hovered !== e.id ? 0.35 : 1 }}
              onMouseEnter={() => onHover(e.id)}
              onMouseLeave={() => onHover(null)}
              onClick={() => onHover(hovered === e.id ? null : e.id)}
            >
              <title>{`${e.label}: ${e.count} ${unit} (${fmtPct(pct(e.count, total))}%)`}</title>
            </circle>
          );
          start += share;
          return e.count > 0 ? seg : null;
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
        <div className="px-3 sm:px-6">
          {focus ? (
            <>
              <div className="text-[1.15rem] leading-none font-extrabold tabular-nums sm:text-[1.6rem]">{fmtPct(pct(focus.count, total))}%</div>
              <div className="mt-0.5 line-clamp-2 text-[0.6rem] leading-tight text-muted-foreground sm:mt-1 sm:text-[0.7rem]">{focus.label}</div>
            </>
          ) : (
            <>
              <div className="text-[1.25rem] leading-none font-extrabold tabular-nums sm:text-[1.7rem]">{total.toLocaleString('th-TH')}</div>
              <div className="mt-0.5 text-[0.6rem] text-muted-foreground sm:mt-1 sm:text-[0.7rem]">{unit}ทั้งหมด</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ───────────── Majority strip ─────────────

function MajorityStrip({ entries, total, hovered, onHover }: { entries: Entry[]; total: number; hovered: string | null; onHover: (id: string | null) => void }) {
  const mounted = useMounted();
  return (
    <div className="relative pt-5">
      <span className="absolute top-0 left-1/2 -translate-x-1/2 text-[0.65rem] font-semibold whitespace-nowrap text-muted-foreground">เกินครึ่ง 50%</span>
      <div className="flex h-4 w-full gap-[2px] overflow-hidden rounded-full bg-muted">
        {entries.filter((e) => e.count > 0).map((e) => (
          <div
            key={e.id}
            title={`${e.label}: ${e.count} เสียง (${fmtPct(pct(e.count, total))}%)`}
            onMouseEnter={() => onHover(e.id)}
            onMouseLeave={() => onHover(null)}
            onClick={() => onHover(hovered === e.id ? null : e.id)}
            className="h-full cursor-pointer transition-[width,opacity] duration-700 ease-out first:rounded-l-full last:rounded-r-full"
            style={{ width: mounted ? `${pct(e.count, total)}%` : '0%', background: e.color, opacity: hovered && hovered !== e.id ? 0.35 : 1 }}
          />
        ))}
      </div>
      <div className="pointer-events-none absolute top-4 bottom-[-4px] left-1/2 -translate-x-1/2 border-l-2 border-dashed border-foreground/75 drop-shadow-[0_0_2px_var(--card)]" />
    </div>
  );
}

// ───────────── Ranked tally ─────────────

function TallyRow({ e, rank, total, isLeader, unit, hovered, onHover }: { e: Entry; rank: number; total: number; isLeader: boolean; unit: string; hovered: string | null; onHover: (id: string | null) => void }) {
  const mounted = useMounted();
  const p = pct(e.count, total);
  return (
    <li
      onMouseEnter={() => onHover(e.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onHover(hovered === e.id ? null : e.id)}
      className={cn('cursor-pointer rounded-xl px-2.5 py-2 transition-colors', hovered === e.id ? 'bg-muted/70' : '', hovered && hovered !== e.id && 'opacity-60')}
    >
      <div className="flex items-center gap-2.5">
        <span className={cn('w-5 shrink-0 text-center text-[0.8rem] font-extrabold tabular-nums', isLeader ? 'text-foreground' : 'text-muted-foreground')}>{rank}.</span>
        <span className="size-3 shrink-0 rounded-[4px]" style={{ background: e.color }} aria-hidden />
        <span className={cn('min-w-0 flex-1 text-[0.9rem] break-words', isLeader ? 'font-bold' : 'font-medium')}>
          {e.label}
          {e.mine && (
            <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-full border border-foreground/20 px-1.5 py-px align-middle text-[0.62rem] font-bold text-foreground">
              <Check size={10} strokeWidth={3} /> คุณเลือก
            </span>
          )}
        </span>
        <span className="text-right whitespace-nowrap tabular-nums">
          <span className="text-[1rem] font-extrabold">{fmtPct(p)}%</span>
          <span className="ml-1.5 text-[0.75rem] text-muted-foreground">{e.count.toLocaleString('th-TH')} {unit}</span>
        </span>
      </div>
      <div className="mt-1.5 ml-[3.25rem] h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-r-[4px] transition-[width] duration-700 ease-out" style={{ width: mounted ? `${p}%` : '0%', background: e.color }} />
      </div>
    </li>
  );
}

// ───────────── Choice question ─────────────

function ChoiceResult({ q, s, mine, final }: { q: FormQuestion; s: QuestionSummary; mine: Set<string>; final?: boolean }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const multi = q.type === 'multiple_choice';
  const unit = multi ? 'คน' : 'เสียง';
  const entries: Entry[] = useMemo(
    () => (q.options || []).map((o, index) => ({ id: o.id, label: o.label, count: s.counts?.[o.id] || 0, color: colorAt(index), index, mine: mine.has(o.id) })),
    [q.options, s.counts, mine],
  );
  const ranked = useMemo(() => [...entries].sort((a, b) => b.count - a.count || a.index - b.index), [entries]);
  // Competition ranking (1, 1, 3) when options tie
  const ranks = useMemo(
    () => ranked.reduce<number[]>((acc, e, i) => [...acc, i > 0 && e.count === ranked[i - 1].count ? acc[i - 1] : i + 1], []),
    [ranked],
  );
  // Single choice: % of votes; multiple choice: % of respondents (bars may sum past 100%)
  const total = multi ? s.answered : entries.reduce((a, e) => a + e.count, 0);
  const top = ranked[0];
  const tied = top && top.count > 0 ? ranked.filter((e) => e.count === top.count) : [];
  const runnerUp = ranked.find((e) => e.count < (top?.count || 0));
  const leadBy = top && tied.length === 1 ? top.count - (runnerUp?.count || 0) : 0;
  const majority = !multi && top && tied.length === 1 && pct(top.count, total) > 50;

  if (s.answered === 0 || !top || top.count === 0) return <p className="rounded-xl bg-muted/50 px-4 py-6 text-center text-[0.85rem] text-muted-foreground">ยังไม่มีผู้ลงคะแนน</p>;

  return (
    <div>
      {/* Leader */}
      <div className="mb-4 flex items-center gap-3 sm:gap-4">
        <div className="min-w-0 flex-1 rounded-2xl border border-border bg-muted/30 p-3 sm:p-4">
          {tied.length > 1 ? (
            <>
              <p className="flex items-center gap-1.5 text-[0.72rem] font-bold tracking-wide text-muted-foreground uppercase"><Scale size={13} /> คะแนนเสมอ</p>
              <p className="mt-1 text-[1.15rem] font-extrabold break-words">{tied.map((e) => e.label).join(' · ')}</p>
              <p className="mt-1 text-[0.8rem] text-muted-foreground">{top.count.toLocaleString('th-TH')} {unit}เท่ากัน ({fmtPct(pct(top.count, total))}%)</p>
            </>
          ) : (
            <>
              <p className="flex items-center gap-1.5 text-[0.72rem] font-bold tracking-wide text-muted-foreground uppercase">
                <Crown size={13} style={{ color: top.color }} /> {multi ? 'ถูกเลือกมากที่สุด' : final ? 'ชนะโหวต' : 'คะแนนนำ'}
              </p>
              <p className="mt-1 flex items-center gap-2 text-[1.05rem] leading-snug font-extrabold break-words sm:text-[1.2rem]">
                <span className="inline-block size-3 shrink-0 rounded-[4px]" style={{ background: top.color }} aria-hidden />
                <span className="min-w-0">{top.label}</span>
              </p>
              <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2">
                <span className="text-[2rem] leading-none font-black tabular-nums sm:text-[2.4rem]">{fmtPct(pct(top.count, total))}<span className="text-[1.2rem]">%</span></span>
                <span className="text-[0.85rem] text-muted-foreground tabular-nums">{top.count.toLocaleString('th-TH')} {unit}</span>
              </div>
              <p className="mt-2 flex flex-wrap gap-1.5 text-[0.72rem] font-semibold">
                {runnerUp && leadBy > 0 && <span className="rounded-full bg-card px-2 py-0.5 text-muted-foreground">นำ {leadBy.toLocaleString('th-TH')} {unit}</span>}
                {majority && <span className="rounded-full bg-card px-2 py-0.5 text-foreground">ได้เสียงข้างมากเกินครึ่ง</span>}
              </p>
            </>
          )}
        </div>
        {!multi && <Donut entries={ranked} total={total} unit={unit} hovered={hovered} onHover={setHovered} />}
      </div>

      {!multi && <MajorityStrip entries={ranked} total={total} hovered={hovered} onHover={setHovered} />}

      <ol className={cn('flex flex-col gap-0.5', !multi && 'mt-3')}>
        {ranked.map((e, i) => (
          <TallyRow key={e.id} e={e} rank={ranks[i]} total={total} isLeader={e.count > 0 && e.count === top.count} unit={unit} hovered={hovered} onHover={setHovered} />
        ))}
      </ol>
      {multi && <p className="mt-2 px-2.5 text-[0.7rem] text-muted-foreground">เลือกได้หลายข้อ · เปอร์เซ็นต์คิดจากผู้ตอบ {s.answered.toLocaleString('th-TH')} คน</p>}
    </div>
  );
}

// ───────────── Rating ─────────────

function RatingResult({ s, mine }: { s: QuestionSummary; mine: Set<string> }) {
  const mounted = useMounted();
  const avg = s.average ?? 0;
  const good = (s.counts?.['4'] || 0) + (s.counts?.['5'] || 0);
  if (s.answered === 0) return <p className="rounded-xl bg-muted/50 px-4 py-6 text-center text-[0.85rem] text-muted-foreground">ยังไม่มีผู้ให้คะแนน</p>;
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="shrink-0 rounded-2xl bg-muted/40 px-6 py-4 text-center">
        <div className="text-[2.6rem] leading-none font-black tabular-nums">{avg.toFixed(1)}</div>
        <div className="relative mx-auto mt-2 w-fit" aria-label={`เฉลี่ย ${avg} จาก 5 ดาว`}>
          <div className="flex gap-0.5 text-muted-foreground/30">{[0, 1, 2, 3, 4].map((i) => <Star key={i} size={18} fill="currentColor" stroke="none" />)}</div>
          <div className="absolute inset-0 flex gap-0.5 overflow-hidden" style={{ width: `${(avg / 5) * 100}%`, color: 'var(--star)' }}>
            {[0, 1, 2, 3, 4].map((i) => <Star key={i} size={18} fill="currentColor" stroke="none" className="shrink-0" />)}
          </div>
        </div>
        <div className="mt-2 text-[0.72rem] text-muted-foreground">พึงพอใจ (4–5 ดาว) {fmtPct(pct(good, s.answered))}%</div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {['5', '4', '3', '2', '1'].map((v) => {
          const c = s.counts?.[v] || 0;
          return (
            <div key={v} className="flex items-center gap-2 text-[0.8rem]" title={`${v} ดาว: ${c} คน`}>
              <span className="flex w-8 shrink-0 items-center gap-0.5 font-semibold tabular-nums">{v}<Star size={11} fill="var(--star)" stroke="none" /></span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-r-[4px] transition-[width] duration-700 ease-out" style={{ width: mounted ? `${pct(c, s.answered)}%` : '0%', background: 'var(--star)' }} />
              </div>
              <span className={cn('w-16 shrink-0 text-right tabular-nums text-muted-foreground', mine.has(v) && 'font-bold text-foreground')}>
                {c} {mine.has(v) ? '· คุณ' : 'คน'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TextList({ texts }: { texts: string[] }) {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return texts;
    return texts.filter((t) => t.toLowerCase().includes(q));
  }, [texts, query]);

  if (texts.length === 0) return <p className="text-[0.85rem] text-muted-foreground">ยังไม่มีคำตอบ</p>;

  const INITIAL_VISIBLE = 6;
  const visible = expanded ? filtered : filtered.slice(0, INITIAL_VISIBLE);
  const hasMore = filtered.length > INITIAL_VISIBLE;

  return (
    <div className="flex flex-col gap-2.5">
      {texts.length > 5 && (
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setExpanded(true); }}
            placeholder={`ค้นหาใน ${texts.length} ความคิดเห็น...`}
            className="h-9 w-full rounded-xl border border-border bg-background pr-3 pl-8 text-[0.82rem] text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        </div>
      )}

      {visible.length === 0 ? (
        <p className="py-4 text-center text-[0.82rem] text-muted-foreground">ไม่พบความคิดเห็นที่ตรงกับคำค้นหา</p>
      ) : (
        <div className="flex flex-col gap-2">
          {visible.map((t, i) => (
            <div
              key={i}
              className="flex items-start gap-2.5 rounded-xl border border-border/70 bg-muted/35 px-3.5 py-2.5 text-[0.86rem] leading-relaxed"
            >
              <span className="mt-0.5 shrink-0 text-[0.72rem] font-semibold text-muted-foreground tabular-nums">
                {i + 1}.
              </span>
              <span className="min-w-0 flex-1 whitespace-pre-wrap break-words text-foreground">{t}</span>
            </div>
          ))}
        </div>
      )}

      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex w-fit items-center gap-1 self-center rounded-lg px-3 py-1.5 text-[0.78rem] font-semibold text-primary transition-colors hover:bg-primary/10"
        >
          {expanded ? (
            <>
              <ChevronUp size={14} /> ย่อรายการ
            </>
          ) : (
            <>
              <ChevronDown size={14} /> แสดงทั้งหมด ({filtered.length.toLocaleString('th-TH')} ความคิดเห็น)
            </>
          )}
        </button>
      )}
    </div>
  );
}

// ───────────── Main ─────────────

export default function FormResults({ form, summary, myAnswers, showTexts, final }: Props) {
  const voteQuestions = form.questions.filter((q) => CHOICE_QUESTION_TYPES.includes(q.type)).length;
  const pdpa = getFormPdpa(form);
  return (
    <div className="form-viz flex flex-col gap-3">
      <style>{VIZ_CSS}</style>

      {/* Turnout header */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4 sm:p-5">
        <Users size={22} className="shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-[0.75rem] font-semibold text-muted-foreground">ผู้ร่วมตอบทั้งหมด</p>
          <p className="text-[1.8rem] leading-tight font-black tabular-nums">{summary.totalResponses.toLocaleString('th-TH')} <span className="text-[0.95rem] font-semibold text-muted-foreground">คน</span></p>
        </div>
        <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[0.75rem] font-bold', final ? 'bg-muted text-foreground' : 'bg-destructive/12 text-destructive')}>
          {final ? <><Check size={13} strokeWidth={3} /> ผลสุดท้าย</> : <><Radio size={13} className="animate-pulse" /> ผลล่าสุด · ยังเปิดรับ</>}
        </span>
        {showTexts && pdpa.enabled && (
          <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/70 pt-2.5 text-[0.76rem] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
              <ShieldCheck size={14} className="text-primary" />
              ความยินยอม PDPA: {(summary.pdpaAcceptedCount ?? 0).toLocaleString('th-TH')}/{summary.totalResponses.toLocaleString('th-TH')} คน
            </span>
            {pdpa.marketingConsentEnabled && (
              <span>รับข่าวสารเพิ่มเติม: {(summary.marketingAcceptedCount ?? 0).toLocaleString('th-TH')} คน</span>
            )}
          </div>
        )}
        {voteQuestions > 0 && <p className="w-full text-[0.7rem] text-muted-foreground">ชี้ที่แถบหรือวงกลมเพื่อดูรายละเอียด · สีของตัวเลือกคงที่ ไม่เปลี่ยนตามอันดับ</p>}
      </div>

      {form.questions.map((q, idx) => {
        const s = summary.questions.find((x) => x.questionId === q.id);
        if (!s) return null;
        const mineVal = myAnswers?.[q.id];
        const mine = new Set(Array.isArray(mineVal) ? mineVal.map(String) : mineVal !== undefined ? [String(mineVal)] : []);
        const skipped = summary.totalResponses - s.answered;
        return (
          <section key={q.id} className="rounded-2xl border border-border bg-card p-3.5 sm:p-5">
            <header className="mb-4 flex items-baseline gap-2.5">
              <span className="shrink-0 text-[0.9rem] font-extrabold text-muted-foreground tabular-nums">{idx + 1}.</span>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold break-words">{q.title}</h3>
                <p className="text-[0.75rem] text-muted-foreground">
                  ตอบ {s.answered.toLocaleString('th-TH')} คน{skipped > 0 ? ` · ไม่ตอบ ${skipped.toLocaleString('th-TH')} คน` : ''}
                </p>
              </div>
            </header>

            {CHOICE_QUESTION_TYPES.includes(q.type) && s.counts && (
              <>
                <ChoiceResult q={q} s={s} mine={mine} final={final} />
                {showTexts && s.otherTexts && s.otherTexts.length > 0 && (
                  <div className="mt-3 border-t border-border pt-3">
                    <p className="mb-1.5 flex items-center gap-1.5 text-[0.78rem] font-semibold text-muted-foreground"><MessageSquareText size={13} /> คำตอบระบุเพิ่มเติม ({s.otherTexts.length})</p>
                    <TextList texts={s.otherTexts} />
                  </div>
                )}
              </>
            )}

            {q.type === 'rating' && s.counts && <RatingResult s={s} mine={mine} />}

            {(q.type === 'short_text' || q.type === 'long_text' || q.type === 'date') && (
              showTexts && s.texts ? <TextList texts={s.texts} /> : <p className="text-[0.85rem] text-muted-foreground">คำตอบแบบข้อความเห็นได้เฉพาะผู้ดูแล</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
