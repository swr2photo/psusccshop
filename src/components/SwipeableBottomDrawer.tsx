'use client';

import React, { useCallback, useRef, useState } from 'react';
import { Drawer, Box, DrawerProps } from '@mui/material';

interface SwipeableBottomDrawerProps extends Omit<DrawerProps, 'anchor'> {
  /** Called when user swipes down past threshold to dismiss */
  onClose: () => void;
  /** Minimum swipe distance to trigger dismiss (default: 80px) */
  swipeThreshold?: number;
  /** Height of the drawer (applied to PaperProps) */
  height?: string | object;
  /** Max height of the drawer */
  maxHeight?: string | object;
  /** Additional PaperProps sx */
  paperSx?: object;
  children: React.ReactNode;
}

/**
 * Bottom Drawer with swipe-down-to-dismiss gesture.
 * Wraps MUI Drawer and adds touch gesture handling on the drag handle area.
 * The entire drawer content slides down when swiping.
 */
export default function SwipeableBottomDrawer({
  open,
  onClose,
  swipeThreshold = 80,
  height = { xs: '90vh', sm: '80vh' },
  maxHeight = '92vh',
  paperSx = {},
  children,
  ...drawerProps
}: SwipeableBottomDrawerProps) {
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);
  const currentY = useRef(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
    currentY.current = e.touches[0].clientY;
    setIsDragging(true);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    
    const deltaY = e.touches[0].clientY - startY.current;
    
    // Only allow downward drag
    if (deltaY < 0) {
      setDragOffset(0);
      return;
    }

    // Rubber-band effect
    const dampened = deltaY > swipeThreshold
      ? swipeThreshold + (deltaY - swipeThreshold) * 0.3
      : deltaY;

    currentY.current = e.touches[0].clientY;
    setDragOffset(dampened);
  }, [isDragging, swipeThreshold]);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    
    if (dragOffset >= swipeThreshold) {
      // Animate out then close
      setDragOffset(window.innerHeight);
      setTimeout(() => {
        onClose();
        setDragOffset(0);
      }, 200);
    } else {
      // Snap back
      setDragOffset(0);
    }
  }, [isDragging, dragOffset, swipeThreshold, onClose]);

  // Reset drag when drawer closes
  React.useEffect(() => {
    if (!open) {
      setDragOffset(0);
      setIsDragging(false);
    }
  }, [open]);

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      {...drawerProps}
      PaperProps={{
        ...drawerProps.PaperProps,
        sx: {
          height,
          maxHeight,
          borderTopLeftRadius: { xs: 20, sm: 24 },
          borderTopRightRadius: { xs: 20, sm: 24 },
          bgcolor: 'var(--background)',
          color: 'var(--foreground)',
          overflow: 'hidden',
          ...(dragOffset > 0 && { transform: `translateY(${dragOffset}px)` }),
          ...(isDragging ? { transition: 'none' } : { transition: 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)' }),
          ...paperSx,
        } as any,
      }}
      slotProps={{
        backdrop: {
          sx: {
            opacity: dragOffset > 0 ? Math.max(0, 1 - dragOffset / 300) : 1,
            transition: isDragging ? 'none' : 'opacity 0.3s ease',
          },
        },
      }}
    >
      {/* Swipe Handle Area */}
      <Box
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        sx={{
          width: '100%',
          pt: 1,
          pb: 0.5,
          cursor: 'grab',
          touchAction: 'none',
          display: 'flex',
          justifyContent: 'center',
          position: 'relative',
          zIndex: 11,
          '&:active': { cursor: 'grabbing' },
        }}
      >
        <Box
          sx={{
            width: 36,
            height: 4,
            bgcolor: isDragging ? 'var(--text-muted)' : 'var(--glass-bg)',
            borderRadius: 2,
            transition: 'background-color 0.2s ease, width 0.2s ease',
            ...(isDragging && { width: 48 }),
          }}
        />
      </Box>
      {children}
    </Drawer>
  );
}
