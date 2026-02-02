'use client';

/**
 * SWR Hooks for Main Shop Page (page.tsx)
 * 
 * Provides data fetching with caching, revalidation, and offline support
 * for the main storefront page.
 */

import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import { useCallback, useEffect, useMemo } from 'react';
import { fetcher, postFetcher } from './useSWRConfig';

// ============== CACHE KEYS ==============

export const PAGE_CACHE_KEYS = {
  CONFIG: '/api/config',
  PROFILE: (email: string) => `/api/profile?email=${encodeURIComponent(email)}`,
  CART: (email: string) => `/api/cart?email=${encodeURIComponent(email)}`,
  ORDERS: (email: string) => `/api/orders?email=${encodeURIComponent(email)}`,
  SHIPPING: '/api/shipping/options',
};

// ============== LOCAL STORAGE CACHE ==============

const CACHE_KEY = 'scc_shop_cache_v2';
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

interface CachedData {
  config?: any;
  timestamp?: number;
}

function loadLocalCache(): CachedData | null {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    const data = JSON.parse(cached);
    // Check if cache is still valid
    if (data.timestamp && Date.now() - data.timestamp < CACHE_EXPIRY) {
      return data;
    }
  } catch {}
  return null;
}

function saveLocalCache(data: CachedData): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      ...data,
      timestamp: Date.now(),
    }));
  } catch {}
}

// ============== SHOP CONFIG HOOK ==============

interface ShopConfig {
  isOpen: boolean;
  closeDate?: string;
  openDate?: string;
  products?: any[];
  announcements?: any[];
  announcementHistory?: any[];
  [key: string]: any;
}

export function usePageConfig() {
  // Load from local cache first
  const cached = useMemo(() => loadLocalCache(), []);
  
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    PAGE_CACHE_KEYS.CONFIG,
    fetcher,
    {
      // Use cached data as fallback
      fallbackData: cached?.config ? { status: 'success', config: cached.config } : undefined,
      // Revalidate in background
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      // Keep data fresh
      refreshInterval: 60000, // 1 minute
      dedupingInterval: 5000,
      // Error retry
      errorRetryCount: 3,
      errorRetryInterval: 5000,
      // Keep previous data while revalidating
      keepPreviousData: true,
    }
  );

  // Extract config from response
  const config: ShopConfig | null = useMemo(() => {
    const cfg = data?.config || data?.data;
    if (cfg) {
      // Cache to localStorage for offline access
      saveLocalCache({ config: cfg });
    }
    return cfg || null;
  }, [data]);

  // Derived state
  const products = useMemo(() => config?.products || [], [config]);
  const announcements = useMemo(() => config?.announcements || [], [config]);
  const announcementHistory = useMemo(() => config?.announcementHistory || [], [config]);
  
  // Calculate shop open status
  const isShopOpen = useMemo(() => {
    if (!config) return false;
    if (!config.isOpen) return false;
    
    const now = new Date();
    if (config.closeDate && new Date(config.closeDate) < now) return false;
    if (config.openDate && new Date(config.openDate) > now) return false;
    
    return true;
  }, [config]);

  return {
    config,
    products,
    announcements,
    announcementHistory,
    isShopOpen,
    isLoading: isLoading && !cached?.config,
    isValidating,
    error,
    refresh: () => mutate(),
    mutate,
  };
}

// ============== SHIPPING CONFIG HOOK ==============

interface ShippingConfig {
  options?: any[];
  [key: string]: any;
}

export function usePageShipping() {
  const { data, error, isLoading, mutate } = useSWR<ShippingConfig>(
    PAGE_CACHE_KEYS.SHIPPING,
    fetcher,
    {
      revalidateOnFocus: false,
      refreshInterval: 5 * 60 * 1000, // 5 minutes
      dedupingInterval: 30000,
    }
  );

  return {
    shippingConfig: data || null,
    shippingOptions: data?.options || [],
    isLoading,
    error,
    refresh: () => mutate(),
  };
}

// ============== USER PROFILE HOOK ==============

interface UserProfile {
  name?: string;
  phone?: string;
  address?: string;
  instagram?: string;
}

export function usePageProfile(email: string | undefined | null) {
  const { data, error, isLoading, mutate } = useSWR(
    email ? PAGE_CACHE_KEYS.PROFILE(email) : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 10000,
    }
  );

  const profile: UserProfile | null = useMemo(() => {
    return data?.data?.profile || data?.profile || null;
  }, [data]);

  const { trigger: updateProfile, isMutating: isUpdating } = useSWRMutation(
    '/api/profile',
    async (url, { arg }: { arg: { email: string; profile: Partial<UserProfile> } }) => {
      return postFetcher(url, { arg });
    }
  );

  const saveProfile = useCallback(async (profileData: Partial<UserProfile>) => {
    if (!email) return;
    await updateProfile({ email, profile: profileData });
    mutate();
  }, [email, updateProfile, mutate]);

  return {
    profile,
    isLoading,
    error,
    isUpdating,
    saveProfile,
    refresh: () => mutate(),
  };
}

// ============== USER CART HOOK ==============

interface CartItem {
  id: string;
  productId: string;
  name?: string;
  size?: string;
  quantity: number;
  price: number;
  [key: string]: any;
}

export function usePageCart(email: string | undefined | null) {
  const { data, error, isLoading, mutate } = useSWR(
    email ? PAGE_CACHE_KEYS.CART(email) : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
    }
  );

  const cart: CartItem[] = useMemo(() => {
    return data?.data?.cart || data?.cart || [];
  }, [data]);

  const { trigger: saveCartTrigger, isMutating: isSaving } = useSWRMutation(
    '/api/cart',
    async (url, { arg }: { arg: { email: string; cart: CartItem[] } }) => {
      return postFetcher(url, { arg });
    }
  );

  const saveCart = useCallback(async (newCart: CartItem[]) => {
    if (!email) return;
    
    // Optimistic update
    mutate({ data: { cart: newCart } }, false);
    
    try {
      await saveCartTrigger({ email, cart: newCart });
      mutate();
    } catch (err) {
      // Revert on error
      mutate();
      throw err;
    }
  }, [email, saveCartTrigger, mutate]);

  return {
    cart,
    isLoading,
    error,
    isSaving,
    saveCart,
    refresh: () => mutate(),
  };
}

// ============== ORDER HISTORY HOOK ==============

interface OrderHistory {
  ref: string;
  status: string;
  date: string;
  total?: number;
  cart?: any[];
  items?: any[];
  [key: string]: any;
}

export function usePageOrderHistory(email: string | undefined | null) {
  const { data, error, isLoading, mutate } = useSWR(
    email ? PAGE_CACHE_KEYS.ORDERS(email) : null,
    fetcher,
    {
      revalidateOnFocus: true,
      refreshInterval: 30000, // 30 seconds
      dedupingInterval: 10000,
    }
  );

  const orders: OrderHistory[] = useMemo(() => {
    const orderData = data?.data?.orders || data?.orders || [];
    // Sort by date descending
    return [...orderData].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [data]);

  return {
    orders,
    isLoading,
    error,
    refresh: () => mutate(),
    mutate,
  };
}

// ============== SUBMIT ORDER HOOK ==============

interface SubmitOrderData {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  customerInstagram: string;
  cart: any[];
  totalAmount: number;
  turnstileToken?: string;
  shippingOptionId?: string;
  paymentOptionId?: string;
  shippingFee?: number;
}

export function usePageSubmitOrder() {
  const { trigger, isMutating: isSubmitting, error, reset } = useSWRMutation(
    '/api/orders',
    async (url, { arg }: { arg: SubmitOrderData }) => {
      return postFetcher(url, { arg });
    }
  );

  const submitOrder = useCallback(async (data: SubmitOrderData) => {
    const result = await trigger(data);
    return result;
  }, [trigger]);

  return {
    submitOrder,
    isSubmitting,
    error,
    reset,
  };
}

// ============== COMBINED SHOP DATA HOOK ==============

/**
 * Combined hook for all shop page data
 * Use this for a single-call pattern
 */
export function useShopPageData(email: string | undefined | null) {
  const configData = usePageConfig();
  const shippingData = usePageShipping();
  const profileData = usePageProfile(email);
  const cartData = usePageCart(email);
  const ordersData = usePageOrderHistory(email);
  
  const isInitialLoading = configData.isLoading || 
    (email && (profileData.isLoading || cartData.isLoading));
  
  const refreshAll = useCallback(() => {
    configData.refresh();
    shippingData.refresh();
    if (email) {
      profileData.refresh();
      cartData.refresh();
      ordersData.refresh();
    }
  }, [configData, shippingData, profileData, cartData, ordersData, email]);

  return {
    // Config
    config: configData.config,
    products: configData.products,
    announcements: configData.announcements,
    isShopOpen: configData.isShopOpen,
    configLoading: configData.isLoading,
    
    // Shipping
    shippingConfig: shippingData.shippingConfig,
    shippingOptions: shippingData.shippingOptions,
    
    // Profile
    profile: profileData.profile,
    profileLoading: profileData.isLoading,
    saveProfile: profileData.saveProfile,
    
    // Cart
    cart: cartData.cart,
    cartLoading: cartData.isLoading,
    saveCart: cartData.saveCart,
    
    // Orders
    orders: ordersData.orders,
    ordersLoading: ordersData.isLoading,
    
    // Combined
    isInitialLoading,
    refreshAll,
  };
}

export default {
  usePageConfig,
  usePageShipping,
  usePageProfile,
  usePageCart,
  usePageOrderHistory,
  usePageSubmitOrder,
  useShopPageData,
};
