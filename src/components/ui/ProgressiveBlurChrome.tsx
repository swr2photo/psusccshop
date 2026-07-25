'use client';

import type { ReactNode, CSSProperties } from 'react';
import { Box, type BoxProps } from '@mui/material';

type BlurEdge = 'bottom' | 'top';

type ProgressiveBlurChromeProps = {
  children: ReactNode;
  /** Fade direction: top bar fades downward; bottom dock fades upward */
  edge?: BlurEdge;
  /** Extra fade distance beyond the content box (px) */
  fadeExtent?: number;
  /** Soft material tint over the blur */
  tint?: 'auto' | 'none';
  /** Stronger bands for small screens / Safari */
  intensity?: 'default' | 'strong';
  className?: string;
  sx?: BoxProps['sx'];
  contentSx?: BoxProps['sx'];
};

/** Staggered blur bands — strongest at the solid edge, dissolving toward content. */
const BLUR_STEPS_DEFAULT = [
  { blur: 1, start: 0, mid: 12.5, end: 25 },
  { blur: 2, start: 12.5, mid: 25, end: 37.5 },
  { blur: 4, start: 25, mid: 37.5, end: 50 },
  { blur: 8, start: 37.5, mid: 50, end: 62.5 },
  { blur: 16, start: 50, mid: 62.5, end: 75 },
  { blur: 24, start: 62.5, mid: 75, end: 87.5 },
  { blur: 40, start: 75, mid: 87.5, end: 100 },
] as const;

/** Denser stack — reads better on mobile Safari where single-layer blur looks flat */
const BLUR_STEPS_STRONG = [
  { blur: 2, start: 0, mid: 10, end: 22 },
  { blur: 4, start: 8, mid: 20, end: 34 },
  { blur: 8, start: 18, mid: 32, end: 48 },
  { blur: 14, start: 30, mid: 46, end: 62 },
  { blur: 22, start: 42, mid: 58, end: 74 },
  { blur: 32, start: 54, mid: 70, end: 86 },
  { blur: 48, start: 66, mid: 82, end: 100 },
] as const;

function maskFor(edge: BlurEdge, start: number, mid: number, end: number): string {
  const dir = edge === 'bottom' ? 'to bottom' : 'to top';
  return `linear-gradient(${dir}, black ${start}%, black ${mid}%, transparent ${end}%)`;
}

/**
 * Apple-style progressive frosted chrome: layered backdrop-blur that
 * dissolves into the page instead of ending in a hard glass edge.
 */
export default function ProgressiveBlurChrome({
  children,
  edge = 'bottom',
  fadeExtent = 36,
  tint = 'auto',
  intensity = 'default',
  className,
  sx,
  contentSx,
}: ProgressiveBlurChromeProps) {
  const steps = intensity === 'strong' ? BLUR_STEPS_STRONG : BLUR_STEPS_DEFAULT;

  const blurInset: CSSProperties =
    edge === 'bottom'
      ? { top: 0, left: 0, right: 0, bottom: -fadeExtent }
      : { bottom: 0, left: 0, right: 0, top: -fadeExtent };

  const tintGradient =
    edge === 'bottom'
      ? {
          light:
            'linear-gradient(to bottom, rgba(255,255,255,0.82) 0%, rgba(255,255,255,0.48) 48%, rgba(255,255,255,0) 100%)',
          dark:
            'linear-gradient(to bottom, rgba(0,0,0,0.68) 0%, rgba(0,0,0,0.32) 48%, rgba(0,0,0,0) 100%)',
        }
      : {
          light:
            'linear-gradient(to top, rgba(255,255,255,0.86) 0%, rgba(255,255,255,0.46) 48%, rgba(255,255,255,0) 100%)',
          dark:
            'linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.34) 48%, rgba(0,0,0,0) 100%)',
        };

  return (
    <Box
      className={className}
      sx={{
        position: 'relative',
        isolation: 'isolate',
        background: 'transparent',
        // Promote layer — helps iOS Safari apply backdrop-filter + mask
        transform: 'translateZ(0)',
        ...((sx as object) || {}),
      }}
    >
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          ...blurInset,
          zIndex: 0,
          pointerEvents: 'none',
          overflow: 'hidden',
          transform: 'translateZ(0)',
        }}
      >
        {steps.map((step) => {
          const mask = maskFor(edge, step.start, step.mid, step.end);
          return (
            <Box
              key={`${step.blur}-${step.start}`}
              sx={{
                position: 'absolute',
                inset: 0,
                backdropFilter: `blur(${step.blur}px) saturate(1.55)`,
                WebkitBackdropFilter: `blur(${step.blur}px) saturate(1.55)`,
                maskImage: mask,
                WebkitMaskImage: mask,
                transform: 'translateZ(0)',
              }}
            />
          );
        })}

        {tint !== 'none' && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              background: (theme) =>
                theme.palette.mode === 'dark' ? tintGradient.dark : tintGradient.light,
              maskImage:
                edge === 'bottom'
                  ? 'linear-gradient(to bottom, black 0%, black 42%, transparent 100%)'
                  : 'linear-gradient(to top, black 0%, black 42%, transparent 100%)',
              WebkitMaskImage:
                edge === 'bottom'
                  ? 'linear-gradient(to bottom, black 0%, black 42%, transparent 100%)'
                  : 'linear-gradient(to top, black 0%, black 42%, transparent 100%)',
            }}
          />
        )}

        <Box
          sx={{
            position: 'absolute',
            left: 0,
            right: 0,
            ...(edge === 'bottom'
              ? { bottom: fadeExtent * 0.28, height: '1px' }
              : { top: fadeExtent * 0.28, height: '1px' }),
            background: (theme) =>
              theme.palette.mode === 'dark'
                ? 'linear-gradient(90deg, transparent, rgba(255,255,255,0.14), transparent)'
                : 'linear-gradient(90deg, transparent, rgba(0,0,0,0.09), transparent)',
            opacity: 0.9,
          }}
        />
      </Box>

      <Box sx={{ position: 'relative', zIndex: 1, ...((contentSx as object) || {}) }}>
        {children}
      </Box>
    </Box>
  );
}
