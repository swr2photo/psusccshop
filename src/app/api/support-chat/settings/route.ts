// src/app/api/support-chat/settings/route.ts
// Chat settings API (Admin only)

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isAdminEmail } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_SETTINGS = {
  auto_reply_enabled: true,
  auto_reply_message: 'ขอบคุณที่ติดต่อมา ทีมงานจะตอบกลับโดยเร็วที่สุดค่ะ',
  working_hours_enabled: false,
  working_hours_start: '09:00',
  working_hours_end: '18:00',
  working_hours_message: 'ขณะนี้อยู่นอกเวลาทำการ กรุณาทิ้งข้อความไว้ ทีมงานจะตอบกลับในวันทำการถัดไป',
  quick_replies: [
    'สวัสดีค่ะ มีอะไรให้ช่วยเหลือคะ?',
    'รอสักครู่นะคะ กำลังตรวจสอบให้',
    'ขอบคุณที่รอค่ะ',
    'มีคำถามเพิ่มเติมไหมคะ?',
    'ยินดีให้บริการค่ะ',
  ],
  notification_sound: true,
  notification_desktop: true,
};

// GET: Get chat settings
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email || !isAdminEmail(session.user.email)) {
      return NextResponse.json('Unauthorized', { status: 401 });
    }
    
    const db = getSupabaseAdmin();
    if (!db) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }
    
    // Use 'config' table instead of 'app_settings' (matches existing schema)
    const { data, error } = await db
      .from('config')
      .select('value')
      .eq('key', 'support_chat_settings')
      .single();
    
    // PGRST116 = row not found, which is OK (use defaults)
    if (error && error.code !== 'PGRST116') throw error;
    
    return NextResponse.json({ 
      settings: data?.value || DEFAULT_SETTINGS 
    });
    
  } catch (error: any) {
    console.error('[support-chat/settings] GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: Update chat settings
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email || !isAdminEmail(session.user.email)) {
      return NextResponse.json('Unauthorized', { status: 401 });
    }
    
    const settings = await request.json();
    
    const db = getSupabaseAdmin();
    if (!db) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }
    
    // Upsert settings using 'config' table (matches existing schema)
    const { error } = await db
      .from('config')
      .upsert({
        key: 'support_chat_settings',
        value: { ...DEFAULT_SETTINGS, ...settings },
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'key'
      });
    
    if (error) throw error;
    
    return NextResponse.json({ 
      success: true,
      settings: { ...DEFAULT_SETTINGS, ...settings }
    });
    
  } catch (error: any) {
    console.error('[support-chat/settings] POST error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
