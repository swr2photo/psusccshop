// src/app/api/admin/orders/route.ts
// Admin API for order lookup - search by ref or customer email

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getJson, listKeys } from '@/lib/filebase';

// Ensure Node runtime and skip static caching
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // ตรวจสอบสิทธิ์ Admin
  const authResult = await requireAdmin();
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
      const keys = await listKeys('orders/');
      const targetKey = keys.find((k) => k.includes(ref) || k.endsWith(`${ref}.json`));
      
      if (targetKey) {
        const order = await getJson<any>(targetKey);
        if (order) {
          // Sanitize - remove raw slip base64 data
          const sanitized = { ...order };
          if (sanitized.slip?.base64) {
            sanitized.slip = { 
              ...sanitized.slip, 
              base64: undefined,
              hasBase64: true,
            };
          }
          return NextResponse.json({ 
            status: 'success', 
            data: sanitized 
          });
        }
      }
      
      return NextResponse.json({ 
        status: 'error', 
        message: 'Order not found' 
      }, { status: 404 });
    }

    // Search by customer email
    if (email) {
      const keys = await listKeys('orders/');
      const allOrders = await Promise.all(
        keys.map(async (k) => {
          const data = await getJson<any>(k);
          return data ? { ...data, _key: k } : null;
        })
      );

      // Filter by email
      const customerOrders = allOrders
        .filter(Boolean)
        .filter((o: any) => {
          const orderEmail = (o?.customerEmail || o?.email || '').toLowerCase();
          return orderEmail === email;
        })
        // Sort by date (newest first)
        .sort((a: any, b: any) => {
          const dateA = new Date(a?.date || a?.createdAt || 0).getTime();
          const dateB = new Date(b?.date || b?.createdAt || 0).getTime();
          return dateB - dateA;
        })
        // Limit results
        .slice(0, limit)
        // Sanitize
        .map((o: any) => {
          const sanitized = { ...o };
          delete sanitized._key;
          if (sanitized.slip?.base64) {
            sanitized.slip = { 
              ...sanitized.slip, 
              base64: undefined,
              hasBase64: true,
            };
          }
          return sanitized;
        });

      return NextResponse.json({ 
        status: 'success', 
        data: customerOrders 
      });
    }

    return NextResponse.json({ 
      status: 'error', 
      message: 'Please provide ref or email parameter' 
    }, { status: 400 });

  } catch (error: any) {
    console.error('[admin/orders] GET error:', error);
    return NextResponse.json({ 
      status: 'error', 
      message: error?.message || 'Search failed' 
    }, { status: 500 });
  }
}
