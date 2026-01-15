import { NextRequest, NextResponse } from 'next/server';
import { getJson, putJson } from '@/lib/filebase';
import crypto from 'crypto';

const cartKey = (email: string) => `carts/${crypto.createHash('sha256').update(email.toLowerCase()).digest('hex')}.json`;

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email');
  if (!email) return NextResponse.json({ status: 'error', message: 'missing email' }, { status: 400 });
  const data = await getJson(cartKey(email));
  return NextResponse.json({ status: 'success', data: { cart: data || [] } });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = body?.email as string | undefined;
    const cart = body?.cart as any[] | undefined;
    if (!email || !cart) return NextResponse.json({ status: 'error', message: 'missing email/cart' }, { status: 400 });
    await putJson(cartKey(email), cart);
    return NextResponse.json({ status: 'success' });
  } catch (error: any) {
    return NextResponse.json({ status: 'error', message: error?.message || 'save failed' }, { status: 500 });
  }
}
