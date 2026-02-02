'use client';

/**
 * SWR Configuration Provider
 * 
 * Global configuration for SWR data fetching:
 * - Auto revalidation on focus
 * - Network reconnection handling
 * - Error retry with exponential backoff
 * - Deduplication
 */

import { SWRConfig } from 'swr';
import { ReactNode } from 'react';

// ============== TYPES ==============

interface SWRProviderProps {
  children: ReactNode;
}

// ============== GLOBAL FETCHER ==============

/**
 * Global fetcher function with error handling
 */
export const fetcher = async (url: string) => {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    const error = new Error('An error occurred while fetching the data.');
    const errorInfo = await res.json().catch(() => ({ message: res.statusText }));
    (error as any).info = errorInfo;
    (error as any).status = res.status;
    throw error;
  }

  return res.json();
};

/**
 * POST fetcher for mutations
 */
export const postFetcher = async (url: string, { arg }: { arg: any }) => {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(arg),
  });

  if (!res.ok) {
    const error = new Error('An error occurred while posting data.');
    const errorInfo = await res.json().catch(() => ({ message: res.statusText }));
    (error as any).info = errorInfo;
    (error as any).status = res.status;
    throw error;
  }

  return res.json();
};

// ============== SWR PROVIDER ==============

export function SWRProvider({ children }: SWRProviderProps) {
  return (
    <SWRConfig
      value={{
        fetcher,
        // Revalidation settings
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
        revalidateIfStale: true,
        
        // Deduplication - prevent duplicate requests within 2s
        dedupingInterval: 2000,
        
        // Focus throttle - minimum 5s between focus revalidations
        focusThrottleInterval: 5000,
        
        // Error retry with exponential backoff
        errorRetryCount: 3,
        errorRetryInterval: 5000,
        onErrorRetry: (error, key, config, revalidate, { retryCount }) => {
          // Never retry on 404 or 403
          if ((error as any)?.status === 404) return;
          if ((error as any)?.status === 403) return;
          
          // Only retry up to 3 times
          if (retryCount >= 3) return;
          
          // Exponential backoff: 5s, 10s, 20s
          const delay = Math.min(5000 * Math.pow(2, retryCount), 30000);
          setTimeout(() => revalidate({ retryCount }), delay);
        },
        
        // Loading timeout
        loadingTimeout: 10000,
        
        // Keep previous data while revalidating
        keepPreviousData: true,
        
        // Global error handler
        onError: (error, key) => {
          if ((error as any)?.status === 403) {
            console.warn('[SWR] Access denied:', key);
          } else if ((error as any)?.status !== 404) {
            console.error('[SWR] Error fetching:', key, error);
          }
        },
        
        // Suspense mode (opt-in per hook)
        suspense: false,
      }}
    >
      {children}
    </SWRConfig>
  );
}

export default SWRProvider;
