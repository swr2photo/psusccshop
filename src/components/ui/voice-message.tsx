'use client';

import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatVoiceDuration } from '@/lib/chat-voice';

type VoiceMessageProps = {
  src: string;
  duration?: number | null;
  className?: string;
  playLabel?: string;
  pauseLabel?: string;
};

const BAR_COUNT = 32;

/** Ref-counted data: → blob: cache so Strict Mode / re-renders don't revoke mid-play */
const blobCache = new Map<string, { url: string; blob: Blob; refs: number }>();

function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(',');
  if (comma < 0) throw new Error('invalid data url');
  const header = dataUrl.slice(0, comma);
  const b64 = dataUrl.slice(comma + 1).replace(/\s/g, '');
  const mime = header.match(/data:([^;,]+)/)?.[1] || 'audio/webm';
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function acquirePlayableUrl(src: string): string {
  if (!src.startsWith('data:')) return src;
  const existing = blobCache.get(src);
  if (existing) {
    existing.refs += 1;
    return existing.url;
  }
  const blob = dataUrlToBlob(src);
  const url = URL.createObjectURL(blob);
  blobCache.set(src, { url, blob, refs: 1 });
  return url;
}

function releasePlayableUrl(src: string) {
  if (!src.startsWith('data:')) return;
  const entry = blobCache.get(src);
  if (!entry) return;
  entry.refs -= 1;
  if (entry.refs > 0) return;
  window.setTimeout(() => {
    const again = blobCache.get(src);
    if (again && again.refs <= 0) {
      URL.revokeObjectURL(again.url);
      blobCache.delete(src);
    }
  }, 1000);
}

async function loadAudioBuffer(src: string, playUrl: string): Promise<ArrayBuffer> {
  // Prefer in-memory blob — avoids CSP connect-src blocking fetch(blob:)
  if (src.startsWith('data:')) {
    const cached = blobCache.get(src);
    const blob = cached?.blob || dataUrlToBlob(src);
    return blob.arrayBuffer();
  }
  // Same-origin / https URLs only — never fetch blob: (CSP)
  if (playUrl.startsWith('blob:')) {
    throw new Error('blob fetch blocked by CSP');
  }
  const res = await fetch(playUrl);
  if (!res.ok) throw new Error(`fetch audio ${res.status}`);
  return res.arrayBuffer();
}

function buildPeaks(channel: Float32Array, bars: number): number[] {
  const peaks = new Array(bars).fill(0.12);
  if (!channel.length) return peaks;
  const block = Math.max(1, Math.floor(channel.length / bars));
  let globalMax = 0.0001;
  for (let i = 0; i < bars; i++) {
    let peak = 0;
    const start = i * block;
    const end = Math.min(channel.length, start + block);
    for (let j = start; j < end; j += 4) {
      const v = Math.abs(channel[j]);
      if (v > peak) peak = v;
    }
    peaks[i] = peak;
    if (peak > globalMax) globalMax = peak;
  }
  return peaks.map((p) => Math.max(0.12, Math.min(1, p / globalMax)));
}

function fallbackPeaks(seed: string): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return Array.from({ length: BAR_COUNT }, (_, i) => {
    h = (h * 1664525 + 1013904223) >>> 0;
    const wobble = ((h % 1000) / 1000) * 0.7 + 0.2;
    const envelope = 0.35 + 0.65 * Math.sin((i / BAR_COUNT) * Math.PI);
    return Math.max(0.12, Math.min(1, wobble * envelope));
  });
}

export function VoiceMessage({
  src,
  duration,
  className,
  playLabel = 'Play',
  pauseLabel = 'Pause',
}: VoiceMessageProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const peaksRef = useRef<number[]>(fallbackPeaks(src.slice(0, 64)));
  const levelsRef = useRef<number[]>(peaksRef.current.slice());
  const waveRef = useRef<HTMLDivElement>(null);

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [total, setTotal] = useState(duration || 0);
  const [loadError, setLoadError] = useState(false);
  const [levels, setLevels] = useState<number[]>(() => peaksRef.current.slice());

  const paintBars = (next: number[]) => {
    levelsRef.current = next;
    const root = waveRef.current;
    if (!root) {
      setLevels(next.slice());
      return;
    }
    const children = root.children;
    for (let i = 0; i < children.length && i < next.length; i++) {
      (children[i] as HTMLElement).style.height = `${Math.round(next[i] * 100)}%`;
    }
  };

  const stopRaf = () => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const tickWave = () => {
    const analyser = analyserRef.current;
    const audio = audioRef.current;
    if (!analyser || !audio || audio.paused) {
      paintBars(peaksRef.current);
      stopRaf();
      return;
    }

    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(data);

    const peaks = peaksRef.current;
    const next = new Array(BAR_COUNT);
    const step = Math.max(1, Math.floor(data.length / BAR_COUNT));
    for (let i = 0; i < BAR_COUNT; i++) {
      let sum = 0;
      const start = i * step;
      for (let j = 0; j < step; j++) {
        const v = (data[start + j] ?? 128) - 128;
        sum += Math.abs(v);
      }
      const live = Math.min(1, (sum / step / 128) * 2.2);
      const base = peaks[i] ?? 0.2;
      // Rhythm-driven: keep shape of recording, pulse with live amplitude
      next[i] = Math.max(0.1, Math.min(1, base * 0.35 + live * 0.9));
    }
    paintBars(next);
    rafRef.current = requestAnimationFrame(tickWave);
  };

  const ensureGraph = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;

    if (!ctxRef.current) {
      ctxRef.current = new Ctx();
    }
    const ctx = ctxRef.current;
    if (ctx.state === 'suspended') await ctx.resume();

    if (!sourceRef.current) {
      const source = ctx.createMediaElementSource(audio);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.55;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      sourceRef.current = source;
      analyserRef.current = analyser;
    }
  };

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setLoadError(false);
    setPlaying(false);
    setCurrent(0);
    stopRaf();

    let playUrl: string;
    try {
      playUrl = acquirePlayableUrl(src);
    } catch {
      setLoadError(true);
      return;
    }

    const audio = new Audio();
    audio.preload = 'auto';
    audio.crossOrigin = 'anonymous';
    audioRef.current = audio;

    const onTime = () => setCurrent(audio.currentTime);
    const onMeta = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setTotal(audio.duration);
      }
    };
    const onEnd = () => {
      setPlaying(false);
      setCurrent(0);
      stopRaf();
      paintBars(peaksRef.current);
    };
    const onErr = () => {
      if (!cancelled) setLoadError(true);
    };
    const onCanPlay = () => {
      if (!cancelled) setReady(true);
    };

    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('ended', onEnd);
    audio.addEventListener('error', onErr);
    audio.addEventListener('canplay', onCanPlay);
    audio.src = playUrl;
    audio.load();

    // Build static waveform peaks from decoded PCM (no fetch for data: → avoids CSP blob: block)
    (async () => {
      try {
        const buf = await loadAudioBuffer(src, playUrl);
        const Ctx = window.AudioContext || (window as any).webkitAudioContext;
        if (!Ctx || cancelled) return;
        const probe = new Ctx();
        const decoded = await probe.decodeAudioData(buf.slice(0));
        const channel = decoded.getChannelData(0);
        const peaks = buildPeaks(channel, BAR_COUNT);
        await probe.close();
        if (cancelled) return;
        peaksRef.current = peaks;
        paintBars(peaks);
        setLevels(peaks.slice());
      } catch {
        if (cancelled) return;
        const peaks = fallbackPeaks(src.slice(0, 80));
        peaksRef.current = peaks;
        paintBars(peaks);
        setLevels(peaks.slice());
      }
    })();

    return () => {
      cancelled = true;
      stopRaf();
      audio.pause();
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('ended', onEnd);
      audio.removeEventListener('error', onErr);
      audio.removeEventListener('canplay', onCanPlay);
      try {
        sourceRef.current?.disconnect();
        analyserRef.current?.disconnect();
      } catch {
        // ignore
      }
      sourceRef.current = null;
      analyserRef.current = null;
      void ctxRef.current?.close();
      ctxRef.current = null;
      audioRef.current = null;
      releasePlayableUrl(src);
    };
  }, [src]);

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio || !ready) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      stopRaf();
      paintBars(peaksRef.current);
      return;
    }
    try {
      await ensureGraph();
      await audio.play();
      setPlaying(true);
      stopRaf();
      rafRef.current = requestAnimationFrame(tickWave);
    } catch {
      setPlaying(false);
      setLoadError(true);
    }
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !total) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * total;
    setCurrent(audio.currentTime);
  };

  const progress = total > 0 ? Math.min(1, current / total) : 0;
  const label = formatVoiceDuration(playing || current > 0 ? current : total || duration || 0);

  return (
    <div
      className={cn(
        'flex h-8 min-h-[40px] min-w-[150px] max-w-[200px] items-center gap-1 rounded-xl border border-[var(--glass-border)] bg-[var(--surface)] px-1 text-foreground shadow-sm sm:h-9 sm:min-w-[180px] sm:max-w-[240px] sm:gap-1.5 sm:px-1.5',
        className
      )}
    >
      <button
        type="button"
        onClick={toggle}
        disabled={!ready || loadError}
        aria-label={playing ? pauseLabel : playLabel}
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-lg transition disabled:opacity-50 sm:size-7',
          playing
            ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
            : 'bg-[var(--surface-2)] text-foreground hover:bg-[var(--surface-3)]'
        )}
      >
        {playing ? <Pause className="size-3 fill-current" /> : <Play className="size-3 fill-current" />}
      </button>

      <div className="min-w-0 flex-1">
        <div
          ref={waveRef}
          role="slider"
          aria-valuemin={0}
          aria-valuemax={Math.round(total || 0)}
          aria-valuenow={Math.round(current)}
          aria-label={playLabel}
          tabIndex={0}
          onClick={seek}
          className="flex h-4 cursor-pointer items-center gap-px sm:h-5 sm:gap-[2px]"
        >
          {levels.map((level, i) => {
            const played = i / BAR_COUNT <= progress;
            return (
              <span
                key={i}
                className={cn(
                  'w-[2px] shrink-0 rounded-full transition-[height,background-color,opacity] duration-75',
                  playing
                    ? played
                      ? 'bg-[var(--primary)]'
                      : 'bg-[color-mix(in_srgb,var(--foreground)_28%,transparent)]'
                    : 'bg-[color-mix(in_srgb,var(--foreground)_35%,transparent)]'
                )}
                style={{ height: `${Math.round(level * 100)}%`, minHeight: 2 }}
              />
            );
          })}
        </div>
        {loadError && (
          <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">—</p>
        )}
      </div>

      <span className="shrink-0 px-1 text-[10px] tabular-nums text-[var(--text-muted)]">
        {label}
      </span>
    </div>
  );
}
