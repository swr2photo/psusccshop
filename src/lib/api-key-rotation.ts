// src/lib/api-key-rotation.ts
// API Key management and rotation system

import { getSupabaseAdmin } from './supabase';
import crypto from 'crypto';

// ==================== TYPES ====================

export interface APIKey {
  id: string;
  name: string;
  keyHash: string; // Store only hash, not the actual key
  keyPrefix: string; // First 8 chars for identification
  permissions: string[];
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  usageCount: number;
  isActive: boolean;
  createdBy: string;
  rateLimit?: {
    maxRequests: number;
    windowSeconds: number;
  };
}

export interface APIKeyValidation {
  valid: boolean;
  keyId?: string;
  name?: string;
  permissions?: string[];
  error?: string;
}

// ==================== KEY GENERATION ====================

/**
 * Generate a secure API key
 * Format: psu_[type]_[random 32 chars]
 */
export function generateAPIKey(type: 'admin' | 'user' | 'cron' | 'webhook' = 'user'): string {
  const randomPart = crypto.randomBytes(24).toString('base64url');
  return `psu_${type}_${randomPart}`;
}

/**
 * Hash an API key for storage
 */
export function hashAPIKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Get key prefix for identification
 */
export function getKeyPrefix(key: string): string {
  return key.substring(0, 12);
}

// ==================== KEY MANAGEMENT ====================

/**
 * Create a new API key
 */
export async function createAPIKey(options: {
  name: string;
  permissions: string[];
  expiresInDays?: number;
  createdBy: string;
  rateLimit?: { maxRequests: number; windowSeconds: number };
  type?: 'admin' | 'user' | 'cron' | 'webhook';
}): Promise<{ key: string; keyId: string }> {
  const db = getSupabaseAdmin();
  
  const key = generateAPIKey(options.type || 'user');
  const keyHash = hashAPIKey(key);
  const keyPrefix = getKeyPrefix(key);
  
  const expiresAt = options.expiresInDays
    ? new Date(Date.now() + options.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
    : null;
  
  const { data, error } = await db
    .from('api_keys')
    .insert({
      name: options.name,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      permissions: options.permissions,
      expires_at: expiresAt,
      created_by: options.createdBy,
      rate_limit: options.rateLimit || null,
      is_active: true,
      usage_count: 0,
    })
    .select('id')
    .single();
  
  if (error) throw error;
  
  return {
    key,
    keyId: data.id,
  };
}

/**
 * Validate an API key
 */
export async function validateAPIKey(key: string): Promise<APIKeyValidation> {
  if (!key || !key.startsWith('psu_')) {
    return { valid: false, error: 'Invalid key format' };
  }
  
  const db = getSupabaseAdmin();
  const keyHash = hashAPIKey(key);
  
  const { data, error } = await db
    .from('api_keys')
    .select('*')
    .eq('key_hash', keyHash)
    .eq('is_active', true)
    .single();
  
  if (error || !data) {
    return { valid: false, error: 'Key not found or inactive' };
  }
  
  // Check expiration
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return { valid: false, error: 'Key has expired' };
  }
  
  // Update last used
  await db
    .from('api_keys')
    .update({
      last_used_at: new Date().toISOString(),
      usage_count: data.usage_count + 1,
    })
    .eq('id', data.id);
  
  return {
    valid: true,
    keyId: data.id,
    name: data.name,
    permissions: data.permissions,
  };
}

/**
 * Rotate an API key (create new, invalidate old)
 */
export async function rotateAPIKey(keyId: string, rotatedBy: string): Promise<{ newKey: string; newKeyId: string }> {
  const db = getSupabaseAdmin();
  
  // Get existing key info
  const { data: existingKey, error: fetchError } = await db
    .from('api_keys')
    .select('*')
    .eq('id', keyId)
    .single();
  
  if (fetchError || !existingKey) {
    throw new Error('Key not found');
  }
  
  // Determine key type from prefix
  let keyType: 'admin' | 'user' | 'cron' | 'webhook' = 'user';
  if (existingKey.key_prefix.includes('admin')) keyType = 'admin';
  else if (existingKey.key_prefix.includes('cron')) keyType = 'cron';
  else if (existingKey.key_prefix.includes('webhook')) keyType = 'webhook';
  
  // Create new key with same permissions
  const result = await createAPIKey({
    name: existingKey.name,
    permissions: existingKey.permissions,
    expiresInDays: existingKey.expires_at 
      ? Math.ceil((new Date(existingKey.expires_at).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
      : undefined,
    createdBy: rotatedBy,
    rateLimit: existingKey.rate_limit,
    type: keyType,
  });
  
  // Deactivate old key
  await db
    .from('api_keys')
    .update({
      is_active: false,
      rotated_at: new Date().toISOString(),
      rotated_to: result.keyId,
    })
    .eq('id', keyId);
  
  // Log rotation event
  await db.from('security_audit_log').insert({
    event_type: 'api_key_rotation',
    user_email: rotatedBy,
    details: {
      oldKeyId: keyId,
      newKeyId: result.keyId,
      keyName: existingKey.name,
    },
  });
  
  return {
    newKey: result.key,
    newKeyId: result.keyId,
  };
}

/**
 * Revoke an API key
 */
export async function revokeAPIKey(keyId: string, revokedBy: string, reason?: string): Promise<void> {
  const db = getSupabaseAdmin();
  
  await db
    .from('api_keys')
    .update({
      is_active: false,
      revoked_at: new Date().toISOString(),
      revoked_by: revokedBy,
      revoke_reason: reason,
    })
    .eq('id', keyId);
  
  // Log revocation
  await db.from('security_audit_log').insert({
    event_type: 'api_key_revoked',
    user_email: revokedBy,
    details: { keyId, reason },
  });
}

/**
 * List all API keys (without showing actual keys)
 */
export async function listAPIKeys(options: {
  includeInactive?: boolean;
  createdBy?: string;
} = {}): Promise<Omit<APIKey, 'keyHash'>[]> {
  const db = getSupabaseAdmin();
  
  let query = db
    .from('api_keys')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (!options.includeInactive) {
    query = query.eq('is_active', true);
  }
  
  if (options.createdBy) {
    query = query.eq('created_by', options.createdBy);
  }
  
  const { data, error } = await query;
  
  if (error) throw error;
  
  return (data || []).map(row => ({
    id: row.id,
    name: row.name,
    keyHash: '[HIDDEN]',
    keyPrefix: row.key_prefix,
    permissions: row.permissions,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    lastUsedAt: row.last_used_at,
    usageCount: row.usage_count,
    isActive: row.is_active,
    createdBy: row.created_by,
    rateLimit: row.rate_limit,
  }));
}

/**
 * Get keys that are expiring soon
 */
export async function getExpiringKeys(withinDays: number = 7): Promise<Omit<APIKey, 'keyHash'>[]> {
  const db = getSupabaseAdmin();
  const futureDate = new Date(Date.now() + withinDays * 24 * 60 * 60 * 1000);
  
  const { data, error } = await db
    .from('api_keys')
    .select('*')
    .eq('is_active', true)
    .not('expires_at', 'is', null)
    .lt('expires_at', futureDate.toISOString())
    .gt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: true });
  
  if (error) throw error;
  
  return (data || []).map(row => ({
    id: row.id,
    name: row.name,
    keyHash: '[HIDDEN]',
    keyPrefix: row.key_prefix,
    permissions: row.permissions,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    lastUsedAt: row.last_used_at,
    usageCount: row.usage_count,
    isActive: row.is_active,
    createdBy: row.created_by,
    rateLimit: row.rate_limit,
  }));
}

/**
 * Auto-rotate keys that are expiring soon
 */
export async function autoRotateExpiringKeys(withinDays: number = 3): Promise<number> {
  const expiringKeys = await getExpiringKeys(withinDays);
  let rotatedCount = 0;
  
  for (const key of expiringKeys) {
    try {
      await rotateAPIKey(key.id, 'SYSTEM_AUTO_ROTATE');
      rotatedCount++;
      console.log(`[APIKey] Auto-rotated key: ${key.name} (${key.keyPrefix}...)`);
    } catch (error) {
      console.error(`[APIKey] Failed to auto-rotate ${key.name}:`, error);
    }
  }
  
  return rotatedCount;
}

/**
 * Cleanup expired and revoked keys older than retention period
 */
export async function cleanupOldKeys(retentionDays: number = 90): Promise<number> {
  const db = getSupabaseAdmin();
  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  
  const { data, error } = await db
    .from('api_keys')
    .delete()
    .eq('is_active', false)
    .lt('updated_at', cutoffDate.toISOString())
    .select('id');
  
  if (error) throw error;
  
  return data?.length || 0;
}
