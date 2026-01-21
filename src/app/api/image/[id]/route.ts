import { NextRequest, NextResponse } from 'next/server';
import { smartDecryptUrl, encryptImageUrl } from '@/lib/image-crypto';
import { S3Client, GetObjectCommand, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import crypto from 'crypto';

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
  } catch (error: any) {
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

// Re-export encodeImageUrl for backward compatibility
export { encryptImageUrl as encodeImageUrl };

// ==================== ALLOWED DOMAINS ====================

/**
 * Whitelist of allowed image domains
 */
const ALLOWED_DOMAINS = [
  'ipfs.filebase.io',
  's3.filebase.com',
  'lh3.googleusercontent.com',
  'ui-avatars.com',
];

function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_DOMAINS.some(domain => 
      parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)
    );
  } catch {
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

    const imageUrl = smartDecryptUrl(id);
    if (!imageUrl || !isAllowedUrl(imageUrl)) {
      return new NextResponse(null, { status: 400 });
    }

    const cacheKey = getCacheKey(imageUrl);
    const cached = await getFromCache(cacheKey);
    
    return new NextResponse(null, {
      status: 200,
      headers: {
        'Content-Type': cached?.contentType || 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
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
      return NextResponse.json({ error: 'Missing image ID' }, { status: 400 });
    }

    // ⚠️ SECURITY: Basic referer check - must come from our site
    const referer = req.headers.get('referer');
    const host = req.headers.get('host');
    
    // Allow requests from same origin or no referer (direct image loading)
    // Block requests from other domains trying to hotlink
    if (referer) {
      try {
        const refererUrl = new URL(referer);
        const allowedHosts = [
          host,
          'localhost',
          '127.0.0.1',
          process.env.NEXTAUTH_URL ? new URL(process.env.NEXTAUTH_URL).host : null,
        ].filter(Boolean) as string[];
        
        // Also allow GitHub Codespaces and common dev environments
        const isDevEnvironment = 
          refererUrl.host.includes('github.dev') ||
          refererUrl.host.includes('gitpod.io') ||
          refererUrl.host.includes('codespaces') ||
          refererUrl.host.includes('vercel.app') ||
          refererUrl.host.includes('localhost') ||
          refererUrl.host.includes('127.0.0.1');
        
        const isAllowedHost = allowedHosts.some(h => 
          refererUrl.host === h || refererUrl.host.endsWith(`.${h}`)
        );
        
        if (!isAllowedHost && !isDevEnvironment) {
          console.warn('[Image Proxy] Blocked hotlink from:', referer);
          return new NextResponse(null, { status: 403 });
        }
      } catch {
        // Invalid referer URL, allow it (might be direct load)
      }
    }

    // Decrypt the image URL using smart decryption (AES or legacy XOR)
    const imageUrl = smartDecryptUrl(id);
    
    if (!imageUrl) {
      return NextResponse.json({ error: 'Invalid image ID' }, { status: 400 });
    }

    // Validate URL is from allowed domains
    if (!isAllowedUrl(imageUrl)) {
      console.warn('[Image Proxy] Blocked URL:', imageUrl);
      return NextResponse.json({ error: 'URL not allowed' }, { status: 403 });
    }

    // Generate cache key
    const cacheKey = getCacheKey(imageUrl);
    
    // ✅ Check cache first - permanent storage
    const cached = await getFromCache(cacheKey);
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
          'Vary': 'Accept',
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
      return NextResponse.json(
        { error: 'Failed to fetch image' }, 
        { status: response.status }
      );
    }

    // Validate content type
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    if (!contentType.startsWith('image/')) {
      return NextResponse.json({ error: 'Invalid content type' }, { status: 400 });
    }

    // Get image data
    const imageBuffer = Buffer.from(await response.arrayBuffer());

    // ✅ Save to cache for permanent storage (async, don't wait)
    saveToCache(cacheKey, imageBuffer, contentType).catch(() => {});

    // Return image with long cache headers
    return new NextResponse(new Uint8Array(imageBuffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': imageBuffer.length.toString(),
        'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, stale-while-revalidate=86400, immutable',
        'CDN-Cache-Control': 'public, max-age=31536000',
        'Vercel-CDN-Cache-Control': 'public, max-age=31536000',
        'X-Content-Type-Options': 'nosniff',
        'X-Cache': 'MISS',
        'Vary': 'Accept',
      },
    });

  } catch (error: any) {
    console.error('[Image Proxy] Error:', error?.message || error);
    
    if (error?.name === 'AbortError') {
      return NextResponse.json({ error: 'Request timeout' }, { status: 504 });
    }
    
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}
