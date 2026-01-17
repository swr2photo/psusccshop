import { NextRequest, NextResponse } from 'next/server';
import { getJson, listKeys } from '@/lib/filebase';
import { ShopConfig } from '@/lib/config';
import { requireAdmin } from '@/lib/auth';

// Ensure Node runtime (uses filebase S3 client) and skip static caching
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CONFIG_KEY = 'config/shop-settings.json';

export async function GET(req: NextRequest) {
  // ตรวจสอบสิทธิ์ Admin
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const cfg = (await getJson<ShopConfig>(CONFIG_KEY)) || {
      isOpen: true,
      closeDate: '',
      announcement: { enabled: false, message: '', color: 'blue' },
      products: [],
      sheetId: '',
      sheetUrl: '',
      // Preserve factory sheet linkage when config file is absent
      vendorSheetId: '',
      vendorSheetUrl: '',
    };
    const keys = await listKeys('orders/');
    const orders = await Promise.all(
      keys.map(async (k) => {
        const data = await getJson<any>(k);
        return data ? { ...data, _key: k } : null;
      })
    );
    return NextResponse.json({ status: 'success', data: { config: cfg, orders: orders.filter(Boolean), logs: [] } });
  } catch (error: any) {
    return NextResponse.json({ status: 'error', message: error?.message || 'load failed' }, { status: 500 });
  }
}
