/**
 * Helper to map complex or system error messages into user-friendly Thai messages.
 * Handles parsing JSON error structures (like API responses) and translating standard
 * HTTP error states or internal server terms.
 */
export function formatFriendlyError(message: string): string {
  if (!message) return 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';

  let cleanMessage = message;

  // 1. Try to extract message if it is wrapped in an HTTP status prefix with JSON
  // e.g. "HTTP 400: {"status":"error","message":"สินค้า \"New Product\" ปิดการขายแล้ว"}"
  // or "HTTP 400: Turnstile verification failed: timeout-or-duplicate"
  if (message.startsWith('HTTP ')) {
    const jsonStartIdx = message.indexOf('{');
    if (jsonStartIdx !== -1) {
      const jsonStr = message.substring(jsonStartIdx);
      try {
        const parsed = JSON.parse(jsonStr);
        if (parsed.message) {
          cleanMessage = parsed.message;
        } else if (parsed.error?.message) {
          cleanMessage = parsed.error.message;
        } else if (parsed.error) {
          cleanMessage = typeof parsed.error === 'string' ? parsed.error : JSON.stringify(parsed.error);
        }
      } catch (e) {
        // Not valid JSON, keep as is
      }
    } else {
      // It starts with HTTP but is not JSON, e.g. "HTTP 400: Turnstile verification failed: timeout-or-duplicate"
      // Strip the HTTP status prefix to translate the rest
      const colonIdx = message.indexOf(':');
      if (colonIdx !== -1) {
        cleanMessage = message.substring(colonIdx + 1).trim();
      }
    }
  }

  const lower = cleanMessage.toLowerCase();

  // 2. Map known system errors to friendly Thai
  if (lower.includes('failed to fetch') || lower.includes('network error') || lower.includes('fetch failed')) {
    return 'การเชื่อมต่อเครือข่ายล้มเหลว กรุณาตรวจสอบอินเทอร์เน็ตของคุณ';
  }
  if (lower.includes('internal server error') || lower.includes('500') || lower.includes('server error')) {
    return 'เกิดข้อผิดพลาดทางเทคนิคที่เซิร์ฟเวอร์ กรุณาลองใหม่อีกครั้งในภายหลัง';
  }
  if (lower.includes('unauthorized') || lower.includes('jwt expired') || lower.includes('token expired') || lower.includes('401')) {
    return 'เซสชันหมดอายุหรือคุณไม่มีสิทธิ์ใช้งาน กรุณาเข้าสู่ระบบใหม่อีกครั้ง';
  }
  if (lower.includes('forbidden') || lower.includes('403')) {
    return 'คุณไม่มีสิทธิ์เข้าถึงหรือดำเนินการในส่วนนี้';
  }
  if (lower.includes('not found') || lower.includes('404')) {
    return 'ไม่พบข้อมูลที่ต้องการ กรุณาตรวจสอบอีกครั้ง';
  }
  if (lower.includes('duplicate key') || lower.includes('already exists') || lower.includes('unique constraint')) {
    return 'ข้อมูลนี้มีอยู่แล้วในระบบ ไม่สามารถสร้างซ้ำได้';
  }
  if (lower.includes('row-level security') || lower.includes('rls') || lower.includes('policy')) {
    return 'ข้อผิดพลาดในการตรวจสอบสิทธิ์การเข้าถึงข้อมูล';
  }
  if (lower.includes('json') || lower.includes('parse')) {
    return 'การประมวลผลข้อมูลผิดพลาด กรุณาลองใหม่อีกครั้ง';
  }
  if (lower.includes('timeout')) {
    return 'การเชื่อมต่อใช้เวลานานเกินไป กรุณาลองใหม่อีกครั้ง';
  }
  if (lower.includes('bad request') || lower.includes('400')) {
    return 'คำขอไม่ถูกต้อง กรุณาตรวจสอบข้อมูลที่กรอก';
  }
  if (lower.includes('uuid') || lower.includes('invalid input syntax')) {
    return 'ข้อมูลไม่ถูกต้องหรือรูปแบบไม่ตรงตามที่กำหนด';
  }
  if (lower.includes('timeout-or-duplicate') || lower.includes('turnstile') || lower.includes('captcha')) {
    return 'การยืนยันตัวตน (บอท) หมดอายุหรือผิดพลาด กรุณาลองใหม่อีกครั้ง';
  }
  if (lower.includes('rate limit') || lower.includes('too many requests') || lower.includes('429') || lower.includes('เร็วเกินไป')) {
    return 'คุณส่งคำขอถี่เกินไป กรุณารอสักครู่แล้วลองใหม่อีกครั้ง';
  }

  return cleanMessage;
}
