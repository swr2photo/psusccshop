// src/lib/push-notification.ts
// Web Push notification sender (server-side)

import { getSupabaseAdmin } from './supabase';

// VAPID keys for web push
// Generate with: npx web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:psuscc@psusci.club';

// Cache webpush module to avoid re-importing and re-setting VAPID on every call
let _webpush: any = null;
async function getWebPush() {
  if (_webpush) return _webpush;
  try {
    const mod = await import('web-push');
    _webpush = mod.default || mod;
    _webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    return _webpush;
  } catch (err) {
    console.error('[Push] web-push library not available:', err);
    return null;
  }
}

interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  url?: string;
  tag?: string;
  chatId?: string;
}

/**
 * Send push notification to all devices of a user
 */
export async function sendPushNotification(
  email: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.log('[Push] VAPID keys not configured, skipping push notification');
    return { sent: 0, failed: 0 };
  }

  const db = getSupabaseAdmin();
  if (!db) return { sent: 0, failed: 0 };

  // Get all subscriptions for this user
  const { data: subscriptions, error } = await db
    .from('push_subscriptions')
    .select('*')
    .eq('email', email);

  if (error || !subscriptions?.length) {
    console.log(`[Push] No subscriptions found for ${email}`, error?.message || '');
    return { sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;
  const expiredEndpoints: string[] = [];

  const webpush = await getWebPush();
  if (!webpush) return { sent: 0, failed: 0 };

  for (const sub of subscriptions) {
    try {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.keys_p256dh,
          auth: sub.keys_auth,
        },
      };

      await webpush.sendNotification(
        pushSubscription,
        JSON.stringify(payload),
        { TTL: 3600 } // 1 hour expiry
      );
      sent++;
    } catch (err: any) {
      failed++;
      // If subscription expired or invalid, mark for deletion
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        expiredEndpoints.push(sub.endpoint);
      }
      console.error('[Push] Send failed:', err?.statusCode || err?.message);
    }
  }

  // Clean up expired subscriptions
  if (expiredEndpoints.length > 0) {
    await db
      .from('push_subscriptions')
      .delete()
      .in('endpoint', expiredEndpoints);
    console.log(`[Push] Cleaned up ${expiredEndpoints.length} expired subscriptions`);
  }

  console.log(`[Push] Sent ${sent}/${subscriptions.length} notifications to ${email}`);
  return { sent, failed };
}
