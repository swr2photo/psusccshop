/* eslint-disable */
'use client';

import { useEffect, useState } from 'react';
import { X, Send, User, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  CHAT_THEMES,
  chatBubbleContentStyle,
  chatThemeSurfaceStyle,
  chatThemeChromeStyle,
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
      className="fixed inset-0 z-[1400] flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={labels.title}
      onClick={onClose}
    >
      {/* Dynamic blurred background based on the selected theme */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-md transition-colors duration-500" 
        style={{ backgroundColor: `color-mix(in srgb, ${draft.swatch} 10%, rgba(0,0,0,0.65))` }} 
      />

      <div
        className="relative flex max-h-[min(760px,92dvh)] w-full max-w-[840px] flex-col overflow-hidden rounded-[2rem] border border-white/20 bg-white/10 text-white shadow-2xl backdrop-blur-2xl ring-1 ring-white/10"
        onClick={(e) => e.stopPropagation()}
        style={{ boxShadow: `0 25px 50px -12px color-mix(in srgb, ${draft.swatch} 35%, transparent)` }}
      >
        <div className="relative flex shrink-0 items-center justify-center border-b border-white/10 bg-black/20 px-12 py-4 backdrop-blur-md">
          <h2 className="text-center text-[1.05rem] font-bold tracking-wide text-white/90">
            {labels.title}
          </h2>
          <button
            type="button"
            aria-label={labels.close}
            onClick={onClose}
            className="absolute right-4 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white/80 transition-all hover:scale-105 hover:bg-white/20 hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {/* Left panel: Theme List */}
          <div className="order-2 md:order-1 flex-1 md:w-[280px] lg:w-[320px] md:flex-none min-h-0 overflow-y-auto border-t border-white/10 bg-black/10 md:border-t-0 md:border-r custom-scrollbar">
            <ul className="p-3 space-y-1.5">
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
                        'group flex w-full items-center gap-3.5 rounded-2xl px-3.5 py-3 text-left transition-all duration-300',
                        selected
                          ? 'bg-white/15 shadow-lg ring-1 ring-white/30'
                          : 'hover:bg-white/5 hover:scale-[1.01]'
                      )}
                    >
                      <span
                        className={cn(
                          "size-11 shrink-0 rounded-full shadow-inner transition-transform duration-300",
                          selected ? "ring-2 ring-white scale-105" : "ring-1 ring-white/15 group-hover:scale-105"
                        )}
                        style={{
                          background: `linear-gradient(135deg, ${theme.swatch} 0 52%, ${theme.swatchSecondary || theme.swatch} 52% 100%)`,
                        }}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span className={cn(
                          "block truncate text-[0.95rem] font-semibold transition-colors duration-200",
                          selected ? "text-white" : "text-white/80 group-hover:text-white"
                        )}>{name}</span>
                        {subtitle ? (
                          <span className={cn(
                            "mt-0.5 block truncate text-[0.75rem] transition-colors duration-200",
                            selected ? "text-white/70" : "text-white/50 group-hover:text-white/60"
                          )}>
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

          {/* Right panel: Realistic Preview */}
          <div className="order-1 md:order-2 flex shrink-0 md:flex-1 items-center justify-center p-4 sm:p-6 md:p-8 bg-black/5">
            <div
              className="relative flex h-[240px] w-full max-w-[340px] shrink-0 flex-col overflow-hidden rounded-[2rem] border-[4px] border-black/80 bg-black shadow-2xl transition-all duration-500 sm:h-[300px] md:h-[600px] md:rounded-[2.5rem] md:border-[6px]"
              style={chatThemeSurfaceStyle(draft)}
            >
              {/* Mock Chat Header */}
              <div 
                className="flex items-center gap-2 border-b px-4 py-3 shrink-0 transition-colors duration-500"
                style={chatThemeChromeStyle(draft)}
              >
                <div className="flex items-center justify-center">
                   <ChevronLeft className="size-5 opacity-70" />
                </div>
                <div className="flex size-8 items-center justify-center rounded-full bg-white/20">
                  <User className="size-4 opacity-90" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[0.85rem] font-semibold leading-tight">Support Team</span>
                  <span className="text-[0.65rem] opacity-70">Active now</span>
                </div>
              </div>

              {/* Chat Bubbles */}
              <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 pt-6">
                <div className="flex justify-end">
                  <div
                    className="max-w-[85%] rounded-2xl rounded-tr-sm px-3.5 py-2.5 text-[0.85rem] leading-relaxed shadow-sm transition-colors duration-500"
                    style={{ ...chatBubbleContentStyle(draft, 'outgoing'), boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}
                  >
                    {labels.previewOutgoing}
                  </div>
                </div>
                <div className="flex justify-start">
                  <div
                    className="max-w-[85%] rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-[0.85rem] leading-relaxed shadow-sm transition-colors duration-500"
                    style={{ ...chatBubbleContentStyle(draft, 'incoming'), boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}
                  >
                    {labels.previewIncoming}
                  </div>
                </div>
              </div>

              {/* Mock Chat Input */}
              <div 
                className="border-t px-4 py-3 shrink-0 transition-colors duration-500"
                style={chatThemeChromeStyle(draft)}
              >
                <div 
                  className="flex items-center justify-between rounded-full px-4 py-2"
                  style={{ backgroundColor: 'var(--chat-input-bg)' }}
                >
                  <span className="text-[0.8rem] opacity-50">Type a message...</span>
                  <div 
                    className="flex size-6 items-center justify-center rounded-full shadow-sm"
                    style={{ backgroundColor: draft.swatch, color: draft.outgoingFg }}
                  >
                    <Send className="size-3 -ml-0.5" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-white/10 bg-black/20 px-6 py-4 backdrop-blur-md">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-white/5 px-6 py-2.5 text-[0.95rem] font-semibold text-white/80 transition-all hover:bg-white/10 hover:text-white"
          >
            {labels.cancel}
          </button>
          <button
            type="button"
            onClick={() => {
              onSelect(draftId);
              onClose();
            }}
            className="rounded-xl px-8 py-2.5 text-[0.95rem] font-bold text-white shadow-lg transition-all hover:scale-105 hover:brightness-110 active:scale-95"
            style={{
              background: `linear-gradient(135deg, ${draft.swatch} 0%, ${draft.swatchSecondary || draft.swatch} 100%)`,
              boxShadow: `0 4px 15px -3px color-mix(in srgb, ${draft.swatch} 50%, transparent)`,
            }}
          >
            {labels.select}
          </button>
        </div>
      </div>
    </div>
  );
}
