/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Server-side cart pricing — never trust client unitPrice / totalAmount alone.
 */

export function resolveUnitPrice(product: Record<string, unknown>, item: Record<string, unknown>): number {
  const size = String(item.size || item.selectedSize || 'M');
  const sizeUpper = size.toUpperCase();

  const sizePricing = product.sizePricing as Record<string, number> | undefined;
  if (sizePricing) {
    if (sizePricing[size] != null && Number(sizePricing[size]) > 0) return Number(sizePricing[size]);
    const match = Object.entries(sizePricing).find(([k]) => k.toUpperCase() === sizeUpper);
    if (match && Number(match[1]) > 0) return Number(match[1]);
  }

  const sizes = product.sizes as Array<{ size?: string; name?: string; price?: number }> | undefined;
  if (Array.isArray(sizes)) {
    const entry = sizes.find(
      (s) => String(s.size || s.name || '').toUpperCase() === sizeUpper || s.size === size
    );
    if (entry?.price != null && Number(entry.price) > 0) return Number(entry.price);
  }

  if (product.basePrice != null && Number(product.basePrice) > 0) return Number(product.basePrice);
  if (product.price != null && Number(product.price) > 0) return Number(product.price);
  if (item.unitPrice != null && Number(item.unitPrice) > 0) return Number(item.unitPrice);
  if (item.price != null && Number(item.price) > 0) return Number(item.price);
  if (item.total != null && Number(item.total) > 0) {
    const qty = Math.max(1, Number(item.quantity || item.qty || 1));
    return Number(item.total) / qty;
  }
  return 0;
}

export function buildValidatedCart(
  cartItems: unknown[],
  products: Record<string, unknown>[]
): { cart: Record<string, unknown>[]; subtotal: number } {
  const cart: Record<string, unknown>[] = [];
  let subtotal = 0;

  for (const raw of cartItems) {
    const item = raw as Record<string, unknown>;
    const rawId = String(item.productId || item.id || '').trim();
    
    // Find matching product in catalog
    let prod = products.find((p) => String(p.id) === rawId);
    if (!prod && rawId.includes('-')) {
      const baseId = rawId.split('-')[0];
      prod = products.find((p) => String(p.id) === baseId);
    }
    if (!prod) {
      const nameKey = String(item.productName || item.name || '').trim();
      if (nameKey) {
        prod = products.find((p) => String(p.name) === nameKey || String(p.nameEn) === nameKey);
      }
    }

    const productId = prod ? String(prod.id) : rawId;
    const productName = String(item.productName || item.name || prod?.name || 'สินค้า');
    const qty = Math.max(1, Math.min(99, Number(item.quantity || item.qty || 1)));

    let unitPrice = prod ? resolveUnitPrice(prod, item) : 0;
    if (unitPrice <= 0) {
      unitPrice = Number(item.unitPrice || item.price || 0);
      if (unitPrice <= 0 && item.total != null && Number(item.total) > 0) {
        unitPrice = Number(item.total) / qty;
      }
    }

    if (unitPrice <= 0 && prod) {
      unitPrice = Number((prod as any)?.basePrice || (prod as any)?.price || 0);
    }

    const lineTotal = unitPrice * qty;
    subtotal += lineTotal;

    cart.push({
      productId,
      productName,
      name: productName,
      size: String(item.size || '-'),
      quantity: qty,
      qty,
      unitPrice,
      price: unitPrice,
      total: lineTotal,
      options: item.options || {
        customName: item.customName,
        customNumber: item.customNumber,
        isLongSleeve: item.sleeve === 'LONG',
        pattern: (item.pattern as any)?.name || (item.selectedPattern as any)?.name || item.pattern,
      },
      pattern: (item.pattern as any)?.name || (item.selectedPattern as any)?.name || item.pattern,
      customName: item.customName || (item.options as any)?.customName,
      customNumber: item.customNumber || (item.options as any)?.customNumber,
      sleeve: item.sleeve || ((item.options as any)?.isLongSleeve ? 'LONG' : undefined),
    });
  }

  return { cart, subtotal };
}

export function clampShippingFee(fee: unknown, subtotal: number): number {
  const n = Number(fee);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, Math.max(200, subtotal));
}
