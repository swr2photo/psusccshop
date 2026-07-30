import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { checkCombinedRateLimitAsync, RATE_LIMITS, getRateLimitHeaders } from '@/lib/rate-limit';
import { detectAudioContentType } from '@/lib/chat-voice';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { secureJsonRequest, secureJsonResponse } from '@/lib/payload-crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_HINTS = [
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
  'audio/aac',
  'audio/x-m4a',
  'video/webm',
];

const MAX_SIZE = 5 * 1024 * 1024;
const MAX_DURATION_SEC = 120;

const endpoint = process.env.FILEBASE_ENDPOINT || 'https://s3.filebase.com';
const region = process.env.FILEBASE_REGION || 'us-east-1';
const bucket = process.env.FILEBASE_BUCKET;
const accessKeyId = process.env.FILEBASE_ACCESS_KEY;
const secretAccessKey = process.env.FILEBASE_SECRET_KEY;

const s3Client =
  bucket && accessKeyId && secretAccessKey
    ? new S3Client({
        region,
        endpoint,
        credentials: { accessKeyId, secretAccessKey },
      })
    : null;

function extFromContentType(contentType: string, hint: string): string {
  const t = `${contentType} ${hint}`.toLowerCase();
  if (t.includes('ogg')) return 'ogg';
  if (t.includes('mp4') || t.includes('m4a') || t.includes('aac')) return 'm4a';
  if (t.includes('mpeg') || t.includes('mp3')) return 'mp3';
  if (t.includes('wav')) return 'wav';
  return 'webm';
}

async function uploadVoiceToFilebase(
  buffer: Buffer,
  fileName: string,
  contentType: string
): Promise<{ url: string; path: string }> {
  if (!s3Client || !bucket) {
    throw new Error('FILEBASE not configured for voice uploads');
  }

  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const path = `chat-voice/${yearMonth}/${fileName}`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: path,
      Body: buffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    })
  );

    // Prefer IPFS gateway when Filebase attaches a CID
  try {
    const head = await s3Client.send(
      new HeadObjectCommand({ Bucket: bucket, Key: path })
    );
    const cid = head.Metadata?.cid || head.Metadata?.Cid;
    if (cid) {
      return {
        url: `https://ipfs.filebase.io/ipfs/${cid}`,
        path,
      };
    }
  } catch {
    // fall through to app proxy URL
  }

  // Opaque token avoids `/` in the dynamic route segment
  const token = Buffer.from(path, 'utf8').toString('base64url');
  return {
    url: `/api/voice/${token}`,
    path,
  };
}

export async function POST(req: NextRequest) {
  const rateLimitResult = await checkCombinedRateLimitAsync(req, RATE_LIMITS.upload);
  if (!rateLimitResult.allowed) {
    return await secureJsonResponse(
      { status: 'error', message: 'คุณอัปโหลดไฟล์เร็วเกินไป กรุณาลองใหม่' },
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
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await secureJsonRequest(req);
    const { base64, mime, duration } = body as {
      base64?: string;
      mime?: string;
      duration?: number;
    };

    if (!base64 || typeof base64 !== 'string') {
      return await secureJsonResponse({ status: 'error', message: 'Missing audio data' }, { status: 400 });
    }

    const hint = (mime || 'audio/webm').split(';')[0].trim().toLowerCase();
    if (
      !ALLOWED_HINTS.includes(hint) &&
      !hint.startsWith('audio/') &&
      hint !== 'video/webm'
    ) {
      return await secureJsonResponse({ status: 'error', message: `Invalid audio type: ${hint}` }, { status: 400 });
    }

    if (typeof duration === 'number' && (duration < 0 || duration > MAX_DURATION_SEC)) {
      return await secureJsonResponse({ status: 'error', message: 'Invalid duration' }, { status: 400 });
    }

    const base64Data = (base64.includes(',') ? base64.split(',')[1] : base64).replace(/\s/g, '');
    if (!base64Data || base64Data.length < 32) {
      return await secureJsonResponse({ status: 'error', message: 'Invalid audio payload' }, { status: 400 });
    }

    let buffer: Buffer;
    try {
      buffer = Buffer.from(base64Data, 'base64');
    } catch {
      return await secureJsonResponse({ status: 'error', message: 'Invalid base64 data' }, { status: 400 });
    }

    if (buffer.length < 64) {
      return await secureJsonResponse({ status: 'error', message: 'Audio too short' }, { status: 400 });
    }
    if (buffer.length > MAX_SIZE) {
      return await secureJsonResponse({ status: 'error', message: 'File too large (max 5MB)' }, { status: 413 });
    }

    const detected = detectAudioContentType(buffer);
    const logicalType =
      detected ||
      (hint.startsWith('audio/') ? hint : hint === 'video/webm' ? 'audio/webm' : 'audio/webm');
    const ext = extFromContentType(logicalType, hint);
    const fileName = `voice_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const uploaded = await uploadVoiceToFilebase(buffer, fileName, logicalType);

    return await secureJsonResponse({
      status: 'success',
      data: {
        url: uploaded.url,
        path: uploaded.path,
        size: buffer.length,
        contentType: logicalType,
        duration: typeof duration === 'number' ? Math.max(1, Math.round(duration)) : null,
      },
    });
  } catch (error: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ {
    console.error('[upload-audio] error', error);
    return await secureJsonResponse(
      {
        status: 'error',
        message: process.env.NODE_ENV === 'production'
          ? 'อัปโหลดเสียงไม่สำเร็จ กรุณาลองใหม่'
          : String(error?.message || 'Upload failed'),
      },
      { status: 500 }
    );
  }
}
