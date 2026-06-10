'use client';

import React, { useEffect, useState } from 'react';
import { useThemeStore } from '@/store/themeStore';
import { useTranslation } from '@/hooks/useTranslation';

interface ThemeToggleProps {
  compact?: boolean;
  size?: 'small' | 'medium';
}

export default function ThemeToggle({ compact = true, size = 'medium' }: ThemeToggleProps) {
  const { mode, resolvedMode, toggleMode } = useThemeStore();
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const btnSize = size === 'small' ? 34 : 40;
  const iconSize = size === 'small' ? 18 : 22;
  const isDark = mounted && resolvedMode === 'dark';

  if (!mounted) {
    return (
      <div
        style={{ display: 'inline-block', width: btnSize, height: btnSize, flexShrink: 0 }}
        aria-hidden
        suppressHydrationWarning
      />
    );
  }

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleMode();
  };

  return (
    <div style={{ display: 'inline-block' }}>
      <button
        type="button"
        onClick={handleToggle}
        title={`${t.theme.changeTheme} (${t.theme[mode === 'system' ? 'auto' : mode] || mode})`}
        className="magic-theme-toggle"
        suppressHydrationWarning
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
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{
            transition: 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
            transform: isDark ? 'rotate(45deg)' : 'rotate(0deg)',
          }}
        >
          {/* Sun circle / Moon body */}
          <circle
            cx="12"
            cy="12"
            r={isDark ? 5 : 4}
            fill={isDark ? 'var(--foreground)' : 'currentColor'}
            style={{
              transition: 'r 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), fill 0.3s ease',
            }}
          />
          
          {/* Moon mask (crescent cutout effect) */}
          <circle
            cx={isDark ? 16 : 12}
            cy={isDark ? 8 : 12}
            r={isDark ? 4.5 : 0}
            fill="var(--glass-bg)"
            style={{
              transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
          />

          {/* Sun rays — animate opacity & scale */}
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => {
            const rad = (angle * Math.PI) / 180;
            const x1 = 12 + Math.cos(rad) * 7;
            const y1 = 12 + Math.sin(rad) * 7;
            const x2 = 12 + Math.cos(rad) * 9.5;
            const y2 = 12 + Math.sin(rad) * 9.5;
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                style={{
                  opacity: isDark ? 0 : 1,
                  transform: isDark ? 'scale(0.3)' : 'scale(1)',
                  transformOrigin: '12px 12px',
                  transition: `opacity 0.3s ease ${i * 0.03}s, transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) ${i * 0.03}s`,
                }}
              />
            );
          })}
        </svg>
      </button>
    </div>
  );
}
