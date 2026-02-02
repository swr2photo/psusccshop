'use client';

/**
 * TanStack Query Hooks for Shop Data
 * 
 * User-facing data hooks using React Query v5
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys, fetchJSON, postJSON } from './useTanStackQuery';

// ============== TYPES ==============

interface ShopConfig {
  shopOpen: boolean;
  shopName?: string;
  shopDescription?: string;
  products?: any[];
  [key: string]: any;
}

interface UserProfile {
  email: string;
  name?: string;
  phone?: string;
  address?: string;
  instagram?: string;
}

interface CartItem {
  id: string;
  productId: string;
  productName: string;
  size: string;
  quantity: number;
  price: number;
  [key: string]: any;
}

interface Order {
  ref: string;
  status: string;
  date: string;
  total: number;
  cart: CartItem[];
  [key: string]: any;
}

// ============== SHOP CONFIG ==============

export function useShopConfigQuery() {
  return useQuery({
    queryKey: queryKeys.shop.config(),
    queryFn: () => fetchJSON<{ status: string; config?: ShopConfig }>('/api/config'),
    staleTime: 60 * 1000, // 1 minute
    select: (data) => data.config,
  });
}

// ============== USER PROFILE ==============

export function useUserProfileQuery(email: string | undefined | null) {
  return useQuery({
    queryKey: queryKeys.user.profile(email || ''),
    queryFn: () => fetchJSON<{ status: string; profile?: UserProfile }>(
      `/api/profile?email=${encodeURIComponent(email || '')}`
    ),
    enabled: !!email,
    select: (data) => data.profile,
  });
}

export function useUpdateProfileMutation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: { email: string; profile: Partial<UserProfile> }) =>
      postJSON('/api/profile', data),
    onSuccess: (_, variables) => {
      // Invalidate profile query
      queryClient.invalidateQueries({
        queryKey: queryKeys.user.profile(variables.email),
      });
    },
  });
}

// ============== USER CART ==============

export function useUserCartQuery(email: string | undefined | null) {
  return useQuery({
    queryKey: queryKeys.user.cart(email || ''),
    queryFn: () => fetchJSON<{ status: string; cart?: CartItem[] }>(
      `/api/cart?email=${encodeURIComponent(email || '')}`
    ),
    enabled: !!email,
    select: (data) => data.cart || [],
  });
}

export function useUpdateCartMutation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: { email: string; cart: CartItem[] }) =>
      postJSON('/api/cart', data),
    onMutate: async (variables) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.user.cart(variables.email),
      });
      
      // Snapshot previous value
      const previousCart = queryClient.getQueryData(
        queryKeys.user.cart(variables.email)
      );
      
      // Optimistically update
      queryClient.setQueryData(
        queryKeys.user.cart(variables.email),
        { status: 'success', cart: variables.cart }
      );
      
      return { previousCart };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousCart) {
        queryClient.setQueryData(
          queryKeys.user.cart(variables.email),
          context.previousCart
        );
      }
    },
    onSettled: (_, __, variables) => {
      // Refetch after mutation
      queryClient.invalidateQueries({
        queryKey: queryKeys.user.cart(variables.email),
      });
    },
  });
}

// ============== USER ORDERS ==============

export function useUserOrdersQuery(email: string | undefined | null) {
  return useQuery({
    queryKey: queryKeys.user.orders(email || ''),
    queryFn: () => fetchJSON<{ status: string; orders?: Order[] }>(
      `/api/orders?email=${encodeURIComponent(email || '')}`
    ),
    enabled: !!email,
    staleTime: 30 * 1000, // 30 seconds
    select: (data) => data.orders || [],
  });
}

// ============== SHIPPING OPTIONS ==============

export function useShippingOptionsQuery() {
  return useQuery({
    queryKey: queryKeys.shop.shippingOptions(),
    queryFn: () => fetchJSON<{ success: boolean; options?: any[] }>('/api/shipping/options'),
    staleTime: 5 * 60 * 1000, // 5 minutes
    select: (data) => data.options || [],
  });
}

// ============== PAYMENT INFO ==============

export function usePaymentInfoQuery(ref: string | undefined | null) {
  return useQuery({
    queryKey: queryKeys.shop.paymentInfo(ref || ''),
    queryFn: () => fetchJSON<any>(`/api/payment-info?ref=${encodeURIComponent(ref || '')}`),
    enabled: !!ref,
  });
}

// ============== SUBMIT ORDER ==============

export function useSubmitOrderMutation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: {
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
    }) => postJSON('/api/orders', data),
    onSuccess: (_, variables) => {
      // Invalidate orders and cart
      queryClient.invalidateQueries({
        queryKey: queryKeys.user.orders(variables.customerEmail),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.user.cart(variables.customerEmail),
      });
    },
  });
}

// ============== TRACKING ==============

export function useTrackShipmentQuery(trackingNumber: string | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.shipping.track(trackingNumber || ''),
    queryFn: () => postJSON<any>('/api/shipping/track', { trackingNumber }),
    enabled: !!trackingNumber && enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export default {
  useShopConfigQuery,
  useUserProfileQuery,
  useUpdateProfileMutation,
  useUserCartQuery,
  useUpdateCartMutation,
  useUserOrdersQuery,
  useShippingOptionsQuery,
  usePaymentInfoQuery,
  useSubmitOrderMutation,
  useTrackShipmentQuery,
};
