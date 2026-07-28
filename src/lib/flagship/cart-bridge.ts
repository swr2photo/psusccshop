import type { CartItem } from '@/lib/shop-constants';

const QUEUE_KEY = 'scc_flagship_cart_queue';

/** Queue cart items from the flagship page so the home storefront can merge them. */
export function queueFlagshipCartItems(items: CartItem[]): void {
  if (typeof window === 'undefined' || items.length === 0) return;
  try {
    const existing = flushFlagshipCartQueue(false);
    const next = [...existing, ...items];
    window.sessionStorage.setItem(QUEUE_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * Read and optionally clear the pending flagship cart queue.
 * Home page should call this on mount and merge into its cart state.
 */
export function flushFlagshipCartQueue(clear = true): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.sessionStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    if (clear) window.sessionStorage.removeItem(QUEUE_KEY);
    return parsed.filter(
      (item): item is CartItem =>
        item &&
        typeof item === 'object' &&
        typeof item.productId === 'string' &&
        typeof item.productName === 'string' &&
        typeof item.unitPrice === 'number',
    );
  } catch {
    return [];
  }
}
