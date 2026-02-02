'use client';

/**
 * TanStack Query (React Query v5) Configuration
 * 
 * Alternative to SWR with additional features:
 * - Automatic garbage collection
 * - Query invalidation
 * - Prefetching
 * - Infinite queries
 * - Optimistic updates
 * - Devtools support
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ReactNode, useState } from 'react';

// ============== QUERY CLIENT CONFIGURATION ==============

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Stale time: 30 seconds
        staleTime: 30 * 1000,
        // Cache time: 5 minutes
        gcTime: 5 * 60 * 1000,
        // Retry with exponential backoff
        retry: 3,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        // Refetch on window focus
        refetchOnWindowFocus: true,
        // Refetch on reconnect
        refetchOnReconnect: true,
        // Don't refetch on mount if data is fresh
        refetchOnMount: true,
      },
      mutations: {
        // Retry mutations once
        retry: 1,
      },
    },
  });
}

// Singleton for browser
let browserQueryClient: QueryClient | undefined = undefined;

function getQueryClient() {
  if (typeof window === 'undefined') {
    // Server: always make a new query client
    return makeQueryClient();
  } else {
    // Browser: make a new query client if we don't already have one
    if (!browserQueryClient) browserQueryClient = makeQueryClient();
    return browserQueryClient;
  }
}

// ============== PROVIDER ==============

interface TanStackQueryProviderProps {
  children: ReactNode;
}

export function TanStackQueryProvider({ children }: TanStackQueryProviderProps) {
  const [queryClient] = useState(() => getQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}

// ============== QUERY KEYS ==============

export const queryKeys = {
  // Admin
  admin: {
    all: ['admin'] as const,
    data: () => [...queryKeys.admin.all, 'data'] as const,
    orders: () => [...queryKeys.admin.all, 'orders'] as const,
    config: () => [...queryKeys.admin.all, 'config'] as const,
    shippingOrders: () => [...queryKeys.admin.all, 'shipping-orders'] as const,
  },
  // User
  user: {
    all: ['user'] as const,
    profile: (email: string) => [...queryKeys.user.all, 'profile', email] as const,
    cart: (email: string) => [...queryKeys.user.all, 'cart', email] as const,
    orders: (email: string) => [...queryKeys.user.all, 'orders', email] as const,
  },
  // Shop
  shop: {
    all: ['shop'] as const,
    config: () => [...queryKeys.shop.all, 'config'] as const,
    shippingOptions: () => [...queryKeys.shop.all, 'shipping-options'] as const,
    paymentInfo: (ref: string) => [...queryKeys.shop.all, 'payment-info', ref] as const,
  },
  // Shipping
  shipping: {
    all: ['shipping'] as const,
    track: (trackingNumber: string) => [...queryKeys.shipping.all, 'track', trackingNumber] as const,
  },
};

// ============== FETCHER FUNCTIONS ==============

export async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Network error' }));
    throw new Error(error.message || `HTTP ${res.status}`);
  }
  
  return res.json();
}

export async function postJSON<T>(url: string, data: any): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Network error' }));
    throw new Error(error.message || `HTTP ${res.status}`);
  }
  
  return res.json();
}

// Export query client getter for invalidations
export { getQueryClient };

export default TanStackQueryProvider;
