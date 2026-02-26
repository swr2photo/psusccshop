// src/app/api/support-chat/settings/route.ts
// Chat settings API (Admin only) — Prisma

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isAdminEmail } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_SETTINGS = {
  admin_display_name: 'ทีมงาน PSU SCC',
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
    
    const data = await prisma.config.findUnique({
      where: { key: 'support_chat_settings' },
    });
    
    return NextResponse.json({ 
      settings: (data?.value as any) || DEFAULT_SETTINGS 
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
    const merged = { ...DEFAULT_SETTINGS, ...settings };
    
    await prisma.config.upsert({
      where: { key: 'support_chat_settings' },
      update: { value: merged as any },
      create: { key: 'support_chat_settings', value: merged as any },
    });
    
    return NextResponse.json({ success: true, settings: merged });
    
  } catch (error: any) {
    console.error('[support-chat/settings] POST error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
