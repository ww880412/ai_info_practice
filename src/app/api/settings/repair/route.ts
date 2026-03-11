import { NextResponse } from 'next/server';
import { repairDefaultCredentials } from '@/lib/settings/auto-repair';

/**
 * POST /api/settings/repair
 * Manual trigger for auto-repair of default credentials
 * Ensures only one default credential per provider
 */
export async function POST() {
  try {
    const repairs = await repairDefaultCredentials();

    return NextResponse.json({
      data: {
        repaired: repairs.length > 0,
        repairs,
        message: repairs.length > 0
          ? `Repaired ${repairs.length} provider(s)`
          : 'No repairs needed',
      },
    });
  } catch (error) {
    console.error('Auto-repair failed:', error);
    return NextResponse.json(
      {
        error: {
          code: 'REPAIR_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    );
  }
}
