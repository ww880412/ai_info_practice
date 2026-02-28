/**
 * File upload utilities for R2 storage
 */
import { PutObjectCommand, AbortMultipartUploadCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getStorageClient, getBucketName, getPublicUrl } from './client';
import { randomUUID } from 'crypto';
import type { Readable } from 'stream';

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

/**
 * Stream upload for large files using multipart upload
 * Reduces memory usage by not loading entire file into memory
 */
export async function uploadFileStream(
  stream: Readable,
  originalName: string,
  mimeType: string,
  contentLength?: number,
  abortSignal?: AbortSignal
): Promise<UploadResult> {
  const client = getStorageClient();
  const bucket = getBucketName();

  const ext = originalName.split('.').pop() || 'bin';
  const key = `uploads/${randomUUID()}.${ext}`;

  const upload = new Upload({
    client,
    params: {
      Bucket: bucket,
      Key: key,
      Body: stream,
      ContentType: mimeType,
    },
    queueSize: 4, // Concurrent part uploads
    partSize: 5 * 1024 * 1024, // 5MB parts (minimum for S3/R2)
    leavePartsOnError: false, // Auto-cleanup on failure
  });

  // Handle abort signal
  if (abortSignal) {
    abortSignal.addEventListener('abort', () => {
      upload.abort();
    });
  }

  try {
    await upload.done();
  } catch (error) {
    // Clean up incomplete multipart upload
    const uploadId = (upload as unknown as { uploadId?: string }).uploadId;
    if (uploadId) {
      await client.send(
        new AbortMultipartUploadCommand({
          Bucket: bucket,
          Key: key,
          UploadId: uploadId,
        })
      ).catch(() => {}); // Ignore cleanup errors
    }
    throw error;
  }

  const publicUrl = getPublicUrl();
  const url = publicUrl
    ? `${publicUrl}/${key}`
    : `r2://${bucket}/${key}`;

  return {
    key,
    url,
    size: contentLength || 0,
    mimeType,
  };
}
