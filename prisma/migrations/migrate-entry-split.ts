#!/usr/bin/env tsx
/**
 * Migration script: Entry model split (B2.1)
 * Migrates data from Entry god model to new split tables:
 * - EntryAIResult
 * - EntryEvaluation
 * - EntrySmartSummary
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting Entry model split migration...');

  const entries = await prisma.entry.findMany({
    select: {
      id: true,
      contentType: true,
      techDomain: true,
      aiTags: true,
      coreSummary: true,
      keyPoints: true,
      practiceValue: true,
      summaryStructure: true,
      keyPointsNew: true,
      boundaries: true,
      confidence: true,
      extractedMetadata: true,
      difficulty: true,
      contentForm: true,
      timeliness: true,
      sourceTrust: true,
      qualityOverride: true,
      smartSummary: true,
      keyInsights: true,
      tldr: true,
    },
  });

  console.log(`Found ${entries.length} entries to migrate`);

  let migratedAI = 0;
  let migratedEval = 0;
  let migratedSummary = 0;

  for (const entry of entries) {
    await prisma.$transaction(async (tx) => {
      // Migrate AI result data
      const hasAIData =
        entry.contentType ||
        entry.techDomain ||
        entry.aiTags.length > 0 ||
        entry.coreSummary ||
        entry.keyPoints.length > 0 ||
        entry.practiceValue ||
        entry.summaryStructure ||
        entry.keyPointsNew ||
        entry.boundaries ||
        entry.confidence !== null ||
        entry.extractedMetadata;

      if (hasAIData) {
        await tx.entryAIResult.upsert({
          where: { entryId_version: { entryId: entry.id, version: 1 } },
          create: {
            entryId: entry.id,
            contentType: entry.contentType,
            techDomain: entry.techDomain,
            aiTags: entry.aiTags,
            coreSummary: entry.coreSummary,
            keyPoints: entry.keyPoints,
            practiceValue: entry.practiceValue,
            summaryStructure: entry.summaryStructure as Prisma.InputJsonValue ?? undefined,
            keyPointsNew: entry.keyPointsNew as Prisma.InputJsonValue ?? undefined,
            boundaries: entry.boundaries as Prisma.InputJsonValue ?? undefined,
            confidence: entry.confidence,
            extractedMetadata: entry.extractedMetadata as Prisma.InputJsonValue ?? undefined,
          },
          update: {
            contentType: entry.contentType,
            techDomain: entry.techDomain,
            aiTags: entry.aiTags,
            coreSummary: entry.coreSummary,
            keyPoints: entry.keyPoints,
            practiceValue: entry.practiceValue,
            summaryStructure: entry.summaryStructure as Prisma.InputJsonValue ?? undefined,
            keyPointsNew: entry.keyPointsNew as Prisma.InputJsonValue ?? undefined,
            boundaries: entry.boundaries as Prisma.InputJsonValue ?? undefined,
            confidence: entry.confidence,
            extractedMetadata: entry.extractedMetadata as Prisma.InputJsonValue ?? undefined,
          },
        });
        migratedAI++;
      }

      // Migrate evaluation data
      const hasEvalData =
        entry.difficulty ||
        entry.contentForm ||
        entry.timeliness ||
        entry.sourceTrust ||
        entry.qualityOverride;

      if (hasEvalData) {
        await tx.entryEvaluation.upsert({
          where: { entryId: entry.id },
          create: {
            entryId: entry.id,
            difficulty: entry.difficulty,
            contentForm: entry.contentForm,
            timeliness: entry.timeliness,
            sourceTrust: entry.sourceTrust,
            qualityOverride: entry.qualityOverride as Prisma.InputJsonValue ?? undefined,
          },
          update: {
            difficulty: entry.difficulty,
            contentForm: entry.contentForm,
            timeliness: entry.timeliness,
            sourceTrust: entry.sourceTrust,
            qualityOverride: entry.qualityOverride as Prisma.InputJsonValue ?? undefined,
          },
        });
        migratedEval++;
      }

      // Migrate smart summary data
      const hasSummaryData =
        entry.smartSummary || entry.keyInsights.length > 0 || entry.tldr;

      if (hasSummaryData) {
        await tx.entrySmartSummary.upsert({
          where: { entryId: entry.id },
          create: {
            entryId: entry.id,
            smartSummary: entry.smartSummary,
            keyInsights: entry.keyInsights,
            tldr: entry.tldr,
          },
          update: {
            smartSummary: entry.smartSummary,
            keyInsights: entry.keyInsights,
            tldr: entry.tldr,
          },
        });
        migratedSummary++;
      }
    });
  }

  console.log('Migration completed:');
  console.log(`- EntryAIResult: ${migratedAI} records`);
  console.log(`- EntryEvaluation: ${migratedEval} records`);
  console.log(`- EntrySmartSummary: ${migratedSummary} records`);
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
