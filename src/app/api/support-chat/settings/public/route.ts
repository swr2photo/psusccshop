// src/app/api/support-chat/settings/public/route.ts
// Public endpoint for customer-facing chat settings (admin_display_name only)

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET: Get public chat settings (no auth required)
export async function GET() {
  try {
    const db = getSupabaseAdmin();
    if (!db) {
      return NextResponse.json({ admin_display_name: 'ทีมงาน PSU SCC' });
    }

    const { data, error } = await db
      .from('config')
      .select('value')
      .eq('key', 'support_chat_settings')
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    const settings = data?.value || {};

    // Only expose safe public fields
    return NextResponse.json({
      admin_display_name: settings.admin_display_name || 'ทีมงาน PSU SCC',
    });
  } catch {
    return NextResponse.json({ admin_display_name: 'ทีมงาน PSU SCC' });
  }
}
