import { NextRequest, NextResponse } from 'next/server';
import { getRedisClient } from '@/lib/redis';
import { getOrderByRef } from '@/lib/filebase';

/** Queue processing stages in order, with time thresholds (ms from queuedAt) */
const STAGES = [
  { key: 'queued',            label: 'รับคำสั่งซื้อ',           thresholdMs: 0 },
  { key: 'validating_stock',  label: 'ตรวจสอบสต็อกสินค้า',     thresholdMs: 800 },
  { key: 'saving',            label: 'บันทึกข้อมูลคำสั่งซื้อ', thresholdMs: 1600 },
  { key: 'ready_for_payment', label: 'เตรียมหน้าชำระเงิน',     thresholdMs: 2400 },
] as const;

/** Total estimated time for the queue process (ms) */
const TOTAL_PROCESS_MS = 3000;

/**
 * Determine current stage based on elapsed time.
 * When a real worker is active it updates stage in Redis,
 * but when mocked we derive stage purely from time.
 */
function deriveStage(elapsedMs: number, storedStage?: string) {
  // If worker wrote a real stage, prefer it
  if (storedStage && storedStage !== 'queued') {
    const idx = STAGES.findIndex((s) => s.key === storedStage);
    if (idx !== -1) return idx;
  }
  // Time-based derivation (used in mock mode)
  for (let i = STAGES.length - 1; i >= 0; i--) {
    if (elapsedMs >= STAGES[i].thresholdMs) return i;
  }
  return 0;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  if (!ref) {
    return NextResponse.json({ error: 'Missing ref' }, { status: 400 });
  }

  try {
    const redis = getRedisClient();

    if (redis) {
      try {
        const [status, queueRaw, activeRaw] = await Promise.all([
          redis.get(`order_status:${ref}`),
          redis.get(`order_queue:${ref}`),
          redis.get('queue:active'),
        ]);

        // ── Already completed by real worker ──
        if (status === 'ready_for_payment') {
          return NextResponse.json({
            status: 'ready_for_payment',
            queue: null,
            stages: STAGES.map((s) => ({ key: s.key, label: s.label, done: true })),
          });
        }

        // ── In queue — derive stage from time ──
        if (status === 'queued' || queueRaw) {
          const meta = typeof queueRaw === 'string'
            ? JSON.parse(queueRaw)
            : queueRaw ?? {};
          const activeCount = Math.max(1, Number(activeRaw) || 1);
          const queuedAt = meta.queuedAt || new Date().toISOString();
          const elapsedMs = Date.now() - new Date(queuedAt).getTime();
          const estimatedTotalMs = TOTAL_PROCESS_MS * activeCount;

          // Derive current stage from elapsed time (works without worker)
          const currentIdx = deriveStage(elapsedMs, meta.stage);
          const isComplete = elapsedMs >= TOTAL_PROCESS_MS;

          if (isComplete) {
            // Auto-promote to ready_for_payment & cleanup
            await Promise.all([
              redis.set(`order_status:${ref}`, 'ready_for_payment', { ex: 3600 }),
              redis.del(`order_queue:${ref}`),
              redis.decr('queue:active').catch(() => {}),
            ]).catch(() => {});

            return NextResponse.json({
              status: 'ready_for_payment',
              queue: null,
              stages: STAGES.map((s) => ({ key: s.key, label: s.label, done: true })),
            });
          }

          const remainingMs = Math.max(0, estimatedTotalMs - elapsedMs);

          return NextResponse.json({
            status: 'queued',
            queue: {
              position: meta.position ?? 1,
              activeInQueue: activeCount,
              queuedAt,
              elapsedMs,
              estimatedTotalMs,
              remainingMs,
              stage: STAGES[currentIdx].key,
              stageLabel: STAGES[currentIdx].label,
            },
            stages: STAGES.map((s, i) => ({
              key: s.key,
              label: s.label,
              done: i < currentIdx,
              active: i === currentIdx,
            })),
          });
        }
      } catch (redisError) {
        console.warn('[Status API] Redis unavailable, falling back to DB:', redisError);
      }
    }

    // Fallback: Check if order exists in DB
    const order = await getOrderByRef(ref);
    if (order) {
      return NextResponse.json({
        status: 'ready_for_payment',
        queue: null,
        stages: STAGES.map((s) => ({ key: s.key, label: s.label, done: true })),
      });
    }

    return NextResponse.json({
      status: 'pending',
      queue: null,
      stages: [],
    });
  } catch (error: any) {
    const url = process.env.UPSTASH_REDIS_REST_URL || 'missing';
    console.error('[Status API] Error:', error, 'URL:', url);
    return NextResponse.json({ 
      error: 'Failed to fetch status', 
      details: error.message, 
      cause: error.cause?.message || String(error.cause)
    }, { status: 500 });
  }
}
