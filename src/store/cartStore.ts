// store/cartStore.ts

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ProductCategory, ProductSubType, ProductVariant, ProductCustomField } from '@/lib/config';

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
  /** ข้อมูลเพิ่มเติมจากฟิลด์กำหนดเอง */
  customFieldValues?: Record<string, string | number>;
  /** Sub-shop slug (undefined = main shop) */
  shopSlug?: string;
}

interface CartState {
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (index: number) => void;
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
    }
  )
);