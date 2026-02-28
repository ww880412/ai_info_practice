/**
 * File download utilities for R2 storage
 */
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getStorageClient, getBucketName, getPublicUrl } from './client';

export interface DownloadResult {
  buffer: Buffer;
  mimeType: string;
}

/**
 * Download file from R2 storage
 * @param key - The object key in the bucket
 */
export async function downloadFile(key: string): Promise<DownloadResult> {
  const client = getStorageClient();
  const bucket = getBucketName();

  const response = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );

  if (!response.Body) {
    throw new Error(`Empty response body for key: ${key}`);
  }

  const chunks: Uint8Array[] = [];
  for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }

  return {
    buffer: Buffer.concat(chunks),
    mimeType: response.ContentType || 'application/octet-stream',
  };
}

/**
 * Get a signed URL for temporary access (1 hour by default)
 */
export async function getSignedDownloadUrl(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  const client = getStorageClient();
  const bucket = getBucketName();

  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
    { expiresIn }
  );
}

/**
 * Get the public URL if configured, otherwise generate signed URL
 */
export async function getFileUrl(key: string): Promise<string> {
  const publicUrl = getPublicUrl();
  if (publicUrl) {
    return `${publicUrl}/${key}`;
  }
  return getSignedDownloadUrl(key);
}

/**
 * Download file from URL (supports both R2 internal and external URLs)
 */
export async function downloadFromUrl(url: string): Promise<DownloadResult> {
  // Handle R2 internal URL format: r2://bucket/key
  if (url.startsWith('r2://')) {
    const key = url.replace(/^r2:\/\/[^/]+\//, '');
    return downloadFile(key);
  }

  // Handle HTTP(S) URLs
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download from ${url}: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    mimeType: response.headers.get('content-type') || 'application/octet-stream',
  };
}
