'use client';

/**
 * User-facing SWR Hooks for Shop Page
 * 
 * Provides data fetching for:
 * - Shop config (products, announcements)
 * - User profile
 * - Cart
 * - Order history
 * - Shipping options
 */

import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import { useCallback, useMemo, useEffect } from 'react';
import { fetcher, postFetcher } from './useSWRConfig';

// ============== CACHE KEYS ==============

export const USER_CACHE_KEYS = {
  CONFIG: '/api/config',
  PROFILE: (email: string) => `/api/profile?email=${encodeURIComponent(email)}`,
  CART: (email: string) => `/api/cart?email=${encodeURIComponent(email)}`,
  ORDERS: (email: string) => `/api/orders?email=${encodeURIComponent(email)}`,
  SHIPPING_OPTIONS: '/api/shipping/options',
  PAYMENT_INFO: (ref: string) => `/api/payment-info?ref=${encodeURIComponent(ref)}`,
};

// ============== LOCAL STORAGE HELPERS ==============

const CONFIG_CACHE_KEY = 'psusccshop_config_cache';

function saveConfigCache(config: any) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify({
      ...config,
      cachedAt: Date.now(),
    }));
  } catch {}
}

function loadConfigCache() {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem(CONFIG_CACHE_KEY);
    if (!cached) return null;
    const data = JSON.parse(cached);
    // Use cache if less than 5 minutes old
    if (Date.now() - (data.cachedAt || 0) < 5 * 60 * 1000) {
      return data;
    }
    return null;
  } catch {
    return null;
  }
}

// ============== SHOP CONFIG HOOK ==============

export function useShopConfig() {
  // Load from cache initially
  const cachedConfig = useMemo(() => loadConfigCache(), []);

  const { data, error, isLoading, mutate: revalidate } = useSWR(
    USER_CACHE_KEYS.CONFIG,
    fetcher,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 10000, // 10 seconds
      refreshInterval: 60000, // 1 minute
      fallbackData: cachedConfig ? { status: 'success', data: cachedConfig } : undefined,
      onSuccess: (data) => {
        if (data?.status === 'success' && data.data) {
          saveConfigCache(data.data);
        }
      },
    }
  );

  const config = useMemo(() => {
    return data?.data || data?.config || cachedConfig || null;
  }, [data, cachedConfig]);

  const products = useMemo(() => {
    return config?.products || [];
  }, [config]);

  const announcements = useMemo(() => {
    return config?.announcements || [];
  }, [config]);

  const isShopOpen = useMemo(() => {
    if (!config) return false;
    
    const now = new Date();
    const closeDate = config.closeDate ? new Date(config.closeDate) : null;
    const openDate = config.openDate ? new Date(config.openDate) : null;
    
    // If closeDate is in the past, shop is open
    if (closeDate && closeDate < now) {
      return config.isOpen;
    }
    
    // If openDate is set and in the future, shop is closed
    if (openDate && openDate > now) {
      return false;
    }
    
    return config.isOpen;
  }, [config]);

  return {
    config,
    products,
    announcements,
    isShopOpen,
    isLoading,
    error,
    refresh: () => revalidate(),
  };
}

// ============== USER PROFILE HOOK ==============

export function useUserProfile(email: string | undefined | null) {
  const { data, error, isLoading, mutate: revalidate } = useSWR(
    email ? USER_CACHE_KEYS.PROFILE(email) : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    }
  );

  const { trigger: saveTrigger, isMutating: isSaving } = useSWRMutation(
    email ? '/api/profile' : null,
    async (url, { arg }: { arg: any }) => {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, ...arg }),
      });
      if (!res.ok) throw new Error('Failed to save profile');
      return res.json();
    }
  );

  const profile = useMemo(() => {
    const p = data?.data?.profile || data?.profile || null;
    return p;
  }, [data]);

  const saveProfile = useCallback(async (profileData: {
    name?: string;
    phone?: string;
    address?: string;
    instagram?: string;
  }) => {
    await saveTrigger(profileData);
    await revalidate();
  }, [saveTrigger, revalidate]);

  return {
    profile,
    isLoading,
    isSaving,
    error,
    saveProfile,
    refresh: () => revalidate(),
  };
}

// ============== USER CART HOOK ==============

export function useUserCart(email: string | undefined | null) {
  const { data, error, isLoading, mutate: revalidate } = useSWR(
    email ? USER_CACHE_KEYS.CART(email) : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
    }
  );

  const { trigger: saveTrigger, isMutating: isSaving } = useSWRMutation(
    email ? '/api/cart' : null,
    async (url, { arg }: { arg: any[] }) => {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, cart: arg }),
      });
      if (!res.ok) throw new Error('Failed to save cart');
      return res.json();
    }
  );

  const cart = useMemo(() => {
    return data?.data?.cart || data?.cart || [];
  }, [data]);

  const saveCart = useCallback(async (cartItems: any[]) => {
    // Optimistic update
    revalidate(
      { data: { cart: cartItems } },
      { revalidate: false }
    );
    
    try {
      await saveTrigger(cartItems);
    } catch (err) {
      // Rollback on error
      await revalidate();
      throw err;
    }
  }, [saveTrigger, revalidate]);

  return {
    cart,
    isLoading,
    isSaving,
    error,
    saveCart,
    refresh: () => revalidate(),
  };
}

// ============== USER ORDERS HOOK ==============

export function useUserOrderHistory(email: string | undefined | null) {
  const { data, error, isLoading, mutate: revalidate } = useSWR(
    email ? USER_CACHE_KEYS.ORDERS(email) : null,
    fetcher,
    {
      revalidateOnFocus: true,
      dedupingInterval: 10000,
      refreshInterval: 60000, // Refresh every minute
    }
  );

  const orders = useMemo(() => {
    return data?.data?.orders || data?.orders || [];
  }, [data]);

  return {
    orders,
    isLoading,
    error,
    refresh: () => revalidate(),
  };
}

// ============== SHIPPING OPTIONS HOOK ==============

export function useShippingOptionsUser() {
  const { data, error, isLoading } = useSWR(
    USER_CACHE_KEYS.SHIPPING_OPTIONS,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // 1 minute
    }
  );

  const options = useMemo(() => {
    return data?.data || data?.options || [];
  }, [data]);

  return {
    options,
    isLoading,
    error,
  };
}

// ============== PAYMENT INFO HOOK ==============

export function usePaymentInfoUser(ref: string | undefined | null) {
  const { data, error, isLoading, mutate: revalidate } = useSWR(
    ref ? USER_CACHE_KEYS.PAYMENT_INFO(ref) : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    }
  );

  const paymentInfo = useMemo(() => {
    return data?.data || null;
  }, [data]);

  return {
    paymentInfo,
    isLoading,
    error,
    refresh: () => revalidate(),
  };
}

// ============== SUBMIT ORDER MUTATION ==============

export function useSubmitOrder() {
  const { trigger, isMutating, error } = useSWRMutation(
    '/api/orders',
    async (url, { arg }: { arg: any }) => {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(arg),
      });
      
      const data = await res.json();
      
      if (!res.ok || data.status !== 'success') {
        throw new Error(data.message || 'Failed to submit order');
      }
      
      return data;
    }
  );

  const submitOrder = useCallback(async (orderData: {
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
  }) => {
    return trigger(orderData);
  }, [trigger]);

  return {
    submitOrder,
    isSubmitting: isMutating,
    error,
  };
}

export default useShopConfig;
