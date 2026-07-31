'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Clock,
  Download,
  FileText,
  Lock,
  Mail,
  Printer,
  Search,
  Settings,
  Shield,
  Trash2,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useTranslation } from '@/hooks/useTranslation';
import { CONTENT } from '@/lib/privacy-policy-content';
import { apiFetch } from '@/lib/api-client';
import { useNotification } from '@/components/NotificationContext';
import { cn } from '@/lib/utils';

const UI = {
  th: {
    toc: 'สารบัญ',
    searchPlaceholder: 'ค้นหานโยบาย เช่น คุกกี้, คืนเงิน, Gemini AI...',
    searchEmpty: 'ไม่พบหัวข้อที่ตรงกับคำค้นหา',
    print: 'พิมพ์ / PDF',
    exportJson: 'ส่งออกข้อมูล (JSON)',
    consentSettings: 'ปรับแต่งความยินยอม',
    deleteRequest: 'ยื่นขอลบข้อมูล',
    actionsTitle: 'ใช้สิทธิ์ PDPA',
    actionsHint: 'สำหรับผู้ใช้ที่เข้าสู่ระบบแล้ว — ดำเนินการได้ทันทีจากหนนี้',
    loginRequired: 'กรุณาเข้าสู่ระบบก่อนใช้สิทธิ์นี้',
    exportOk: 'ดาวน์โหลดข้อมูลเรียบร้อยแล้ว',
    exportFail: 'ส่งออกข้อมูลไม่สำเร็จ',
    deleteConfirm: 'ยืนยันส่งคำขอลบข้อมูลส่วนบุคคล? ข้อมูลคำสั่งซื้ออาจยังถูกเก็บตามกฎหมาย (2 ปี)',
    deleteOk: 'ส่งคำขอลบข้อมูลเรียบร้อยแล้ว',
    deleteFail: 'ส่งคำขอลบไม่สำเร็จ',
    working: 'กำลังดำเนินการ...',
    matchCount: 'พบ',
    sections: 'หัวข้อ',
    onThisPage: 'ในหน้านี้',
  },
  en: {
    toc: 'On this page',
    searchPlaceholder: 'Search policy e.g. cookies, refund, Gemini AI...',
    searchEmpty: 'No matching sections',
    print: 'Print / PDF',
    exportJson: 'Export data (JSON)',
    consentSettings: 'Consent settings',
    deleteRequest: 'Request data deletion',
    actionsTitle: 'Exercise PDPA rights',
    actionsHint: 'Signed-in users can take action directly from this page',
    loginRequired: 'Please sign in to use this action',
    exportOk: 'Your data download is ready',
    exportFail: 'Export failed',
    deleteConfirm: 'Submit a personal data deletion request? Order records may still be retained for legal reasons (2 years).',
    deleteOk: 'Deletion request submitted',
    deleteFail: 'Deletion request failed',
    working: 'Working...',
    matchCount: 'Found',
    sections: 'sections',
    onThisPage: 'On this page',
  },
} as const;

type SectionId =
  | 'intro'
  | 's1'
  | 's2'
  | 's3'
  | 's4'
  | 's5'
  | 's6'
  | 's7'
  | 's8'
  | 's9'
  | 's10'
  | 's11'
  | 's12';

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="my-3 space-y-2 pl-0">
      {items.map((text) => (
        <li
          key={text}
          className="relative list-none pl-4 text-[0.95rem] leading-relaxed text-[var(--foreground)] before:absolute before:left-0 before:top-[0.65em] before:size-1.5 before:rounded-full before:bg-[var(--text-muted)]"
        >
          {text}
        </li>
      ))}
    </ul>
  );
}

function DefinitionList({
  items,
}: {
  items: Array<{ primary: string; secondary: string }>;
}) {
  return (
    <dl className="my-3 divide-y divide-[var(--glass-border)] rounded-lg border border-[var(--glass-border)]">
      {items.map((item) => (
        <div key={item.primary} className="px-4 py-3">
          <dt className="text-sm font-semibold text-[var(--foreground)]">{item.primary}</dt>
          <dd className="mt-0.5 text-sm leading-relaxed text-[var(--text-muted)]">{item.secondary}</dd>
        </div>
      ))}
    </dl>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 scroll-mt-28 border-b border-[var(--glass-border)] pb-2 text-xl font-bold tracking-tight text-[var(--foreground)]">
      {children}
    </h2>
  );
}

export default function PrivacyPolicyPage() {
  const router = useRouter();
  const { lang } = useTranslation();
  const { status } = useSession();
  const { success, error, reopenConsentSettings } = useNotification();
  const c = CONTENT[lang];
  const ui = UI[lang];
  const [query, setQuery] = useState('');
  const [activeId, setActiveId] = useState<SectionId>('intro');
  const [busy, setBusy] = useState<'export' | 'delete' | null>(null);
  const [mobileTocOpen, setMobileTocOpen] = useState(false);

  const toc = useMemo(
    () =>
      [
        { id: 'intro' as const, title: lang === 'th' ? 'บทนำ' : 'Introduction' },
        { id: 's1' as const, title: c.s1.title },
        { id: 's2' as const, title: c.s2.title },
        { id: 's3' as const, title: c.s3.title },
        { id: 's4' as const, title: c.s4.title },
        { id: 's5' as const, title: c.s5.title },
        { id: 's6' as const, title: c.s6.title },
        { id: 's7' as const, title: c.s7.title },
        { id: 's8' as const, title: c.s8.title },
        { id: 's9' as const, title: c.s9.title },
        { id: 's10' as const, title: c.s10.title },
        { id: 's11' as const, title: c.s11.title },
        { id: 's12' as const, title: c.s12.title },
      ] as const,
    [c, lang],
  );

  const sectionSearchText = useMemo(() => {
    const map: Record<SectionId, string> = {
      intro: [c.intro, c.promise.title, c.promise.text].join(' '),
      s1: [c.s1.title, c.s1.desc, ...c.s1.direct.map((i) => `${i.primary} ${i.secondary}`), ...c.s1.auto.map((i) => `${i.primary} ${i.secondary}`), ...c.s1.order.map((i) => `${i.primary} ${i.secondary}`)].join(' '),
      s2: [c.s2.title, ...c.s2.items].join(' '),
      s3: [c.s3.title, c.s3.desc, c.s3.note, ...c.s3.providers.map((p) => `${p.provider} ${p.data} ${p.note}`)].join(' '),
      s4: [c.s4.title, c.s4.aiTitle, ...c.s4.aiItems, c.s4.supportTitle, ...c.s4.supportItems].join(' '),
      s5: [c.s5.title, ...c.s5.items.map((i) => `${i.type} ${i.duration} ${i.note}`), c.s5.autoClean.title, c.s5.autoClean.text].join(' '),
      s6: [c.s6.title, c.s6.desc, ...c.s6.rights.map((r) => `${r.title} ${r.desc}`), c.s6.howToTitle, c.s6.howTo].join(' '),
      s7: [c.s7.title, c.s7.desc, ...c.s7.items].join(' '),
      s8: [c.s8.title, c.s8.desc, ...c.s8.types.map((t) => `${t.type} ${t.desc}`), c.s8.manage].join(' '),
      s9: [c.s9.title, c.s9.desc, ...c.s9.parties.map((p) => `${p.party} ${p.purpose} ${p.data}`), c.s9.noteText].join(' '),
      s10: [c.s10.title, c.s10.paymentTitle, ...c.s10.paymentItems, c.s10.shippingTitle, ...c.s10.shippingItems].join(' '),
      s11: [c.s11.title, c.s11.desc, c.s11.orgName, c.s11.orgAddr].join(' '),
      s12: [c.s12.title, c.s12.desc, c.s12.v3.desc, c.s12.v2.desc, c.s12.v1.desc].join(' '),
    };
    return map;
  }, [c]);

  const filteredToc = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return toc;
    return toc.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        (sectionSearchText[item.id] || '').toLowerCase().includes(q),
    );
  }, [toc, query, sectionSearchText]);

  useEffect(() => {
    const ids = toc.map((t) => t.id);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target?.id) {
          setActiveId(visible[0].target.id as SectionId);
        }
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: [0, 0.25, 0.5, 1] },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [toc]);

  const scrollTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveId(id as SectionId);
    setMobileTocOpen(false);
  }, []);

  const handlePrint = () => window.print();

  const requireAuth = () => {
    if (status !== 'authenticated') {
      error(ui.loginRequired);
      return false;
    }
    return true;
  };

  const handleExport = async () => {
    if (!requireAuth()) return;
    setBusy('export');
    try {
      const res = await apiFetch('/api/privacy/data-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'download' }),
      });
      const json = await res.json();
      if (!res.ok || json.status !== 'success') {
        error(json.message || ui.exportFail);
        return;
      }
      const blob = new Blob([JSON.stringify(json.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `scc-shop-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      success(ui.exportOk);
    } catch {
      error(ui.exportFail);
    } finally {
      setBusy(null);
    }
  };

  const handleDeleteRequest = async () => {
    if (!requireAuth()) return;
    if (!window.confirm(ui.deleteConfirm)) return;
    setBusy('delete');
    try {
      const res = await apiFetch('/api/privacy/data-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request', type: 'delete' }),
      });
      const json = await res.json();
      if (!res.ok || json.status !== 'success') {
        error(json.message || ui.deleteFail);
        return;
      }
      success(ui.deleteOk);
    } catch {
      error(ui.deleteFail);
    } finally {
      setBusy(null);
    }
  };

  const handleConsent = () => {
    reopenConsentSettings();
  };

  return (
    <div className="min-h-dvh bg-[var(--background)] text-[var(--foreground)]">
      {/* Top bar */}
      <header className="privacy-chrome sticky top-0 z-40 border-b border-[var(--glass-border)] bg-[var(--background)]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push('/')}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
            >
              <ArrowLeft size={16} />
              {c.backHome}
            </button>
            <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--glass-border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--surface-2)]"
              >
                <Printer size={14} />
                <span className="hidden sm:inline">{ui.print}</span>
              </button>
              <button
                type="button"
                onClick={handleExport}
                disabled={busy === 'export'}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--glass-border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--surface-2)] disabled:opacity-50"
              >
                <Download size={14} />
                <span className="hidden sm:inline">{busy === 'export' ? ui.working : ui.exportJson}</span>
              </button>
            </div>
          </div>

          <div className="relative">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={ui.searchPlaceholder}
              className="h-10 w-full rounded-xl border border-[var(--glass-border)] bg-[var(--surface)] pl-9 pr-9 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--foreground)]/30"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-[var(--text-muted)] hover:bg-[var(--surface-2)]"
                aria-label="Clear"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {query.trim() && (
            <p className="text-xs text-[var(--text-muted)]">
              {ui.matchCount} {filteredToc.length} {ui.sections}
            </p>
          )}
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-6 sm:px-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:py-10">
        {/* Sticky TOC */}
        <aside className="privacy-chrome lg:sticky lg:top-28 lg:self-start">
          <button
            type="button"
            className="mb-3 flex w-full items-center justify-between rounded-lg border border-[var(--glass-border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold lg:hidden"
            onClick={() => setMobileTocOpen((v) => !v)}
          >
            {ui.toc}
            <span className="text-xs text-[var(--text-muted)]">{activeId}</span>
          </button>

          <nav
            className={cn(
              'rounded-xl border border-[var(--glass-border)] bg-[var(--surface)] p-3',
              mobileTocOpen ? 'block' : 'hidden lg:block',
            )}
            aria-label={ui.toc}
          >
            <p className="mb-2 hidden px-2 text-[0.7rem] font-bold uppercase tracking-wider text-[var(--text-muted)] lg:block">
              {ui.onThisPage}
            </p>
            {filteredToc.length === 0 ? (
              <p className="px-2 py-3 text-sm text-[var(--text-muted)]">{ui.searchEmpty}</p>
            ) : (
              <ul className="max-h-[70vh] space-y-0.5 overflow-auto">
                {filteredToc.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => scrollTo(item.id)}
                      className={cn(
                        'w-full rounded-md px-2.5 py-1.5 text-left text-[0.8rem] leading-snug transition-colors',
                        activeId === item.id
                          ? 'bg-[var(--foreground)]/8 font-semibold text-[var(--foreground)]'
                          : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]',
                      )}
                    >
                      {item.title}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </nav>
        </aside>

        {/* Main content */}
        <main className="privacy-doc min-w-0">
          <div className="mb-8">
            <div className="mb-3 flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-xl bg-[#2563eb] text-white shadow-sm">
                <Shield size={22} />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{c.title}</h1>
                <p className="text-sm text-[var(--text-muted)]">{c.subtitle}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 text-sm text-[var(--text-muted)]">
              <span className="inline-flex items-center gap-1.5">
                <Clock size={14} />
                {c.updatedLabel}: {c.lastUpdated}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <FileText size={14} />
                {c.versionLabel} {c.version}
              </span>
            </div>
          </div>

          {/* Quick PDPA actions */}
          <section className="privacy-chrome mb-10 rounded-2xl border border-[var(--glass-border)] bg-[var(--surface)] p-4 sm:p-5">
            <h2 className="mb-1 text-sm font-bold text-[var(--foreground)]">{ui.actionsTitle}</h2>
            <p className="mb-4 text-xs text-[var(--text-muted)]">{ui.actionsHint}</p>
            <div className="grid gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={handleExport}
                disabled={busy === 'export'}
                className="flex items-start gap-2.5 rounded-xl border border-[var(--glass-border)] bg-[var(--background)] p-3 text-left hover:border-[#2563eb]/40 disabled:opacity-50"
              >
                <Download size={18} className="mt-0.5 shrink-0 text-[#2563eb]" />
                <span className="text-sm font-semibold leading-snug">{ui.exportJson}</span>
              </button>
              <button
                type="button"
                onClick={handleConsent}
                className="flex items-start gap-2.5 rounded-xl border border-[var(--glass-border)] bg-[var(--background)] p-3 text-left hover:border-[#2563eb]/40"
              >
                <Settings size={18} className="mt-0.5 shrink-0 text-[#2563eb]" />
                <span className="text-sm font-semibold leading-snug">{ui.consentSettings}</span>
              </button>
              <button
                type="button"
                onClick={handleDeleteRequest}
                disabled={busy === 'delete'}
                className="flex items-start gap-2.5 rounded-xl border border-[var(--glass-border)] bg-[var(--background)] p-3 text-left hover:border-red-500/40 disabled:opacity-50"
              >
                <Trash2 size={18} className="mt-0.5 shrink-0 text-red-500" />
                <span className="text-sm font-semibold leading-snug">{ui.deleteRequest}</span>
              </button>
            </div>
          </section>

          {/* Intro */}
          <section id="intro" className="mb-10 scroll-mt-28">
            <SectionHeading>{lang === 'th' ? 'บทนำ' : 'Introduction'}</SectionHeading>
            <p className="text-[0.98rem] leading-[1.8] text-[var(--foreground)]">{c.intro}</p>
            <aside className="mt-4 rounded-xl border border-[var(--glass-border)] bg-[var(--surface)] px-4 py-3 text-sm leading-relaxed text-[var(--text-muted)]">
              <strong className="text-[var(--foreground)]">{c.promise.title}</strong> {c.promise.text}
            </aside>
          </section>

          {/* S1 */}
          <section id="s1" className="mb-10 scroll-mt-28">
            <SectionHeading>{c.s1.title}</SectionHeading>
            <p className="mb-4 text-[0.95rem] leading-relaxed text-[var(--text-muted)]">{c.s1.desc}</p>
            <h3 className="mb-2 text-sm font-bold text-[var(--foreground)]">{c.s1.directTitle}</h3>
            <DefinitionList items={c.s1.direct} />
            <h3 className="mb-2 mt-5 text-sm font-bold text-[var(--foreground)]">{c.s1.autoTitle}</h3>
            <DefinitionList items={c.s1.auto} />
            <h3 className="mb-2 mt-5 text-sm font-bold text-[var(--foreground)]">{c.s1.orderTitle}</h3>
            <DefinitionList items={c.s1.order} />
          </section>

          {/* S2 */}
          <section id="s2" className="mb-10 scroll-mt-28">
            <SectionHeading>{c.s2.title}</SectionHeading>
            <BulletList items={[...c.s2.items]} />
          </section>

          {/* S3 */}
          <section id="s3" className="mb-10 scroll-mt-28">
            <SectionHeading>{c.s3.title}</SectionHeading>
            <p className="mb-4 text-[0.95rem] leading-relaxed text-[var(--text-muted)]">{c.s3.desc}</p>
            <div className="overflow-hidden rounded-lg border border-[var(--glass-border)]">
              {c.s3.providers.map((item) => (
                <div
                  key={item.provider}
                  className="flex flex-col gap-1 border-b border-[var(--glass-border)] px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-semibold">{item.provider}</p>
                    <p className="text-sm text-[var(--text-muted)]">{item.data}</p>
                  </div>
                  <span className="w-fit rounded-md bg-[var(--surface-2)] px-2 py-0.5 text-[0.7rem] text-[var(--text-muted)]">
                    {item.note}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm leading-relaxed text-[var(--text-muted)]">{c.s3.note}</p>
          </section>

          {/* S4 */}
          <section id="s4" className="mb-10 scroll-mt-28">
            <SectionHeading>{c.s4.title}</SectionHeading>
            <h3 className="mb-2 text-sm font-bold">{c.s4.aiTitle}</h3>
            <BulletList items={[...c.s4.aiItems]} />
            <h3 className="mb-2 mt-5 text-sm font-bold">{c.s4.supportTitle}</h3>
            <BulletList items={[...c.s4.supportItems]} />
          </section>

          {/* S5 */}
          <section id="s5" className="mb-10 scroll-mt-28">
            <SectionHeading>{c.s5.title}</SectionHeading>
            <div className="overflow-hidden rounded-lg border border-[var(--glass-border)]">
              {c.s5.items.map((item) => (
                <div
                  key={item.type}
                  className="flex flex-col gap-1 border-b border-[var(--glass-border)] px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-semibold">{item.type}</p>
                    <p className="text-sm text-[var(--text-muted)]">{item.note}</p>
                  </div>
                  <span className="text-sm font-medium text-[var(--foreground)]">{item.duration}</span>
                </div>
              ))}
            </div>
            <aside className="mt-4 rounded-xl border border-[var(--glass-border)] bg-[var(--surface)] px-4 py-3 text-sm leading-relaxed text-[var(--text-muted)]">
              <strong className="text-[var(--foreground)]">{c.s5.autoClean.title}</strong> {c.s5.autoClean.text}
            </aside>
          </section>

          {/* S6 */}
          <section id="s6" className="mb-10 scroll-mt-28">
            <SectionHeading>{c.s6.title}</SectionHeading>
            <p className="mb-4 text-[0.95rem] leading-relaxed text-[var(--text-muted)]">{c.s6.desc}</p>
            <div className="space-y-3">
              {c.s6.rights.map((right) => (
                <div key={right.title} className="rounded-lg border border-[var(--glass-border)] px-4 py-3">
                  <p className="font-semibold">{right.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--text-muted)]">{right.desc}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-xl border border-[var(--glass-border)] bg-[var(--surface)] px-4 py-4">
              <p className="mb-2 text-sm font-bold">{c.s6.howToTitle}</p>
              <p className="text-sm leading-relaxed text-[var(--text-muted)] whitespace-pre-line">
                {c.s6.howTo}{' '}
                <a className="font-semibold text-[var(--foreground)] underline" href="mailto:psuscc@psuscc.club">
                  psuscc@psuscc.club
                </a>{' '}
                {c.s6.howToSuffix}
                {'\n'}
                {c.s6.howToDeadline}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleExport}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--foreground)] px-3 py-2 text-xs font-semibold text-[var(--background)]"
                >
                  <Download size={14} />
                  {ui.exportJson}
                </button>
                <button
                  type="button"
                  onClick={handleConsent}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--glass-border)] px-3 py-2 text-xs font-semibold"
                >
                  <Lock size={14} />
                  {ui.consentSettings}
                </button>
                <button
                  type="button"
                  onClick={handleDeleteRequest}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-2 text-xs font-semibold text-red-500"
                >
                  <Trash2 size={14} />
                  {ui.deleteRequest}
                </button>
              </div>
            </div>
          </section>

          {/* S7 */}
          <section id="s7" className="mb-10 scroll-mt-28">
            <SectionHeading>{c.s7.title}</SectionHeading>
            <p className="mb-3 text-[0.95rem] leading-relaxed text-[var(--text-muted)]">{c.s7.desc}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {c.s7.items.map((text) => (
                <div
                  key={text}
                  className="rounded-lg border border-[var(--glass-border)] px-3 py-2.5 text-sm text-[var(--foreground)]"
                >
                  {text}
                </div>
              ))}
            </div>
          </section>

          {/* S8 */}
          <section id="s8" className="mb-10 scroll-mt-28">
            <SectionHeading>{c.s8.title}</SectionHeading>
            <p className="mb-4 text-[0.95rem] leading-relaxed text-[var(--text-muted)]">{c.s8.desc}</p>
            <div className="overflow-hidden rounded-lg border border-[var(--glass-border)]">
              {c.s8.types.map((item) => (
                <div key={item.type} className="border-b border-[var(--glass-border)] px-4 py-3 last:border-b-0">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{item.type}</p>
                    {item.required && (
                      <span className="rounded-md bg-[var(--surface-2)] px-1.5 py-0.5 text-[0.65rem] font-semibold text-[var(--text-muted)]">
                        {c.s8.required}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-[var(--text-muted)]">{item.desc}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm leading-relaxed text-[var(--text-muted)]">{c.s8.manage}</p>
          </section>

          {/* S9 */}
          <section id="s9" className="mb-10 scroll-mt-28">
            <SectionHeading>{c.s9.title}</SectionHeading>
            <p className="mb-4 text-[0.95rem] leading-relaxed text-[var(--text-muted)]">{c.s9.desc}</p>
            <div className="overflow-hidden rounded-lg border border-[var(--glass-border)]">
              {c.s9.parties.map((item) => (
                <div key={item.party} className="border-b border-[var(--glass-border)] px-4 py-3 last:border-b-0">
                  <div className="mb-0.5 flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between">
                    <p className="font-semibold">{item.party}</p>
                    <p className="text-sm text-[var(--text-muted)]">{item.purpose}</p>
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">
                    {c.s9.dataSent}: {item.data}
                  </p>
                </div>
              ))}
            </div>
            <aside className="mt-4 rounded-xl border border-[var(--glass-border)] bg-[var(--surface)] px-4 py-3 text-sm leading-relaxed text-[var(--text-muted)]">
              <strong className="text-[var(--foreground)]">{c.s9.noteTitle}</strong> {c.s9.noteText}
            </aside>
          </section>

          {/* S10 */}
          <section id="s10" className="mb-10 scroll-mt-28">
            <SectionHeading>{c.s10.title}</SectionHeading>
            <h3 className="mb-2 text-sm font-bold">{c.s10.paymentTitle}</h3>
            <BulletList items={[...c.s10.paymentItems]} />
            <h3 className="mb-2 mt-5 text-sm font-bold">{c.s10.shippingTitle}</h3>
            <BulletList items={[...c.s10.shippingItems]} />
          </section>

          {/* S11 */}
          <section id="s11" className="mb-10 scroll-mt-28">
            <SectionHeading>{c.s11.title}</SectionHeading>
            <p className="mb-4 text-[0.95rem] leading-relaxed text-[var(--text-muted)]">{c.s11.desc}</p>
            <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--surface)] px-4 py-4">
              <p className="font-bold">{c.s11.orgName}</p>
              <p className="mb-3 text-sm text-[var(--text-muted)]">{c.s11.orgAddr}</p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Mail size={15} className="text-[var(--text-muted)]" />
                  {c.s11.email}:{' '}
                  <a href="mailto:psuscc@psuscc.club" className="font-semibold underline">
                    psuscc@psuscc.club
                  </a>
                </li>
                <li>
                  {c.s11.website}:{' '}
                  <Link href="/" className="font-semibold underline">
                    sccshop.psuscc.club
                  </Link>
                </li>
                <li>Facebook: {c.s11.facebook}</li>
                <li>Instagram: @psuscc</li>
                <li>AI Chatbot / Support Chat: {c.s11.chatLabel}</li>
              </ul>
            </div>
          </section>

          {/* S12 */}
          <section id="s12" className="mb-10 scroll-mt-28">
            <SectionHeading>{c.s12.title}</SectionHeading>
            <p className="mb-4 text-[0.95rem] leading-relaxed text-[var(--text-muted)]">{c.s12.desc}</p>
            <div className="overflow-hidden rounded-lg border border-[var(--glass-border)]">
              {[
                { ver: '3.0', ...c.s12.v3 },
                { ver: '2.0', ...c.s12.v2 },
                { ver: '1.0', ...c.s12.v1 },
              ].map((row) => (
                <div key={row.ver} className="border-b border-[var(--glass-border)] px-4 py-3 last:border-b-0">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">
                      {lang === 'th' ? 'เวอร์ชัน' : 'Version'} {row.ver}
                    </p>
                    <p className="text-sm text-[var(--text-muted)]">{row.date}</p>
                  </div>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">{row.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <footer className="border-t border-[var(--glass-border)] pt-6 pb-10 text-center text-xs text-[var(--text-muted)]">
            {c.copyright}
          </footer>
        </main>
      </div>
    </div>
  );
}
