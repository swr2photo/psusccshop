import { useEffect } from 'react';
import { preloadImages } from '@/components/OptimizedImage';

/** Preload gallery slides near the active index for smoother swiping. */
export function useGalleryImagePreload(
  images: string[],
  activeIndex: number,
  radius = 1
): void {
  useEffect(() => {
    if (images.length === 0) return;
    const urls: string[] = [];
    for (let offset = -radius; offset <= radius; offset++) {
      const idx = activeIndex + offset;
      if (idx >= 0 && idx < images.length) urls.push(images[idx]);
    }
    preloadImages(urls).catch(() => {});
  }, [images, activeIndex, radius]);
}

/** Only mount full image elements for slides near the active index. */
export function isGalleryImageInRange(
  idx: number,
  activeIndex: number,
  radius = 1
): boolean {
  return Math.abs(idx - activeIndex) <= radius;
}
