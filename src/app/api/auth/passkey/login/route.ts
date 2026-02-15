// src/app/api/auth/passkey/login/route.ts
// Passkey authentication endpoints (NO auth required — this IS the login flow)
// POST { action: 'login-options' } → generate challenge
// POST { action: 'login-verify', challengeId, assertion } → verify & return token

import { NextRequest, NextResponse } from 'next/server';
import {
  generatePasskeyAuthenticationOptions,
  verifyPasskeyAuthentication,
  createPasskeyLoginToken,
} from '@/lib/passkey';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action } = body;

  // Step 1: Generate authentication options
  if (action === 'login-options') {
    try {
      const { options, challengeId } = await generatePasskeyAuthenticationOptions();
      return NextResponse.json({ options, challengeId });
    } catch (err: any) {
      console.error('[Passkey] Login options error:', err);
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }

  // Step 2: Verify authentication response
  if (action === 'login-verify') {
    const { challengeId, assertion } = body;
    if (!challengeId || !assertion) {
      return NextResponse.json({ error: 'Missing challengeId or assertion' }, { status: 400 });
    }

    try {
      const result = await verifyPasskeyAuthentication(challengeId, assertion);

      if (result.verified && result.userEmail) {
        // Create a short-lived token for NextAuth CredentialsProvider
        const token = await createPasskeyLoginToken(result.userEmail);

        return NextResponse.json({
          verified: true,
          token,
          email: result.userEmail,
        });
      }

      return NextResponse.json({
        verified: false,
        error: 'Authentication failed',
      }, { status: 401 });
    } catch (err: any) {
      console.error('[Passkey] Login verify error:', err);
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
