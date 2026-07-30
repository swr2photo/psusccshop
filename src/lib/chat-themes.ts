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
    swatch: '#007aff',
    swatchSecondary: '#34c759',
    background: 'var(--surface-2)',
    outgoingBg: 'linear-gradient(135deg, #007aff 0%, #005bb5 100%)',
    outgoingFg: '#ffffff',
    incomingBg: '#e5e5ea',
    incomingFg: '#000000',
    nameTh: 'คลาสสิก',
    nameEn: 'Classic',
    subtitleTh: 'สีมาตรฐานเรียบง่าย',
    subtitleEn: 'Standard clean colors',
  },
  {
    id: 'scc-blue',
    swatch: '#0a84ff',
    swatchSecondary: '#64d2ff',
    background: 'linear-gradient(180deg, #f0f7ff 0%, #ffffff 100%)',
    pattern:
      'radial-gradient(circle at 12% 18%, rgba(10,132,255,0.06) 0 2px, transparent 3px), radial-gradient(circle at 78% 42%, rgba(10,132,255,0.05) 0 2px, transparent 3px)',
    outgoingBg: 'linear-gradient(135deg, #0a84ff 0%, #0066cc 100%)',
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
    swatch: '#ff6b4a',
    swatchSecondary: '#ffd166',
    background: 'linear-gradient(165deg, #fff2eb 0%, #ffdfcc 40%, #f7e6ff 100%)',
    outgoingBg: 'linear-gradient(135deg, #ff6b4a 0%, #ff4b2b 100%)',
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
    swatch: '#ffcc00',
    swatchSecondary: '#ff9500',
    background: 'linear-gradient(180deg, #0d0d0d 0%, #1a1a1c 100%)',
    pattern:
      'radial-gradient(circle at 20% 30%, rgba(255,204,0,0.08) 0 1.5px, transparent 2px), radial-gradient(circle at 70% 60%, rgba(255,255,255,0.04) 0 1.5px, transparent 2px)',
    outgoingBg: 'linear-gradient(135deg, #ffcc00 0%, #ff9500 100%)',
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
    swatch: '#34c759',
    swatchSecondary: '#30db5b',
    background: 'linear-gradient(180deg, #e4f9eb 0%, #ffffff 100%)',
    pattern:
      'linear-gradient(135deg, rgba(52,199,89,0.05) 25%, transparent 25%), linear-gradient(225deg, rgba(52,199,89,0.05) 25%, transparent 25%)',
    outgoingBg: 'linear-gradient(135deg, #34c759 0%, #248a3d 100%)',
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
    swatch: '#ff3b30',
    swatchSecondary: '#ff9f0a',
    background: 'linear-gradient(160deg, #1f0b24 0%, #3a1521 45%, #5a2213 100%)',
    outgoingBg: 'linear-gradient(135deg, #ff453a 0%, #ff9f0a 100%)',
    outgoingFg: '#ffffff',
    incomingBg: 'rgba(255,255,255,0.1)',
    incomingFg: '#fff5f0',
    nameTh: 'วิ่งยามเย็น',
    nameEn: 'Sunset Run',
    subtitleTh: 'ส้มแดงพลบค่ำ',
    subtitleEn: 'Sunset orange dusk',
  },
  {
    id: 'lavender-mist',
    swatch: '#af52de',
    swatchSecondary: '#ff2d55',
    background: 'linear-gradient(180deg, #f4ebff 0%, #ffffff 100%)',
    pattern:
      'radial-gradient(circle at 30% 20%, rgba(175,82,222,0.08) 0 18%, transparent 19%), radial-gradient(circle at 80% 70%, rgba(255,45,85,0.06) 0 16%, transparent 17%)',
    outgoingBg: 'linear-gradient(135deg, #af52de 0%, #5e5ce6 100%)',
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
    swatch: '#ff2d55',
    swatchSecondary: '#111827',
    background: 'linear-gradient(180deg, #09090b 0%, #111827 55%, #1e293b 100%)',
    pattern:
      'repeating-linear-gradient(-12deg, transparent, transparent 14px, rgba(255,45,85,0.05) 14px, rgba(255,45,85,0.05) 15px)',
    outgoingBg: 'linear-gradient(135deg, #ff2d55 0%, #c10020 100%)',
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
      ? `color-mix(in srgb, ${theme.swatch} 15%, rgba(15,15,15,0.85))`
      : `color-mix(in srgb, ${theme.swatch} 5%, rgba(255,255,255,0.95))`,
    ['--chat-chrome-border' as string]: dark
      ? 'rgba(255,255,255,0.08)'
      : 'rgba(0,0,0,0.05)',
    ['--chat-composer-bg' as string]: dark
      ? `color-mix(in srgb, ${theme.swatch} 10%, rgba(20,20,20,0.9))`
      : `color-mix(in srgb, ${theme.swatch} 5%, rgba(255,255,255,0.98))`,
    ['--chat-input-bg' as string]: dark
      ? 'rgba(255,255,255,0.08)'
      : 'rgba(0,0,0,0.04)',
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
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
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
