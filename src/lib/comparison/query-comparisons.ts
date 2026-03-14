import { prisma } from '@/lib/prisma';
import { BatchStatus, Prisma } from '@prisma/client';
import type { GlobalComparisonItem } from '@/types/comparison';

export interface QueryComparisonsParams {
  limit: number;
  offset: number;
  status?: BatchStatus;
  winner?: 'original' | 'comparison' | 'tie';
  modePair?: string;
  order?: 'asc' | 'desc';
}

export interface QueryComparisonsResult {
  comparisons: GlobalComparisonItem[];
  total: number;
}

export async function queryComparisons(
  params: QueryComparisonsParams
): Promise<QueryComparisonsResult> {
  const { limit, offset, status, winner, modePair, order = 'desc' } = params;

  // Step 1: Default to COMPLETED/FAILED batches only
  const batchWhere: Prisma.ComparisonBatchWhereInput = status
    ? { status }
    : { status: { in: [BatchStatus.COMPLETED, BatchStatus.FAILED] } };
  const batches = await prisma.comparisonBatch.findMany({
    where: batchWhere,
    select: { id: true, status: true },
  });
  if (batches.length === 0) return { comparisons: [], total: 0 };

  const batchIdFilter = batches.map((b) => b.id);
  const statusMap = new Map(batches.map((b) => [b.id, b.status]));

  // Step 2: Build ModeComparison where clause
  const where: Prisma.ModeComparisonWhereInput = { batchId: { in: batchIdFilter } };
  if (winner) where.winner = winner;
  if (modePair) {
    const [orig, comp] = modePair.split('-vs-');
    if (orig && comp) {
      where.originalMode = orig;
      where.comparisonMode = comp;
    }
  }

  // Step 3: Parallel findMany + count
  const [rows, total] = await Promise.all([
    prisma.modeComparison.findMany({
      where,
      select: {
        id: true,
        createdAt: true,
        batchId: true,
        originalMode: true,
        comparisonMode: true,
        originalScore: true,
        comparisonScore: true,
        winner: true,
        scoreDiff: true,
        entryId: true,
        entry: { select: { title: true } },
      },
      orderBy: [{ createdAt: order }, { id: 'desc' }],
      take: limit,
      skip: offset,
    }),
    prisma.modeComparison.count({ where }),
  ]);

  // Step 4: Assemble results with JSON score extraction
  const comparisons: GlobalComparisonItem[] = rows.map((row) => {
    const origScore = row.originalScore as Record<string, unknown> | null;
    const compScore = row.comparisonScore as Record<string, unknown> | null;
    return {
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      batchId: row.batchId,
      originalMode: row.originalMode,
      comparisonMode: row.comparisonMode,
      winner: row.winner,
      scoreDiff: row.scoreDiff,
      originalOverallScore: (origScore?.overallScore as number) ?? null,
      comparisonOverallScore: (compScore?.overallScore as number) ?? null,
      entryId: row.entryId,
      entryTitle: row.entry?.title ?? null,
      batchStatus: statusMap.get(row.batchId) ?? 'COMPLETED',
    };
  });

  return { comparisons, total };
}
