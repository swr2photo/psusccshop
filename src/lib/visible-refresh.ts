/**
 * Client helpers so background tabs stop burning bandwidth.
 */

export function isDocumentHidden(): boolean {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden';
}

/** Use as SWR `refreshInterval` number (0 = pause while hidden). */
export function pollWhenVisible(intervalMs: number): number {
  return isDocumentHidden() ? 0 : intervalMs;
}

/**
 * SWR supports `refreshInterval: (data) => number`.
 * Prefer this over a fixed number so hidden tabs pause automatically.
 */
export function visibleRefreshInterval(intervalMs: number): () => number {
  return () => pollWhenVisible(intervalMs);
}

/** Adaptive interval: slower when Realtime is healthy; paused when hidden. */
export function adaptiveVisibleRefresh(
  realtimeConnected: boolean,
  whenConnectedMs: number,
  whenDisconnectedMs: number
): () => number {
  return () =>
    pollWhenVisible(realtimeConnected ? whenConnectedMs : whenDisconnectedMs);
}
