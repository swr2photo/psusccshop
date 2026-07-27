import { cn } from '@/lib/utils';

/** Compact centered system / order chip — not a chat bubble. */
export function ChatSystemMarker({
  children,
  className,
  tone = 'muted',
}: {
  children: React.ReactNode;
  className?: string;
  tone?: 'muted' | 'order';
}) {
  return (
    <div role="status" className={cn('flex justify-center px-2 py-1.5', className)}>
      <span
        className={cn(
          'max-w-[min(90%,20rem)] truncate rounded-full px-3 py-1 text-center text-[0.65rem] leading-snug font-medium',
          tone === 'order'
            ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20'
            : 'bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200/80 dark:bg-zinc-800/50 dark:text-zinc-400 dark:ring-zinc-700/40'
        )}
      >
        {children}
      </span>
    </div>
  );
}
