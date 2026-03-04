'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useThemeStore, type ThemeMode } from '@/store/themeStore';
import { useTranslation } from '@/hooks/useTranslation';

// ==================== MAGIC UI THEME TOGGLE ====================
// Animated sun ↔ moon morph toggle with dropdown for system option

interface ThemeToggleProps {
  compact?: boolean;
  size?: 'small' | 'medium';
}

export default function ThemeToggle({ compact = true, size = 'medium' }: ThemeToggleProps) {
  const { mode, resolvedMode, setMode, toggleMode } = useThemeStore();
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [didLongPress, setDidLongPress] = useState(false);

  const btnSize = size === 'small' ? 34 : 40;
  const iconSize = size === 'small' ? 18 : 22;
  const isDark = resolvedMode === 'dark';

  // Close on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Short press = toggle, Long press = open menu
  const handlePointerDown = useCallback(() => {
    setDidLongPress(false);
    longPressTimer.current = setTimeout(() => {
      setDidLongPress(true);
      setMenuOpen(v => !v);
    }, 500);
  }, []);

  const handlePointerUp = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (!didLongPress && !menuOpen) {
      toggleMode();
    }
    // Reset after a tick
    setTimeout(() => setDidLongPress(false), 50);
  }, [didLongPress, menuOpen, toggleMode]);

  const handlePointerCancel = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleSelect = (newMode: ThemeMode) => {
    setMode(newMode);
    setMenuOpen(false);
  };

  const OPTIONS: { mode: ThemeMode; label: string; icon: string }[] = [
    { mode: 'light',  label: t.theme.light, icon: '☀️' },
    { mode: 'dark',   label: t.theme.dark,  icon: '🌙' },
    { mode: 'system', label: t.theme.auto,  icon: '💻' },
  ];

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      {/* ---- Animated Toggle Button ---- */}
      <button
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onContextMenu={e => { e.preventDefault(); setMenuOpen(v => !v); }}
        title={`${t.theme.changeTheme} (${t.theme[mode === 'system' ? 'auto' : mode]})`}
        aria-haspopup="true"
        aria-expanded={menuOpen}
        className="magic-theme-toggle"
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
          transition: 'background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease',
          boxShadow: menuOpen
            ? '0 0 0 3px rgba(10,132,255,0.25)'
            : isDark
              ? '0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)'
              : '0 1px 5px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.5)',
        }}
      >
        {/* Sun/Moon SVG with animated morph */}
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

        {/* System mode indicator dot */}
        {mode === 'system' && (
          <span
            style={{
              position: 'absolute',
              bottom: 2,
              right: 2,
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #0071e3, #64d2ff)',
              border: '1.5px solid var(--glass-bg)',
              animation: 'systemDotPulse 3s ease-in-out infinite',
            }}
          />
        )}
      </button>

      {/* ---- Dropdown Menu ---- */}
      {menuOpen && (
        <div
          role="menu"
          aria-label={t.theme.changeTheme}
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            minWidth: 180,
            background: 'var(--glass-strong)',
            backdropFilter: 'blur(40px) saturate(200%)',
            WebkitBackdropFilter: 'blur(40px) saturate(200%)',
            border: '1px solid var(--glass-border)',
            borderRadius: 16,
            boxShadow: isDark
              ? '0 12px 48px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04)'
              : '0 12px 48px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)',
            padding: '6px',
            zIndex: 9999,
            animation: 'fadeInScale 0.2s cubic-bezier(0.32, 0.72, 0, 1)',
          }}
        >
          {/* Header */}
          <div style={{
            padding: '8px 12px 6px',
            fontSize: '0.68rem',
            fontWeight: 700,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}>
            {t.theme.changeTheme}
          </div>

          {OPTIONS.map(({ mode: m, label, icon }) => {
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
                  padding: '10px 12px',
                  borderRadius: 12,
                  border: 'none',
                  background: active 
                    ? isDark 
                      ? 'rgba(10,132,255,0.15)' 
                      : 'rgba(0,113,227,0.1)' 
                    : 'transparent',
                  color: active ? 'var(--primary)' : 'var(--foreground)',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: active ? 650 : 500,
                  fontFamily: 'inherit',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
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
                  width: 32, height: 32,
                  borderRadius: 10,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                  background: active 
                    ? isDark 
                      ? 'rgba(10,132,255,0.2)' 
                      : 'rgba(0,113,227,0.12)' 
                    : 'var(--surface-2)',
                  fontSize: '1rem',
                  transition: 'all 0.2s ease',
                }}>
                  {icon}
                </span>

                {/* Label */}
                <span style={{ flex: 1 }}>{label}</span>

                {/* Active indicator */}
                {active && (
                  <span style={{ 
                    width: 20, height: 20,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #0071e3, #2997ff)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                )}
              </button>
            );
          })}

          {/* Tip */}
          <div style={{
            padding: '8px 12px 6px',
            fontSize: '0.6rem',
            color: 'var(--text-muted)',
            opacity: 0.6,
            textAlign: 'center',
            borderTop: '1px solid var(--glass-border)',
            marginTop: 4,
          }}>
            {/* Use lang-based tip */}
            {'Tap = toggle • Hold = menu'}
          </div>
        </div>
      )}

      {/* Inline styles for animations */}
      <style jsx>{`
        @keyframes systemDotPulse {
          0%, 100% { opacity: 0.7; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.15); }
        }
        .magic-theme-toggle:hover {
          border-color: rgba(0,113,227,0.3) !important;
          background: var(--surface-2) !important;
          transform: scale(1.05);
        }
        .magic-theme-toggle:active {
          transform: scale(0.92) !important;
        }
      `}</style>
    </div>
  );
}
