'use client';

/**
 * Admin Page Data Integration with SWR
 * 
 * This hook bridges SWR data fetching with existing admin page state management.
 * It provides the benefits of SWR (caching, dedup, revalidation) while maintaining
 * compatibility with the existing admin page architecture.
 */

import { useCallback, useEffect, useRef } from 'react';
import useSWR from 'swr';
import { fetcher } from './useSWRConfig';
import { CACHE_KEYS } from './useAdminData';

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
 * SWR-powered data fetching for admin page
 * 
 * This hook handles:
 * - Initial data fetch with SWR caching
 * - Background revalidation
 * - Network reconnection handling
 * - Deduplication of requests
 * - Error handling with fallback
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

  // Keep refs updated
  useEffect(() => {
    onDataReceivedRef.current = onDataReceived;
  }, [onDataReceived]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    onLoadingChangeRef.current = onLoadingChange;
  }, [onLoadingChange]);

  // SWR fetch with configuration
  const { 
    data, 
    error, 
    isLoading, 
    isValidating, 
    mutate 
  } = useSWR<AdminDataRaw>(
    enabled ? CACHE_KEYS.ADMIN_DATA : null,
    fetcher,
    {
      // Revalidation settings
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      revalidateIfStale: true,
      
      // Longer interval when realtime is active
      refreshInterval: realtimeConnected ? 120000 : 30000, // 2min with realtime, 30s without
      
      // Deduplication
      dedupingInterval: 5000,
      
      // Error handling
      errorRetryCount: 3,
      errorRetryInterval: 5000,
      
      // Keep showing stale data while revalidating
      keepPreviousData: true,
      
      // Don't suspend - we handle loading state manually
      suspense: false,
    }
  );

  // Handle initial load and data updates
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

  // Handle loading state
  useEffect(() => {
    if (onLoadingChangeRef.current) {
      // Only show loading on initial load, not on revalidation
      onLoadingChangeRef.current(isLoading && !initialLoadDone.current);
    }
  }, [isLoading]);

  // Manual refresh function
  const refresh = useCallback(async (options?: { silent?: boolean }) => {
    if (options?.silent) {
      // Silent refresh - don't show loading
      await mutate();
    } else {
      // Normal refresh
      await mutate();
    }
  }, [mutate]);

  // Invalidate and refetch
  const invalidate = useCallback(() => {
    mutate(undefined, { revalidate: true });
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
