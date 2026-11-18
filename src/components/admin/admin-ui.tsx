'use client';

/**
 * Shared admin UI primitives — one visual language for every admin section.
 * Keep these small and token-based (bg-card, border-border, text-muted-foreground…)
 * so they follow light/dark themes automatically.
 */

import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { STATUS_THEME } from '@/lib/adminTheme';

// ─── Panel (card with optional header) ───────────────────────────
export function Panel({
  title,
  description,
  icon,
  action,
  children,
  className,
  bodyClassName,
  flush,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Remove body padding (for edge-to-edge tables/lists) */
  flush?: boolean;
}) {
  return (
    <section
      className={cn(
        'flex min-w-0 flex-col rounded-2xl border border-border bg-card text-card-foreground shadow-[0_1px_2px_rgba(0,0,0,0.04)]',
        className,
      )}
    >
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
          <div className="flex min-w-0 items-start gap-2.5">
            {icon ? (
              <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground [&_svg]:size-4">
                {icon}
              </span>
            ) : null}
            <div className="min-w-0">
              {title ? <h3 className="truncate text-sm font-semibold leading-7">{title}</h3> : null}
              {description ? (
                <p className="-mt-0.5 text-xs text-muted-foreground">{description}</p>
              ) : null}
            </div>
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </header>
      )}
      <div className={cn(!flush && 'px-5 pb-5', !title && !action && !flush && 'pt-5', bodyClassName)}>
        {children}
      </div>
    </section>
  );
}

// ─── KPI / stat card ─────────────────────────────────────────────
export type StatTone = 'default' | 'success' | 'warning' | 'info' | 'danger' | 'violet';

const TONE_CLASSES: Record<StatTone, string> = {
  default: 'bg-muted text-foreground',
  success: 'bg-success/12 text-success dark:text-success',
  warning: 'bg-warning/14 text-warning dark:text-warning',
  info: 'bg-primary/12 text-primary dark:text-primary',
  danger: 'bg-destructive/12 text-destructive dark:text-destructive',
  violet: 'bg-primary/12 text-primary dark:text-primary',
};

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'default',
  onClick,
  actionLabel,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: StatTone;
  onClick?: () => void;
  actionLabel?: string;
}) {
  const Comp: React.ElementType = onClick ? 'button' : 'div';
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-label={onClick && actionLabel ? actionLabel : undefined}
      className={cn(
        'group relative flex min-w-0 flex-col gap-3 rounded-2xl border border-border bg-card p-4 text-left shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors',
        onClick && 'cursor-pointer hover:border-primary/40 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-medium text-muted-foreground">{label}</span>
        {icon ? (
          <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg [&_svg]:size-4', TONE_CLASSES[tone])}>
            {icon}
          </span>
        ) : null}
      </div>
      <div className="min-w-0">
        <p className="truncate text-2xl font-bold tabular-nums tracking-tight">{value}</p>
        {hint ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      {onClick ? (
        <ArrowUpRight className="absolute right-3 bottom-3 size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      ) : null}
    </Comp>
  );
}

// ─── Order status pill ───────────────────────────────────────────
export const STATUS_LABEL_TH: Record<string, string> = {
  WAITING_PAYMENT: 'รอชำระเงิน',
  PENDING_PAYMENT: 'รอชำระเงิน',
  AWAITING_PAYMENT: 'รอชำระเงิน',
  PENDING: 'รอดำเนินการ',
  PAID: 'ชำระแล้ว',
  READY: 'พร้อมรับ/ส่ง',
  SHIPPED: 'จัดส่งแล้ว',
  COMPLETED: 'สำเร็จ',
  CANCELLED: 'ยกเลิก',
  REFUND_REQUESTED: 'ขอคืนเงิน',
  REFUNDED: 'คืนเงินแล้ว',
};

export const STATUS_LABEL_EN: Record<string, string> = {
  WAITING_PAYMENT: 'Awaiting payment',
  PENDING_PAYMENT: 'Awaiting payment',
  AWAITING_PAYMENT: 'Awaiting payment',
  PENDING: 'Pending',
  PAID: 'Paid',
  READY: 'Ready',
  SHIPPED: 'Shipped',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  REFUND_REQUESTED: 'Refund requested',
  REFUNDED: 'Refunded',
};

export function statusLabel(status: string, lang: string = 'th') {
  const map = lang === 'en' ? STATUS_LABEL_EN : STATUS_LABEL_TH;
  return map[status] || status.replace(/_/g, ' ');
}

export function StatusPill({ status, lang = 'th', className }: { status: string; lang?: string; className?: string }) {
  const theme = STATUS_THEME[status] || STATUS_THEME.PENDING;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[0.7rem] font-semibold',
        className,
      )}
      style={{ backgroundColor: theme.bg, color: theme.text }}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: theme.text }} />
      {statusLabel(status, lang)}
    </span>
  );
}

// ─── Empty state ─────────────────────────────────────────────────
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 px-6 py-10 text-center', className)}>
      {icon ? (
        <span className="mb-1 grid size-10 place-items-center rounded-full bg-muted text-muted-foreground [&_svg]:size-5">
          {icon}
        </span>
      ) : null}
      <p className="text-sm font-medium">{title}</p>
      {description ? <p className="max-w-sm text-xs text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

// ─── Keyboard hint ───────────────────────────────────────────────
export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'pointer-events-none inline-flex h-5 min-w-5 select-none items-center justify-center rounded border border-border bg-muted px-1 font-sans text-[0.65rem] font-medium text-muted-foreground',
        className,
      )}
    >
      {children}
    </kbd>
  );
}
