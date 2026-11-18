'use client';

import { useState, type CSSProperties } from 'react';
import { Box } from '@mui/material';
import OptimizedImage from '@/components/OptimizedImage';

type ImageSource = string | null | undefined;

type ImageLoadState = {
  sourceKey: string;
  sourceIndex: number;
};

export interface ProductImageProps {
  /** Preferred image, normally the product cover. */
  src?: ImageSource;
  /** Images to try when the preferred image cannot be loaded. */
  fallbackSrcs?: ImageSource[];
  alt: string;
  width?: number | string;
  height?: number | string;
  className?: string;
  style?: CSSProperties;
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  priority?: boolean;
  placeholder?: 'blur' | 'skeleton' | 'shimmer' | 'none';
  showLoadingIndicator?: boolean;
  disableFade?: boolean;
  onLoad?: () => void;
  onError?: () => void;
  fallbackImage?: string;
}

/**
 * Storefront image with a deterministic fallback chain.
 *
 * Product covers can be stale while the older `images` array still points to
 * a valid file. Trying those URLs in order keeps the card usable and makes
 * the fallback look identical on the home page, subshops, and cart views.
 */
export default function ProductImage({
  src,
  fallbackSrcs = [],
  alt,
  width = '100%',
  height = '100%',
  className = '',
  style = {},
  objectFit = 'cover',
  priority = false,
  placeholder = 'shimmer',
  showLoadingIndicator = false,
  disableFade = false,
  onLoad,
  onError,
  fallbackImage = '/favicon.png',
}: ProductImageProps) {
  const sources = Array.from(
    new Set(
      [src, ...fallbackSrcs]
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter((value): value is string => value.length > 0),
    ),
  );
  const sourceKey = sources.join('\u0001');
  const [imageLoadState, setImageLoadState] = useState<ImageLoadState>({
    sourceKey: '',
    sourceIndex: 0,
  });
  const hasCurrentSourceState = imageLoadState.sourceKey === sourceKey;
  const sourceIndex = hasCurrentSourceState
    ? Math.min(imageLoadState.sourceIndex, Math.max(sources.length - 1, 0))
    : 0;

  const currentSrc = sources[sourceIndex];

  const handleImageError = () => {
    if (sourceIndex < sources.length - 1) {
      setImageLoadState({
        sourceKey,
        sourceIndex: sourceIndex + 1,
      });
      return;
    }

    // Keep the last URL mounted so OptimizedImage can show its standard
    // retry affordance, matching the storefront image behavior.
    onError?.();
  };

  if (!currentSrc) {
    return (
      <Box
        className={className}
        aria-label={alt}
        sx={{
          position: 'relative',
          width,
          height,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: '#ececef',
          ...style,
        }}
      >
        <Box
          component="img"
          src={fallbackImage}
          alt=""
          aria-hidden
          sx={{
            width: 40,
            height: 40,
            objectFit: 'contain',
            opacity: 0.4,
            filter: 'grayscale(1)',
          }}
        />
      </Box>
    );
  }

  return (
    <OptimizedImage
      key={`${sourceKey}\u0001${currentSrc}`}
      src={currentSrc}
      alt={alt}
      width={width}
      height={height}
      className={className}
      style={style}
      objectFit={objectFit}
      priority={priority}
      placeholder={placeholder}
      showLoadingIndicator={showLoadingIndicator}
      disableFade={disableFade}
      onLoad={onLoad}
      onError={handleImageError}
    />
  );
}
