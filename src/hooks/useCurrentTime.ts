'use client';

import { useState, useEffect } from 'react';
import { getSyncedDate, initServerTimeSync } from '@/lib/server-time';

export function useCurrentTime(tickIntervalMs = 1000) {
  const [time, setTime] = useState<Date>(() => getSyncedDate());

  useEffect(() => {
    // Initial sync
    void initServerTimeSync().then(() => {
      setTime(getSyncedDate());
    });

    const timer = setInterval(() => {
      setTime(getSyncedDate());
    }, tickIntervalMs);

    return () => clearInterval(timer);
  }, [tickIntervalMs]);

  return time;
}

/**
 * Clock that updates exactly on each wall-clock minute (and when the tab becomes
 * visible again). Use it in large pages whose time logic is minute-precision
 * (open/close windows, "x days/hours left"): far fewer full re-renders than a
 * 5-second tick, while status changes still land on the exact minute.
 */
export function useMinuteClock() {
  const [time, setTime] = useState<Date>(() => getSyncedDate());

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const schedule = () => {
      const nowMs = getSyncedDate().getTime();
      const msToNextMinute = 60_000 - (nowMs % 60_000) + 50;
      timeout = setTimeout(() => {
        setTime(getSyncedDate());
        schedule();
      }, msToNextMinute);
    };

    const resync = () => {
      if (document.visibilityState !== 'visible') return;
      setTime(getSyncedDate());
      if (timeout) clearTimeout(timeout);
      schedule();
    };

    void initServerTimeSync().then(() => setTime(getSyncedDate()));
    schedule();
    document.addEventListener('visibilitychange', resync);
    return () => {
      if (timeout) clearTimeout(timeout);
      document.removeEventListener('visibilitychange', resync);
    };
  }, []);

  return time;
}
