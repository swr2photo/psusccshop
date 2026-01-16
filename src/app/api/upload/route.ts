import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const endpoint = process.env.FILEBASE_ENDPOINT || 'https://s3.filebase.com';
const region = process.env.FILEBASE_REGION || 'us-east-1';
const bucket = process.env.FILEBASE_BUCKET;
const accessKeyId = process.env.FILEBASE_ACCESS_KEY;
const secretAccessKey = process.env.FILEBASE_SECRET_KEY;

const client = new S3Client({
  region,
  endpoint,
  credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
});

// Generate unique filename
const generateFileName = (originalName: string) => {
  const ext = originalName.split('.').pop()?.toLowerCase() || 'png';
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `img_${timestamp}_${random}.${ext}`;
};

// Get public URL for uploaded file
const getPublicUrl = (key: string) => {
  // Filebase public URL format
  return `https://${bucket}.s3.filebase.com/${key}`;
};

export async function POST(req: NextRequest) {
  try {
    if (!bucket) {
      return NextResponse.json({ status: 'error', message: 'Storage not configured' }, { status: 500 });
    }

    const body = await req.json();
    const { base64, filename, mime } = body;

    if (!base64) {
      return NextResponse.json({ status: 'error', message: 'Missing base64 data' }, { status: 400 });
    }

    // Extract base64 data (remove data:image/xxx;base64, prefix if present)
    const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
    const buffer = Buffer.from(base64Data, 'base64');

    // Check file size (max 5MB)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (buffer.length > MAX_SIZE) {
      return NextResponse.json({ status: 'error', message: 'File too large (max 5MB)' }, { status: 413 });
    }

    // Generate key and upload
    const fileName = generateFileName(filename || 'image.png');
    const key = `images/${fileName}`;
    const contentType = mime || 'image/png';

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        ACL: 'public-read',
      })
    );

    const url = getPublicUrl(key);

    return NextResponse.json({
      status: 'success',
      data: { url, key, size: buffer.length },
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
  try {
    if (!bucket) {
      return NextResponse.json({ status: 'error', message: 'Storage not configured' }, { status: 500 });
    }

    const body = await req.json();
    const { images } = body; // Array of { base64, filename, mime }

    if (!Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ status: 'error', message: 'No images provided' }, { status: 400 });
    }

    const MAX_SIZE = 5 * 1024 * 1024;
    const results: { url: string; key: string; originalIndex: number }[] = [];
    const errors: { index: number; message: string }[] = [];

    for (let i = 0; i < images.length; i++) {
      const { base64, filename, mime } = images[i];
      
      // Skip if already a URL (not base64)
      if (typeof base64 === 'string' && (base64.startsWith('http://') || base64.startsWith('https://'))) {
        results.push({ url: base64, key: '', originalIndex: i });
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
        const key = `images/${fileName}`;
        const contentType = mime || 'image/png';

        await client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: buffer,
            ContentType: contentType,
            ACL: 'public-read',
          })
        );

        results.push({ url: getPublicUrl(key), key, originalIndex: i });
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
