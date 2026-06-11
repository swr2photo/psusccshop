/**
 * Server-side cart pricing — never trust client unitPrice / totalAmount.
 */

export function resolveUnitPrice(product: Record<string, unknown>, item: Record<string, unknown>): number {
  const size = String(item.size || item.selectedSize || 'M');
  const sizeUpper = size.toUpperCase();

  const sizePricing = product.sizePricing as Record<string, number> | undefined;
  if (sizePricing) {
    if (sizePricing[size] != null) return Number(sizePricing[size]);
    const match = Object.entries(sizePricing).find(([k]) => k.toUpperCase() === sizeUpper);
    if (match) return Number(match[1]);
  }

  const sizes = product.sizes as Array<{ size?: string; name?: string; price?: number }> | undefined;
  if (Array.isArray(sizes)) {
    const entry = sizes.find(
      (s) => String(s.size || s.name || '').toUpperCase() === sizeUpper || s.size === size
    );
    if (entry?.price != null) return Number(entry.price);
  }

  if (product.basePrice != null) return Number(product.basePrice);
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
    const productId = String(item.productId || '');
    const prod = products.find((p) => String(p.id) === productId);
    if (!prod) {
      throw new Error(`สินค้า "${String(item.productName || productId)}" ไม่มีอยู่ในระบบแล้ว`);
    }

    const qty = Math.max(1, Math.min(99, Number(item.quantity || item.qty || 1)));
    const unitPrice = resolveUnitPrice(prod, item);
    if (unitPrice <= 0) {
      throw new Error(`ไม่สามารถคำนวณราคาสินค้า "${String(item.productName || prod.name || productId)}" ได้`);
    }

    const lineTotal = unitPrice * qty;
    subtotal += lineTotal;

    cart.push({
      productId,
      productName: item.productName || prod.name,
      name: item.productName || prod.name,
      size: item.size,
      quantity: qty,
      qty,
      unitPrice,
      price: unitPrice,
      total: lineTotal,
      options: item.options,
      pattern: item.pattern,
      customName: item.customName,
      customNumber: item.customNumber,
      sleeve: item.sleeve,
    });
  }

  return { cart, subtotal };
}

export function clampShippingFee(fee: unknown, subtotal: number): number {
  const n = Number(fee);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, Math.max(200, subtotal));
}
