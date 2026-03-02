'use client';

import React from 'react';
import { useLanguageStore } from '@/store/languageStore';

interface LanguageToggleProps {
  size?: 'small' | 'medium';
}

/**
 * Language selector — Apple-style pill segmented control.
 * Uses CSS variables from the global theme system.
 */
export default function LanguageToggle({ size = 'medium' }: LanguageToggleProps) {
  const language = useLanguageStore((s) => s.language);
  const setLanguage = useLanguageStore((s) => s.setLanguage);

  const isSmall = size === 'small';
  const height = isSmall ? 30 : 34;
  const segW   = isSmall ? 34 : 40;
  const fontSize = isSmall ? '0.68rem' : '0.73rem';
  const pad = 3;

  const handleSelect = (lang: 'th' | 'en') => (e: React.MouseEvent) => {
    e.stopPropagation();
    if (language !== lang) setLanguage(lang);
  };

  return (
    <div
      role="radiogroup"
      aria-label="เลือกภาษา / Select language"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height,
        borderRadius: height / 2,
        padding: pad,
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid var(--glass-border)',
        gap: 2,
        boxSizing: 'border-box',
        flexShrink: 0,
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent' as any,
        boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
      }}
    >
      {(['th', 'en'] as const).map((lang) => {
        const active = language === lang;

        return (
          <div
            key={lang}
            role="radio"
            aria-checked={active}
            aria-label={lang === 'th' ? 'ภาษาไทย' : 'English'}
            tabIndex={active ? 0 : -1}
            onClick={handleSelect(lang)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (!active) setLanguage(lang);
              }
            }}
            style={{
              width: segW,
              height: height - pad * 2,
              borderRadius: (height - pad * 2) / 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: active ? 'default' : 'pointer',
              transition: 'all 0.22s cubic-bezier(0.32, 0.72, 0, 1)',
              background: active
                ? 'var(--primary)'
                : 'transparent',
              boxShadow: active
                ? '0 2px 8px rgba(10,132,255,0.35), inset 0 1px 0 rgba(255,255,255,0.15)'
                : 'none',
              transform: active ? 'scale(1)' : 'scale(0.95)',
            }}
            onMouseEnter={e => {
              if (!active) {
                (e.currentTarget as HTMLDivElement).style.background = 'var(--surface-2)';
                (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)';
              }
            }}
            onMouseLeave={e => {
              if (!active) {
                (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                (e.currentTarget as HTMLDivElement).style.transform = 'scale(0.95)';
              }
            }}
            onMouseDown={e => {
              (e.currentTarget as HTMLDivElement).style.transform = 'scale(0.92)';
            }}
            onMouseUp={e => {
              (e.currentTarget as HTMLDivElement).style.transform = active ? 'scale(1)' : 'scale(1)';
            }}
          >
            <span
              style={{
                fontSize,
                fontWeight: active ? 700 : 600,
                color: active ? '#ffffff' : 'var(--text-muted)',
                transition: 'color 0.2s ease, font-weight 0.15s ease',
                lineHeight: 1,
                letterSpacing: '0.03em',
                pointerEvents: 'none',
              }}
            >
              {lang.toUpperCase()}
            </span>
          </div>
        );
      })}
    </div>
  );
}
