import { NextRequest, NextResponse } from 'next/server';
import { getRedisClient } from '@/lib/redis';
import { getOrderByRef } from '@/lib/filebase';

export const runtime = 'edge';

export async function GET(req: NextRequest, { params }: { params: { ref: string } }) {
  const { ref } = params;
  if (!ref) {
    return NextResponse.json({ error: 'Missing ref' }, { status: 400 });
  }

  try {
    const redis = getRedisClient();
    if (redis) {
      const status = await redis.get(`order_status:${ref}`);
      if (status) {
        return NextResponse.json({ status });
      }
    }

    // Fallback: Check if order exists in DB
    const order = await getOrderByRef(ref);
    if (order) {
      return NextResponse.json({ status: 'ready_for_payment' });
    }

    return NextResponse.json({ status: 'pending' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch status' }, { status: 500 });
  }
}
