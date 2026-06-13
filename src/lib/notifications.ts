// src/lib/notifications.ts
import { db } from './db';
import { notifications } from '@/db/schema';
import { getConfigValueCached } from './config-db';
import { sendLineNotify } from './line-notify';

export type NotificationType = 'NEW_ORDER' | 'PAYMENT_RECEIVED' | 'INVENTORY_LOW' | 'SYSTEM_ALERT';

export interface SendNotificationOptions {
  shopId?: string;
  type: NotificationType;
  title: string;
  message: string;
  url?: string;
}

export async function dispatchNotification(opts: SendNotificationOptions) {
  try {
    // 1. Send via LINE Notify if configured
    const lineTokenKey = opts.shopId ? `line_notify_token_${opts.shopId}` : 'line_notify_token_default';
    const token = await getConfigValueCached<string>(lineTokenKey);
    
    if (token) {
      const lineMsg = `\n[${opts.title}]\n${opts.message}${opts.url ? `\n\n${opts.url}` : ''}`;
      await sendLineNotify(token, lineMsg);
    }

    // 2. Save to internal database for Admin UI bell
    await db.insert(notifications).values({
      recipientEmail: 'admin@system.local', // could be mapped to shop owner later
      type: opts.type,
      channel: 'INTERNAL',
      title: opts.title,
      body: opts.message,
      metadata: opts.url ? { url: opts.url, shopId: opts.shopId } : { shopId: opts.shopId },
    });
    
  } catch (error) {
    console.error('[notifications] Dispatch failed:', error);
  }
}
