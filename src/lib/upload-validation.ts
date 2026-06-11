import { isSupabaseStorageUrl } from '@/lib/supabase';

const ALLOWED_MIMES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];

export function validateImageBuffer(buffer: Buffer, mime?: string): { ok: true; contentType: string } | { ok: false; message: string } {
  if (buffer.length === 0) {
    return { ok: false, message: 'Empty file' };
  }

  const contentType = mime || 'image/png';
  if (!ALLOWED_MIMES.includes(contentType)) {
    return { ok: false, message: 'Invalid file type. Only images allowed.' };
  }

  const magicBytes = buffer.slice(0, 8);
  const isPng = magicBytes[0] === 0x89 && magicBytes[1] === 0x50 && magicBytes[2] === 0x4e && magicBytes[3] === 0x47;
  const isJpeg = magicBytes[0] === 0xff && magicBytes[1] === 0xd8;
  const isGif = magicBytes[0] === 0x47 && magicBytes[1] === 0x49 && magicBytes[2] === 0x46;
  const isWebp = magicBytes[0] === 0x52 && magicBytes[1] === 0x49 && magicBytes[2] === 0x46 && magicBytes[3] === 0x46;

  if (!isPng && !isJpeg && !isGif && !isWebp) {
    return { ok: false, message: 'Invalid image file' };
  }

  return { ok: true, contentType };
}

export function isAllowedPassThroughImageUrl(value: string): boolean {
  if (value.startsWith('/api/image/')) return true;
  return isSupabaseStorageUrl(value);
}
