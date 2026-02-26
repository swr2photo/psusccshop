// src/app/api/support-chat/settings/public/route.ts
// Public endpoint for customer-facing chat settings — Prisma

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET: Get public chat settings (no auth required)
export async function GET() {
  try {
    const data = await prisma.config.findUnique({
      where: { key: 'support_chat_settings' },
    });

    const settings = (data?.value as any) || {};

    return NextResponse.json({
      admin_display_name: settings.admin_display_name || 'ทีมงาน PSU SCC',
    });
  } catch {
    return NextResponse.json({ admin_display_name: 'ทีมงาน PSU SCC' });
  }
}
