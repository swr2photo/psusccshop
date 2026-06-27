// Client-side server time synchronization helper
let timeOffset = 0; // ms difference: serverTime - clientTime
let isInitialized = false;
let syncPromise: Promise<void> | null = null;

export async function initServerTimeSync(): Promise<void> {
  if (isInitialized) return;
  if (syncPromise) return syncPromise;

  syncPromise = (async () => {
    try {
      const start = Date.now();
      const res = await fetch('/api/time');
      const end = Date.now();
      
      if (res.ok) {
        const data = await res.json();
        const serverTime = new Date(data.timestamp).getTime();
        // Estimate network latency (round-trip / 2)
        const latency = (end - start) / 2;
        const clientTimeAtServerMoment = start + latency;
        timeOffset = serverTime - clientTimeAtServerMoment;
        isInitialized = true;
        console.log(`[ServerTimeSync] Synced. Latency: ${latency}ms, Offset: ${timeOffset}ms`);
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
  // If not sync'd yet, trigger sync in the background
  if (!isInitialized) {
    void initServerTimeSync();
  }
  return new Date(Date.now() + timeOffset);
}
