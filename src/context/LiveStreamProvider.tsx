'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useLiveStream } from '@/hooks/useLiveStream';
import type { LivePopupMode, LiveStreamData } from '@/lib/live-stream';

interface LiveStreamContextValue {
  live: LiveStreamData | null;
  isActive: boolean;
  liveTitle: string;
  mode: LivePopupMode;
  isLoading: boolean;
  openLiveStream: () => void;
  minimize: () => void;
  expand: () => void;
  dismiss: () => void;
  refresh: () => void;
}

const LiveStreamContext = createContext<LiveStreamContextValue | null>(null);

export function useLiveStreamContext(): LiveStreamContextValue {
  const ctx = useContext(LiveStreamContext);
  if (!ctx) {
    throw new Error('useLiveStreamContext must be used within LiveStreamProvider');
  }
  return ctx;
}

/** Optional hook for pages that may render outside provider during SSR edge cases */
export function useLiveStreamContextOptional(): LiveStreamContextValue | null {
  return useContext(LiveStreamContext);
}

export function LiveStreamProvider({ children }: { children: React.ReactNode }) {
  const { live, isActive, liveTitle, isLoading, refresh } = useLiveStream();
  const [mode, setMode] = useState<LivePopupMode>('hidden');
  const sessionDismissed = useRef(false);
  const prevActiveRef = useRef(false);

  useEffect(() => {
    if (!isActive || !live) {
      setMode((prev) => (prev === 'popup' || prev === 'mini' ? 'hidden' : prev));
      prevActiveRef.current = false;
      return;
    }

    const becameActive = !prevActiveRef.current;
    prevActiveRef.current = true;

    if (sessionDismissed.current) return;

    if (becameActive) {
      setMode(live.autoPopup ? 'popup' : 'mini');
      return;
    }

    setMode((prev) => (prev === 'hidden' ? (live.autoPopup ? 'popup' : 'mini') : prev));
  }, [isActive, live]);

  const openLiveStream = useCallback(() => {
    sessionDismissed.current = false;
    if (isActive) {
      setMode('popup');
      return;
    }
    void refresh().finally(() => setMode('popup'));
  }, [isActive, refresh]);

  useEffect(() => {
    const handler = () => openLiveStream();
    window.addEventListener('open-live-stream', handler);
    return () => window.removeEventListener('open-live-stream', handler);
  }, [openLiveStream]);

  const minimize = useCallback(() => setMode('mini'), []);
  const expand = useCallback(() => setMode('popup'), []);
  const dismiss = useCallback(() => {
    sessionDismissed.current = true;
    setMode('dismissed');
  }, []);

  const value = useMemo<LiveStreamContextValue>(
    () => ({
      live,
      isActive,
      liveTitle,
      mode,
      isLoading,
      openLiveStream,
      minimize,
      expand,
      dismiss,
      refresh,
    }),
    [
      live,
      isActive,
      liveTitle,
      mode,
      isLoading,
      openLiveStream,
      minimize,
      expand,
      dismiss,
      refresh,
    ],
  );

  return (
    <LiveStreamContext.Provider value={value}>
      {children}
    </LiveStreamContext.Provider>
  );
}
