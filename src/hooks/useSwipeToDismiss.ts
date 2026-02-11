'use client';

import { useRef, useCallback, useEffect } from 'react';

interface SwipeToDismissOptions {
  /** Minimum distance in px to trigger dismiss (default: 80) */
  threshold?: number;
  /** Called when user swipes past threshold */
  onDismiss: () => void;
  /** Direction of swipe to dismiss: 'down' or 'up' (default: 'down') */
  direction?: 'down' | 'up';
  /** Whether the hook is enabled (default: true) */
  enabled?: boolean;
}

/**
 * Hook to enable swipe-to-dismiss gesture on bottom drawers and popups.
 * Attach the returned handlers to the drag handle or header area.
 * 
 * Usage:
 *   const { handleTouchStart, handleTouchMove, handleTouchEnd, dragOffset, isDragging } = useSwipeToDismiss({ onDismiss });
 *   <Box onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
 *        sx={{ transform: `translateY(${dragOffset}px)`, transition: isDragging ? 'none' : 'transform 0.3s ease' }}>
 */
export function useSwipeToDismiss({
  threshold = 80,
  onDismiss,
  direction = 'down',
  enabled = true,
}: SwipeToDismissOptions) {
  const startY = useRef(0);
  const currentOffset = useRef(0);
  const isDraggingRef = useRef(false);
  const dragCallbackRef = useRef<((offset: number, dragging: boolean) => void) | null>(null);

  // Store latest onDismiss in ref to avoid stale closures
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!enabled) return;
    startY.current = e.touches[0].clientY;
    isDraggingRef.current = true;
    currentOffset.current = 0;
  }, [enabled]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!enabled || !isDraggingRef.current) return;
    const deltaY = e.touches[0].clientY - startY.current;
    
    // Only allow dragging in the dismiss direction
    if (direction === 'down' && deltaY < 0) {
      currentOffset.current = 0;
      dragCallbackRef.current?.(0, true);
      return;
    }
    if (direction === 'up' && deltaY > 0) {
      currentOffset.current = 0;
      dragCallbackRef.current?.(0, true);
      return;
    }

    // Apply rubber-band effect (diminishing returns past threshold)
    const absDelta = Math.abs(deltaY);
    const dampened = absDelta > threshold
      ? threshold + (absDelta - threshold) * 0.3
      : absDelta;
    
    currentOffset.current = direction === 'down' ? dampened : -dampened;
    dragCallbackRef.current?.(currentOffset.current, true);
  }, [enabled, direction, threshold]);

  const handleTouchEnd = useCallback(() => {
    if (!enabled || !isDraggingRef.current) return;
    isDraggingRef.current = false;
    
    const absOffset = Math.abs(currentOffset.current);
    if (absOffset >= threshold) {
      // Animate out then dismiss
      dragCallbackRef.current?.(direction === 'down' ? window.innerHeight : -window.innerHeight, false);
      setTimeout(() => {
        onDismissRef.current();
        dragCallbackRef.current?.(0, false);
      }, 250);
    } else {
      // Snap back
      currentOffset.current = 0;
      dragCallbackRef.current?.(0, false);
    }
  }, [enabled, threshold, direction]);

  /**
   * Register a callback that receives (offset, isDragging) on every drag update.
   * Use this to set state for rendering:
   *   setDragState({ offset, dragging })
   */
  const registerDragCallback = useCallback((cb: (offset: number, dragging: boolean) => void) => {
    dragCallbackRef.current = cb;
  }, []);

  return {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    registerDragCallback,
  };
}
