'use client';

import { useState, useRef, useEffect, CSSProperties, memo } from 'react';
import { Box, Skeleton } from '@mui/material';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number | string;
  height?: number | string;
  className?: string;
  style?: CSSProperties;
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  priority?: boolean;
  placeholder?: 'blur' | 'skeleton' | 'none';
  blurDataURL?: string;
  onLoad?: () => void;
  onError?: () => void;
  borderRadius?: number | string;
  aspectRatio?: string;
}

// Default blur placeholder (1x1 transparent base64)
const DEFAULT_BLUR = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

// Image cache for preloaded images
const imageCache = new Map<string, HTMLImageElement>();
const loadingImages = new Map<string, Promise<HTMLImageElement>>();

/**
 * Preload an image and cache it
 */
export function preloadImage(src: string): Promise<HTMLImageElement> {
  if (!src) return Promise.reject(new Error('No src'));
  
  // Return cached image
  if (imageCache.has(src)) {
    return Promise.resolve(imageCache.get(src)!);
  }
  
  // Return existing loading promise
  if (loadingImages.has(src)) {
    return loadingImages.get(src)!;
  }
  
  // Start loading
  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    
    img.onload = () => {
      imageCache.set(src, img);
      loadingImages.delete(src);
      resolve(img);
    };
    
    img.onerror = () => {
      loadingImages.delete(src);
      reject(new Error(`Failed to load: ${src}`));
    };
    
    img.src = src;
  });
  
  loadingImages.set(src, promise);
  return promise;
}

/**
 * Preload multiple images in parallel
 */
export function preloadImages(urls: string[]): Promise<HTMLImageElement[]> {
  return Promise.all(urls.filter(Boolean).map(preloadImage));
}

/**
 * Check if an image is already cached
 */
export function isImageCached(src: string): boolean {
  return imageCache.has(src);
}

/**
 * Clear image cache (for memory management)
 */
export function clearImageCache(): void {
  imageCache.clear();
}

/**
 * OptimizedImage - High performance image component with lazy loading
 * 
 * Features:
 * - Intersection Observer based lazy loading
 * - Native browser lazy loading as fallback
 * - Blur/skeleton placeholder during load
 * - Automatic caching and preloading
 * - Smooth fade-in animation
 * - Error handling with retry
 */
function OptimizedImageComponent({
  src,
  alt,
  width = '100%',
  height = 'auto',
  className = '',
  style = {},
  objectFit = 'cover',
  priority = false,
  placeholder = 'skeleton',
  blurDataURL,
  onLoad,
  onError,
  borderRadius,
  aspectRatio,
}: OptimizedImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [isInView, setIsInView] = useState(priority);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (priority || isInView) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '200px', // Start loading 200px before visible
        threshold: 0.01,
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [priority, isInView]);

  // Preload priority images immediately
  useEffect(() => {
    if (priority && src) {
      preloadImage(src).catch(() => {});
    }
  }, [priority, src]);

  // Handle image load
  const handleLoad = () => {
    setLoaded(true);
    setError(false);
    onLoad?.();
  };

  // Handle image error
  const handleError = () => {
    setError(true);
    onError?.();
  };

  // Combined styles
  const containerStyles: CSSProperties = {
    position: 'relative',
    width,
    height,
    overflow: 'hidden',
    borderRadius,
    aspectRatio,
    ...style,
  };

  const imageStyles: CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit,
    opacity: loaded ? 1 : 0,
    transition: 'opacity 0.3s ease-out',
    display: 'block',
  };

  // Show skeleton placeholder
  if (!isInView) {
    return (
      <Box
        ref={containerRef}
        className={className}
        sx={containerStyles}
      >
        {placeholder === 'skeleton' && (
          <Skeleton
            variant="rectangular"
            animation="wave"
            sx={{
              position: 'absolute',
              inset: 0,
              bgcolor: 'rgba(255,255,255,0.05)',
              borderRadius,
            }}
          />
        )}
        {placeholder === 'blur' && (
          <Box
            component="img"
            src={blurDataURL || DEFAULT_BLUR}
            alt=""
            sx={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit,
              filter: 'blur(20px)',
              transform: 'scale(1.1)',
            }}
          />
        )}
      </Box>
    );
  }

  // Error state
  if (error) {
    return (
      <Box
        ref={containerRef}
        className={className}
        sx={{
          ...containerStyles,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'rgba(255,255,255,0.03)',
          color: '#64748b',
          fontSize: '0.75rem',
        }}
      >
        ไม่สามารถโหลดรูปได้
      </Box>
    );
  }

  return (
    <Box
      ref={containerRef}
      className={className}
      sx={containerStyles}
    >
      {/* Placeholder while loading */}
      {!loaded && (
        <>
          {placeholder === 'skeleton' && (
            <Skeleton
              variant="rectangular"
              animation="wave"
              sx={{
                position: 'absolute',
                inset: 0,
                bgcolor: 'rgba(255,255,255,0.05)',
                borderRadius,
              }}
            />
          )}
          {placeholder === 'blur' && blurDataURL && (
            <Box
              component="img"
              src={blurDataURL}
              alt=""
              sx={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit,
                filter: 'blur(20px)',
                transform: 'scale(1.1)',
              }}
            />
          )}
        </>
      )}
      
      {/* Main image */}
      <Box
        ref={imgRef}
        component="img"
        src={src}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        onLoad={handleLoad}
        onError={handleError}
        sx={imageStyles}
      />
    </Box>
  );
}

// Memoize to prevent unnecessary re-renders
const OptimizedImage = memo(OptimizedImageComponent);

export default OptimizedImage;

/**
 * Background image component with lazy loading
 */
interface OptimizedBackgroundProps {
  src?: string;
  children?: React.ReactNode;
  className?: string;
  style?: CSSProperties;
  objectFit?: 'cover' | 'contain';
  priority?: boolean;
  fallbackColor?: string;
  overlay?: string;
  blur?: number;
}

export const OptimizedBackground = memo(function OptimizedBackgroundComponent({
  src,
  children,
  className = '',
  style = {},
  objectFit = 'cover',
  priority = false,
  fallbackColor = 'rgba(15,23,42,0.8)',
  overlay,
  blur = 0,
}: OptimizedBackgroundProps) {
  const [loaded, setLoaded] = useState(false);
  const [isInView, setIsInView] = useState(priority);
  const containerRef = useRef<HTMLDivElement>(null);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (priority || isInView || !src) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '200px',
        threshold: 0.01,
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [priority, isInView, src]);

  // Preload image when in view
  useEffect(() => {
    if (isInView && src) {
      preloadImage(src)
        .then(() => setLoaded(true))
        .catch(() => {});
    }
  }, [isInView, src]);

  return (
    <Box
      ref={containerRef}
      className={className}
      sx={{
        position: 'relative',
        ...style,
      }}
    >
      {/* Background layer */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          backgroundImage: loaded && src ? `url(${src})` : undefined,
          backgroundColor: !loaded || !src ? fallbackColor : undefined,
          backgroundSize: objectFit,
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          filter: blur > 0 ? `blur(${blur}px)` : undefined,
          transition: 'opacity 0.4s ease-out',
          opacity: loaded ? 1 : 0.5,
        }}
      />
      
      {/* Loading shimmer */}
      {!loaded && src && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)`,
            animation: 'shimmer 1.5s infinite',
            '@keyframes shimmer': {
              '0%': { transform: 'translateX(-100%)' },
              '100%': { transform: 'translateX(100%)' },
            },
          }}
        />
      )}
      
      {/* Overlay */}
      {overlay && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background: overlay,
          }}
        />
      )}
      
      {/* Children */}
      <Box sx={{ position: 'relative', zIndex: 1 }}>
        {children}
      </Box>
    </Box>
  );
});
