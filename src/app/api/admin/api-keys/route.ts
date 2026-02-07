// src/app/api/admin/api-keys/route.ts
// Admin API for managing API keys

import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { 
  createAPIKey, 
  listAPIKeys, 
  revokeAPIKey, 
  rotateAPIKey,
  getExpiringKeys,
} from '@/lib/api-key-rotation';
import { logSecurityEvent } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET - List all API keys
export async function GET(req: NextRequest) {
  const adminResult = await requireSuperAdmin();
  if (adminResult instanceof NextResponse) {
    return adminResult;
  }

  try {
    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const expiringSoon = searchParams.get('expiringSoon') === 'true';
    
    if (expiringSoon) {
      const days = parseInt(searchParams.get('days') || '7');
      const keys = await getExpiringKeys(days);
      return NextResponse.json({ keys, expiringWithinDays: days });
    }
    
    const keys = await listAPIKeys({ includeInactive });
    
    return NextResponse.json({ keys });
  } catch (error) {
    console.error('[API Keys] List error:', error);
    return NextResponse.json(
      { error: 'Failed to list API keys' },
      { status: 500 }
    );
  }
}

// POST - Create new API key
export async function POST(req: NextRequest) {
  const adminResult = await requireSuperAdmin();
  if (adminResult instanceof NextResponse) {
    return adminResult;
  }

  try {
    const body = await req.json();
    const { name, permissions, expiresInDays, type, rateLimit } = body;
    
    if (!name || !permissions || !Array.isArray(permissions)) {
      return NextResponse.json(
        { error: 'Name and permissions are required' },
        { status: 400 }
      );
    }
    
    // Validate type
    const validTypes = ['admin', 'user', 'cron', 'webhook'];
    if (type && !validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }
    
    const result = await createAPIKey({
      name,
      permissions,
      expiresInDays: expiresInDays ? parseInt(expiresInDays) : undefined,
      createdBy: adminResult.email,
      type: type || 'user',
      rateLimit,
    });
    
    // Log creation
    await logSecurityEvent({
      eventType: 'api_key_created',
      userEmail: adminResult.email,
      details: { keyId: result.keyId, name },
    });
    
    return NextResponse.json({
      success: true,
      keyId: result.keyId,
      key: result.key, // Only shown once!
      message: 'Save this key securely. It will not be shown again.',
    });
  } catch (error) {
    console.error('[API Keys] Create error:', error);
    return NextResponse.json(
      { error: 'Failed to create API key' },
      { status: 500 }
    );
  }
}

// PUT - Rotate an API key
export async function PUT(req: NextRequest) {
  const adminResult = await requireSuperAdmin();
  if (adminResult instanceof NextResponse) {
    return adminResult;
  }

  try {
    const body = await req.json();
    const { keyId } = body;
    
    if (!keyId) {
      return NextResponse.json(
        { error: 'keyId is required' },
        { status: 400 }
      );
    }
    
    const result = await rotateAPIKey(keyId, adminResult.email);
    
    return NextResponse.json({
      success: true,
      newKeyId: result.newKeyId,
      newKey: result.newKey, // Only shown once!
      message: 'Key rotated. Save the new key securely.',
    });
  } catch (error) {
    console.error('[API Keys] Rotate error:', error);
    return NextResponse.json(
      { error: 'Failed to rotate API key' },
      { status: 500 }
    );
  }
}

// DELETE - Revoke an API key
export async function DELETE(req: NextRequest) {
  const adminResult = await requireSuperAdmin();
  if (adminResult instanceof NextResponse) {
    return adminResult;
  }

  try {
    const { searchParams } = new URL(req.url);
    const keyId = searchParams.get('keyId');
    const reason = searchParams.get('reason') || 'Revoked by admin';
    
    if (!keyId) {
      return NextResponse.json(
        { error: 'keyId is required' },
        { status: 400 }
      );
    }
    
    await revokeAPIKey(keyId, adminResult.email, reason);
    
    return NextResponse.json({
      success: true,
      message: 'API key revoked successfully',
    });
  } catch (error) {
    console.error('[API Keys] Revoke error:', error);
    return NextResponse.json(
      { error: 'Failed to revoke API key' },
      { status: 500 }
    );
  }
}
