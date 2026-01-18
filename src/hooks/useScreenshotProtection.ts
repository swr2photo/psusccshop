'use client';

import { useEffect, useCallback, useRef, useState } from 'react';

/**
 * Platform detection utilities
 */
const detectPlatform = () => {
  if (typeof window === 'undefined') {
    return { isIOS: false, isMacOS: false, isWindows: false, isAndroid: false, isMobile: false };
  }

  const ua = navigator.userAgent;
  const platform = navigator.platform;

  return {
    isIOS: /iPad|iPhone|iPod/.test(ua) || (platform === 'MacIntel' && navigator.maxTouchPoints > 1),
    isMacOS: platform.toUpperCase().indexOf('MAC') >= 0 && navigator.maxTouchPoints <= 1,
    isWindows: platform.toUpperCase().indexOf('WIN') >= 0,
    isAndroid: /Android/i.test(ua),
    isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua),
  };
};

interface ScreenshotProtectionOptions {
  enabled?: boolean;
  onScreenshotDetected?: () => void;
  onProtectionChange?: (isProtected: boolean) => void;
  recoveryTime?: number;
  aggressive?: boolean;
}

/**
 * useScreenshotProtection - รองรับ iOS, macOS, Windows, Android
 */
export function useScreenshotProtection(options: ScreenshotProtectionOptions = {}) {
  const {
    enabled = true,
    onScreenshotDetected,
    onProtectionChange,
    recoveryTime = 300,
    aggressive = false,
  } = options;

  const [isProtected, setIsProtected] = useState(true);
  const [screenshotCount, setScreenshotCount] = useState(0);
  const platform = useRef(detectPlatform());
  const lastBlurTime = useRef(0);
  const recoveryTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const triggerProtection = useCallback((reason: string) => {
    console.debug('[ScreenshotProtection] Triggered:', reason);
    
    setIsProtected(false);
    setScreenshotCount(prev => prev + 1);
    onScreenshotDetected?.();
    onProtectionChange?.(false);
    document.body.classList.add('page-hidden');

    if (recoveryTimeoutRef.current) {
      clearTimeout(recoveryTimeoutRef.current);
    }

    recoveryTimeoutRef.current = setTimeout(() => {
      setIsProtected(true);
      onProtectionChange?.(true);
      document.body.classList.remove('page-hidden');
    }, recoveryTime);
  }, [onScreenshotDetected, onProtectionChange, recoveryTime]);

  // Visibility change - all platforms
  useEffect(() => {
    if (!enabled) return;
    const handler = () => {
      if (document.hidden) triggerProtection('visibility-hidden');
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [enabled, triggerProtection]);

  // Window blur - all platforms
  useEffect(() => {
    if (!enabled) return;
    const handleBlur = () => {
      const now = Date.now();
      if (now - lastBlurTime.current < 100) return;
      lastBlurTime.current = now;
      triggerProtection('window-blur');
    };
    const handleFocus = () => {
      setTimeout(() => {
        setIsProtected(true);
        onProtectionChange?.(true);
        document.body.classList.remove('page-hidden');
      }, 50);
    };
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, [enabled, triggerProtection, onProtectionChange]);

  // Keyboard shortcuts - macOS, Windows
  useEffect(() => {
    if (!enabled) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const { isMacOS, isWindows } = platform.current;
      
      if (e.key === 'PrintScreen' || e.keyCode === 44) {
        e.preventDefault();
        triggerProtection('printscreen');
        return;
      }
      
      if (isMacOS && e.metaKey && e.shiftKey && ['3', '4', '5'].includes(e.key)) {
        e.preventDefault();
        triggerProtection('macos-screenshot');
        return;
      }
      
      if (isWindows && e.metaKey && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        triggerProtection('windows-snipping');
        return;
      }
      
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        return;
      }
      
      if (aggressive && (e.ctrlKey || e.metaKey) && ['c', 'v', 'x'].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [enabled, aggressive, triggerProtection]);

  // iOS gestures
  useEffect(() => {
    if (!enabled || !platform.current.isIOS) return;
    
    let touchStartTime = 0;
    let lastTouchCount = 0;
    
    const handleTouchStart = (e: TouchEvent) => {
      touchStartTime = Date.now();
      lastTouchCount = e.touches.length;
    };
    
    const handleTouchEnd = () => {
      if (Date.now() - touchStartTime < 50 && lastTouchCount > 2) {
        triggerProtection('ios-gesture');
      }
    };
    
    const handleOrientation = () => triggerProtection('ios-orientation');
    
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('orientationchange', handleOrientation);
    
    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('orientationchange', handleOrientation);
    };
  }, [enabled, triggerProtection]);

  // Context menu and drag - all platforms
  useEffect(() => {
    if (!enabled) return;
    
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'IMG' || target.tagName === 'CANVAS' || 
          target.closest('.protected-image') || target.closest('.protected-image-container')) {
        e.preventDefault();
        return false;
      }
    };
    
    const handleDragStart = (e: DragEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'IMG' || target.tagName === 'CANVAS' ||
          target.closest('.protected-image') || target.closest('.protected-image-container')) {
        e.preventDefault();
        return false;
      }
    };
    
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('dragstart', handleDragStart);
    
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('dragstart', handleDragStart);
    };
  }, [enabled]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (recoveryTimeoutRef.current) clearTimeout(recoveryTimeoutRef.current);
      document.body.classList.remove('page-hidden');
    };
  }, []);

  return { isProtected, screenshotCount, platform: platform.current, triggerProtection };
}

/**
 * Provider component for app-wide screenshot protection
 */
export function ScreenshotProtectionProvider({ 
  children,
  enabled = true,
  aggressive = false,
}: { 
  children: React.ReactNode;
  enabled?: boolean;
  aggressive?: boolean;
}) {
  useScreenshotProtection({ 
    enabled,
    aggressive,
    onScreenshotDetected: () => console.warn('[ScreenshotProtection] Screenshot attempt detected'),
  });

  useEffect(() => {
    if (!enabled) return;
    
    const styleId = 'screenshot-protection-styles';
    let styleEl = document.getElementById(styleId) as HTMLStyleElement;
    
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }

    styleEl.textContent = `
      body { -webkit-touch-callout: none !important; }
      img, canvas, video {
        -webkit-touch-callout: none !important;
        -webkit-user-select: none !important;
        -webkit-user-drag: none !important;
        user-select: none !important;
        pointer-events: none;
      }
      .protected-image-container { pointer-events: auto; }
      body.page-hidden .protected-content,
      body.page-hidden .protected-image-container,
      body.page-hidden img,
      body.page-hidden canvas,
      body.page-hidden video {
        filter: brightness(0) !important;
        opacity: 0 !important;
      }
      @media print {
        body { display: none !important; }
        img, canvas, video { display: none !important; }
      }
      .no-copy, .protected-content {
        -webkit-user-select: none !important;
        user-select: none !important;
      }
    `;
  }, [enabled]);

  return children;
}

export function useDisableRightClick(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = (e: MouseEvent) => { e.preventDefault(); return false; };
    el.addEventListener('contextmenu', handler);
    return () => el.removeEventListener('contextmenu', handler);
  }, [ref]);
}

export function useDisableDrag(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = (e: DragEvent) => { e.preventDefault(); return false; };
    el.addEventListener('dragstart', handler);
    return () => el.removeEventListener('dragstart', handler);
  }, [ref]);
}

export default useScreenshotProtection;
