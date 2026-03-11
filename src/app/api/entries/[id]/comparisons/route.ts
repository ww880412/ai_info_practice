import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

const QuerySchema = z.object({
  status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  sort: z.enum(['createdAt', 'processedAt']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

type QueryParams = z.infer<typeof QuerySchema>;

/**
 * GET /api/entries/[id]/comparisons - Get comparison history for an entry
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: entryId } = await params;

    // Validate entry exists
    const entry = await prisma.entry.findUnique({
      where: { id: entryId },
      select: { id: true, originalExecutionMode: true },
    });

    if (!entry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }

    // Parse and validate query parameters
    const searchParams = request.nextUrl.searchParams;
    const queryValidation = QuerySchema.safeParse({
      status: searchParams.get('status'),
      limit: searchParams.get('limit'),
      offset: searchParams.get('offset'),
      sort: searchParams.get('sort'),
      order: searchParams.get('order'),
      from: searchParams.get('from'),
      to: searchParams.get('to'),
    });

    if (!queryValidation.success) {
      return NextResponse.json(
        { error: queryValidation.error.issues[0].message },
        { status: 400 }
      );
    }

    const query: QueryParams = queryValidation.data;

    // Build where clause for ComparisonBatch
    const batchWhere: any = {
      entryIds: { has: entryId },
    };

    if (query.status) {
      batchWhere.status = query.status;
    }

    if (query.from || query.to) {
      batchWhere.createdAt = {};
      if (query.from) {
        batchWhere.createdAt.gte = new Date(query.from);
      }
      if (query.to) {
        batchWhere.createdAt.lte = new Date(query.to);
      }
    }

    // Get total count
    const total = await prisma.comparisonBatch.count({ where: batchWhere });

    // Query ComparisonBatch with pagination
    const batches = await prisma.comparisonBatch.findMany({
      where: batchWhere,
      orderBy: { createdAt: query.order },
      skip: query.offset,
      take: query.limit,
      select: {
        id: true,
        createdAt: true,
        status: true,
        sourceMode: true,
        targetMode: true,
      },
    });

    const batchIds = batches.map((b) => b.id);

    // Query ModeComparison for these batches and this entry
    const comparisons = await prisma.modeComparison.findMany({
      where: {
        entryId,
        batchId: { in: batchIds },
      },
      select: {
        id: true,
        batchId: true,
        createdAt: true,
        originalMode: true,
        comparisonMode: true,
        originalScore: true,
        comparisonScore: true,
        winner: true,
        scoreDiff: true,
      },
    });

    // Create a map for quick lookup
    const comparisonMap = new Map(
      comparisons.map((c) => [c.batchId, c])
    );

    // Merge results
    const results = batches.map((batch) => {
      const comparison = comparisonMap.get(batch.id);

      // Extract overall scores from QualityEvaluation JSON
      let originalOverallScore: number | undefined;
      let comparisonOverallScore: number | undefined;

      if (comparison) {
        try {
          const originalScore = comparison.originalScore as any;
          const comparisonScore = comparison.comparisonScore as any;
          originalOverallScore = originalScore?.overallScore;
          comparisonOverallScore = comparisonScore?.overallScore;
        } catch (e) {
          // Ignore JSON parsing errors
        }
      }

      return {
        batchId: batch.id,
        batchCreatedAt: batch.createdAt.toISOString(),
        batchStatus: batch.status,
        // Use comparison modes if available, otherwise fallback to entry's originalExecutionMode
        originalMode: comparison?.originalMode || entry.originalExecutionMode || undefined,
        comparisonMode: comparison?.comparisonMode || undefined,
        // Result info (nullable while processing)
        resultId: comparison?.id,
        processedAt: comparison?.createdAt.toISOString(),
        winner: comparison?.winner || undefined,
        originalOverallScore,
        comparisonOverallScore,
        scoreDiff: comparison?.scoreDiff,
      };
    });

    // Apply sort by processedAt if requested (post-query sort)
    if (query.sort === 'processedAt') {
      results.sort((a, b) => {
        const aTime = a.processedAt ? new Date(a.processedAt).getTime() : 0;
        const bTime = b.processedAt ? new Date(b.processedAt).getTime() : 0;
        return query.order === 'asc' ? aTime - bTime : bTime - aTime;
      });
    }

    // Calculate pagination info
    const hasNext = query.offset + query.limit < total;
    const nextOffset = hasNext ? query.offset + query.limit : null;

    return NextResponse.json({
      data: {
        comparisons: results,
        pageInfo: {
          total,
          limit: query.limit,
          offset: query.offset,
          hasNext,
          nextOffset,
        },
      },
    });
  } catch (error) {
    console.error('Get entry comparisons error:', error);
    return NextResponse.json(
      { error: 'Failed to get entry comparisons' },
      { status: 500 }
    );
  }
}
