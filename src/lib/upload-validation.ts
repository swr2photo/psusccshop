import { isSupabaseStorageUrl } from '@/lib/supabase';

const ALLOWED_MIMES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];

function normalizeMime(mime?: string): string | null {
  if (!mime) return null;
  const base = mime.split(';')[0].trim().toLowerCase();
  if (base === 'image/jpg') return 'image/jpeg';
  if (ALLOWED_MIMES.includes(base)) return base;
  return null;
}

/** Detect image content-type from magic bytes (authoritative over client mime). */
export function detectImageContentType(buffer: Buffer | Uint8Array): string | null {
  if (buffer.length < 12) return null;
  const b = buffer;
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0xff && b[1] === 0xd8) return 'image/jpeg';
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif';
  // RIFF....WEBP
  if (
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  ) {
    return 'image/webp';
  }
  return null;
}

export function validateImageBuffer(
  buffer: Buffer | Uint8Array,
  mime?: string,
): { ok: true; contentType: string } | { ok: false; message: string } {
  if (buffer.length === 0) {
    return { ok: false, message: 'Empty file' };
  }

  const detected = detectImageContentType(buffer);
  if (!detected) {
    return { ok: false, message: 'Invalid image file' };
  }

  const hinted = normalizeMime(mime);
  // Prefer magic-byte type; only reject if client claimed a totally different allowed family
  if (hinted && hinted !== detected && !(hinted === 'image/jpeg' && detected === 'image/jpeg')) {
    // Allow mismatch — client mime is often wrong; trust magic bytes
  }

  return { ok: true, contentType: detected };
}

export function isAllowedPassThroughImageUrl(value: string): boolean {
  if (value.startsWith('/api/image/')) return true;
  return isSupabaseStorageUrl(value);
}
