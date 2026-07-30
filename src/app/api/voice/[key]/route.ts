import { NextRequest, NextResponse } from 'next/server';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

function isAllowedVoiceRequest(req: NextRequest): boolean {
  const dest = req.headers.get('sec-fetch-dest') || '';
  if (dest === 'audio' || dest === 'media' || dest === 'empty' || dest === '') return true;
  const site = req.headers.get('sec-fetch-site') || '';
  if (site === 'same-origin' || site === 'same-site') return true;
  const referer = req.headers.get('referer') || '';
  if (/localhost|127\.0\.0\.1|psuscc|sccshop|vercel\.app/i.test(referer)) return true;
  return false;
}

async function streamToBuffer(body: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function decodeVoiceKey(raw: string): string | null {
  try {
    const decoded = Buffer.from(raw, 'base64url').toString('utf8');
    if (!decoded.startsWith('chat-voice/')) return null;
    if (decoded.includes('..') || decoded.includes('\\')) return null;
    return decoded;
  } catch {
    return null;
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    if (!bucket || !accessKeyId || !secretAccessKey) {
      return NextResponse.json({ error: 'Voice storage not configured' }, { status: 503 });
    }
    if (!isAllowedVoiceRequest(req)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { key: rawKey } = await params;
    if (!rawKey) {
      return NextResponse.json({ error: 'Missing key' }, { status: 400 });
    }

    const key = decodeVoiceKey(rawKey);
    if (!key) {
      return NextResponse.json({ error: 'Invalid key' }, { status: 400 });
    }

    const response = await s3Client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );

    if (!response.Body) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const buffer = await streamToBuffer(response.Body as Readable);
    const contentType = response.ContentType || 'audio/webm';

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Accept-Ranges': 'bytes',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error: unknown) {
    const status = error?.$metadata?.httpStatusCode === 404 ? 404 : 500;
    console.error('[voice] GET error', error?.message || error);
    return NextResponse.json(
      { error: status === 404 ? 'Not found' : 'Failed to load voice' },
      { status }
    );
  }
}
