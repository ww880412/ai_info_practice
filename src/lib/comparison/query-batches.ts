import { prisma } from '@/lib/prisma';
import { BatchStatus } from '@prisma/client';

export interface QueryBatchesParams {
  limit: number;
  offset: number;
  status?: BatchStatus;
}

export interface QueryBatchesResult {
  batches: Array<{
    id: string;
    createdAt: Date;
    sourceMode: string;
    targetMode: string;
    entryCount: number;
    status: string;
    progress: number;
    processedCount: number;
    winRate: number | null;
    avgScoreDiff: number | null;
    stats: any;
    entryPreviews: Array<{ title: string | null }>;
  }>;
  total: number;
}

export async function queryBatches(
  params: QueryBatchesParams
): Promise<QueryBatchesResult> {
  const { limit, offset, status } = params;

  const where = status ? { status } : undefined;

  const [batches, total] = await Promise.all([
    prisma.comparisonBatch.findMany({
      where,
      select: {
        id: true,
        createdAt: true,
        sourceMode: true,
        targetMode: true,
        entryCount: true,
        status: true,
        progress: true,
        processedCount: true,
        winRate: true,
        avgScoreDiff: true,
        stats: true,
      },
      orderBy: [
        { createdAt: 'desc' },
        { id: 'desc' },  // Stable sort
      ],
      take: limit,
      skip: offset,
    }),
    prisma.comparisonBatch.count({ where }),
  ]);

  // Batch-fetch entry previews (avoid N+1)
  const batchIds = batches.map((b) => b.id);
  const comparisons = batchIds.length > 0
    ? await prisma.modeComparison.findMany({
        where: { batchId: { in: batchIds } },
        select: { batchId: true, entry: { select: { title: true } } },
        orderBy: [{ batchId: 'asc' }, { createdAt: 'asc' }],
      })
    : [];

  // Group previews by batchId, keep first 3 per batch
  const previewsByBatch = new Map<string, Array<{ title: string | null }>>();
  for (const c of comparisons) {
    const list = previewsByBatch.get(c.batchId) ?? [];
    if (list.length < 3) {
      list.push(c.entry);
      previewsByBatch.set(c.batchId, list);
    }
  }

  return {
    batches: batches.map((batch) => ({
      ...batch,
      entryPreviews: previewsByBatch.get(batch.id) ?? [],
    })),
    total,
  };
}
