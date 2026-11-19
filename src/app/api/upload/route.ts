/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { checkCombinedRateLimitAsync, RATE_LIMITS, getRateLimitHeaders } from '@/lib/rate-limit';
import { putJson, uploadImageToStorage } from '@/lib/supabase';
import { uploadBlurredVariantToStorage } from '@/lib/server-image-blur';
import { validateImageBuffer, isAllowedPassThroughImageUrl } from '@/lib/upload-validation';
import { secureJsonRequest, secureJsonResponse } from '@/lib/payload-crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const _userLogKey = (id: string) => `user-logs/${id}.json`;
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

const extFromContentType = (contentType: string) => {
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg';
  if (contentType.includes('gif')) return 'gif';
  if (contentType.includes('webp')) return 'webp';
  return 'png';
};

const generateFileName = (contentType: string) => {
  const ext = extFromContentType(contentType);
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `img_${timestamp}_${random}.${ext}`;
};

export async function POST(req: NextRequest) {
  const rateLimitResult = await checkCombinedRateLimitAsync(req, RATE_LIMITS.upload);
  if (!rateLimitResult.allowed) {
    return await secureJsonResponse(
      { status: 'error', message: 'คุณอัปโหลดไฟล์เร็วเกินไป กรุณารอสักครู่' },
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          ...getRateLimitHeaders(rateLimitResult),
        },
      }
    );
  }

  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const body = await secureJsonRequest(req);
    const { base64, filename, mime, generateBlur } = body;

    if (!base64) {
      return await secureJsonResponse({ status: 'error', message: 'Missing base64 data' }, { status: 400 });
    }

    const allowedMimes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
    const contentTypeHint = mime || 'image/png';
    if (!allowedMimes.includes(contentTypeHint)) {
      return await secureJsonResponse({ status: 'error', message: 'Invalid file type. Only images allowed.' }, { status: 400 });
    }

    const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
    if (!/^[A-Za-z0-9+/=]+$/.test(base64Data)) {
      return await secureJsonResponse({ status: 'error', message: 'Invalid base64 data' }, { status: 400 });
    }

    const buffer = Buffer.from(base64Data, 'base64');

    const MAX_SIZE = 5 * 1024 * 1024;
    if (buffer.length > MAX_SIZE) {
      return await secureJsonResponse({ status: 'error', message: 'File too large (max 5MB)' }, { status: 413 });
    }

    const validated = validateImageBuffer(buffer, mime);
    if (!validated.ok) {
      return await secureJsonResponse({ status: 'error', message: validated.message }, { status: 400 });
    }
    const contentType = validated.contentType;

    const fileName = generateFileName(contentType);

    // Upload real image (+ optional server-generated blurred image) to Supabase Storage
    const [{ url, path }, blurredUpload] = await Promise.all([
      uploadImageToStorage(buffer, fileName, contentType),
      generateBlur
        ? uploadBlurredVariantToStorage(buffer, fileName).catch((blurErr) => {
            console.warn('[upload] Blurred preview upload failed (will retry on save):', blurErr);
            return null;
          })
        : Promise.resolve(null),
    ]);

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
        ...(blurredUpload ? { blurredPath: blurredUpload.path } : {}),
      },
      ip: clientIP,
      userAgent,
    });

    return await secureJsonResponse({
      status: 'success',
      data: {
        url,
        path,
        ...(blurredUpload ? { blurredUrl: blurredUpload.url, blurredPath: blurredUpload.path } : {}),
        size: buffer.length,
      },
    });
  } catch (error: any) {
    console.error('[upload] error', error);
    const raw = String(error?.message || 'Upload failed');
    const friendly =
      /not configured|SERVICE_ROLE|project mismatch|signature verification|Bucket not found|row-level security|JWT/i.test(
        raw,
      )
        ? 'อัปโหลดไม่สำเร็จ: ที่เก็บรูปตั้งค่าไม่ตรงโปรเจกต์ (SERVICE_ROLE_KEY) กรุณาติดต่อแอดมิน'
        : 'อัปโหลดไม่สำเร็จ กรุณาลองใหม่';
    return await secureJsonResponse({
      status: 'error',
      message: process.env.NODE_ENV === 'production' ? friendly : raw,
    }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const rateLimitResult = await checkCombinedRateLimitAsync(req, RATE_LIMITS.upload);
  if (!rateLimitResult.allowed) {
    return await secureJsonResponse(
      { status: 'error', message: 'คุณอัปโหลดไฟล์เร็วเกินไป กรุณารอสักครู่' },
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          ...getRateLimitHeaders(rateLimitResult),
        },
      }
    );
  }

  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const body = await secureJsonRequest(req);
    const { images } = body;

    if (!Array.isArray(images) || images.length === 0) {
      return await secureJsonResponse({ status: 'error', message: 'No images provided' }, { status: 400 });
    }

    const MAX_SIZE = 5 * 1024 * 1024;
    const results: { url: string; path: string; blurredUrl?: string; blurredPath?: string; originalIndex: number }[] = [];
    const errors: { index: number; message: string }[] = [];

    for (let i = 0; i < images.length; i++) {
      const { base64, mime, generateBlur: itemGenerateBlur } = images[i];
      const shouldGenerateBlur = Boolean(itemGenerateBlur ?? body.generateBlur);

      if (typeof base64 === 'string' && isAllowedPassThroughImageUrl(base64)) {
        results.push({ url: base64, path: '', originalIndex: i });
        continue;
      }

      if (typeof base64 === 'string' && (base64.startsWith('http://') || base64.startsWith('https://'))) {
        errors.push({ index: i, message: 'External URLs are not allowed' });
        continue;
      }

      if (!base64) {
        errors.push({ index: i, message: 'Missing base64 data' });
        continue;
      }

      try {
        const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
        if (!/^[A-Za-z0-9+/=]+$/.test(base64Data)) {
          errors.push({ index: i, message: 'Invalid base64 data' });
          continue;
        }

        const buffer = Buffer.from(base64Data, 'base64');

        if (buffer.length > MAX_SIZE) {
          errors.push({ index: i, message: 'File too large' });
          continue;
        }

        const validated = validateImageBuffer(buffer, mime);
        if (!validated.ok) {
          errors.push({ index: i, message: validated.message });
          continue;
        }

        const contentType = validated.contentType;
        const fileName = generateFileName(contentType);

        const [{ url, path }, blurredUpload] = await Promise.all([
          uploadImageToStorage(buffer, fileName, contentType),
          shouldGenerateBlur
            ? uploadBlurredVariantToStorage(buffer, fileName).catch(() => null)
            : Promise.resolve(null),
        ]);
        results.push({
          url,
          path,
          ...(blurredUpload ? { blurredUrl: blurredUpload.url, blurredPath: blurredUpload.path } : {}),
          originalIndex: i,
        });
      } catch (err: any) {
        errors.push({ index: i, message: err?.message || 'Upload failed' });
      }
    }

    return await secureJsonResponse({
      status: 'success',
      data: { uploaded: results, errors },
    });
  } catch (error: any) {
    console.error('[upload-batch] error', error);
    return await secureJsonResponse({
      status: 'error',
      message: error?.message || 'Batch upload failed',
    }, { status: 500 });
  }
}
