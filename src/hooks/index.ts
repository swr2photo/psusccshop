// Hooks exports
export { useToast, TOAST_STYLES, TOAST_ANIMATION_CSS } from './useToast';
export type { ToastType, ToastMessage, ToastOptions } from './useToast';
export { usePushNotification } from './usePushNotification';
export type { PushPermissionState } from './usePushNotification';

// Screenshot protection hooks
export { 
  default as useScreenshotProtection,
  useDisableRightClick,
  useDisableDrag,
} from './useScreenshotProtection';

// Realtime hooks
export { 
  useRealtimeOrders,
  useRealtimeAdminOrders,
  useRealtimeUserOrders,
  useRealtimeOrdersByEmail,
  hashEmail,
} from './useRealtimeOrders';

// SWR Data fetching hooks
export { SWRProvider, fetcher, postFetcher } from './useSWRConfig';
export {
  useAdminData,
  useUpdateOrderStatus,
  useUpdateConfig,
  useUserOrders,
  useProfile,
  useCart,
  usePaymentInfo,
  useShippingOptions,
  useDeleteOrder,
  useUpdateOrder,
  useBatchUpdateStatus,
  useSyncSheet,
  invalidateAdminData,
  invalidateOrder,
  invalidateAll,
  updateOrderInCache,
  removeOrderFromCache,
  saveAdminCacheSWR,
  loadAdminCacheSWR,
  clearAdminCacheSWR,
  CACHE_KEYS,
} from './useAdminData';
export type { AdminOrder, ShopConfig, AdminDataResponse } from './useAdminData';

// Admin Page SWR Integration
export { useAdminDataSWR, useOptimisticOrderUpdate, useOptimisticBatchUpdate } from './useAdminDataSWR';

// User-facing SWR hooks
export {
  useShopConfig,
  useUserProfile,
  useUserCart,
  useUserOrderHistory,
  useShippingOptionsUser,
  usePaymentInfoUser,
  useSubmitOrder,
  USER_CACHE_KEYS,
} from './useShopData';

// Shipping/Tracking SWR hooks
export {
  useShippingOrders,
  useUpdateTracking,
  useTrackShipment,
  useBulkUpdateTracking,
} from './useShippingOrders';

// ============== TANSTACK QUERY (React Query v5) ==============

// TanStack Query Provider
export { 
  TanStackQueryProvider, 
  queryKeys, 
  fetchJSON, 
  postJSON,
  getQueryClient,
} from './useTanStackQuery';

// TanStack Query - Shop/User hooks
export {
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
} from './useQueryShopData';

// TanStack Query - Admin hooks
export {
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
} from './useQueryAdminData';

// ============== PAGE-SPECIFIC SWR HOOKS ==============

// Main shop page hooks
export {
  usePageConfig,
  usePageShipping,
  usePageProfile,
  usePageCart,
  usePageOrderHistory,
  usePageSubmitOrder,
  useShopPageData,
  PAGE_CACHE_KEYS,
} from './usePageData';
