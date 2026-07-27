import { db } from '@/lib/db';
import { config } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { invalidatePublicChatSettingsCache } from '@/lib/support-chat-settings-cache';
import {
  DEFAULT_SUPPORT_CHAT_SETTINGS,
  normalizeSupportChatSettings,
  type SupportChatSettings,
} from '@/lib/support-chat-settings';

const KEY = 'support_chat_settings';

export async function getStoredSupportChatSettings(): Promise<SupportChatSettings> {
  const rows = await db.select().from(config).where(eq(config.key, KEY)).limit(1);
  return normalizeSupportChatSettings(rows[0]?.value ?? DEFAULT_SUPPORT_CHAT_SETTINGS);
}

export async function saveStoredSupportChatSettings(
  settings: SupportChatSettings
): Promise<SupportChatSettings> {
  const merged = normalizeSupportChatSettings(settings);
  await db
    .insert(config)
    .values({ key: KEY, value: merged })
    .onConflictDoUpdate({
      target: config.key,
      set: { value: merged, updatedAt: new Date() },
    });
  invalidatePublicChatSettingsCache();
  return merged;
}
