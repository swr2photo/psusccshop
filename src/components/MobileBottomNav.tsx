'use client';

import type { ReactNode } from 'react';
import { Box, Typography } from '@mui/material';

import { useRouter } from 'next/navigation';
import { Home, ShoppingBag, ShoppingCart, Clock } from 'lucide-react';

export type MobileBottomTab = {
  key: string;
  label: string;
  icon: ReactNode;
  /** @deprecated PCD-style bar uses equal tabs — center FAB unused */
  center?: boolean;
};

type MobileBottomNavProps = {
  tabs?: MobileBottomTab[];
  activeKey?: string;
  chatActive?: boolean;
  hidden?: boolean;
  onTabClick?: (key: string) => void;
  /** Kept for API compat; center chat FAB removed in PCD layout */
  onChatClick?: (anchor: HTMLElement) => void;
};

/**
 * Mobile bottom bar — Pop Culture Depot style:
 * solid surface, equal icon+label tabs, thin top rule.
 */
export default function MobileBottomNav({
  tabs,
  activeKey = 'home',
  chatActive = false,
  hidden = false,
  onTabClick,
}: MobileBottomNavProps) {
  const router = useRouter();

  const defaultTabs: MobileBottomTab[] = [
    { key: 'home', label: 'หน้าแรก', icon: <Home size={20} /> },
    { key: 'shop', label: 'ร้านค้า', icon: <ShoppingBag size={20} /> },
    { key: 'cart', label: 'ตะกร้า', icon: <ShoppingCart size={20} /> },
    { key: 'history', label: 'คำสั่งซื้อ', icon: <Clock size={20} /> },
  ];

  const activeTabsList = tabs || defaultTabs;
  const visibleTabs = activeTabsList.filter((t) => !t.center);

  const handleTabClick = (key: string) => {
    if (onTabClick) {
      onTabClick(key);
    } else {
      if (key === 'home') router.push('/');
      else if (key === 'shop') router.push('/shop');
      else if (key === 'cart') router.push('/cart');
      else if (key === 'history') router.push('/orders');
    }
  };

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
        transform: hidden ? 'translateY(110%)' : 'translateY(0)',
        opacity: hidden ? 0 : 1,
        transition: 'transform 0.35s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.25s ease',
        bgcolor: 'var(--background)',
        borderTop: '1px solid var(--glass-border)',
        pb: 'env(safe-area-inset-bottom)',
        boxShadow: (theme) =>
          theme.palette.mode === 'dark'
            ? '0 -4px 24px rgba(0,0,0,0.35)'
            : '0 -4px 20px rgba(0,0,0,0.06)',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'stretch',
          justifyContent: 'space-between',
          maxWidth: 560,
          mx: 'auto',
          minHeight: 56,
          px: 0.5,
        }}
      >
        {visibleTabs.map((tab) => {
          const isActive =
            tab.key === 'chat'
              ? chatActive
              : tab.key === 'search'
                ? activeKey === 'search'
                : activeKey === tab.key;

          return (
            <Box
              key={tab.key}
              component="button"
              type="button"
              data-tab-key={tab.key}
              aria-label={tab.label}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => handleTabClick(tab.key)}
              sx={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0.35,
                minWidth: 0,
                minHeight: 56,
                px: 0.25,
                py: 0.6,
                border: 'none',
                borderRadius: 0,
                cursor: 'pointer',
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
                userSelect: 'none',
                color: isActive ? 'var(--foreground)' : 'var(--text-muted)',
                background: 'transparent',
                transition: 'color 0.18s ease',
                '&:active': { opacity: 0.7 },
                '& .MuiBadge-badge': {
                  fontSize: '0.56rem',
                  minWidth: 14,
                  height: 14,
                  fontWeight: 700,
                },
              }}
            >
              <Box
                sx={{
                  display: 'grid',
                  placeItems: 'center',
                  height: 24,
                  transform: isActive ? 'scale(1.05)' : 'scale(1)',
                  transition: 'transform 0.2s ease',
                }}
              >
                {tab.icon}
              </Box>
              <Typography
                component="span"
                sx={{
                  fontSize: '0.58rem',
                  fontWeight: isActive ? 700 : 550,
                  letterSpacing: '0.02em',
                  textTransform: 'uppercase',
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
    </Box>
  );
}
