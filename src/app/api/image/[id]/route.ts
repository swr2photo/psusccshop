import { NextRequest, NextResponse } from 'next/server';

// Ensure Node runtime for fetch
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ==================== IMAGE URL ENCODING ====================

/**
 * Secret key for encoding/decoding URLs
 * ใช้ XOR encryption อย่างง่ายเพื่อซ่อน URL จริง
 */
const SECRET_KEY = process.env.IMAGE_PROXY_SECRET || 'psusccshop-image-proxy-2026';

/**
 * Encode URL to safe base64 ID
 */
export function encodeImageUrl(url: string): string {
  if (!url) return '';
  
  // XOR with secret key
  const encoded = Buffer.from(url).map((byte, i) => 
    byte ^ SECRET_KEY.charCodeAt(i % SECRET_KEY.length)
  );
  
  // Convert to URL-safe base64
  return Buffer.from(encoded)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Decode base64 ID back to URL
 */
function decodeImageUrl(id: string): string | null {
  if (!id) return null;
  
  try {
    // Restore base64 padding
    let base64 = id.replace(/-/g, '+').replace(/_/g, '/');
    const padding = (4 - (base64.length % 4)) % 4;
    base64 += '='.repeat(padding);
    
    // Decode and XOR with secret key
    const decoded = Buffer.from(base64, 'base64').map((byte, i) => 
      byte ^ SECRET_KEY.charCodeAt(i % SECRET_KEY.length)
    );
    
    return Buffer.from(decoded).toString('utf-8');
  } catch {
    return null;
  }
}

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

    // Decode the image URL
    const imageUrl = decodeImageUrl(id);
    
    if (!imageUrl) {
      return NextResponse.json({ error: 'Invalid image ID' }, { status: 400 });
    }

    // Validate URL is from allowed domains
    if (!isAllowedUrl(imageUrl)) {
      console.warn('[Image Proxy] Blocked URL:', imageUrl);
      return NextResponse.json({ error: 'URL not allowed' }, { status: 403 });
    }

    // Fetch the image
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(imageUrl, {
      signal: controller.signal,
      headers: {
        'Accept': 'image/*',
        'User-Agent': 'PSUSCCSHOP-ImageProxy/1.0',
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
    const imageBuffer = await response.arrayBuffer();

    // Return image with cache headers
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, s-maxage=604800', // 1 day client, 7 days CDN
        'X-Content-Type-Options': 'nosniff',
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
