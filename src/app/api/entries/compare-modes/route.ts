import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { inngest } from '@/lib/inngest/client';

const RequestSchema = z.object({
  entryIds: z.array(z.string()).min(1, 'At least one entry ID is required'),
  targetMode: z.enum(['two-step', 'tool-calling']),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = RequestSchema.safeParse(body);

    if (!validation.success) {
      const firstError = validation.error.issues[0];
      return NextResponse.json(
        { error: firstError.message || 'targetMode must be either two-step or tool-calling' },
        { status: 400 }
      );
    }

    const { entryIds, targetMode } = validation.data;

    // Detect and deduplicate entry IDs
    const uniqueEntryIds = Array.from(new Set(entryIds));
    if (uniqueEntryIds.length !== entryIds.length) {
      const duplicateCount = entryIds.length - uniqueEntryIds.length;
      return NextResponse.json(
        { error: `Found ${duplicateCount} duplicate entry ID${duplicateCount === 1 ? '' : 's'}. Please remove duplicates.` },
        { status: 400 }
      );
    }

    // Verify all entries exist and have originalExecutionMode
    const entries = await prisma.entry.findMany({
      where: { id: { in: entryIds } },
      select: { id: true, originalExecutionMode: true },
    });

    if (entries.length !== entryIds.length) {
      return NextResponse.json(
        { error: 'Some entry IDs do not exist' },
        { status: 404 }
      );
    }

    // Filter out entries without originalExecutionMode (legacy or classifier-fallback entries)
    const entriesWithBaseline = entries.filter((e) => e.originalExecutionMode !== null);
    const missingBaselineCount = entries.length - entriesWithBaseline.length;

    if (missingBaselineCount > 0) {
      return NextResponse.json(
        {
          error: `${missingBaselineCount} entr${missingBaselineCount === 1 ? 'y' : 'ies'} missing baseline execution mode. Only entries processed with Agent can be compared.`,
        },
        { status: 400 }
      );
    }

    // Create comparison batch
    const batch = await prisma.comparisonBatch.create({
      data: {
        sourceMode: 'TWO_STEP', // Default baseline mode (will be determined per entry)
        targetMode: targetMode === 'two-step' ? 'TWO_STEP' : 'TOOL_CALLING',
        entryIds: entryIds,
        entryCount: entryIds.length,
        status: 'PENDING',
        progress: 0,
        processedCount: 0,
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
