'use client';

// src/hooks/useRealtimeOrders.ts
// Real-time order updates using Supabase Realtime

import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { createClient, RealtimeChannel } from '@supabase/supabase-js';

// Client-side Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Debug: Check if Supabase is configured correctly
if (typeof window !== 'undefined') {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[Realtime] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  } else if (!supabaseAnonKey.startsWith('eyJ')) {
    console.warn('[Realtime] NEXT_PUBLIC_SUPABASE_ANON_KEY should be a JWT token starting with "eyJ"');
  }
}

const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  : null;

/**
 * Client-side email hash using Web Crypto API
 */
async function hashEmail(email: string): Promise<string> {
  const normalized = email.toLowerCase().trim();
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

interface OrderChange {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  order: any;
  oldOrder?: any;
}

interface UseRealtimeOrdersOptions {
  /** Email hash to filter orders (for user's own orders) */
  emailHash?: string;
  /** Whether to listen for all orders (admin mode) */
  adminMode?: boolean;
  /** Callback when order changes */
  onOrderChange?: (change: OrderChange) => void;
  /** Callback when config changes */
  onConfigChange?: (config: any) => void;
  /** Enable/disable realtime (default: true) */
  enabled?: boolean;
}

export function useRealtimeOrders(options: UseRealtimeOrdersOptions = {}) {
  const { 
    emailHash, 
    adminMode = false, 
    onOrderChange, 
    onConfigChange,
    enabled = true 
  } = options;

  const channelRef = useRef<RealtimeChannel | null>(null);
  const configChannelRef = useRef<RealtimeChannel | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Subscribe to order changes
  useEffect(() => {
    if (!enabled || !supabase) {
      console.log('[Realtime] Disabled or missing Supabase config');
      return;
    }

    // Create channel for orders
    const channelName = adminMode 
      ? 'orders-admin' 
      : `orders-user-${emailHash || 'anonymous'}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'orders',
          ...(emailHash && !adminMode ? { filter: `email_hash=eq.${emailHash}` } : {}),
        },
        (payload) => {
          const newData = payload.new as Record<string, any> | null;
          const oldData = payload.old as Record<string, any> | null;
          console.log('[Realtime] Order change:', payload.eventType, newData?.ref || oldData?.ref);
          
          if (onOrderChange) {
            onOrderChange({
              type: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
              order: newData,
              oldOrder: oldData,
            });
          }
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Orders subscription status:', status);
        setIsConnected(status === 'SUBSCRIBED');
        if (status === 'CHANNEL_ERROR') {
          setConnectionError('Failed to connect to realtime');
        } else {
          setConnectionError(null);
        }
      });

    channelRef.current = channel;

    return () => {
      console.log('[Realtime] Unsubscribing from orders');
      channel.unsubscribe();
    };
  }, [emailHash, adminMode, onOrderChange, enabled]);

  // Subscribe to config changes
  useEffect(() => {
    if (!enabled || !supabase || !onConfigChange) {
      return;
    }

    const configChannel = supabase
      .channel('config-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'config',
          filter: "key=eq.shop-settings",
        },
        (payload) => {
          console.log('[Realtime] Config change detected');
          const newData = payload.new as Record<string, any> | null;
          if (newData && onConfigChange) {
            onConfigChange(newData.value);
          }
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Config subscription status:', status);
      });

    configChannelRef.current = configChannel;

    return () => {
      console.log('[Realtime] Unsubscribing from config');
      configChannel.unsubscribe();
    };
  }, [onConfigChange, enabled]);

  // Manual reconnect
  const reconnect = useCallback(() => {
    if (channelRef.current) {
      channelRef.current.unsubscribe();
      channelRef.current.subscribe();
    }
    if (configChannelRef.current) {
      configChannelRef.current.unsubscribe();
      configChannelRef.current.subscribe();
    }
  }, []);

  return {
    isConnected,
    connectionError,
    reconnect,
  };
}

/**
 * Hook for admin to listen to all order changes
 */
export function useRealtimeAdminOrders(onOrderChange: (change: OrderChange) => void) {
  return useRealtimeOrders({
    adminMode: true,
    onOrderChange,
    enabled: true,
  });
}

/**
 * Hook for user to listen to their own order changes
 */
export function useRealtimeUserOrders(
  emailHash: string | undefined,
  onOrderChange: (change: OrderChange) => void
) {
  return useRealtimeOrders({
    emailHash,
    adminMode: false,
    onOrderChange,
    enabled: !!emailHash,
  });
}

/**
 * Hook that takes email directly and hashes it internally
 */
export function useRealtimeOrdersByEmail(
  email: string | undefined | null,
  onOrderChange: (change: OrderChange) => void,
  onConfigChange?: (config: any) => void
) {
  const [emailHash, setEmailHash] = useState<string | undefined>(undefined);

  // Hash email when it changes
  useEffect(() => {
    if (email) {
      hashEmail(email).then(setEmailHash);
    } else {
      setEmailHash(undefined);
    }
  }, [email]);

  return useRealtimeOrders({
    emailHash,
    adminMode: false,
    onOrderChange,
    onConfigChange,
    enabled: !!emailHash,
  });
}

// Export hashEmail for external use
export { hashEmail };

export default useRealtimeOrders;
