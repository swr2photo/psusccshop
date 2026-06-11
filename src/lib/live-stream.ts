export const LIVE_API_KEY = '/api/live';

export const LIVE_SESSION_CACHE_KEY = 'psuscc_live_cache_v1';

/** Public live payload returned by GET /api/live */
export interface LiveStreamData {
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

export type LivePopupMode = 'hidden' | 'popup' | 'mini' | 'dismissed';

export function isLiveStreamActive(live: LiveStreamData | null | undefined): boolean {
  return Boolean(live?.enabled && live.streamUrl);
}

export function loadLiveSessionCache(): LiveStreamData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(LIVE_SESSION_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { live?: LiveStreamData | null; cachedAt?: number };
    if (!parsed.live?.enabled) return null;
    // Seed UI for up to 2 minutes while SWR revalidates
    if (Date.now() - (parsed.cachedAt || 0) > 2 * 60 * 1000) return null;
    return parsed.live;
  } catch {
    return null;
  }
}

export function saveLiveSessionCache(live: LiveStreamData | null): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(
      LIVE_SESSION_CACHE_KEY,
      JSON.stringify({ live, cachedAt: Date.now() }),
    );
  } catch {
    /* ignore quota errors */
  }
}

export function getYouTubeVideoId(url: string): string | null {
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

export function getLiveEmbedUrl(url: string, type: string): string {
  if (type === 'youtube') {
    const vid = getYouTubeVideoId(url);
    if (vid) {
      return `https://www.youtube.com/embed/${vid}?autoplay=1&mute=1&rel=0&modestbranding=1&playsinline=1`;
    }
    return url;
  }
  if (type === 'facebook') {
    const encodedUrl = encodeURIComponent(url);
    return `https://www.facebook.com/plugins/video.php?href=${encodedUrl}&width=720&height=405&show_text=false&autoplay=true&allowFullScreen=true&appId=`;
  }
  return url;
}

export function getYouTubeThumbnail(url: string): string | null {
  const vid = getYouTubeVideoId(url);
  return vid ? `https://img.youtube.com/vi/${vid}/maxresdefault.jpg` : null;
}

export function getStreamPlatformLabel(type: string): { label: string; color: string } {
  switch (type) {
    case 'youtube':
      return { label: 'ดูบน YouTube', color: '#FF0000' };
    case 'facebook':
      return { label: 'ดูบน Facebook', color: '#1877F2' };
    default:
      return { label: 'ดูไลฟ์สด', color: '#ef4444' };
  }
}
