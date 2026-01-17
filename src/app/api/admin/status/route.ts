import { NextRequest, NextResponse } from 'next/server';
import { getJson, putJson, listKeys } from '@/lib/filebase';
import { requireAdmin } from '@/lib/auth';
import { triggerSheetSync } from '@/lib/sheet-sync';

export async function POST(req: NextRequest) {
  // ตรวจสอบสิทธิ์ Admin
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const body = await req.json();
    const ref = body?.ref as string | undefined;
    const status = body?.status as string | undefined;
    if (!ref || !status) return NextResponse.json({ status: 'error', message: 'missing ref/status' }, { status: 400 });
    const keys = await listKeys('orders/');
    const targetKey = keys.find((k) => k.endsWith(`${ref}.json`));
    if (!targetKey) return NextResponse.json({ status: 'error', message: 'order not found' }, { status: 404 });
    const order = await getJson<any>(targetKey);
    if (order) {
      order.status = status;
      await putJson(targetKey, order);
    }
    // Auto sync to Google Sheets
    triggerSheetSync().catch(() => {});
    return NextResponse.json({ status: 'success' });
  } catch (error: any) {
    return NextResponse.json({ status: 'error', message: error?.message || 'update failed' }, { status: 500 });
  }
}
