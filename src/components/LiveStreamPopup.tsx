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
function getEmbedUrl(url: string, type: string): string {
  if (type === 'youtube') {
    // Support: watch?v=, live/, embed/, youtu.be/, shorts/, and direct video IDs
    const patterns = [
      /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/(?:watch\?.*v=|live\/|embed\/|shorts\/)([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/.*[?&]v=([a-zA-Z0-9_-]{11})/,
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return `https://www.youtube.com/embed/${match[1]}?autoplay=1&mute=1&rel=0&modestbranding=1&playsinline=1`;
      }
    }
    // If it looks like a bare video ID (11 chars)
    if (/^[a-zA-Z0-9_-]{11}$/.test(url.trim())) {
      return `https://www.youtube.com/embed/${url.trim()}?autoplay=1&mute=1&rel=0&modestbranding=1&playsinline=1`;
    }
    return url;
  }
  if (type === 'facebook') {
    // Facebook video embed — use plugins/video.php with proper params
    const encodedUrl = encodeURIComponent(url);
    return `https://www.facebook.com/plugins/video.php?href=${encodedUrl}&width=720&height=405&show_text=false&autoplay=true&allowFullScreen=true&appId=`;
  }
  return url;
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
          {(liveData.streamType === 'youtube' || liveData.streamType === 'facebook' || liveData.streamType === 'custom') ? (
            <iframe
              src={getEmbedUrl(liveData.streamUrl, liveData.streamType)}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
              scrolling="no"
              style={{ border: 'none', overflow: 'hidden' }}
            />
          ) : liveData.streamType === 'hls' ? (
            <HLSPlayer url={liveData.streamUrl} />
          ) : null}

          {/* Live badge */}
          <div style={{ position: 'absolute', top: 12, left: 12 }}>
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
            {liveData.streamType === 'youtube' && (
              <a
                href={liveData.streamUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="live-popup-btn live-popup-btn-primary"
                style={{ textDecoration: 'none', display: 'inline-block' }}
              >
                ดูบน YouTube
              </a>
            )}
            {liveData.streamType === 'facebook' && (
              <a
                href={liveData.streamUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="live-popup-btn live-popup-btn-primary"
                style={{ textDecoration: 'none', display: 'inline-block' }}
              >
                ดูบน Facebook
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
