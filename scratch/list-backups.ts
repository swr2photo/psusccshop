// scratch/list-backups.ts
import 'dotenv/config';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';

const filebaseClient = new S3Client({
  endpoint: process.env.FILEBASE_ENDPOINT || 'https://s3.filebase.com',
  region: process.env.FILEBASE_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.FILEBASE_ACCESS_KEY || '',
    secretAccessKey: process.env.FILEBASE_SECRET_KEY || '',
  },
  forcePathStyle: true,
});

async function main() {
  const bucket = process.env.FILEBASE_BUCKET || 'psusccshop-data';
  const prefixes = ['config/', 'users/', 'carts/', 'orders/', 'email-logs/', 'user-logs/', 'data-requests/', 'slips/', 'images/'];
  
  for (const prefix of prefixes) {
    try {
      const res = await filebaseClient.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
        })
      );
      const count = res.Contents ? res.Contents.length : 0;
      console.log(`Prefix: ${prefix} -> ${count} files`);
    } catch (err: any) {
      console.error(`Error for ${prefix}:`, err.message);
    }
  }
}

main();
