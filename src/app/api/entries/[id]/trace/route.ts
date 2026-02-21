import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = await params;

  try {
    const trace = await prisma.reasoningTrace.findFirst({
      where: { entryId: id },
      orderBy: { createdAt: 'desc' },
    });

    if (!trace) {
      return NextResponse.json(
        { error: 'Trace not found', steps: [] },
        { status: 404 }
      );
    }

    // 解析 JSON 字段
    const steps = typeof trace.steps === 'string'
      ? JSON.parse(trace.steps)
      : trace.steps;

    const finalResult = typeof trace.finalResult === 'string'
      ? JSON.parse(trace.finalResult)
      : trace.finalResult;

    const metadata = typeof trace.metadata === 'string'
      ? JSON.parse(trace.metadata)
      : trace.metadata;

    return NextResponse.json({
      steps,
      finalResult,
      metadata,
    });
  } catch (error) {
    console.error('Error fetching trace:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trace', steps: [] },
      { status: 500 }
    );
  }
}
