import { NextRequest, NextResponse } from 'next/server';
import { getJson, putJson } from '@/lib/filebase';
import crypto from 'crypto';
import { requireAuth, isResourceOwner, isAdminEmail } from '@/lib/auth';

const cartKey = (email: string) => `carts/${crypto.createHash('sha256').update(email.toLowerCase()).digest('hex')}.json`;

export async function GET(req: NextRequest) {
  // ตรวจสอบว่าเข้าสู่ระบบแล้ว
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const email = req.nextUrl.searchParams.get('email');
  if (!email) return NextResponse.json({ status: 'error', message: 'missing email' }, { status: 400 });

  // ตรวจสอบว่าเป็นเจ้าของหรือเป็น admin
  const currentEmail = authResult.email;
  if (!isResourceOwner(email, currentEmail) && !isAdminEmail(currentEmail)) {
    return NextResponse.json({ status: 'error', message: 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' }, { status: 403 });
  }

  const data = await getJson(cartKey(email));
  return NextResponse.json({ status: 'success', data: { cart: data || [] } });
}

export async function POST(req: NextRequest) {
  // ตรวจสอบว่าเข้าสู่ระบบแล้ว
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const body = await req.json();
    const email = body?.email as string | undefined;
    const cart = body?.cart as any[] | undefined;
    if (!email || !cart) return NextResponse.json({ status: 'error', message: 'missing email/cart' }, { status: 400 });

    // ตรวจสอบว่าเป็นเจ้าของหรือเป็น admin
    const currentEmail = authResult.email;
    if (!isResourceOwner(email, currentEmail) && !isAdminEmail(currentEmail)) {
      return NextResponse.json({ status: 'error', message: 'ไม่มีสิทธิ์แก้ไขข้อมูลนี้' }, { status: 403 });
    }

    await putJson(cartKey(email), cart);
    return NextResponse.json({ status: 'success' });
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      message: error?.message || 'save failed',
      error: typeof error === 'object' ? error : { detail: String(error) },
    }, { status: 500 });
  }
}
