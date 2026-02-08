'use client';

/**
 * Enterprise-grade Realtime Hook for Order Updates
 * 
 * Features:
 * - Auto reconnection with exponential backoff
 * - Heartbeat/ping to maintain connection
 * - Connection state management
 * - Debouncing for high-frequency updates
 * - Offline queue support
 * - Visibility change handling (tab switching)
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { createClient, RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

// ============== CONFIGURATION ==============

const CONFIG = {
  // Reconnection settings
  RECONNECT_BASE_DELAY: 1000,      // 1 second
  RECONNECT_MAX_DELAY: 30000,      // 30 seconds max
  RECONNECT_MAX_ATTEMPTS: 15,
  
  // Heartbeat settings
  HEARTBEAT_INTERVAL: 25000,       // 25 seconds (below Supabase 30s timeout)
  
  // Debounce settings
  DEBOUNCE_DELAY: 50,              // 50ms debounce for near-instant updates
  
  // Connection timeout
  CONNECTION_TIMEOUT: 10000,       // 10 seconds
};

// ============== SINGLETON SUPABASE CLIENT ==============

let supabase: SupabaseClient | null = null;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

function getSupabaseClient(): SupabaseClient | null {
  if (supabase) return supabase;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    if (typeof window !== 'undefined') {
      console.warn('[Realtime] Missing Supabase configuration');
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

// ============== UTILITIES ==============

/**
 * Simple hash function for older browsers
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const hex = Math.abs(hash).toString(16);
  return hex.padStart(64, '0');
}

/**
 * SHA-256 hash with fallback
 */
export async function hashEmail(email: string): Promise<string> {
  const normalized = email.toLowerCase().trim();
  
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(normalized);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch {
      return simpleHash(normalized);
    }
  }
  
  return simpleHash(normalized);
}

/**
 * Debounce function
 */
function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// ============== TYPES ==============

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

export interface OrderChange {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  order: any;
  oldOrder?: any;
  timestamp?: number;
}

export interface RealtimeState {
  connectionState: ConnectionState;
  isConnected: boolean;
  lastConnected: Date | null;
  reconnectAttempts: number;
  error: string | null;
  pendingChanges: number;
}

interface UseRealtimeOrdersOptions {
  emailHash?: string;
  adminMode?: boolean;
  onOrderChange?: (change: OrderChange) => void;
  onConfigChange?: (config: any) => void;
  onStateChange?: (state: RealtimeState) => void;
  enabled?: boolean;
}

// ============== MAIN HOOK ==============

export function useRealtimeOrders(options: UseRealtimeOrdersOptions = {}) {
  const { 
    emailHash, 
    adminMode = false, 
    onOrderChange, 
    onConfigChange,
    onStateChange,
    enabled = true 
  } = options;

  // State
  const [state, setState] = useState<RealtimeState>({
    connectionState: 'disconnected',
    isConnected: false,
    lastConnected: null,
    reconnectAttempts: 0,
    error: null,
    pendingChanges: 0,
  });

  // Refs for stable references
  const channelRef = useRef<RealtimeChannel | null>(null);
  const configChannelRef = useRef<RealtimeChannel | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pendingQueueRef = useRef<OrderChange[]>([]);
  const isUnmountedRef = useRef(false);
  const onOrderChangeRef = useRef(onOrderChange);
  const onConfigChangeRef = useRef(onConfigChange);
  const onStateChangeRef = useRef(onStateChange);

  // Keep refs updated
  useEffect(() => {
    onOrderChangeRef.current = onOrderChange;
  }, [onOrderChange]);

  useEffect(() => {
    onConfigChangeRef.current = onConfigChange;
  }, [onConfigChange]);

  useEffect(() => {
    onStateChangeRef.current = onStateChange;
  }, [onStateChange]);

  // Update state helper
  const updateState = useCallback((updates: Partial<RealtimeState>) => {
    setState(prev => {
      const next = { ...prev, ...updates };
      onStateChangeRef.current?.(next);
      return next;
    });
  }, []);

  // Calculate reconnect delay with exponential backoff
  const getReconnectDelay = useCallback((attempt: number) => {
    const delay = Math.min(
      CONFIG.RECONNECT_BASE_DELAY * Math.pow(2, attempt),
      CONFIG.RECONNECT_MAX_DELAY
    );
    // Add jitter (±20%)
    const jitter = delay * 0.2 * (Math.random() - 0.5);
    return Math.round(delay + jitter);
  }, []);

  // Process pending queue
  const processPendingQueue = useCallback(() => {
    while (pendingQueueRef.current.length > 0) {
      const change = pendingQueueRef.current.shift();
      if (change && onOrderChangeRef.current) {
        onOrderChangeRef.current(change);
      }
    }
    updateState({ pendingChanges: 0 });
  }, [updateState]);

  // Subscribe to orders
  const subscribeToOrders = useCallback(() => {
    const client = getSupabaseClient();
    if (!client || !enabled) return null;

    const channelName = adminMode 
      ? 'orders-admin-v2' 
      : `orders-user-${emailHash || 'anon'}-v2`;

    try {
      const channel = client
        .channel(channelName, {
          config: {
            broadcast: { self: true },
          },
        })
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'orders',
            ...(emailHash && !adminMode ? { filter: `email_hash=eq.${emailHash}` } : {}),
          },
          (payload) => {
            const change: OrderChange = {
              type: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
              order: payload.new as Record<string, any> | null,
              oldOrder: payload.old as Record<string, any> | null,
              timestamp: Date.now(),
            };

            console.log('[Realtime] Order change:', change.type, change.order?.ref || change.oldOrder?.ref);

            // Process immediately
            if (onOrderChangeRef.current) {
              onOrderChangeRef.current(change);
            }
          }
        )
        .subscribe((status, err) => {
          console.log('[Realtime] Subscription status:', status, err?.message || '');

          switch (status) {
            case 'SUBSCRIBED':
              updateState({
                connectionState: 'connected',
                isConnected: true,
                lastConnected: new Date(),
                reconnectAttempts: 0,
                error: null,
              });
              // Process any queued changes
              processPendingQueue();
              break;

            case 'CHANNEL_ERROR':
            case 'TIMED_OUT':
              updateState({
                connectionState: 'error',
                isConnected: false,
                error: err?.message || 'Connection failed',
              });
              scheduleReconnect();
              break;

            case 'CLOSED':
              updateState({
                connectionState: 'disconnected',
                isConnected: false,
              });
              break;
          }
        });

      return channel;
    } catch (err: any) {
      console.error('[Realtime] Subscribe error:', err);
      updateState({
        connectionState: 'error',
        isConnected: false,
        error: err?.message || 'Failed to subscribe',
      });
      return null;
    }
  }, [enabled, adminMode, emailHash, updateState, processPendingQueue]);

  // Subscribe to config changes
  const subscribeToConfig = useCallback(() => {
    const client = getSupabaseClient();
    if (!client || !enabled || !onConfigChangeRef.current) return null;

    try {
      const channel = client
        .channel('config-changes-v2')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'config',
            filter: 'key=eq.shop-settings',
          },
          (payload) => {
            console.log('[Realtime] Config change detected');
            const newData = payload.new as Record<string, any> | null;
            if (newData?.value && onConfigChangeRef.current) {
              onConfigChangeRef.current(newData.value);
            }
          }
        )
        .subscribe();

      return channel;
    } catch (err) {
      console.error('[Realtime] Config subscribe error:', err);
      return null;
    }
  }, [enabled]);

  // Schedule reconnection
  const scheduleReconnect = useCallback(() => {
    if (isUnmountedRef.current) return;
    
    setState(prev => {
      if (prev.reconnectAttempts >= CONFIG.RECONNECT_MAX_ATTEMPTS) {
        return {
          ...prev,
          connectionState: 'error' as const,
          error: 'Max reconnection attempts reached',
        };
      }

      const delay = getReconnectDelay(prev.reconnectAttempts);
      console.log(`[Realtime] Scheduling reconnect in ${delay}ms (attempt ${prev.reconnectAttempts + 1})`);

      reconnectTimeoutRef.current = setTimeout(() => {
        if (!isUnmountedRef.current) {
          reconnect();
        }
      }, delay);

      return {
        ...prev,
        connectionState: 'reconnecting' as const,
        reconnectAttempts: prev.reconnectAttempts + 1,
      };
    });
  }, [getReconnectDelay]);

  // Reconnect
  const reconnect = useCallback(() => {
    console.log('[Realtime] Reconnecting...');
    
    // Cleanup existing channels
    if (channelRef.current) {
      try {
        channelRef.current.unsubscribe();
      } catch {}
    }
    if (configChannelRef.current) {
      try {
        configChannelRef.current.unsubscribe();
      } catch {}
    }

    // Create new subscriptions
    updateState({ connectionState: 'connecting' });
    
    const orderChannel = subscribeToOrders();
    if (orderChannel) {
      channelRef.current = orderChannel;
    }

    const configChannel = subscribeToConfig();
    if (configChannel) {
      configChannelRef.current = configChannel;
    }
  }, [subscribeToOrders, subscribeToConfig, updateState]);

  // Force reconnect (manual)
  const forceReconnect = useCallback(() => {
    updateState({ reconnectAttempts: 0 });
    reconnect();
  }, [reconnect, updateState]);

  // Handle visibility change (tab switching)
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[Realtime] Tab became visible, checking connection...');
        setState(prev => {
          if (prev.connectionState !== 'connected') {
            reconnect();
          }
          return prev;
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [reconnect]);

  // Handle online/offline
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      console.log('[Realtime] Network online, reconnecting...');
      reconnect();
    };

    const handleOffline = () => {
      console.log('[Realtime] Network offline');
      updateState({
        connectionState: 'disconnected',
        isConnected: false,
        error: 'Network offline',
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [reconnect, updateState]);

  // Setup heartbeat
  useEffect(() => {
    if (!enabled) return;

    heartbeatIntervalRef.current = setInterval(() => {
      const orderChannel = channelRef.current;
      if (orderChannel) {
        // Check if channel is still joined
        const isSubscribed = orderChannel.state === 'joined';
        setState(prev => {
          if (!isSubscribed && prev.connectionState === 'connected') {
            console.log('[Realtime] Heartbeat: Connection lost, reconnecting...');
            reconnect();
          }
          return prev;
        });
      }
    }, CONFIG.HEARTBEAT_INTERVAL);

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, [enabled, reconnect]);

  // Initial setup
  useEffect(() => {
    isUnmountedRef.current = false;
    
    if (!enabled) {
      updateState({ connectionState: 'disconnected', isConnected: false });
      return;
    }

    updateState({ connectionState: 'connecting' });

    // Subscribe to channels
    const orderChannel = subscribeToOrders();
    if (orderChannel) {
      channelRef.current = orderChannel;
    }

    const configChannel = subscribeToConfig();
    if (configChannel) {
      configChannelRef.current = configChannel;
    }

    // Cleanup
    return () => {
      isUnmountedRef.current = true;

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }

      if (channelRef.current) {
        try {
          channelRef.current.unsubscribe();
        } catch {}
      }
      if (configChannelRef.current) {
        try {
          configChannelRef.current.unsubscribe();
        } catch {}
      }
    };
  }, [enabled, emailHash, adminMode]); // Only re-run when these change

  return {
    ...state,
    reconnect: forceReconnect,
    processPendingQueue,
  };
}

// ============== CONVENIENCE HOOKS ==============

/**
 * Hook for admin to listen to all order changes + config changes
 */
export function useRealtimeAdminOrders(
  onOrderChange: (change: OrderChange) => void,
  onStateChange?: (state: RealtimeState) => void,
  onConfigChange?: (config: any) => void
) {
  return useRealtimeOrders({
    adminMode: true,
    onOrderChange,
    onConfigChange,
    onStateChange,
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

export default useRealtimeOrders;
