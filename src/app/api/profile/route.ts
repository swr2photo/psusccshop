import { NextRequest, NextResponse } from 'next/server';
import { getJson, putJson } from '@/lib/filebase';
import crypto from 'crypto';
import { requireAuth, normalizeEmail, isResourceOwner, isAdminEmail, getCurrentUserEmail } from '@/lib/auth';

const profileKey = (email: string) => `users/${crypto.createHash('sha256').update(email.toLowerCase()).digest('hex')}.json`;

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
    console.warn("[Profile API] Failed to save user log:", e);
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

  const data = await getJson(profileKey(email));
  return NextResponse.json({ status: 'success', data: { profile: data || {} } });
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
    const data = body?.data;
    if (!email || !data) return NextResponse.json({ status: 'error', message: 'missing email/data' }, { status: 400 });

    // ตรวจสอบว่าเป็นเจ้าของหรือเป็น admin
    const currentEmail = authResult.email;
    if (!isResourceOwner(email, currentEmail) && !isAdminEmail(currentEmail)) {
      return NextResponse.json({ status: 'error', message: 'ไม่มีสิทธิ์แก้ไขข้อมูลนี้' }, { status: 403 });
    }

    await putJson(profileKey(email), data);
    
    // Log profile update
    const userAgent = req.headers.get('user-agent') || undefined;
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 
                     req.headers.get('x-real-ip') || undefined;
    await saveUserLogServer({
      email,
      name: data.name,
      action: 'profile_update',
      details: 'อัปเดตโปรไฟล์',
      metadata: { 
        hasName: !!data.name,
        hasPhone: !!data.phone,
        hasAddress: !!data.address,
        hasInstagram: !!data.instagram,
      },
      ip: clientIP,
      userAgent,
    });
    
    return NextResponse.json({ status: 'success', data: { profile: data } });
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      message: error?.message || 'save failed',
      error: typeof error === 'object' ? error : { detail: String(error) },
    }, { status: 500 });
  }
}
