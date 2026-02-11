// store/wishlistStore.ts
// Wishlist state management with Zustand + persistence

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface WishlistState {
  /** Product IDs in wishlist */
  items: string[];
  /** Add product to wishlist */
  addItem: (productId: string) => void;
  /** Remove product from wishlist */
  removeItem: (productId: string) => void;
  /** Toggle wishlist status */
  toggleItem: (productId: string) => void;
  /** Check if product is in wishlist */
  isInWishlist: (productId: string) => boolean;
  /** Clear entire wishlist */
  clearWishlist: () => void;
  /** Get total count */
  count: () => number;
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (productId) =>
        set((state) => {
          if (state.items.includes(productId)) return state;
          return { items: [...state.items, productId] };
        }),

      removeItem: (productId) =>
        set((state) => ({
          items: state.items.filter((id) => id !== productId),
        })),

      toggleItem: (productId) =>
        set((state) => {
          if (state.items.includes(productId)) {
            return { items: state.items.filter((id) => id !== productId) };
          }
          return { items: [...state.items, productId] };
        }),

      isInWishlist: (productId) => get().items.includes(productId),

      clearWishlist: () => set({ items: [] }),

      count: () => get().items.length,
    }),
    {
      name: 'wishlist-storage',
    }
  )
);
