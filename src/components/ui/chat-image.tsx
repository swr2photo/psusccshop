/* eslint-disable */
'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type SyntheticEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { X, ImageOff, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isAnimatedImageUrl } from '@/lib/chat-stickers';

type ChatImageProps = {
  src: string;
  alt?: string;
  className?: string;
  /** cover for thumbnails in bubbles; contain for standalone images */
  objectFit?: 'cover' | 'contain';
  /** Clamp display size (px). Defaults suit chat bubbles. */
  maxWidth?: number;
  maxHeight?: number;
  /** Force animated rendering (GIF stickers via proxy URL) */
  animated?: boolean;
  style?: CSSProperties;
  onContextMenu?: (e: React.MouseEvent) => void;
};

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const DOUBLE_TAP_MS = 280;
const DOUBLE_TAP_ZOOM = 2.5;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function paintToCanvas(
  canvas: HTMLCanvasElement,
  container: HTMLElement,
  img: HTMLImageElement,
  objectFit: 'cover' | 'contain'
) {
  if (!img.complete) return;
  const rect = container.getBoundingClientRect();
  const cssW = Math.max(1, rect.width);
  const cssH = Math.max(1, rect.height);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);

  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;

  let drawW: number;
  let drawH: number;
  let drawX: number;
  let drawY: number;

  if (objectFit === 'cover') {
    const s = Math.max(cssW / iw, cssH / ih);
    drawW = iw * s;
    drawH = ih * s;
    drawX = (cssW - drawW) / 2;
    drawY = (cssH - drawH) / 2;
  } else {
    const s = Math.min(cssW / iw, cssH / ih);
    drawW = iw * s;
    drawH = ih * s;
    drawX = (cssW - drawW) / 2;
    drawY = (cssH - drawH) / 2;
  }

  ctx.drawImage(img, drawX, drawY, drawW, drawH);
}

type ZoomSurfaceProps = {
  img: HTMLImageElement;
  src?: string;
  animated?: boolean;
  objectFit?: 'cover' | 'contain';
  className?: string;
  style?: CSSProperties;
  /** When true, single tap (no move) calls onSingleTap */
  onSingleTap?: () => void;
  /** If true, single tap closes only when scale === 1 */
  singleTapClosesWhenIdle?: boolean;
  onContextMenu?: (e: React.MouseEvent) => void;
};

function ZoomSurface({
  img,
  src,
  animated = false,
  objectFit = 'contain',
  className,
  style,
  onSingleTap,
  singleTapClosesWhenIdle,
  onContextMenu,
}: ZoomSurfaceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [panning, setPanning] = useState(false);
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });

  const scaleRef = useRef(1);
  const txRef = useRef(0);
  const tyRef = useRef(0);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchStartRef = useRef<{ dist: number; scale: number } | null>(null);
  const panStartRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const lastTapRef = useRef(0);
  const movedRef = useRef(false);

  const applyTransform = useCallback((scale: number, x: number, y: number) => {
    const next = { scale: clamp(scale, MIN_SCALE, MAX_SCALE), x, y };
    if (next.scale <= 1.01) {
      next.scale = 1;
      next.x = 0;
      next.y = 0;
    }
    scaleRef.current = next.scale;
    txRef.current = next.x;
    tyRef.current = next.y;
    setTransform(next);
  }, []);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    paintToCanvas(canvas, container, img, objectFit);
  }, [img, objectFit]);

  useEffect(() => {
    if (animated) return;
    paint();
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => paint());
    ro.observe(el);
    return () => ro.disconnect();
  }, [paint, animated]);

  const prevent = useCallback((e: SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onContextMenu?.(e);
    },
    [onContextMenu]
  );

  const pointerDistance = () => {
    const pts = [...pointersRef.current.values()];
    if (pts.length < 2) return 0;
    const [a, b] = pts;
    return Math.hypot(b.x - a.x, b.y - a.y);
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    movedRef.current = false;
    setPanning(true);

    if (pointersRef.current.size === 2) {
      pinchStartRef.current = {
        dist: pointerDistance(),
        scale: scaleRef.current,
      };
      panStartRef.current = null;
      return;
    }

    if (scaleRef.current > 1) {
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        tx: txRef.current,
        ty: tyRef.current,
      };
    }
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 2 && pinchStartRef.current) {
      movedRef.current = true;
      const { dist, scale } = pinchStartRef.current;
      if (dist > 0) {
        applyTransform((pointerDistance() / dist) * scale, txRef.current, tyRef.current);
      }
      return;
    }

    if (panStartRef.current && scaleRef.current > 1) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) movedRef.current = true;
      applyTransform(
        scaleRef.current,
        panStartRef.current.tx + dx,
        panStartRef.current.ty + dy
      );
    }
  };

  const endPointer = (e: ReactPointerEvent) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchStartRef.current = null;
    if (pointersRef.current.size === 0) {
      panStartRef.current = null;
      setPanning(false);
    }

    if (pointersRef.current.size === 1 && scaleRef.current > 1) {
      const remaining = [...pointersRef.current.entries()][0];
      if (remaining) {
        panStartRef.current = {
          x: remaining[1].x,
          y: remaining[1].y,
          tx: txRef.current,
          ty: tyRef.current,
        };
      }
    }
  };

  const onPointerUp = (e: ReactPointerEvent) => {
    const wasPinchOrPan = movedRef.current || pointersRef.current.size > 1;
    endPointer(e);
    if (wasPinchOrPan || pointersRef.current.size > 0) return;

    const now = Date.now();
    if (now - lastTapRef.current < DOUBLE_TAP_MS) {
      lastTapRef.current = 0;
      if (scaleRef.current > 1.05) applyTransform(1, 0, 0);
      else applyTransform(DOUBLE_TAP_ZOOM, 0, 0);
      return;
    }

    lastTapRef.current = now;
    window.setTimeout(() => {
      if (lastTapRef.current !== now) return;
      if (singleTapClosesWhenIdle && scaleRef.current > 1.05) return;
      onSingleTap?.();
    }, DOUBLE_TAP_MS);
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    applyTransform(scaleRef.current * delta, txRef.current, tyRef.current);
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative isolate overflow-hidden select-none touch-none [-webkit-touch-callout:none]',
        transform.scale > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in',
        className
      )}
      style={style}
      draggable={false}
      onContextMenu={handleContextMenu}
      onDragStart={prevent}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={endPointer}
      onWheel={onWheel}
    >
      {animated ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src || img.src}
          alt=""
          draggable={false}
          className="pointer-events-none mx-auto block max-h-full max-w-full object-contain"
          style={{
            transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scale})`,
            transformOrigin: 'center center',
            transition: panning ? 'none' : 'transform 0.18s ease-out',
          }}
        />
      ) : (
        <canvas
          ref={canvasRef}
          aria-hidden
          className="pointer-events-none block size-full"
          style={{
            transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scale})`,
            transformOrigin: 'center center',
            transition: panning ? 'none' : 'transform 0.18s ease-out',
          }}
        />
      )}
      <div
        aria-hidden
        className="absolute inset-0 z-10"
        style={{ WebkitTouchCallout: 'none', userSelect: 'none' }}
        onContextMenu={handleContextMenu}
        onDragStart={prevent}
      />
      {transform.scale > 1.05 && (
        <button
          type="button"
          className="absolute bottom-3 right-3 z-20 rounded-md bg-black/55 px-2 py-1 text-xs text-white backdrop-blur-sm"
          onClick={(e) => {
            e.stopPropagation();
            applyTransform(1, 0, 0);
          }}
        >
          รีเซ็ต
        </button>
      )}
    </div>
  );
}

/**
 * Chat image: tap to open fullscreen viewer (IG-style).
 * Canvas render protects URL — no &lt;img src&gt;, no open-in-new-tab.
 */
export function ChatImage({
  src,
  alt = 'รูปภาพ',
  className,
  objectFit = 'contain',
  maxWidth = 260,
  maxHeight = 340,
  animated: animatedProp,
  style,
  onContextMenu,
}: ChatImageProps) {
  const thumbRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  // Fixed box up-front so scroll height does not jump when the image finishes loading
  const reservedW = maxWidth;
  const reservedH =
    objectFit === 'cover' ? maxHeight : Math.max(96, Math.round(maxWidth * 0.75));
  const size = { w: reservedW, h: reservedH };
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const animated = animatedProp ?? isAnimatedImageUrl(src);

  useEffect(() => {
    setMounted(true);
  }, []);

  const paintThumb = useCallback(() => {
    if (animated) return;
    const canvas = canvasRef.current;
    const container = thumbRef.current;
    const img = imgRef.current;
    if (!canvas || !container || !img) return;
    paintToCanvas(canvas, container, img, objectFit);
  }, [objectFit, animated]);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setFailed(false);

    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      if (cancelled) return;
      imgRef.current = img;
      setLoaded(true);
    };
    img.onerror = () => {
      if (cancelled) return;
      setFailed(true);
    };
    img.src = src;

    return () => {
      cancelled = true;
      img.onload = null;
      img.onerror = null;
      imgRef.current = null;
    };
  }, [src, maxWidth, maxHeight, objectFit, retryKey]);

  const retryLoad = useCallback((e?: React.SyntheticEvent) => {
    e?.stopPropagation();
    setFailed(false);
    setLoaded(false);
    setRetryKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    paintThumb();
    const el = thumbRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => paintThumb());
    ro.observe(el);
    return () => ro.disconnect();
  }, [loaded, size, paintThumb]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const prevent = useCallback((e: SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onContextMenu?.(e);
    },
    [onContextMenu]
  );

  const openViewer = useCallback((e?: React.SyntheticEvent) => {
    e?.stopPropagation();
    if (!loaded || failed) return;
    setOpen(true);
  }, [loaded, failed]);

  return (
    <>
      <div
        ref={thumbRef}
        role="button"
        tabIndex={0}
        aria-label={`${alt} — กดเพื่อดูเต็ม`}
        className={cn(
          'chat-zoom-image relative isolate cursor-zoom-in overflow-hidden select-none',
          '[-webkit-touch-callout:none]',
          className
        )}
        style={{
          width: size.w,
          height: size.h,
          maxWidth: '100%',
          ...style,
        }}
        draggable={false}
        onContextMenu={handleContextMenu}
        onDragStart={prevent}
        onClick={openViewer}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openViewer(e);
          }
        }}
        title="กดเพื่อดูรูปเต็ม"
      >
        {animated ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            draggable={false}
            className="pointer-events-none block size-full"
            style={{
              objectFit,
              opacity: loaded && !failed ? 1 : 0,
            }}
          />
        ) : (
          <canvas
            ref={canvasRef}
            aria-hidden
            className="pointer-events-none block size-full"
            style={{ opacity: loaded && !failed ? 1 : 0 }}
          />
        )}

        {!loaded && !failed && (
          <div className="absolute inset-0 animate-pulse bg-muted/40" />
        )}

        {failed && (
          <button
            type="button"
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-1.5 bg-muted/80 px-2 text-muted-foreground transition hover:bg-muted"
            onClick={retryLoad}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                retryLoad(e);
              }
            }}
          >
            <ImageOff className="size-6 opacity-70" aria-hidden />
            <span className="text-center text-[0.7rem] font-medium leading-tight">โหลดรูปไม่สำเร็จ</span>
            <span className="inline-flex items-center gap-1 text-[0.65rem] text-blue-600">
              <RefreshCw className="size-3" aria-hidden />
              แตะเพื่อลองใหม่
            </span>
          </button>
        )}

        <div
          aria-hidden
          className="absolute inset-0 z-10"
          style={{ WebkitTouchCallout: 'none', userSelect: 'none' }}
          onContextMenu={handleContextMenu}
          onDragStart={prevent}
        />
      </div>

      {mounted &&
        open &&
        imgRef.current &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={alt}
            className="fixed inset-0 z-[9999] flex flex-col bg-black/95"
            onContextMenu={prevent}
          >
            <div className="absolute top-0 right-0 left-0 z-30 flex items-center justify-between px-3 py-3">
              <p className="text-xs text-white/70">ดับเบิลแท็บหรือบีบนิ้วเพื่อซูม</p>
              <button
                type="button"
                aria-label="ปิด"
                className="flex size-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition hover:bg-white/20"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                }}
              >
                <X className="size-5" />
              </button>
            </div>

            <ZoomSurface
              img={imgRef.current}
              src={src}
              animated={animated}
              objectFit="contain"
              className="size-full min-h-0 flex-1"
              singleTapClosesWhenIdle
              onSingleTap={() => setOpen(false)}
            />
          </div>,
          document.body
        )}
    </>
  );
}
