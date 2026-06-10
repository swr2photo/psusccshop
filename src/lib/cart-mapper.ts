import type { CartItem as DrawerCartItem } from '@/lib/shop-constants';
import type { CartItem as ZustandCartItem } from '@/store/cartStore';
import type { Product } from '@/lib/config';

export function zustandCartToDrawerCart(items: ZustandCartItem[]): DrawerCartItem[] {
  return items.map((item) => ({
    id: item.id,
    productId: item.productId || item.id.split('-')[0],
    productName: item.name,
    size: item.size || '-',
    quantity: item.qty,
    unitPrice: item.price,
    options: {
      customName: item.customName,
      customNumber: item.customNumber,
      isLongSleeve: item.sleeve === 'LONG',
      pattern: item.selectedPattern?.name,
      variantId: item.selectedVariant?.id,
      variantName: item.selectedVariant?.name,
    },
  }));
}

export function drawerCartToZustandItem(
  item: DrawerCartItem,
  shopSlug: string,
  products: Product[],
): ZustandCartItem | null {
  const product = products.find((p) => p.id === item.productId);
  if (!product) return null;

  return {
    id: item.id,
    productId: item.productId,
    name: item.productName,
    type: product.type || 'OTHER',
    category: product.category,
    subType: product.subType,
    price: item.unitPrice,
    qty: item.quantity,
    size: item.size,
    total: item.unitPrice * item.quantity,
    shopSlug,
    customName: item.options.customName,
    customNumber: item.options.customNumber,
    sleeve: item.options.isLongSleeve ? 'LONG' : item.options.isLongSleeve === false ? 'SHORT' : undefined,
    selectedPattern: item.options.pattern
      ? product.patterns?.find((p) => p.name === item.options.pattern)
      : undefined,
    selectedVariant: item.options.variantId
      ? product.variants?.find((v) => v.id === item.options.variantId)
      : undefined,
  };
}
