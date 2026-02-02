# Data Fetching Guide - SWR & TanStack Query

## Overview

โปรเจคนี้รองรับ 2 ระบบ data fetching ที่เป็นมาตรฐานสากล:

1. **SWR** (stale-while-revalidate) - Vercel's data fetching library
2. **TanStack Query** (React Query v5) - Powerful data synchronization

ทั้งสองระบบสามารถใช้งานร่วมกันได้ โดยมี Provider ครบถ้วนใน `Providers.tsx`

---

## 🔄 SWR Hooks

### Admin Hooks (`useAdminData.ts`)

```tsx
import { 
  useAdminData,
  useUpdateOrderStatus,
  useDeleteOrder,
  useBatchUpdateStatus,
  useSyncSheet,
  invalidateAdminData,
  updateOrderInCache,
} from '@/hooks';

// ดึงข้อมูล admin
const { data, error, isLoading, mutate } = useAdminData();

// อัปเดตสถานะ order
const { trigger: updateStatus, isMutating } = useUpdateOrderStatus();
await updateStatus({ ref: 'ORD001', status: 'SHIPPED' });

// ลบ order
const { trigger: deleteOrder } = useDeleteOrder();
await deleteOrder('ORD001');

// Optimistic update
updateOrderInCache('ORD001', { status: 'SHIPPED' });
```

### User/Shop Hooks (`useShopData.ts`)

```tsx
import {
  useShopConfig,
  useUserProfile,
  useUserCart,
  useUserOrderHistory,
  useShippingOptionsUser,
  usePaymentInfoUser,
  useSubmitOrder,
} from '@/hooks';

// Shop config
const { config, isOpen, products, isLoading } = useShopConfig();

// User profile
const { profile, updateProfile } = useUserProfile(email);

// Cart
const { cart, addItem, removeItem, updateQuantity, clearCart } = useUserCart(email);

// Order history
const { orders, refresh } = useUserOrderHistory(email);

// Submit order
const { submitOrder, isSubmitting } = useSubmitOrder();
```

### Page-Specific Hooks (`usePageData.ts`)

```tsx
import {
  usePageConfig,
  usePageShipping,
  usePageProfile,
  usePageCart,
  usePageOrderHistory,
  usePageSubmitOrder,
  useShopPageData, // Combined hook
} from '@/hooks';

// Combined hook for main shop page
const {
  config,
  products,
  isShopOpen,
  shippingConfig,
  profile,
  cart,
  orders,
  isInitialLoading,
  refreshAll,
} = useShopPageData(email);
```

### Shipping/Tracking Hooks (`useShippingOrders.ts`)

```tsx
import {
  useShippingOrders,
  useUpdateTracking,
  useTrackShipment,
  useBulkUpdateTracking,
} from '@/hooks';

// Orders ที่ต้องจัดส่ง
const { orders, isLoading, refresh } = useShippingOrders();

// อัปเดต tracking
const { updateTracking, deleteTracking, isUpdating } = useUpdateTracking();
await updateTracking('ORD001', 'TH123456', 'thailand_post', 'SHIPPED');

// Track พัสดุ
const { trackShipment, isTracking } = useTrackShipment();
const result = await trackShipment('TH123456', 'thailand_post');
```

---

## ⚡ TanStack Query Hooks

### Shop/User Hooks (`useQueryShopData.ts`)

```tsx
import {
  useShopConfigQuery,
  useUserProfileQuery,
  useUpdateProfileMutation,
  useUserCartQuery,
  useUpdateCartMutation,
  useUserOrdersQuery,
  useSubmitOrderMutation,
  useTrackShipmentQuery,
} from '@/hooks';

// Shop config
const { data: config, isLoading, error } = useShopConfigQuery();

// User profile with mutation
const { data: profile } = useUserProfileQuery(email);
const updateProfileMutation = useUpdateProfileMutation();
await updateProfileMutation.mutateAsync({ email, profile: { name: 'New Name' } });

// Cart with optimistic updates
const { data: cart } = useUserCartQuery(email);
const updateCartMutation = useUpdateCartMutation();
await updateCartMutation.mutateAsync({ email, cart: newCart });

// Submit order
const submitOrderMutation = useSubmitOrderMutation();
const result = await submitOrderMutation.mutateAsync(orderData);
```

### Admin Hooks (`useQueryAdminData.ts`)

```tsx
import {
  useAdminDataQuery,
  useAdminOrdersQuery,
  useAdminConfigQuery,
  useUpdateOrderStatusMutation,
  useBatchUpdateStatusMutation,
  useDeleteOrderMutation,
  useUpdateConfigMutation,
  useShippingOrdersQuery,
  useUpdateTrackingMutation,
} from '@/hooks';

// Admin data
const { data, isLoading, refetch } = useAdminDataQuery();

// Orders only
const { data: orders } = useAdminOrdersQuery();

// Update status with optimistic update
const updateStatusMutation = useUpdateOrderStatusMutation();
await updateStatusMutation.mutateAsync({ 
  ref: 'ORD001', 
  status: 'SHIPPED',
  trackingNumber: 'TH123456',
});

// Batch update
const batchMutation = useBatchUpdateStatusMutation();
const { success, failed } = await batchMutation.mutateAsync({
  refs: ['ORD001', 'ORD002'],
  status: 'SHIPPED',
});
```

---

## 🎯 Best Practices

### 1. เลือกระบบที่เหมาะสม

| Feature | SWR | TanStack Query |
|---------|-----|----------------|
| Bundle Size | ~4KB | ~13KB |
| DevTools | ไม่มี | มี (excellent) |
| Infinite Query | ง่าย | ดีมาก |
| Optimistic Updates | ต้อง manual | built-in |
| Query Invalidation | ใช้ mutate() | ใช้ queryClient |
| Learning Curve | ง่าย | ปานกลาง |

**แนะนำ:**
- หน้า User: ใช้ SWR (เบากว่า)
- หน้า Admin: ใช้ TanStack Query (DevTools ช่วย debug)

### 2. Cache Invalidation

```tsx
// SWR
import { invalidateAdminData, mutate } from '@/hooks';
invalidateAdminData(); // invalidate admin cache
mutate('/api/config'); // invalidate specific key

// TanStack Query
import { getQueryClient, queryKeys } from '@/hooks';
const queryClient = getQueryClient();
queryClient.invalidateQueries({ queryKey: queryKeys.admin.data() });
```

### 3. Optimistic Updates

```tsx
// SWR - manual
updateOrderInCache('ORD001', { status: 'SHIPPED' });

// TanStack Query - built-in in mutation
const mutation = useUpdateOrderStatusMutation();
// onMutate handles optimistic update automatically
```

### 4. Error Handling

```tsx
// SWR
const { data, error, isLoading } = useAdminData();
if (error) return <ErrorComponent error={error} />;

// TanStack Query
const { data, error, isLoading, isError } = useAdminDataQuery();
if (isError) return <ErrorComponent error={error} />;
```

### 5. Background Refetch

```tsx
// SWR - built-in
const { isValidating } = useAdminData();

// TanStack Query
const { isFetching } = useAdminDataQuery();
```

---

## 📁 File Structure

```
src/hooks/
├── index.ts                 # All exports
├── useSWRConfig.tsx         # SWR Provider & config
├── useTanStackQuery.tsx     # TanStack Query Provider & config
├── useAdminData.ts          # SWR admin hooks
├── useAdminDataSWR.ts       # SWR admin page integration
├── useShopData.ts           # SWR user hooks
├── useShippingOrders.ts     # SWR shipping hooks
├── usePageData.ts           # SWR main page hooks
├── useQueryShopData.ts      # TanStack Query user hooks
├── useQueryAdminData.ts     # TanStack Query admin hooks
└── useRealtimeOrders.ts     # Supabase realtime (works with both)
```

---

## 🔧 Configuration

### SWR Global Config (`useSWRConfig.tsx`)

```tsx
const swrConfig = {
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
  errorRetryCount: 3,
  dedupingInterval: 5000,
};
```

### TanStack Query Global Config (`useTanStackQuery.tsx`)

```tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      gcTime: 5 * 60 * 1000,
      retry: 3,
      retryDelay: exponentialBackoff,
    },
  },
});
```

---

## 🚀 Migration Guide

### จาก fetch() ไป SWR

Before:
```tsx
const [data, setData] = useState(null);
const [loading, setLoading] = useState(true);

useEffect(() => {
  fetch('/api/data')
    .then(res => res.json())
    .then(setData)
    .finally(() => setLoading(false));
}, []);
```

After:
```tsx
const { data, isLoading } = useSWR('/api/data', fetcher);
```

### จาก fetch() ไป TanStack Query

Before:
```tsx
const [data, setData] = useState(null);

const handleUpdate = async () => {
  await fetch('/api/data', { method: 'POST', body: JSON.stringify(newData) });
  // Manual refetch
  const res = await fetch('/api/data');
  setData(await res.json());
};
```

After:
```tsx
const { data } = useQuery({ queryKey: ['data'], queryFn: fetchData });
const mutation = useMutation({
  mutationFn: updateData,
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['data'] }),
});
```

---

## 📚 Resources

- [SWR Documentation](https://swr.vercel.app/)
- [TanStack Query Documentation](https://tanstack.com/query/latest)
- [React Query DevTools](https://tanstack.com/query/latest/docs/react/devtools)
