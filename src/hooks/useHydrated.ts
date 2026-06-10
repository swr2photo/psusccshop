import { useSyncExternalStore } from 'react';

/** True only after the client has finished hydrating (server snapshot stays false). */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}
