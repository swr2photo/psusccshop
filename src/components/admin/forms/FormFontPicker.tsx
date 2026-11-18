'use client';

// Google Font picker for a form — each option is previewed in its own typeface.

import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, Search, Type } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useFormFont } from '@/components/forms/useFormFont';
import { cn } from '@/lib/utils';
import { FORM_FONTS, FORM_FONT_CATEGORY_LABEL, formFontStack, googleFontPreviewUrl, type FormFontCategory } from '@/lib/form-fonts';

const SAMPLE = 'แบบสำรวจเสื้อรุ่น 2569 Aa';

export default function FormFontPicker({ value, onChange }: { value?: string | null; onChange: (family: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  // The chosen font loads in full; the picker list uses a tiny glyph subset that is removed on close
  // (it shares family names, so it must not linger and shadow the full font elsewhere on the page).
  useFormFont(value);
  useEffect(() => {
    if (!open) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = googleFontPreviewUrl(SAMPLE);
    // Insert before full form font stylesheets so the subset never shadows an already-loaded full font.
    const firstFull = document.head.querySelector('link[data-form-font]');
    document.head.insertBefore(link, firstFull);
    return () => link.remove();
  }, [open]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = FORM_FONTS.filter((f) => !q || `${f.family} ${f.note || ''}`.toLowerCase().includes(q));
    return (Object.keys(FORM_FONT_CATEGORY_LABEL) as FormFontCategory[])
      .map((c) => ({ c, fonts: list.filter((f) => f.category === c) }))
      .filter((g) => g.fonts.length);
  }, [query]);

  const pick = (family: string | null) => { onChange(family); setOpen(false); setQuery(''); };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery(''); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="ฟอนต์ของแบบฟอร์ม"
          className="flex h-11 w-full items-center gap-3 rounded-xl border border-input bg-card px-3 text-left shadow-xs outline-none hover:bg-muted/50 focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <Type size={16} className="shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate text-[0.95rem]" style={{ fontFamily: formFontStack(value) }}>
            {value ? `${value} — ${SAMPLE}` : 'ฟอนต์ของเว็บไซต์ (ค่าเริ่มต้น)'}
          </span>
          <ChevronDown size={14} className={cn('shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(380px,calc(100vw-32px))] p-0">
        <div className="border-b border-border p-2.5">
          <div className="relative">
            <Search size={14} className="absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground" />
            <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหาฟอนต์..." className="h-8 pl-8 text-[0.82rem]" />
          </div>
        </div>
        <div className="max-h-[360px] overflow-y-auto p-1.5">
          {!query && (
            <button type="button" onClick={() => pick(null)} className={cn('flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-muted', !value && 'bg-primary/10')}>
              <span className="min-w-0 flex-1">
                <span className="block text-[0.72rem] font-semibold text-muted-foreground">ค่าเริ่มต้น</span>
                <span className="block text-[1rem]">ฟอนต์ของเว็บไซต์</span>
              </span>
              {!value && <Check size={15} className="text-primary" />}
            </button>
          )}
          {groups.length === 0 && <p className="py-6 text-center text-[0.8rem] text-muted-foreground">ไม่พบฟอนต์</p>}
          {groups.map((g) => (
            <div key={g.c}>
              <p className="px-2.5 pt-2.5 pb-1 text-[0.68rem] font-bold tracking-wide text-muted-foreground uppercase">{FORM_FONT_CATEGORY_LABEL[g.c]}</p>
              {g.fonts.map((f) => {
                const active = f.family === value;
                return (
                  <button
                    key={f.family}
                    type="button"
                    onClick={() => pick(f.family)}
                    className={cn('flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-muted', active && 'bg-primary/10')}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-1.5 text-[0.72rem] font-semibold text-muted-foreground">
                        {f.family}{f.note && <span className="font-normal">· {f.note}</span>}
                      </span>
                      <span className="block truncate text-[1.05rem] leading-snug" style={{ fontFamily: formFontStack(f.family) }}>{SAMPLE}</span>
                    </span>
                    {active && <Check size={15} className="shrink-0 text-primary" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <p className="border-t border-border px-3 py-2 text-[0.68rem] text-muted-foreground">ฟอนต์จาก Google Fonts ที่รองรับภาษาไทย ใช้กับหน้าที่นักศึกษาตอบ</p>
      </PopoverContent>
    </Popover>
  );
}
