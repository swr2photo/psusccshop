/**
 * Client-side API helpers for Next.js routes (Vercel) or split Elysia backend.
 *
 * Browser always uses same-origin /api/* — Vercel middleware proxies to Workers
 * via API_INTERNAL_URL (cookies stay on sccshop.psuscc.club, no CORS).
 *
 * Server-side may use API_INTERNAL_URL or NEXT_PUBLIC_API_URL for direct backend calls.
 */

const API_PREFIX = '/api';

function normalizePath(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const withSlash = path.startsWith('/') ? path : `/${path}`;
  return withSlash.startsWith(API_PREFIX) ? withSlash : `${API_PREFIX}${withSlash}`;
}

/** Base URL for API calls. Browser: always same-origin. Server: backend URL if configured. */
export function getPublicApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return '';
  }
  return (
    process.env.API_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    ''
  ).replace(/\/$/, '');
}

/** True when API runs on a separate backend (proxy or direct server-side). */
export function isSplitApiBackend(): boolean {
  return Boolean(
    process.env.API_INTERNAL_URL?.trim() ||
      process.env.NEXT_PUBLIC_API_URL?.trim(),
  );
}

/** Resolve a path to a full API URL. Auth routes always stay same-origin. */
function isAuthApiPath(path: string): boolean {
  return normalizePath(path).startsWith('/api/auth');
}

export function apiUrl(path: string): string {
  const normalized = normalizePath(path);
  if (isAuthApiPath(normalized)) return normalized;
  const base = getPublicApiBaseUrl();
  return base ? `${base}${normalized}` : normalized;
}

/** fetch() wrapper — uses apiUrl + sends cookies for cross-origin when configured. */
export async function apiFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const normalized = normalizePath(path);
  const authRoute = isAuthApiPath(normalized);
  const url = authRoute ? normalized : apiUrl(path);
  const useCredentials = !authRoute && Boolean(getPublicApiBaseUrl());

  return fetch(url, {
    ...init,
    credentials: useCredentials ? 'include' : init?.credentials ?? 'same-origin',
  });
}

// ============== TYPES ==============

export interface APIResponse<T = any> {
  status: 'success' | 'error';
  data?: T;
  config?: T;
  orders?: any;
  logs?: any;
  message?: string;
  error?: any;
  ref?: string;
  timestamp?: string;
  statusCode?: number;
  code?: string;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: any;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details?: any
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }

  toJSON() {
    return {
      status: 'error',
      statusCode: this.statusCode,
      code: this.code,
      message: this.message,
      details: this.details
    };
  }
}

type FetchOptions = Omit<RequestInit, 'body'> & { body?: any };

async function fetchJson<T = any>(path: string, opts?: FetchOptions): Promise<APIResponse<T>> {
  try {
    const { body, headers, ...rest } = opts || {};
    const method = rest.method || 'GET';
    const isRead = method === 'GET';
    const init: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(isRead ? { Accept: 'application/json' } : {}),
        ...(headers || {}),
      },
      ...(isRead ? {} : { cache: 'no-store' as RequestCache }),
      ...rest,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    };

    const res = await apiFetch(path, init);
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok) {
      const text = await res.text();
      let extractedMessage = '';
      try {
        const parsed = JSON.parse(text);
        extractedMessage = parsed.message || parsed.error?.message || parsed.error || '';
      } catch (e) {
        // Not JSON
      }

      if (!extractedMessage) {
        extractedMessage = `HTTP ${res.status}: ${text.slice(0, 200)}`;
      } else {
        // Translate known client-side errors directly if returned by backend
        const lower = extractedMessage.toLowerCase();
        if (lower.includes('timeout-or-duplicate') || lower.includes('turnstile')) {
          extractedMessage = 'การยืนยันตัวตน (บอท) หมดอายุหรือผิดพลาด กรุณาลองใหม่อีกครั้ง';
        } else if (lower.includes('rate limit') || lower.includes('too many requests') || lower.includes('เร็วเกินไป')) {
          extractedMessage = 'คุณส่งคำขอถี่เกินไป กรุณารอสักครู่แล้วลองใหม่อีกครั้ง';
        }
      }

      return {
        status: 'error',
        message: extractedMessage,
        error: { code: 'HTTP_ERROR', status: res.status }
      } as APIResponse<T>;
    }
    if (!contentType.includes('application/json')) {
      const text = await res.text();
      return {
        status: 'error',
        message: 'Server did not return JSON: ' + text.slice(0, 200),
        error: { code: 'INVALID_RESPONSE' }
      } as APIResponse<T>;
    }
    return await res.json();
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      console.warn('[API] Network error - offline or server unreachable');
      return {
        status: 'error',
        message: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ - กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต',
        error: {
          code: 'NETWORK_ERROR',
          offline: typeof navigator !== 'undefined' ? !navigator.onLine : false
        }
      } as APIResponse<T>;
    }

    console.error('[API] Fetch error:', error);
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ',
      error: { code: 'FETCH_ERROR' }
    } as APIResponse<T>;
  }
}

// ============== SPECIFIC API FUNCTIONS ==============

export async function submitOrder(data: {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  customerInstagram: string;
  cart: any[];
  totalAmount: number;
  turnstileToken?: string;
  shippingOptionId?: string;
  paymentOptionId?: string;
  shippingFee?: number;
  promoCode?: string;
  promoDiscount?: number;
  shopId?: string;
  shopSlug?: string;
}): Promise<APIResponse> {
  return fetchJson('/api/orders', { method: 'POST', body: data });
}

export async function cancelOrder(ref: string): Promise<APIResponse> {
  return fetchJson(`/api/orders?ref=${encodeURIComponent(ref)}`, { method: 'DELETE' });
}

export async function deleteOrderAdmin(ref: string, hard?: boolean): Promise<APIResponse> {
  const qs = `ref=${encodeURIComponent(ref)}${hard ? '&hard=true' : ''}`;
  return fetchJson(`/api/orders?${qs}`, { method: 'DELETE' });
}

export async function updateOrderAdmin(
  ref: string,
  data: Record<string, any>,
  adminEmail?: string
): Promise<APIResponse> {
  return fetchJson('/api/orders', { method: 'PUT', body: { ref, data, adminEmail } });
}

export async function getProfile(email: string): Promise<APIResponse> {
  return fetchJson(`/api/profile?email=${encodeURIComponent(email)}`);
}

export async function saveProfile(
  email: string,
  data: {
    name?: string;
    phone?: string;
    address?: string;
    instagram?: string;
    profileImage?: string;
    theme?: string;
    savedAddresses?: Array<{ id: string; label: string; address: string; isDefault: boolean }>;
  }
): Promise<APIResponse> {
  return fetchJson('/api/profile', {
    method: 'POST',
    body: { email, data },
  });
}

export async function getHistory(email: string, cursor?: string, limit = 50, shopSlug?: string): Promise<APIResponse> {
  const params = new URLSearchParams({ email, limit: String(limit) });
  if (cursor) params.append('cursor', cursor);
  if (shopSlug) params.append('shopSlug', shopSlug);
  return fetchJson(`/api/orders?${params.toString()}`);
}

export async function getPaymentInfo(ref: string): Promise<APIResponse> {
  return fetchJson(`/api/payment-info?ref=${encodeURIComponent(ref)}`);
}

export async function saveCart(email: string, cart: any[]): Promise<APIResponse> {
  return fetchJson('/api/cart', { method: 'POST', body: { email, cart } });
}

export async function getCart(email: string): Promise<APIResponse> {
  return fetchJson(`/api/cart?email=${encodeURIComponent(email)}`);
}

export async function getPublicConfig(fresh = false): Promise<APIResponse> {
  if (fresh) {
    return fetchJson(`/api/config?v=${Date.now()}`, { cache: 'no-store' as RequestCache });
  }
  return fetchJson('/api/config');
}

export async function syncOrdersSheet(
  mode: 'create' | 'sync',
  sheetId?: string,
  vendorSheetId?: string
): Promise<APIResponse> {
  return fetchJson('/api/admin/sheet', { method: 'POST', body: { mode, sheetId, vendorSheetId } });
}

export async function getAdminData(): Promise<APIResponse> {
  return fetchJson('/api/admin/data');
}

export async function saveShopConfig(
  config: any,
  adminEmail: string
): Promise<APIResponse> {
  return fetchJson('/api/config', { method: 'POST', body: { config, adminEmail } });
}

export async function updateOrderStatusAPI(
  ref: string,
  status: string,
  adminEmail: string
): Promise<APIResponse> {
  return fetchJson('/api/admin/status', { method: 'POST', body: { ref, status, adminEmail } });
}

export async function sendCustomEmail(
  to: string,
  subject: string,
  body: string,
  adminEmail: string
): Promise<APIResponse> {
  return fetchJson('/api/auto-email', {
    method: 'POST',
    body: {
      type: 'custom',
      to,
      subject,
      message: body,
      adminEmail,
    },
  });
}

// ============== UTILITY FUNCTIONS ==============

export function isSuccess(response: APIResponse): boolean {
  return response.status === 'success';
}

export function getErrorMessage(response: APIResponse): string {
  if (typeof response === 'object' && response !== null) {
    if (response.message) return response.message;
    if (response.error) return String(response.error);
  }
  return 'An unknown error occurred';
}

export function throwIfError(response: APIResponse): void {
  if (!isSuccess(response)) {
    throw new AppError(
      400,
      'API_ERROR',
      getErrorMessage(response),
      { response }
    );
  }
}

export function enableDebugMode(): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('NEXT_PUBLIC_DEBUG', 'true');
    console.log('Debug mode enabled');
  }
}

export function disableDebugMode(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('NEXT_PUBLIC_DEBUG');
    console.log('Debug mode disabled');
  }
}
