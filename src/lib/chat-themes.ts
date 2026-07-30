/** Customer support chat visual themes (bubbles + background). */

import type { CSSProperties } from 'react';

export type ChatThemeId =
  | 'classic'
  | 'scc-blue'
  | 'soft-dawn'
  | 'night-market'
  | 'campus-green'
  | 'sunset-run'
  | 'lavender-mist'
  | 'matchday';

export type ChatTheme = {
  id: ChatThemeId;
  /** Accent for swatch / list thumb */
  swatch: string;
  swatchSecondary?: string;
  /** Message list background (CSS) */
  background: string;
  /** Optional repeating pattern overlay */
  pattern?: string;
  outgoingBg: string;
  outgoingFg: string;
  incomingBg: string;
  incomingFg: string;
  nameTh: string;
  nameEn: string;
  subtitleTh?: string;
  subtitleEn?: string;
};

export const CHAT_THEMES: ChatTheme[] = [
  {
    id: 'classic',
    swatch: '#0071e3',
    swatchSecondary: '#e8e8ed',
    background: 'var(--surface-2)',
    outgoingBg: '#0071e3',
    outgoingFg: '#ffffff',
    incomingBg: '#e8e8ed',
    incomingFg: '#1d1d1f',
    nameTh: 'คลาสสิก',
    nameEn: 'Classic',
    subtitleTh: 'สีมาตรฐานของร้าน',
    subtitleEn: 'Shop default colors',
  },
  {
    id: 'scc-blue',
    swatch: '#0a84ff',
    swatchSecondary: '#d6ebff',
    background: 'linear-gradient(180deg, #e8f3ff 0%, #f5f9ff 48%, #eef4fb 100%)',
    pattern:
      'radial-gradient(circle at 12% 18%, rgba(10,132,255,0.12) 0 2px, transparent 3px), radial-gradient(circle at 78% 42%, rgba(10,132,255,0.1) 0 2px, transparent 3px)',
    outgoingBg: '#0a84ff',
    outgoingFg: '#ffffff',
    incomingBg: '#ffffff',
    incomingFg: '#0b1f33',
    nameTh: 'ฟ้า SCC',
    nameEn: 'SCC Blue',
    subtitleTh: 'โทนร้าน + จุดอ่อน',
    subtitleEn: 'Brand blue with soft dots',
  },
  {
    id: 'soft-dawn',
    swatch: '#ff8f6b',
    swatchSecondary: '#ffe8d6',
    background: 'linear-gradient(165deg, #fff6ef 0%, #ffe9dc 40%, #f7f0ff 100%)',
    outgoingBg: '#ff7a59',
    outgoingFg: '#ffffff',
    incomingBg: '#ffffff',
    incomingFg: '#3b2a22',
    nameTh: 'รุ่งอรุณอ่อน',
    nameEn: 'Soft Dawn',
    subtitleTh: 'อุ่นๆ สบายตา',
    subtitleEn: 'Warm and easy on the eyes',
  },
  {
    id: 'night-market',
    swatch: '#ffd60a',
    swatchSecondary: '#1c1c1e',
    background: 'linear-gradient(180deg, #121212 0%, #1c1c1e 100%)',
    pattern:
      'radial-gradient(circle at 20% 30%, rgba(255,214,10,0.08) 0 1.5px, transparent 2px), radial-gradient(circle at 70% 60%, rgba(255,255,255,0.06) 0 1.5px, transparent 2px)',
    outgoingBg: '#ffd60a',
    outgoingFg: '#1c1c1e',
    incomingBg: '#2c2c2e',
    incomingFg: '#f5f5f7',
    nameTh: 'ตลาดกลางคืน',
    nameEn: 'Night Market',
    subtitleTh: 'มืด + ไฟเหลือง',
    subtitleEn: 'Dark with warm lights',
  },
  {
    id: 'campus-green',
    swatch: '#30d158',
    swatchSecondary: '#e3f8e9',
    background: 'linear-gradient(180deg, #eaf8ef 0%, #f4fbf6 100%)',
    pattern:
      'linear-gradient(135deg, rgba(48,209,88,0.06) 25%, transparent 25%), linear-gradient(225deg, rgba(48,209,88,0.06) 25%, transparent 25%)',
    outgoingBg: '#248a3d',
    outgoingFg: '#ffffff',
    incomingBg: '#ffffff',
    incomingFg: '#14301c',
    nameTh: 'เขียววิทยาเขต',
    nameEn: 'Campus Green',
    subtitleTh: 'โทนเขียวสดชื่น',
    subtitleEn: 'Fresh campus greens',
  },
  {
    id: 'sunset-run',
    swatch: '#ff453a',
    swatchSecondary: '#ff9f0a',
    background: 'linear-gradient(160deg, #2a1030 0%, #4a1a2a 45%, #7a2e1a 100%)',
    outgoingBg: '#ff6b4a',
    outgoingFg: '#ffffff',
    incomingBg: 'rgba(255,255,255,0.14)',
    incomingFg: '#fff5f0',
    nameTh: 'วิ่งยามเย็น',
    nameEn: 'Sunset Run',
    subtitleTh: 'ส้มแดงพลบค่ำ',
    subtitleEn: 'Sunset orange dusk',
  },
  {
    id: 'lavender-mist',
    swatch: '#bf5af2',
    swatchSecondary: '#f3e8ff',
    background: 'linear-gradient(180deg, #f7f0ff 0%, #eef2ff 100%)',
    pattern:
      'radial-gradient(circle at 30% 20%, rgba(191,90,242,0.14) 0 18%, transparent 19%), radial-gradient(circle at 80% 70%, rgba(90,200,250,0.12) 0 16%, transparent 17%)',
    outgoingBg: '#9b3fd4',
    outgoingFg: '#ffffff',
    incomingBg: '#ffffff',
    incomingFg: '#2a1840',
    nameTh: 'ม่วงหมอก',
    nameEn: 'Lavender Mist',
    subtitleTh: 'ม่วงนุ่มละมุน',
    subtitleEn: 'Soft lavender haze',
  },
  {
    id: 'matchday',
    swatch: '#ff375f',
    swatchSecondary: '#111827',
    background: 'linear-gradient(180deg, #0f172a 0%, #111827 55%, #1e293b 100%)',
    pattern:
      'repeating-linear-gradient(-12deg, transparent, transparent 14px, rgba(255,55,95,0.05) 14px, rgba(255,55,95,0.05) 15px)',
    outgoingBg: '#ff375f',
    outgoingFg: '#ffffff',
    incomingBg: '#1f2937',
    incomingFg: '#f8fafc',
    nameTh: 'วันแข่ง',
    nameEn: 'Match Day',
    subtitleTh: 'เข้ม ลุ้น เต็มที่',
    subtitleEn: 'Bold game-day energy',
  },
];

export const DEFAULT_CHAT_THEME_ID: ChatThemeId = 'classic';

export function isChatThemeId(value: unknown): value is ChatThemeId {
  return typeof value === 'string' && CHAT_THEMES.some((t) => t.id === value);
}

export function getChatTheme(id: string | null | undefined): ChatTheme {
  return CHAT_THEMES.find((t) => t.id === id) ?? CHAT_THEMES[0];
}

const DARK_THEME_IDS: ChatThemeId[] = ['night-market', 'sunset-run', 'matchday'];

export function isDarkChatTheme(theme: ChatTheme): boolean {
  return DARK_THEME_IDS.includes(theme.id);
}

/** CSS vars shared by bubbles, header, and composer */
export function chatThemeCssVars(theme: ChatTheme): CSSProperties {
  const dark = isDarkChatTheme(theme);
  return {
    ['--chat-out-bg' as string]: theme.outgoingBg,
    ['--chat-out-fg' as string]: theme.outgoingFg,
    ['--chat-in-bg' as string]: theme.incomingBg,
    ['--chat-in-fg' as string]: theme.incomingFg,
    ['--chat-accent' as string]: theme.swatch,
    ['--chat-chrome-fg' as string]: dark ? '#f5f5f7' : '#1d1d1f',
    ['--chat-chrome-muted' as string]: dark ? 'rgba(245,245,247,0.72)' : 'rgba(29,29,31,0.62)',
    ['--chat-chrome-bg' as string]: dark
      ? `color-mix(in srgb, ${theme.swatch} 22%, rgba(18,14,16,0.78))`
      : `color-mix(in srgb, ${theme.swatch} 16%, rgba(255,255,255,0.86))`,
    ['--chat-chrome-border' as string]: dark
      ? 'rgba(255,255,255,0.12)'
      : 'rgba(0,0,0,0.08)',
    ['--chat-composer-bg' as string]: dark
      ? `color-mix(in srgb, ${theme.swatch} 14%, rgba(22,16,18,0.88))`
      : `color-mix(in srgb, ${theme.swatch} 10%, rgba(255,255,255,0.92))`,
    ['--chat-input-bg' as string]: dark
      ? 'rgba(255,255,255,0.10)'
      : 'rgba(0,0,0,0.05)',
  };
}

export function chatThemeSurfaceStyle(theme: ChatTheme): CSSProperties {
  const vars = chatThemeCssVars(theme);
  if (theme.pattern) {
    return {
      backgroundImage: `${theme.pattern}, ${theme.background}`,
      ...vars,
    };
  }
  return {
    background: theme.background,
    ...vars,
  };
}

/** Translucent header / chrome bar tinted by the active theme */
export function chatThemeChromeStyle(theme: ChatTheme): CSSProperties {
  return {
    ...chatThemeCssVars(theme),
    background: 'var(--chat-chrome-bg)',
    color: 'var(--chat-chrome-fg)',
    borderColor: 'var(--chat-chrome-border)',
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
  };
}

export function chatBubbleContentStyle(
  theme: ChatTheme,
  side: 'outgoing' | 'incoming'
): CSSProperties {
  if (side === 'outgoing') {
    return { background: theme.outgoingBg, color: theme.outgoingFg };
  }
  return { background: theme.incomingBg, color: theme.incomingFg };
}
