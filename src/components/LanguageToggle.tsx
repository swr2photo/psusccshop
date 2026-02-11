'use client';

import React from 'react';
import { Box, Typography } from '@mui/material';
import { useLanguageStore } from '@/store/languageStore';

interface LanguageToggleProps {
  size?: 'small' | 'medium';
}

/**
 * Compact TH/EN language selector.
 * Apple-style segmented control — tap each segment to select.
 */
export default function LanguageToggle({ size = 'medium' }: LanguageToggleProps) {
  const language = useLanguageStore((s) => s.language);
  const setLanguage = useLanguageStore((s) => s.setLanguage);

  const isSmall = size === 'small';
  const height = isSmall ? 28 : 32;
  const segW = isSmall ? 32 : 36;
  const fontSize = isSmall ? '0.68rem' : '0.75rem';
  const gap = 2; // px between segments inside container
  const pad = 2; // inner padding of container

  const handleSelect = (lang: 'th' | 'en') => (e: React.MouseEvent) => {
    e.stopPropagation();
    if (language !== lang) setLanguage(lang);
  };

  return (
    <Box
      role="radiogroup"
      aria-label="เลือกภาษา / Select language"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        height,
        borderRadius: height / 2,
        p: `${pad}px`,
        bgcolor: (theme) => theme.palette.mode === 'dark'
          ? 'rgba(255,255,255,0.08)'
          : 'rgba(0,0,0,0.06)',
        border: (theme) => `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
        gap: `${gap}px`,
        boxSizing: 'border-box',
        flexShrink: 0,
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {(['th', 'en'] as const).map((lang) => {
        const active = language === lang;
        return (
          <Box
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
            sx={{
              width: segW,
              height: height - pad * 2,
              borderRadius: (height - pad * 2) / 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(0.32, 0.72, 0, 1)',
              bgcolor: active ? '#0071e3' : 'transparent',
              boxShadow: active ? '0 1px 4px rgba(0,113,227,0.3)' : 'none',
              '&:hover': {
                bgcolor: active
                  ? '#0077ed'
                  : (theme) => theme.palette.mode === 'dark'
                    ? 'rgba(255,255,255,0.06)'
                    : 'rgba(0,0,0,0.04)',
              },
              '&:active': {
                transform: 'scale(0.95)',
              },
            }}
          >
            <Typography
              sx={{
                fontSize,
                fontWeight: 700,
                color: active ? '#fff' : 'var(--text-muted)',
                transition: 'color 0.2s ease',
                lineHeight: 1,
                letterSpacing: '0.02em',
                pointerEvents: 'none',
              }}
            >
              {lang.toUpperCase()}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}
