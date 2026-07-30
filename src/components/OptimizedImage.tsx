/* eslint-disable */
'use client';

import { useState, useRef, useEffect, CSSProperties, memo, useCallback } from 'react';
import { Box, Skeleton, CircularProgress } from '@mui/material';
import { useTranslation } from '@/hooks/useTranslation';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number | string;
  height?: number | string;
  className?: string;
  style?: CSSProperties;
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  priority?: boolean;
  placeholder?: 'blur' | 'skeleton' | 'shimmer' | 'none';
  blurDataURL?: string;
  onLoad?: () => void;
  onError?: () => void;
  borderRadius?: number | string;
  aspectRatio?: string;
  // New props to prevent flickering
  disableFade?: boolean; // Skip fade animation
  keepMounted?: boolean; // Keep image loaded even when hidden
  showLoadingIndicator?: boolean; // Show circular progress on top
  fetchPriority?: 'high' | 'low' | 'auto';
}

// Default blur placeholder (1x1 transparent base64)
const DEFAULT_BLUR = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

// Image cache for preloaded images - persists across remounts
const imageCache = new Map<string, HTMLImageElement>();
const loadingImages = new Map<string, Promise<HTMLImageElement>>();
// Track which images have been successfully loaded (survives component remounts)
const loadedImageUrls = new Set<string>();

/**
 * Preload an image and cache it
 */
export function preloadImage(src: string): Promise<HTMLImageElement> {
  if (!src) return Promise.reject(new Error('No src'));
  
  // Return cached image
  if (imageCache.has(src)) {
    loadedImageUrls.add(src); // Mark as loaded
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
      loadedImageUrls.add(src); // Mark as loaded
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
 * Check if an image was already loaded (survives component remounts)
 */
export function wasImageLoaded(src: string): boolean {
  return loadedImageUrls.has(src) || imageCache.has(src);
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
 * - Smooth fade-in animation (can be disabled)
 * - Error handling with retry
 * - Anti-flicker: remembers loaded images across remounts
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
  placeholder = 'shimmer',
  blurDataURL,
  onLoad,
  onError,
  borderRadius,
  aspectRatio,
  disableFade = false,
  keepMounted = false,
  showLoadingIndicator = false,
  fetchPriority,
}: OptimizedImageProps) {
  const { t } = useTranslation();
  // Check if this image was already loaded before (prevents flicker on remount)
  const wasLoaded = wasImageLoaded(src);
  const [loaded, setLoaded] = useState(wasLoaded);
  const [error, setError] = useState(false);
  const [isInView, setIsInView] = useState(priority || wasLoaded);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Intersection Observer for lazy loading (with fallback for older browsers)
  useEffect(() => {
    if (priority || isInView) return;

    // Fallback for browsers without IntersectionObserver (older Safari/iPad)
    if (typeof IntersectionObserver === 'undefined') {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      function(entries) {
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

    return function() { observer.disconnect(); };
  }, [priority, isInView]);

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

  // Determine if we should use fade animation
  // Skip fade if: image was already loaded before, or disableFade is true
  const skipFade = disableFade || wasLoaded;
  const effectivePlaceholder = wasLoaded ? 'none' : placeholder;
  
  const imageStyles: CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit,
    opacity: loaded ? 1 : (skipFade ? 1 : 0),
    transition: skipFade ? 'none' : 'opacity 0.12s ease-out',
    display: 'block',
  };

  // Show skeleton placeholder (skip if already loaded before to prevent flicker)
  if (!isInView && !wasLoaded) {
    return (
      <Box
        ref={containerRef}
        className={className}
        sx={containerStyles}
      >
        {(effectivePlaceholder === 'skeleton' || effectivePlaceholder === 'shimmer') && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              bgcolor: (theme) =>
                theme.palette.mode === 'dark' ? 'var(--surface-2)' : '#ececef',
              borderRadius,
              overflow: 'hidden',
              '&::after': {
                content: '""',
                position: 'absolute',
                inset: 0,
                background:
                  'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.35) 50%, transparent 100%)',
                animation: 'imgShimmer 1.4s ease-in-out infinite',
                '@keyframes imgShimmer': {
                  '0%': { transform: 'translateX(-100%)' },
                  '100%': { transform: 'translateX(100%)' },
                },
              },
            }}
          />
        )}
        {effectivePlaceholder === 'blur' && (
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

  // Error state — quiet brand placeholder (stable height, no loud error chrome)
  if (error) {
    return (
      <Box
        ref={containerRef}
        className={className}
        onClick={(e) => {
          e.stopPropagation();
          setError(false);
          setLoaded(false);
        }}
        sx={{
          ...containerStyles,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: (theme) =>
            theme.palette.mode === 'dark'
              ? 'color-mix(in srgb, var(--surface-2) 90%, #1a1a1c)'
              : '#ececef',
          cursor: 'pointer',
          transition: 'background-color 0.2s ease',
          '&:hover': {
            bgcolor: (theme) =>
              theme.palette.mode === 'dark' ? 'var(--surface-3)' : '#e4e4e8',
          },
        }}
        title={t.misc.tapToRetry}
        aria-label={t.misc.tapToRetry}
      >
        <Box
          component="img"
          src="/favicon.png"
          alt="SCC Shop"
          sx={{
            width: 40,
            height: 40,
            objectFit: 'contain',
            opacity: 0.4,
            filter: 'grayscale(1)',
            userSelect: 'none',
            pointerEvents: 'none',
          }}
        />
      </Box>
    );
  }

  return (
    <Box
      ref={containerRef}
      className={className}
      sx={containerStyles}
    >
      {/* Enhanced placeholder while loading (skip if already loaded to prevent flicker) */}
      {!loaded && !skipFade && (
        <>
          {(effectivePlaceholder === 'skeleton' || effectivePlaceholder === 'shimmer') && (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                bgcolor: (theme) =>
                  theme.palette.mode === 'dark' ? 'var(--surface-2)' : '#ececef',
                borderRadius,
                overflow: 'hidden',
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  inset: 0,
                  background:
                    'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.35) 50%, transparent 100%)',
                  animation: 'imgShimmerIn 1.4s ease-in-out infinite',
                  '@keyframes imgShimmerIn': {
                    '0%': { transform: 'translateX(-100%)' },
                    '100%': { transform: 'translateX(100%)' },
                  },
                },
              }}
            >
              {showLoadingIndicator && (
                <Box sx={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  zIndex: 1,
                }}>
                  <CircularProgress 
                    size={28} 
                    thickness={3}
                    sx={{ 
                      color: 'color-mix(in srgb, var(--primary) 55%, transparent)',
                      '& .MuiCircularProgress-circle': {
                        strokeLinecap: 'round',
                      },
                    }} 
                  />
                </Box>
              )}
            </Box>
          )}
          {effectivePlaceholder === 'blur' && blurDataURL && (
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
        fetchPriority={fetchPriority ?? (priority ? 'high' : 'auto')}
        onLoad={handleLoad}
        onError={handleError}
        sx={imageStyles}
      />
    </Box>
  );
}

// Memoize to prevent unnecessary re-renders with stable comparison
const OptimizedImage = memo(OptimizedImageComponent, (prevProps, nextProps) => {
  // Only re-render if these props actually change
  return (
    prevProps.src === nextProps.src &&
    prevProps.alt === nextProps.alt &&
    prevProps.width === nextProps.width &&
    prevProps.height === nextProps.height &&
    prevProps.objectFit === nextProps.objectFit &&
    prevProps.priority === nextProps.priority &&
    prevProps.borderRadius === nextProps.borderRadius
  );
});

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
  disableFade?: boolean;
}

export const OptimizedBackground = memo(function OptimizedBackgroundComponent({
  src,
  children,
  className = '',
  style = {},
  objectFit = 'cover',
  priority = false,
  fallbackColor = 'var(--glass-strong)',
  overlay,
  blur = 0,
  disableFade = false,
}: OptimizedBackgroundProps) {
  // Check if already loaded before (anti-flicker)
  const wasLoaded = src ? wasImageLoaded(src) : false;
  const [loaded, setLoaded] = useState(wasLoaded);
  const [isInView, setIsInView] = useState(priority || wasLoaded);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Skip fade animation if already loaded
  const skipFade = disableFade || wasLoaded;

  // Intersection Observer for lazy loading (with fallback for older browsers)
  useEffect(() => {
    if (priority || isInView || !src) return;

    // Fallback for browsers without IntersectionObserver (older Safari/iPad)
    if (typeof IntersectionObserver === 'undefined') {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      function(entries) {
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

    return function() { observer.disconnect(); };
  }, [priority, isInView, src]);

  // Preload image when in view
  useEffect(() => {
    if (isInView && src && !loaded) {
      preloadImage(src)
        .then(() => setLoaded(true))
        .catch(() => {});
    }
  }, [isInView, src, loaded]);

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
          backgroundImage: (loaded || wasLoaded) && src ? `url(${src})` : undefined,
          backgroundColor: (!loaded && !wasLoaded) || !src ? fallbackColor : undefined,
          backgroundSize: objectFit,
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          filter: blur > 0 ? `blur(${blur}px)` : undefined,
          transition: skipFade ? 'none' : 'opacity 0.4s ease-out',
          opacity: loaded || skipFade ? 1 : 0.5,
        }}
      />
      
      {/* Loading shimmer (skip if already loaded) */}
      {!loaded && !skipFade && src && (
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
