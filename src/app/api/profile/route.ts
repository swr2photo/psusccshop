import { NextRequest, NextResponse } from 'next/server';
import { getJson, putJson } from '@/lib/filebase';
import crypto from 'crypto';

const profileKey = (email: string) => `users/${crypto.createHash('sha256').update(email.toLowerCase()).digest('hex')}.json`;

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email');
  if (!email) return NextResponse.json({ status: 'error', message: 'missing email' }, { status: 400 });
  const data = await getJson(profileKey(email));
  return NextResponse.json({ status: 'success', data: { profile: data || {} } });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = body?.email as string | undefined;
    const data = body?.data;
    if (!email || !data) return NextResponse.json({ status: 'error', message: 'missing email/data' }, { status: 400 });
    await putJson(profileKey(email), data);
    return NextResponse.json({ status: 'success', data: { profile: data } });
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      message: error?.message || 'save failed',
      error: typeof error === 'object' ? error : { detail: String(error) },
    }, { status: 500 });
  }
}
