/**
 * Credential Validation Logic
 *
 * Tests credentials against their respective provider APIs
 * with timeout enforcement and error handling
 */

import { decryptApiKey } from './encryption';
import prisma from '@/lib/prisma';

const VALIDATION_TIMEOUT = 5000; // 5 seconds

export interface CredentialValidationResult {
  isValid: boolean;
  validationError: string | null;
}

export async function validateCredential(credentialId: string): Promise<CredentialValidationResult> {
  const credential = await prisma.apiCredential.findUnique({
    where: { id: credentialId },
  });

  if (!credential) {
    throw new Error('Credential not found');
  }

  const apiKey = decryptApiKey(credential.encryptedKey);

  try {
    if (credential.provider === 'gemini') {
      await validateGeminiCredential(apiKey);
    } else if (credential.provider === 'crs') {
      await validateCrsCredential(apiKey, credential.baseUrl);
    } else if (credential.provider === 'openai-compatible') {
      await validateOpenAICompatibleCredential(apiKey, credential.baseUrl);
    } else {
      throw new Error(`Unknown provider: ${credential.provider}`);
    }

    return { isValid: true, validationError: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { isValid: false, validationError: message };
  }
}

async function validateGeminiCredential(apiKey: string): Promise<void> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), VALIDATION_TIMEOUT);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      { signal: controller.signal }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  } finally {
    clearTimeout(timeoutId);
  }
}

async function validateCrsCredential(apiKey: string, baseUrl: string | null): Promise<void> {
  const url = baseUrl || process.env.CRS_BASE_URL || 'https://api.crs.example.com';
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), VALIDATION_TIMEOUT);

  try {
    const response = await fetch(`${url}/health`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  } finally {
    clearTimeout(timeoutId);
  }
}

async function validateOpenAICompatibleCredential(apiKey: string, baseUrl: string | null): Promise<void> {
  const url = baseUrl || 'http://localhost:8080';
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), VALIDATION_TIMEOUT);

  try {
    const response = await fetch(`${url}/v1/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  } finally {
    clearTimeout(timeoutId);
  }
}
