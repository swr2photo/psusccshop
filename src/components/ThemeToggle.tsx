'use client';

import React, { useRef, useEffect, useState } from 'react';
import { useThemeStore, type ThemeMode } from '@/store/themeStore';
import { useTranslation } from '@/hooks/useTranslation';

// ==================== SVG ICONS ====================

const SunIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="4.5" />
    <line x1="12" y1="2" x2="12" y2="4" />
    <line x1="12" y1="20" x2="12" y2="22" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="2" y1="12" x2="4" y2="12" />
    <line x1="20" y1="12" x2="22" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

const MoonIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const SystemIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

const CheckIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

// ==================== TYPES ====================

interface ThemeToggleProps {
  compact?: boolean;
  size?: 'small' | 'medium';
}

// ==================== COMPONENT ====================

export default function ThemeToggle({ compact = true, size = 'medium' }: ThemeToggleProps) {
  const { mode, resolvedMode, setMode } = useThemeStore();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const btnSize = size === 'small' ? 32 : 36;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const handleSelect = (newMode: ThemeMode) => {
    setMode(newMode);
    setOpen(false);
  };

  const CurrentIcon = resolvedMode === 'dark' ? MoonIcon : SunIcon;

  const OPTIONS: { mode: ThemeMode; Icon: typeof SunIcon; label: string }[] = [
    { mode: 'light', Icon: SunIcon,    label: t.theme.light },
    { mode: 'dark',  Icon: MoonIcon,   label: t.theme.dark  },
    { mode: 'system',Icon: SystemIcon, label: t.theme.auto  },
  ];

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      {/* Trigger Button */}
      <button
        onClick={() => setOpen(v => !v)}
        title={t.theme.changeTheme}
        aria-haspopup="true"
        aria-expanded={open}
        style={{
          width: btnSize,
          height: btnSize,
          borderRadius: '50%',
          border: '1px solid var(--glass-border)',
          background: open ? 'var(--surface-2)' : 'var(--glass-bg)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          color: 'var(--foreground)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s cubic-bezier(0.32, 0.72, 0, 1)',
          boxShadow: open
            ? '0 0 0 3px rgba(10,132,255,0.2)'
            : '0 1px 4px rgba(0,0,0,0.12)',
          transform: open ? 'scale(0.95)' : 'scale(1)',
          flexShrink: 0,
        }}
        onMouseEnter={e => {
          if (!open) {
            (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.08) rotate(12deg)';
            (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-2)';
          }
        }}
        onMouseLeave={e => {
          if (!open) {
            (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
            (e.currentTarget as HTMLButtonElement).style.background = 'var(--glass-bg)';
          }
        }}
      >
        <CurrentIcon size={size === 'small' ? 16 : 18} />
      </button>

      {/* Dropdown Menu */}
      {open && (
        <div
          role="menu"
          aria-label={t.theme.changeTheme}
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            minWidth: 168,
            background: 'var(--glass-strong)',
            backdropFilter: 'blur(40px) saturate(200%)',
            WebkitBackdropFilter: 'blur(40px) saturate(200%)',
            border: '1px solid var(--glass-border)',
            borderRadius: 16,
            boxShadow: '0 8px 40px rgba(0,0,0,0.2), 0 2px 8px rgba(0,0,0,0.12)',
            padding: '6px',
            zIndex: 9999,
            animation: 'fadeInScale 0.2s cubic-bezier(0.32, 0.72, 0, 1)',
          }}
        >
          {OPTIONS.map(({ mode: m, Icon, label }) => {
            const active = mode === m;
            return (
              <button
                key={m}
                role="menuitem"
                onClick={() => handleSelect(m)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 12px',
                  borderRadius: 10,
                  border: 'none',
                  background: active ? 'rgba(10,132,255,0.12)' : 'transparent',
                  color: active ? 'var(--primary)' : 'var(--foreground)',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: active ? 600 : 500,
                  fontFamily: 'inherit',
                  textAlign: 'left',
                  transition: 'background 0.15s ease, color 0.15s ease',
                  letterSpacing: '-0.01em',
                }}
                onMouseEnter={e => {
                  if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-2)';
                }}
                onMouseLeave={e => {
                  if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                }}
              >
                {/* Icon */}
                <span style={{
                  width: 30, height: 30,
                  borderRadius: 8,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                  background: active ? 'rgba(10,132,255,0.15)' : 'var(--surface-2)',
                  color: active ? 'var(--primary)' : 'var(--text-muted)',
                  transition: 'all 0.15s ease',
                }}>
                  <Icon size={16} />
                </span>

                {/* Label */}
                <span style={{ flex: 1 }}>{label}</span>

                {/* Check */}
                {active && (
                  <span style={{ color: 'var(--primary)', flexShrink: 0 }}>
                    <CheckIcon />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
