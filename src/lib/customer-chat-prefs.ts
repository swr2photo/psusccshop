/** Customer-side support chat preferences (localStorage). */

import {
  DEFAULT_CHAT_THEME_ID,
  isChatThemeId,
  type ChatThemeId,
} from '@/lib/chat-themes';

export type CustomerChatPrefs = {
  /** Suppress browser / in-app chat notifications */
  muted: boolean;
  /** Soft chime when a new admin message arrives while chat is open */
  soundEnabled: boolean;
  /** Tighter message spacing */
  compact: boolean;
  /** Customer bubbles use brand primary (off = calmer slate) — used when theme is classic */
  primaryBubbles: boolean;
  /** Visual chat theme id */
  themeId: ChatThemeId;
};

export const DEFAULT_CUSTOMER_CHAT_PREFS: CustomerChatPrefs = {
  muted: false,
  soundEnabled: true,
  compact: false,
  primaryBubbles: true,
  themeId: DEFAULT_CHAT_THEME_ID,
};

const STORAGE_KEY = 'psuscc_customer_chat_prefs_v1';

export function loadCustomerChatPrefs(): CustomerChatPrefs {
  if (typeof window === 'undefined') return { ...DEFAULT_CUSTOMER_CHAT_PREFS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CUSTOMER_CHAT_PREFS };
    const parsed = JSON.parse(raw) as Partial<CustomerChatPrefs>;
    return {
      muted: Boolean(parsed.muted),
      soundEnabled: parsed.soundEnabled !== false,
      compact: Boolean(parsed.compact),
      primaryBubbles: parsed.primaryBubbles !== false,
      themeId: isChatThemeId(parsed.themeId) ? parsed.themeId : DEFAULT_CHAT_THEME_ID,
    };
  } catch {
    return { ...DEFAULT_CUSTOMER_CHAT_PREFS };
  }
}

export function saveCustomerChatPrefs(prefs: CustomerChatPrefs): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore quota / private mode
  }
}

/** Short soft chime — no external asset */
export function playChatMessageSound(): void {
  if (typeof window === 'undefined') return;
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
    void ctx.close().catch(() => undefined);
  } catch {
    // ignore
  }
}
