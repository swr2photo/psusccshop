import { NextRequest, NextResponse } from 'next/server';
import { resolveImageToken } from '@/lib/image-crypto';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import crypto from 'crypto';
import zlib from 'zlib';
import { secureJsonResponse } from '@/lib/payload-crypto';

// Ensure Node runtime for fetch
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ==================== S3 CLIENT FOR IMAGE CACHE ====================

const endpoint = process.env.FILEBASE_ENDPOINT || 'https://s3.filebase.com';
const region = process.env.FILEBASE_REGION || 'us-east-1';
const bucket = process.env.FILEBASE_BUCKET;
const accessKeyId = process.env.FILEBASE_ACCESS_KEY;
const secretAccessKey = process.env.FILEBASE_SECRET_KEY;

const s3Client = new S3Client({
  region,
  endpoint,
  credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
});

// ==================== IMAGE CACHE FUNCTIONS ====================

/**
 * Generate cache key from URL hash
 */
function getCacheKey(url: string): string {
  const hash = crypto.createHash('sha256').update(url).digest('hex');
  return `image-cache/${hash.substring(0, 2)}/${hash}`;
}

function getBlurredCacheKey(url: string): string {
  const hash = crypto.createHash('sha256').update(`blur-v1:${url}`).digest('hex');
  return `image-blur-cache/${hash.substring(0, 2)}/${hash}.webp`;
}

/** Deterministic fallback frosted neutral PNG (never leaks clear pixels if image processing fails). */
function createFallbackBlurredPng(): Buffer {
  const width = 32;
  const height = 32;
  const rows = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 4);
    rows[rowStart] = 0; // PNG filter: none
    for (let x = 0; x < width; x++) {
      const px = rowStart + 1 + x * 4;
      const shade = Math.round(168 + ((x + y) / (width + height)) * 32);
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
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const compressed = zlib.deflateSync(rows);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * Heavily downsample + double-blur image on the server for unreleased product previews.
 * Original high-resolution pixels never leave the server.
 */
async function createBlurredPreviewBuffer(imageBuffer: Buffer): Promise<{ buffer: Buffer; contentType: string }> {
  try {
    const sharpMod = await import('sharp').catch(() => null);
    const sharpFn = sharpMod?.default;
    if (typeof sharpFn === 'function') {
      const tiny = await sharpFn(imageBuffer)
        .rotate()
        .resize(48, 48, { fit: 'inside', withoutEnlargement: true })
        .blur(8)
        .toBuffer();
      const blurred = await sharpFn(tiny)
        .resize(240, 240, { fit: 'inside' })
        .blur(10)
        .webp({ quality: 52 })
        .toBuffer();
      return { buffer: blurred, contentType: 'image/webp' };
    }
  } catch (err) {
    console.warn('[Image Proxy] Server blur fallback triggered:', err instanceof Error ? err.message : err);
  }
  return { buffer: createFallbackBlurredPng(), contentType: 'image/png' };
}

/**
 * Check if image exists in cache
 */
async function getFromCache(cacheKey: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  if (!bucket) return null;

  try {
    const response = await s3Client.send(new GetObjectCommand({
      Bucket: bucket,
      Key: cacheKey,
    }));

    if (!response.Body) return null;

    const chunks: Buffer[] = [];
    for await (const chunk of response.Body as Readable) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    return {
      buffer: Buffer.concat(chunks),
      contentType: response.ContentType || 'image/jpeg',
    };
  } catch (error: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ {
    if (error?.$metadata?.httpStatusCode === 404) return null;
    return null;
  }
}

/**
 * Save image to cache for permanent storage
 */
async function saveToCache(cacheKey: string, buffer: Buffer, contentType: string): Promise<void> {
  if (!bucket) return;

  try {
    await s3Client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: cacheKey,
      Body: buffer,
      ContentType: contentType,
      // Cache metadata
      Metadata: {
        'cached-at': new Date().toISOString(),
        'original-size': buffer.length.toString(),
      },
    }));
  } catch (error) {
    console.error('[Image Cache] Failed to save:', error);
  }
}

// ==================== ACCESS CONTROL ====================

/**
 * Known origins that are allowed to load images.
 * Checked against Referer header and Sec-Fetch-Site.
 */
const ALLOWED_ORIGINS = [
  'psuscc',
  'sccshop',
  'localhost',
  '127.0.0.1',
  'vercel.app',
  'railway.app',
  'github.dev',
  'gitpod.io',
  'codespaces',
];

/**
 * Validate that the request comes from within the app (not direct URL access).
 *
 * Uses the browser-standard Sec-Fetch-* headers:
 *  - Sec-Fetch-Dest: "image" → loaded via <img>/<picture>/CSS
 *  - Sec-Fetch-Dest: "document" → user pasted URL in address bar
 *  - Sec-Fetch-Site: "same-origin" / "same-site"
 *  - Sec-Fetch-Site: "none" → address-bar navigation
 *
 * Falls back to Referer check for browsers that don't send Sec-Fetch.
 */
function isAllowedImageRequest(req: NextRequest): boolean {
  const secFetchDest = req.headers.get('sec-fetch-dest');
  const secFetchSite = req.headers.get('sec-fetch-site');
  const referer = req.headers.get('referer');
  const host = req.headers.get('host') || '';

  if (secFetchDest) {
    if (secFetchDest === 'image') return true;
    if (secFetchDest === 'video' || secFetchDest === 'audio') return true;
    return false;
  }

  if (secFetchSite) {
    if (secFetchSite === 'same-origin' || secFetchSite === 'same-site') return true;
    return false;
  }

  if (referer) {
    try {
      const refUrl = new URL(referer);
      if (refUrl.host === host) return true;
      if (ALLOWED_ORIGINS.some(o => refUrl.host.includes(o))) return true;
    } catch {
      // invalid referer
    }
    return false;
  }

  return false;
}

/**
 * Return an "Access Denied" JSON when someone directly navigates to the URL.
 */
async function accessDeniedResponse(): Promise<NextResponse> {
  return await secureJsonResponse(
    {
      error: 'Access Denied',
      message: 'ไม่สามารถเข้าถึงรูปภาพโดยตรงได้ กรุณาเข้าผ่านหน้าเว็บไซต์เท่านั้น',
      hint: 'Images can only be viewed within the application.',
    },
    {
      status: 403,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    }
  );
}

// ==================== ALLOWED DOMAINS ====================

const ALLOWED_DOMAINS = [
  'ipfs.filebase.io',
  's3.filebase.com',
  'lh3.googleusercontent.com',
  'ui-avatars.com',
  'supabase.co',
  'supabase.com',
  'supabase.net',
  'cloudflare.com',
  'cdn.jsdelivr.net',
  'localhost',
  '127.0.0.1',
];

function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const isAllowed = ALLOWED_DOMAINS.some(domain =>
      parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)
    );
    if (!isAllowed) {
      console.warn('[Image Proxy] Blocked domain:', parsed.hostname);
      return false;
    }
    return true;
  } catch {
    console.warn('[Image Proxy] Invalid URL:', url);
    return false;
  }
}

// ==================== HEAD REQUEST FOR FASTER CHECKS ====================

export async function HEAD(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return new NextResponse(null, { status: 400 });
    }

    if (!isAllowedImageRequest(req)) {
      return new NextResponse(null, { status: 403 });
    }

    const resolved = resolveImageToken(id);
    if (!resolved || !isAllowedUrl(resolved.url)) {
      return new NextResponse(null, { status: 400 });
    }

    const isBlurredPreview = resolved.previewMode === 'blur';
    const cacheKey = isBlurredPreview ? getBlurredCacheKey(resolved.url) : getCacheKey(resolved.url);
    const cached = await getFromCache(cacheKey);

    return new NextResponse(null, {
      status: 200,
      headers: {
        'Content-Type': cached?.contentType || (isBlurredPreview ? 'image/webp' : 'image/jpeg'),
        'Cache-Control': isBlurredPreview ? 'public, max-age=3600' : 'public, max-age=31536000, immutable',
        'X-Cache': cached ? 'HIT' : 'MISS',
      },
    });
  } catch {
    return new NextResponse(null, { status: 500 });
  }
}

// ==================== IMAGE PROXY ROUTE ====================

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return await secureJsonResponse({ error: 'Missing image ID' }, { status: 400 });
    }

    // Block direct URL access — only allow <img> loads from the app
    if (!isAllowedImageRequest(req)) {
      return accessDeniedResponse();
    }

    // Decrypt token & inspect whether this is a locked blur-only preview token
    const resolved = resolveImageToken(id);

    if (!resolved) {
      console.warn('[Image Proxy] Could not decrypt image token, returning placeholder');
      const transparentPng = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
        'base64'
      );
      return new NextResponse(transparentPng, {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'X-Image-Status': 'placeholder',
        },
      });
    }

    const imageUrl = resolved.url;
    const isBlurredPreview = resolved.previewMode === 'blur';

    // Validate URL is from allowed domains
    if (!isAllowedUrl(imageUrl)) {
      console.warn('[Image Proxy] Blocked URL:', imageUrl);
      return await secureJsonResponse({ error: 'URL not allowed' }, { status: 403 });
    }

    const realCacheKey = getCacheKey(imageUrl);
    const blurCacheKey = getBlurredCacheKey(imageUrl);

    if (isBlurredPreview) {
      const cachedBlurred = await getFromCache(blurCacheKey);
      if (cachedBlurred) {
        return new NextResponse(new Uint8Array(cachedBlurred.buffer), {
          status: 200,
          headers: {
            'Content-Type': cachedBlurred.contentType,
            'Cache-Control': 'public, max-age=3600, s-maxage=3600',
            'CDN-Cache-Control': 'public, max-age=3600',
            'X-Content-Type-Options': 'nosniff',
            'X-Image-Preview': 'blur',
            'X-Cache': 'HIT',
            'Vary': 'Accept, Sec-Fetch-Dest',
          },
        });
      }

      // Fetch clear bytes only on the server; never send unblurred pixels over the wire
      let sourceBuffer: Buffer | null = null;
      const cachedOriginal = await getFromCache(realCacheKey);
      if (cachedOriginal) {
        sourceBuffer = cachedOriginal.buffer;
      } else {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        try {
          const response = await fetch(imageUrl, {
            signal: controller.signal,
            headers: {
              'Accept': 'image/*',
              'User-Agent': 'PSUSCCSHOP-ImageProxy/2.0',
            },
          });
          if (response.ok) {
            const ct = response.headers.get('content-type') || 'image/jpeg';
            if (ct.startsWith('image/')) {
              sourceBuffer = Buffer.from(await response.arrayBuffer());
              saveToCache(realCacheKey, sourceBuffer, ct).catch(() => {});
            }
          }
        } finally {
          clearTimeout(timeoutId);
        }
      }

      const blurredResult = sourceBuffer
        ? await createBlurredPreviewBuffer(sourceBuffer)
        : { buffer: createFallbackBlurredPng(), contentType: 'image/png' };

      saveToCache(blurCacheKey, blurredResult.buffer, blurredResult.contentType).catch(() => {});

      return new NextResponse(new Uint8Array(blurredResult.buffer), {
        status: 200,
        headers: {
          'Content-Type': blurredResult.contentType,
          'Cache-Control': 'public, max-age=3600, s-maxage=3600',
          'CDN-Cache-Control': 'public, max-age=3600',
          'X-Content-Type-Options': 'nosniff',
          'X-Image-Preview': 'blur',
          'X-Cache': 'MISS',
          'Vary': 'Accept, Sec-Fetch-Dest',
        },
      });
    }

    // Check cache first for normal open-product images
    const cached = await getFromCache(realCacheKey);
    if (cached) {
      return new NextResponse(new Uint8Array(cached.buffer), {
        status: 200,
        headers: {
          'Content-Type': cached.contentType,
          'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, stale-while-revalidate=86400, immutable',
          'CDN-Cache-Control': 'public, max-age=31536000',
          'Vercel-CDN-Cache-Control': 'public, max-age=31536000',
          'X-Content-Type-Options': 'nosniff',
          'X-Cache': 'HIT',
          'Vary': 'Accept, Sec-Fetch-Dest',
        },
      });
    }

    // Fetch the image from origin
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(imageUrl, {
      signal: controller.signal,
      headers: {
        'Accept': 'image/*',
        'User-Agent': 'PSUSCCSHOP-ImageProxy/2.0',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return await secureJsonResponse(
        { error: 'Failed to fetch image' },
        { status: response.status }
      );
    }

    // Validate content type
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    if (!contentType.startsWith('image/')) {
      return await secureJsonResponse({ error: 'Invalid content type' }, { status: 400 });
    }

    const arrayBuffer = await response.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);

    saveToCache(realCacheKey, imageBuffer, contentType).catch(() => {});

    return new NextResponse(new Uint8Array(imageBuffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, stale-while-revalidate=86400, immutable',
        'CDN-Cache-Control': 'public, max-age=31536000',
        'Vercel-CDN-Cache-Control': 'public, max-age=31536000',
        'X-Content-Type-Options': 'nosniff',
        'X-Cache': 'MISS',
        'Vary': 'Accept, Sec-Fetch-Dest',
      },
    });
  } catch (error: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ {
    console.error('[Image Proxy] Error:', error?.message || error);

    if (error?.name === 'AbortError') {
      return await secureJsonResponse({ error: 'Request timeout' }, { status: 504 });
    }

    return await secureJsonResponse(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
