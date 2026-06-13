import { db } from './db';
import { webhookEndpoints, webhookDeliveries } from '@/db/schema';
import { eq } from 'drizzle-orm';

export type OrderStatus = 'WAITING_PAYMENT' | 'PENDING' | 'PAID' | 'READY' | 'SHIPPED' | 'COMPLETED' | 'CANCELLED';

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  'WAITING_PAYMENT': ['PAID', 'CANCELLED'],
  'PENDING': ['PAID', 'CANCELLED'],
  'PAID': ['READY', 'SHIPPED', 'CANCELLED'],
  'READY': ['SHIPPED', 'COMPLETED', 'CANCELLED'],
  'SHIPPED': ['COMPLETED'],
  'COMPLETED': [],
  'CANCELLED': [], // Cannot move out of cancelled easily without admin override
};

export function isValidTransition(from: OrderStatus, to: OrderStatus, isAdminOverride: boolean = false): boolean {
  if (isAdminOverride) return true;
  if (from === to) return true; // No change
  
  const allowed = ALLOWED_TRANSITIONS[from] || [];
  return allowed.includes(to);
}

export async function dispatchWebhook(event: string, payload: any, shopId?: string) {
  try {
    // Get all active endpoints for this shop (or global ones if shopId is null)
    let query = db.select().from(webhookEndpoints).where(eq(webhookEndpoints.isActive, true));
    const endpoints = await query;

    const targetEndpoints = endpoints.filter(ep => 
      (ep.shopId === null || ep.shopId === shopId) &&
      (ep.events.includes('*') || ep.events.includes(event))
    );

    for (const ep of targetEndpoints) {
      // Async fire and forget
      fetch(ep.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-secret': ep.secret || '',
          'x-webhook-event': event,
        },
        body: JSON.stringify({ event, payload, timestamp: new Date().toISOString() })
      })
      .then(async (res) => {
        const text = await res.text().catch(() => '');
        await db.insert(webhookDeliveries).values({
          endpointId: ep.id,
          event,
          payload,
          statusCode: res.status,
          response: text.substring(0, 500),
          deliveredAt: new Date(),
          attempts: 1,
        });
      })
      .catch(async (err) => {
        await db.insert(webhookDeliveries).values({
          endpointId: ep.id,
          event,
          payload,
          statusCode: 0,
          response: err.message?.substring(0, 500),
          attempts: 1,
        });
      });
    }
  } catch (err) {
    console.error('[Webhooks] Dispatch failed:', err);
  }
}
