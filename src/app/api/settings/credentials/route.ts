/**
 * API Routes: /api/settings/credentials
 *
 * GET  - List all active credentials
 * POST - Create new credential
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateCredentialRequest } from '@/lib/settings/validation';
import { validateBaseUrl } from '@/lib/security/ssrf-protection';
import { encryptApiKey, getKeyHint } from '@/lib/crypto';
import { validateCredential } from '@/lib/settings/credential-validation';

export async function GET() {
  try {
    const credentials = await prisma.apiCredential.findMany({
      where: { isActive: true },
      orderBy: [
        { provider: 'asc' },
        { isDefault: 'desc' },
        { createdAt: 'desc' },
      ],
      select: {
        id: true,
        provider: true,
        name: true,
        keyHint: true,
        baseUrl: true,
        model: true,
        isValid: true,
        isDefault: true,
        isActive: true,
        validationError: true,
        lastUsedAt: true,
        lastValidatedAt: true,
        config: true,
        createdAt: true,
        updatedAt: true,
        // NEVER include encryptedKey
      },
    });

    return NextResponse.json({ data: credentials });
  } catch (error) {
    console.error('Failed to fetch credentials:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch credentials' } },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const { valid, errors } = validateCredentialRequest(body);
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

    // Check for duplicate name
    if (name) {
      const existing = await prisma.apiCredential.findFirst({
        where: { provider, name, isActive: true },
      });
      if (existing) {
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

    // Encrypt API key
    const encryptedKey = encryptApiKey(apiKey);
    const keyHint = getKeyHint(apiKey);

    // Transaction: Create + unset other defaults
    const credential = await prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.apiCredential.updateMany({
          where: { provider, isDefault: true, isActive: true },
          data: { isDefault: false },
        });
      }

      return tx.apiCredential.create({
        data: {
          provider,
          name: name || `${provider} ${Date.now()}`,
          encryptedKey,
          keyHint,
          baseUrl,
          model,
          config,
          isDefault: isDefault || false,
          isValid: validate ? false : true, // Will be updated after validation
        },
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
        const { encryptedKey: _enc, ...safeCredential } = updatedCredential;
        return NextResponse.json({ data: safeCredential }, { status: 201 });
      }
    }

    // IMPORTANT: Never return encryptedKey
    const { encryptedKey: _enc2, ...safeCredential } = credential;
    return NextResponse.json({ data: safeCredential }, { status: 201 });
  } catch (error) {
    console.error('Failed to create credential:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to create credential' } },
      { status: 500 }
    );
  }
}
