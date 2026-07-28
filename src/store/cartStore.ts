// store/cartStore.ts

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ProductCategory, ProductSubType, ProductVariant, ProductCustomField, ProductPattern } from '@/lib/config';
import { ensureUniqueCartLineIds } from '@/lib/shop-constants';

// รองรับหลายหมวดหมู่สินค้า
export interface Product {
  id: string;
  name: string;
  type: 'JERSEY' | 'CREW' | 'OTHER'; 
  /** หมวดหมู่หลัก */
  category?: ProductCategory;
  /** ประเภทย่อย */
  subType?: ProductSubType;
  price: number;
  /** ตัวเลือกสินค้า (สำหรับของที่ระลึก) */
  variants?: ProductVariant[];
  /** ฟิลด์เพิ่มเติม (สำหรับค่าย) */
  customFields?: ProductCustomField[];
}

// Interface ของสินค้าในตะกร้า
export interface CartItem extends Product {
  qty: number;
  size: string;
  sleeve?: 'SHORT' | 'LONG'; // เฉพาะ Jersey
  customName?: string;       // เฉพาะ Jersey
  customNumber?: string;     // เฉพาะ Jersey
  total: number;             // ราคารวม
  /** ตัวเลือกสินค้าที่เลือก (สำหรับของที่ระลึก) */
  selectedVariant?: ProductVariant;
  /** ลายสินค้าที่เลือก */
  selectedPattern?: ProductPattern;
  /** ข้อมูลเพิ่มเติมจากฟิลด์กำหนดเอง */
  customFieldValues?: Record<string, string | number>;
  /** Sub-shop slug (undefined = main shop) */
  shopSlug?: string;
  /** Original product ID */
  productId?: string;
}

interface CartState {
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (index: number) => void;
  removeFromCartById: (id: string) => void;
  updateItem: (index: number, item: CartItem) => void;
  clearCart: () => void;
  /** Clear only items belonging to a specific shop (or main shop if shopSlug is undefined) */
  clearCartByShop: (shopSlug?: string) => void;
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

      /** Remove a single line by unique cart line id (does not wipe duplicate products). */
      removeFromCartById: (id: string) => set((state) => ({
        cart: state.cart.filter((item) => item.id !== id),
      })),

      updateItem: (index, newItem) => set((state) => {
        const newCart = [...state.cart];
        newCart[index] = newItem;
        return { cart: newCart };
      }),

      clearCart: () => set({ cart: [] }),

      clearCartByShop: (shopSlug?: string) => set((state) => ({
        cart: state.cart.filter(item => item.shopSlug !== shopSlug),
      })),

      totalAmount: () => get().cart.reduce((sum, item) => sum + item.total, 0),

      setCart: (cart) => set({ cart }),
    }),
    {
      name: 'cart-storage',
      merge: (persisted, current) => {
        const p = persisted as Partial<CartState> | undefined;
        const cart = ensureUniqueCartLineIds((p?.cart || current.cart || []) as CartItem[]);
        return { ...current, ...p, cart };
      },
    }
  )
);