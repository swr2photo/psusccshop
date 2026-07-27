'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/**
 * Thin top progress bar for client navigations (YouTube / GitHub style).
 * Avoids full-page splash on route changes.
 */
export default function TopProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  const [width, setWidth] = useState(0);
  const timers = useRef<number[]>([]);
  const first = useRef(true);

  const clearTimers = () => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  };

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }

    clearTimers();
    setVisible(true);
    setWidth(12);

    timers.current.push(
      window.setTimeout(() => setWidth(55), 80),
      window.setTimeout(() => setWidth(78), 280),
      window.setTimeout(() => setWidth(92), 520),
      window.setTimeout(() => {
        setWidth(100);
        timers.current.push(
          window.setTimeout(() => {
            setVisible(false);
            setWidth(0);
          }, 180),
        );
      }, 700),
    );

    return clearTimers;
  }, [pathname, searchParams]);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[10000] h-[2.5px] overflow-hidden"
    >
      <div
        className="h-full origin-left rounded-r-full bg-[#0071e3] shadow-[0_0_8px_rgba(0,113,227,0.55)] transition-[width] duration-200 ease-out"
        style={{ width: `${width}%` }}
      />
    </div>
  );
}
