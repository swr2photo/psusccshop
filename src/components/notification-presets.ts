'use client';

export type NotificationTone = 'info' | 'success' | 'warning' | 'error' | 'guide' | 'neutral';

export type NotificationMode = 'ask' | 'denied' | 'ios-guide' | 'unsupported';

export function getNotificationPalette(tone: NotificationTone) {
  const neutralShell = 'color-mix(in srgb, var(--surface, #ffffff) 96%, transparent)';
  const neutralGlow = '0 12px 32px -4px rgba(0, 0, 0, 0.12), 0 4px 12px -2px rgba(0, 0, 0, 0.06)';
  const neutralRing = 'var(--glass-border, rgba(148, 163, 184, 0.22))';

  switch (tone) {
    case 'success':
      return {
        accent: '#10b981',
        accentSoft: 'transparent',
        shell: neutralShell,
        glow: neutralGlow,
        ring: neutralRing,
      };
    case 'warning':
      return {
        accent: '#f59e0b',
        accentSoft: 'transparent',
        shell: neutralShell,
        glow: neutralGlow,
        ring: neutralRing,
      };
    case 'error':
      return {
        accent: '#ef4444',
        accentSoft: 'transparent',
        shell: neutralShell,
        glow: neutralGlow,
        ring: neutralRing,
      };
    case 'guide':
      return {
        accent: '#0ea5e9',
        accentSoft: 'transparent',
        shell: neutralShell,
        glow: neutralGlow,
        ring: neutralRing,
      };
    case 'neutral':
      return {
        accent: '#64748b',
        accentSoft: 'transparent',
        shell: neutralShell,
        glow: neutralGlow,
        ring: neutralRing,
      };
    default:
      return {
        accent: '#0071e3',
        accentSoft: 'transparent',
        shell: neutralShell,
        glow: neutralGlow,
        ring: neutralRing,
      };
  }
}

export function getNotificationModeTone(mode: NotificationMode): NotificationTone {
  switch (mode) {
    case 'denied':
      return 'warning';
    case 'ios-guide':
      return 'guide';
    case 'unsupported':
      return 'neutral';
    default:
      return 'info';
  }
}
