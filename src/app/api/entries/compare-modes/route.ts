import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { inngest } from '@/lib/inngest/client';

const RequestSchema = z.object({
  entryIds: z.array(z.string()).min(1, 'At least one entry ID is required'),
  targetMode: z.enum(['two-step', 'tool-calling'], {
    errorMap: () => ({ message: 'targetMode must be either two-step or tool-calling' }),
  }),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = RequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { entryIds, targetMode } = validation.data;

    // Verify all entries exist
    const entries = await prisma.entry.findMany({
      where: { id: { in: entryIds } },
      select: { id: true },
    });

    if (entries.length !== entryIds.length) {
      return NextResponse.json(
        { error: 'Some entry IDs do not exist' },
        { status: 404 }
      );
    }

    // Create comparison batch
    const batch = await prisma.comparisonBatch.create({
      data: {
        targetMode,
        entryCount: entryIds.length,
        status: 'pending',
        progress: 0,
      },
    });

    // Trigger Inngest event
    await inngest.send({
      name: 'comparison/process-batch',
      data: {
        batchId: batch.id,
        entryIds,
        targetMode,
      },
    });

    // Estimate time (rough: 30s per entry)
    const estimatedMinutes = Math.ceil((entryIds.length * 30) / 60);
    const estimatedTime = estimatedMinutes === 1 ? '约 1 分钟' : `约 ${estimatedMinutes} 分钟`;

    return NextResponse.json({
      data: {
        batchId: batch.id,
        entryCount: entryIds.length,
        estimatedTime,
      },
    });
  } catch (error) {
    console.error('Failed to create comparison batch:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
