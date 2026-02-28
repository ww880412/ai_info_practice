/**
 * Cloudflare R2 Storage Client
 * S3-compatible object storage configuration
 */
import { S3Client } from '@aws-sdk/client-s3';

function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

let client: S3Client | null = null;

export function getStorageClient(): S3Client {
  if (client) return client;

  const accountId = getRequiredEnv('R2_ACCOUNT_ID');
  const accessKeyId = getRequiredEnv('R2_ACCESS_KEY_ID');
  const secretAccessKey = getRequiredEnv('R2_SECRET_ACCESS_KEY');

  client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return client;
}

export function getBucketName(): string {
  return getRequiredEnv('R2_BUCKET_NAME');
}

export function getPublicUrl(): string | undefined {
  return process.env.R2_PUBLIC_URL;
}
