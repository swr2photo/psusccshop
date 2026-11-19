'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ExternalLink,
  Film,
  Layers,
  Loader2,
  Package,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { Product } from '@/lib/config';
import {
  FLAGSHIP_PRODUCTS,
  listFlagshipSlugs,
  type FlagshipHeroCopy,
  type FlagshipProductConfig,
  type FlagshipSide,
  type FlagshipStageCopy,
} from '@/lib/flagship/config';

interface FlagshipSettingsProps {
  products: Product[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  currentConfig?: any;
  onSaveSuccess?: () => void;
}

type Lang = 'th' | 'en';

const DEFAULT_SLUG = listFlagshipSlugs()[0] || 'scc-jersey-2026';

/** Built-in defaults for a slug (the page only exists for registered slugs). */
function baseConfig(slug: string): FlagshipProductConfig {
  const base = FLAGSHIP_PRODUCTS[slug];
  return structuredClone(
    base || {
      slug,
      framesFolder: `/flagship/${slug}/frames`,
      frameCount: 60,
      frameExt: 'webp',
      frameStep: 1,
      mobileFrameStep: 2,
      mobileMaxFrames: 28,
      brandLabel: { th: 'SCC Flagship', en: 'SCC Flagship' },
      stages: { th: [], en: [] },
    },
  );
}

/** Keep TH and EN stage lists the same length so each card edits both languages. */
function normalize(cfg: FlagshipProductConfig): FlagshipProductConfig {
  const th = [...(cfg.stages?.th || [])];
  const en = [...(cfg.stages?.en || [])];
  const n = Math.max(th.length, en.length);
  const blank = (side: FlagshipSide): FlagshipStageCopy => ({ side, eyebrow: '', title: '', body: '' });
  for (let i = 0; i < n; i++) {
    if (!th[i]) th[i] = blank(en[i]?.side || 'left');
    if (!en[i]) en[i] = blank(th[i]?.side || 'left');
  }
  return { ...cfg, stages: { th, en } };
}

function normalizeHeroCopy(saved?: FlagshipHeroCopy, base?: FlagshipHeroCopy): FlagshipHeroCopy {
  const baseHighlights = base?.highlights || ['', '', '', ''];
  const rawHighlights = saved?.highlights && saved.highlights.length > 0 ? saved.highlights : baseHighlights;
  const highlights = [0, 1, 2, 3].map((i) => rawHighlights[i] ?? baseHighlights[i] ?? '');
  return {
    topRightLabel: saved?.topRightLabel ?? base?.topRightLabel ?? '',
    eyebrow: saved?.eyebrow ?? base?.eyebrow ?? '',
    title: saved?.title ?? base?.title ?? '',
    subtitle: saved?.subtitle ?? base?.subtitle ?? '',
    captionRight: saved?.captionRight ?? base?.captionRight ?? '',
    heroImage: saved?.heroImage ?? base?.heroImage ?? '',
    ctaBuyLabel: saved?.ctaBuyLabel ?? base?.ctaBuyLabel ?? '',
    cta360Label: saved?.cta360Label ?? base?.cta360Label ?? '',
    highlights,
  };
}

function initialConfig(currentConfig?: { flagshipConfig?: Partial<FlagshipProductConfig> }): FlagshipProductConfig {
  const saved = currentConfig?.flagshipConfig;
  const slug = saved?.slug && FLAGSHIP_PRODUCTS[saved.slug] ? saved.slug : DEFAULT_SLUG;
  const base = baseConfig(slug);
  return normalize({
    ...base,
    ...(saved || {}),
    enabled: saved?.enabled ?? base.enabled ?? true,
    slug,
    brandLabel: { th: saved?.brandLabel?.th || base.brandLabel?.th || '', en: saved?.brandLabel?.en || base.brandLabel?.en || '' },
    heroCopy: {
      th: normalizeHeroCopy(saved?.heroCopy?.th, base.heroCopy?.th),
      en: normalizeHeroCopy(saved?.heroCopy?.en, base.heroCopy?.en),
    },
    stages: {
      th: saved?.stages?.th?.length ? saved.stages.th : base.stages.th,
      en: saved?.stages?.en?.length ? saved.stages.en : base.stages.en,
    },
  });
}

const clampInt = (v: unknown, min: number, max: number, fallback: number) => {
  if (v === undefined || v === null || v === '') return fallback;
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

// ───────────────────────── small building blocks ─────────────────────────

function Section({
  icon, title, description, children, action,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="mt-0.5 inline-flex shrink-0 items-center justify-center text-primary [&_svg]:size-[18px]">{icon}</span>
          <div className="min-w-0">
            <h3 className="text-[0.95rem] font-bold text-foreground">{title}</h3>
            {description && <p className="mt-0.5 text-[0.8rem] text-muted-foreground">{description}</p>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Field({ label, hint, htmlFor, children, className }: { label: string; hint?: React.ReactNode; htmlFor?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0 space-y-1.5', className)}>
      <Label htmlFor={htmlFor} className="text-[0.8rem] font-semibold text-foreground">{label}</Label>
      {children}
      {hint && <p className="text-[0.72rem] leading-snug text-muted-foreground">{hint}</p>}
    </div>
  );
}

const selectClass =
  'h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

function SideToggle({ value, onChange }: { value: FlagshipSide; onChange: (v: FlagshipSide) => void }) {
  return (
    <div role="radiogroup" aria-label="ตำแหน่งข้อความ" className="inline-flex rounded-lg border border-border bg-muted p-0.5 text-[0.75rem] font-semibold">
      {(['left', 'right'] as FlagshipSide[]).map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={value === s}
          onClick={() => onChange(s)}
          className={cn(
            'rounded-md px-2.5 py-1 transition-colors',
            value === s ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {s === 'left' ? 'ข้อความซ้าย' : 'ข้อความขวา'}
        </button>
      ))}
    </div>
  );
}

// ───────────────────────── live preview ─────────────────────────

function StagePreview({
  config, index, lang, onLang, onIndex,
}: {
  config: FlagshipProductConfig;
  index: number;
  lang: Lang;
  onLang: (l: Lang) => void;
  onIndex: (i: number) => void;
}) {
  const stages = config.stages[lang] || [];
  const stage = stages[index];
  const right = stage?.side === 'right';
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[0.85rem] font-bold text-foreground">ตัวอย่างหน้าจอ</p>
        <div className="inline-flex rounded-lg border border-border bg-muted p-0.5 text-[0.72rem] font-semibold">
          {(['th', 'en'] as Lang[]).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => onLang(l)}
              aria-pressed={lang === l}
              className={cn('rounded-md px-2.5 py-1', lang === l ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground')}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Fixed dark canvas — mirrors the real flagship page */}
      <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-[#05070d] text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(10,132,255,0.28),transparent_60%)]" />
        <div className="absolute left-1/2 top-1/2 grid size-[38%] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/10 bg-white/5">
          <Package className="size-1/3 text-white/40" aria-hidden />
        </div>
        <p className="absolute left-3 top-2.5 text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-white/50">
          {config.brandLabel?.[lang] || 'SCC Flagship'}
        </p>
        {stage ? (
          <div className={cn('absolute top-1/2 w-[42%] -translate-y-1/2 space-y-1', right ? 'right-[5%] text-right' : 'left-[5%]')}>
            {stage.eyebrow && <p className="text-[0.55rem] font-bold uppercase tracking-[0.2em] text-[#64b5ff]">{stage.eyebrow}</p>}
            <p className="text-[0.85rem] font-extrabold leading-tight sm:text-[0.95rem]">{stage.title || <span className="text-white/40">ยังไม่มีหัวข้อ</span>}</p>
            {stage.body && <p className="line-clamp-3 text-[0.6rem] leading-snug text-white/70">{stage.body}</p>}
          </div>
        ) : (
          <p className="absolute inset-x-0 bottom-3 text-center text-[0.7rem] text-white/50">ยังไม่มีจุดเด่น</p>
        )}
      </div>

      {stages.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5" aria-label="เลือกจุดเด่นที่จะดูตัวอย่าง">
          {stages.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onIndex(i)}
              aria-label={`จุดเด่นที่ ${i + 1}`}
              aria-current={i === index}
              className="grid h-6 min-w-6 place-items-center"
            >
              <span className={cn('h-2 rounded-full transition-all', i === index ? 'w-6 bg-primary' : 'w-2 bg-border')} />
            </button>
          ))}
        </div>
      )}
      <p className="mt-1 text-center text-[0.7rem] text-muted-foreground">
        จุดเด่นที่ {stages.length ? index + 1 : 0} จาก {stages.length} · ของจริงเป็นภาพหมุน 360°
      </p>
    </div>
  );
}

// ───────────────────────── main ─────────────────────────

export default function FlagshipSettings({ products, currentConfig, onSaveSuccess }: FlagshipSettingsProps) {
  const [config, setConfig] = useState<FlagshipProductConfig>(() => initialConfig(currentConfig));
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(initialConfig(currentConfig)));
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [previewLang, setPreviewLang] = useState<Lang>('th');
  const [previewIndex, setPreviewIndex] = useState(0);

  // Pick up a fresh server config (e.g. another admin saved) — only when nothing is being edited
  const incomingJson = useMemo(() => JSON.stringify(initialConfig(currentConfig)), [currentConfig]);
  const [lastIncoming, setLastIncoming] = useState(incomingJson);
  if (incomingJson !== lastIncoming) {
    setLastIncoming(incomingJson);
    if (JSON.stringify(config) === savedJson) {
      setConfig(JSON.parse(incomingJson));
      setSavedJson(incomingJson);
    }
  }

  const dirty = JSON.stringify(config) !== savedJson;
  const stageCount = config.stages.th.length;
  const safePreviewIndex = Math.min(previewIndex, Math.max(0, stageCount - 1));

  // Warn before leaving with unsaved edits
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const sortedProducts = useMemo(
    () => [...products].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'th')),
    [products],
  );
  const linkedProduct = products.find((p) => p.id === config.productId);
  const ext = config.frameExt || 'webp';
  const folder = (config.framesFolder || '').replace(/\/$/, '');
  const pad = (n: number) => String(n).padStart(4, '0');

  const patch = (p: Partial<FlagshipProductConfig>) => { setStatus(null); setConfig((c) => ({ ...c, ...p })); };

  const patchHeroCopy = (lang: Lang, p: Partial<FlagshipHeroCopy>) => {
    setStatus(null);
    setConfig((c) => {
      const currentHero = c.heroCopy || { th: normalizeHeroCopy(), en: normalizeHeroCopy() };
      return {
        ...c,
        heroCopy: {
          ...currentHero,
          [lang]: {
            ...(currentHero[lang] || {}),
            ...p,
          },
        },
      };
    });
  };

  const patchHeroHighlight = (lang: Lang, idx: number, value: string) => {
    setStatus(null);
    setConfig((c) => {
      const currentHero = c.heroCopy || { th: normalizeHeroCopy(), en: normalizeHeroCopy() };
      const list = [...(currentHero[lang]?.highlights || ['', '', '', ''])];
      while (list.length < 4) list.push('');
      list[idx] = value;
      return {
        ...c,
        heroCopy: {
          ...currentHero,
          [lang]: {
            ...(currentHero[lang] || {}),
            highlights: list,
          },
        },
      };
    });
  };

  const updateStage = (lang: Lang, i: number, field: keyof FlagshipStageCopy, value: string) => {
    setStatus(null);
    setConfig((c) => {
      const list = [...c.stages[lang]];
      list[i] = { ...list[i], [field]: value };
      return { ...c, stages: { ...c.stages, [lang]: list } };
    });
  };

  const setSide = (i: number, side: FlagshipSide) => {
    setStatus(null);
    setConfig((c) => ({
      ...c,
      stages: {
        th: c.stages.th.map((s, k) => (k === i ? { ...s, side } : s)),
        en: c.stages.en.map((s, k) => (k === i ? { ...s, side } : s)),
      },
    }));
    setPreviewIndex(i);
  };

  const addStage = () => {
    setStatus(null);
    const n = stageCount + 1;
    const side: FlagshipSide = config.stages.th[stageCount - 1]?.side === 'left' ? 'right' : 'left';
    const eyebrow = `Stage ${String(n).padStart(2, '0')}`;
    setConfig((c) => ({
      ...c,
      stages: {
        th: [...c.stages.th, { side, eyebrow, title: '', body: '' }],
        en: [...c.stages.en, { side, eyebrow, title: '', body: '' }],
      },
    }));
    setPreviewIndex(stageCount);
  };

  const removeStage = (i: number) => {
    setStatus(null);
    setConfig((c) => ({ ...c, stages: { th: c.stages.th.filter((_, k) => k !== i), en: c.stages.en.filter((_, k) => k !== i) } }));
    setPreviewIndex((p) => Math.max(0, p > i ? p - 1 : p));
  };

  const moveStage = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= stageCount) return;
    setStatus(null);
    const swap = <T,>(arr: T[]) => { const a = [...arr]; [a[i], a[j]] = [a[j], a[i]]; return a; };
    setConfig((c) => ({ ...c, stages: { th: swap(c.stages.th), en: swap(c.stages.en) } }));
    setPreviewIndex(j);
  };

  const missingTitles = config.stages.th.reduce(
    (n, s, i) => n + (s.title?.trim() ? 0 : 1) + (config.stages.en[i]?.title?.trim() ? 0 : 1),
    0,
  );

  const handleSave = async () => {
    if (missingTitles > 0) {
      setStatus({ type: 'error', text: `ยังมีหัวข้อจุดเด่นว่างอยู่ ${missingTitles} ช่อง (ต้องมีทั้งไทยและอังกฤษ)` });
      return;
    }
    setSaving(true);
    setStatus(null);
    try {
      const toSave: FlagshipProductConfig = {
        ...config,
        frameCount: clampInt(config.frameCount, 1, 600, 60),
        mobileMaxFrames: clampInt(config.mobileMaxFrames, 1, 600, 28),
      };
      const res = await apiFetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...currentConfig, flagshipConfig: toSave }),
      });
      const data = await res.json();
      if (!res.ok || data.status !== 'success') throw new Error(data.message || 'ไม่สามารถบันทึกการตั้งค่าได้');
      setConfig(toSave);
      setSavedJson(JSON.stringify(toSave));
      setStatus({ type: 'success', text: 'บันทึกแล้ว หน้า Flagship อัปเดตเรียบร้อย' });
      onSaveSuccess?.();
    } catch (err) {
      setStatus({ type: 'error', text: (err as Error).message || 'เกิดข้อผิดพลาดในการบันทึก' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEnabled = async (nextEnabled: boolean) => {
    const updatedConfig: FlagshipProductConfig = {
      ...config,
      enabled: nextEnabled,
      frameCount: clampInt(config.frameCount, 1, 600, 60),
      mobileMaxFrames: clampInt(config.mobileMaxFrames, 1, 600, 28),
    };
    setConfig(updatedConfig);
    setSaving(true);
    setStatus(null);
    try {
      const res = await apiFetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...currentConfig, flagshipConfig: updatedConfig }),
      });
      const data = await res.json();
      if (!res.ok || data.status !== 'success') throw new Error(data.message || 'ไม่สามารถบันทึกสถานะได้');
      setSavedJson(JSON.stringify(updatedConfig));
      setStatus({
        type: 'success',
        text: nextEnabled
          ? 'เปิดใช้งานหน้า Flagship และแสดงบนหน้าแรกเรียบร้อยแล้ว'
          : 'ปิดหน้า Flagship และซ่อนจากหน้าแรกเรียบร้อยแล้ว',
      });
      onSaveSuccess?.();
    } catch (err) {
      setStatus({ type: 'error', text: (err as Error).message || 'เกิดข้อผิดพลาดในการบันทึกสถานะ' });
    } finally {
      setSaving(false);
    }
  };

  const resetChanges = () => {
    setConfig(JSON.parse(savedJson));
    setStatus(null);
  };

  const isEnabled = config.enabled !== false;

  return (
    <div className="mx-auto w-full max-w-[1200px]">
      {/* Intro + Enable/Disable Toggle + page link */}
      <div className="mb-5 flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[0.95rem] font-bold text-foreground">สถานะหน้าสินค้า Flagship</h2>
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[0.72rem] font-bold',
                isEnabled
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                  : 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
              )}
            >
              <span className={cn('size-1.5 rounded-full', isEnabled ? 'bg-emerald-500' : 'bg-amber-500')} />
              {isEnabled ? 'เปิดใช้งานอยู่' : 'ปิดใช้งานชั่วคราว'}
            </span>
          </div>
          <p className="mt-1 text-[0.82rem] text-muted-foreground">
            {isEnabled
              ? 'แสดงแบนเนอร์ Flagship บนหน้าแรก ปุ่มเมนูบนแถบนำทาง และหน้าแนะนำสินค้า 360° ตามปกติ'
              : 'ซ่อนแบนเนอร์ Flagship บนหน้าแรก ซ่อนปุ่มเมนู Flagship และปิดการเข้าถึงหน้า /flagship ชั่วคราว'}
          </p>
          <p className="mt-1 truncate font-mono text-[0.78rem] text-foreground">/flagship/{config.slug}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            role="switch"
            aria-checked={isEnabled}
            disabled={saving}
            onClick={() => { void handleToggleEnabled(!isEnabled); }}
            className={cn(
              'inline-flex h-9 items-center gap-2.5 rounded-xl border px-3.5 text-[0.82rem] font-semibold transition-colors disabled:opacity-60',
              isEnabled
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300'
                : 'border-border bg-muted text-muted-foreground hover:text-foreground',
            )}
          >
            <span
              className={cn(
                'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
                isEnabled ? 'bg-emerald-500' : 'bg-muted-foreground/35',
              )}
            >
              <span
                className={cn(
                  'inline-block size-3.5 rounded-full bg-white shadow-sm transition-transform',
                  isEnabled ? 'translate-x-4' : 'translate-x-1',
                )}
              />
            </span>
            {isEnabled ? 'เปิดใช้งานหน้า Flagship' : 'ปิดหน้า Flagship'}
          </button>

          <Button asChild variant="outline" className="shrink-0">
            <a href={`/flagship/${config.slug}`} target="_blank" rel="noreferrer">
              <ExternalLink className="size-4" /> เปิดหน้าจริง
            </a>
          </Button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* ── Editor column ── */}
        <div className="min-w-0 space-y-5">
          <Section icon={<Package />} title="สินค้าและชื่อแบรนด์" description="สินค้าที่ปุ่มสั่งซื้อในหน้านี้จะเพิ่มลงตะกร้า">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="สินค้าที่เชื่อมโยง"
                htmlFor="fs-product"
                className="sm:col-span-2"
                hint={linkedProduct ? `ราคา ฿${linkedProduct.basePrice ?? 0} · รหัส ${linkedProduct.id}` : 'ถ้าไม่เลือก ระบบจะหาสินค้าที่ชื่อมีคำว่า jersey / SCC 2026 ให้อัตโนมัติ'}
              >
                <select id="fs-product" className={selectClass} value={config.productId || ''} onChange={(e) => patch({ productId: e.target.value })}>
                  <option value="">อัตโนมัติ (หาจากชื่อสินค้า)</option>
                  {sortedProducts.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} — ฿{p.basePrice ?? 0}</option>
                  ))}
                </select>
              </Field>
              <Field label="หน้า Flagship" htmlFor="fs-slug" hint="เลือกได้เฉพาะหน้าที่เตรียมไฟล์ภาพไว้แล้ว" className="sm:col-span-2">
                <select id="fs-slug" className={selectClass} value={config.slug} onChange={(e) => patch({ slug: e.target.value })}>
                  {listFlagshipSlugs().map((s) => <option key={s} value={s}>/flagship/{s}</option>)}
                </select>
              </Field>
              <Field label="ชื่อแบรนด์ (ไทย)" htmlFor="fs-brand-th">
                <Input id="fs-brand-th" value={config.brandLabel?.th || ''} maxLength={60} onChange={(e) => patch({ brandLabel: { th: e.target.value, en: config.brandLabel?.en || '' } })} placeholder="SCC Flagship 2026" />
              </Field>
              <Field label="ชื่อแบรนด์ (English)" htmlFor="fs-brand-en">
                <Input id="fs-brand-en" value={config.brandLabel?.en || ''} maxLength={60} onChange={(e) => patch({ brandLabel: { th: config.brandLabel?.th || '', en: e.target.value } })} placeholder="SCC Flagship 2026" />
              </Field>
            </div>
          </Section>

          <Section
            icon={<Package />}
            title="รายละเอียดและการแสดงผลบนหน้าแรก (Home Hero & จุดเด่น 4 ข้อ)"
            description="ปรับแต่งชื่อหัวข้อ คำอธิบาย ป้ายกำกับ รูปภาพปก ปุ่มสั่งซื้อ และแถบจุดเด่น 01–04 บนแบนเนอร์หน้าแรก"
            action={
              <div className="inline-flex rounded-lg border border-border bg-muted p-0.5 text-[0.72rem] font-semibold">
                {(['th', 'en'] as Lang[]).map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setPreviewLang(l)}
                    className={cn('rounded-md px-2.5 py-1', previewLang === l ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground')}
                  >
                    {l === 'th' ? 'ภาษาไทย' : 'English'}
                  </button>
                ))}
              </div>
            }
          >
            {(() => {
              const hc = config.heroCopy?.[previewLang] || normalizeHeroCopy();
              const isEn = previewLang === 'en';
              return (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      label={isEn ? 'หัวข้อหลัก (Hero Title - EN)' : 'หัวข้อหลัก (Hero Title - ไทย)'}
                      hint="เว้นว่างไว้เพื่อใช้ชื่อจากสินค้าที่เชื่อมโยงอัตโนมัติ (เช่น เสื้อกีฬา SCC 2026)"
                    >
                      <Input
                        value={hc.title || ''}
                        maxLength={80}
                        onChange={(e) => patchHeroCopy(previewLang, { title: e.target.value })}
                        placeholder={isEn ? (linkedProduct?.nameEn || linkedProduct?.name || 'SCC Jersey 2026') : (linkedProduct?.name || 'เสื้อกีฬา SCC 2026')}
                      />
                    </Field>
                    <Field
                      label={isEn ? 'ป้ายกำกับเหนือหัวข้อ (Eyebrow - EN)' : 'ป้ายกำกับเหนือหัวข้อ (Eyebrow - ไทย)'}
                    >
                      <Input
                        value={hc.eyebrow || ''}
                        maxLength={60}
                        onChange={(e) => patchHeroCopy(previewLang, { eyebrow: e.target.value })}
                        placeholder={isEn ? 'No. 01 — New this season' : 'No. 01 — ของใหม่ประจำปี'}
                      />
                    </Field>
                    <Field
                      label={isEn ? 'คำอธิบาย / รายละเอียด (Subtitle - EN)' : 'คำอธิบาย / รายละเอียด (Subtitle - ไทย)'}
                      className="sm:col-span-2"
                    >
                      <Textarea
                        value={hc.subtitle || ''}
                        maxLength={240}
                        rows={2}
                        onChange={(e) => patchHeroCopy(previewLang, { subtitle: e.target.value })}
                        placeholder={
                          isEn
                            ? 'Pre-order the SCC 2026 jersey — pick a size, add your name, pay in a minute.'
                            : 'พร้อมจองเสื้อกีฬา SCC 2026 — เลือกไซส์ ใส่ชื่อ และชำระง่าย'
                        }
                      />
                    </Field>
                    <Field label={isEn ? 'ป้ายมุมขวาบน (Top Right Label - EN)' : 'ป้ายมุมขวาบน (Top Right Label - ไทย)'}>
                      <Input
                        value={hc.topRightLabel || ''}
                        maxLength={40}
                        onChange={(e) => patchHeroCopy(previewLang, { topRightLabel: e.target.value })}
                        placeholder={isEn ? 'Merch / 2026' : 'ของชุมนุม / 2026'}
                      />
                    </Field>
                    <Field label={isEn ? 'ข้อความใต้ภาพมุมขวา (Image Caption - EN)' : 'ข้อความใต้ภาพมุมขวา (Image Caption - ไทย)'}>
                      <Input
                        value={hc.captionRight || ''}
                        maxLength={50}
                        onChange={(e) => patchHeroCopy(previewLang, { captionRight: e.target.value })}
                        placeholder="NEW JERSEY 2026"
                      />
                    </Field>
                    <Field label={isEn ? 'ข้อความปุ่มสั่งซื้อหลัก (Primary CTA - EN)' : 'ข้อความปุ่มสั่งซื้อหลัก (Primary CTA - ไทย)'}>
                      <Input
                        value={hc.ctaBuyLabel || ''}
                        maxLength={40}
                        onChange={(e) => patchHeroCopy(previewLang, { ctaBuyLabel: e.target.value })}
                        placeholder={isEn ? 'Order jersey' : 'สั่งจองเสื้อ'}
                      />
                    </Field>
                    <Field label={isEn ? 'ข้อความปุ่มลิงก์ 360° (360° Link - EN)' : 'ข้อความปุ่มลิงก์ 360° (360° Link - ไทย)'}>
                      <Input
                        value={hc.cta360Label || ''}
                        maxLength={40}
                        onChange={(e) => patchHeroCopy(previewLang, { cta360Label: e.target.value })}
                        placeholder={isEn ? 'Spin it 360°' : 'หมุนดูแบบ 360°'}
                      />
                    </Field>
                    <Field
                      label="ลิงก์รูปภาพปกบนหน้าแรก (Hero Image URL)"
                      hint="เว้นว่างไว้เพื่อใช้รูปปกของสินค้าที่เชื่อมโยงอัตโนมัติ"
                      className="sm:col-span-2"
                    >
                      <Input
                        value={hc.heroImage || ''}
                        onChange={(e) => {
                          patchHeroCopy('th', { heroImage: e.target.value });
                          patchHeroCopy('en', { heroImage: e.target.value });
                        }}
                        placeholder={linkedProduct?.coverImage || 'https://...'}
                        className="font-mono text-[0.82rem]"
                      />
                    </Field>
                  </div>

                  <div className="rounded-xl border border-border bg-muted/30 p-3.5">
                    <p className="mb-2.5 text-[0.8rem] font-bold text-foreground">
                      แถบจุดเด่น 4 ข้อใต้แบนเนอร์ (01 – 04 Highlights · {isEn ? 'English' : 'ภาษาไทย'})
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {[0, 1, 2, 3].map((idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="shrink-0 rounded-md bg-primary/10 px-2 py-1 font-mono text-[0.72rem] font-bold text-primary">
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                          <Input
                            value={hc.highlights?.[idx] ?? ''}
                            maxLength={60}
                            onChange={(e) => patchHeroHighlight(previewLang, idx, e.target.value)}
                            placeholder={`จุดเด่นข้อที่ ${idx + 1}`}
                            className="h-8 text-[0.82rem]"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}
          </Section>

          <Section icon={<Film />} title="ภาพหมุน 360°" description="ภาพแต่ละเฟรมเรียงกันเป็นแอนิเมชันตอนเลื่อนหน้าจอ">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Field label="โฟลเดอร์ภาพ" htmlFor="fs-folder" className="sm:col-span-2">
                <Input id="fs-folder" value={config.framesFolder || ''} onChange={(e) => patch({ framesFolder: e.target.value })} placeholder={`/flagship/${config.slug}/frames`} className="font-mono text-[0.85rem]" />
              </Field>
              <Field label="จำนวนเฟรม" htmlFor="fs-count">
                <Input
                  id="fs-count" type="number" inputMode="numeric" min={1} max={600}
                  value={config.frameCount ?? ''}
                  onChange={(e) => patch({ frameCount: e.target.value === '' ? undefined : Number(e.target.value) })}
                  onBlur={() => patch({ frameCount: clampInt(config.frameCount, 1, 600, 60) })}
                />
              </Field>
              <Field label="ชนิดไฟล์" htmlFor="fs-ext">
                <select id="fs-ext" className={selectClass} value={ext} onChange={(e) => patch({ frameExt: e.target.value as FlagshipProductConfig['frameExt'] })}>
                  <option value="webp">WebP (แนะนำ)</option>
                  <option value="jpg">JPG</option>
                  <option value="png">PNG</option>
                </select>
              </Field>
              <Field label="เฟรมสูงสุดบนมือถือ" htmlFor="fs-mobile" hint="น้อยลง = มือถือโหลดเร็วขึ้น">
                <Input
                  id="fs-mobile" type="number" inputMode="numeric" min={1} max={600}
                  value={config.mobileMaxFrames ?? ''}
                  onChange={(e) => patch({ mobileMaxFrames: e.target.value === '' ? undefined : Number(e.target.value) })}
                  onBlur={() => patch({ mobileMaxFrames: clampInt(config.mobileMaxFrames, 1, 600, 28) })}
                />
              </Field>
              <div className="min-w-0 rounded-xl border border-dashed border-border bg-muted/50 p-3 text-[0.75rem] text-muted-foreground sm:col-span-2 xl:col-span-3">
                ไฟล์ที่ระบบจะโหลด
                <span className="mt-1 block break-all font-mono text-foreground">{folder || '/…'}/frame_{pad(1)}.{ext}</span>
                <span className="block break-all font-mono text-foreground">ถึง {folder || '/…'}/frame_{pad(clampInt(config.frameCount, 1, 600, 60))}.{ext}</span>
              </div>
            </div>
          </Section>

          <Section
            icon={<Layers />}
            title="ข้อความจุดเด่นตามการเลื่อน"
            description="จุดเด่นจะโผล่ทีละช่วงขณะเลื่อนหน้า แก้ภาษาไทยและอังกฤษได้ในการ์ดเดียวกัน"
            action={<Button type="button" variant="outline" size="sm" onClick={addStage}><Plus className="size-4" /> เพิ่มจุดเด่น</Button>}
          >
            {stageCount === 0 ? (
              <div className="rounded-xl border border-dashed border-border py-10 text-center text-[0.85rem] text-muted-foreground">
                ยังไม่มีจุดเด่น — กด “เพิ่มจุดเด่น” เพื่อเริ่ม
              </div>
            ) : (
              <ol className="space-y-3">
                {config.stages.th.map((th, i) => {
                  const en = config.stages.en[i];
                  const active = i === safePreviewIndex;
                  return (
                    <li
                      key={i}
                      onFocusCapture={() => setPreviewIndex(i)}
                      className={cn('rounded-xl border bg-background p-3 transition-colors sm:p-4', active ? 'border-primary/50 ring-1 ring-primary/20' : 'border-border')}
                    >
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <button type="button" onClick={() => setPreviewIndex(i)} className="rounded-md bg-primary/10 px-2 py-0.5 text-[0.75rem] font-bold text-primary">
                          จุดเด่นที่ {i + 1}
                        </button>
                        <SideToggle value={th.side} onChange={(s) => setSide(i, s)} />
                        <div className="ml-auto flex items-center">
                          <Button type="button" variant="ghost" size="icon" aria-label="เลื่อนขึ้น" disabled={i === 0} onClick={() => moveStage(i, -1)}><ArrowUp className="size-4" /></Button>
                          <Button type="button" variant="ghost" size="icon" aria-label="เลื่อนลง" disabled={i === stageCount - 1} onClick={() => moveStage(i, 1)}><ArrowDown className="size-4" /></Button>
                          <Button type="button" variant="ghost" size="icon" aria-label="ลบจุดเด่นนี้" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => removeStage(i)}><Trash2 className="size-4" /></Button>
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        {([['th', th, 'ภาษาไทย'], ['en', en, 'English']] as const).map(([lang, s, label]) => (
                          <fieldset key={lang} className="min-w-0 space-y-2 rounded-lg bg-muted/40 p-3">
                            <legend className="mb-1 text-[0.7rem] font-bold uppercase tracking-wider text-muted-foreground">{label}</legend>
                            <Input
                              aria-label={`ป้ายเล็ก (${label})`}
                              value={s?.eyebrow || ''}
                              maxLength={40}
                              onChange={(e) => updateStage(lang, i, 'eyebrow', e.target.value)}
                              placeholder="ป้ายเล็ก เช่น Cool Elite"
                              className="h-8 text-[0.8rem]"
                            />
                            <Input
                              aria-label={`หัวข้อ (${label})`}
                              value={s?.title || ''}
                              maxLength={80}
                              onChange={(e) => updateStage(lang, i, 'title', e.target.value)}
                              placeholder={lang === 'th' ? 'หัวข้อ เช่น เนื้อผ้า Cool Elite' : 'Title, e.g. Cool Elite fabric'}
                              aria-invalid={status?.type === 'error' && !s?.title?.trim() ? true : undefined}
                              className="font-semibold"
                            />
                            <Textarea
                              aria-label={`รายละเอียด (${label})`}
                              value={s?.body || ''}
                              maxLength={240}
                              rows={2}
                              onChange={(e) => updateStage(lang, i, 'body', e.target.value)}
                              placeholder={lang === 'th' ? 'คำอธิบายสั้นๆ' : 'Short description'}
                              className="min-h-[64px] text-[0.85rem]"
                            />
                          </fieldset>
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </Section>
        </div>

        {/* ── Preview column (sticky on desktop) ── */}
        <aside className="min-w-0 lg:sticky lg:top-4 lg:self-start">
          <StagePreview config={config} index={safePreviewIndex} lang={previewLang} onLang={setPreviewLang} onIndex={setPreviewIndex} />
        </aside>
      </div>

      {/* Sticky save bar */}
      <div className="sticky bottom-0 z-20 mt-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
        <div
          className={cn(
            'flex flex-wrap items-center gap-3 rounded-2xl border bg-card/95 p-3 shadow-lg backdrop-blur',
            status?.type === 'error' ? 'border-destructive/40' : dirty ? 'border-primary/40' : 'border-border',
          )}
        >
          <div className="flex min-w-0 flex-1 basis-56 items-center gap-2 text-[0.85rem]" role="status" aria-live="polite">
            {status?.type === 'error' ? (
              <><AlertCircle className="size-4 shrink-0 text-destructive" /><span className="text-destructive">{status.text}</span></>
            ) : status?.type === 'success' && !dirty ? (
              <><CheckCircle2 className="size-4 shrink-0 text-success" /><span className="text-foreground">{status.text}</span></>
            ) : dirty ? (
              <><span className="size-2 shrink-0 rounded-full bg-primary" /><span className="text-foreground">มีการแก้ไขที่ยังไม่ได้บันทึก</span></>
            ) : (
              <span className="text-muted-foreground">ไม่มีการเปลี่ยนแปลง</span>
            )}
          </div>
          <div className="flex w-full gap-2 sm:w-auto">
            {dirty && (
              <Button type="button" variant="ghost" onClick={resetChanges} disabled={saving} className="flex-1 sm:flex-none">
                <RotateCcw className="size-4" /> ยกเลิกการแก้ไข
              </Button>
            )}
            <Button type="button" onClick={() => void handleSave()} disabled={saving || !dirty} className="flex-1 font-bold sm:flex-none">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} บันทึก
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
