/**
 * Vercel AI SDK unified client configuration
 * Replaces @google/generative-ai with @ai-sdk/google
 * Supports local OpenAI-compatible proxy for cost savings
 */
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';
import { prisma } from '@/lib/prisma';
import { decryptApiKey } from '@/lib/crypto';

// ─────────────── Local Proxy Configuration ───────────────

export interface LocalProxyConfig {
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  model: string;
}

const ALLOWED_PROXY_HOSTS = ['localhost', '127.0.0.1', '::1', 'host.docker.internal'];

function validateProxyUrl(urlStr: string): void {
  const url = new URL(urlStr);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`Invalid proxy protocol: ${url.protocol}`);
  }
  if (!ALLOWED_PROXY_HOSTS.includes(url.hostname)) {
    throw new Error(`Proxy URL must be localhost, got: ${url.hostname}`);
  }
}

export function getLocalProxyConfig(): LocalProxyConfig | null {
  const enabled = process.env.USE_LOCAL_PROXY === 'true';
  if (!enabled) return null;

  const baseUrl = process.env.LOCAL_PROXY_URL || 'http://127.0.0.1:8045/v1';
  const apiKey = process.env.LOCAL_PROXY_KEY || '';
  const model = process.env.LOCAL_PROXY_MODEL || 'gemini-3.1-pro-high';

  return { enabled, baseUrl, apiKey, model };
}

export function isLocalProxyMode(): boolean {
  return process.env.USE_LOCAL_PROXY === 'true';
}

let cachedProxyProvider: ReturnType<typeof createOpenAICompatible> | null = null;
let cachedProxyConfig: string = '';

function getLocalProxyProvider(): ReturnType<typeof createOpenAICompatible> {
  const config = getLocalProxyConfig();

  // H3: fail closed - don't silently fallback
  if (!config || !config.enabled) {
    throw new Error('Local proxy not enabled');
  }
  if (!config.apiKey) {
    throw new Error('Local proxy enabled but LOCAL_PROXY_KEY not set');
  }
  if (!config.baseUrl) {
    throw new Error('Local proxy enabled but LOCAL_PROXY_URL not set');
  }

  // H1: SSRF validation
  validateProxyUrl(config.baseUrl);

  const configKey = `${config.baseUrl}:${config.apiKey}`;
  if (cachedProxyConfig !== configKey || !cachedProxyProvider) {
    cachedProxyProvider = createOpenAICompatible({
      name: 'local-proxy',
      baseURL: config.baseUrl,
      headers: { Authorization: `Bearer ${config.apiKey}` },
    });
    cachedProxyConfig = configKey;
  }
  return cachedProxyProvider;
}

// ─────────────── AI Client Configuration ───────────────

export interface AIClientConfig {
  apiKey?: string;
  model?: string;
  geminiApiKey?: string;
  geminiModel?: string;
}

export interface NormalizedAIConfig {
  apiKey?: string;
  model?: string;
}

export function normalizeConfig(config: AIClientConfig = {}): NormalizedAIConfig {
  return {
    apiKey: config.apiKey ?? config.geminiApiKey,
    model: config.model ?? config.geminiModel,
  };
}

let serverConfig: NormalizedAIConfig = {};

export function getServerConfig(): NormalizedAIConfig {
  return serverConfig;
}

export function setServerConfig(config: AIClientConfig): void {
  serverConfig = normalizeConfig(config);
}

function getApiKey(): string {
  if (serverConfig.apiKey) {
    return serverConfig.apiKey;
  }
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('ai-practice-config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.geminiApiKey) {
          return parsed.geminiApiKey;
        }
      } catch {
        // Ignore
      }
    }
  }
  return process.env.GEMINI_API_KEY || '';
}

function getModelName(): string {
  if (serverConfig.model) {
    return serverConfig.model;
  }
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('ai-practice-config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.geminiModel) {
          return parsed.geminiModel;
        }
      } catch {
        // Ignore
      }
    }
  }
  return process.env.GEMINI_MODEL || 'gemini-2.0-flash';
}

let cachedApiKey: string = '';
let cachedGoogle: ReturnType<typeof createGoogleGenerativeAI> | null = null;

function getGoogleProvider() {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('Gemini API key is not configured');
  }
  if (cachedApiKey !== apiKey || !cachedGoogle) {
    cachedGoogle = createGoogleGenerativeAI({ apiKey });
    cachedApiKey = apiKey;
  }
  return cachedGoogle;
}

/**
 * Get a Vercel AI SDK compatible language model
 * Uses local proxy if enabled, otherwise Gemini
 */
export function getModel(): LanguageModel {
  // Check for local proxy mode first
  if (isLocalProxyMode()) {
    const proxy = getLocalProxyProvider();
    const config = getLocalProxyConfig()!;
    return proxy.chatModel(config.model);
  }

  const google = getGoogleProvider();
  const modelName = getModelName();
  return google(modelName);
}

/**
 * Get model with specific configuration override
 * Note: Local proxy mode takes precedence over config overrides
 */
export function getModelWithConfig(config: AIClientConfig): LanguageModel {
  // Check for local proxy mode first
  if (isLocalProxyMode()) {
    const proxy = getLocalProxyProvider();
    const proxyConfig = getLocalProxyConfig()!;
    return proxy.chatModel(proxyConfig.model);
  }

  const normalized = normalizeConfig(config);
  const apiKey = normalized.apiKey || getApiKey();
  const modelName = normalized.model || getModelName();

  if (!apiKey) {
    throw new Error('Gemini API key is not configured');
  }

  const google = createGoogleGenerativeAI({ apiKey });
  return google(modelName);
}

/**
 * Resolve credential by ID and return decrypted config
 */
export async function resolveCredential(credentialId: string | null): Promise<NormalizedAIConfig> {
  if (!credentialId) {
    return { apiKey: getApiKey(), model: getModelName() };
  }

  const credential = await prisma.apiCredential.findUnique({
    where: { id: credentialId },
  });

  if (!credential || !credential.isValid) {
    console.warn(`Credential ${credentialId} not found or invalid, falling back to env`);
    return { apiKey: getApiKey(), model: getModelName() };
  }

  // Update lastUsedAt
  await prisma.apiCredential.update({
    where: { id: credentialId },
    data: { lastUsedAt: new Date() },
  }).catch(() => {});

  return {
    apiKey: decryptApiKey(credential.encryptedKey),
    model: credential.model || getModelName(),
  };
}

/**
 * Get model using a credentialId (for Inngest workers)
 * Note: Local proxy mode takes precedence
 */
export async function getModelWithCredential(credentialId: string | null): Promise<LanguageModel> {
  // Check for local proxy mode first
  if (isLocalProxyMode()) {
    const proxy = getLocalProxyProvider();
    const proxyConfig = getLocalProxyConfig()!;
    return proxy.chatModel(proxyConfig.model);
  }

  const config = await resolveCredential(credentialId);
  if (!config.apiKey) {
    throw new Error('No API key available');
  }
  const google = createGoogleGenerativeAI({ apiKey: config.apiKey });
  return google(config.model || 'gemini-2.0-flash');
}

export { getApiKey, getModelName };
