'use client';

import { Skeleton } from '@/components/ui/skeleton';

/**
 * Admin layout shell shown while session/role is resolving.
 * Avoids a full-screen black gate with only a spinner.
 */
export function AdminLoadingShell({
  message = 'กำลังตรวจสอบสิทธิ์...',
}: {
  message?: string;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4 md:px-5">
        <Skeleton className="size-8 shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <Skeleton className="h-3.5 w-36 max-w-[40%]" />
          <Skeleton className="h-2.5 w-24 max-w-[30%]" />
        </div>
        <Skeleton className="hidden size-8 rounded-full sm:block" />
        <Skeleton className="size-8 rounded-full" />
        <Skeleton className="size-9 rounded-full" />
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-56 shrink-0 space-y-4 border-r border-border p-3 md:block">
          {[0, 1, 2].map((group) => (
            <div key={group} className="space-y-2">
              <Skeleton className="h-2.5 w-16" />
              {[0, 1, 2].map((item) => (
                <div key={item} className="flex items-center gap-2 rounded-lg px-1 py-1.5">
                  <Skeleton className="size-7 shrink-0 rounded-md" />
                  <Skeleton className="h-3 flex-1" />
                </div>
              ))}
            </div>
          ))}
        </aside>

        <main className="min-w-0 flex-1 space-y-4 overflow-auto p-4 md:p-5">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-52 w-full rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-[85%] rounded-lg" />
          </div>
        </main>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex justify-center px-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/95 px-3.5 py-2 text-xs text-muted-foreground shadow-md backdrop-blur-sm">
          <span className="size-3.5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
          {message}
        </div>
      </div>
    </div>
  );
}
