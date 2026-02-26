// src/app/api/auth/passkey/route.ts
// Passkey registration & management endpoints (requires auth)
// GET  - List user's passkeys
// POST - Generate registration options or verify registration
// DELETE - Remove a passkey

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import {
  generatePasskeyRegistrationOptions,
  verifyPasskeyRegistration,
  getCredentialsByEmail,
  deleteCredential,
  renameCredential,
} from '@/lib/passkey';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ==================== GET: List passkeys ====================
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const credentials = await getCredentialsByEmail(session.user.email);

  return NextResponse.json({
    passkeys: credentials.map((c) => ({
      id: c.credential_id,
      name: c.friendly_name,
      deviceType: c.device_type,
      backedUp: c.backed_up,
      createdAt: c.created_at,
      lastUsedAt: c.last_used_at,
    })),
  });
}

// ==================== POST: Register passkey ====================
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { action } = body;

  // Step 1: Generate registration options
  if (action === 'register-options') {
    try {
      const { options, challengeId } = await generatePasskeyRegistrationOptions(
        session.user.email,
        session.user.name || session.user.email,
      );
      return NextResponse.json({ options, challengeId });
    } catch (err: any) {
      console.error('[Passkey] Registration options error:', err);
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }

  // Step 2: Verify registration response
  if (action === 'register-verify') {
    const { challengeId, attestation, friendlyName } = body;
    if (!challengeId || !attestation) {
      return NextResponse.json({ error: 'Missing challengeId or attestation' }, { status: 400 });
    }

    try {
      const verification = await verifyPasskeyRegistration(
        challengeId,
        attestation,
        session.user.email,
        friendlyName,
      );

      if (verification.verified) {
        return NextResponse.json({ verified: true });
      } else {
        return NextResponse.json({ verified: false, error: 'Verification failed' }, { status: 400 });
      }
    } catch (err: any) {
      console.error('[Passkey] Registration verify error:', err);
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
  }

  // Rename a passkey
  if (action === 'rename') {
    const { credentialId, name } = body;
    if (!credentialId || !name) {
      return NextResponse.json({ error: 'Missing credentialId or name' }, { status: 400 });
    }
    const ok = await renameCredential(credentialId, session.user.email, name);
    return NextResponse.json({ success: ok });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

// ==================== DELETE: Remove passkey ====================
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const credentialId = searchParams.get('id');
  if (!credentialId) {
    return NextResponse.json({ error: 'Missing passkey id' }, { status: 400 });
  }

  const ok = await deleteCredential(credentialId, session.user.email);
  if (ok) {
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ error: 'Failed to delete passkey' }, { status: 500 });
}
