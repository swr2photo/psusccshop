'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  CHAT_THEMES,
  chatBubbleContentStyle,
  chatThemeSurfaceStyle,
  getChatTheme,
  type ChatThemeId,
} from '@/lib/chat-themes';

export type ChatThemePickerLabels = {
  title: string;
  cancel: string;
  select: string;
  previewOutgoing: string;
  previewIncoming: string;
  close: string;
};

type ChatThemePickerProps = {
  open: boolean;
  currentThemeId: ChatThemeId;
  lang: 'th' | 'en';
  labels: ChatThemePickerLabels;
  onClose: () => void;
  onSelect: (themeId: ChatThemeId) => void;
};

export function ChatThemePicker({
  open,
  currentThemeId,
  lang,
  labels,
  onClose,
  onSelect,
}: ChatThemePickerProps) {
  const [draftId, setDraftId] = useState<ChatThemeId>(currentThemeId);
  const draft = getChatTheme(draftId);

  useEffect(() => {
    if (open) setDraftId(currentThemeId);
  }, [open, currentThemeId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[1400] flex items-center justify-center bg-black/55 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={labels.title}
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(720px,92dvh)] w-full max-w-[720px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#1c1c1e] text-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative flex shrink-0 items-center justify-center border-b border-white/10 px-12 py-3.5">
          <h2 className="text-center text-[0.95rem] font-semibold tracking-tight">
            {labels.title}
          </h2>
          <button
            type="button"
            aria-label={labels.close}
            onClick={onClose}
            className="absolute right-3 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
          <div className="min-h-0 overflow-y-auto border-b border-white/10 md:border-b-0 md:border-r">
            <ul className="p-2">
              {CHAT_THEMES.map((theme) => {
                const selected = theme.id === draftId;
                const name = lang === 'en' ? theme.nameEn : theme.nameTh;
                const subtitle = lang === 'en' ? theme.subtitleEn : theme.subtitleTh;
                return (
                  <li key={theme.id}>
                    <button
                      type="button"
                      onClick={() => setDraftId(theme.id)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition',
                        selected
                          ? 'bg-[#0a84ff]/28 ring-1 ring-[#0a84ff]/55'
                          : 'hover:bg-white/5'
                      )}
                    >
                      <span
                        className="size-10 shrink-0 rounded-full shadow-inner ring-1 ring-white/15"
                        style={{
                          background: `linear-gradient(135deg, ${theme.swatch} 0 52%, ${theme.swatchSecondary || theme.swatch} 52% 100%)`,
                        }}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.92rem] font-semibold">{name}</span>
                        {subtitle ? (
                          <span className="mt-0.5 block truncate text-[0.72rem] text-white/55">
                            {subtitle}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="flex min-h-[240px] flex-col p-3 md:min-h-0">
            <div
              className="flex min-h-0 flex-1 flex-col justify-end gap-2.5 overflow-hidden rounded-xl p-4"
              style={chatThemeSurfaceStyle(draft)}
            >
              <div className="flex justify-end">
                <div
                  className="max-w-[85%] rounded-2xl rounded-br-md px-3 py-2 text-[0.82rem] leading-snug shadow-sm"
                  style={chatBubbleContentStyle(draft, 'outgoing')}
                >
                  {labels.previewOutgoing}
                </div>
              </div>
              <div className="flex justify-start">
                <div
                  className="max-w-[85%] rounded-2xl rounded-bl-md px-3 py-2 text-[0.82rem] leading-snug shadow-sm"
                  style={chatBubbleContentStyle(draft, 'incoming')}
                >
                  {labels.previewIncoming}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-white/10 p-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-[#3a3a3c] px-3 py-3 text-[0.92rem] font-semibold text-white transition hover:bg-[#48484a]"
          >
            {labels.cancel}
          </button>
          <button
            type="button"
            onClick={() => {
              onSelect(draftId);
              onClose();
            }}
            className="rounded-xl bg-[#0a84ff] px-3 py-3 text-[0.92rem] font-semibold text-white transition hover:bg-[#0077ed]"
          >
            {labels.select}
          </button>
        </div>
      </div>
    </div>
  );
}
