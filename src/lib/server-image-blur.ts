import zlib from 'zlib';
import type { Product } from './config';
import { resolveImageToken } from './image-crypto';
import { uploadImageToStorage } from './supabase';

const ALLOWED_BLUR_SOURCE_DOMAINS = [
  'ipfs.filebase.io',
  's3.filebase.com',
  'supabase.co',
  'supabase.com',
  'supabase.net',
  'cloudflare.com',
  'cdn.jsdelivr.net',
  'lh3.googleusercontent.com',
  'ui-avatars.com',
  'localhost',
  '127.0.0.1',
];

const inFlightBlurUploads = new Map<string, Promise<string | null>>();
const recentBlurredUrlBySource = new Map<string, string>();

/** Deterministic fallback frosted neutral PNG (never returns clear pixels). */
function createFallbackBlurredPng(): Buffer {
  const width = 48;
  const height = 48;
  const rows = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 4);
    rows[rowStart] = 0;
    for (let x = 0; x < width; x++) {
      const px = rowStart + 1 + x * 4;
      const shade = Math.round(166 + ((x + y) / (width + height)) * 34);
      rows[px] = shade;
      rows[px + 1] = shade + 4;
      rows[px + 2] = shade + 10;
      rows[px + 3] = 255;
    }
  }
  const crc32 = (buf: Buffer): number => {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      crc ^= buf[i];
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer): Buffer => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const compressed = zlib.deflateSync(rows);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function isAllowedBlurSourceUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    const host = parsed.hostname.toLowerCase();
    return ALLOWED_BLUR_SOURCE_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

/** Resolve raw HTTPS URL from either direct URL or /api/image/<token>. */
export function normalizeRealImageUrl(rawUrl?: string | null): string | null {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed || trimmed.startsWith('data:')) return null;

  let resolvedUrl = trimmed;
  if (resolvedUrl.startsWith('/api/image/')) {
    const token = resolvedUrl.slice('/api/image/'.length).split('?')[0];
    const resolved = resolveImageToken(token);
    if (!resolved?.url) return null;
    resolvedUrl = resolved.url;
  }

  return isAllowedBlurSourceUrl(resolvedUrl) ? resolvedUrl : null;
}

export function getPrimaryProductImage(product: Pick<Product, 'coverImage' | 'images'>): string {
  return (product.coverImage || product.images?.[0] || '').trim();
}

/**
 * Downsample heavily + double-blur into a smooth WebP preview buffer.
 * High-frequency logos/text/design details are permanently destroyed on the server.
 */
export async function generateBlurredImageBuffer(
  sourceBuffer: Buffer,
): Promise<{ buffer: Buffer; contentType: string; ext: string }> {
  try {
    const sharpMod = await import('sharp').catch(() => null);
    const sharpFn = sharpMod?.default;
    if (typeof sharpFn === 'function') {
      const tiny = await sharpFn(sourceBuffer)
        .rotate()
        .resize(48, 48, { fit: 'inside', withoutEnlargement: true })
        .blur(8)
        .toBuffer();
      const blurred = await sharpFn(tiny)
        .resize(360, 360, { fit: 'inside' })
        .blur(14)
        .webp({ quality: 58 })
        .toBuffer();
      return { buffer: blurred, contentType: 'image/webp', ext: 'webp' };
    }
  } catch (error) {
    console.warn('[server-image-blur] sharp blur failed, using frosted fallback:', error instanceof Error ? error.message : error);
  }

  return {
    buffer: createFallbackBlurredPng(),
    contentType: 'image/png',
    ext: 'png',
  };
}

/** Generate a blurred variant from a raw image buffer and upload it to Supabase Storage (`blurred/`). */
export async function uploadBlurredVariantToStorage(
  sourceBuffer: Buffer,
  fileNameHint?: string,
): Promise<{ url: string; path: string }> {
  const blurred = await generateBlurredImageBuffer(sourceBuffer);
  const baseName = (fileNameHint || 'preview').replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
  return uploadImageToStorage(blurred.buffer, `blur_${baseName}.${blurred.ext}`, blurred.contentType, 'blurred');
}

/** Download an allowed image URL server-side, blur it, upload blurred copy to Storage, and return its permanent URL. */
export async function generateAndUploadBlurredFromUrl(rawUrl: string): Promise<string | null> {
  const sourceUrl = normalizeRealImageUrl(rawUrl);
  if (!sourceUrl) return null;

  const cached = recentBlurredUrlBySource.get(sourceUrl);
  if (cached) return cached;

  const existingPromise = inFlightBlurUploads.get(sourceUrl);
  if (existingPromise) return existingPromise;

  const task = (async (): Promise<string | null> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(sourceUrl, {
        signal: controller.signal,
        headers: {
          Accept: 'image/*',
          'User-Agent': 'PSUSCCSHOP-BlurGenerator/1.0',
        },
      });
      if (!response.ok) {
        console.warn(`[server-image-blur] Source fetch HTTP ${response.status} for blur generation`);
        return null;
      }
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.startsWith('image/')) {
        return null;
      }
      const sourceBuffer = Buffer.from(await response.arrayBuffer());
      const uploaded = await uploadBlurredVariantToStorage(sourceBuffer, 'cover');
      if (recentBlurredUrlBySource.size > 1000) {
        const firstKey = recentBlurredUrlBySource.keys().next().value;
        if (firstKey) recentBlurredUrlBySource.delete(firstKey);
      }
      recentBlurredUrlBySource.set(sourceUrl, uploaded.url);
      return uploaded.url;
    } catch (error) {
      console.warn('[server-image-blur] Failed to generate/upload blurred image:', error instanceof Error ? error.message : error);
      return null;
    } finally {
      clearTimeout(timeoutId);
      inFlightBlurUploads.delete(sourceUrl);
    }
  })();

  inFlightBlurUploads.set(sourceUrl, task);
  return task;
}

/**
 * Ensure every targeted product has a server-uploaded blurred cover image stored in Supabase Storage
 * matching its current primary cover photo.
 */
export async function ensureProductsBlurredImages(
  products: Product[],
  options?: {
    onlyIds?: Set<string>;
    existingProducts?: Product[];
  },
): Promise<{ products: Product[]; changed: boolean }> {
  if (!Array.isArray(products) || products.length === 0) {
    return { products: products || [], changed: false };
  }

  const existingById = new Map<string, Product>();
  for (const prev of options?.existingProducts || []) {
    if (prev?.id) existingById.set(prev.id, prev);
  }

  let changed = false;

  const updated = await Promise.all(
    products.map(async (product) => {
      if (!product) return product;
      if (options?.onlyIds && !options.onlyIds.has(product.id)) {
        return product;
      }

      const primaryRaw = getPrimaryProductImage(product);
      if (!primaryRaw) {
        if (product.blurredCoverImage || product.blurredCoverSource) {
          changed = true;
          const next = { ...product };
          delete next.blurredCoverImage;
          delete next.blurredCoverSource;
          return next;
        }
        return product;
      }

      const canonicalSource = normalizeRealImageUrl(primaryRaw);
      if (!canonicalSource) {
        return product;
      }

      // Check existing blurred image on incoming product (unwrap /api/image/ if admin echoed encoded URL)
      const incomingBlurUrl = normalizeRealImageUrl(product.blurredCoverImage);
      const incomingBlurSource = normalizeRealImageUrl(product.blurredCoverSource) || product.blurredCoverSource;
      if (incomingBlurUrl && incomingBlurSource === canonicalSource) {
        if (product.blurredCoverImage !== incomingBlurUrl || product.blurredCoverSource !== canonicalSource) {
          changed = true;
          return {
            ...product,
            blurredCoverImage: incomingBlurUrl,
            blurredCoverSource: canonicalSource,
          };
        }
        return product;
      }

      // Reuse already-uploaded blurred image from existing DB product if cover photo didn't change
      const prev = existingById.get(product.id);
      const prevBlurUrl = normalizeRealImageUrl(prev?.blurredCoverImage);
      const prevBlurSource = normalizeRealImageUrl(prev?.blurredCoverSource) || prev?.blurredCoverSource;
      if (prevBlurUrl && prevBlurSource === canonicalSource) {
        changed = true;
        return {
          ...product,
          blurredCoverImage: prevBlurUrl,
          blurredCoverSource: canonicalSource,
        };
      }

      // Generate & upload fresh blurred WebP to Supabase Storage
      const uploadedBlurUrl = await generateAndUploadBlurredFromUrl(canonicalSource);
      if (!uploadedBlurUrl) {
        return product;
      }

      changed = true;
      return {
        ...product,
        blurredCoverImage: uploadedBlurUrl,
        blurredCoverSource: canonicalSource,
      };
    }),
  );

  return { products: updated, changed };
}
