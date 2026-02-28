/**
 * Test script to verify R2 storage upload functionality
 * Run with: npx tsx scripts/test-r2-upload.ts
 */
import { uploadFile } from '../src/lib/storage';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') });

import { downloadFromUrl, downloadFile } from '../src/lib/storage';

async function testUploadAndDownload() {
  console.log('Testing R2 upload...');
  console.log('Account ID:', process.env.R2_ACCOUNT_ID?.substring(0, 8) + '...');
  console.log('Bucket:', process.env.R2_BUCKET_NAME);

  try {
    // Create a test buffer
    const testContent = 'Hello, R2 Storage! Test at ' + new Date().toISOString();
    const buffer = Buffer.from(testContent, 'utf-8');

    const result = await uploadFile(buffer, 'test-file.txt', 'text/plain');

    console.log('\n✅ Upload successful!');
    console.log('Key:', result.key);
    console.log('URL:', result.url);
    console.log('Size:', result.size, 'bytes');
    console.log('MimeType:', result.mimeType);

    // Test download
    console.log('\nTesting download...');
    const downloaded = await downloadFromUrl(result.url);
    const downloadedContent = downloaded.buffer.toString('utf-8');

    console.log('Downloaded content:', downloadedContent);
    console.log('Match:', downloadedContent === testContent ? '✅ OK' : '❌ MISMATCH');

    return result;
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

testUploadAndDownload();
