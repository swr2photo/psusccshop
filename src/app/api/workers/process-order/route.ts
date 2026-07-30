import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { getRedisClient } from '@/lib/redis';
import { putJson } from '@/lib/filebase';
import { triggerSheetSync } from '@/lib/sheet-sync';

// Security: In a real app, verify QStash signature here using @upstash/qstash Receiver.
// For now, we assume the POST comes from QStash or internal edge.

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const { order, ref, key } = payload;
    
    if (!order || !ref || !key) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    // Insert to DB / Filebase
    await putJson(key, order);
    
    // Attempt sheet sync
    triggerSheetSync().catch(() => {});

    // Update Redis Status
    const redis = getRedisClient();
    if (redis) {
      await redis.set(`order_status:${ref}`, 'ready_for_payment', { ex: 3600 });
    }

    return NextResponse.json({ success: true, ref });
  } catch (err: any) {
    console.error('[Worker API] Failed to process order:', err);
    return NextResponse.json({ error: 'DB Insert Failed' }, { status: 500 });
  }
}
