/**
 * File upload utilities for R2 storage
 */
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getStorageClient, getBucketName, getPublicUrl } from './client';
import { randomUUID } from 'crypto';

export interface UploadResult {
  key: string;
  url: string;
  size: number;
  mimeType: string;
}

export async function uploadFile(
  buffer: Buffer,
  originalName: string,
  mimeType: string
): Promise<UploadResult> {
  const client = getStorageClient();
  const bucket = getBucketName();

  const ext = originalName.split('.').pop() || 'bin';
  const key = `uploads/${randomUUID()}.${ext}`;

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    })
  );

  const publicUrl = getPublicUrl();
  const url = publicUrl
    ? `${publicUrl}/${key}`
    : `r2://${bucket}/${key}`;

  return {
    key,
    url,
    size: buffer.length,
    mimeType,
  };
}
