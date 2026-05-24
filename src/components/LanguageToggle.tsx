'use client';

import React from 'react';
import { useLanguageStore } from '@/store/languageStore';
import { useThemeStore } from '@/store/themeStore';

interface LanguageToggleProps {
  size?: 'small' | 'medium';
}

/**
 * Language selector — Apple-style circular button toggle.
 * Matches the styling and animations of the ThemeToggle component.
 */
export default function LanguageToggle({ size = 'medium' }: LanguageToggleProps) {
  const language = useLanguageStore((s) => s.language);
  const setLanguage = useLanguageStore((s) => s.setLanguage);
  const resolvedMode = useThemeStore((s) => s.resolvedMode);

  const btnSize = size === 'small' ? 34 : 40;
  const isDark = resolvedMode === 'dark';

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLanguage(language === 'th' ? 'en' : 'th');
  };

  return (
    <div style={{ display: 'inline-block' }}>
      <button
        onClick={handleToggle}
        title={language === 'th' ? 'Switch to English' : 'เปลี่ยนเป็นภาษาไทย'}
        className="magic-lang-toggle"
        style={{
          width: btnSize,
          height: btnSize,
          borderRadius: '50%',
          border: '1px solid var(--glass-border)',
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          color: 'var(--foreground)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          overflow: 'hidden',
          position: 'relative',
          padding: 0,
          flexShrink: 0,
          userSelect: 'none',
          transition: 'background 0.3s ease, border-color 0.3s ease, transform 0.2s ease, box-shadow 0.3s ease',
          boxShadow: isDark
            ? '0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)'
            : '0 1px 5px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.5)',
        }}
      >
        <span
          style={{
            fontSize: size === 'small' ? '0.72rem' : '0.8rem',
            fontWeight: 800,
            letterSpacing: '0.04em',
            lineHeight: 1,
            fontFamily: 'inherit',
          }}
        >
          {language.toUpperCase()}
        </span>
      </button>

      {/* Inline styles for hover/active states */}
      <style jsx>{`
        .magic-lang-toggle:hover {
          border-color: rgba(0,113,227,0.3) !important;
          background: var(--surface-2) !important;
          transform: scale(1.05);
        }
        .magic-lang-toggle:active {
          transform: scale(0.92) !important;
        }
      `}</style>
    </div>
  );
}
