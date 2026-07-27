import type { Product } from '@/lib/config';
import { getProductName } from '@/lib/config';
import { getProductStatus } from '@/components/ShopStatusCard';

export type ReorderBlockReason =
  | 'missing'
  | 'inactive'
  | 'ended'
  | 'upcoming'
  | 'out_of_stock';

export type ReorderItemEval = {
  ok: boolean;
  reason?: ReorderBlockReason;
  name: string;
  product?: Product;
  qty: number;
};

function isStockUnavailable(stock: number | null | undefined, qty: number): boolean {
  if (stock === null || stock === undefined) return false;
  return stock < Math.max(1, qty);
}

/** Evaluate whether a past order line can be re-added to cart. */
export function evaluateReorderItem(
  item: Record<string, unknown>,
  products: Product[] | undefined,
  lang: 'th' | 'en' = 'th'
): ReorderItemEval {
  const qty = Math.max(1, Number(item.qty ?? item.quantity ?? 1) || 1);
  const productId = item.productId != null ? String(item.productId) : '';
  const product = productId
    ? products?.find((p) => p.id === productId)
    : undefined;

  const name =
    (product ? getProductName(product, lang) : null) ||
    String(item.name || item.productName || '') ||
    (lang === 'en' ? 'Unknown product' : 'ไม่ทราบชื่อสินค้า');

  if (!product) {
    return { ok: false, reason: 'missing', name, qty };
  }

  const status = getProductStatus(product);
  if (status === 'ORDER_ENDED') return { ok: false, reason: 'ended', name, product, qty };
  if (status === 'COMING_SOON') return { ok: false, reason: 'upcoming', name, product, qty };
  if (status === 'TEMPORARILY_CLOSED') return { ok: false, reason: 'inactive', name, product, qty };

  const size = String(item.size || '');
  const variants = product.variants?.filter((v) => v.isActive !== false) || [];
  if (variants.length > 0 && size) {
    const variant =
      variants.find((v) => v.id === size || v.name === size) ||
      variants.find((v) => String(v.id) === size);
    if (variant) {
      if (isStockUnavailable(variant.stock, qty)) {
        return { ok: false, reason: 'out_of_stock', name, product, qty };
      }
    }
  }

  if (isStockUnavailable(product.stock, qty)) {
    return { ok: false, reason: 'out_of_stock', name, product, qty };
  }

  // All variants sold out (product-level stock unlimited but every variant empty)
  if (variants.length > 0 && variants.every((v) => isStockUnavailable(v.stock, 1))) {
    return { ok: false, reason: 'out_of_stock', name, product, qty };
  }

  return { ok: true, name, product, qty };
}

const REASON_PRIORITY: ReorderBlockReason[] = [
  'ended',
  'inactive',
  'missing',
  'out_of_stock',
  'upcoming',
];

export function pickPrimaryReorderBlockReason(
  reasons: ReorderBlockReason[]
): ReorderBlockReason | null {
  if (!reasons.length) return null;
  for (const r of REASON_PRIORITY) {
    if (reasons.includes(r)) return r;
  }
  return reasons[0];
}

export function reorderBlockLabel(
  reason: ReorderBlockReason | null | undefined,
  lang: 'th' | 'en'
): string {
  if (lang === 'en') {
    switch (reason) {
      case 'ended':
        return 'Ordering closed';
      case 'out_of_stock':
        return 'Out of stock';
      case 'upcoming':
        return 'Not on sale yet';
      case 'inactive':
      case 'missing':
        return 'Unavailable';
      default:
        return 'Buy again';
    }
  }
  switch (reason) {
    case 'ended':
      return 'หมดเขตสั่งซื้อแล้ว';
    case 'out_of_stock':
      return 'สินค้าหมดชั่วคราว';
    case 'upcoming':
      return 'ยังไม่เปิดขาย';
    case 'inactive':
    case 'missing':
      return 'ไม่พร้อมจำหน่าย';
    default:
      return 'สั่งซื้ออีกครั้ง';
  }
}
