'use client';

import { useCallback, useMemo } from 'react';
import useSWR, { mutate } from 'swr';
import { fetcher } from '@/hooks/useSWRConfig';
import {
  LIVE_API_KEY,
  isLiveStreamActive,
  loadLiveSessionCache,
  saveLiveSessionCache,
  type LiveStreamData,
} from '@/lib/live-stream';

const LIVE_POLL_ACTIVE_MS = 30_000;
const LIVE_POLL_IDLE_MS = 120_000;

type LiveApiResponse = { live: LiveStreamData | null };

function getRefreshInterval(data: LiveApiResponse | undefined): number {
  if (typeof document !== 'undefined' && document.hidden) return 0;
  return isLiveStreamActive(data?.live) ? LIVE_POLL_ACTIVE_MS : LIVE_POLL_IDLE_MS;
}

export function invalidateLiveStreamCache(): Promise<LiveApiResponse | undefined> {
  return mutate(LIVE_API_KEY);
}

export function useLiveStream() {
  const sessionSeed = useMemo(() => loadLiveSessionCache(), []);
  const fallbackData = useMemo<LiveApiResponse | undefined>(() => {
    if (!sessionSeed) return undefined;
    return { live: sessionSeed };
  }, [sessionSeed]);

  const { data, error, isLoading, isValidating, mutate: revalidate } = useSWR<LiveApiResponse>(
    LIVE_API_KEY,
    fetcher,
    {
      fallbackData,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 10_000,
      focusThrottleInterval: 5_000,
      keepPreviousData: true,
      refreshInterval: getRefreshInterval,
      onSuccess: (response) => {
        saveLiveSessionCache(response?.live ?? null);
      },
    },
  );

  const live = data?.live ?? null;
  const isActive = isLiveStreamActive(live);

  const refresh = useCallback(() => revalidate(), [revalidate]);

  return {
    live,
    isActive,
    liveTitle: live?.title ?? '',
    isLoading: isLoading && !fallbackData,
    isValidating,
    error,
    refresh,
  };
}
