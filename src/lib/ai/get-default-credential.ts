/**
 * Get default credential helper
 * Supports deterministic ordering and fallback to .env
 */
import { prisma } from '@/lib/prisma';
import { decryptApiKey } from '@/lib/crypto';
import type { NormalizedAIConfig } from './client';

type ProviderType = 'gemini' | 'crs' | 'openai-compatible';

/**
 * Get the default active credential for a provider
 * Falls back to .env if no credential found
 */
export async function getDefaultCredential(
  provider: ProviderType
): Promise<NormalizedAIConfig> {
  // Find default credential with deterministic ordering
  const credential = await prisma.apiCredential.findFirst({
    where: {
      provider,
      isActive: true,
      isValid: true,
    },
    orderBy: [
      { isDefault: 'desc' },
      { createdAt: 'asc' },
    ],
  });

  if (!credential) {
    // Fallback to .env
    return getEnvFallback(provider);
  }

  return {
    apiKey: decryptApiKey(credential.encryptedKey),
    model: credential.model || getDefaultModelForProvider(provider),
    provider,
    baseUrl: credential.baseUrl || undefined,
  };
}

/**
 * Get fallback configuration from environment variables
 */
function getEnvFallback(provider: ProviderType): NormalizedAIConfig {
  if (provider === 'gemini') {
    return {
      apiKey: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp',
      provider: 'gemini',
    };
  }

  if (provider === 'crs') {
    return {
      apiKey: process.env.CRS_API_KEY,
      model: process.env.CRS_MODEL || 'gpt-5.3-codex',
      provider: 'crs',
      baseUrl: process.env.CRS_BASE_URL || 'https://ls.xingchentech.asia/openai',
    };
  }

  if (provider === 'openai-compatible') {
    return {
      apiKey: process.env.LOCAL_PROXY_KEY || '',
      model: process.env.LOCAL_PROXY_MODEL || 'gemini-3.1-pro-high',
      provider: 'openai-compatible',
      baseUrl: process.env.LOCAL_PROXY_URL || 'http://127.0.0.1:8045/v1',
    };
  }

  throw new Error(`Unsupported provider: ${provider}`);
}

/**
 * Get default model name for a provider
 */
function getDefaultModelForProvider(provider: ProviderType): string {
  if (provider === 'gemini') {
    return process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp';
  }
  if (provider === 'crs') {
    return process.env.CRS_MODEL || 'gpt-5.3-codex';
  }
  if (provider === 'openai-compatible') {
    return process.env.LOCAL_PROXY_MODEL || 'gemini-3.1-pro-high';
  }
  return 'gemini-2.0-flash-exp';
}
