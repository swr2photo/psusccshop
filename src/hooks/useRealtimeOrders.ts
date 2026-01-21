'use client';

// src/hooks/useRealtimeOrders.ts
// Real-time order updates using Supabase Realtime

import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { createClient, RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

// Client-side Supabase client - wrapped in try-catch for safety
let supabase: SupabaseClient | null = null;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Initialize Supabase client safely
function initSupabase(): SupabaseClient | null {
  if (supabase) return supabase;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    if (typeof window !== 'undefined') {
      console.warn('[Realtime] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
    }
    return null;
  }
  
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
    return supabase;
  } catch (err) {
    console.error('[Realtime] Failed to create Supabase client:', err);
    return null;
  }
}

// Debug: Check if Supabase is configured correctly (only in browser)
if (typeof window !== 'undefined') {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[Realtime] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  } else if (supabaseAnonKey && !supabaseAnonKey.startsWith('eyJ')) {
    console.warn('[Realtime] NEXT_PUBLIC_SUPABASE_ANON_KEY should be a JWT token starting with "eyJ"');
  }
}

/**
 * Simple hash function fallback for older browsers (Safari < 11, older iPads)
 * Uses a basic string hash - not cryptographically secure but sufficient for identifying users
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  // Convert to hex and pad to look like SHA-256
  const hex = Math.abs(hash).toString(16);
  return hex.padStart(64, '0');
}

/**
 * Client-side email hash using Web Crypto API with fallback for older browsers
 */
async function hashEmail(email: string): Promise<string> {
  const normalized = email.toLowerCase().trim();
  
  // Check if crypto.subtle is available (not available in older Safari/iPad or non-HTTPS)
  if (typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.digest === 'function') {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(normalized);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
    } catch (e) {
      console.warn('[Realtime] crypto.subtle failed, using fallback hash:', e);
      return simpleHash(normalized);
    }
  }
  
  // Fallback for older browsers
  console.warn('[Realtime] crypto.subtle not available, using fallback hash');
  return simpleHash(normalized);
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
    // Initialize Supabase lazily
    const client = initSupabase();
    
    if (!enabled || !client) {
      console.log('[Realtime] Disabled or missing Supabase config');
      return;
    }

    try {
      // Create channel for orders
      const channelName = adminMode 
        ? 'orders-admin' 
        : 'orders-user-' + (emailHash || 'anonymous');

      const channel = client
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*', // Listen to INSERT, UPDATE, DELETE
            schema: 'public',
            table: 'orders',
            ...(emailHash && !adminMode ? { filter: 'email_hash=eq.' + emailHash } : {}),
          },
          function(payload) {
            try {
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
            } catch (err) {
              console.error('[Realtime] Error processing order change:', err);
            }
          }
        )
        .subscribe(function(status) {
          console.log('[Realtime] Orders subscription status:', status);
          setIsConnected(status === 'SUBSCRIBED');
          if (status === 'CHANNEL_ERROR') {
            setConnectionError('Failed to connect to realtime');
          } else {
            setConnectionError(null);
          }
        });

      channelRef.current = channel;

      return function() {
        console.log('[Realtime] Unsubscribing from orders');
        try {
          channel.unsubscribe();
        } catch (err) {
          console.error('[Realtime] Error unsubscribing:', err);
        }
      };
    } catch (err) {
      console.error('[Realtime] Error setting up order subscription:', err);
      setConnectionError('Failed to setup realtime');
      return;
    }
  }, [emailHash, adminMode, onOrderChange, enabled]);

  // Subscribe to config changes
  useEffect(() => {
    const client = initSupabase();
    
    if (!enabled || !client || !onConfigChange) {
      return;
    }

    try {
      const configChannel = client
        .channel('config-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'config',
            filter: "key=eq.shop-settings",
          },
          function(payload) {
            try {
              console.log('[Realtime] Config change detected');
              const newData = payload.new as Record<string, any> | null;
              if (newData && onConfigChange) {
                onConfigChange(newData.value);
              }
            } catch (err) {
              console.error('[Realtime] Error processing config change:', err);
            }
          }
        )
        .subscribe(function(status) {
          console.log('[Realtime] Config subscription status:', status);
        });

      configChannelRef.current = configChannel;

      return function() {
        console.log('[Realtime] Unsubscribing from config');
        try {
          configChannel.unsubscribe();
        } catch (err) {
          console.error('[Realtime] Error unsubscribing from config:', err);
        }
      };
    } catch (err) {
      console.error('[Realtime] Error setting up config subscription:', err);
      return;
    }
  }, [onConfigChange, enabled]);

  // Manual reconnect
  const reconnect = useCallback(function() {
    try {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current.subscribe();
      }
      if (configChannelRef.current) {
        configChannelRef.current.unsubscribe();
        configChannelRef.current.subscribe();
      }
    } catch (err) {
      console.error('[Realtime] Error during reconnect:', err);
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
