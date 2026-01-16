import { NextRequest, NextResponse } from 'next/server';
import { getJson, putJson } from '@/lib/filebase';
import { ShopConfig } from '@/lib/config';

const CONFIG_KEY = 'config/shop-settings.json';

const DEFAULT_CONFIG: ShopConfig = {
  isOpen: true,
  closeDate: '',
  announcement: { enabled: false, message: '', color: 'blue' },
  products: [],
  sheetId: '',
  sheetUrl: '',
  bankAccount: { bankName: '', accountName: '', accountNumber: '' },
};

export async function GET() {
  const cfg = (await getJson<ShopConfig>(CONFIG_KEY)) || DEFAULT_CONFIG;
  return NextResponse.json({ status: 'success', data: cfg });
}

export async function POST(req: NextRequest) {
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
