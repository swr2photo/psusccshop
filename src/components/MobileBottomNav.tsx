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
 * Mobile-only bottom dock — Apple progressive blur fade, soft active capsule, raised chat FAB.
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
        transform: hidden ? 'translateY(120%)' : 'translateY(0)',
        opacity: hidden ? 0 : 1,
        transition: 'transform 0.38s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.28s ease',
      }}
    >
      <ProgressiveBlurChrome
        edge="top"
        fadeExtent={48}
        sx={{
          width: '100%',
          pointerEvents: 'none',
          pt: 2.5,
          pb: 'max(0.35rem, env(safe-area-inset-bottom))',
          px: 1.25,
        }}
        contentSx={{
          pointerEvents: 'auto',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <Box
          sx={{
            width: '100%',
            maxWidth: 440,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            gap: 0.25,
            px: 0.65,
            pt: 0.55,
            pb: 0.45,
            borderRadius: '980px',
            bgcolor: (theme) =>
              theme.palette.mode === 'dark'
                ? 'rgba(22, 22, 24, 0.45)'
                : 'rgba(255, 255, 255, 0.45)',
            border: (theme) =>
              `1px solid ${
                theme.palette.mode === 'dark'
                  ? 'rgba(255,255,255,0.1)'
                  : 'rgba(0, 0, 0, 0.06)'
              }`,
            backdropFilter: 'blur(8px) saturate(1.2)',
            WebkitBackdropFilter: 'blur(8px) saturate(1.2)',
            boxShadow: (theme) =>
              theme.palette.mode === 'dark'
                ? '0 8px 32px rgba(0,0,0,0.4), inset 0 0.5px 0 rgba(255,255,255,0.08)'
                : '0 8px 28px rgba(0,0,0,0.08), inset 0 0.5px 0 rgba(255,255,255,0.85)',
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
                    mt: -2.5,
                    mx: 0.2,
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
                      width: 56,
                      height: 56,
                      borderRadius: '50%',
                      background: 'linear-gradient(160deg, #0a84ff 0%, #0071e3 55%, #5e5ce6 100%)',
                      display: 'grid',
                      placeItems: 'center',
                      color: '#fff',
                      boxShadow:
                        '0 8px 22px rgba(0,113,227,0.38), 0 0 0 3px rgba(0,113,227,0.12)',
                      transition: 'transform 0.18s cubic-bezier(0.22, 1, 0.36, 1)',
                      '&:active': { transform: 'scale(0.93)' },
                    }}
                  >
                    {tab.icon}
                  </Box>
                  <Typography
                    sx={{
                      fontSize: '0.6rem',
                      fontWeight: 700,
                      letterSpacing: '-0.01em',
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
                  gap: 0.25,
                  minWidth: 0,
                  minHeight: 50,
                  px: 0.4,
                  py: 0.45,
                  border: 'none',
                  borderRadius: '980px',
                  cursor: 'pointer',
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent',
                  userSelect: 'none',
                  position: 'relative',
                  color: (theme) =>
                    isActive ? 'var(--primary)' : theme.palette.text.secondary,
                  background: 'transparent',
                  transition: 'color 0.2s ease',
                  '&:active': { transform: 'scale(0.96)' },
                }}
              >
                <Box
                  aria-hidden
                  sx={{
                    position: 'absolute',
                    inset: '3px 5px',
                    borderRadius: '980px',
                    bgcolor: (theme) =>
                      isActive
                        ? theme.palette.mode === 'dark'
                          ? 'rgba(10,132,255,0.18)'
                          : 'rgba(0,113,227,0.1)'
                        : 'transparent',
                    transform: isActive ? 'scale(1)' : 'scale(0.88)',
                    opacity: isActive ? 1 : 0,
                    transition:
                      'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.22s ease',
                  }}
                />
                <Box
                  sx={{
                    position: 'relative',
                    zIndex: 1,
                    display: 'grid',
                    placeItems: 'center',
                    transition: 'transform 0.24s cubic-bezier(0.22, 1, 0.36, 1)',
                    transform: isActive ? 'translateY(-0.5px) scale(1.06)' : 'scale(1)',
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
                    fontSize: '0.6rem',
                    fontWeight: isActive ? 700 : 500,
                    letterSpacing: '-0.01em',
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
      </ProgressiveBlurChrome>
    </Box>
  );
}
