// src/app/api/auth/passkey/login/route.ts
// Passkey authentication endpoints (NO auth required — this IS the login flow)
// POST { action: 'login-options' } → generate challenge
// POST { action: 'login-verify', challengeId, assertion } → verify & return token

import { NextRequest, NextResponse } from 'next/server';
import { secureJsonRequest, secureJsonResponse } from '@/lib/payload-crypto';
import {
  generatePasskeyAuthenticationOptions,
  verifyPasskeyAuthentication,
  createPasskeyLoginToken,
} from '@/lib/passkey';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await secureJsonRequest(req);
  const { action } = body;

  // Step 1: Generate authentication options
  if (action === 'login-options') {
    try {
      const { options, challengeId } = await generatePasskeyAuthenticationOptions(req.url);
      return await secureJsonResponse({ options, challengeId });
    } catch (err: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ {
      console.error('[Passkey] Login options error:', err);
      const message = err instanceof Error ? err.message : String(err);
      return await secureJsonResponse({ error: message }, { status: 500 });
    }
  }

  // Step 2: Verify authentication response
  if (action === 'login-verify') {
    const { challengeId, assertion } = body;
    if (!challengeId || !assertion) {
      return await secureJsonResponse({ error: 'Missing challengeId or assertion' }, { status: 400 });
    }

    try {
      const result = await verifyPasskeyAuthentication(challengeId, assertion, req.url);

      if (result.verified && result.userEmail) {
        // Create a short-lived token for NextAuth CredentialsProvider
        const token = await createPasskeyLoginToken(result.userEmail);

        return await secureJsonResponse({
          verified: true,
          token,
          email: result.userEmail,
        });
      }

      return await secureJsonResponse({
        verified: false,
        error: result.error || 'Authentication failed',
      }, { status: 401 });
    } catch (err: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ {
      console.error('[Passkey] Login verify error:', err);
      const message = err instanceof Error ? err.message : String(err);
      return await secureJsonResponse({ error: message }, { status: 400 });
    }
  }

  return await secureJsonResponse({ error: 'Invalid action' }, { status: 400 });
}
