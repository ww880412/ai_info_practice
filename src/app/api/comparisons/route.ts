import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { queryComparisons } from '@/lib/comparison/query-comparisons';

const QuerySchema = z.object({
  status: z.enum(['COMPLETED', 'FAILED']).optional(),
  winner: z.enum(['original', 'comparison', 'tie']).optional(),
  modePair: z.string().regex(/^[\w-]+-vs-[\w-]+$/).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const validation = QuerySchema.safeParse({
      status: searchParams.get('status') ?? undefined,
      winner: searchParams.get('winner') ?? undefined,
      modePair: searchParams.get('modePair') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      offset: searchParams.get('offset') ?? undefined,
      order: searchParams.get('order') ?? undefined,
    });

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const query = validation.data;
    const result = await queryComparisons({
      limit: query.limit,
      offset: query.offset,
      status: query.status,
      winner: query.winner,
      modePair: query.modePair,
      order: query.order,
    });

    const hasNext = query.offset + query.limit < result.total;
    return NextResponse.json({
      data: {
        comparisons: result.comparisons,
        pageInfo: {
          total: result.total,
          limit: query.limit,
          offset: query.offset,
          hasNext,
          nextOffset: hasNext ? query.offset + query.limit : null,
        },
      },
    });
  } catch (error) {
    console.error('Get global comparisons error:', error);
    return NextResponse.json(
      { error: 'Failed to get comparisons' },
      { status: 500 }
    );
  }
}
