'use client';

import { useState, useRef, useEffect, CSSProperties, memo, useCallback } from 'react';
import { Box, Skeleton, CircularProgress } from '@mui/material';

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
}: OptimizedImageProps) {
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

  // Determine if we should use fade animation
  // Skip fade if: image was already loaded before, or disableFade is true
  const skipFade = disableFade || wasLoaded;
  
  const imageStyles: CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit,
    opacity: loaded ? 1 : (skipFade ? 1 : 0),
    transition: skipFade ? 'none' : 'opacity 0.3s ease-out',
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
        {(placeholder === 'skeleton' || placeholder === 'shimmer') && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              bgcolor: 'var(--glass-bg)',
              borderRadius,
              overflow: 'hidden',
              '&::after': placeholder === 'shimmer' ? {
                content: '""',
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(90deg, transparent 0%, rgba(0,113,227,0.15) 50%, transparent 100%)',
                animation: 'shimmer 1.5s infinite',
                '@keyframes shimmer': {
                  '0%': { transform: 'translateX(-100%)' },
                  '100%': { transform: 'translateX(100%)' },
                },
              } : {},
            }}
          >
            {/* Image placeholder icon */}
            <Box sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              color: 'rgba(0,113,227,0.3)',
              fontSize: '2rem',
            }}>
              
            </Box>
          </Box>
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

  // Error state with retry option
  if (error) {
    return (
      <Box
        ref={containerRef}
        className={className}
        onClick={() => {
          setError(false);
          setLoaded(false);
        }}
        sx={{
          ...containerStyles,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1,
          bgcolor: 'var(--glass-bg)',
          color: '#86868b',
          fontSize: '0.75rem',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          '&:hover': {
            bgcolor: 'var(--glass-strong)',
            color: 'var(--text-muted)',
          },
        }}
      >
        <Box sx={{ 
          fontSize: '1.5rem', 
          opacity: 0.6,
          animation: 'shake 0.5s ease-in-out',
          '@keyframes shake': {
            '0%, 100%': { transform: 'translateX(0)' },
            '25%': { transform: 'translateX(-2px)' },
            '75%': { transform: 'translateX(2px)' },
          },
        }}>
          
        </Box>
        <Box sx={{ textAlign: 'center', px: 1 }}>
          โหลดรูปไม่สำเร็จ
          <Box component="span" sx={{ display: 'block', fontSize: '0.65rem', color: '#0071e3', mt: 0.5 }}>
            แตะเพื่อลองใหม่
          </Box>
        </Box>
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
          {(placeholder === 'skeleton' || placeholder === 'shimmer') && (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                bgcolor: 'var(--glass-bg)',
                borderRadius,
                overflow: 'hidden',
                '&::after': placeholder === 'shimmer' ? {
                  content: '""',
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(90deg, transparent 0%, rgba(0,113,227,0.2) 50%, transparent 100%)',
                  animation: 'shimmer 1.5s infinite',
                  '@keyframes shimmer': {
                    '0%': { transform: 'translateX(-100%)' },
                    '100%': { transform: 'translateX(100%)' },
                  },
                } : {},
              }}
            >
              {/* Centered loading indicator */}
              {showLoadingIndicator && (
                <Box sx={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                }}>
                  <CircularProgress 
                    size={32} 
                    thickness={3}
                    sx={{ 
                      color: '#0071e3',
                      '& .MuiCircularProgress-circle': {
                        strokeLinecap: 'round',
                      },
                    }} 
                  />
                </Box>
              )}
              {/* Image placeholder icon when no loading indicator */}
              {!showLoadingIndicator && (
                <Box sx={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  color: 'rgba(0,113,227,0.4)',
                  fontSize: '2rem',
                  animation: 'pulse 2s ease-in-out infinite',
                  '@keyframes pulse': {
                    '0%, 100%': { opacity: 0.4 },
                    '50%': { opacity: 0.8 },
                  },
                }}>
                  
                </Box>
              )}
            </Box>
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
