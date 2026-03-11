/**
 * API Routes: /api/settings/credentials/[id]
 *
 * PUT    - Update credential
 * DELETE - Soft delete credential
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { validateCredentialUpdate } from '@/lib/settings/validation';
import { validateBaseUrl } from '@/lib/security/ssrf-protection';
import { encryptApiKey, getKeyHint } from '@/lib/crypto';
import { validateCredential } from '@/lib/settings/credential-validation';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();

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

    // Validate input
    const { valid, errors } = validateCredentialUpdate(body);
    if (!valid) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_PARAMS',
            message: 'Validation failed',
            details: errors,
          },
        },
        { status: 400 }
      );
    }

    const { provider, name, apiKey, baseUrl, model, config, isDefault, validate } = body;

    // Check for duplicate name (excluding current credential)
    if (name && name !== existing.name) {
      const duplicate = await prisma.apiCredential.findFirst({
        where: {
          provider,
          name,
          isActive: true,
          id: { not: id },
        },
      });
      if (duplicate) {
        return NextResponse.json(
          {
            error: {
              code: 'DUPLICATE_NAME',
              message: 'A credential with this name already exists for this provider',
            },
          },
          { status: 400 }
        );
      }
    }

    // SSRF check
    if (baseUrl) {
      const { valid: urlValid, error: urlError } = validateBaseUrl(provider, baseUrl);
      if (!urlValid) {
        return NextResponse.json(
          { error: { code: 'SSRF_BLOCKED', message: urlError } },
          { status: 400 }
        );
      }
    }

    // Prepare update data
    const updateData: any = {
      provider,
      name,
      baseUrl,
      model,
      config,
      isDefault,
    };

    // Only update API key if provided
    if (apiKey) {
      updateData.encryptedKey = encryptApiKey(apiKey);
      updateData.keyHint = getKeyHint(apiKey);
    }

    // Transaction: Update + unset other defaults
    const credential = await prisma.$transaction(async (tx) => {
      if (isDefault && !existing.isDefault) {
        await tx.apiCredential.updateMany({
          where: { provider, isDefault: true, isActive: true, id: { not: id } },
          data: { isDefault: false },
        });
      }

      return tx.apiCredential.update({
        where: { id },
        data: updateData,
      });
    });

    // Validate if requested
    if (validate) {
      const { isValid: validationResult, validationError } = await validateCredential(credential.id);
      await prisma.apiCredential.update({
        where: { id: credential.id },
        data: {
          isValid: validationResult,
          validationError,
          lastValidatedAt: new Date(),
        },
      });

      // Re-fetch to get updated validation status
      const updatedCredential = await prisma.apiCredential.findUnique({
        where: { id: credential.id },
      });

      if (updatedCredential) {
        const { encryptedKey: _, ...safeCredential } = updatedCredential;
        return NextResponse.json({ data: safeCredential });
      }
    }

    // IMPORTANT: Never return encryptedKey
    const { encryptedKey: _, ...safeCredential } = credential;
    return NextResponse.json({ data: safeCredential });
  } catch (error) {
    console.error('Failed to update credential:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to update credential' } },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

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

    // Prevent deleting default credential
    if (existing.isDefault) {
      return NextResponse.json(
        {
          error: {
            code: 'CANNOT_DELETE_DEFAULT',
            message: 'Cannot delete default credential. Set another credential as default first.',
          },
        },
        { status: 400 }
      );
    }

    // Check if this is the last credential for the provider
    const activeCount = await prisma.apiCredential.count({
      where: { provider: existing.provider, isActive: true },
    });

    if (activeCount <= 1) {
      return NextResponse.json(
        {
          error: {
            code: 'CANNOT_DELETE_LAST',
            message: 'Cannot delete the last credential for this provider',
          },
        },
        { status: 400 }
      );
    }

    // Soft delete: Set isActive = false
    await prisma.apiCredential.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    console.error('Failed to delete credential:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to delete credential' } },
      { status: 500 }
    );
  }
}
