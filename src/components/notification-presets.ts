'use client';

export type NotificationTone = 'info' | 'success' | 'warning' | 'error' | 'guide' | 'neutral';

export type NotificationMode = 'ask' | 'denied' | 'ios-guide' | 'unsupported';

export function getNotificationPalette(tone: NotificationTone) {
  switch (tone) {
    case 'success':
      return {
        accent: '#10b981',
        accentSoft: 'rgba(16, 185, 129, 0.14)',
        shell:
          'linear-gradient(135deg, color-mix(in srgb, #10b981 10%, var(--surface, #ffffff)) 0%, color-mix(in srgb, var(--surface, #ffffff) 96%, transparent) 100%)',
        glow: '0 14px 36px -6px rgba(16, 185, 129, 0.22), 0 4px 14px -2px rgba(0, 0, 0, 0.12)',
        ring: 'color-mix(in srgb, #10b981 34%, var(--glass-border, rgba(148,163,184,0.25)))',
      };
    case 'warning':
      return {
        accent: '#f59e0b',
        accentSoft: 'rgba(245, 158, 11, 0.15)',
        shell:
          'linear-gradient(135deg, color-mix(in srgb, #f59e0b 10%, var(--surface, #ffffff)) 0%, color-mix(in srgb, var(--surface, #ffffff) 96%, transparent) 100%)',
        glow: '0 14px 36px -6px rgba(245, 158, 11, 0.22), 0 4px 14px -2px rgba(0, 0, 0, 0.12)',
        ring: 'color-mix(in srgb, #f59e0b 36%, var(--glass-border, rgba(148,163,184,0.25)))',
      };
    case 'error':
      return {
        accent: '#ef4444',
        accentSoft: 'rgba(239, 68, 68, 0.15)',
        shell:
          'linear-gradient(135deg, color-mix(in srgb, #ef4444 11%, var(--surface, #ffffff)) 0%, color-mix(in srgb, var(--surface, #ffffff) 96%, transparent) 100%)',
        glow: '0 14px 36px -6px rgba(239, 68, 68, 0.24), 0 4px 14px -2px rgba(0, 0, 0, 0.12)',
        ring: 'color-mix(in srgb, #ef4444 38%, var(--glass-border, rgba(148,163,184,0.25)))',
      };
    case 'guide':
      return {
        accent: '#0ea5e9',
        accentSoft: 'rgba(14, 165, 233, 0.14)',
        shell:
          'linear-gradient(135deg, color-mix(in srgb, #0ea5e9 10%, var(--surface, #ffffff)) 0%, color-mix(in srgb, var(--surface, #ffffff) 96%, transparent) 100%)',
        glow: '0 14px 36px -6px rgba(14, 165, 233, 0.22), 0 4px 14px -2px rgba(0, 0, 0, 0.12)',
        ring: 'color-mix(in srgb, #0ea5e9 34%, var(--glass-border, rgba(148,163,184,0.25)))',
      };
    case 'neutral':
      return {
        accent: '#64748b',
        accentSoft: 'rgba(100, 116, 139, 0.14)',
        shell:
          'linear-gradient(135deg, color-mix(in srgb, #64748b 8%, var(--surface, #ffffff)) 0%, color-mix(in srgb, var(--surface, #ffffff) 96%, transparent) 100%)',
        glow: '0 14px 36px -6px rgba(0, 0, 0, 0.18), 0 4px 14px -2px rgba(0, 0, 0, 0.1)',
        ring: 'var(--glass-border, rgba(148,163,184,0.25))',
      };
    default:
      return {
        accent: '#0071e3',
        accentSoft: 'rgba(0, 113, 227, 0.14)',
        shell:
          'linear-gradient(135deg, color-mix(in srgb, #0071e3 10%, var(--surface, #ffffff)) 0%, color-mix(in srgb, var(--surface, #ffffff) 96%, transparent) 100%)',
        glow: '0 14px 36px -6px rgba(0, 113, 227, 0.22), 0 4px 14px -2px rgba(0, 0, 0, 0.12)',
        ring: 'color-mix(in srgb, #0071e3 34%, var(--glass-border, rgba(148,163,184,0.25)))',
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
