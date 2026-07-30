import { NextRequest, NextResponse } from 'next/server';
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

    const redis = getRedisClient();

    // Update stage → validating_stock
    if (redis) {
      try {
        const raw = await redis.get(`order_queue:${ref}`);
        const meta = typeof raw === 'string' ? JSON.parse(raw) : raw ?? {};
        meta.stage = 'validating_stock';
        await redis.set(`order_queue:${ref}`, JSON.stringify(meta), { ex: 300 }).catch(() => {});
      } catch (err) {
        console.warn('[Worker API] Failed to update Redis (validating_stock):', err);
      }
    }

    // Insert to DB / Filebase
    // Update stage → saving
    if (redis) {
      try {
        const raw = await redis.get(`order_queue:${ref}`);
        const meta = typeof raw === 'string' ? JSON.parse(raw) : raw ?? {};
        meta.stage = 'saving';
        await redis.set(`order_queue:${ref}`, JSON.stringify(meta), { ex: 300 }).catch(() => {});
      } catch (err) {
        console.warn('[Worker API] Failed to update Redis (saving):', err);
      }
    }

    await putJson(key, order);
    
    // Attempt sheet sync
    triggerSheetSync().catch(() => {});

    // ── Mark complete & cleanup queue tracking ──────────
    if (redis) {
      try {
        await Promise.all([
          redis.set(`order_status:${ref}`, 'ready_for_payment', { ex: 3600 }),
          redis.del(`order_queue:${ref}`),
          redis.decr('queue:active').catch(() => {}),
        ]);
      } catch (err) {
        console.warn('[Worker API] Failed to update Redis (cleanup):', err);
      }
    }

    return NextResponse.json({ success: true, ref });
  } catch (err: any) {
    console.error('[Worker API] Failed to process order:', err);
    return NextResponse.json({ error: 'DB Insert Failed' }, { status: 500 });
  }
}
