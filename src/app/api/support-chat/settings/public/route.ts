// Public endpoint for customer-facing chat settings — Drizzle ORM

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { config } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { API_CACHE } from '@/lib/api-helpers';
import {
  getCached,
  CACHE_TTL,
  PUBLIC_CHAT_SETTINGS_CACHE_KEY,
} from '@/lib/support-chat-settings-cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET: Get public chat settings (no auth required)
export async function GET() {
  try {
    const payload = await getCached(PUBLIC_CHAT_SETTINGS_CACHE_KEY, CACHE_TTL.chatSettings, async () => {
      const rows = await db.select().from(config).where(eq(config.key, 'support_chat_settings')).limit(1);
      const settings = (rows[0]?.value as Record<string, unknown>) || {};
      return {
        admin_display_name: (settings.admin_display_name as string) || 'ทีมงาน PSU SCC',
      };
    });

    return NextResponse.json(payload, {
      headers: { 'Cache-Control': API_CACHE.medium },
    });
  } catch {
    return NextResponse.json({ admin_display_name: 'ทีมงาน PSU SCC' });
  }
}
