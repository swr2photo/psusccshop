// src/lib/cloudflare.ts
// Cloudflare Turnstile integration for bot protection

/**
 * Cloudflare Turnstile Site Key (public - ใช้ใน frontend)
 * ตั้งค่าใน Environment Variables: NEXT_PUBLIC_TURNSTILE_SITE_KEY
 */
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';

/**
 * Cloudflare Turnstile Secret Key (private - ใช้ใน backend เท่านั้น)
 * ตั้งค่าใน Environment Variables: TURNSTILE_SECRET_KEY
 */
const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY || '';

/**
 * Cloudflare Turnstile Verification URL
 */
const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Response from Turnstile verification
 */
export interface TurnstileVerifyResponse {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  'error-codes'?: string[];
  action?: string;
  cdata?: string;
}

/**
 * Verify Turnstile token on server side
 * @param token - Token received from frontend Turnstile widget
 * @param remoteip - Optional IP address of the user
 * @returns Verification result
 */
export async function verifyTurnstileToken(
  token: string,
  remoteip?: string
): Promise<{ success: boolean; error?: string }> {
  // Skip verification in development or if no secret key configured
  if (!TURNSTILE_SECRET_KEY) {
    console.warn('[Turnstile] Secret key not configured, skipping verification');
    return { success: true };
  }

  if (!token) {
    return { success: false, error: 'Missing Turnstile token' };
  }

  try {
    const formData = new URLSearchParams();
    formData.append('secret', TURNSTILE_SECRET_KEY);
    formData.append('response', token);
    if (remoteip) {
      formData.append('remoteip', remoteip);
    }

    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const result: TurnstileVerifyResponse = await response.json();

    if (!result.success) {
      const errorCodes = result['error-codes']?.join(', ') || 'Unknown error';
      console.error('[Turnstile] Verification failed:', errorCodes);
      return { success: false, error: `Turnstile verification failed: ${errorCodes}` };
    }

    return { success: true };
  } catch (error: any) {
    console.error('[Turnstile] Verification error:', error);
    return { success: false, error: 'Turnstile verification service unavailable' };
  }
}

/**
 * Get client IP from request headers (works with Cloudflare)
 */
export function getClientIP(request: Request): string | undefined {
  // Cloudflare headers (priority)
  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  if (cfConnectingIP) return cfConnectingIP;

  // Standard forwarded headers
  const xForwardedFor = request.headers.get('x-forwarded-for');
  if (xForwardedFor) {
    // Get first IP in the chain (original client)
    return xForwardedFor.split(',')[0].trim();
  }

  const xRealIP = request.headers.get('x-real-ip');
  if (xRealIP) return xRealIP;

  return undefined;
}

/**
 * Check if request is from Cloudflare (verify CF headers)
 */
export function isCloudflareRequest(request: Request): boolean {
  // Cloudflare always adds these headers
  return !!(
    request.headers.get('cf-ray') ||
    request.headers.get('cf-connecting-ip')
  );
}

/**
 * Get Cloudflare country from request
 */
export function getCloudflareCountry(request: Request): string | undefined {
  return request.headers.get('cf-ipcountry') || undefined;
}

/**
 * Error messages for Turnstile error codes
 */
export const TURNSTILE_ERROR_MESSAGES: Record<string, string> = {
  'missing-input-secret': 'Missing secret key configuration',
  'invalid-input-secret': 'Invalid secret key',
  'missing-input-response': 'กรุณายืนยันว่าคุณไม่ใช่บอท',
  'invalid-input-response': 'การยืนยันไม่ถูกต้อง กรุณาลองใหม่',
  'bad-request': 'Request ไม่ถูกต้อง',
  'timeout-or-duplicate': 'การยืนยันหมดอายุ กรุณาลองใหม่',
  'internal-error': 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่',
};

/**
 * Get user-friendly error message from Turnstile error code
 */
export function getTurnstileErrorMessage(errorCode: string): string {
  return TURNSTILE_ERROR_MESSAGES[errorCode] || 'เกิดข้อผิดพลาดในการยืนยัน กรุณาลองใหม่';
}
