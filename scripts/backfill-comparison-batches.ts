import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function backfill() {
  const batches = await prisma.comparisonBatch.findMany({
    where: { sourceMode: null },
  });

  console.log(`Found ${batches.length} batches to backfill`);

  for (const batch of batches) {
    // Map old string values to enum values
    const targetModeEnum = (batch.targetMode as any) === 'tool-calling'
      ? 'TOOL_CALLING'
      : 'TWO_STEP';

    // Infer sourceMode from targetMode (opposite)
    const sourceModeEnum = targetModeEnum === 'TOOL_CALLING'
      ? 'TWO_STEP'
      : 'TOOL_CALLING';

    // Recalculate winRate/avgScoreDiff from stats if available
    const stats = batch.stats as any;
    const winRate = stats?.winRate ?? null;
    const avgScoreDiff = stats?.avgScoreDiff ?? null;

    await prisma.comparisonBatch.update({
      where: { id: batch.id },
      data: {
        sourceMode: sourceModeEnum as any,
        targetMode: targetModeEnum as any,
        winRate,
        avgScoreDiff,
      },
    });

    console.log(`Backfilled batch ${batch.id}`);
  }

  console.log('Backfill complete');
}

backfill()
  .catch((e) => {
    console.error('Backfill failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
