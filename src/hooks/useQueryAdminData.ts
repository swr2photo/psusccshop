'use client';

/**
 * TanStack Query Hooks for Admin Data
 * 
 * Admin data hooks using React Query v5
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys, fetchJSON, postJSON } from './useTanStackQuery';

// ============== TYPES ==============

interface AdminOrder {
  ref: string;
  status: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  date?: string;
  total?: number;
  cart?: any[];
  trackingNumber?: string;
  shippingProvider?: string;
  [key: string]: any;
}

interface ShopConfig {
  shopOpen: boolean;
  shopName?: string;
  products?: any[];
  [key: string]: any;
}

interface AdminDataResponse {
  status: string;
  data?: {
    orders: AdminOrder[];
    config: ShopConfig;
  };
  message?: string;
}

// ============== ADMIN DATA ==============

export function useAdminDataQuery() {
  return useQuery({
    queryKey: queryKeys.admin.data(),
    queryFn: () => fetchJSON<AdminDataResponse>('/api/admin/data'),
    staleTime: 15 * 1000, // 15 seconds
    refetchInterval: 30 * 1000, // Auto refresh every 30 seconds
  });
}

export function useAdminOrdersQuery() {
  const { data, ...rest } = useAdminDataQuery();
  return {
    data: data?.data?.orders || [],
    ...rest,
  };
}

export function useAdminConfigQuery() {
  const { data, ...rest } = useAdminDataQuery();
  return {
    data: data?.data?.config,
    ...rest,
  };
}

// ============== ORDER STATUS MUTATION ==============

export function useUpdateOrderStatusMutation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: { 
      ref: string; 
      status: string;
      trackingNumber?: string;
      shippingProvider?: string;
    }) => postJSON('/api/admin/status', data),
    onMutate: async (variables) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.admin.data() });
      
      // Snapshot previous value
      const previousData = queryClient.getQueryData<AdminDataResponse>(
        queryKeys.admin.data()
      );
      
      // Optimistically update
      if (previousData?.data?.orders) {
        queryClient.setQueryData<AdminDataResponse>(
          queryKeys.admin.data(),
          {
            ...previousData,
            data: {
              ...previousData.data,
              orders: previousData.data.orders.map(order =>
                order.ref === variables.ref
                  ? { 
                      ...order, 
                      ...variables,
                    }
                  : order
              ),
            },
          }
        );
      }
      
      return { previousData };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.admin.data(), context.previousData);
      }
    },
    onSettled: () => {
      // Refetch after mutation
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.data() });
    },
  });
}

// ============== BATCH UPDATE MUTATION ==============

export function useBatchUpdateStatusMutation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { refs: string[]; status: string }) => {
      const results = await Promise.allSettled(
        data.refs.map(ref =>
          postJSON('/api/admin/status', { ref, status: data.status })
        )
      );
      
      const success = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      return { success, failed };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.data() });
    },
  });
}

// ============== DELETE ORDER MUTATION ==============

export function useDeleteOrderMutation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (ref: string) =>
      fetch(`/api/orders?ref=${encodeURIComponent(ref)}`, { method: 'DELETE' })
        .then(res => res.json()),
    onMutate: async (ref) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.admin.data() });
      
      const previousData = queryClient.getQueryData<AdminDataResponse>(
        queryKeys.admin.data()
      );
      
      // Optimistically remove order
      if (previousData?.data?.orders) {
        queryClient.setQueryData<AdminDataResponse>(
          queryKeys.admin.data(),
          {
            ...previousData,
            data: {
              ...previousData.data,
              orders: previousData.data.orders.filter(o => o.ref !== ref),
            },
          }
        );
      }
      
      return { previousData };
    },
    onError: (err, ref, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.admin.data(), context.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.data() });
    },
  });
}

// ============== UPDATE CONFIG MUTATION ==============

export function useUpdateConfigMutation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (config: Partial<ShopConfig>) =>
      postJSON('/api/config', config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.data() });
      queryClient.invalidateQueries({ queryKey: queryKeys.shop.config() });
    },
  });
}

// ============== SYNC SHEET MUTATION ==============

export function useSyncSheetMutation() {
  return useMutation({
    mutationFn: () => postJSON('/api/admin/sheet', { action: 'sync' }),
  });
}

// ============== SHIPPING ORDERS ==============

export function useShippingOrdersQuery() {
  const { data, ...rest } = useAdminDataQuery();
  
  const shippingOrders = (data?.data?.orders || []).filter((o: AdminOrder) => {
    if (!['SHIPPED', 'READY', 'PAID'].includes(o.status)) return false;
    
    const shippingOpt = (o.shippingOption || '').toLowerCase();
    const isPickup = shippingOpt === 'pickup' || 
                    shippingOpt.includes('รับเอง') ||
                    shippingOpt.includes('pick up');
    
    return !isPickup;
  });
  
  return {
    data: shippingOrders,
    ...rest,
  };
}

// ============== UPDATE TRACKING MUTATION ==============

export function useUpdateTrackingMutation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: {
      ref: string;
      trackingNumber: string | null;
      shippingProvider: string | null;
      status?: string;
    }) => postJSON('/api/admin/status', {
      ref: data.ref,
      status: data.status || 'SHIPPED',
      trackingNumber: data.trackingNumber,
      shippingProvider: data.shippingProvider,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.data() });
    },
  });
}

// ============== TRACK SHIPMENT MUTATION ==============

export function useTrackShipmentMutation() {
  return useMutation({
    mutationFn: (data: { trackingNumber: string; provider?: string }) =>
      postJSON('/api/shipping/track', data),
  });
}

export default {
  useAdminDataQuery,
  useAdminOrdersQuery,
  useAdminConfigQuery,
  useUpdateOrderStatusMutation,
  useBatchUpdateStatusMutation,
  useDeleteOrderMutation,
  useUpdateConfigMutation,
  useSyncSheetMutation,
  useShippingOrdersQuery,
  useUpdateTrackingMutation,
  useTrackShipmentMutation,
};
