'use client';

import React from 'react';
import { IconButton, Tooltip, Menu, MenuItem, ListItemIcon, ListItemText } from '@mui/material';
import { useThemeStore, type ThemeMode } from '@/store/themeStore';

// SVG icons (no import needed)
const SunIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

const MoonIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const SystemIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

interface ThemeToggleProps {
  /** Show icon only (for header bars) or with label */
  compact?: boolean;
  /** Custom size */
  size?: 'small' | 'medium';
}

/**
 * Theme toggle button - switches between light, dark, and system modes
 */
export default function ThemeToggle({ compact = true, size = 'medium' }: ThemeToggleProps) {
  const { mode, resolvedMode, setMode } = useThemeStore();
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  const handleClick = (e: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(e.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSelect = (newMode: ThemeMode) => {
    setMode(newMode);
    handleClose();
  };

  const CurrentIcon = resolvedMode === 'dark' ? MoonIcon : SunIcon;
  const label = mode === 'system' ? 'ตามระบบ' : resolvedMode === 'dark' ? 'ธีมมืด' : 'ธีมสว่าง';

  return (
    <>
      <Tooltip title={label} arrow>
        <IconButton
          onClick={handleClick}
          size={size}
          aria-label="เปลี่ยนธีม"
          sx={{
            color: 'inherit',
            transition: 'all 0.2s ease',
            '&:hover': {
              transform: 'rotate(15deg) scale(1.1)',
            },
          }}
        >
          <CurrentIcon />
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        slotProps={{
          paper: {
            sx: {
              mt: 1,
              minWidth: 160,
              borderRadius: '14px',
              overflow: 'hidden',
            },
          },
        }}
      >
        <MenuItem
          onClick={() => handleSelect('light')}
          selected={mode === 'light'}
          sx={{ borderRadius: '8px', mx: 0.5 }}
        >
          <ListItemIcon sx={{ color: 'inherit', minWidth: 36 }}>
            <SunIcon />
          </ListItemIcon>
          <ListItemText>สว่าง</ListItemText>
        </MenuItem>

        <MenuItem
          onClick={() => handleSelect('dark')}
          selected={mode === 'dark'}
          sx={{ borderRadius: '8px', mx: 0.5 }}
        >
          <ListItemIcon sx={{ color: 'inherit', minWidth: 36 }}>
            <MoonIcon />
          </ListItemIcon>
          <ListItemText>มืด</ListItemText>
        </MenuItem>

        <MenuItem
          onClick={() => handleSelect('system')}
          selected={mode === 'system'}
          sx={{ borderRadius: '8px', mx: 0.5 }}
        >
          <ListItemIcon sx={{ color: 'inherit', minWidth: 36 }}>
            <SystemIcon />
          </ListItemIcon>
          <ListItemText>ตามระบบ</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}
