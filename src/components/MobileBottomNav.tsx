'use client';

import type { ReactNode } from 'react';
import { Box, Typography } from '@mui/material';

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
 * Mobile-only bottom dock — glass bar, soft active capsule, raised chat FAB.
 * Visible only below `md` (same breakpoint as previous inline nav).
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
        display: { xs: 'flex', md: 'none' },
        justifyContent: 'center',
        pointerEvents: 'none',
        px: 1.25,
        pb: 'max(0.55rem, env(safe-area-inset-bottom))',
        transform: hidden ? 'translateY(120%)' : 'translateY(0)',
        opacity: hidden ? 0 : 1,
        transition: 'transform 0.34s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.28s ease',
      }}
    >
      <Box
        sx={{
          pointerEvents: 'auto',
          width: '100%',
          maxWidth: 440,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: 0.25,
          px: 0.75,
          pt: 0.65,
          pb: 0.55,
          borderRadius: '22px',
          bgcolor: (theme) =>
            theme.palette.mode === 'dark'
              ? 'rgba(12, 14, 20, 0.82)'
              : 'rgba(255, 255, 255, 0.86)',
          border: (theme) =>
            `1px solid ${
              theme.palette.mode === 'dark'
                ? 'rgba(255,255,255,0.08)'
                : 'rgba(15, 23, 42, 0.08)'
            }`,
          backdropFilter: 'blur(22px) saturate(1.35)',
          WebkitBackdropFilter: 'blur(22px) saturate(1.35)',
          boxShadow: (theme) =>
            theme.palette.mode === 'dark'
              ? '0 10px 36px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)'
              : '0 10px 28px rgba(15, 23, 42, 0.12), inset 0 1px 0 rgba(255,255,255,0.7)',
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
                  gap: 0.25,
                  mt: -2.75,
                  mx: 0.25,
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent',
                  userSelect: 'none',
                  p: 0,
                }}
              >
                <Box
                  sx={{
                    position: 'relative',
                    width: 58,
                    height: 58,
                    borderRadius: '50%',
                    background: 'linear-gradient(145deg, #0a84ff 0%, #0071e3 48%, #5e5ce6 100%)',
                    display: 'grid',
                    placeItems: 'center',
                    color: '#fff',
                    boxShadow:
                      '0 8px 22px rgba(0,113,227,0.42), 0 0 0 3px rgba(0,113,227,0.14)',
                    transition: 'transform 0.18s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.2s ease',
                    animation: isActive ? 'chatFabPulse 2.4s ease-in-out infinite' : 'none',
                    '@keyframes chatFabPulse': {
                      '0%, 100%': {
                        boxShadow:
                          '0 8px 22px rgba(0,113,227,0.42), 0 0 0 3px rgba(0,113,227,0.14)',
                      },
                      '50%': {
                        boxShadow:
                          '0 10px 28px rgba(0,113,227,0.55), 0 0 0 6px rgba(0,113,227,0.08)',
                      },
                    },
                    '&:active': { transform: 'scale(0.93)' },
                  }}
                >
                  {tab.icon}
                </Box>
                <Typography
                  sx={{
                    fontSize: '0.62rem',
                    fontWeight: 700,
                    letterSpacing: '0.01em',
                    color: 'var(--primary)',
                    lineHeight: 1.15,
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
                gap: 0.3,
                minWidth: 0,
                minHeight: 52,
                px: 0.5,
                py: 0.55,
                border: 'none',
                borderRadius: '16px',
                cursor: 'pointer',
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
                userSelect: 'none',
                position: 'relative',
                color: (theme) =>
                  isActive ? 'var(--primary)' : theme.palette.text.secondary,
                background: 'transparent',
                transition: 'color 0.2s ease',
                '&:active': {
                  transform: 'scale(0.96)',
                },
              }}
            >
              <Box
                aria-hidden
                sx={{
                  position: 'absolute',
                  inset: '4px 6px',
                  borderRadius: '14px',
                  bgcolor: (theme) =>
                    isActive
                      ? theme.palette.mode === 'dark'
                        ? 'rgba(10,132,255,0.16)'
                        : 'rgba(0,113,227,0.1)'
                      : 'transparent',
                  transform: isActive ? 'scale(1)' : 'scale(0.86)',
                  opacity: isActive ? 1 : 0,
                  transition:
                    'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.22s ease, background-color 0.22s ease',
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
                    fontSize: '0.58rem',
                    minWidth: 15,
                    height: 15,
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
                  fontSize: '0.61rem',
                  fontWeight: isActive ? 700 : 500,
                  letterSpacing: isActive ? '0.01em' : 0,
                  color: 'inherit',
                  lineHeight: 1.15,
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
    </Box>
  );
}
