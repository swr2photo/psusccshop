// src/app/api/gas/route.ts — Server proxy to Google Apps Script (authenticated users only)

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isAdminEmailAsync } from '@/lib/auth';
import { rateLimitOrNull } from '@/lib/api-helpers';

const GAS_URL = process.env.GAS_SCRIPT_URL;
const GAS_AUTH_TOKEN = process.env.GAS_AUTH_TOKEN;

/** Actions any logged-in user may invoke */
const PUBLIC_GAS_ACTIONS = new Set([
  'get_profile',
  'get_orders',
  'get_order',
  'save_profile',
  'save_cart',
  'get_cart',
]);

/** Admin-only GAS actions */
const ADMIN_GAS_ACTIONS = new Set([
  'sync',
  'admin_sync',
  'admin_get_orders',
  'admin_update_order',
  'admin_config',
  'send_broadcast',
  'send_custom',
]);

function sanitizeAction(action: string | null): string | null {
  if (!action) return null;
  const cleaned = action.trim();
  if (!/^[a-zA-Z0-9_]{1,64}$/.test(cleaned)) return null;
  return cleaned;
}

async function assertActionAllowed(action: string, email: string): Promise<NextResponse | null> {
  if (PUBLIC_GAS_ACTIONS.has(action)) return null;
  if (ADMIN_GAS_ACTIONS.has(action)) {
    const isAdmin = await isAdminEmailAsync(email);
    if (!isAdmin) {
      return NextResponse.json(
        { status: 'error', message: 'Forbidden' },
        { status: 403 }
      );
    }
    return null;
  }
  return NextResponse.json(
    { status: 'error', message: 'Action not allowed' },
    { status: 403 }
  );
}

function buildGasUrl(action: string): URL | null {
  if (!GAS_URL) return null;
  const gasUrl = new URL(GAS_URL);
  gasUrl.searchParams.set('action', action);
  if (GAS_AUTH_TOKEN) {
    gasUrl.searchParams.set('authorization', GAS_AUTH_TOKEN);
  }
  return gasUrl;
}

async function handleGasRequest(
  request: NextRequest,
  method: 'GET' | 'POST',
  action: string,
  body?: unknown
) {
  const rateLimited = rateLimitOrNull(request, { maxRequests: 20, windowSeconds: 60, prefix: 'gas' });
  if (rateLimited) return rateLimited;

  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const allowed = await assertActionAllowed(action, authResult.email);
  if (allowed) return allowed;

  const gasUrl = buildGasUrl(action);
  if (!gasUrl) {
    return NextResponse.json(
      { status: 'error', message: 'GAS_SCRIPT_URL is not configured' },
      { status: 503 }
    );
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 28000);

  try {
    const response = await fetch(gasUrl.toString(), {
      method,
      headers: method === 'POST' ? { 'Content-Type': 'application/json' } : { Accept: 'application/json' },
      body: method === 'POST' && body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`GAS returned ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data, {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Content-Type': 'application/json',
      },
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function GET(request: NextRequest) {
  try {
    const action = sanitizeAction(request.nextUrl.searchParams.get('action'));
    if (!action) {
      return NextResponse.json(
        { status: 'error', message: 'Missing or invalid action parameter' },
        { status: 400 }
      );
    }

    return await handleGasRequest(request, 'GET', action);
  } catch (error: any) {
    console.error('[GAS-API] GET Error:', error?.message || error);
    return NextResponse.json(
      { status: 'error', message: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const action = sanitizeAction(request.nextUrl.searchParams.get('action'));
    if (!action) {
      return NextResponse.json(
        { status: 'error', message: 'Missing or invalid action parameter' },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    return await handleGasRequest(request, 'POST', action, body);
  } catch (error: any) {
    console.error('[GAS-API] POST Error:', error?.message || error);
    return NextResponse.json(
      { status: 'error', message: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin') || '';
  const allowedOrigin = origin.endsWith('.psusci.club') || origin.startsWith('http://localhost:') || origin.endsWith('.app.github.dev')
    ? origin : 'https://sccshop.psusci.club';
  return NextResponse.json(
    { status: 'ok' },
    {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'no-cache',
      },
    }
  );
}
