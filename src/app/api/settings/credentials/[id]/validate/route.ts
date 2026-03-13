/**
 * API Route: /api/settings/credentials/[id]/validate
 *
 * POST - Validate credential against provider API
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateCredential } from '@/lib/settings/credential-validation';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if credential exists
    const existing = await prisma.apiCredential.findUnique({
      where: { id },
    });

    if (!existing || !existing.isActive) {
      return NextResponse.json(
        { error: { code: 'CREDENTIAL_NOT_FOUND', message: 'Credential not found' } },
        { status: 404 }
      );
    }

    // Validate credential
    const { isValid, validationError } = await validateCredential(id);

    // Update credential with validation result
    const updated = await prisma.apiCredential.update({
      where: { id },
      data: {
        isValid,
        validationError,
        lastValidatedAt: new Date(),
      },
    });

    // IMPORTANT: Never return encryptedKey
    const { encryptedKey: _enc, ...safeCredential } = updated;
    return NextResponse.json({ data: safeCredential });
  } catch (error) {
    console.error('Failed to validate credential:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to validate credential' } },
      { status: 500 }
    );
  }
}
