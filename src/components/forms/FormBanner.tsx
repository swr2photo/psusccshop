'use client';

// Form header banner (uploaded image, uploaded video clip, or YouTube / Vimeo preview) — shared by admin and public pages.

import React from 'react';
import { Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getVideoEmbed, isAllowedBannerVideoUrl, type FormBanner } from '@/lib/forms';

/** Full-width banner at the top of a form. Renders nothing when there is no (valid) banner. */
export function FormBannerView({ banner, title, className }: { banner?: FormBanner | null; title: string; className?: string }) {
  if (!banner?.url) return null;
  if (banner.type === 'image') {
    return (
      <div className={cn('aspect-[3/1] w-full overflow-hidden bg-muted', className)}>
        {/* eslint-disable-next-line @next/next/no-img-element -- uploaded Supabase URL, any size */}
        <img src={banner.url} alt={`แบนเนอร์ ${title}`} className="size-full object-cover" />
      </div>
    );
  }
  if (isAllowedBannerVideoUrl(banner.url)) {
    return (
      <div className={cn('aspect-video w-full overflow-hidden bg-black', className)}>
        <video
          src={banner.url}
          poster={banner.posterUrl}
          autoPlay
          muted
          loop
          playsInline
          controls
          preload="metadata"
          aria-label={`วิดีโอ ${title}`}
          className="size-full object-contain"
        />
      </div>
    );
  }
  const embed = getVideoEmbed(banner.url);
  if (!embed) return null;
  return (
    <div className={cn('aspect-video w-full overflow-hidden bg-black', className)}>
      <iframe
        src={embed.embedUrl}
        title={`วิดีโอ ${title}`}
        className="size-full border-0"
        loading="lazy"
        allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}

/** Small thumbnail for form lists. Renders nothing when the form has no banner. */
export function FormBannerThumb({ banner, className }: { banner?: FormBanner | null; className?: string }) {
  if (!banner?.url) return null;
  const isUploadedVideo = banner.type === 'video' && isAllowedBannerVideoUrl(banner.url);
  const embed = banner.type === 'video' && !isUploadedVideo ? getVideoEmbed(banner.url) : null;
  const src =
    banner.type === 'image'
      ? banner.url
      : isUploadedVideo
      ? banner.posterUrl
      : embed?.thumbnail;
  if (!src && !embed && !isUploadedVideo) return null;
  const isVideo = Boolean(embed || isUploadedVideo);
  return (
    <div className={cn('relative grid shrink-0 place-items-center overflow-hidden rounded-xl bg-muted', className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote thumbnail
        <img src={src} alt="" className="absolute inset-0 size-full object-cover" loading="lazy" />
      ) : isUploadedVideo ? (
        <video
          src={`${banner.url}#t=0.1`}
          muted
          playsInline
          preload="metadata"
          aria-hidden
          className="pointer-events-none absolute inset-0 size-full object-cover"
        />
      ) : null}
      {isVideo && (
        <span className="relative grid size-7 place-items-center rounded-full bg-black/60 text-white">
          <Play size={13} fill="currentColor" />
        </span>
      )}
    </div>
  );
}
