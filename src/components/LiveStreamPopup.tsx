'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';

/**
 * LiveStreamPopup — Floating live stream popup for customers
 * 
 * When admin enables a live stream, this shows:
 * 1. Auto-popup overlay with embedded stream (YouTube/Facebook/HLS)
 * 2. Minimizable to a floating "LIVE" badge
 * 3. Polls /api/live every 30s to detect live status changes
 * 4. Remembers user dismissal for current session
 */

// ==================== TYPES ====================
interface LiveData {
  enabled: boolean;
  title: string;
  description?: string;
  streamUrl: string;
  streamType: 'hls' | 'youtube' | 'facebook' | 'custom';
  thumbnailUrl?: string;
  startedAt?: string;
  autoPopup: boolean;
  featuredProducts?: string[];
}

// ==================== CSS ====================
const POPUP_CSS = `
@keyframes live-pulse {
  0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
  50% { transform: scale(1.02); box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
}
@keyframes live-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
@keyframes live-slide-up {
  from { opacity: 0; transform: translateY(20px) scale(0.95); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes live-badge-bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}
.live-popup-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.7);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
  animation: live-slide-up 0.3s ease-out;
}
.live-popup-container {
  width: 90vw;
  max-width: 720px;
  background: #1a1a1a;
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 25px 50px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1);
  animation: live-slide-up 0.3s ease-out;
}
.live-popup-video {
  width: 100%;
  aspect-ratio: 16/9;
  background: #000;
  position: relative;
}
.live-popup-video iframe {
  width: 100%;
  height: 100%;
  border: none;
  position: absolute;
  inset: 0;
}
.live-popup-info {
  padding: 16px 20px;
}
.live-popup-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #ef4444;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 6px;
  letter-spacing: 0.5px;
  animation: live-pulse 2s ease-in-out infinite;
}
.live-popup-badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #fff;
  animation: live-dot 1.5s ease-in-out infinite;
}
.live-popup-title {
  color: #f5f5f7;
  font-size: 1.1rem;
  font-weight: 600;
  margin: 8px 0 4px;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Noto Sans Thai", system-ui, sans-serif;
}
.live-popup-desc {
  color: rgba(255,255,255,0.5);
  font-size: 0.85rem;
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Noto Sans Thai", system-ui, sans-serif;
}
.live-popup-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-top: 1px solid rgba(255,255,255,0.08);
}
.live-popup-btn {
  border: none;
  border-radius: 12px;
  padding: 10px 20px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Noto Sans Thai", system-ui, sans-serif;
  transition: all 0.15s ease;
}
.live-popup-btn-primary {
  background: linear-gradient(135deg, #ef4444, #dc2626);
  color: #fff;
}
.live-popup-btn-primary:hover {
  background: linear-gradient(135deg, #dc2626, #b91c1c);
}
.live-popup-btn-secondary {
  background: rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.7);
}
.live-popup-btn-secondary:hover {
  background: rgba(255,255,255,0.12);
}
/* Minimized floating badge */
.live-mini-badge {
  position: fixed;
  bottom: 100px;
  right: 20px;
  z-index: 9999;
  display: flex;
  align-items: center;
  gap: 8px;
  background: linear-gradient(135deg, #ef4444, #dc2626);
  color: #fff;
  padding: 10px 16px;
  border-radius: 50px;
  cursor: pointer;
  box-shadow: 0 8px 32px rgba(239,68,68,0.4), 0 0 0 1px rgba(255,255,255,0.1);
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Noto Sans Thai", system-ui, sans-serif;
  font-weight: 600;
  font-size: 0.85rem;
  animation: live-badge-bounce 2s ease-in-out infinite, live-slide-up 0.3s ease-out;
  transition: all 0.2s ease;
  user-select: none;
  -webkit-user-select: none;
}
.live-mini-badge:hover {
  transform: scale(1.05);
  box-shadow: 0 12px 40px rgba(239,68,68,0.5);
}
.live-mini-badge-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #fff;
  animation: live-dot 1.5s ease-in-out infinite;
}
.live-mini-close {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: rgba(0,0,0,0.7);
  color: #fff;
  border: 1px solid rgba(255,255,255,0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  cursor: pointer;
  line-height: 1;
}
`;

// ==================== HELPERS ====================
function getYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /youtube(?:-nocookie)?\.com\/(?:watch\?.*v=|live\/|embed\/|shorts\/)([a-zA-Z0-9_-]{11})/,
    /youtube(?:-nocookie)?\.com\/.*[?&]v=([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  if (/^[a-zA-Z0-9_-]{11}$/.test(url.trim())) return url.trim();
  return null;
}

function getEmbedUrl(url: string, type: string): string {
  if (type === 'youtube') {
    const vid = getYouTubeVideoId(url);
    if (vid) return `https://www.youtube.com/embed/${vid}?autoplay=1&mute=1&rel=0&modestbranding=1&playsinline=1`;
    return url;
  }
  if (type === 'facebook') {
    const encodedUrl = encodeURIComponent(url);
    return `https://www.facebook.com/plugins/video.php?href=${encodedUrl}&width=720&height=405&show_text=false&autoplay=true&allowFullScreen=true&appId=`;
  }
  return url;
}

function getYouTubeThumbnail(url: string): string | null {
  const vid = getYouTubeVideoId(url);
  return vid ? `https://img.youtube.com/vi/${vid}/maxresdefault.jpg` : null;
}

function getStreamLabel(type: string): { label: string; icon: string; color: string } {
  switch (type) {
    case 'youtube': return { label: 'ดูบน YouTube', icon: '▶', color: '#FF0000' };
    case 'facebook': return { label: 'ดูบน Facebook', icon: '▶', color: '#1877F2' };
    default: return { label: 'ดูไลฟ์สด', icon: '▶', color: '#ef4444' };
  }
}

// ==================== EMBED PLAYER WITH FALLBACK ====================
function EmbedPlayer({ liveData }: { liveData: LiveData }) {
  const [embedFailed, setEmbedFailed] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iframeLoadedRef = useRef(false);

  // For YouTube/Facebook — try embed first, fallback to preview card if blocked
  const isEmbeddable = liveData.streamType === 'youtube' || liveData.streamType === 'facebook' || liveData.streamType === 'custom';
  const thumbnailUrl = liveData.thumbnailUrl || (liveData.streamType === 'youtube' ? getYouTubeThumbnail(liveData.streamUrl) : null);
  const streamInfo = getStreamLabel(liveData.streamType);

  // Desktop detection — desktop browsers are stricter about iframe embedding
  const isDesktop = typeof window !== 'undefined' && !(/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent));

  useEffect(() => {
    iframeLoadedRef.current = false;
    // If embed doesn't load properly, show fallback
    if (isEmbeddable && !embedFailed) {
      // Facebook embeds are very unreliable on desktop — skip straight to preview
      if (liveData.streamType === 'facebook' && isDesktop) {
        setEmbedFailed(true);
        return;
      }
      // Always set a fallback timeout — onLoad fires even for error/refused pages
      timerRef.current = setTimeout(() => {
        setEmbedFailed(true);
      }, 5000);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [isEmbeddable, embedFailed, liveData.streamType, isDesktop]);

  // HLS — use HLS player directly (no embed issues)
  if (liveData.streamType === 'hls') {
    return <HLSPlayer url={liveData.streamUrl} />;
  }

  // Show preview card (for when embed fails or for better UX)
  if (embedFailed || !isEmbeddable) {
    return (
      <PreviewCard
        thumbnailUrl={thumbnailUrl}
        streamUrl={liveData.streamUrl}
        streamInfo={streamInfo}
      />
    );
  }

  // Try iframe embed with fallback
  return (
    <>
      <iframe
        ref={iframeRef}
        src={getEmbedUrl(liveData.streamUrl, liveData.streamType)}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        referrerPolicy="no-referrer-when-downgrade"
        scrolling="no"
        style={{ border: 'none', overflow: 'hidden', width: '100%', height: '100%', position: 'absolute', inset: 0 }}
        onError={() => setEmbedFailed(true)}
        onLoad={() => {
          // onLoad fires even for error/refused pages, so we can't fully trust it.
          // Instead, try to detect if the iframe actually rendered YouTube content.
          // Keep the timeout as final fallback — it will trigger if embed is broken.
          iframeLoadedRef.current = true;
          try {
            const iframe = iframeRef.current;
            if (iframe) {
              // If we can access iframe.contentDocument, it's same-origin (error page)
              // Cross-origin (actual YouTube) will throw — that means embed worked
              const doc = iframe.contentDocument || iframe.contentWindow?.document;
              // If we got here without throwing, it's a same-origin error page
              if (doc) {
                setEmbedFailed(true);
                if (timerRef.current) clearTimeout(timerRef.current);
                return;
              }
            }
          } catch {
            // Cross-origin error = iframe loaded actual YouTube content = success!
            if (timerRef.current) clearTimeout(timerRef.current);
          }
        }}
      />
    </>
  );
}

// ==================== PREVIEW CARD (when embed is blocked) ====================
function PreviewCard({ thumbnailUrl, streamUrl, streamInfo }: {
  thumbnailUrl: string | null;
  streamUrl: string;
  streamInfo: { label: string; icon: string; color: string };
}) {
  return (
    <div style={{
      width: '100%', height: '100%', position: 'absolute', inset: 0,
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 16, padding: 20,
    }}>
      {thumbnailUrl && (
        <img
          src={thumbnailUrl}
          alt="Live stream thumbnail"
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover', opacity: 0.3, filter: 'blur(2px)',
          }}
        />
      )}
      <div style={{
        position: 'relative', zIndex: 2, textAlign: 'center',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
      }}>
        {/* Animated play icon */}
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: `linear-gradient(135deg, ${streamInfo.color}, ${streamInfo.color}cc)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 8px 32px ${streamInfo.color}66`,
          animation: 'live-pulse 2s ease-in-out infinite',
        }}>
          <span style={{ fontSize: 28, color: '#fff', marginLeft: 4 }}>▶</span>
        </div>
        <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', fontFamily: '-apple-system, BlinkMacSystemFont, "Noto Sans Thai", system-ui' }}>
          กดปุ่มเพื่อดูไลฟ์สด
        </div>
        <a
          href={streamUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            background: `linear-gradient(135deg, ${streamInfo.color}, ${streamInfo.color}dd)`,
            color: '#fff', padding: '14px 32px', borderRadius: 14,
            fontSize: '1rem', fontWeight: 700, textDecoration: 'none',
            boxShadow: `0 8px 24px ${streamInfo.color}44`,
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Noto Sans Thai", system-ui, sans-serif',
            transition: 'all 0.2s ease',
          }}
        >
          {streamInfo.label}
        </a>
      </div>
    </div>
  );
}

// ==================== COMPONENT ====================
export default function LiveStreamPopup() {
  const [liveData, setLiveData] = useState<LiveData | null>(null);
  const [mode, setMode] = useState<'hidden' | 'popup' | 'mini' | 'dismissed'>('hidden');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionDismissed = useRef(false);

  // Fetch live status
  const fetchLiveStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/live', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      
      if (data.live && data.live.enabled) {
        setLiveData(data.live);
        // Auto-show popup if not dismissed and autoPopup is on
        if (!sessionDismissed.current && data.live.autoPopup) {
          setMode(prev => prev === 'hidden' ? 'popup' : prev);
        } else if (!sessionDismissed.current) {
          setMode(prev => prev === 'hidden' ? 'mini' : prev);
        }
      } else {
        setLiveData(null);
        setMode('hidden');
      }
    } catch {
      // silently fail
    }
  }, []);

  // Poll every 30s
  useEffect(() => {
    fetchLiveStatus();
    pollRef.current = setInterval(fetchLiveStatus, 30000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchLiveStatus]);

  // Inject CSS
  useEffect(() => {
    const id = 'live-popup-styles';
    if (!document.getElementById(id)) {
      const s = document.createElement('style');
      s.id = id;
      s.textContent = POPUP_CSS;
      document.head.appendChild(s);
    }
  }, []);

  // Listen for external open-live-stream event (from navbar button)
  useEffect(() => {
    const handler = () => {
      // If live is active, force open popup regardless of dismiss state
      if (liveData?.enabled) {
        sessionDismissed.current = false;
        setMode('popup');
      } else {
        // Live not active yet — fetch immediately then open
        fetchLiveStatus().then(() => {
          sessionDismissed.current = false;
          setMode('popup');
        });
      }
    };
    window.addEventListener('open-live-stream', handler);
    return () => window.removeEventListener('open-live-stream', handler);
  }, [liveData, fetchLiveStatus]);

  const handleMinimize = () => setMode('mini');
  const handleExpand = () => setMode('popup');
  const handleDismiss = () => {
    sessionDismissed.current = true;
    setMode('dismissed');
  };
  const handleCloseMini = (e: React.MouseEvent) => {
    e.stopPropagation();
    sessionDismissed.current = true;
    setMode('dismissed');
  };

  if (!liveData || mode === 'hidden' || mode === 'dismissed') return null;

  // ==================== MINI BADGE ====================
  if (mode === 'mini') {
    return (
      <div className="live-mini-badge" onClick={handleExpand}>
        <span className="live-mini-badge-dot" />
        LIVE • {liveData.title}
        <span className="live-mini-close" onClick={handleCloseMini}>×</span>
      </div>
    );
  }

  // ==================== FULL POPUP ====================
  return (
    <div className="live-popup-overlay" onClick={handleMinimize}>
      <div className="live-popup-container" onClick={(e) => e.stopPropagation()}>
        {/* Video Player */}
        <div className="live-popup-video">
          <EmbedPlayer liveData={liveData} />

          {/* Live badge */}
          <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 10 }}>
            <span className="live-popup-badge">
              <span className="live-popup-badge-dot" />
              LIVE
            </span>
          </div>
        </div>

        {/* Info */}
        <div className="live-popup-info">
          <h3 className="live-popup-title">{liveData.title}</h3>
          {liveData.description && (
            <p className="live-popup-desc">{liveData.description}</p>
          )}
          {liveData.startedAt && (
            <p className="live-popup-desc" style={{ marginTop: 4, fontSize: '0.75rem' }}>
              🔴 เริ่มเมื่อ {new Date(liveData.startedAt).toLocaleString('th-TH')}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="live-popup-actions">
          <button className="live-popup-btn live-popup-btn-secondary" onClick={handleMinimize}>
            ย่อหน้าต่าง
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="live-popup-btn live-popup-btn-secondary" onClick={handleDismiss}>
              ปิด
            </button>
            {(liveData.streamType === 'youtube' || liveData.streamType === 'facebook') && (
              <a
                href={liveData.streamUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="live-popup-btn live-popup-btn-primary"
                style={{ textDecoration: 'none', display: 'inline-block' }}
              >
                {liveData.streamType === 'youtube' ? 'ดูบน YouTube' : 'ดูบน Facebook'}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== HLS PLAYER ====================
// Uses CDN-loaded hls.js to avoid bundling dependency
declare global {
  interface Window { Hls?: any; }
}

function HLSPlayer({ url }: { url: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Try native HLS support (Safari, iOS)
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
      video.play().catch(() => {});
      return;
    }

    // Load hls.js from CDN for other browsers
    let hls: any = null;
    const loadHls = () => {
      const HlsClass = window.Hls;
      if (HlsClass && HlsClass.isSupported()) {
        hls = new HlsClass({ enableWorker: true, lowLatencyMode: true });
        hls.loadSource(url);
        hls.attachMedia(video);
        hls.on(HlsClass.Events.MANIFEST_PARSED, () => {
          video.play().catch(() => {});
        });
      } else {
        // Fallback: try direct (works on some browsers)
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
      if (hls) hls.destroy();
    };
  }, [url]);

  return (
    <video
      ref={videoRef}
      style={{ width: '100%', height: '100%', objectFit: 'contain', position: 'absolute', inset: 0, background: '#000' }}
      controls
      autoPlay
      playsInline
      muted
    />
  );
}
