'use client';

import { useTranslation } from '@/hooks/useTranslation';

/**
 * Storefront app-shell skeleton for initial load.
 * Shows real layout chrome immediately so the page feels responsive
 * instead of a blank full-screen splash.
 */
export default function ShopLoadingShell({
  message,
}: {
  message?: string;
}) {
  const { t } = useTranslation();
  const statusMessage = message ?? t.common.preparingProducts;

  return (
    <div
      className="flex min-h-dvh flex-col bg-[var(--background)] text-[var(--foreground)]"
      aria-busy="true"
      aria-label={statusMessage}
    >
      {/* Header / Navbar chrome */}
      <header
        className="sticky top-0 z-20 border-b border-[var(--glass-border)] bg-[var(--background)]/90 backdrop-blur-md"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="mx-auto flex h-[52px] max-w-6xl items-center gap-3 px-3.5 md:h-[60px] md:px-6">
          <div className="skeleton size-8 shrink-0 rounded-full md:size-9" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="skeleton h-3.5 w-28 max-w-[45%]" />
            <div className="skeleton hidden h-2.5 w-20 max-w-[30%] md:block" />
          </div>
          <div className="skeleton hidden h-9 w-44 rounded-full md:block" />
          <div className="skeleton size-8 shrink-0 rounded-full" />
          <div className="skeleton size-8 shrink-0 rounded-full" />
          <div className="skeleton size-8 shrink-0 rounded-full" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-0 pb-24 pt-0 sm:px-0 sm:pt-0 md:pb-8">
        {/* Hero skeleton — full-bleed */}
        <div className="skeleton mb-0 h-[340px] w-full rounded-none sm:h-[380px] md:h-[440px]" />
        {/* Trust strip skeleton */}
        <div className="mb-4 flex justify-center gap-4 border-b border-[var(--glass-border)] px-3 py-3 sm:gap-8">
          <div className="skeleton h-3 w-24" />
          <div className="skeleton h-3 w-28" />
          <div className="skeleton h-3 w-32" />
        </div>

        <div className="mx-auto max-w-6xl px-3.5 sm:px-4">
          {/* Category / filter strip */}
          <div className="mb-4 flex gap-2 overflow-hidden">
            {[72, 88, 64, 96, 70].map((w, i) => (
              <div
                key={i}
                className="skeleton h-8 shrink-0 rounded-full"
                style={{ width: w }}
              />
            ))}
          </div>

          {/* Section title */}
          <div className="mb-3 space-y-1.5">
            <div className="skeleton h-5 w-48 max-w-[55%]" />
            <div className="skeleton h-3 w-36 max-w-[40%]" />
          </div>

          {/* Product cards — horizontal on xs, grid from sm */}
          <div className="flex gap-3 overflow-hidden sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <ProductCardSkeleton key={i} className={i >= 2 ? 'hidden sm:block' : undefined} />
            ))}
          </div>
        </div>
      </main>

      {/* Mobile bottom nav shell */}
      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--glass-border)] bg-[var(--background)]/95 backdrop-blur-md md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-hidden
      >
        <div className="flex h-14 items-center justify-around px-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div className="skeleton size-5 rounded-md" />
              <div className="skeleton h-1.5 w-8 rounded-full" />
            </div>
          ))}
        </div>
      </nav>

      {/* Soft status chip — not a full-screen gate */}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-30 flex justify-center px-4 md:bottom-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--glass-border)] bg-[var(--background)]/95 px-3.5 py-2 text-xs text-[var(--text-muted)] shadow-md backdrop-blur-sm">
          <span className="size-3.5 animate-spin rounded-full border-2 border-[var(--text-muted)]/30 border-t-[var(--text-muted)]" />
          {statusMessage}
        </div>
      </div>
    </div>
  );
}

function ProductCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={[
        'w-[68vw] max-w-[280px] shrink-0 overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--surface)] sm:w-auto sm:max-w-none',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="skeleton aspect-square w-full rounded-none" />
      <div className="space-y-2 p-3">
        <div className="skeleton h-4 w-[75%]" />
        <div className="skeleton h-3 w-[45%]" />
        <div className="mt-1 flex items-center justify-between gap-2">
          <div className="skeleton h-6 w-16 rounded-lg" />
          <div className="skeleton h-8 w-20 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
