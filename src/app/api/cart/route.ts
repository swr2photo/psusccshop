import { NextRequest, NextResponse } from 'next/server';
import { getJson, putJson } from '@/lib/filebase';
import crypto from 'crypto';
import { requireAuth, isResourceOwner, isAdminEmail } from '@/lib/auth';

const cartKey = (email: string) => `carts/${crypto.createHash('sha256').update(email.toLowerCase()).digest('hex')}.json`;

// Helper to save user log server-side
async function saveUserLogServer(log: {
  email: string;
  name?: string;
  action: string;
  details?: string;
  metadata?: Record<string, any>;
  ip?: string;
  userAgent?: string;
}) {
  try {
    const id = `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const fullLog = {
      ...log,
      id,
      timestamp: new Date().toISOString(),
    };
    await putJson(`user-logs/${id}.json`, fullLog);
  } catch (e) {
    console.warn("[Cart API] Failed to save user log:", e);
  }
}

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

    // Get old cart for comparison
    const oldCart = (await getJson(cartKey(email))) || [];
    
    await putJson(cartKey(email), cart);
    
    // Log cart change (only if items changed significantly)
    const oldCount = Array.isArray(oldCart) ? oldCart.length : 0;
    const newCount = cart.length;
    if (oldCount !== newCount) {
      const userAgent = req.headers.get('user-agent') || undefined;
      const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 
                       req.headers.get('x-real-ip') || undefined;
      const action = newCount > oldCount ? 'add_to_cart' : 'remove_from_cart';
      await saveUserLogServer({
        email,
        action,
        details: newCount > oldCount 
          ? `เพิ่มสินค้าลงตะกร้า (${newCount} รายการ)` 
          : `ลบสินค้าจากตะกร้า (${newCount} รายการ)`,
        metadata: { 
          itemCount: newCount,
          previousCount: oldCount,
        },
        ip: clientIP,
        userAgent,
      });
    }
    
    return NextResponse.json({ status: 'success' });
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      message: error?.message || 'save failed',
      error: typeof error === 'object' ? error : { detail: String(error) },
    }, { status: 500 });
  }
}
