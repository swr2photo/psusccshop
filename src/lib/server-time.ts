// Client-side server time synchronization helper
import { apiFetch } from '@/lib/api-client';

let timeOffset = 0; // ms difference: serverTime - clientTime
let isInitialized = false;
let syncPromise: Promise<void> | null = null;

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

export async function initServerTimeSync(): Promise<void> {
  // Relative `/api/time` is invalid in Node during SSG/SSR — browser only
  if (!isBrowser()) return;
  if (isInitialized) return;
  if (syncPromise) return syncPromise;

  syncPromise = (async () => {
    try {
      const start = Date.now();
      const res = await apiFetch('/api/time');
      const end = Date.now();

      if (res.ok) {
        const data = await res.json();
        const rawTs = data?.timestamp ?? data?.data?.timestamp;
        const serverTime = rawTs ? new Date(rawTs).getTime() : NaN;
        if (Number.isFinite(serverTime)) {
          // Estimate network latency (round-trip / 2)
          const latency = (end - start) / 2;
          const clientTimeAtServerMoment = start + latency;
          const computedOffset = serverTime - clientTimeAtServerMoment;
          if (Number.isFinite(computedOffset)) {
            timeOffset = computedOffset;
            isInitialized = true;
            console.log(`[ServerTimeSync] Synced. Latency: ${latency}ms, Offset: ${timeOffset}ms`);
          }
        }
      }
    } catch (error) {
      console.warn('[ServerTimeSync] Failed to sync server time:', error);
    } finally {
      syncPromise = null;
    }
  })();

  return syncPromise;
}

// Get the current synced date/time
export function getSyncedDate(): Date {
  // If not sync'd yet, trigger sync in the background (client only)
  if (!isInitialized && isBrowser()) {
    void initServerTimeSync();
  }
  const safeOffset = Number.isFinite(timeOffset) ? timeOffset : 0;
  return new Date(Date.now() + safeOffset);
}
