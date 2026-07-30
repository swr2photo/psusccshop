// src/app/api/auth/passkey/route.ts
// Passkey registration & management endpoints (requires auth)
// GET  - List user's passkeys
// POST - Generate registration options or verify registration
// DELETE - Remove a passkey

import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session-from-request';
import {
  generatePasskeyRegistrationOptions,
  verifyPasskeyRegistration,
  getCredentialsByEmail,
  deleteCredential,
  renameCredential,
  isPasskeySchemaMissingError,
} from '@/lib/passkey';
import { formatDbError } from '@/lib/config-db';
import { secureJsonRequest, secureJsonResponse } from '@/lib/payload-crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SCHEMA_MIGRATION_HINT =
  'Passkey tables not migrated — run scripts/supabase-passkey-schema.sql on your database';

async function passkeyDbErrorResponse(error: unknown, fallback: string) {
  console.error(`[Passkey] ${fallback}:`, formatDbError(error));
  if (isPasskeySchemaMissingError(error)) {
    return await secureJsonResponse({ error: SCHEMA_MIGRATION_HINT }, { status: 503 });
  }
  const message = error instanceof Error ? error.message : fallback;
  return await secureJsonResponse({ error: message }, { status: 500 });
}

// ==================== GET: List passkeys ====================
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session?.user?.email) {
    return await secureJsonResponse({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const credentials = await getCredentialsByEmail(session.user.email);

    return await secureJsonResponse({
      passkeys: credentials.map((c) => ({
        id: c.credential_id,
        name: c.friendly_name,
        deviceType: c.device_type,
        backedUp: c.backed_up,
        createdAt: c.created_at,
        lastUsedAt: c.last_used_at,
      })),
    });
  } catch (error) {
    if (isPasskeySchemaMissingError(error)) {
      return await secureJsonResponse({ passkeys: [], warning: SCHEMA_MIGRATION_HINT });
    }
    return passkeyDbErrorResponse(error, 'GET list error');
  }
}

// ==================== POST: Register passkey ====================
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session?.user?.email) {
    return await secureJsonResponse({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await secureJsonRequest(req);
  const { action } = body;

  if (action === 'register-options') {
    try {
      const { options, challengeId } = await generatePasskeyRegistrationOptions(
        session.user.email,
        session.user.name || session.user.email,
        req.url,
      );
      return await secureJsonResponse({ options, challengeId });
    } catch (err: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ {
      if (isPasskeySchemaMissingError(err)) {
        return await secureJsonResponse({ error: SCHEMA_MIGRATION_HINT }, { status: 503 });
      }
      return passkeyDbErrorResponse(err, 'Registration options error');
    }
  }

  if (action === 'register-verify') {
    const { challengeId, attestation, friendlyName } = body;
    if (!challengeId || !attestation) {
      return await secureJsonResponse({ error: 'Missing challengeId or attestation' }, { status: 400 });
    }

    try {
      const verification = await verifyPasskeyRegistration(
        challengeId,
        attestation,
        session.user.email,
        friendlyName,
        req.url,
      );

      if (verification.verified) {
        return await secureJsonResponse({ verified: true });
      }
      return await secureJsonResponse({ verified: false, error: 'Verification failed' }, { status: 400 });
    } catch (err: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ {
      if (isPasskeySchemaMissingError(err)) {
        return await secureJsonResponse({ error: SCHEMA_MIGRATION_HINT }, { status: 503 });
      }
      const message = err instanceof Error ? err.message : String(err);
      return await secureJsonResponse({ error: message }, { status: 400 });
    }
  }

  if (action === 'rename') {
    const { credentialId, name } = body;
    if (!credentialId || !name) {
      return await secureJsonResponse({ error: 'Missing credentialId or name' }, { status: 400 });
    }
    const ok = await renameCredential(credentialId, session.user.email, name);
    return await secureJsonResponse({ success: ok });
  }

  return await secureJsonResponse({ error: 'Invalid action' }, { status: 400 });
}

// ==================== DELETE: Remove passkey ====================
export async function DELETE(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session?.user?.email) {
    return await secureJsonResponse({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const credentialId = searchParams.get('id');
  if (!credentialId) {
    return await secureJsonResponse({ error: 'Missing passkey id' }, { status: 400 });
  }

  const ok = await deleteCredential(credentialId, session.user.email);
  if (ok) {
    return await secureJsonResponse({ success: true });
  }
  return await secureJsonResponse({ error: 'Failed to delete passkey' }, { status: 500 });
}
