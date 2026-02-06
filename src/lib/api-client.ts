/**
 * API Client for Google Apps Script Integration
 * Compatible with Code.gs implementation
 */

// ============== TYPES ==============

export interface APIResponse<T = any> {
  status: 'success' | 'error';
  data?: T;
  config?: T;  // GAS returns config directly
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

// ============== API CLIENT ==============

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: Record<string, any>;
  headers?: Record<string, string>;
  timeout?: number;
}

class APIClient {
  private baseUrl: string;
  private timeout: number;
  private debug: boolean;

  constructor() {
    // Read URL fresh each time (for SSR/client hydration)
    this.baseUrl = '';
    this.timeout = 60000;
    this.debug = true; // Always debug for now
  }

  private getBaseUrl(): string {
    // Always read from env (handles SSR vs client)
    const url = typeof window !== 'undefined' 
      ? process.env.NEXT_PUBLIC_GAS_URL 
      : process.env.NEXT_PUBLIC_GAS_URL;
    return url || '';
  }

  /**
   * Build URL with query parameters
   */
  private buildUrl(action: string, params?: Record<string, any>): string {
    const baseUrl = this.getBaseUrl();

    if (!baseUrl) {
      throw new AppError(
        500,
        'CONFIG_ERROR',
        'GAS API URL not configured',
        { hint: 'Set NEXT_PUBLIC_GAS_URL in .env.local' }
      );
    }

    const url = new URL(baseUrl);
    url.searchParams.append('action', action);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
        }
      });
    }

    return url.toString();
  }

  /**
   * Make HTTP request to GAS
   */
  async request<T = any>(
    action: string,
    options: RequestOptions = {}
  ): Promise<APIResponse<T>> {
    const {
      method = 'GET',
      body = {},
      headers = {},
      timeout = this.timeout
    } = options;

    const baseUrl = this.getBaseUrl();

    // Check URL before making request
    if (!baseUrl) {
      const envCheck = {
        NEXT_PUBLIC_GAS_URL: process.env.NEXT_PUBLIC_GAS_URL || 'NOT SET',
        NODE_ENV: process.env.NODE_ENV,
      };
      console.error('Environment check:', envCheck);
      console.error('กรุณาสร้างไฟล์ .env.local ที่ root ของโปรเจค:');
      console.error('   NEXT_PUBLIC_GAS_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec');
      
      return {
        status: 'error',
        message: 'กรุณาตั้งค่า NEXT_PUBLIC_GAS_URL ในไฟล์ .env.local แล้ว restart server',
        error: { code: 'CONFIG_ERROR', envCheck }
      };
    }

    // Validate URL format
    if (!baseUrl.includes('script.google.com/macros')) {
      console.error('URL ไม่ถูกต้อง:', baseUrl);
      return {
        status: 'error',
        message: 'URL ต้องเป็นรูปแบบ: https://script.google.com/macros/s/.../exec',
        error: { code: 'INVALID_URL', url: baseUrl }
      };
    }

    try {
      // Build URL
      const url = new URL(baseUrl);
      url.searchParams.append('action', action);
      
      // For GET, add body as query params
      if (method === 'GET' && body) {
        Object.entries(body).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            url.searchParams.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
          }
        });
      }

      const fullUrl = url.toString();
      console.log(`[${action}] URL:`, fullUrl);

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const fetchOptions: RequestInit = {
        method: method === 'GET' ? 'GET' : 'POST',
        signal: controller.signal,
        mode: 'cors',
        credentials: 'omit',
        redirect: 'follow', // Important: GAS redirects
      };

      // Only add Content-Type for POST with body
      if (method !== 'GET' && Object.keys(body).length > 0) {
        fetchOptions.headers = { 'Content-Type': 'text/plain' }; // GAS works better with text/plain
        fetchOptions.body = JSON.stringify(body);
      }

      console.log('Fetch options:', { method: fetchOptions.method, mode: fetchOptions.mode });

      // Make fetch request
      const response = await fetch(fullUrl, fetchOptions);
      clearTimeout(timeoutId);

      console.log(`Response: ${response.status} ${response.statusText}`);
      console.log(`Response URL: ${response.url}`);

      // Check if response is ok
      if (!response.ok) {
        const errorText = await response.text();
        throw new AppError(
          response.status,
          'HTTP_ERROR',
          `HTTP ${response.status}: ${response.statusText}`,
          { responseText: errorText }
        );
      }

      // Check content-type before parsing
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await response.text();
        throw new AppError(
          500,
          'INVALID_CONTENT_TYPE',
          'เซิร์ฟเวอร์ส่งข้อมูลผิดรูปแบบ (Content-Type ไม่ใช่ application/json)',
          { contentType, responseText: text.substring(0, 200) }
        );
      }

      // Parse JSON safely
      let data: APIResponse<T>;
      try {
        data = await response.json();
      } catch (parseError) {
        const text = await response.text();
        throw new AppError(
          500,
          'PARSE_ERROR',
          'Failed to parse JSON response',
          { responseText: text.substring(0, 200) }
        );
      }

      if (this.debug) {
        console.log('GAS Response:', {
          status: data.status,
          hasData: !!data.data,
          hasConfig: !!data.config,
          message: data.message,
          timestamp: new Date().toISOString()
        });
      }

      // Normalize response for admin/config endpoints that return flat objects
      if (!data.data) {
        const hasAdminShape = data.orders || data.logs || data.config;
        const hasConfigOnly = data.config && !data.orders && !data.logs;

        if (hasAdminShape) {
          return {
            ...data,
            data: {
              orders: data.orders,
              logs: data.logs,
              config: data.config,
            } as any,
          };
        }

        if (hasConfigOnly) {
          return {
            ...data,
            data: { config: data.config } as any,
          };
        }

        // Generic normalization: wrap non-meta fields into data
        const metaKeys = new Set(['status', 'message', 'error', 'statusCode', 'code', 'timestamp']);
        const payloadEntries = Object.entries(data).filter(([key, value]) => !metaKeys.has(key) && value !== undefined);

        if (payloadEntries.length > 0) {
          const payload = Object.fromEntries(payloadEntries);
          return {
            ...data,
            data: payload as any,
          };
        }
      }

      return data;

    } catch (error) {
      return this.handleError(error, action);
    }
  }

  /**
   * Handle errors
   */
  private handleError(error: unknown, action: string): APIResponse {
    // Log full error for debugging
    console.error(`Full error object:`, error);

    if (error instanceof AppError) {
      console.error(`AppError (${action}):`, error.message);
      return {
        status: 'error',
        message: error.message,
        statusCode: error.statusCode,
        code: error.code,
        error: { code: error.code, details: error.details }
      };
    }

    // Check for fetch/network errors
    if (error instanceof TypeError) {
      console.error(`Network Error (${action}):`, error.message);
      
      // Provide more specific guidance
      let helpMessage = 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์';
      
      if (error.message.includes('Failed to fetch')) {
        helpMessage = `ไม่สามารถเชื่อมต่อได้ - ตรวจสอบ:
1. ไฟล์ .env.local มี NEXT_PUBLIC_GAS_URL หรือไม่
2. URL ถูกต้องและ Deploy แล้วหรือยัง
3. GAS ตั้งค่าเป็น "Anyone" หรือยัง
4. Restart dev server หลังแก้ไข .env.local`;
      }
      
      return {
        status: 'error',
        message: helpMessage,
        error: { code: 'NETWORK_ERROR', originalMessage: error.message }
      };
    }

    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`Timeout (${action})`);
      return {
        status: 'error',
        message: `หมดเวลาการเชื่อมต่อ (${this.timeout / 1000}s) - กรุณาลองใหม่`,
        error: { code: 'TIMEOUT_ERROR' }
      };
    }

    console.error(`Unknown Error (${action}):`, error);

    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ',
      error: { code: 'UNKNOWN_ERROR' }
    };
  }

  /**
   * Sanitize URL for logging (hide sensitive data)
   */
  private sanitizeUrl(url: string): string {
    try {
      const u = new URL(url);
      // Hide full domain but keep the action
      return `GAS_URL?action=${u.searchParams.get('action')}`;
    } catch {
      return 'INVALID_URL';
    }
  }

  /**
   * Sanitize body for logging (hide sensitive data)
   */
  private sanitizeBody(body: Record<string, any>): Record<string, any> {
    const sanitized = { ...body };
    const sensitiveFields = ['password', 'token', 'secret', 'authorization', 'credit'];
    
    sensitiveFields.forEach(field => {
      if (field in sanitized) {
        sanitized[field] = '***hidden***';
      }
    });
    
    return sanitized;
  }
}

// ============== SINGLETON INSTANCE ==============

const apiClient = new APIClient();

// ============== EXPORTED FUNCTIONS ==============

// Legacy GAS entrypoints removed; use internal Next.js routes backed by Filebase
type FetchOptions = Omit<RequestInit, 'body'> & { body?: any };

async function fetchJson<T = any>(path: string, opts?: FetchOptions): Promise<APIResponse<T>> {
  try {
    const { body, headers, ...rest } = opts || {};
    const init: RequestInit = {
      method: rest.method || 'GET',
      headers: { 'Content-Type': 'application/json', ...(headers || {}) },
      cache: 'no-store', // ป้องกัน browser cache เพื่อให้ได้ข้อมูลล่าสุดเสมอ
      ...rest,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    };

    const res = await fetch(path, init);
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok) {
      // Try to get error message from text
      const text = await res.text();
      return {
        status: 'error',
        message: `HTTP ${res.status}: ${text.slice(0, 200)}`,
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
    // Handle network errors (offline, server down, etc.)
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      console.warn('[API] Network error - offline or server unreachable');
      return {
        status: 'error',
        message: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ - กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต',
        error: { code: 'NETWORK_ERROR', offline: !navigator.onLine }
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

// --- CLIENT ENDPOINTS ---

/**
 * Submit new order
 */
export async function submitOrder(data: {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  customerInstagram: string;
  cart: any[];
  totalAmount: number;
  turnstileToken?: string;
  // Shipping and payment options
  shippingOptionId?: string;
  paymentOptionId?: string;
  shippingFee?: number;
}): Promise<APIResponse> {
  return fetchJson('/api/orders', { method: 'POST', body: data });
}

/**
 * Cancel order
 */
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

/**
 * Get user profile
 */
export async function getProfile(email: string): Promise<APIResponse> {
  return fetchJson(`/api/profile?email=${encodeURIComponent(email)}`);
}

/**
 * Save user profile
 */
export async function saveProfile(
  email: string,
  data: {
    name?: string;
    phone?: string;
    address?: string;
    instagram?: string;
    profileImage?: string;
    theme?: string;
  }
): Promise<APIResponse> {
  return fetchJson('/api/profile', {
    method: 'POST',
    body: { email, data },
  });
}

/**
 * Get order history for user (supports pagination via cursor/limit)
 */
export async function getHistory(email: string, cursor?: string, limit = 50): Promise<APIResponse> {
  const params = new URLSearchParams({ email, limit: String(limit) });
  if (cursor) params.append('cursor', cursor);
  return fetchJson(`/api/orders?${params.toString()}`);
}

/**
 * Get payment info for order
 */
export async function getPaymentInfo(ref: string): Promise<APIResponse> {
  return fetchJson(`/api/payment-info?ref=${encodeURIComponent(ref)}`);
}

/**
 * Save shopping cart to cloud
 */
export async function saveCart(
  email: string,
  cart: any[]
): Promise<APIResponse> {
  return fetchJson('/api/cart', { method: 'POST', body: { email, cart } });
}

/**
 * Load shopping cart from cloud
 */
export async function getCart(email: string): Promise<APIResponse> {
  return fetchJson(`/api/cart?email=${encodeURIComponent(email)}`);
}

/**
 * Get public shop configuration
 */
export async function getPublicConfig(): Promise<APIResponse> {
  return fetchJson('/api/config');
}

export async function syncOrdersSheet(
  mode: 'create' | 'sync',
  sheetId?: string,
  vendorSheetId?: string
): Promise<APIResponse> {
  return fetchJson('/api/admin/sheet', { method: 'POST', body: { mode, sheetId, vendorSheetId } });
}

// --- ADMIN ENDPOINTS ---

/**
 * Get admin dashboard data (requires authentication)
 */
export async function getAdminData(adminEmail: string): Promise<APIResponse> {
  return fetchJson('/api/admin/data');
}

/**
 * Save shop configuration (requires authentication)
 */
export async function saveShopConfig(
  config: any,
  adminEmail: string
): Promise<APIResponse> {
  return fetchJson('/api/config', { method: 'POST', body: { config, adminEmail } });
}

/**
 * Update order status (requires authentication)
 */
export async function updateOrderStatusAPI(
  ref: string,
  status: string,
  adminEmail: string
): Promise<APIResponse> {
  return fetchJson('/api/admin/status', { method: 'POST', body: { ref, status, adminEmail } });
}

/**
 * Send custom email (requires authentication)
 */
export async function sendCustomEmail(
  to: string,
  subject: string,
  body: string,
  adminEmail: string
): Promise<APIResponse> {
  // Stub: no-op
  return { status: 'success', message: 'Email stubbed (Filebase mode)' } as APIResponse;
}

// ============== UTILITY FUNCTIONS ==============

/**
 * Check if response is successful
 */
export function isSuccess(response: APIResponse): boolean {
  return response.status === 'success';
}

/**
 * Get error message from response
 */
export function getErrorMessage(response: APIResponse): string {
  if (typeof response === 'object' && response !== null) {
    if (response.message) return response.message;
    if (response.error) return String(response.error);
  }
  return 'An unknown error occurred';
}

/**
 * Throw error if response is not successful
 */
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

// ============== DEBUG UTILITIES ==============

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
