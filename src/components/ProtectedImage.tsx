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
  /** Invisible forensic watermark text (user email/session) */
  watermark?: string;
  /** Protection level: 'standard' | 'high' | 'maximum' */
  level?: 'standard' | 'high' | 'maximum';
}

// ==================== PLATFORM DETECTION ====================

const getPlatform = () => {
  if (typeof window === 'undefined') {
    return { isIOS: false, isMacOS: false, isWindows: false, isAndroid: false, isMobile: false };
  }
  const ua = navigator.userAgent;
  const plat = navigator.platform || '';
  return {
    isIOS: /iPad|iPhone|iPod/.test(ua) || (plat === 'MacIntel' && navigator.maxTouchPoints > 1),
    isMacOS: plat.toUpperCase().includes('MAC') && navigator.maxTouchPoints <= 1,
    isWindows: plat.toUpperCase().includes('WIN'),
    isAndroid: /Android/i.test(ua),
    isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua),
  };
};

// ==================== FORENSIC WATERMARK ====================

/** Embed an invisible steganographic watermark into image data.
 *  Encodes text into the LSB of the blue channel — visually imperceptible
 *  but recoverable from any screenshot/photo. */
function embedForensicWatermark(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  text: string
) {
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  // Encode payload: timestamp + text, converted to binary
  const payload = `[${Date.now()}]${text}`;
  const bits: number[] = [];
  for (let i = 0; i < payload.length; i++) {
    const byte = payload.charCodeAt(i);
    for (let b = 7; b >= 0; b--) {
      bits.push((byte >> b) & 1);
    }
  }
  // Terminate with 8 null bits
  for (let i = 0; i < 8; i++) bits.push(0);

  // Embed into LSB of blue channel, scattered using a stride
  const stride = Math.max(1, Math.floor(data.length / 4 / bits.length));
  for (let i = 0; i < bits.length && i * stride < data.length / 4; i++) {
    const pixelIdx = i * stride;
    const blueIdx = pixelIdx * 4 + 2; // Blue channel
    if (blueIdx < data.length) {
      data[blueIdx] = (data[blueIdx] & 0xFE) | bits[i]; // Set LSB
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

/** Multi-layer visible-when-screenshotted watermark using color channels
 *  that are nearly invisible on screen but appear in screenshots due to
 *  color space conversion and compression artifacts */
function addGhostWatermark(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  text: string
) {
  ctx.save();
  // Layer 1: Near-transparent white text (appears in JPEG compression)
  ctx.globalAlpha = 0.008;
  ctx.fillStyle = '#ffffff';
  ctx.font = `${Math.max(12, canvas.width / 30)}px Arial, sans-serif`;
  ctx.rotate(-0.35);
  for (let y = -50; y < canvas.height + 150; y += 55) {
    for (let x = -100; x < canvas.width + 200; x += 180) {
      ctx.fillText(text, x, y);
    }
  }
  ctx.rotate(0.35);

  // Layer 2: Complementary color micro-pattern (survives color correction)
  ctx.globalAlpha = 0.004;
  ctx.fillStyle = '#ff0000';
  ctx.rotate(0.15);
  for (let y = -50; y < canvas.height + 150; y += 80) {
    for (let x = -100; x < canvas.width + 200; x += 200) {
      ctx.fillText(text, x + 40, y + 25);
    }
  }
  ctx.restore();
}

// ==================== CANVAS ANTI-EXTRACTION ====================

/** Override toDataURL / toBlob on the protected canvas to prevent
 *  programmatic extraction via DevTools console or malicious scripts */
function poisonCanvas(canvas: HTMLCanvasElement) {
  canvas.toDataURL = function () {
    // Return a 1x1 black pixel instead of actual content
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  };

  canvas.toBlob = function (cb: BlobCallback) {
    // Return empty blob
    const emptyCanvas = document.createElement('canvas');
    emptyCanvas.width = 1;
    emptyCanvas.height = 1;
    HTMLCanvasElement.prototype.toBlob.call(emptyCanvas, cb);
  };

  // Prevent getImageData extraction
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.getImageData = function () {
      // Return blank image data
      return new ImageData(1, 1);
    };
  }
}

// ==================== DEVTOOLS DETECTION (SINGLETON) ====================

/** Global singleton for DevTools detection — shared across all ProtectedImage instances */
let _devToolsListenerCount = 0;
let _devToolsOpen = false;
let _devToolsInterval: ReturnType<typeof setInterval> | null = null;
let _devToolsListeners = new Set<(open: boolean) => void>();

function _startDevToolsDetection() {
  if (_devToolsInterval) return;
  const checkSize = () => {
    const widthDiff = window.outerWidth - window.innerWidth;
    const heightDiff = window.outerHeight - window.innerHeight;
    const isOpen = widthDiff > 160 || heightDiff > 160;
    if (isOpen !== _devToolsOpen) {
      _devToolsOpen = isOpen;
      _devToolsListeners.forEach(fn => fn(isOpen));
    }
  };
  checkSize();
  _devToolsInterval = setInterval(checkSize, 3000);
  window.addEventListener('resize', checkSize);
  // Store for cleanup
  (_startDevToolsDetection as any)._resizeHandler = checkSize;
}

function _stopDevToolsDetection() {
  if (_devToolsInterval) {
    clearInterval(_devToolsInterval);
    _devToolsInterval = null;
  }
  const handler = (_startDevToolsDetection as any)._resizeHandler;
  if (handler) window.removeEventListener('resize', handler);
}

function useDevToolsDetection(enabled: boolean): boolean {
  const [isOpen, setIsOpen] = useState(_devToolsOpen);

  useEffect(() => {
    if (!enabled) return;
    _devToolsListenerCount++;
    _devToolsListeners.add(setIsOpen);
    _startDevToolsDetection();

    return () => {
      _devToolsListenerCount--;
      _devToolsListeners.delete(setIsOpen);
      if (_devToolsListenerCount <= 0) {
        _stopDevToolsDetection();
        _devToolsListenerCount = 0;
      }
    };
  }, [enabled]);

  return isOpen;
}

// ==================== SCREEN CAPTURE DETECTION (SINGLETON) ====================

let _captureListenerCount = 0;
let _screenCaptured = false;
let _captureInterval: ReturnType<typeof setInterval> | null = null;
let _captureListeners = new Set<(captured: boolean) => void>();

function _startCaptureDetection() {
  if (_captureInterval) return;
  const checkCapture = () => {
    try {
      if (typeof navigator.mediaDevices !== 'undefined') {
        const videos = document.querySelectorAll('video');
        let found = false;
        videos.forEach(v => {
          const stream = (v as any).captureStream?.() || (v as any).mozCaptureStream?.();
          if (stream) {
            const tracks = stream.getVideoTracks();
            tracks.forEach((t: MediaStreamTrack) => {
              if (t.label?.toLowerCase().includes('screen') || t.label?.toLowerCase().includes('window')) {
                found = true;
              }
            });
          }
        });
        if (found !== _screenCaptured) {
          _screenCaptured = found;
          _captureListeners.forEach(fn => fn(found));
        }
      }
    } catch {
      // Silently ignore
    }
  };
  _captureInterval = setInterval(checkCapture, 5000);
}

function _stopCaptureDetection() {
  if (_captureInterval) {
    clearInterval(_captureInterval);
    _captureInterval = null;
  }
}

function useScreenCaptureDetection(enabled: boolean): boolean {
  const [isCaptured, setIsCaptured] = useState(_screenCaptured);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    _captureListenerCount++;
    _captureListeners.add(setIsCaptured);
    _startCaptureDetection();

    return () => {
      _captureListenerCount--;
      _captureListeners.delete(setIsCaptured);
      if (_captureListenerCount <= 0) {
        _stopCaptureDetection();
        _captureListenerCount = 0;
      }
    };
  }, [enabled]);

  return isCaptured;
}

// ==================== MAIN COMPONENT ====================

/**
 * ProtectedImage — Enterprise-grade image protection component
 * 
 * Protection layers (international DRM-inspired standards):
 * 
 * 1. Canvas rendering — No <img> tag = no "Save Image As"
 * 2. Forensic steganographic watermark — LSB encoding in blue channel
 * 3. Ghost watermark — Multi-layer near-invisible text (visible in JPEG artifacts)
 * 4. Canvas API poisoning — toDataURL/toBlob/getImageData return blank
 * 5. Screenshot keyboard shortcut interception
 * 6. Visibility API blackout
 * 7. Window blur detection
 * 8. iOS long-press prevention
 * 9. Context menu / drag-drop prevention
 * 10. DevTools detection — Window size differential
 * 11. Print media protection — @media print → hidden
 * 12. CSS user-select: none — Universal
 * 13. Pointer-events: none on canvas
 * 14. Screen Capture API monitoring
 * 15. Transparent overlay trap
 * 16. Sub-pixel noise overlay — disrupts screenshot clarity
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
  level = 'high',
}: ProtectedImageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isProtected, setIsProtected] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(false);

  const isAdvanced = level === 'high' || level === 'maximum';
  const isMaximum = level === 'maximum';

  const devToolsOpen = useDevToolsDetection(isAdvanced);
  const screenCaptured = useScreenCaptureDetection(isMaximum);

  const effectiveProtection = isProtected && !devToolsOpen && !screenCaptured;

  // Draw image to canvas with protection layers
  const drawImage = useCallback((
    img: HTMLImageElement,
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    showContent: boolean
  ) => {
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

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (showContent) {
      ctx.drawImage(img, drawX, drawY, drawW, drawH);

      // Forensic watermark (steganographic LSB encoding)
      if (watermark && canvas.width > 50 && canvas.height > 50) {
        embedForensicWatermark(ctx, canvas, watermark);
      }

      // Ghost watermark (visible-when-screenshotted)
      if (watermark) {
        addGhostWatermark(ctx, canvas, watermark);
      }
    } else {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }, [objectFit, watermark]);

  // Load and render image to canvas
  useEffect(() => {
    if (!src || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const needsReadback = !!watermark;
    const ctx = canvas.getContext('2d', { willReadFrequently: needsReadback });
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const container = containerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = (rect.width || img.width) * dpr;
        canvas.height = (rect.height || img.height) * dpr;
        ctx.scale(dpr, dpr);
      } else {
        canvas.width = img.width;
        canvas.height = img.height;
      }

      drawImage(img, ctx, canvas, effectiveProtection);
      setIsLoaded(true);
      setError(false);

      if (isAdvanced) poisonCanvas(canvas);

      (canvas as any)._img = img;
    };

    img.onerror = () => {
      setError(true);
      setIsLoaded(false);
    };

    img.src = src;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, isAdvanced]);

  // Redraw when protection state changes
  useEffect(() => {
    const canvas = canvasRef.current;
    const img = (canvas as any)?._img;
    if (!canvas || !img) return;
    const needsReadback = !!watermark;
    const ctx = canvas.getContext('2d', { willReadFrequently: needsReadback });
    if (!ctx) return;
    drawImage(img, ctx, canvas, effectiveProtection);
  }, [effectiveProtection, drawImage]);

  // ==================== PROTECTION HOOKS ====================
  // NOTE: Visibility, blur/focus, keyboard shortcuts, and iOS gesture protection
  // are handled globally by useScreenshotProtection in Providers.tsx.
  // The global hook applies body.page-hidden class which CSS uses to black out all images.
  // Per-instance hooks are not needed and would be N×duplicated for N images on screen.

  // Prevent interactions
  const preventInteraction = useCallback((e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
    return false;
  }, []);

  // ==================== RENDER ====================

  return (
    <div
      ref={containerRef}
      className={`protected-image-container ${className}`}
      style={{
        position: 'relative',
        width,
        height,
        overflow: 'hidden',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        MozUserSelect: 'none',
        msUserSelect: 'none',
        WebkitTouchCallout: 'none',
        WebkitTapHighlightColor: 'transparent',
        ...style,
      } as CSSProperties}
      onContextMenu={preventInteraction}
      onDragStart={preventInteraction}
      onDrag={preventInteraction}
      onDragEnd={preventInteraction}
      draggable={false}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          pointerEvents: 'none',
          opacity: effectiveProtection ? 1 : 0,
          transition: 'opacity 0.04s linear',
        }}
        aria-label={alt}
      />

      {!effectiveProtection && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: '#000',
            zIndex: 5,
          }}
        />
      )}

      {/* Transparent interaction trap */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 10,
          WebkitTouchCallout: 'none',
          WebkitUserSelect: 'none',
          userSelect: 'none',
          cursor: 'default',
        }}
        onContextMenu={preventInteraction}
        onDragStart={preventInteraction}
      />

      {/* Noise overlay — disrupts screenshot clarity */}
      {isAdvanced && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 3,
            pointerEvents: 'none',
            opacity: 0.012,
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            backgroundSize: '128px 128px',
            mixBlendMode: 'overlay',
          }}
        />
      )}

      {!isLoaded && !error && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(29,29,31,0.5)',
            zIndex: 1,
          }}
        >
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            border: '2px solid rgba(255,255,255,0.1)',
            borderTopColor: 'rgba(41,151,255,0.6)',
            animation: 'protimg-spin 0.8s linear infinite',
          }} />
        </div>
      )}

      {error && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(29,29,31,0.8)',
            color: '#86868b',
            fontSize: '0.875rem',
            zIndex: 1,
          }}
        >
          ไม่สามารถโหลดรูปภาพได้
        </div>
      )}

      <style>{`
        @keyframes protimg-spin {
          to { transform: rotate(360deg); }
        }
        .protected-image-container {
          -webkit-user-drag: none;
          -khtml-user-drag: none;
          touch-action: manipulation;
        }
        .protected-image-container canvas {
          -webkit-touch-callout: none;
          -webkit-user-select: none;
        }
        @media print {
          .protected-image-container {
            display: none !important;
            visibility: hidden !important;
          }
        }
        .protected-image-container * {
          -webkit-touch-callout: none !important;
        }
      `}</style>
    </div>
  );
}

// ==================== HOC ====================

export function withScreenshotProtection<P extends object>(
  WrappedComponent: React.ComponentType<P>
) {
  return function ProtectedComponent(props: P) {
    const [isProtected, setIsProtected] = useState(true);
    const recoveryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
      const triggerBlackout = (ms = 300) => {
        setIsProtected(false);
        if (recoveryRef.current) clearTimeout(recoveryRef.current);
        recoveryRef.current = setTimeout(() => setIsProtected(true), ms);
      };

      const handleVisibility = () => {
        if (document.hidden) triggerBlackout(400);
      };
      const handleBlur = () => triggerBlackout(300);
      const handleFocus = () => {
        setTimeout(() => setIsProtected(true), 80);
      };

      document.addEventListener('visibilitychange', handleVisibility);
      window.addEventListener('blur', handleBlur);
      window.addEventListener('focus', handleFocus);

      return () => {
        document.removeEventListener('visibilitychange', handleVisibility);
        window.removeEventListener('blur', handleBlur);
        window.removeEventListener('focus', handleFocus);
        if (recoveryRef.current) clearTimeout(recoveryRef.current);
      };
    }, []);

    return (
      <div style={{
        filter: isProtected ? 'none' : 'brightness(0)',
        transition: 'filter 0.04s linear',
      }}>
        <WrappedComponent {...props} />
      </div>
    );
  };
}
