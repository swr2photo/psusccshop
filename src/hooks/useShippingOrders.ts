'use client';

/**
 * SWR Hook for Tracking Management
 * 
 * Provides data fetching and mutations for:
 * - Orders requiring shipping
 * - Tracking number updates
 * - Shipment tracking
 */

import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import { useCallback, useMemo } from 'react';
import { fetcher } from './useSWRConfig';
import { CACHE_KEYS, invalidateAdminData } from './useAdminData';

// ============== TYPES ==============

interface Order {
  ref: string;
  customerName?: string;
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  status: string;
  trackingNumber?: string;
  shippingProvider?: string;
  date?: string;
  cart?: any[];
  total?: number;
  shippingOption?: string;
}

// ============== SHIPPING ORDERS HOOK ==============

export function useShippingOrders() {
  const { data, error, isLoading, mutate: revalidate } = useSWR(
    CACHE_KEYS.ADMIN_DATA,
    fetcher,
    {
      revalidateOnFocus: true,
      dedupingInterval: 5000,
      refreshInterval: 30000, // 30 seconds
    }
  );

  // Filter orders that need shipping
  const orders = useMemo(() => {
    if (!data?.data?.orders) return [];
    
    return data.data.orders.filter((o: any) => {
      // Must be in relevant status
      if (!['SHIPPED', 'READY', 'PAID'].includes(o.status)) return false;
      
      // Check shipping option
      const shippingOpt = (o.shippingOption || o.shippingOptionId || '').toLowerCase();
      
      // Exclude pickup orders
      const isPickup = shippingOpt === 'pickup' || 
                      shippingOpt.includes('รับเอง') ||
                      shippingOpt.includes('รับหน้าร้าน') ||
                      shippingOpt.includes('pick up');
      
      if (isPickup) return false;
      
      // If has explicit shipping option (not pickup), include it
      if (shippingOpt && !isPickup) return true;
      
      // Check if total > cart subtotal (has shipping fee) - likely delivery
      const cart = o.cart || [];
      const cartSubtotal = cart.reduce((sum: number, item: any) => {
        const price = Number(item?.unitPrice ?? item?.price ?? 0);
        const qty = Number(item?.quantity ?? item?.qty ?? 1);
        return sum + (price * qty);
      }, 0);
      const totalAmount = Number(o.totalAmount ?? o.amount ?? 0);
      const hasShippingFee = totalAmount > cartSubtotal;
      
      return hasShippingFee;
    }).map((o: any): Order => {
      // Detect delivery_legacy from fee difference
      let shippingOpt = o.shippingOption || o.shippingOptionId || '';
      if (!shippingOpt) {
        const cart = o.cart || [];
        const cartSubtotal = cart.reduce((sum: number, item: any) => {
          const price = Number(item?.unitPrice ?? item?.price ?? 0);
          const qty = Number(item?.quantity ?? item?.qty ?? 1);
          return sum + (price * qty);
        }, 0);
        const totalAmount = Number(o.totalAmount ?? o.amount ?? 0);
        if (totalAmount > cartSubtotal) {
          shippingOpt = 'delivery_legacy';
        }
      }
      
      return {
        ref: o.ref,
        customerName: o.customerName || o.name,
        name: o.name,
        email: o.email || o.customerEmail || '',
        phone: o.customerPhone || o.phone || '',
        address: o.customerAddress || o.address || '',
        status: o.status,
        trackingNumber: o.trackingNumber,
        shippingProvider: o.shippingProvider,
        date: o.date,
        cart: o.cart,
        total: o.total || o.totalAmount || o.amount,
        shippingOption: shippingOpt,
      };
    });
  }, [data]);

  return {
    orders,
    isLoading,
    error,
    refresh: () => revalidate(),
    mutate: revalidate,
  };
}

// ============== UPDATE TRACKING MUTATION ==============

export function useUpdateTracking() {
  const { trigger, isMutating, error } = useSWRMutation(
    '/api/admin/status',
    async (url, { arg }: { arg: { 
      ref: string; 
      status: string; 
      trackingNumber?: string | null; 
      shippingProvider?: string | null;
    } }) => {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(arg),
      });
      
      if (!res.ok) {
        throw new Error('Failed to update tracking');
      }
      
      return res.json();
    }
  );

  const updateTracking = useCallback(async (
    ref: string,
    trackingNumber: string | null,
    shippingProvider: string | null,
    status: string = 'SHIPPED'
  ) => {
    const result = await trigger({
      ref,
      status,
      trackingNumber,
      shippingProvider,
    });
    
    // Invalidate admin data cache to refresh orders
    invalidateAdminData();
    
    return result;
  }, [trigger]);

  const deleteTracking = useCallback(async (ref: string) => {
    return updateTracking(ref, null, null, 'PAID');
  }, [updateTracking]);

  return {
    updateTracking,
    deleteTracking,
    isUpdating: isMutating,
    error,
  };
}

// ============== TRACK SHIPMENT MUTATION ==============

export function useTrackShipment() {
  const { trigger, isMutating, error, reset } = useSWRMutation(
    '/api/shipping/track',
    async (url, { arg }: { arg: { trackingNumber: string; provider?: string } }) => {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(arg),
      });
      
      const data = await res.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to track shipment');
      }
      
      return data.data;
    }
  );

  const trackShipment = useCallback(async (
    trackingNumber: string,
    provider?: string
  ) => {
    return trigger({ trackingNumber, provider });
  }, [trigger]);

  return {
    trackShipment,
    isTracking: isMutating,
    error,
    resetError: reset,
  };
}

// ============== BULK UPDATE TRACKING ==============

export function useBulkUpdateTracking() {
  const updateTracking = useUpdateTracking();

  const bulkUpdate = useCallback(async (
    items: Array<{ ref: string; trackingNumber: string }>,
    shippingProvider: string,
    onProgress?: (success: number, failed: number) => void
  ) => {
    let success = 0;
    let failed = 0;

    for (const item of items) {
      try {
        await updateTracking.updateTracking(
          item.ref,
          item.trackingNumber,
          shippingProvider,
          'SHIPPED'
        );
        success++;
      } catch {
        failed++;
      }
      onProgress?.(success, failed);
    }

    // Invalidate cache after all updates
    invalidateAdminData();

    return { success, failed };
  }, [updateTracking]);

  return {
    bulkUpdate,
    isUpdating: updateTracking.isUpdating,
  };
}

export default useShippingOrders;
