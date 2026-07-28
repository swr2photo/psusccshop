'use client';

import { useEffect, useRef, useState, useCallback, useSyncExternalStore, type CSSProperties } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export type ScrollyStage = {
  title: string;
  body: string;
  side: 'left' | 'right';
  eyebrow?: string;
};

type Props = {
  frames: string[];
  fallbackImages: string[];
  stages: ScrollyStage[];
  onBuyStage?: (active: boolean) => void;
  className?: string;
};

function prefersCoarseMobile(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(pointer: coarse)').matches ||
    window.matchMedia('(max-width: 768px)').matches
  );
}

function subscribeNarrow(onChange: () => void) {
  const mq = window.matchMedia('(max-width: 768px)');
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

function getNarrowSnapshot() {
  return window.matchMedia('(max-width: 768px)').matches;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function loadOrdered(
  urls: string[],
  onProgress: (pct: number) => void,
  concurrency = 6,
): Promise<HTMLImageElement[]> {
  if (urls.length === 0) return [];
  const results: (HTMLImageElement | null)[] = new Array(urls.length).fill(null);
  let done = 0;
  let next = 0;

  await new Promise<void>((resolve) => {
    const launch = () => {
      while (next < urls.length && active < concurrency) {
        const index = next++;
        active += 1;
        void loadImage(urls[index]).then((img) => {
          results[index] = img;
          done += 1;
          active -= 1;
          onProgress(Math.round((done / urls.length) * 100));
          if (done >= urls.length) resolve();
          else launch();
        });
      }
    };
    let active = 0;
    launch();
  });

  return results.filter((img): img is HTMLImageElement => !!img);
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cw: number,
  ch: number,
  scale: number,
  panX: number,
  panY: number,
) {
  const ir = img.naturalWidth / img.naturalHeight;
  const cr = cw / ch;
  let dw: number;
  let dh: number;
  if (ir > cr) {
    dh = ch * scale;
    dw = dh * ir;
  } else {
    dw = cw * scale;
    dh = dw / ir;
  }
  const dx = (cw - dw) / 2 + panX;
  const dy = (ch - dh) / 2 + panY;
  ctx.drawImage(img, dx, dy, dw, dh);
}

/**
 * Apple-style sticky canvas scrubber.
 * Prefers an image sequence; falls back to 1–3 product stills with scale/pan.
 */
export default function ScrollytellingHero({
  frames,
  fallbackImages,
  stages,
  onBuyStage,
  className,
}: Props) {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const progressRef = useRef(0);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const modeRef = useRef<'sequence' | 'fallback'>('fallback');
  const onBuyStageRef = useRef(onBuyStage);

  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [activeStage, setActiveStage] = useState(0);
  const [ready, setReady] = useState(false);
  const isNarrow = useSyncExternalStore(subscribeNarrow, getNarrowSnapshot, () => false);

  useEffect(() => {
    onBuyStageRef.current = onBuyStage;
  }, [onBuyStage]);

  const draw = useCallback((progress: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === 0 || h === 0) return;

    const tw = Math.floor(w * dpr);
    const th = Math.floor(h * dpr);
    if (canvas.width !== tw || canvas.height !== th) {
      canvas.width = tw;
      canvas.height = th;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const imgs = imagesRef.current;
    if (imgs.length === 0) return;

    const p = Math.max(0, Math.min(1, progress));

    if (modeRef.current === 'sequence' && imgs.length > 1) {
      const idx = Math.min(imgs.length - 1, Math.floor(p * (imgs.length - 1)));
      const img = imgs[idx];
      if (img) drawCover(ctx, img, w, h, 1, 0, 0);
      return;
    }

    const count = imgs.length;
    const segment = count === 1 ? 0 : p * (count - 1);
    const i0 = Math.floor(segment);
    const i1 = Math.min(count - 1, i0 + 1);
    const local = count === 1 ? p : segment - i0;
    const scale0 = 1 + local * 0.35;
    const scale1 = 1.15 + local * 0.25;
    const panX = (local - 0.5) * w * 0.08;
    const panY = (0.5 - local) * h * 0.04;

    drawCover(ctx, imgs[i0], w, h, scale0, panX, panY);
    if (i1 !== i0 && imgs[i1]) {
      ctx.save();
      ctx.globalAlpha = local;
      drawCover(ctx, imgs[i1], w, h, scale1, -panX * 0.5, -panY);
      ctx.restore();
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function preload() {
      setLoading(true);
      setLoadProgress(0);
      const mobile = prefersCoarseMobile();
      const concurrency = mobile ? 4 : 6;

      let sequence: HTMLImageElement[] = [];
      if (frames.length > 0) {
        const probe = await loadImage(frames[0]);
        if (probe && !cancelled) {
          sequence = await loadOrdered(frames, (pct) => {
            if (!cancelled) setLoadProgress(pct);
          }, concurrency);
        }
      }

      if (cancelled) return;

      if (sequence.length >= 2) {
        imagesRef.current = sequence;
        modeRef.current = 'sequence';
        setReady(true);
        setLoading(false);
        draw(0);
        return;
      }

      const stills = fallbackImages.slice(0, 3);
      const loaded = await loadOrdered(stills, (pct) => {
        if (!cancelled) setLoadProgress(pct);
      }, 3);

      if (cancelled) return;
      imagesRef.current = loaded;
      modeRef.current = 'fallback';
      setReady(loaded.length > 0);
      setLoading(false);
      draw(0);
    }

    void preload();
    return () => {
      cancelled = true;
    };
  }, [frames, fallbackImages, draw]);

  useEffect(() => {
    if (!ready || !sectionRef.current) return;

    const section = sectionRef.current;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: section,
        start: 'top top',
        end: 'bottom bottom',
        scrub: reduceMotion ? false : 0.45,
        onUpdate: (self) => {
          progressRef.current = self.progress;
          draw(self.progress);
          const stageCount = Math.max(stages.length, 1);
          setActiveStage(Math.min(stageCount - 1, Math.floor(self.progress * stageCount)));
          onBuyStageRef.current?.(self.progress >= 0.72);
        },
      });
    }, section);

    const onResize = () => draw(progressRef.current);
    window.addEventListener('resize', onResize);
    return () => {
      ctx.revert();
      window.removeEventListener('resize', onResize);
    };
  }, [ready, stages.length, draw]);

  return (
    <section
      ref={sectionRef}
      className={className}
      style={{
        position: 'relative',
        height: `${Math.max(stages.length, 3) * 100}vh`,
        background: 'var(--background)',
      }}
    >
      <div
        style={{
          position: 'sticky',
          top: 0,
          height: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse 70% 55% at 50% 42%, var(--glow-1), transparent 70%), radial-gradient(ellipse 50% 40% at 70% 70%, var(--glow-2), transparent 65%)',
            pointerEvents: 'none',
          }}
        />

        <canvas
          ref={canvasRef}
          style={{
            width: 'min(92vw, 560px)',
            height: 'min(72vh, 560px)',
            maxWidth: '100%',
            opacity: loading ? 0.35 : 1,
            transition: 'opacity 0.5s ease',
            zIndex: 1,
          }}
          aria-hidden
        />

        {loading && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              zIndex: 3,
              background: 'color-mix(in srgb, var(--background) 55%, transparent)',
              backdropFilter: 'blur(6px)',
            }}
          >
            <div
              style={{
                width: 160,
                height: 3,
                borderRadius: 999,
                background: 'var(--surface-2)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${loadProgress}%`,
                  height: '100%',
                  background: 'var(--primary)',
                  transition: 'width 0.2s ease',
                }}
              />
            </div>
            <span style={{ fontSize: 13, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
              {loadProgress}%
            </span>
          </div>
        )}

        {stages.map((stage, i) => {
          const active = i === activeStage && !loading;
          const isLeft = stage.side === 'left';

          const desktopPos: CSSProperties = isLeft
            ? { left: 'clamp(16px, 6vw, 72px)', right: 'auto', textAlign: 'left' }
            : { right: 'clamp(16px, 6vw, 72px)', left: 'auto', textAlign: 'right' };

          const mobilePos: CSSProperties = {
            left: '50%',
            right: 'auto',
            top: 'auto',
            bottom: 'calc(96px + env(safe-area-inset-bottom, 0px))',
            transform: active ? 'translateX(-50%)' : 'translateX(-50%) translateY(8px)',
            textAlign: 'center',
            maxWidth: 'min(88vw, 360px)',
          };

          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                top: isNarrow ? undefined : '50%',
                maxWidth: 'min(340px, 38vw)',
                opacity: active ? 1 : 0,
                pointerEvents: 'none',
                transition: 'opacity 0.45s ease, transform 0.55s cubic-bezier(0.22, 1, 0.36, 1)',
                zIndex: 2,
                ...(isNarrow
                  ? mobilePos
                  : {
                      ...desktopPos,
                      transform: active
                        ? 'translateY(-50%)'
                        : `translateY(-50%) translateX(${isLeft ? '-12px' : '12px'})`,
                    }),
              }}
            >
              {stage.eyebrow && (
                <p
                  style={{
                    margin: '0 0 8px',
                    fontSize: 12,
                    fontWeight: 600,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: 'var(--secondary)',
                  }}
                >
                  {stage.eyebrow}
                </p>
              )}
              <h2
                style={{
                  margin: '0 0 10px',
                  fontSize: 'clamp(1.35rem, 2.4vw, 2rem)',
                  fontWeight: 700,
                  letterSpacing: '-0.03em',
                  lineHeight: 1.15,
                  color: 'var(--foreground)',
                }}
              >
                {stage.title}
              </h2>
              <p
                style={{
                  margin: 0,
                  fontSize: 'clamp(0.9rem, 1.4vw, 1.05rem)',
                  lineHeight: 1.55,
                  color: 'var(--text-muted)',
                }}
              >
                {stage.body}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
