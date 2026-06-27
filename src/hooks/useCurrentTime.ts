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
