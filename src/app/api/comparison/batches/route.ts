import { NextRequest, NextResponse } from 'next/server';
import { queryBatches } from '@/lib/comparison/query-batches';
import { BatchStatus } from '@prisma/client';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse and validate query params
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');
    const statusParam = searchParams.get('status');

    // Robust parsing with NaN handling
    let limit = DEFAULT_LIMIT;
    if (limitParam) {
      const parsed = parseInt(limitParam, 10);
      if (!isNaN(parsed)) {
        limit = Math.min(Math.max(parsed, 1), MAX_LIMIT);
      }
    }

    let offset = 0;
    if (offsetParam) {
      const parsed = parseInt(offsetParam, 10);
      if (!isNaN(parsed) && parsed >= 0) {
        offset = parsed;
      }
    }

    // Validate status enum
    let status: BatchStatus | undefined;
    if (statusParam) {
      if (!['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'].includes(statusParam)) {
        return NextResponse.json(
          {
            error: {
              code: 'INVALID_PARAMS',
              message: 'status must be one of: PENDING, PROCESSING, COMPLETED, FAILED',
            },
          },
          { status: 400 }
        );
      }
      status = statusParam as BatchStatus;
    }

    // Query batches
    const { batches, total } = await queryBatches({ limit, offset, status });

    // Calculate pagination info
    const hasNext = offset + batches.length < total;
    const nextOffset = hasNext ? offset + limit : null;

    return NextResponse.json({
      data: {
        batches: batches.map((batch) => ({
          ...batch,
          createdAt: batch.createdAt.toISOString(),
        })),
        pageInfo: {
          total,
          limit,
          offset,
          hasNext,
          nextOffset,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching comparison batches:', error);
    return NextResponse.json(
      {
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to fetch comparison batches',
        },
      },
      { status: 500 }
    );
  }
}
