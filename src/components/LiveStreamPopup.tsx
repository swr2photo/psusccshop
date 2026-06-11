'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useLiveStreamContext } from '@/context/LiveStreamProvider';
import {
  getLiveEmbedUrl,
  getStreamPlatformLabel,
  getYouTubeThumbnail,
  type LiveStreamData,
} from '@/lib/live-stream';
import liveStreamStyles from './live-stream-popup.module.css';

function PreviewCard({
  thumbnailUrl,
  streamUrl,
  streamInfo,
}: {
  thumbnailUrl: string | null;
  streamUrl: string;
  streamInfo: { label: string; color: string };
}) {
  return (
    <div className={liveStreamStyles.previewCard}>
      {thumbnailUrl && (
        <img
          src={thumbnailUrl}
          alt="Live stream thumbnail"
          className={liveStreamStyles.previewThumb}
        />
      )}
      <div className={liveStreamStyles.previewContent}>
        <div
          className={liveStreamStyles.previewPlay}
          style={{
            background: `linear-gradient(135deg, ${streamInfo.color}, ${streamInfo.color}cc)`,
            boxShadow: `0 8px 32px ${streamInfo.color}66`,
          }}
        >
          <span>▶</span>
        </div>
        <div className={liveStreamStyles.previewHint}>กดปุ่มเพื่อดูไลฟ์สด</div>
        <a
          href={streamUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={liveStreamStyles.previewLink}
          style={{
            background: `linear-gradient(135deg, ${streamInfo.color}, ${streamInfo.color}dd)`,
            boxShadow: `0 8px 24px ${streamInfo.color}44`,
          }}
        >
          {streamInfo.label}
        </a>
      </div>
    </div>
  );
}

function EmbedPlayer({ liveData }: { liveData: LiveStreamData }) {
  const [embedFailed, setEmbedFailed] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isEmbeddable =
    liveData.streamType === 'youtube' ||
    liveData.streamType === 'facebook' ||
    liveData.streamType === 'custom';
  const thumbnailUrl =
    liveData.thumbnailUrl ||
    (liveData.streamType === 'youtube' ? getYouTubeThumbnail(liveData.streamUrl) : null);
  const streamInfo = getStreamPlatformLabel(liveData.streamType);
  const isDesktop =
    typeof window !== 'undefined' &&
    !/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  useEffect(() => {
    if (isEmbeddable && !embedFailed) {
      if (liveData.streamType === 'facebook' && isDesktop) {
        setEmbedFailed(true);
        return;
      }
      timerRef.current = setTimeout(() => setEmbedFailed(true), 5000);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isEmbeddable, embedFailed, liveData.streamType, isDesktop]);

  if (liveData.streamType === 'hls') {
    return <HLSPlayer url={liveData.streamUrl} />;
  }

  if (embedFailed || !isEmbeddable) {
    return (
      <PreviewCard
        thumbnailUrl={thumbnailUrl}
        streamUrl={liveData.streamUrl}
        streamInfo={streamInfo}
      />
    );
  }

  return (
    <iframe
      ref={iframeRef}
      src={getLiveEmbedUrl(liveData.streamUrl, liveData.streamType)}
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      allowFullScreen
      referrerPolicy="no-referrer-when-downgrade"
      scrolling="no"
      className={liveStreamStyles.embedFrame}
      onError={() => setEmbedFailed(true)}
      onLoad={() => {
        try {
          const iframe = iframeRef.current;
          if (iframe) {
            const doc = iframe.contentDocument || iframe.contentWindow?.document;
            if (doc) {
              setEmbedFailed(true);
              if (timerRef.current) clearTimeout(timerRef.current);
              return;
            }
          }
        } catch {
          if (timerRef.current) clearTimeout(timerRef.current);
        }
      }}
    />
  );
}

declare global {
  interface Window {
    Hls?: {
      isSupported: () => boolean;
      Events: { MANIFEST_PARSED: string };
      new (config?: { enableWorker?: boolean; lowLatencyMode?: boolean }): {
        loadSource: (url: string) => void;
        attachMedia: (video: HTMLVideoElement) => void;
        on: (event: string, cb: () => void) => void;
        destroy: () => void;
      };
    };
  }
}

function HLSPlayer({ url }: { url: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
      video.play().catch(() => {});
      return;
    }

    let hls: any = null;
    const loadHls = () => {
      const HlsClass = window.Hls as any;
      if (HlsClass?.isSupported()) {
        hls = new HlsClass({ enableWorker: true, lowLatencyMode: true });
        hls.loadSource(url);
        hls.attachMedia(video);
        hls.on(HlsClass.Events.MANIFEST_PARSED, () => {
          video.play().catch(() => {});
        });
      } else {
        video.src = url;
        video.play().catch(() => {});
      }
    };

    if (window.Hls) {
      loadHls();
    } else {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/hls.js@latest/dist/hls.min.js';
      script.onload = loadHls;
      script.onerror = () => {
        video.src = url;
        video.play().catch(() => {});
      };
      document.head.appendChild(script);
    }

    return () => {
      hls?.destroy();
    };
  }, [url]);

  return (
    <video
      ref={videoRef}
      className={liveStreamStyles.hlsVideo}
      controls
      autoPlay
      playsInline
      muted
    />
  );
}

export default function LiveStreamPopup() {
  const { live, mode, minimize, expand, dismiss } = useLiveStreamContext();

  if (!live || mode === 'hidden' || mode === 'dismissed') return null;

  if (mode === 'mini') {
    return (
      <button type="button" className={liveStreamStyles.miniBadge} onClick={expand}>
        <span className={liveStreamStyles.liveDot} />
        LIVE • {live.title}
        <span
          className={liveStreamStyles.miniClose}
          onClick={(e) => {
            e.stopPropagation();
            dismiss();
          }}
        >
          ×
        </span>
      </button>
    );
  }

  return (
    <div className={liveStreamStyles.overlay} onClick={minimize} role="presentation">
      <div
        className={liveStreamStyles.container}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={live.title}
      >
        <div className={liveStreamStyles.videoWrap}>
          <EmbedPlayer liveData={live} />
          <div className={liveStreamStyles.liveBadgeWrap}>
            <span className={liveStreamStyles.liveBadge}>
              <span className={liveStreamStyles.liveDot} />
              LIVE
            </span>
          </div>
        </div>

        <div className={liveStreamStyles.info}>
          <h3 className={liveStreamStyles.title}>{live.title}</h3>
          {live.description && <p className={liveStreamStyles.desc}>{live.description}</p>}
          {live.startedAt && (
            <p className={liveStreamStyles.startedAt}>
              เริ่มเมื่อ {new Date(live.startedAt).toLocaleString('th-TH')}
            </p>
          )}
        </div>

        <div className={liveStreamStyles.actions}>
          <button type="button" className={liveStreamStyles.btnSecondary} onClick={minimize}>
            ย่อหน้าต่าง
          </button>
          <div className={liveStreamStyles.actionGroup}>
            <button type="button" className={liveStreamStyles.btnSecondary} onClick={dismiss}>
              ปิด
            </button>
            {(live.streamType === 'youtube' || live.streamType === 'facebook') && (
              <a
                href={live.streamUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={liveStreamStyles.btnPrimary}
              >
                {live.streamType === 'youtube' ? 'ดูบน YouTube' : 'ดูบน Facebook'}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
