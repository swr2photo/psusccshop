// Public endpoint for customer-facing chat settings — Drizzle ORM

import { NextResponse } from 'next/server';
import { API_CACHE } from '@/lib/api-helpers';
import { formatDbError, getConfigValueCached } from '@/lib/config-db';
import { CACHE_TTL } from '@/lib/server-cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CONFIG_KEY = 'support_chat_settings';
const FALLBACK = { admin_display_name: 'ทีมงาน PSU SCC' };

// GET: Get public chat settings (no auth required)
export async function GET() {
  try {
    const settings = await getConfigValueCached<Record<string, unknown>>(
      CONFIG_KEY,
      CACHE_TTL.chatSettings,
    );

    return NextResponse.json(
      {
        admin_display_name:
          (settings?.admin_display_name as string) || FALLBACK.admin_display_name,
      },
      { headers: { 'Cache-Control': API_CACHE.medium } },
    );
  } catch (error) {
    console.error('[support-chat/public] fallback:', formatDbError(error));
    return NextResponse.json(FALLBACK, {
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
