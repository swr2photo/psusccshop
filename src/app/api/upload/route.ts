import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { checkCombinedRateLimit, RATE_LIMITS, getRateLimitHeaders } from '@/lib/rate-limit';
import { putJson, uploadImageToStorage, isSupabaseStorageUrl } from '@/lib/supabase';

// Helper to save user log server-side
const userLogKey = (id: string) => `user-logs/${id}.json`;
interface LogEntry {
  id: string;
  email: string;
  name?: string;
  action: string;
  details?: string;
  metadata?: Record<string, any>;
  ip?: string;
  userAgent?: string;
  timestamp: string;
}
const saveUserLogServer = async (params: {
  email: string;
  name?: string;
  action: string;
  details?: string;
  metadata?: Record<string, any>;
  ip?: string;
  userAgent?: string;
}) => {
  try {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const entry: LogEntry = {
      id,
      email: params.email,
      name: params.name,
      action: params.action,
      details: params.details,
      metadata: params.metadata,
      ip: params.ip,
      userAgent: params.userAgent,
      timestamp: new Date().toISOString(),
    };
    await putJson(`user-logs/${id}.json`, entry);
  } catch (e) {
    console.error('[Upload] Failed to save user log:', e);
  }
};

// Generate unique filename
const generateFileName = (originalName: string) => {
  const ext = originalName.split('.').pop()?.toLowerCase() || 'png';
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `img_${timestamp}_${random}.${ext}`;
};

export async function POST(req: NextRequest) {
  // Rate limiting สำหรับ upload
  const rateLimitResult = checkCombinedRateLimit(req, RATE_LIMITS.upload);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { status: 'error', message: 'คุณอัปโหลดไฟล์เร็วเกินไป กรุณารอสักครู่' },
      { 
        status: 429, 
        headers: { 
          'Content-Type': 'application/json; charset=utf-8',
          ...getRateLimitHeaders(rateLimitResult),
        } 
      }
    );
  }

  // ต้องเข้าสู่ระบบก่อนถึงจะ upload ได้
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const body = await req.json();
    const { base64, filename, mime } = body;

    if (!base64) {
      return NextResponse.json({ status: 'error', message: 'Missing base64 data' }, { status: 400 });
    }

    // Validate mime type - only allow images
    const allowedMimes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
    const contentType = mime || 'image/png';
    if (!allowedMimes.includes(contentType)) {
      return NextResponse.json({ status: 'error', message: 'Invalid file type. Only images allowed.' }, { status: 400 });
    }

    // Extract base64 data (remove data:image/xxx;base64, prefix if present)
    const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
    
    // Validate base64 format
    if (!/^[A-Za-z0-9+/=]+$/.test(base64Data)) {
      return NextResponse.json({ status: 'error', message: 'Invalid base64 data' }, { status: 400 });
    }

    const buffer = Buffer.from(base64Data, 'base64');

    // Check file size (max 5MB)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (buffer.length > MAX_SIZE) {
      return NextResponse.json({ status: 'error', message: 'File too large (max 5MB)' }, { status: 413 });
    }

    // Validate file magic bytes for image types
    const magicBytes = buffer.slice(0, 8);
    const isPng = magicBytes[0] === 0x89 && magicBytes[1] === 0x50 && magicBytes[2] === 0x4E && magicBytes[3] === 0x47;
    const isJpeg = magicBytes[0] === 0xFF && magicBytes[1] === 0xD8;
    const isGif = magicBytes[0] === 0x47 && magicBytes[1] === 0x49 && magicBytes[2] === 0x46;
    const isWebp = magicBytes[0] === 0x52 && magicBytes[1] === 0x49 && magicBytes[2] === 0x46 && magicBytes[3] === 0x46;
    
    if (!isPng && !isJpeg && !isGif && !isWebp) {
      return NextResponse.json({ status: 'error', message: 'Invalid image file' }, { status: 400 });
    }

    // Generate filename and upload to Supabase Storage
    const fileName = generateFileName(filename || 'image.png');
    
    // Upload to Supabase Storage (returns permanent public URL)
    const { url, path } = await uploadImageToStorage(buffer, fileName, contentType);

    // Log upload action
    const userAgent = req.headers.get('user-agent') || undefined;
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 
                     req.headers.get('x-real-ip') || undefined;
    await saveUserLogServer({
      email: authResult.email,
      name: undefined,
      action: 'upload_image',
      details: `อัปโหลดรูปภาพ (${(buffer.length / 1024).toFixed(1)} KB)`,
      metadata: {
        filename: filename || 'image.png',
        size: buffer.length,
        contentType,
        path,
      },
      ip: clientIP,
      userAgent,
    });

    // Return public URL directly (no encryption needed, permanent URL)
    return NextResponse.json({
      status: 'success',
      data: { url, path, size: buffer.length },
    });
  } catch (error: any) {
    console.error('[upload] error', error);
    return NextResponse.json({
      status: 'error',
      message: error?.message || 'Upload failed',
    }, { status: 500 });
  }
}

// Handle multiple images upload
export async function PUT(req: NextRequest) {
  // ต้องเข้าสู่ระบบก่อนถึงจะ upload ได้
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const body = await req.json();
    const { images } = body; // Array of { base64, filename, mime }

    if (!Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ status: 'error', message: 'No images provided' }, { status: 400 });
    }

    const MAX_SIZE = 5 * 1024 * 1024;
    const results: { url: string; path: string; originalIndex: number }[] = [];
    const errors: { index: number; message: string }[] = [];

    for (let i = 0; i < images.length; i++) {
      const { base64, filename, mime } = images[i];
      
      // Skip if already a Supabase Storage URL or other permanent URL
      if (typeof base64 === 'string' && isSupabaseStorageUrl(base64)) {
        results.push({ url: base64, path: '', originalIndex: i });
        continue;
      }
      
      // Skip if already a URL (not base64) - keep as-is
      if (typeof base64 === 'string' && (base64.startsWith('http://') || base64.startsWith('https://'))) {
        results.push({ url: base64, path: '', originalIndex: i });
        continue;
      }
      
      // Skip if it's an encrypted proxy URL
      if (typeof base64 === 'string' && base64.startsWith('/api/image/')) {
        results.push({ url: base64, path: '', originalIndex: i });
        continue;
      }

      if (!base64) {
        errors.push({ index: i, message: 'Missing base64 data' });
        continue;
      }

      try {
        const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
        const buffer = Buffer.from(base64Data, 'base64');

        if (buffer.length > MAX_SIZE) {
          errors.push({ index: i, message: 'File too large' });
          continue;
        }

        const fileName = generateFileName(filename || 'image.png');
        const contentType = mime || 'image/png';

        // Upload to Supabase Storage
        const { url, path } = await uploadImageToStorage(buffer, fileName, contentType);
        results.push({ url, path, originalIndex: i });
      } catch (err: any) {
        errors.push({ index: i, message: err?.message || 'Upload failed' });
      }
    }

    return NextResponse.json({
      status: 'success',
      data: { uploaded: results, errors },
    });
  } catch (error: any) {
    console.error('[upload-batch] error', error);
    return NextResponse.json({
      status: 'error',
      message: error?.message || 'Batch upload failed',
    }, { status: 500 });
  }
}
