import { getShopConfig } from '@/lib/filebase';
import { getShopById } from '@/lib/shops';

type PromoRecord = {
  code: string;
  enabled: boolean;
  expiresAt?: string;
  usageLimit?: number;
  usageCount?: number;
  minOrderAmount?: number;
  discountType: 'percent' | 'fixed' | string;
  discountValue: number;
  maxDiscount?: number;
};

export async function computePromoDiscount(options: {
  code?: string | null;
  subtotal: number;
  shopId?: string | null;
}): Promise<{ discount: number; code?: string }> {
  const code = options.code?.trim();
  if (!code || options.subtotal <= 0) return { discount: 0 };

  let promoCodes: PromoRecord[] = [];
  if (options.shopId) {
    const shop = await getShopById(options.shopId);
    promoCodes = (shop?.config?.promoCodes as PromoRecord[]) || [];
  } else {
    const config = await getShopConfig();
    promoCodes = config?.promoCodes || [];
  }

  const normalizedCode = code.toUpperCase();
  const promo = promoCodes.find((p) => p.code?.toUpperCase() === normalizedCode && p.enabled);
  if (!promo) return { discount: 0 };

  if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) return { discount: 0 };
  if (promo.usageLimit != null && (promo.usageCount || 0) >= promo.usageLimit) return { discount: 0 };
  if (promo.minOrderAmount && options.subtotal < promo.minOrderAmount) return { discount: 0 };

  let discount = 0;
  if (promo.discountType === 'percent') {
    discount = Math.round(options.subtotal * (promo.discountValue / 100));
    if (promo.maxDiscount) discount = Math.min(discount, promo.maxDiscount);
  } else {
    discount = promo.discountValue;
  }

  return { discount: Math.min(Math.max(0, discount), options.subtotal), code: promo.code };
}
