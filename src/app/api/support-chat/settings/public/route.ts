// src/app/api/support-chat/settings/public/route.ts
// Public endpoint for customer-facing chat settings — Drizzle ORM

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { config } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET: Get public chat settings (no auth required)
export async function GET() {
  try {
    const rows = await db.select().from(config).where(eq(config.key, 'support_chat_settings')).limit(1);
    const data = rows[0];

    const settings = (data?.value as any) || {};

    return NextResponse.json({
      admin_display_name: settings.admin_display_name || 'ทีมงาน PSU SCC',
    });
  } catch {
    return NextResponse.json({ admin_display_name: 'ทีมงาน PSU SCC' });
  }
}
