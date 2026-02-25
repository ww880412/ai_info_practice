import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/entries/[id]/ai-results - Get all AI result versions for an entry
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  try {
    const results = await prisma.entryAIResult.findMany({
      where: { entryId: id },
      orderBy: { version: 'desc' },
    });

    return NextResponse.json({ data: results });
  } catch (error) {
    console.error('Error fetching AI results:', error);
    return NextResponse.json(
      { error: 'Failed to fetch AI results' },
      { status: 500 }
    );
  }
}
