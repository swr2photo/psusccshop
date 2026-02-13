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
import { ReactNode, useState, lazy, Suspense } from 'react';

// Lazy-load devtools so they are never in the production bundle
const ReactQueryDevtools = lazy(() =>
  import('@tanstack/react-query-devtools').then((mod) => ({
    default: mod.ReactQueryDevtools,
  }))
);

// ============== QUERY CLIENT CONFIGURATION ==============

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Stale time: 2 minutes — data is fresh for 2 min, no refetches
        staleTime: 2 * 60 * 1000,
        // Cache time: 10 minutes — keep in memory for 10 min after unmount
        gcTime: 10 * 60 * 1000,
        // Retry with exponential backoff (max 2 retries)
        retry: 2,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 15000),
        // Only refetch stale data on window focus (not fresh data)
        refetchOnWindowFocus: 'always',
        // Refetch on reconnect
        refetchOnReconnect: 'always',
        // Don't refetch on mount if data is still fresh
        refetchOnMount: false,
        // Structural sharing to minimize re-renders
        structuralSharing: true,
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
        <Suspense fallback={null}>
          <ReactQueryDevtools initialIsOpen={false} />
        </Suspense>
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
