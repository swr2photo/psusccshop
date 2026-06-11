import { invalidateCacheKey, CACHE_TTL, getCached } from '@/lib/server-cache';

export const PUBLIC_CHAT_SETTINGS_CACHE_KEY = 'support-chat:public-settings';

export function invalidatePublicChatSettingsCache() {
  invalidateCacheKey(PUBLIC_CHAT_SETTINGS_CACHE_KEY);
  invalidateCacheKey('json:config:support_chat_settings');
}

export { getCached, CACHE_TTL };
