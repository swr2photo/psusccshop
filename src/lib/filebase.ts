import { S3Client, GetObjectCommand, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

const endpoint = process.env.FILEBASE_ENDPOINT || 'https://s3.filebase.com';
const region = process.env.FILEBASE_REGION || 'us-east-1';
const bucket = process.env.FILEBASE_BUCKET;
const accessKeyId = process.env.FILEBASE_ACCESS_KEY;
const secretAccessKey = process.env.FILEBASE_SECRET_KEY;

if (!bucket) {
  console.warn('[filebase] FILEBASE_BUCKET is not set');
}

const client = new S3Client({
  region,
  endpoint,
  credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Retryable<T> = () => Promise<T>;

const withRetry = async <T>(fn: Retryable<T>, opts?: { retries?: number; baseDelayMs?: number; factor?: number }) => {
  const retries = opts?.retries ?? 3;
  const base = opts?.baseDelayMs ?? 150;
  const factor = opts?.factor ?? 1.8;

  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (error: any) {
      attempt += 1;
      const status = error?.$metadata?.httpStatusCode;
      const isNotFound = status === 404;
      if (isNotFound || attempt > retries) {
        throw error;
      }
      const delay = Math.min(base * factor ** (attempt - 1), 2000);
      await sleep(delay);
    }
  }
};

const streamToString = async (stream: Readable): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf-8');
};

export async function getJson<T = any>(key: string): Promise<T | null> {
  if (!bucket) return null;
  try {
    const res = await withRetry(() => client.send(new GetObjectCommand({ Bucket: bucket, Key: key })));
    if (!res.Body) return null;
    const body = await streamToString(res.Body as Readable);
    return JSON.parse(body) as T;
  } catch (error: any) {
    if (error?.$metadata?.httpStatusCode === 404) return null;
    console.error('[filebase] getJson error', key, error);
    throw error;
  }
}

export async function putJson(key: string, data: any): Promise<void> {
  if (!bucket) throw new Error('FILEBASE_BUCKET is not set');
  await withRetry(() =>
    client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: JSON.stringify(data, null, 2),
        ContentType: 'application/json',
      })
    )
  );
}

export async function listKeys(prefix: string): Promise<string[]> {
  if (!bucket) return [];
  const keys: string[] = [];
  let continuationToken: string | undefined;
  do {
    const res = await withRetry(() =>
      client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: continuationToken }))
    );
    (res.Contents || []).forEach((obj: { Key?: string } | undefined) => {
      if (obj && obj.Key) keys.push(obj.Key);
    });
    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (continuationToken);
  return keys;
}

export async function deleteObject(key: string): Promise<void> {
  if (!bucket) throw new Error('FILEBASE_BUCKET is not set');
  await withRetry(() => client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })));
}
