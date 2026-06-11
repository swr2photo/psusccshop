/**
 * Fast order lookup by ref — uses DB index instead of listKeys scan.
 */
import { getOrderByRef, updateOrderByRef } from '@/lib/supabase';

export { getOrderByRef, updateOrderByRef };

/** Legacy helper: returns order object or null (replaces listKeys + getJson pattern). */
export async function resolveOrderByRef(ref: string): Promise<any | null> {
  if (!ref?.trim()) return null;
  const order = await getOrderByRef(ref.trim());
  return order ?? null;
}

export async function deleteOrderByRef(ref: string): Promise<void> {
  const { deleteObject } = await import('@/lib/filebase');
  await deleteObject(`orders/${ref}.json`);
}
export async function userOwnsTrackingNumber(
  email: string,
  trackingNumber: string,
  isAdmin: boolean
): Promise<boolean> {
  if (isAdmin) return true;
  const normalized = trackingNumber.trim().toUpperCase();
  if (!normalized) return false;

  const { getOrdersByEmail } = await import('@/lib/supabase');
  const { orders: userOrders } = await getOrdersByEmail(email, { limit: 200 });
  return userOrders.some((order: Record<string, unknown>) => {
    const tn = String(
      order.trackingNumber ?? order.tracking_number ?? order.tracking ?? ''
    )
      .trim()
      .toUpperCase();
    return tn === normalized;
  });
}
