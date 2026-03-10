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

  return { batches, total };
}
