import { NextRequest, NextResponse } from 'next/server';
import { getJson, putJson } from '@/lib/filebase';
import crypto from 'crypto';
import { requireAuth, normalizeEmail, isResourceOwner, isAdminEmail, getCurrentUserEmail } from '@/lib/auth';

const emailHash = (email: string) => crypto.createHash('sha256').update(email.toLowerCase()).digest('hex');
const profileKey = (email: string) => `users/${emailHash(email)}.json`;
const profileExtrasKey = (email: string) => `profile-extras/${emailHash(email)}.json`;

// Fields stored in the profiles table (has dedicated columns)
const PROFILE_TABLE_FIELDS = ['name', 'phone', 'address', 'instagram'];
// Extra fields stored in key_value_store (no dedicated columns yet)
const EXTRA_FIELDS = ['profileImage', 'theme', 'savedAddresses'];

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
  // Load extra fields (profileImage, theme) from key_value_store
  let extras: Record<string, any> = {};
  try {
    extras = (await getJson(profileExtrasKey(email))) || {};
  } catch { /* ignore - extras may not exist */ }
  const merged = { ...(data || {}), ...extras };
  return NextResponse.json({ status: 'success', data: { profile: merged } });
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

    // Separate profile table fields from extra fields
    const profileData: Record<string, any> = {};
    const extrasData: Record<string, any> = {};
    for (const [k, v] of Object.entries(data)) {
      if (EXTRA_FIELDS.includes(k)) {
        extrasData[k] = v;
      } else {
        profileData[k] = v;
      }
    }

    // Merge and save profile table fields
    const existing = await getJson(profileKey(email)) || {};
    const mergedProfile = { ...existing, ...profileData };
    await putJson(profileKey(email), mergedProfile);

    // Merge and save extra fields (profileImage, theme) to key_value_store
    if (Object.keys(extrasData).length > 0) {
      let existingExtras: Record<string, any> = {};
      try { existingExtras = (await getJson(profileExtrasKey(email))) || {}; } catch { /* ignore */ }
      const mergedExtras = { ...existingExtras, ...extrasData };
      await putJson(profileExtrasKey(email), mergedExtras);
    }

    const merged = { ...mergedProfile, ...extrasData };
    
    // Log profile update
    const userAgent = req.headers.get('user-agent') || undefined;
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 
                     req.headers.get('x-real-ip') || undefined;
    await saveUserLogServer({
      email,
      name: merged.name,
      action: 'profile_update',
      details: 'อัปเดตโปรไฟล์',
      metadata: { 
        hasName: !!merged.name,
        hasPhone: !!merged.phone,
        hasAddress: !!merged.address,
        hasInstagram: !!merged.instagram,
        hasProfileImage: !!extrasData.profileImage,
        hasTheme: !!extrasData.theme,
      },
      ip: clientIP,
      userAgent,
    });
    
    return NextResponse.json({ status: 'success', data: { profile: merged } });
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      message: error?.message || 'save failed',
      error: typeof error === 'object' ? error : { detail: String(error) },
    }, { status: 500 });
  }
}
