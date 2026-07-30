'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft, ChevronDown, MessageCircle } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Footer from '@/components/Footer';
import { useTranslation } from '@/hooks/useTranslation';
import {
  FAQ_ITEMS,
  getFaqCategoriesForLang,
  type FaqCategoryId,
} from '@/lib/faq-content';

const SupportChatWidget = dynamic(() => import('@/components/SupportChatWidget'), { ssr: false });

const OPEN_SUPPORT_CHAT_EVENT = 'psuscc:open-support-chat';

function formatAnswer(text: string) {
  return text.split('\n').map((line, i) => (
    <span key={`${i}-${line.slice(0, 12)}`} className="block">
      {line || '\u00a0'}
    </span>
  ));
}

export default function FaqPage() {
  const router = useRouter();
  const { t, lang } = useTranslation();
  const [activeCategory, setActiveCategory] = useState<FaqCategoryId | 'all'>('all');

  const categories = useMemo(() => getFaqCategoriesForLang(lang), [lang]);

  const items = useMemo(() => {
    const filtered =
      activeCategory === 'all'
        ? FAQ_ITEMS
        : FAQ_ITEMS.filter((item) => item.category === activeCategory);
    return filtered.map((item) => ({
      id: item.id,
      question: item.question[lang],
      answer: item.answer[lang],
    }));
  }, [activeCategory, lang]);

  const openSupportChat = () => {
    window.dispatchEvent(new CustomEvent(OPEN_SUPPORT_CHAT_EVENT));
  };

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--background)] text-[var(--foreground)]">
      <header className="sticky top-0 z-40 border-b border-[var(--glass-border)] bg-[var(--background)]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={() => router.push('/')}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
          >
            <ArrowLeft size={16} />
            {t.faq.backHome}
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <p className="mb-3 text-[0.7rem] font-extrabold uppercase tracking-[0.14em] text-[var(--text-muted)]">
          {t.faq.eyebrow}
        </p>
        <h1 className="mb-3 text-3xl font-extrabold tracking-tight text-[var(--foreground)] sm:text-4xl">
          {t.faq.title}
        </h1>
        <p className="mb-8 max-w-2xl text-[0.95rem] leading-relaxed text-[var(--text-muted)]">
          {t.faq.subtitle}
        </p>

        <div
          className="mb-8 flex flex-wrap gap-2 border-b border-[var(--glass-border)] pb-6"
          role="tablist"
          aria-label={t.faq.categoriesLabel}
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeCategory === 'all'}
            onClick={() => setActiveCategory('all')}
            className="rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-[0.08em] transition-colors"
            style={{
              background:
                activeCategory === 'all' ? 'var(--primary)' : 'var(--surface-2)',
              color: activeCategory === 'all' ? '#fff' : 'var(--foreground)',
              border: '1px solid var(--glass-border)',
            }}
          >
            {t.faq.allCategories}
          </button>
          {categories.map((cat) => {
            const selected = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActiveCategory(cat.id)}
                className="rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-[0.08em] transition-colors"
                style={{
                  background: selected ? 'var(--primary)' : 'var(--surface-2)',
                  color: selected ? '#fff' : 'var(--foreground)',
                  border: '1px solid var(--glass-border)',
                }}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        <div className="divide-y divide-[var(--glass-border)] border-y border-[var(--glass-border)]">
          {items.map((item) => (
            <details key={item.id} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-left marker:content-none [&::-webkit-details-marker]:hidden">
                <span className="text-[0.95rem] font-semibold leading-snug text-[var(--foreground)]">
                  {item.question}
                </span>
                <ChevronDown
                  size={18}
                  className="shrink-0 text-[var(--text-muted)] transition-transform duration-200 group-open:rotate-180"
                  aria-hidden
                />
              </summary>
              <div className="pb-5 pr-8 text-sm leading-relaxed text-[var(--text-muted)]">
                {formatAnswer(item.answer)}
              </div>
            </details>
          ))}
        </div>

        {items.length === 0 ? (
          <p className="py-10 text-center text-sm text-[var(--text-muted)]">{t.faq.empty}</p>
        ) : null}

        <div
          className="mt-10 border border-[var(--glass-border)] bg-[var(--surface)] px-5 py-5 sm:px-6"
          style={{ borderRadius: 12 }}
        >
          <h2 className="mb-1 text-sm font-extrabold uppercase tracking-[0.1em] text-[var(--foreground)]">
            {t.faq.stillNeedHelp}
          </h2>
          <p className="mb-4 text-sm leading-relaxed text-[var(--text-muted)]">
            {t.faq.stillNeedHelpDesc}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={openSupportChat}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--glass-border)] bg-[var(--surface-2)] px-3.5 py-2 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--surface-3)]"
            >
              <MessageCircle size={15} />
              {t.footer.supportChat}
            </button>
            <Link
              href="/terms"
              className="inline-flex items-center rounded-lg px-3.5 py-2 text-sm font-semibold text-[var(--primary)] underline-offset-4 hover:underline"
            >
              {t.faq.viewTerms}
            </Link>
            <Link
              href="/privacy"
              className="inline-flex items-center rounded-lg px-3.5 py-2 text-sm font-semibold text-[var(--primary)] underline-offset-4 hover:underline"
            >
              {t.faq.viewPrivacy}
            </Link>
          </div>
        </div>
      </main>

      <Footer />
      <SupportChatWidget hideMobileFab />
    </div>
  );
}
