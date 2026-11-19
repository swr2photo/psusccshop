import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { checkCombinedRateLimitAsync, RATE_LIMITS, getRateLimitHeaders } from '@/lib/rate-limit';
import {
  ALLOWED_VIDEO_MIME_TYPES,
  MAX_VIDEO_UPLOAD_BYTES,
  createSignedVideoUpload,
  putJson,
} from '@/lib/supabase';
import { secureJsonRequest, secureJsonResponse } from '@/lib/payload-crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function normalizeVideoMime(mime?: string, filename?: string): string | null {
  const cleanMime = String(mime || '').split(';')[0].trim().toLowerCase();
  if ((ALLOWED_VIDEO_MIME_TYPES as readonly string[]).includes(cleanMime)) {
    return cleanMime;
  }
  const ext = String(filename || '').split('.').pop()?.trim().toLowerCase();
  if (ext === 'mp4' || ext === 'm4v') return 'video/mp4';
  if (ext === 'webm') return 'video/webm';
  if (ext === 'mov') return 'video/quicktime';
  return null;
}

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
      },
    );
  }

  const adminResult = await requireAdmin(req);
  if (adminResult instanceof NextResponse) {
    return adminResult;
  }

  try {
    const body = (await secureJsonRequest(req)) as {
      filename?: string;
      mime?: string;
      size?: number;
      folder?: string;
    };

    const filename = String(body?.filename || 'banner.mp4').slice(0, 200);
    const contentType = normalizeVideoMime(body?.mime, filename);
    if (!contentType) {
      return await secureJsonResponse(
        { status: 'error', message: 'รองรับเฉพาะไฟล์วิดีโอ MP4, WEBM หรือ MOV' },
        { status: 400 },
      );
    }

    const size = Number(body?.size || 0);
    if (!Number.isFinite(size) || size <= 0) {
      return await secureJsonResponse(
        { status: 'error', message: 'ไม่พบขนาดไฟล์วิดีโอ' },
        { status: 400 },
      );
    }
    if (size > MAX_VIDEO_UPLOAD_BYTES) {
      return await secureJsonResponse(
        { status: 'error', message: 'ไฟล์วิดีโอใหญ่เกิน 50MB' },
        { status: 413 },
      );
    }

    const allowedFolders = new Set(['form-banners', 'banners']);
    const folder = typeof body?.folder === 'string' && allowedFolders.has(body.folder)
      ? body.folder
      : 'form-banners';

    const signed = await createSignedVideoUpload(filename, contentType, folder);

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      req.headers.get('x-real-ip') || undefined;
    await putJson(`user-logs/${id}.json`, {
      id,
      email: adminResult.email,
      action: 'upload_video',
      details: `สร้างลิงก์อัปโหลดวิดีโอ (${(size / (1024 * 1024)).toFixed(2)} MB)`,
      metadata: {
        filename,
        size,
        contentType,
        path: signed.path,
      },
      ip: clientIP,
      userAgent: req.headers.get('user-agent') || undefined,
      timestamp: new Date().toISOString(),
    }).catch((logErr) => {
      console.error('[upload/video] Failed to save user log:', logErr);
    });

    return await secureJsonResponse({
      status: 'success',
      data: {
        signedUrl: signed.signedUrl,
        token: signed.token,
        path: signed.path,
        publicUrl: signed.publicUrl,
        contentType,
        maxBytes: MAX_VIDEO_UPLOAD_BYTES,
      },
    });
  } catch (error: unknown) {
    console.error('[upload/video] error', error);
    const raw = error instanceof Error ? error.message : 'Upload failed';
    const friendly =
      /not configured|SERVICE_ROLE|project mismatch|signature verification|Bucket not found|row-level security|JWT/i.test(raw)
        ? 'อัปโหลดวิดีโอไม่สำเร็จ: ที่เก็บไฟล์ตั้งค่าไม่ตรงโปรเจกต์ กรุณาติดต่อผู้ดูแลระบบ'
        : 'สร้างลิงก์อัปโหลดวิดีโอไม่สำเร็จ กรุณาลองใหม่';
    return await secureJsonResponse(
      {
        status: 'error',
        message: process.env.NODE_ENV === 'production' ? friendly : raw,
      },
      { status: 500 },
    );
  }
}
