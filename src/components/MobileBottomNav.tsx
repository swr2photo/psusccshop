'use client';

import type { ReactNode } from 'react';
import { Box, Typography } from '@mui/material';
import ProgressiveBlurChrome from '@/components/ui/ProgressiveBlurChrome';

export type MobileBottomTab = {
  key: string;
  label: string;
  icon: ReactNode;
  center?: boolean;
};

type MobileBottomNavProps = {
  tabs: MobileBottomTab[];
  activeKey: string;
  chatActive?: boolean;
  hidden?: boolean;
  onTabClick: (key: string) => void;
  onChatClick: (anchor: HTMLElement) => void;
};

/**
 * Mobile full-bleed tab bar — Apple progressive blur fading upward into content.
 */
export default function MobileBottomNav({
  tabs,
  activeKey,
  chatActive = false,
  hidden = false,
  onTabClick,
  onChatClick,
}: MobileBottomNavProps) {
  return (
    <Box
      component="nav"
      aria-label="Mobile navigation"
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1100,
        display: { xs: 'block', md: 'none' },
        pointerEvents: 'none',
        transform: hidden ? 'translateY(110%)' : 'translateY(0)',
        opacity: hidden ? 0 : 1,
        transition: 'transform 0.4s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.28s ease',
      }}
    >
      <ProgressiveBlurChrome
        edge="top"
        fadeExtent={64}
        intensity="strong"
        sx={{
          width: '100%',
          pointerEvents: 'none',
          pt: 3.5,
        }}
        contentSx={{
          pointerEvents: 'auto',
          px: 0.5,
          pb: 'max(0.2rem, env(safe-area-inset-bottom))',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 0.15,
            px: 0.35,
            pt: 0.35,
            pb: 0.25,
            maxWidth: 520,
            mx: 'auto',
          }}
        >
          {tabs.map((tab) => {
            const isActive = tab.key === 'chat' ? chatActive : activeKey === tab.key;

            if (tab.center) {
              return (
                <Box
                  key={tab.key}
                  component="button"
                  type="button"
                  aria-label={tab.label}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={(e: React.MouseEvent<HTMLElement>) => onChatClick(e.currentTarget)}
                  sx={{
                    flex: '0 0 auto',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 0.2,
                    mt: -1.75,
                    mx: 0.15,
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    touchAction: 'manipulation',
                    WebkitTapHighlightColor: 'transparent',
                    userSelect: 'none',
                    p: 0,
                    minWidth: 56,
                  }}
                >
                  <Box
                    sx={{
                      width: 52,
                      height: 52,
                      borderRadius: '50%',
                      background: 'linear-gradient(160deg, #0a84ff 0%, #0071e3 55%, #5e5ce6 100%)',
                      display: 'grid',
                      placeItems: 'center',
                      color: '#fff',
                      boxShadow:
                        '0 6px 18px rgba(0,113,227,0.35), 0 0 0 3px rgba(255,255,255,0.35)',
                      transition: 'transform 0.18s cubic-bezier(0.22, 1, 0.36, 1)',
                      '&:active': { transform: 'scale(0.94)' },
                    }}
                  >
                    {tab.icon}
                  </Box>
                  <Typography
                    sx={{
                      fontSize: '0.58rem',
                      fontWeight: 700,
                      letterSpacing: '-0.02em',
                      color: isActive ? '#0071e3' : 'var(--primary)',
                      lineHeight: 1.1,
                    }}
                  >
                    {tab.label}
                  </Typography>
                </Box>
              );
            }

            return (
              <Box
                key={tab.key}
                component="button"
                type="button"
                data-tab-key={tab.key}
                aria-label={tab.label}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onTabClick(tab.key)}
                sx={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 0.2,
                  minWidth: 0,
                  minHeight: 48,
                  px: 0.25,
                  py: 0.4,
                  border: 'none',
                  borderRadius: '14px',
                  cursor: 'pointer',
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent',
                  userSelect: 'none',
                  position: 'relative',
                  color: isActive ? '#0071e3' : 'var(--text-muted)',
                  background: 'transparent',
                  transition: 'color 0.2s ease',
                  '&:active': { transform: 'scale(0.96)', opacity: 0.85 },
                }}
              >
                {/* Soft active glow — no hard capsule card */}
                <Box
                  aria-hidden
                  sx={{
                    position: 'absolute',
                    top: 4,
                    left: '50%',
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    transform: isActive
                      ? 'translateX(-50%) scale(1)'
                      : 'translateX(-50%) scale(0.5)',
                    opacity: isActive ? 1 : 0,
                    background: (theme) =>
                      theme.palette.mode === 'dark'
                        ? 'radial-gradient(circle, rgba(10,132,255,0.28) 0%, transparent 70%)'
                        : 'radial-gradient(circle, rgba(0,113,227,0.18) 0%, transparent 70%)',
                    transition:
                      'transform 0.3s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.22s ease',
                    pointerEvents: 'none',
                  }}
                />
                <Box
                  sx={{
                    position: 'relative',
                    zIndex: 1,
                    display: 'grid',
                    placeItems: 'center',
                    transition: 'transform 0.24s cubic-bezier(0.22, 1, 0.36, 1)',
                    transform: isActive ? 'translateY(-1px) scale(1.08)' : 'scale(1)',
                    '& .MuiBadge-badge': {
                      fontSize: '0.56rem',
                      minWidth: 14,
                      height: 14,
                      fontWeight: 700,
                    },
                  }}
                >
                  {tab.icon}
                </Box>
                <Typography
                  variant="caption"
                  sx={{
                    position: 'relative',
                    zIndex: 1,
                    fontSize: '0.58rem',
                    fontWeight: isActive ? 700 : 500,
                    letterSpacing: '-0.02em',
                    color: 'inherit',
                    lineHeight: 1.1,
                    maxWidth: '100%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {tab.label}
                </Typography>
              </Box>
            );
          })}
        </Box>
      </ProgressiveBlurChrome>
    </Box>
  );
}
