'use client';

/**
 * Example: How to use SWR hooks in Admin Page
 * 
 * This file shows the standard pattern for data fetching
 * that can be used to refactor the admin page.
 */

import { useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { 
  useAdminData, 
  useUpdateOrderStatus, 
  useUpdateConfig,
  invalidateAdminData,
} from '@/hooks/useAdminData';
import { useRealtimeAdminOrders } from '@/hooks/useRealtimeOrders';

/**
 * Example Admin Dashboard Component using SWR
 */
export function useAdminDashboard() {
  const { data: session } = useSession();
  const adminEmail = session?.user?.email || '';

  // ============== DATA FETCHING ==============
  
  // Fetch admin data with SWR (automatic caching, revalidation, deduplication)
  const {
    orders,
    config,
    logs,
    isLoading,
    isRefreshing,
    isOffline,
    error,
    refresh,
  } = useAdminData({
    enabled: !!adminEmail,
    refreshInterval: 120000, // 2 minutes background refresh
    onSuccess: (data) => {
      console.log('[Admin] Data loaded successfully');
    },
    onError: (err) => {
      console.warn('[Admin] Failed to load data, using cache');
    },
  });

  // ============== MUTATIONS ==============
  
  // Update order status with optimistic updates
  const { updateStatus, isUpdating: isStatusUpdating } = useUpdateOrderStatus();
  
  // Update config with optimistic updates
  const { updateConfig, isUpdating: isConfigUpdating } = useUpdateConfig();

  // ============== REALTIME ==============
  
  // Handle realtime order changes
  const handleRealtimeChange = useCallback((change: any) => {
    console.log('[Realtime] Order changed:', change.type, change.order?.ref);
    // SWR will automatically merge the data
    // Just invalidate to trigger a background revalidation
    invalidateAdminData();
  }, []);

  const { isConnected: realtimeConnected } = useRealtimeAdminOrders(handleRealtimeChange);

  // ============== ACTIONS ==============

  // Update order status (optimistic by default)
  const handleUpdateOrderStatus = async (ref: string, newStatus: string) => {
    try {
      await updateStatus(ref, newStatus, adminEmail, { optimistic: true });
      console.log(`Order ${ref} updated to ${newStatus}`);
    } catch (err) {
      console.error('Failed to update order:', err);
    }
  };

  // Update shop config (optimistic by default)
  const handleUpdateConfig = async (newConfig: any) => {
    try {
      await updateConfig(newConfig, adminEmail, { optimistic: true });
      console.log('Config updated');
    } catch (err) {
      console.error('Failed to update config:', err);
    }
  };

  // Manual refresh
  const handleRefresh = () => {
    refresh();
  };

  return {
    // Data
    orders,
    config,
    logs,
    
    // Loading states
    isLoading,
    isRefreshing,
    isStatusUpdating,
    isConfigUpdating,
    isOffline,
    error,
    
    // Realtime
    realtimeConnected,
    
    // Actions
    updateOrderStatus: handleUpdateOrderStatus,
    updateConfig: handleUpdateConfig,
    refresh: handleRefresh,
  };
}

/**
 * Usage Example in a component:
 * 
 * ```tsx
 * function AdminDashboard() {
 *   const {
 *     orders,
 *     config,
 *     isLoading,
 *     isRefreshing,
 *     realtimeConnected,
 *     updateOrderStatus,
 *     refresh,
 *   } = useAdminDashboard();
 * 
 *   if (isLoading) return <LoadingSpinner />;
 * 
 *   return (
 *     <div>
 *       <Header>
 *         {isRefreshing && <Spinner size="sm" />}
 *         {realtimeConnected ? 'Live' : 'Polling'}
 *         <button onClick={refresh}>Refresh</button>
 *       </Header>
 *       
 *       <OrderList 
 *         orders={orders}
 *         onStatusChange={(ref, status) => updateOrderStatus(ref, status)}
 *       />
 *     </div>
 *   );
 * }
 * ```
 * 
 * Benefits:
 * 1. Automatic caching - data is cached and reused
 * 2. Deduplication - multiple components can use same hook, only 1 request
 * 3. Optimistic updates - UI updates instantly, rollback on error
 * 4. Background revalidation - data stays fresh
 * 5. Error retry - automatic retry with exponential backoff
 * 6. Focus revalidation - refresh when user returns to tab
 * 7. Network recovery - refresh when network reconnects
 */

export default useAdminDashboard;
