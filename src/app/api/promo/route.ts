import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireAdmin } from '@/lib/auth';
import { getShopConfig } from '@/lib/filebase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/promo - Validate a promo code
 * Body: { code: string, subtotal: number }
 */
export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await req.json();
    const { code, subtotal } = body;

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'กรุณากรอกรหัสส่วนลด' }, { status: 400 });
    }

    const config = await getShopConfig();
    if (!config?.promoCodes?.length) {
      return NextResponse.json({ error: 'รหัสส่วนลดไม่ถูกต้อง' }, { status: 400 });
    }

    const normalizedCode = code.trim().toUpperCase();
    const promo = config.promoCodes.find(
      (p: { code: string; enabled: boolean; [key: string]: any }) => p.code.toUpperCase() === normalizedCode && p.enabled
    );

    if (!promo) {
      return NextResponse.json({ error: 'รหัสส่วนลดไม่ถูกต้อง' }, { status: 400 });
    }

    // Check expiry
    if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) {
      return NextResponse.json({ error: 'รหัสส่วนลดหมดอายุแล้ว' }, { status: 400 });
    }

    // Check usage limit
    if (promo.usageLimit != null && (promo.usageCount || 0) >= promo.usageLimit) {
      return NextResponse.json({ error: 'รหัสส่วนลดถูกใช้ครบจำนวนแล้ว' }, { status: 400 });
    }

    // Check minimum order amount
    const orderSubtotal = Number(subtotal) || 0;
    if (promo.minOrderAmount && orderSubtotal < promo.minOrderAmount) {
      return NextResponse.json({
        error: `ยอดสั่งซื้อขั้นต่ำ ฿${promo.minOrderAmount.toLocaleString()} เพื่อใช้รหัสนี้`,
      }, { status: 400 });
    }

    // Calculate discount
    let discount = 0;
    if (promo.discountType === 'percent') {
      discount = Math.round(orderSubtotal * (promo.discountValue / 100));
      if (promo.maxDiscount) {
        discount = Math.min(discount, promo.maxDiscount);
      }
    } else {
      discount = promo.discountValue;
    }

    // Never more than subtotal
    discount = Math.min(discount, orderSubtotal);

    return NextResponse.json({
      valid: true,
      code: promo.code,
      discountType: promo.discountType,
      discountValue: promo.discountValue,
      discount,
      description: promo.description || (promo.discountType === 'percent'
        ? `ลด ${promo.discountValue}%${promo.maxDiscount ? ` (สูงสุด ฿${promo.maxDiscount})` : ''}`
        : `ลด ฿${promo.discountValue}`),
    });
  } catch (error: any) {
    console.error('[Promo API] Error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
