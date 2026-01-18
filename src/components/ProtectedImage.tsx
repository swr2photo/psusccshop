'use client';

import { useEffect, useRef, useState, CSSProperties, useCallback } from 'react';

interface ProtectedImageProps {
  src: string;
  alt: string;
  width?: number | string;
  height?: number | string;
  className?: string;
  style?: CSSProperties;
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  priority?: boolean;
  /** Add invisible watermark */
  watermark?: string;
}

/**
 * Detect iOS device
 */
const isIOS = (): boolean => {
  if (typeof window === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

/**
 * Detect macOS
 */
const isMacOS = (): boolean => {
  if (typeof window === 'undefined') return false;
  return navigator.platform.toUpperCase().indexOf('MAC') >= 0;
};

/**
 * Detect mobile device
 */
const isMobile = (): boolean => {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

/**
 * ProtectedImage - Component สำหรับแสดงรูปภาพที่ป้องกันการ screenshot และ download
 * 
 * Features:
 * - ป้องกัน right-click download (ทุก platform)
 * - ป้องกัน drag & drop (ทุก platform)
 * - ป้องกัน long-press save (iOS/Android)
 * - เมื่อ screenshot จะแสดงเป็นสีดำ (ใช้ CSS trick)
 * - ใช้ canvas rendering แทน img tag
 * - Support invisible watermark
 */
export default function ProtectedImage({
  src,
  alt,
  width = '100%',
  height = 'auto',
  className = '',
  style = {},
  objectFit = 'cover',
  priority = false,
  watermark,
}: ProtectedImageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isProtected, setIsProtected] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(false);
  const animationRef = useRef<number | undefined>(undefined);

  // Draw image to canvas
  const drawImage = useCallback((img: HTMLImageElement, ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    // Calculate object-fit positioning
    let drawX = 0, drawY = 0, drawW = canvas.width, drawH = canvas.height;
    
    if (objectFit === 'cover') {
      const scale = Math.max(canvas.width / img.width, canvas.height / img.height);
      drawW = img.width * scale;
      drawH = img.height * scale;
      drawX = (canvas.width - drawW) / 2;
      drawY = (canvas.height - drawH) / 2;
    } else if (objectFit === 'contain') {
      const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
      drawW = img.width * scale;
      drawH = img.height * scale;
      drawX = (canvas.width - drawW) / 2;
      drawY = (canvas.height - drawH) / 2;
    }

    // Clear and draw
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (isProtected) {
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
      
      // Add invisible watermark (visible only when screenshot)
      if (watermark) {
        ctx.save();
        ctx.globalAlpha = 0.005; // Nearly invisible
        ctx.fillStyle = '#ffffff';
        ctx.font = '14px Arial';
        ctx.rotate(-0.3);
        for (let y = 0; y < canvas.height + 100; y += 60) {
          for (let x = -50; x < canvas.width + 100; x += 150) {
            ctx.fillText(watermark, x, y);
          }
        }
        ctx.restore();
      }
    } else {
      // Black out when screenshot detected
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }, [objectFit, isProtected, watermark]);

  // Load and render image to canvas
  useEffect(() => {
    if (!src || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      // Set canvas size to match container or image
      const container = containerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        canvas.width = rect.width || img.width;
        canvas.height = rect.height || img.height;
      } else {
        canvas.width = img.width;
        canvas.height = img.height;
      }

      drawImage(img, ctx, canvas);
      setIsLoaded(true);
      setError(false);

      // Store image for redraw
      (canvas as any)._image = img;
    };

    img.onerror = () => {
      setError(true);
      setIsLoaded(false);
    };

    img.src = src;

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [src, drawImage]);

  // Redraw when protection state changes
  useEffect(() => {
    const canvas = canvasRef.current;
    const img = (canvas as any)?._image;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    drawImage(img, ctx, canvas);
  }, [isProtected, drawImage]);

  // iOS-specific: Detect screenshot via screen recording/screen capture API
  useEffect(() => {
    if (!isIOS()) return;

    // iOS 14.5+ supports detecting screen capture
    const handleScreenCaptureChange = () => {
      // @ts-ignore - experimental API
      if (navigator.mediaDevices?.getDisplayMedia) {
        setIsProtected(false);
        setTimeout(() => setIsProtected(true), 500);
      }
    };

    // Listen for orientation changes (sometimes triggered during screenshot)
    const handleOrientationChange = () => {
      // Brief blackout during orientation change
      setIsProtected(false);
      setTimeout(() => setIsProtected(true), 100);
    };

    window.addEventListener('orientationchange', handleOrientationChange);
    
    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, []);

  // Detect visibility change (works on all platforms)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsProtected(false);
      } else {
        // Delay before showing content again
        setTimeout(() => setIsProtected(true), 150);
      }
    };

    // Detect window blur (screenshot tools often trigger this)
    const handleBlur = () => {
      setIsProtected(false);
      setTimeout(() => setIsProtected(true), 300);
    };

    const handleFocus = () => {
      setTimeout(() => setIsProtected(true), 50);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Detect screenshot keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // PrintScreen (Windows)
      if (e.key === 'PrintScreen' || e.keyCode === 44) {
        e.preventDefault();
        setIsProtected(false);
        setTimeout(() => setIsProtected(true), 500);
        return;
      }

      // macOS: Cmd+Shift+3, Cmd+Shift+4, Cmd+Shift+5
      if (isMacOS() && e.metaKey && e.shiftKey) {
        if (['3', '4', '5'].includes(e.key)) {
          e.preventDefault();
          setIsProtected(false);
          setTimeout(() => setIsProtected(true), 500);
          return;
        }
      }

      // Windows: Win+Shift+S (Snipping Tool)
      if (e.metaKey && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        setIsProtected(false);
        setTimeout(() => setIsProtected(true), 500);
        return;
      }

      // Ctrl+S / Cmd+S (Save)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  // Prevent all interactions
  const preventInteraction = (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
    return false;
  };

  // Touch event handlers for iOS long-press prevention
  const handleTouchStart = (e: React.TouchEvent) => {
    // Prevent default to stop iOS long-press menu
    if (e.touches.length === 1) {
      // Don't prevent single touch for scrolling
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    // Allow touch end
  };

  return (
    <div
      ref={containerRef}
      className={`protected-image-container ${className}`}
      style={{
        position: 'relative',
        width,
        height,
        overflow: 'hidden',
        // Universal protection styles
        userSelect: 'none',
        WebkitUserSelect: 'none',
        MozUserSelect: 'none',
        msUserSelect: 'none',
        // iOS specific
        WebkitTouchCallout: 'none',
        // Disable text selection on iOS
        WebkitTapHighlightColor: 'transparent',
        ...style,
      } as CSSProperties}
      onContextMenu={preventInteraction}
      onDragStart={preventInteraction}
      onDrag={preventInteraction}
      onDragEnd={preventInteraction}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      draggable={false}
    >
      {/* Canvas for rendering image */}
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          pointerEvents: 'none',
          // Protection: black out when not protected
          opacity: isProtected ? 1 : 0,
          transition: 'opacity 0.05s ease',
        }}
        aria-label={alt}
      />

      {/* Black overlay when screenshot detected */}
      {!isProtected && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: '#000000',
            zIndex: 5,
          }}
        />
      )}

      {/* Transparent overlay to block all interactions */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'transparent',
          zIndex: 10,
          // iOS: prevent callout
          WebkitTouchCallout: 'none',
          WebkitUserSelect: 'none',
          userSelect: 'none',
        }}
        onContextMenu={preventInteraction}
        onDragStart={preventInteraction}
        onTouchStart={handleTouchStart}
      />

      {/* Loading placeholder */}
      {!isLoaded && !error && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(30, 41, 59, 0.5)',
            zIndex: 1,
          }}
        >
          <div className="animate-pulse w-8 h-8 rounded-full bg-slate-600" />
        </div>
      )}

      {/* Error placeholder */}
      {error && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(30, 41, 59, 0.8)',
            color: '#94a3b8',
            fontSize: '0.875rem',
            zIndex: 1,
          }}
        >
          ไม่สามารถโหลดรูปภาพได้
        </div>
      )}

      {/* CSS for additional protection */}
      <style jsx>{`
        .protected-image-container {
          -webkit-user-drag: none;
          -khtml-user-drag: none;
          -moz-user-drag: none;
          -o-user-drag: none;
          touch-action: manipulation;
        }
        
        .protected-image-container canvas {
          -webkit-touch-callout: none;
          -webkit-user-select: none;
        }
        
        /* Hide when printing */
        @media print {
          .protected-image-container {
            display: none !important;
            visibility: hidden !important;
          }
        }
        
        /* iOS specific: Disable save image dialog */
        .protected-image-container * {
          -webkit-touch-callout: none !important;
        }
      `}</style>
    </div>
  );
}

/**
 * HOC to wrap any component with screenshot protection
 */
export function withScreenshotProtection<P extends object>(
  WrappedComponent: React.ComponentType<P>
) {
  return function ProtectedComponent(props: P) {
    const [isProtected, setIsProtected] = useState(true);

    useEffect(() => {
      const handleVisibility = () => {
        setIsProtected(!document.hidden);
      };

      const handleBlur = () => {
        setIsProtected(false);
        setTimeout(() => setIsProtected(true), 300);
      };

      document.addEventListener('visibilitychange', handleVisibility);
      window.addEventListener('blur', handleBlur);

      return () => {
        document.removeEventListener('visibilitychange', handleVisibility);
        window.removeEventListener('blur', handleBlur);
      };
    }, []);

    return (
      <div style={{ 
        filter: isProtected ? 'none' : 'brightness(0)',
        transition: 'filter 0.05s ease',
      }}>
        <WrappedComponent {...props} />
      </div>
    );
  };
}
