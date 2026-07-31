'use client';

export type NotificationTone = 'info' | 'success' | 'warning' | 'error' | 'guide' | 'neutral';

export type NotificationMode = 'ask' | 'denied' | 'ios-guide' | 'unsupported';

export function getNotificationPalette(tone: NotificationTone) {
  switch (tone) {
    case 'success':
      return {
        accent: '#34c759',
        accentSoft: 'rgba(52, 199, 89, 0.18)',
        shell: 'linear-gradient(180deg, rgba(52, 199, 89, 0.14) 0%, rgba(255,255,255,0.96) 100%)',
        glow: '0 24px 60px rgba(52, 199, 89, 0.18)',
        ring: 'rgba(52, 199, 89, 0.22)',
      };
    case 'warning':
      return {
        accent: '#ff9f0a',
        accentSoft: 'rgba(255, 159, 10, 0.18)',
        shell: 'linear-gradient(180deg, rgba(255, 159, 10, 0.14) 0%, rgba(255,255,255,0.96) 100%)',
        glow: '0 24px 60px rgba(255, 159, 10, 0.16)',
        ring: 'rgba(255, 159, 10, 0.22)',
      };
    case 'error':
      return {
        accent: '#ff453a',
        accentSoft: 'rgba(255, 69, 58, 0.18)',
        shell: 'linear-gradient(180deg, rgba(255, 69, 58, 0.16) 0%, rgba(255,255,255,0.96) 100%)',
        glow: '0 24px 60px rgba(255, 69, 58, 0.18)',
        ring: 'rgba(255, 69, 58, 0.22)',
      };
    case 'guide':
      return {
        accent: '#5ac8fa',
        accentSoft: 'rgba(90, 200, 250, 0.18)',
        shell: 'linear-gradient(180deg, rgba(90, 200, 250, 0.14) 0%, rgba(255,255,255,0.96) 100%)',
        glow: '0 24px 60px rgba(90, 200, 250, 0.16)',
        ring: 'rgba(90, 200, 250, 0.24)',
      };
    case 'neutral':
      return {
        accent: '#8e8e93',
        accentSoft: 'rgba(142, 142, 147, 0.18)',
        shell: 'linear-gradient(180deg, rgba(142, 142, 147, 0.12) 0%, rgba(255,255,255,0.96) 100%)',
        glow: '0 24px 60px rgba(0, 0, 0, 0.14)',
        ring: 'rgba(142, 142, 147, 0.2)',
      };
    default:
      return {
        accent: '#0071e3',
        accentSoft: 'rgba(0, 113, 227, 0.18)',
        shell: 'linear-gradient(180deg, rgba(0, 113, 227, 0.14) 0%, rgba(255,255,255,0.96) 100%)',
        glow: '0 24px 60px rgba(0, 113, 227, 0.16)',
        ring: 'rgba(0, 113, 227, 0.2)',
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
