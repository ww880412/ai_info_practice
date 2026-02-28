/**
 * Migration script: Move existing uploads from local filesystem to R2
 * Run with: npx tsx scripts/migrate-uploads-to-r2.ts
 */
import { uploadFile } from '../src/lib/storage';
import { prisma } from '../src/lib/prisma';
import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') });

const UPLOAD_DIR = join(process.cwd(), 'public', 'uploads');

interface MigrationResult {
  file: string;
  status: 'success' | 'skipped' | 'error';
  newUrl?: string;
  error?: string;
}

async function migrateFile(fileName: string): Promise<MigrationResult> {
  try {
    const filePath = join(UPLOAD_DIR, fileName);
    const buffer = await readFile(filePath);

    // Detect mime type from extension
    const ext = fileName.split('.').pop()?.toLowerCase();
    const mimeMap: Record<string, string> = {
      pdf: 'application/pdf',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
      heic: 'image/heic',
    };
    const mimeType = mimeMap[ext || ''] || 'application/octet-stream';

    // Upload to R2
    const result = await uploadFile(buffer, fileName, mimeType);

    return {
      file: fileName,
      status: 'success',
      newUrl: result.url,
    };
  } catch (error) {
    return {
      file: fileName,
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function updateEntryUrls(oldKey: string, newUrl: string): Promise<number> {
  // Update entries that reference this file
  const result = await prisma.entry.updateMany({
    where: { rawUrl: oldKey },
    data: { rawUrl: newUrl },
  });
  return result.count;
}

async function main() {
  console.log('=== Migrating uploads to R2 ===\n');
  console.log('Upload directory:', UPLOAD_DIR);
  console.log('R2 Bucket:', process.env.R2_BUCKET_NAME);
  console.log('');

  // Get list of files
  const files = await readdir(UPLOAD_DIR);
  const uploadFiles = files.filter(f => !f.startsWith('.'));

  console.log(`Found ${uploadFiles.length} files to migrate\n`);

  const results: MigrationResult[] = [];

  for (const file of uploadFiles) {
    console.log(`Migrating: ${file}...`);
    const result = await migrateFile(file);
    results.push(result);

    if (result.status === 'success' && result.newUrl) {
      // Update database entries
      const updatedCount = await updateEntryUrls(file, result.newUrl);
      console.log(`  ✅ Uploaded to R2: ${result.newUrl}`);
      if (updatedCount > 0) {
        console.log(`  📝 Updated ${updatedCount} entry/entries in database`);
      }
    } else if (result.status === 'error') {
      console.log(`  ❌ Error: ${result.error}`);
    }
  }

  // Summary
  console.log('\n=== Migration Summary ===');
  const success = results.filter(r => r.status === 'success').length;
  const errors = results.filter(r => r.status === 'error').length;
  console.log(`Success: ${success}`);
  console.log(`Errors: ${errors}`);

  if (errors === 0) {
    console.log('\n✅ All files migrated successfully!');
    console.log('\nNext steps:');
    console.log('1. Verify the application works with R2 storage');
    console.log('2. After verification, you can delete public/uploads/ contents');
  } else {
    console.log('\n⚠️  Some files failed to migrate. Please check errors above.');
  }

  await prisma.$disconnect();
}

main().catch(console.error);
