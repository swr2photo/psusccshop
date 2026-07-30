'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Search, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

export type GifItem = {
  id: string;
  title: string;
  previewUrl: string;
  url: string;
};

export type GifPickerLabels = {
  title: string;
  searchPlaceholder: string;
  uploadGif: string;
  trending: string;
  empty: string;
  loadError: string;
  missingKey: string;
  loading: string;
};

type GifPickerProps = {
  labels: GifPickerLabels;
  disabled?: boolean;
  onPick: (url: string) => void;
  onUploadClick?: () => void;
  className?: string;
};

export function GifPicker({
  labels,
  disabled,
  onPick,
  onUploadClick,
  className,
}: GifPickerProps) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [gifs, setGifs] = useState<GifItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [brokenIds, setBrokenIds] = useState<Set<string>>(() => new Set());
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query.trim()), 350);
    return () => window.clearTimeout(t);
  }, [query]);

  const load = useCallback(async (q: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    setBrokenIds(new Set());
    try {
      const params = new URLSearchParams({ limit: '24' });
      if (q) params.set('q', q);
      const res = await fetch(`/api/gifs?${params.toString()}`, {
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (
        data.configured === false ||
        data.error === 'GIPHY_API_KEY_MISSING' ||
        data.error === 'TENOR_API_KEY_MISSING'
      ) {
        setConfigured(false);
        setGifs([]);
        return;
      }
      setConfigured(true);
      if (!res.ok || data.error) {
        setError(labels.loadError);
        setGifs([]);
        return;
      }
      const list = Array.isArray(data.gifs)
        ? (data.gifs as GifItem[]).filter(
            (g) => g?.id && g?.previewUrl && g?.url
          )
        : [];
      setGifs(list);
    } catch (e: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ {
      if ((e as { name?: string })?.name === 'AbortError') return;
      setError(labels.loadError);
      setGifs([]);
    } finally {
      setLoading(false);
    }
  }, [labels.loadError]);

  useEffect(() => {
    void load(debounced);
    return () => abortRef.current?.abort();
  }, [debounced, load]);

  const visible = gifs.filter((g) => !brokenIds.has(g.id));

  return (
    <div className={cn('flex w-full flex-col gap-2', className)}>
      <div className="flex items-center justify-between gap-2 px-0.5">
        <p className="text-xs font-medium text-muted-foreground">{labels.title}</p>
        {onUploadClick ? (
          <button
            type="button"
            disabled={disabled}
            onClick={onUploadClick}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-blue-600 transition hover:bg-blue-50 disabled:opacity-40"
          >
            <Upload className="size-3" />
            {labels.uploadGif}
          </button>
        ) : null}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={labels.searchPlaceholder}
          disabled={disabled || !configured}
          className="h-8 w-full rounded-lg border border-border bg-muted/40 pr-2 pl-8 text-xs outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
        />
      </div>

      {!configured ? (
        <p className="px-1 py-6 text-center text-[12px] leading-relaxed text-muted-foreground">
          {labels.missingKey}
        </p>
      ) : loading && visible.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-10 text-xs text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {labels.loading}
        </div>
      ) : error ? (
        <p className="px-1 py-6 text-center text-[12px] text-muted-foreground">{error}</p>
      ) : visible.length === 0 ? (
        <p className="px-1 py-6 text-center text-[12px] text-muted-foreground">{labels.empty}</p>
      ) : (
        <>
          {!debounced ? (
            <p className="px-0.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              {labels.trending}
            </p>
          ) : null}
          <div className="grid max-h-[240px] grid-cols-3 gap-1.5 overflow-y-auto">
            {visible.map((gif, index) => (
              <button
                key={`${gif.id}-${index}`}
                type="button"
                disabled={disabled}
                title={gif.title}
                onClick={() => onPick(gif.url)}
                className="relative aspect-square overflow-hidden rounded-lg bg-muted/50 transition hover:ring-2 hover:ring-blue-500/60 disabled:opacity-40"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={gif.previewUrl}
                  alt={gif.title}
                  className="absolute inset-0 size-full object-cover"
                  loading="lazy"
                  draggable={false}
                  onError={() => {
                    setBrokenIds((prev) => {
                      if (prev.has(gif.id)) return prev;
                      const next = new Set(prev);
                      next.add(gif.id);
                      return next;
                    });
                  }}
                />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** @deprecated Use GifPicker — kept for any leftover imports during migration */
export const GiphyGifPicker = GifPicker;
export type GiphyGifPickerLabels = GifPickerLabels;
export type GiphyGifItem = GifItem;
