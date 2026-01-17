import { NextRequest, NextResponse } from 'next/server';
import { getJson, putJson } from '@/lib/filebase';
import { ShopConfig } from '@/lib/config';
import { requireAdmin } from '@/lib/auth';

const CONFIG_KEY = 'config/shop-settings.json';

const DEFAULT_CONFIG: ShopConfig = {
  isOpen: true,
  closeDate: '',
  announcement: { enabled: false, message: '', color: 'blue' },
  products: [],
  sheetId: '',
  sheetUrl: '',
  // Keep factory sheet linkage in defaults so it never disappears when config is empty
  vendorSheetId: '',
  vendorSheetUrl: '',
  bankAccount: { bankName: '', accountName: '', accountNumber: '' },
};

export async function GET() {
  const cfg = (await getJson<ShopConfig>(CONFIG_KEY)) || DEFAULT_CONFIG;
  return NextResponse.json({ status: 'success', data: cfg });
}

export async function POST(req: NextRequest) {
  // ตรวจสอบสิทธิ์ Admin - เฉพาะ admin เท่านั้นที่แก้ config ได้
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const body = await req.json();
    const config = body?.config as ShopConfig | undefined;
    if (!config) return NextResponse.json({ status: 'error', message: 'missing config' }, { status: 400 });
    await putJson(CONFIG_KEY, config);
    return NextResponse.json({ status: 'success', data: config });
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      message: error?.message || 'save failed',
      error: typeof error === 'object' ? error : { detail: String(error) },
    }, { status: 500 });
  }
}
