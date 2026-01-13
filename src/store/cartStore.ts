import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type Product = {
  id: string;
  name: string;
  type: 'JERSEY' | 'CREW';
  price: number;
};

export type CartItem = Product & {
  qty: number;
  size: string;
  sleeve?: 'SHORT' | 'LONG';
  customName?: string;
  customNumber?: string;
  total: number;
};

type CartState = {
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (index: number) => void;
  clearCart: () => void;
  setCart: (cart: CartItem[]) => void;
  totalAmount: () => number;
};

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      cart: [],
      addToCart: (item) => set((state) => ({ cart: [...state.cart, item] })),
      removeFromCart: (index) => set((state) => ({ cart: state.cart.filter((_, i) => i !== index) })),
      clearCart: () => set({ cart: [] }),
      setCart: (newCart) => set({ cart: newCart }),
      totalAmount: () => get().cart.reduce((sum, item) => sum + item.total, 0),
    }),
    {
      name: 'cs-shop-cart',
      storage: createJSONStorage(() => localStorage),
    }
  )
);