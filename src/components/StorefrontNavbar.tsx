'use client';

import type { ReactNode } from 'react';
import {
  AppBar,
  Badge,
  Box,
  Button,
  IconButton,
  Toolbar,
  Typography,
} from '@mui/material';
import {
  Heart,
  Menu,
  Search,
  ShoppingBag,
  User,
} from 'lucide-react';
import Image from 'next/image';
import { useTranslation } from '@/hooks/useTranslation';

export type StorefrontNavbarProps = {
  hidden?: boolean;
  activeTab: string;
  pendingOrderCount: number;
  cartCount: number;
  wishlistCount: number;
  searchActive: boolean;
  filterCount: number;
  isLiveActive: boolean;
  isAuthenticated: boolean;
  avatarUrl?: string;
  utilityLeft?: string;
  utilityCenter?: ReactNode;
  searchPanel?: ReactNode;
  languageToggle?: ReactNode;
  themeToggle?: ReactNode;
  onTabChange: (tab: string) => void;
  onSearchToggle: () => void;
  onOpenSidebar: () => void;
  onOpenWishlist: () => void;
  onOpenLive?: () => void;
  onShopClick: () => void;
  onFlagshipClick: () => void;
};

function NavBadge({
  label,
  color,
}: {
  label: string;
  color: string;
}) {
  return (
    <Box
      component="span"
      aria-hidden
      sx={{
        position: 'absolute',
        top: 0,
        right: 0,
        // Sit outside the glyph box (top-right corner), never over the label
        transform: 'translate(55%, -65%)',
        px: 0.5,
        py: 0.08,
        borderRadius: '4px',
        bgcolor: color,
        color: '#fff',
        fontSize: '0.55rem',
        fontWeight: 800,
        letterSpacing: '0.04em',
        lineHeight: 1.25,
        pointerEvents: 'none',
        boxShadow: '0 1px 2px rgba(0,0,0,0.12)',
        whiteSpace: 'nowrap',
        zIndex: 1,
      }}
    >
      {label}
    </Box>
  );
}

/** Tight label wrapper so corner badges position relative to the text, not the Button. */
function NavLabel({
  children,
  badge,
}: {
  children: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <Box
      component="span"
      sx={{
        position: 'relative',
        display: 'inline-block',
        lineHeight: 1.2,
        // Reserve a little room so the badge doesn't collide with the next link
        pr: badge ? 0.85 : 0,
      }}
    >
      {children}
      {badge}
    </Box>
  );
}

function BrandLockup({ compact = false }: { compact?: boolean }) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: compact ? 0.85 : 1.1,
        minWidth: 0,
      }}
    >
      <Box
        sx={{
          width: compact ? 30 : 36,
          height: compact ? 30 : 36,
          position: 'relative',
          borderRadius: '10px',
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        <Image
          src="/logo.png"
          alt="SCC Shop"
          fill
          sizes="40px"
          className="theme-logo"
          style={{ objectFit: 'contain' }}
          priority
        />
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', lineHeight: 1, minWidth: 0 }}>
        <Typography
          component="span"
          sx={{
            fontWeight: 800,
            fontSize: compact ? '0.78rem' : '0.92rem',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--foreground)',
          }}
        >
          SCC
        </Typography>
        <Box
          component="span"
          sx={{
            mt: 0.25,
            alignSelf: 'flex-start',
            px: 0.7,
            py: 0.15,
            borderRadius: '4px',
            bgcolor: 'var(--primary)',
            color: '#fff',
            fontWeight: 800,
            fontSize: compact ? '0.58rem' : '0.65rem',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}
        >
          Shop
        </Box>
      </Box>
    </Box>
  );
}

/**
 * Storefront header inspired by Pop Culture Depot:
 * utility strip + centered uppercase links + icon actions.
 */
export default function StorefrontNavbar({
  hidden = false,
  activeTab,
  pendingOrderCount,
  cartCount,
  wishlistCount,
  searchActive,
  filterCount,
  isLiveActive,
  isAuthenticated,
  avatarUrl,
  utilityLeft,
  utilityCenter,
  searchPanel,
  languageToggle,
  themeToggle,
  onTabChange,
  onSearchToggle,
  onOpenSidebar,
  onOpenWishlist,
  onOpenLive,
  onShopClick,
  onFlagshipClick,
}: StorefrontNavbarProps) {
  const { t } = useTranslation();

  const iconBtnSx = {
    color: 'var(--foreground)',
    width: 40,
    height: 40,
    borderRadius: '10px',
    '&:hover': { bgcolor: 'var(--surface-2)' },
  } as const;

  const desktopLinkSx = (active: boolean) => ({
    position: 'relative' as const,
    color: active ? 'var(--primary)' : 'var(--foreground)',
    bgcolor: 'transparent',
    boxShadow: 'none',
    textTransform: 'uppercase' as const,
    fontWeight: active ? 800 : 650,
    fontSize: '0.72rem',
    letterSpacing: '0.08em',
    borderRadius: 0,
    px: 1.5,
    // Extra top padding so corner badges clear the label + active underline
    pt: 1.45,
    pb: 1.15,
    minHeight: 48,
    overflow: 'visible',
    borderBottom: active ? '2px solid var(--primary)' : '2px solid transparent',
    transition: 'color 0.18s ease, border-color 0.18s ease',
    '&:hover': {
      bgcolor: 'transparent',
      color: 'var(--primary)',
    },
  });

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        bgcolor: 'var(--background)',
        backgroundImage: 'none',
        boxShadow: 'none',
        border: 'none',
        borderBottom: '1px solid var(--glass-border)',
        color: 'var(--foreground)',
        transform: hidden ? 'translateY(-110%)' : 'translateY(0)',
        opacity: hidden ? 0 : 1,
        transition: 'transform 0.38s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.28s ease',
        top: 0,
        zIndex: 1200,
        overflow: 'visible',
        pt: { xs: 'env(safe-area-inset-top)', md: 0 },
      }}
    >
      {/* Utility strip — desktop */}
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          px: { md: 3, lg: 4 },
          py: 0.7,
          bgcolor: 'var(--surface-2)',
          borderBottom: '1px solid var(--glass-border)',
          fontSize: '0.75rem',
        }}
      >
        <Typography
          sx={{
            fontSize: '0.72rem',
            color: 'var(--text-muted)',
            fontWeight: 500,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}
        >
          {utilityLeft || t.nav.shopTitle}
        </Typography>
        <Box
          sx={{
            flex: 1.4,
            textAlign: 'center',
            color: 'var(--foreground)',
            fontWeight: 600,
            fontSize: '0.74rem',
          }}
        >
          {utilityCenter}
        </Box>
        <Box sx={{ flex: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 0.75 }}>
          {languageToggle}
          {themeToggle}
        </Box>
      </Box>

      {/* Mobile header — PCD: menu | logo | search + bag */}
      <Toolbar
        sx={{
          display: { xs: 'flex', md: 'none' },
          minHeight: 56,
          px: 0.75,
          gap: 0.25,
          bgcolor: 'var(--background)',
        }}
      >
        <IconButton
          aria-label={t.nav.menu}
          onClick={onOpenSidebar}
          sx={{ ...iconBtnSx, width: 44, height: 44 }}
        >
          <Menu size={22} strokeWidth={1.75} />
        </IconButton>

        <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', minWidth: 0 }}>
          <Box
            component="button"
            type="button"
            onClick={() => onTabChange('home')}
            sx={{
              border: 'none',
              background: 'none',
              p: 0,
              cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <BrandLockup compact />
          </Box>
        </Box>

        <IconButton
          aria-label={t.nav.search}
          onClick={onSearchToggle}
          sx={{
            ...iconBtnSx,
            width: 44,
            height: 44,
            color: searchActive ? 'var(--primary)' : 'var(--foreground)',
          }}
        >
          <Badge badgeContent={filterCount || undefined} color="warning" invisible={filterCount === 0}>
            <Search size={20} strokeWidth={1.75} />
          </Badge>
        </IconButton>

        <IconButton
          aria-label={t.nav.cart}
          onClick={() => onTabChange('cart')}
          sx={{ ...iconBtnSx, width: 44, height: 44 }}
        >
          <Badge badgeContent={cartCount} color="error" max={99}>
            <ShoppingBag size={20} strokeWidth={1.75} />
          </Badge>
        </IconButton>
      </Toolbar>

      {/* Desktop header */}
      <Toolbar
        sx={{
          display: { xs: 'none', md: 'flex' },
          minHeight: 64,
          px: { md: 2.5, lg: 3.5 },
          gap: 1,
          overflow: 'visible',
        }}
      >
        <Box
          component="button"
          type="button"
          onClick={() => onTabChange('home')}
          sx={{
            border: 'none',
            background: 'none',
            p: 0,
            cursor: 'pointer',
            mr: 1,
          }}
        >
          <BrandLockup />
        </Box>

        <Box
          sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.5,
            minWidth: 0,
            // Prefer visible overflow — overflow-x:auto creates a scrollport that
            // also clips vertical overflow and cuts corner badges into flat bars.
            overflow: 'visible',
            flexWrap: 'nowrap',
          }}
        >
          <Button
            variant="text"
            onClick={() => onTabChange('home')}
            sx={desktopLinkSx(activeTab === 'home')}
          >
            {t.nav.home}
          </Button>

          <Button variant="text" onClick={onShopClick} sx={desktopLinkSx(false)}>
            {t.nav.shop}
          </Button>

          <Button variant="text" onClick={onFlagshipClick} sx={desktopLinkSx(false)}>
            <NavLabel badge={<NavBadge label={t.nav.badgeNew} color="#06b6d4" />}>
              {t.nav.flagship}
            </NavLabel>
          </Button>

          <Button
            variant="text"
            onClick={() => onTabChange('history')}
            sx={desktopLinkSx(activeTab === 'history')}
          >
            <NavLabel
              badge={
                pendingOrderCount > 0 ? (
                  <NavBadge label={String(Math.min(pendingOrderCount, 99))} color="#f59e0b" />
                ) : undefined
              }
            >
              {t.nav.history}
            </NavLabel>
          </Button>

          {isLiveActive && (
            <Button
              variant="text"
              onClick={onOpenLive}
              sx={{ ...desktopLinkSx(false), color: '#ff3b30' }}
            >
              <NavLabel badge={<NavBadge label="LIVE" color="#ff3b30" />}>
                {t.nav.live}
              </NavLabel>
            </Button>
          )}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.35, flexShrink: 0 }}>
          <IconButton
            aria-label={t.nav.search}
            onClick={onSearchToggle}
            sx={{
              ...iconBtnSx,
              color: searchActive ? 'var(--primary)' : 'var(--foreground)',
            }}
          >
            <Badge badgeContent={filterCount || undefined} color="warning" invisible={filterCount === 0}>
              <Search size={20} />
            </Badge>
          </IconButton>

          <IconButton
            aria-label={t.nav.profile}
            onClick={() => (isAuthenticated ? onTabChange('profile') : onOpenSidebar())}
            sx={iconBtnSx}
          >
            {isAuthenticated && avatarUrl ? (
              <Box
                component="img"
                src={avatarUrl}
                alt=""
                sx={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              <User size={20} />
            )}
          </IconButton>

          <IconButton
            aria-label={t.wishlist.title}
            onClick={onOpenWishlist}
            sx={iconBtnSx}
          >
            <Badge badgeContent={wishlistCount} color="error" max={99} invisible={wishlistCount === 0}>
              <Heart size={20} />
            </Badge>
          </IconButton>

          <IconButton
            aria-label={t.nav.cart}
            onClick={() => onTabChange('cart')}
            sx={iconBtnSx}
          >
            <Badge badgeContent={cartCount} color="error" max={99}>
              <ShoppingBag size={20} />
            </Badge>
          </IconButton>

          {isAuthenticated && (
            <IconButton
              aria-label={t.nav.menu}
              onClick={onOpenSidebar}
              sx={{ ...iconBtnSx, ml: 0.25 }}
            >
              <Menu size={20} />
            </IconButton>
          )}
        </Box>
      </Toolbar>

      {searchPanel}
    </AppBar>
  );
}
