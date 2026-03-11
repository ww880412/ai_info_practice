#!/usr/bin/env tsx
/**
 * Backfill script: Populate entryIds for existing ComparisonBatch records
 *
 * This script reads all ModeComparison records grouped by batchId,
 * and updates the corresponding ComparisonBatch.entryIds field.
 *
 * Usage:
 *   docker-compose exec app npx tsx scripts/backfill-batch-entry-ids.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting backfill of ComparisonBatch.entryIds...\n');

  // Get all batches
  const batches = await prisma.comparisonBatch.findMany({
    select: { id: true, entryIds: true, entryCount: true },
  });

  console.log(`Found ${batches.length} batches to process.\n`);

  let updatedCount = 0;
  let skippedCount = 0;

  for (const batch of batches) {
    // Skip if entryIds already populated
    if (batch.entryIds && batch.entryIds.length > 0) {
      console.log(`Batch ${batch.id}: Already has ${batch.entryIds.length} entryIds, skipping.`);
      skippedCount++;
      continue;
    }

    // Get all ModeComparison records for this batch
    const comparisons = await prisma.modeComparison.findMany({
      where: { batchId: batch.id },
      select: { entryId: true },
      distinct: ['entryId'],
    });

    const entryIds = comparisons.map(c => c.entryId);

    // Update the batch with entryIds and fix entryCount if mismatched
    await prisma.comparisonBatch.update({
      where: { id: batch.id },
      data: {
        entryIds,
        entryCount: entryIds.length,
      },
    });

    const countMismatch = batch.entryCount !== entryIds.length ? ' (count fixed)' : '';
    console.log(`Batch ${batch.id}: Updated with ${entryIds.length} entryIds${countMismatch}`);
    updatedCount++;
  }

  console.log(`\nBackfill complete:`);
  console.log(`  - Updated: ${updatedCount} batches`);
  console.log(`  - Skipped: ${skippedCount} batches`);
}

main()
  .catch((e) => {
    console.error('Error during backfill:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
