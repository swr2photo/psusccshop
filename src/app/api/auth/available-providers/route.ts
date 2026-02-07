import { NextResponse } from 'next/server';

// Returns a list of enabled OAuth provider IDs based on env vars
export async function GET() {
  const providers: string[] = ['google']; // Google is always enabled

  if (process.env.AZURE_AD_CLIENT_ID && process.env.AZURE_AD_CLIENT_SECRET) {
    providers.push('azure-ad');
  }
  if (process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET) {
    providers.push('facebook');
  }
  if (process.env.APPLE_ID && process.env.APPLE_SECRET) {
    providers.push('apple');
  }
  if (process.env.LINE_CLIENT_ID && process.env.LINE_CLIENT_SECRET) {
    providers.push('line');
  }

  return NextResponse.json({ providers });
}
