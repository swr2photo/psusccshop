'use client';

/**
 * Progressive admin data loading with SWR + Realtime
 *
 * Loads in stages instead of one heavy /api/admin/data call:
 * 1. Bootstrap — role + order counts (fast)
 * 2. Config — shop settings/products (parallel after bootstrap)
 * 3. Orders — paginated slim list (parallel after bootstrap)
 */

import { useCallback, useEffect, useRef } from 'react';
import useSWR from 'swr';
import { ADMIN_CACHE_KEYS } from './useAdminData';

const adminFetcher = async (url: string) => {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    const error = new Error('Admin data fetch failed');
    (error as any).status = res.status;
    throw error;
  }
  return res.json();
};

export type AdminDataSection = 'bootstrap' | 'config' | 'orders';

export interface AdminSectionPayload {
  section: AdminDataSection;
  userRole?: string;
  userEmail?: string;
  shopAdminPermissions?: Record<string, boolean>;
  orderStats?: { byStatus: Record<string, number>; total: number };
  config?: any;
  orders?: any[];
  total?: number;
  hasMore?: boolean;
  logs?: any[];
}

interface UseAdminDataSWROptions {
  enabled: boolean;
  onSectionReceived: (payload: AdminSectionPayload) => void;
  onError?: (error: any, section?: AdminDataSection) => void;
  onLoadingChange?: (loading: boolean) => void;
  realtimeConnected?: boolean;
}

function readLocalCache(): { config?: any; orders?: any[]; logs?: any[] } | null {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem('psusccshop-admin-cache');
    if (!cached) return null;
    const parsed = JSON.parse(cached);
    return parsed?.config ? parsed : null;
  } catch {
    return null;
  }
}

export function useAdminDataSWR(options: UseAdminDataSWROptions) {
  const {
    enabled,
    onSectionReceived,
    onError,
    onLoadingChange,
    realtimeConnected = false,
  } = options;

  const bootstrapDone = useRef(false);
  const onSectionRef = useRef(onSectionReceived);
  const onErrorRef = useRef(onError);
  const onLoadingChangeRef = useRef(onLoadingChange);

  useEffect(() => { onSectionRef.current = onSectionReceived; }, [onSectionReceived]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);
  useEffect(() => { onLoadingChangeRef.current = onLoadingChange; }, [onLoadingChange]);

  const swrOptions = {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    revalidateIfStale: true,
    dedupingInterval: 3000,
    errorRetryCount: 3,
    errorRetryInterval: 3000,
    keepPreviousData: true as const,
    suspense: false as const,
  };

  const {
    data: bootstrapData,
    error: bootstrapError,
    isLoading: bootstrapLoading,
    isValidating: bootstrapValidating,
    mutate: mutateBootstrap,
  } = useSWR(
    enabled ? ADMIN_CACHE_KEYS.BOOTSTRAP : null,
    adminFetcher,
    { ...swrOptions, refreshInterval: 0 },
  );

  const bootstrapReady = bootstrapData?.status === 'success';

  const {
    data: configData,
    error: configError,
    isLoading: configLoading,
    isValidating: configValidating,
    mutate: mutateConfig,
  } = useSWR(
    enabled && bootstrapReady ? ADMIN_CACHE_KEYS.CONFIG : null,
    adminFetcher,
    {
      ...swrOptions,
      refreshInterval: realtimeConnected ? 120_000 : 60_000,
      fallbackData: (() => {
        const cached = readLocalCache();
        if (!cached?.config) return undefined;
        return { status: 'success', data: { config: cached.config } };
      })(),
    },
  );

  const {
    data: ordersData,
    error: ordersError,
    isLoading: ordersLoading,
    isValidating: ordersValidating,
    mutate: mutateOrders,
  } = useSWR(
    enabled && bootstrapReady ? ADMIN_CACHE_KEYS.ORDERS_LIST : null,
    adminFetcher,
    {
      ...swrOptions,
      refreshInterval: realtimeConnected ? 120_000 : 15_000,
      fallbackData: (() => {
        const cached = readLocalCache();
        if (!cached?.orders?.length) return undefined;
        return {
          status: 'success',
          data: {
            orders: cached.orders,
            total: cached.orders.length,
            hasMore: false,
          },
        };
      })(),
    },
  );

  useEffect(() => {
    if (bootstrapData?.status === 'success' && bootstrapData.data) {
      bootstrapDone.current = true;
      onSectionRef.current({
        section: 'bootstrap',
        userRole: bootstrapData.data.userRole,
        userEmail: bootstrapData.data.userEmail,
        shopAdminPermissions: bootstrapData.data.shopAdminPermissions,
        orderStats: bootstrapData.data.orderStats,
      });
    }
  }, [bootstrapData]);

  useEffect(() => {
    if (configData?.status === 'success' && configData.data?.config) {
      onSectionRef.current({ section: 'config', config: configData.data.config });
    }
  }, [configData]);

  useEffect(() => {
    if (ordersData?.status === 'success' && ordersData.data) {
      onSectionRef.current({
        section: 'orders',
        orders: ordersData.data.orders || [],
        total: ordersData.data.total,
        hasMore: ordersData.data.hasMore,
        logs: [],
      });
    }
  }, [ordersData]);

  useEffect(() => {
    const err = bootstrapError || configError || ordersError;
    if (!err || !onErrorRef.current) return;
    const section: AdminDataSection | undefined = bootstrapError
      ? 'bootstrap'
      : configError
        ? 'config'
        : ordersError
          ? 'orders'
          : undefined;
    onErrorRef.current(err, section);
  }, [bootstrapError, configError, ordersError]);

  useEffect(() => {
    if (!onLoadingChangeRef.current) return;
    const cached = readLocalCache();
    const hasCache = Boolean(cached?.config || cached?.orders?.length);
    const waitingBootstrap = bootstrapLoading && !bootstrapDone.current && !bootstrapData;
    const waitingFirstPaint = !hasCache && (configLoading || ordersLoading) && !configData && !ordersData;
    onLoadingChangeRef.current(waitingBootstrap || waitingFirstPaint);
  }, [bootstrapLoading, bootstrapData, configLoading, configData, ordersLoading, ordersData]);

  const refresh = useCallback(async () => {
    await Promise.all([mutateBootstrap(), mutateConfig(), mutateOrders()]);
  }, [mutateBootstrap, mutateConfig, mutateOrders]);

  const refreshConfig = useCallback(async () => {
    await mutateConfig();
  }, [mutateConfig]);

  const refreshOrders = useCallback(async () => {
    await mutateOrders();
  }, [mutateOrders]);

  const invalidate = useCallback(() => {
    mutateBootstrap(undefined, { revalidate: true });
    mutateConfig(undefined, { revalidate: true });
    mutateOrders(undefined, { revalidate: true });
  }, [mutateBootstrap, mutateConfig, mutateOrders]);

  const applyRealtimeOrderChange = useCallback((change: {
    type: 'INSERT' | 'UPDATE' | 'DELETE';
    order?: any;
    oldOrder?: any;
  }) => {
    mutateOrders((current: { data?: { orders?: any[] } } | undefined) => {
      if (!current?.data?.orders) return current;

      let nextOrders = [...current.data.orders];

      if (change.type === 'UPDATE' && change.order) {
        const idx = nextOrders.findIndex((o) => o.ref === change.order.ref);
        if (idx >= 0) nextOrders[idx] = { ...nextOrders[idx], ...change.order };
      } else if (change.type === 'INSERT' && change.order) {
        if (!nextOrders.some((o) => o.ref === change.order.ref)) {
          nextOrders = [change.order, ...nextOrders];
        }
      } else if (change.type === 'DELETE' && change.oldOrder) {
        nextOrders = nextOrders.filter((o) => o.ref !== change.oldOrder.ref);
      }

      return { ...current, data: { ...current.data, orders: nextOrders } };
    }, { revalidate: false });
  }, [mutateOrders]);

  const isRefreshing = bootstrapValidating || configValidating || ordersValidating;

  return {
    isLoading: bootstrapLoading && !bootstrapDone.current,
    isRefreshing: isRefreshing && bootstrapDone.current,
    sectionsLoading: {
      bootstrap: bootstrapLoading && !bootstrapDone.current,
      config: configLoading && !configData?.data?.config,
      orders: ordersLoading && !ordersData?.data?.orders,
    },
    error: bootstrapError || configError || ordersError,
    refresh,
    refreshConfig,
    refreshOrders,
    invalidate,
    mutate: refresh,
    applyRealtimeOrderChange,
  };
}

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
    },
  ) => {
    const { onSuccess, onError, currentOrders, setOrders } = options || {};

    if (currentOrders && setOrders) {
      setOrders(currentOrders.map((o) => (o.ref === ref ? { ...o, ...updates } : o)));
    }

    try {
      const res = await fetch('/api/admin/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref, ...updates, adminEmail }),
      });

      if (!res.ok) throw new Error('Failed to update order');
      const result = await res.json();
      if (result.status !== 'success') throw new Error(result.message || 'Update failed');
      onSuccess?.();
    } catch (error) {
      if (currentOrders && setOrders) setOrders(currentOrders);
      onError?.(error);
      throw error;
    }
  }, []);

  return { updateOrderOptimistic };
}

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
    },
  ) => {
    const { onSuccess, onError, currentOrders, setOrders } = options || {};
    const refSet = new Set(refs);

    if (currentOrders && setOrders) {
      setOrders(currentOrders.map((o) => (refSet.has(o.ref) ? { ...o, status } : o)));
    }

    try {
      const results = await Promise.all(
        refs.map((ref) =>
          fetch('/api/admin/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ref, status, adminEmail }),
          }),
        ),
      );

      const failed = results.filter((r) => !r.ok);
      if (failed.length > 0) throw new Error(`${failed.length} updates failed`);
      onSuccess?.();
    } catch (error) {
      if (currentOrders && setOrders) setOrders(currentOrders);
      onError?.(error);
      throw error;
    }
  }, []);

  return { batchUpdateOptimistic };
}

export default useAdminDataSWR;
