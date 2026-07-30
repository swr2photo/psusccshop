/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/admin/orders/route.ts
// Admin API for order lookup - search by ref or customer email

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminWithPermission } from '@/lib/auth';
import { getOrdersByEmail } from '@/lib/supabase';
import { getOrderByRef } from '@/lib/order-lookup';
import { secureJsonRequest, secureJsonResponse } from '@/lib/payload-crypto';

// Ensure Node runtime and skip static caching
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // ตรวจสอบสิทธิ์ Admin + permission canManageOrders
  const authResult = await requireAdminWithPermission('canManageOrders', req);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const url = new URL(req.url);
    const ref = url.searchParams.get('ref')?.trim();
    const email = url.searchParams.get('email')?.trim()?.toLowerCase();
    const limit = parseInt(url.searchParams.get('limit') || '10');

    // Search by specific order ref
    if (ref) {
      const order = await getOrderByRef(ref);

      if (order) {
        const sanitized = { ...order };
        if (sanitized.slip?.base64) {
          sanitized.slip = {
            ...sanitized.slip,
            base64: undefined,
            hasBase64: true,
          };
        }
        return await secureJsonResponse({
          status: 'success',
          data: sanitized,
        });
      }

      return await secureJsonResponse({
        status: 'error',
        message: 'Order not found',
      }, { status: 404 });
    }

    // Search by customer email
    if (email) {
      const { orders: customerOrders } = await getOrdersByEmail(email, { limit });
      const sanitizedOrders = customerOrders.map((o: any) => {
        const sanitized = { ...o };
        if (sanitized.slip?.base64) {
          sanitized.slip = {
            ...sanitized.slip,
            base64: undefined,
            hasBase64: true,
          };
        }
        return sanitized;
      });

      return await secureJsonResponse({
        status: 'success',
        data: sanitizedOrders,
      });
    }

    return await secureJsonResponse({ 
      status: 'error', 
      message: 'Please provide ref or email parameter' 
    }, { status: 400 });

  } catch (error: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ {
    console.error('[admin/orders] GET error:', error);
    return await secureJsonResponse({ 
      status: 'error', 
      message: error?.message || 'Search failed' 
    }, { status: 500 });
  }
}
