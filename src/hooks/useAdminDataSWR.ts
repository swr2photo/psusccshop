'use client';

/**
 * Admin Page Data Integration with SWR + Realtime
 * 
 * Optimized for fast initial load + instant realtime updates:
 * - SWR handles initial fetch, caching, dedup, background revalidation
 * - Realtime provides instant updates via Supabase postgres_changes
 * - SWR polling is reduced to safety-net level when realtime is active
 * - Realtime events update SWR cache directly for consistency
 */

import { useCallback, useEffect, useRef } from 'react';
import useSWR from 'swr';
import { CACHE_KEYS } from './useAdminData';

// Admin-specific fetcher with cache-busting for always-fresh data
const adminFetcher = async (url: string) => {
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store',
      'Pragma': 'no-cache',
    },
  });
  if (!res.ok) {
    const error = new Error('Admin data fetch failed');
    (error as any).status = res.status;
    throw error;
  }
  return res.json();
};

interface AdminDataRaw {
  status: string;
  data?: {
    orders?: any[];
    config?: any;
    logs?: any[];
  };
}

interface UseAdminDataSWROptions {
  enabled: boolean;
  onDataReceived: (data: { orders: any[]; config: any; logs: any[] }) => void;
  onError?: (error: any) => void;
  onLoadingChange?: (loading: boolean) => void;
  realtimeConnected?: boolean;
}

/**
 * SWR-powered data fetching for admin page with realtime-aware polling
 */
export function useAdminDataSWR(options: UseAdminDataSWROptions) {
  const { 
    enabled, 
    onDataReceived, 
    onError, 
    onLoadingChange,
    realtimeConnected = false,
  } = options;

  const initialLoadDone = useRef(false);
  const onDataReceivedRef = useRef(onDataReceived);
  const onErrorRef = useRef(onError);
  const onLoadingChangeRef = useRef(onLoadingChange);

  // Keep refs updated without triggering re-renders
  useEffect(() => { onDataReceivedRef.current = onDataReceived; }, [onDataReceived]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);
  useEffect(() => { onLoadingChangeRef.current = onLoadingChange; }, [onLoadingChange]);

  // SWR fetch with dynamic refresh interval based on realtime status
  const { 
    data, 
    error, 
    isLoading, 
    isValidating, 
    mutate 
  } = useSWR<AdminDataRaw>(
    enabled ? CACHE_KEYS.ADMIN_DATA : null,
    adminFetcher,
    {
      // Revalidation triggers
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      revalidateIfStale: true,
      
      // Dynamic polling: when realtime is active, SWR is just a safety net
      // 120s with realtime (backup sync), 15s without (primary polling)
      refreshInterval: realtimeConnected ? 120_000 : 15_000,
      
      // Deduplication: prevent duplicate requests within 3s
      dedupingInterval: 3000,
      
      // Error handling
      errorRetryCount: 3,
      errorRetryInterval: 3000,
      
      // Keep stale data visible during revalidation
      keepPreviousData: true,
      suspense: false,
      
      // Use localStorage as instant-display fallback
      fallbackData: (() => {
        if (typeof window === 'undefined') return undefined;
        try {
          // Try primary admin cache first
          const cached = localStorage.getItem('psusccshop-admin-cache');
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed?.config) {
              return { status: 'success', data: parsed } as AdminDataRaw;
            }
          }
        } catch {}
        return undefined;
      })(),
    }
  );

  // Handle data updates — push to admin page state
  useEffect(() => {
    if (data?.status === 'success' && data.data) {
      onDataReceivedRef.current({
        orders: data.data.orders || [],
        config: data.data.config || {},
        logs: data.data.logs || [],
      });
      initialLoadDone.current = true;
    }
  }, [data]);

  // Handle errors
  useEffect(() => {
    if (error && onErrorRef.current) {
      onErrorRef.current(error);
    }
  }, [error]);

  // Handle loading state — only show spinner on true initial load
  useEffect(() => {
    if (onLoadingChangeRef.current) {
      const showLoading = isLoading && !initialLoadDone.current && !data;
      onLoadingChangeRef.current(showLoading);
    }
  }, [isLoading, data]);

  // Manual refresh
  const refresh = useCallback(async (options?: { silent?: boolean }) => {
    await mutate();
  }, [mutate]);

  // Invalidate and refetch from server
  const invalidate = useCallback(() => {
    mutate(undefined, { revalidate: true });
  }, [mutate]);

  // Update SWR cache with realtime order change (no network request)
  const applyRealtimeOrderChange = useCallback((change: {
    type: 'INSERT' | 'UPDATE' | 'DELETE';
    order?: any;
    oldOrder?: any;
  }) => {
    mutate((current) => {
      if (!current?.data?.orders) return current;
      
      let nextOrders = [...current.data.orders];
      
      if (change.type === 'UPDATE' && change.order) {
        const idx = nextOrders.findIndex(o => o.ref === change.order.ref);
        if (idx >= 0) {
          nextOrders[idx] = { ...nextOrders[idx], ...change.order };
        }
      } else if (change.type === 'INSERT' && change.order) {
        if (!nextOrders.some(o => o.ref === change.order.ref)) {
          nextOrders = [change.order, ...nextOrders];
        }
      } else if (change.type === 'DELETE' && change.oldOrder) {
        nextOrders = nextOrders.filter(o => o.ref !== change.oldOrder.ref);
      }
      
      return {
        ...current,
        data: { ...current.data, orders: nextOrders },
      };
    }, { revalidate: false }); // Don't refetch — trust the realtime data
  }, [mutate]);

  return {
    // State
    isLoading: isLoading && !initialLoadDone.current,
    isRefreshing: isValidating && initialLoadDone.current,
    error,
    
    // Actions
    refresh,
    invalidate,
    mutate,
    applyRealtimeOrderChange,
  };
}

/**
 * Hook for optimistic order status updates
 */
export function useOptimisticOrderUpdate() {
  const updateOrderOptimistic = useCallback(async (
    ref: string,
    updates: Partial<{ status: string; trackingNumber: string }>,
    adminEmail: string,
    options?: {
      onSuccess?: () => void;
      onError?: (error: any) => void;
      currentOrders?: any[];
      setOrders?: (orders: any[]) => void;
    }
  ) => {
    const { onSuccess, onError, currentOrders, setOrders } = options || {};

    // Optimistic update - update local state immediately
    if (currentOrders && setOrders) {
      setOrders(currentOrders.map(o => 
        o.ref === ref ? { ...o, ...updates } : o
      ));
    }

    try {
      const res = await fetch('/api/admin/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref, ...updates, adminEmail }),
      });

      if (!res.ok) {
        throw new Error('Failed to update order');
      }

      const result = await res.json();
      if (result.status !== 'success') {
        throw new Error(result.message || 'Update failed');
      }

      onSuccess?.();
    } catch (error) {
      // Rollback on error
      if (currentOrders && setOrders) {
        setOrders(currentOrders); // Restore original state
      }
      onError?.(error);
      throw error;
    }
  }, []);

  return { updateOrderOptimistic };
}

/**
 * Hook for optimistic batch updates
 */
export function useOptimisticBatchUpdate() {
  const batchUpdateOptimistic = useCallback(async (
    refs: string[],
    status: string,
    adminEmail: string,
    options?: {
      onSuccess?: () => void;
      onError?: (error: any) => void;
      currentOrders?: any[];
      setOrders?: (orders: any[]) => void;
    }
  ) => {
    const { onSuccess, onError, currentOrders, setOrders } = options || {};
    const refSet = new Set(refs);

    // Optimistic update
    if (currentOrders && setOrders) {
      setOrders(currentOrders.map(o => 
        refSet.has(o.ref) ? { ...o, status } : o
      ));
    }

    try {
      // Make all API calls in parallel
      const results = await Promise.all(
        refs.map(ref =>
          fetch('/api/admin/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ref, status, adminEmail }),
          })
        )
      );

      // Check if any failed
      const failed = results.filter(r => !r.ok);
      if (failed.length > 0) {
        throw new Error(`${failed.length} updates failed`);
      }

      onSuccess?.();
    } catch (error) {
      // Rollback on error
      if (currentOrders && setOrders) {
        setOrders(currentOrders);
      }
      onError?.(error);
      throw error;
    }
  }, []);

  return { batchUpdateOptimistic };
}

export default useAdminDataSWR;
