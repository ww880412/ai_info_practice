import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  try {
    const attempts = await prisma.processAttempt.findMany({
      where: { entryId: id },
      orderBy: { startedAt: 'desc' },
      include: {
        previousAttempt: true,
        nextAttempt: true,
      },
    });

    // 转换为 API 响应格式
    const data = {
      attempts: attempts.map(attempt => ({
        id: attempt.id,
        attemptNumber: attempt.attemptNumber,
        status: attempt.status,
        startedAt: attempt.startedAt.toISOString(),
        completedAt: attempt.completedAt?.toISOString() || null,
        durationMs: attempt.durationMs,
        inputSummary: attempt.inputSummary,
        error: attempt.error,
        retryAfterMs: attempt.retryAfterMs,
        previousAttemptId: attempt.previousAttemptId,
      })),
    };

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error fetching process attempts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch process attempts', data: { attempts: [] } },
      { status: 500 }
    );
  }
}
