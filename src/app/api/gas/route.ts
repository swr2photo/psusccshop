// src/app/api/gas/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

const GAS_URL = process.env.GAS_SCRIPT_URL || 
  'https://script.google.com/macros/s/AKfycbw3x3ceiC_KDlFrnP07gvlMof8uGvBsxQiHXKyxMiWCjCN_1BBeCsbuvnwv9OPi1Bmm/exec';

export async function GET(request: NextRequest) {
  // ตรวจสอบว่าเข้าสู่ระบบแล้ว
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const authorization = searchParams.get('authorization');

    if (!action) {
      return NextResponse.json(
        { status: 'error', message: 'Missing action parameter' },
        { status: 400 }
      );
    }

    console.log(`[GAS-API] GET ${action}`, { authorization: authorization ? '***' : 'none' });

    // Forward to Google Apps Script
    const gasUrl = new URL(GAS_URL);
    gasUrl.searchParams.append('action', action);
    if (authorization) {
      gasUrl.searchParams.append('authorization', authorization);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 28000);

    const response = await fetch(gasUrl.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`GAS returned ${response.status}`);
    }

    const data = await response.json();

    console.log(`[GAS-API] GET ${action} - Success`);

    return NextResponse.json(data, {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Content-Type': 'application/json',
      },
    });

  } catch (error: any) {
    console.error(`[GAS-API] GET Error:`, error?.message || error);
    return NextResponse.json(
      {
        status: 'error',
        message: error?.message || 'Internal server error',
        error: typeof error === 'object' ? error : { detail: String(error) },
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // ตรวจสอบว่าเข้าสู่ระบบแล้ว
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (!action) {
      return NextResponse.json(
        { status: 'error', message: 'Missing action parameter' },
        { status: 400 }
      );
    }

    console.log(`[GAS-API] POST ${action}`);

    const body = await request.json();

    // Forward to Google Apps Script
    const gasUrl = new URL(GAS_URL);
    gasUrl.searchParams.append('action', action);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 28000);

    const response = await fetch(gasUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`GAS returned ${response.status}`);
    }

    const data = await response.json();

    console.log(`[GAS-API] POST ${action} - Success`);

    return NextResponse.json(data, {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Content-Type': 'application/json',
      },
    });

  } catch (error: any) {
    console.error(`[GAS-API] POST Error:`, error?.message || error);
    return NextResponse.json(
      {
        status: 'error',
        message: error?.message || 'Internal server error',
        error: typeof error === 'object' ? error : { detail: String(error) },
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return NextResponse.json(
    { status: 'ok' },
    {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Cache-Control': 'no-cache',
      },
    }
  );
}
