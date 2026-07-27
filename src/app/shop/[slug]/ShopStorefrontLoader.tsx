// Lightweight SSR-safe storefront shell while ShopStorefront hydrates
export default function ShopStorefrontLoader() {
  return (
    <div
      className="flex min-h-dvh flex-col bg-[var(--background,#fff)] text-[var(--foreground,#1d1d1f)]"
      aria-busy="true"
      aria-label="Loading shop"
    >
      <header
        className="sticky top-0 z-20 border-b border-[var(--glass-border,rgba(0,0,0,0.08))] bg-[var(--background,#fff)]/90"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="mx-auto flex h-[52px] max-w-6xl items-center gap-3 px-3.5 md:h-[60px] md:px-6">
          <div className="skeleton size-9 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="skeleton h-3.5 w-36 max-w-[40%]" />
            <div className="skeleton h-2.5 w-24 max-w-[28%]" />
          </div>
          <div className="skeleton size-8 rounded-full" />
          <div className="skeleton size-8 rounded-full" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-0 pb-8 pt-3 sm:px-4 sm:pt-5">
        <div className="skeleton mb-4 h-40 w-full rounded-none sm:mb-5 sm:h-52 sm:rounded-2xl" />
        <div className="mb-4 flex gap-2 overflow-hidden px-3.5 sm:px-0">
          {[72, 88, 64, 96].map((w, i) => (
            <div key={i} className="skeleton h-8 shrink-0 rounded-full" style={{ width: w }} />
          ))}
        </div>
        <div className="mb-3 space-y-1.5 px-3.5 sm:px-0">
          <div className="skeleton h-5 w-40 max-w-[50%]" />
          <div className="skeleton h-3 w-24 max-w-[30%]" />
        </div>
        <div className="grid grid-cols-2 gap-3 px-3.5 sm:grid-cols-3 sm:gap-4 sm:px-0 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-2xl border border-[var(--glass-border,rgba(0,0,0,0.08))] bg-[var(--surface,#f5f5f7)]"
            >
              <div className="skeleton aspect-square w-full rounded-none" />
              <div className="space-y-2 p-3">
                <div className="skeleton h-4 w-[70%]" />
                <div className="skeleton h-3 w-[40%]" />
                <div className="mt-1 flex justify-between gap-2">
                  <div className="skeleton h-6 w-14 rounded-lg" />
                  <div className="skeleton h-8 w-16 rounded-lg" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
