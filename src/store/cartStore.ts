// store/cartStore.ts

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ✅ แก้ไข: เพิ่ม 'OTHER' เข้าไปใน type
export interface Product {
  id: string;
  name: string;
  type: 'JERSEY' | 'CREW' | 'OTHER'; 
  price: number;
}

// Interface ของสินค้าในตะกร้า
export interface CartItem extends Product {
  qty: number;
  size: string;
  sleeve?: 'SHORT' | 'LONG'; // เฉพาะ Jersey
  customName?: string;       // เฉพาะ Jersey
  customNumber?: string;     // เฉพาะ Jersey
  total: number;             // ราคารวม
}

interface CartState {
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (index: number) => void;
  updateItem: (index: number, item: CartItem) => void;
  clearCart: () => void;
  totalAmount: () => number;
  setCart: (cart: CartItem[]) => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      cart: [],

      addToCart: (item) => set((state) => ({ cart: [...state.cart, item] })),

      removeFromCart: (index) => set((state) => ({ 
        cart: state.cart.filter((_, i) => i !== index) 
      })),

      updateItem: (index, newItem) => set((state) => {
        const newCart = [...state.cart];
        newCart[index] = newItem;
        return { cart: newCart };
      }),

      clearCart: () => set({ cart: [] }),

      totalAmount: () => get().cart.reduce((sum, item) => sum + item.total, 0),

      setCart: (cart) => set({ cart }),
    }),
    {
      name: 'cart-storage', 
    }
  )
);