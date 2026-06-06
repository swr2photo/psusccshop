// src/lib/api-key-rotation.ts
// API Key management and rotation system — Drizzle ORM

import { db } from './db';
import { keyValueStore } from '../db/schema';
import { eq, like } from 'drizzle-orm';
import crypto from 'crypto';

// ==================== TYPES ====================

interface APIKey {
  id: string;
  name: string;
  keyHash: string;
  keyPrefix: string;
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

// Generate a secure API key
// Format: psu_[type]_[random 32 chars]
export function generateAPIKey(type: 'admin' | 'user' | 'cron' | 'webhook' = 'user'): string {
  const random = crypto.randomBytes(24).toString('base64url');
  return `psu_${type}_${random}`;
}

// Hash an API key for storage
export function hashAPIKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

// Get key prefix for identification
export function getKeyPrefix(key: string): string {
  const parts = key.split('_');
  return parts.length >= 3 ? `${parts[0]}_${parts[1]}_${parts[2].substring(0, 4)}` : key.substring(0, 12);
}

// ==================== KEY MANAGEMENT ====================

// Store keys in key_value_store with prefix "api-key:"
const KEY_PREFIX = 'api-key:';

function keyStoreKey(id: string): string {
  return `${KEY_PREFIX}${id}`;
}

// Create a new API key
export async function createAPIKey(options: {
  name: string;
  permissions: string[];
  expiresInDays?: number;
  createdBy: string;
  rateLimit?: { maxRequests: number; windowSeconds: number };
  type?: 'admin' | 'user' | 'cron' | 'webhook';
}): Promise<{ key: string; keyId: string }> {
  const key = generateAPIKey(options.type);
  const keyId = crypto.randomUUID();
  
  const apiKey: APIKey = {
    id: keyId,
    name: options.name,
    keyHash: hashAPIKey(key),
    keyPrefix: getKeyPrefix(key),
    permissions: options.permissions,
    createdAt: new Date().toISOString(),
    expiresAt: options.expiresInDays
      ? new Date(Date.now() + options.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : null,
    lastUsedAt: null,
    usageCount: 0,
    isActive: true,
    createdBy: options.createdBy,
    rateLimit: options.rateLimit,
  };
  
  await db.insert(keyValueStore)
    .values({ key: keyStoreKey(keyId), value: apiKey as any });
  
  return { key, keyId };
}

// Validate an API key
export async function validateAPIKey(key: string): Promise<APIKeyValidation> {
  try {
    const keyHash = hashAPIKey(key);
    
    // Get all API keys
    const allKeys = await db.select()
      .from(keyValueStore)
      .where(like(keyValueStore.key, `${KEY_PREFIX}%`));
    
    for (const entry of allKeys) {
      const apiKey = entry.value as any as APIKey;
      if (apiKey.keyHash !== keyHash) continue;
      if (!apiKey.isActive) return { valid: false, error: 'API key is revoked' };
      if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
        return { valid: false, error: 'API key has expired' };
      }
      
      // Update usage
      apiKey.lastUsedAt = new Date().toISOString();
      apiKey.usageCount++;
      await db.update(keyValueStore)
        .set({ value: apiKey as any })
        .where(eq(keyValueStore.key, entry.key));
      
      return {
        valid: true,
        keyId: apiKey.id,
        name: apiKey.name,
        permissions: apiKey.permissions,
      };
    }
    
    return { valid: false, error: 'Invalid API key' };
  } catch (error) {
    console.error('[API Key] Validation error:', error);
    return { valid: false, error: 'Validation failed' };
  }
}

// Rotate an API key (create new, invalidate old)
export async function rotateAPIKey(keyId: string, rotatedBy: string): Promise<{ newKey: string; newKeyId: string }> {
  const rows = await db.select()
    .from(keyValueStore)
    .where(eq(keyValueStore.key, keyStoreKey(keyId)))
    .limit(1);
  const entry = rows[0];
  if (!entry) throw new Error('API key not found');
  
  const oldKey = entry.value as any as APIKey;
  oldKey.isActive = false;
  await db.update(keyValueStore)
    .set({ value: oldKey as any })
    .where(eq(keyValueStore.key, keyStoreKey(keyId)));
  
  const result = await createAPIKey({
    name: oldKey.name,
    permissions: oldKey.permissions,
    createdBy: rotatedBy,
    rateLimit: oldKey.rateLimit,
  });
  return { newKey: result.key, newKeyId: result.keyId };
}

// Revoke an API key
export async function revokeAPIKey(keyId: string, revokedBy: string, reason?: string): Promise<void> {
  const rows = await db.select()
    .from(keyValueStore)
    .where(eq(keyValueStore.key, keyStoreKey(keyId)))
    .limit(1);
  const entry = rows[0];
  if (!entry) throw new Error('API key not found');
  
  const apiKey = entry.value as any as APIKey;
  apiKey.isActive = false;
  (apiKey as any).revokedBy = revokedBy;
  (apiKey as any).revokedAt = new Date().toISOString();
  (apiKey as any).revokeReason = reason;
  
  await db.update(keyValueStore)
    .set({ value: apiKey as any })
    .where(eq(keyValueStore.key, keyStoreKey(keyId)));
}

// List all API keys (without showing actual keys)
export async function listAPIKeys(options: {
  includeInactive?: boolean;
  createdBy?: string;
} = {}): Promise<Omit<APIKey, 'keyHash'>[]> {
  const allKeys = await db.select()
    .from(keyValueStore)
    .where(like(keyValueStore.key, `${KEY_PREFIX}%`));
  
  let keys = allKeys.map((entry: any) => {
    const k = entry.value as any as APIKey;
    const { keyHash: _, ...rest } = k;
    return rest;
  });
  
  if (!options.includeInactive) keys = keys.filter((k: any) => k.isActive);
  if (options.createdBy) keys = keys.filter((k: any) => k.createdBy === options.createdBy);
  
  return keys;
}

// Get keys that are expiring soon
export async function getExpiringKeys(withinDays: number = 7): Promise<Omit<APIKey, 'keyHash'>[]> {
  const cutoff = new Date(Date.now() + withinDays * 24 * 60 * 60 * 1000);
  const keys = await listAPIKeys();
  return keys.filter(k => k.expiresAt && new Date(k.expiresAt) <= cutoff);
}

// Auto-rotate keys that are expiring soon
export async function autoRotateExpiringKeys(withinDays: number = 3): Promise<number> {
  const expiring = await getExpiringKeys(withinDays);
  let rotated = 0;
  for (const key of expiring) {
    try {
      await rotateAPIKey(key.id, 'system-auto-rotate');
      rotated++;
    } catch (error) {
      console.error(`[API Key] Auto-rotate failed for ${key.id}:`, error);
    }
  }
  return rotated;
}

// Cleanup expired and revoked keys older than retention period
export async function cleanupOldKeys(retentionDays: number = 90): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const allKeys = await db.select()
    .from(keyValueStore)
    .where(like(keyValueStore.key, `${KEY_PREFIX}%`));
  
  let deleted = 0;
  for (const entry of allKeys) {
    const k = entry.value as any as APIKey;
    if (!k.isActive && new Date(k.createdAt) < cutoff) {
      await db.delete(keyValueStore)
        .where(eq(keyValueStore.key, entry.key));
      deleted++;
    }
  }
  return deleted;
}
