// src/lib/cloudflare.ts
// Client-safe Cloudflare Turnstile constants (public site key only).
// Secret verification lives in `@/lib/cloudflare-server`.

/**
 * Cloudflare Turnstile Site Key (public - ใช้ใน frontend)
 * ตั้งค่าใน Environment Variables: NEXT_PUBLIC_TURNSTILE_SITE_KEY
 */
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';

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
