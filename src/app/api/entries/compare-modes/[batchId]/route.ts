import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { batchId: string } }
) {
  try {
    const { batchId } = params;

    const batch = await prisma.comparisonBatch.findUnique({
      where: { id: batchId },
    });

    if (!batch) {
      return NextResponse.json(
        { error: 'Batch not found' },
        { status: 404 }
      );
    }

    // If completed, fetch results
    let results = null;
    if (batch.status === 'completed') {
      results = await prisma.modeComparison.findMany({
        where: { batchId },
        include: {
          entry: {
            select: {
              id: true,
              title: true,
            },
          },
        },
        orderBy: { batchIndex: 'asc' },
      });
    }

    // Calculate progress percentage
    const progressPercentage = batch.entryCount > 0
      ? Math.round((batch.progress / batch.entryCount) * 100)
      : 0;

    return NextResponse.json({
      data: {
        batchId: batch.id,
        status: batch.status,
        progress: progressPercentage,
        entryCount: batch.entryCount,
        completedCount: batch.progress,
        results,
        stats: batch.stats,
      },
    });
  } catch (error) {
    console.error('Failed to fetch comparison batch:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
