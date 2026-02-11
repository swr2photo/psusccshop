// store/recentlyViewedStore.ts
// Recently viewed products with Zustand + persistence

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const MAX_RECENTLY_VIEWED = 20;

interface RecentlyViewedState {
  /** Product IDs ordered by most recent first */
  items: string[];
  /** Add product to recently viewed (moves to front if exists) */
  addItem: (productId: string) => void;
  /** Clear all recently viewed */
  clear: () => void;
  /** Get count */
  count: () => number;
}

export const useRecentlyViewedStore = create<RecentlyViewedState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (productId) =>
        set((state) => {
          const filtered = state.items.filter((id) => id !== productId);
          return {
            items: [productId, ...filtered].slice(0, MAX_RECENTLY_VIEWED),
          };
        }),

      clear: () => set({ items: [] }),

      count: () => get().items.length,
    }),
    {
      name: 'recently-viewed-storage',
    }
  )
);
