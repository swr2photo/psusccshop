import { NextRequest, NextResponse } from 'next/server';
import { requireAdminWithPermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { webhookEndpoints } from '@/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authResult = await requireAdminWithPermission('canManageShop', req);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const endpoints = await db.select().from(webhookEndpoints);
    return NextResponse.json({ status: 'success', data: endpoints });
  } catch (error: any) {
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authResult = await requireAdminWithPermission('canManageShop', req);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const body = await req.json();
    const secret = crypto.randomBytes(32).toString('hex');
    
    await db.insert(webhookEndpoints).values({
      url: body.url,
      events: body.events || ['*'],
      secret: secret,
      shopId: body.shopId || null,
    });

    return NextResponse.json({ status: 'success', message: 'Webhook endpoint created', secret });
  } catch (error: any) {
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const authResult = await requireAdminWithPermission('canManageShop', req);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    
    if (!id) return NextResponse.json({ status: 'error', message: 'Missing ID' }, { status: 400 });

    await db.delete(webhookEndpoints).where(eq(webhookEndpoints.id, id));

    return NextResponse.json({ status: 'success', message: 'Webhook endpoint deleted' });
  } catch (error: any) {
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
