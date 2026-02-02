'use client';

/**
 * Admin Data Hooks with SWR
 * 
 * Standard data fetching patterns:
 * - Automatic caching and revalidation
 * - Optimistic updates
 * - Request deduplication
 * - Error handling
 * - Loading states
 */

import useSWR, { mutate, useSWRConfig } from 'swr';
import useSWRMutation from 'swr/mutation';
import { useCallback, useMemo, useEffect, useRef } from 'react';
import { fetcher, postFetcher } from './useSWRConfig';

// ============== TYPES ==============

export interface AdminOrder {
  ref: string;
  date: string;
  status: string;
  amount: number;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  cart: any[];
  slip?: any;
  trackingNumber?: string;
  raw?: any;
}

export interface ShopConfig {
  shopStatus: string;
  shopName: string;
  adminEmails: string[];
  products: any[];
  paymentMethods: any[];
  shippingOptions: any[];
  [key: string]: any;
}

export interface AdminDataResponse {
  status: string;
  data?: {
    orders: any[];
    config: ShopConfig;
    logs: any[];
  };
}

// ============== CACHE KEYS ==============

export const CACHE_KEYS = {
  ADMIN_DATA: '/api/admin/data',
  CONFIG: '/api/config',
  ORDERS: (email: string) => `/api/orders?email=${encodeURIComponent(email)}`,
  PROFILE: (email: string) => `/api/profile?email=${encodeURIComponent(email)}`,
  CART: (email: string) => `/api/cart?email=${encodeURIComponent(email)}`,
  PAYMENT_INFO: (ref: string) => `/api/payment-info?ref=${encodeURIComponent(ref)}`,
  SHIPPING_OPTIONS: '/api/shipping/options',
};

// ============== ADMIN DATA HOOK ==============

interface UseAdminDataOptions {
  enabled?: boolean;
  refreshInterval?: number;
  onSuccess?: (data: any) => void;
  onError?: (error: any) => void;
}

export function useAdminData(options: UseAdminDataOptions = {}) {
  const { 
    enabled = true, 
    refreshInterval = 0,
    onSuccess,
    onError,
  } = options;

  const { data, error, isLoading, isValidating, mutate: revalidate } = useSWR<AdminDataResponse>(
    enabled ? CACHE_KEYS.ADMIN_DATA : null,
    fetcher,
    {
      refreshInterval,
      revalidateOnMount: true,
      onSuccess: (data) => {
        if (data?.status === 'success') {
          // Save to localStorage as backup
          try {
            localStorage.setItem('admin_cache', JSON.stringify({
              timestamp: Date.now(),
              data: data.data,
            }));
          } catch {}
        }
        onSuccess?.(data);
      },
      onError: (err) => {
        // Try to load from localStorage on error
        console.warn('[useAdminData] Error, attempting to load from cache');
        onError?.(err);
      },
      // Use localStorage as fallback
      fallbackData: (() => {
        if (typeof window === 'undefined') return undefined;
        try {
          const cached = localStorage.getItem('admin_cache');
          if (cached) {
            const { data, timestamp } = JSON.parse(cached);
            // Use cache if less than 5 minutes old
            if (Date.now() - timestamp < 5 * 60 * 1000) {
              return { status: 'success', data };
            }
          }
        } catch {}
        return undefined;
      })(),
    }
  );

  // Extract data parts
  const orders = useMemo(() => {
    return data?.data?.orders || [];
  }, [data]);

  const config = useMemo(() => {
    return data?.data?.config || null;
  }, [data]);

  const logs = useMemo(() => {
    return data?.data?.logs || [];
  }, [data]);

  // Network status
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  const isOffline = !isOnline;

  return {
    // Data
    orders,
    config,
    logs,
    rawData: data,
    
    // States
    isLoading,
    isValidating, // Background revalidation
    isRefreshing: isValidating && !isLoading,
    error,
    isOffline,
    
    // Actions
    refresh: () => revalidate(),
    mutate: revalidate,
  };
}

// ============== ORDER STATUS MUTATION ==============

export function useUpdateOrderStatus() {
  const { mutate: globalMutate } = useSWRConfig();

  const { trigger, isMutating, error } = useSWRMutation(
    '/api/admin/status',
    async (url, { arg }: { arg: { ref: string; status: string; adminEmail: string; trackingNumber?: string } }) => {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(arg),
      });
      
      if (!res.ok) {
        throw new Error('Failed to update status');
      }
      
      return res.json();
    }
  );

  const updateStatus = useCallback(async (
    ref: string, 
    status: string, 
    adminEmail: string,
    options?: { trackingNumber?: string; optimistic?: boolean }
  ) => {
    const { trackingNumber, optimistic = true } = options || {};

    if (optimistic) {
      // Optimistic update - update UI immediately
      await globalMutate(
        CACHE_KEYS.ADMIN_DATA,
        async (currentData: AdminDataResponse | undefined) => {
          // Make the actual API call
          await trigger({ ref, status, adminEmail, trackingNumber });
          
          // Return updated data
          if (!currentData?.data) return currentData;
          
          return {
            ...currentData,
            data: {
              ...currentData.data,
              orders: currentData.data.orders.map((o: any) =>
                o.ref === ref ? { ...o, status, trackingNumber: trackingNumber || o.trackingNumber } : o
              ),
            },
          };
        },
        {
          // Optimistic data shown immediately
          optimisticData: (currentData: AdminDataResponse | undefined) => {
            if (!currentData?.data) return currentData as AdminDataResponse;
            return {
              ...currentData,
              data: {
                ...currentData.data,
                orders: currentData.data.orders.map((o: any) =>
                  o.ref === ref ? { ...o, status, trackingNumber: trackingNumber || o.trackingNumber } : o
                ),
              },
            };
          },
          rollbackOnError: true,
          revalidate: false, // Don't revalidate since we already have the updated data
        }
      );
    } else {
      // Non-optimistic - wait for server response
      await trigger({ ref, status, adminEmail, trackingNumber });
      await globalMutate(CACHE_KEYS.ADMIN_DATA);
    }
  }, [trigger, globalMutate]);

  return {
    updateStatus,
    isUpdating: isMutating,
    error,
  };
}

// ============== CONFIG MUTATION ==============

export function useUpdateConfig() {
  const { mutate: globalMutate } = useSWRConfig();

  const { trigger, isMutating, error } = useSWRMutation(
    '/api/config',
    postFetcher
  );

  const updateConfig = useCallback(async (
    config: Partial<ShopConfig>,
    adminEmail: string,
    options?: { optimistic?: boolean }
  ) => {
    const { optimistic = true } = options || {};

    if (optimistic) {
      await globalMutate(
        CACHE_KEYS.ADMIN_DATA,
        async (currentData: AdminDataResponse | undefined) => {
          await trigger({ config, adminEmail });
          
          if (!currentData?.data) return currentData;
          
          return {
            ...currentData,
            data: {
              ...currentData.data,
              config: { ...currentData.data.config, ...config },
            },
          };
        },
        {
          optimisticData: (currentData: AdminDataResponse | undefined) => {
            if (!currentData?.data) return currentData as AdminDataResponse;
            return {
              ...currentData,
              data: {
                ...currentData.data,
                config: { ...currentData.data.config, ...config },
              },
            };
          },
          rollbackOnError: true,
          revalidate: false,
        }
      );
    } else {
      await trigger({ config, adminEmail });
      await globalMutate(CACHE_KEYS.ADMIN_DATA);
    }
  }, [trigger, globalMutate]);

  return {
    updateConfig,
    isUpdating: isMutating,
    error,
  };
}

// ============== USER ORDERS HOOK ==============

export function useUserOrders(email: string | undefined | null) {
  const { data, error, isLoading, mutate: revalidate } = useSWR(
    email ? CACHE_KEYS.ORDERS(email) : null,
    fetcher,
    {
      revalidateOnFocus: true,
      dedupingInterval: 5000,
    }
  );

  return {
    orders: data?.data || [],
    isLoading,
    error,
    refresh: () => revalidate(),
  };
}

// ============== PROFILE HOOK ==============

export function useProfile(email: string | undefined | null) {
  const { data, error, isLoading, mutate: revalidate } = useSWR(
    email ? CACHE_KEYS.PROFILE(email) : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 10000,
    }
  );

  return {
    profile: data?.data || null,
    isLoading,
    error,
    refresh: () => revalidate(),
    mutate: revalidate,
  };
}

// ============== CART HOOK ==============

export function useCart(email: string | undefined | null) {
  const { mutate: globalMutate } = useSWRConfig();
  
  const { data, error, isLoading, mutate: revalidate } = useSWR(
    email ? CACHE_KEYS.CART(email) : null,
    fetcher,
    {
      revalidateOnFocus: false,
    }
  );

  const saveCart = useCallback(async (cart: any[]) => {
    if (!email) return;
    
    await globalMutate(
      CACHE_KEYS.CART(email),
      async () => {
        const res = await fetch('/api/cart', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, cart }),
        });
        return res.json();
      },
      {
        optimisticData: { status: 'success', data: { cart } },
        rollbackOnError: true,
      }
    );
  }, [email, globalMutate]);

  return {
    cart: data?.data?.cart || [],
    isLoading,
    error,
    saveCart,
    refresh: () => revalidate(),
  };
}

// ============== PAYMENT INFO HOOK ==============

export function usePaymentInfo(ref: string | undefined | null) {
  const { data, error, isLoading } = useSWR(
    ref ? CACHE_KEYS.PAYMENT_INFO(ref) : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000, // Payment info doesn't change often
    }
  );

  return {
    paymentInfo: data?.data || null,
    isLoading,
    error,
  };
}

// ============== SHIPPING OPTIONS HOOK ==============

export function useShippingOptions() {
  const { data, error, isLoading, mutate: revalidate } = useSWR(
    CACHE_KEYS.SHIPPING_OPTIONS,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // 1 minute
    }
  );

  return {
    shippingOptions: data?.data || data?.options || [],
    isLoading,
    error,
    refresh: () => revalidate(),
  };
}

// ============== DELETE ORDER MUTATION ==============

export function useDeleteOrder() {
  const { mutate: globalMutate } = useSWRConfig();

  const deleteOrder = useCallback(async (
    ref: string,
    hard: boolean = false
  ) => {
    // Optimistic update
    await globalMutate(
      CACHE_KEYS.ADMIN_DATA,
      async (currentData: AdminDataResponse | undefined) => {
        // Make API call
        const res = await fetch(`/api/orders?ref=${encodeURIComponent(ref)}${hard ? '&hard=true' : ''}`, {
          method: 'DELETE',
        });
        
        if (!res.ok) {
          throw new Error('Failed to delete order');
        }
        
        if (!currentData?.data) return currentData;
        
        return {
          ...currentData,
          data: {
            ...currentData.data,
            orders: hard 
              ? currentData.data.orders.filter((o: any) => o.ref !== ref)
              : currentData.data.orders.map((o: any) =>
                  o.ref === ref ? { ...o, status: 'CANCELLED' } : o
                ),
          },
        };
      },
      {
        optimisticData: (currentData: AdminDataResponse | undefined) => {
          if (!currentData?.data) return currentData as AdminDataResponse;
          return {
            ...currentData,
            data: {
              ...currentData.data,
              orders: hard
                ? currentData.data.orders.filter((o: any) => o.ref !== ref)
                : currentData.data.orders.map((o: any) =>
                    o.ref === ref ? { ...o, status: 'CANCELLED' } : o
                  ),
            },
          };
        },
        rollbackOnError: true,
        revalidate: false,
      }
    );
  }, [globalMutate]);

  return { deleteOrder };
}

// ============== UPDATE ORDER MUTATION ==============

export function useUpdateOrder() {
  const { mutate: globalMutate } = useSWRConfig();

  const updateOrder = useCallback(async (
    ref: string,
    data: any,
    adminEmail: string
  ) => {
    await globalMutate(
      CACHE_KEYS.ADMIN_DATA,
      async (currentData: AdminDataResponse | undefined) => {
        const res = await fetch('/api/orders', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ref, data, adminEmail }),
        });
        
        if (!res.ok) {
          throw new Error('Failed to update order');
        }
        
        if (!currentData?.data) return currentData;
        
        return {
          ...currentData,
          data: {
            ...currentData.data,
            orders: currentData.data.orders.map((o: any) =>
              o.ref === ref ? { ...o, ...data } : o
            ),
          },
        };
      },
      {
        optimisticData: (currentData: AdminDataResponse | undefined) => {
          if (!currentData?.data) return currentData as AdminDataResponse;
          return {
            ...currentData,
            data: {
              ...currentData.data,
              orders: currentData.data.orders.map((o: any) =>
                o.ref === ref ? { ...o, ...data } : o
              ),
            },
          };
        },
        rollbackOnError: true,
        revalidate: false,
      }
    );
  }, [globalMutate]);

  return { updateOrder };
}

// ============== BATCH UPDATE STATUS ==============

export function useBatchUpdateStatus() {
  const { mutate: globalMutate } = useSWRConfig();

  const batchUpdateStatus = useCallback(async (
    refs: string[],
    status: string,
    adminEmail: string
  ) => {
    // Optimistic update first
    await globalMutate(
      CACHE_KEYS.ADMIN_DATA,
      async (currentData: AdminDataResponse | undefined) => {
        // Make all API calls in parallel
        await Promise.all(
          refs.map(ref =>
            fetch('/api/admin/status', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ref, status, adminEmail }),
            })
          )
        );
        
        if (!currentData?.data) return currentData;
        
        const refSet = new Set(refs);
        return {
          ...currentData,
          data: {
            ...currentData.data,
            orders: currentData.data.orders.map((o: any) =>
              refSet.has(o.ref) ? { ...o, status } : o
            ),
          },
        };
      },
      {
        optimisticData: (currentData: AdminDataResponse | undefined) => {
          if (!currentData?.data) return currentData as AdminDataResponse;
          const refSet = new Set(refs);
          return {
            ...currentData,
            data: {
              ...currentData.data,
              orders: currentData.data.orders.map((o: any) =>
                refSet.has(o.ref) ? { ...o, status } : o
              ),
            },
          };
        },
        rollbackOnError: true,
        revalidate: false,
      }
    );
  }, [globalMutate]);

  return { batchUpdateStatus };
}

// ============== SYNC SHEET MUTATION ==============

export function useSyncSheet() {
  const { trigger, isMutating, error } = useSWRMutation(
    '/api/admin/sheet',
    async (url, { arg }: { arg: { mode: string; sheetId?: string; vendorSheetId?: string } }) => {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(arg),
      });
      if (!res.ok) throw new Error('Failed to sync sheet');
      return res.json();
    }
  );

  const syncSheet = useCallback(async (
    mode: 'sync' | 'factory',
    options?: { sheetId?: string; vendorSheetId?: string }
  ) => {
    return trigger({ mode, ...options });
  }, [trigger]);

  return {
    syncSheet,
    isSyncing: isMutating,
    error,
  };
}

// ============== LOCAL STORAGE CACHE HELPERS ==============

const ADMIN_CACHE_KEY = 'psusccshop_admin_cache_v2';

export function saveAdminCacheSWR(data: { config?: any; orders?: any[]; logs?: any[] }) {
  if (typeof window === 'undefined') return;
  try {
    const existing = loadAdminCacheSWR() || {};
    const merged = {
      ...existing,
      ...data,
      timestamp: Date.now(),
    };
    localStorage.setItem(ADMIN_CACHE_KEY, JSON.stringify(merged));
  } catch (e) {
    console.warn('[Cache] Failed to save:', e);
  }
}

export function loadAdminCacheSWR(): { config?: any; orders?: any[]; logs?: any[]; timestamp?: number } | null {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem(ADMIN_CACHE_KEY);
    if (!cached) return null;
    return JSON.parse(cached);
  } catch {
    return null;
  }
}

export function clearAdminCacheSWR() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(ADMIN_CACHE_KEY);
  } catch {}
}

// ============== GLOBAL MUTATE HELPERS ==============

/**
 * Invalidate all admin data caches
 */
export function invalidateAdminData() {
  mutate(CACHE_KEYS.ADMIN_DATA);
}

/**
 * Invalidate specific order data
 */
export function invalidateOrder(email: string) {
  mutate(CACHE_KEYS.ORDERS(email));
}

/**
 * Invalidate all caches
 */
export function invalidateAll() {
  mutate(() => true, undefined, { revalidate: true });
}

/**
 * Update order in cache without API call (for realtime updates)
 */
export function updateOrderInCache(order: any) {
  mutate(
    CACHE_KEYS.ADMIN_DATA,
    (currentData: AdminDataResponse | undefined) => {
      if (!currentData?.data) return currentData;
      
      const existingIndex = currentData.data.orders.findIndex(
        (o: any) => o.ref === order.ref
      );
      
      if (existingIndex >= 0) {
        // Update existing
        const orders = [...currentData.data.orders];
        orders[existingIndex] = { ...orders[existingIndex], ...order };
        return {
          ...currentData,
          data: { ...currentData.data, orders },
        };
      } else {
        // Add new
        return {
          ...currentData,
          data: {
            ...currentData.data,
            orders: [order, ...currentData.data.orders],
          },
        };
      }
    },
    { revalidate: false }
  );
}

/**
 * Remove order from cache (for realtime deletes)
 */
export function removeOrderFromCache(ref: string) {
  mutate(
    CACHE_KEYS.ADMIN_DATA,
    (currentData: AdminDataResponse | undefined) => {
      if (!currentData?.data) return currentData;
      return {
        ...currentData,
        data: {
          ...currentData.data,
          orders: currentData.data.orders.filter((o: any) => o.ref !== ref),
        },
      };
    },
    { revalidate: false }
  );
}

export default useAdminData;
