/**
 * Vercel AI SDK unified client configuration
 * Replaces @google/generative-ai with @ai-sdk/google
 * Supports CRS and local OpenAI-compatible proxy providers
 */
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';
import { prisma } from '@/lib/prisma';
import { decryptApiKey } from '@/lib/crypto';
import {
  createCRSLanguageModel,
  getCRSConfig,
  isCRSMode,
  type CRSConfig,
} from './providers/crs';

if (process.env.USE_CRS_PROVIDER === 'true' && process.env.USE_LOCAL_PROXY === 'true') {
  throw new Error(
    'Cannot enable both CRS and LocalProxy providers. Set only one of USE_CRS_PROVIDER or USE_LOCAL_PROXY to true.'
  );
}

type ProviderType = 'crs' | 'local-proxy' | 'openai-compatible' | 'gemini';

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

function normalizeProviderType(provider: string | undefined): ProviderType {
  if (provider === 'crs') return 'crs';
  if (provider === 'local-proxy') return 'local-proxy';
  if (provider === 'openai-compatible') return 'openai-compatible';
  return 'gemini';
}

function getCurrentProvider(): ProviderType {
  if (isCRSMode()) return 'crs';
  if (isLocalProxyMode()) return 'local-proxy';
  return 'gemini';
}

function createLocalProxyModel(config: {
  apiKey: string;
  baseUrl: string;
  model: string;
  providerName?: 'local-proxy' | 'openai-compatible';
}): LanguageModel {
  if (!config.apiKey) {
    throw new Error('No API key available for local proxy provider');
  }
  if (!config.baseUrl) {
    throw new Error('No base URL available for local proxy provider');
  }

  validateProxyUrl(config.baseUrl);

  const proxy = createOpenAICompatible({
    name: config.providerName || 'local-proxy',
    baseURL: config.baseUrl,
    apiKey: config.apiKey,
  });
  return proxy.chatModel(config.model);
}

function createCRSModel(config: CRSConfig): LanguageModel {
  if (!config.enabled) {
    throw new Error('CRS provider not enabled');
  }
  if (!config.apiKey) {
    throw new Error('CRS enabled but CRS_API_KEY not set');
  }
  return createCRSLanguageModel(config);
}

function getDefaultCredentialConfig(): NormalizedAIConfig {
  const provider = getCurrentProvider();

  if (provider === 'crs') {
    const crs = getCRSConfig();
    if (!crs) {
      throw new Error('CRS mode enabled but CRS configuration is missing');
    }
    return {
      apiKey: crs.apiKey,
      model: crs.model,
      provider,
      baseUrl: crs.baseUrl,
    };
  }

  if (provider === 'local-proxy') {
    const proxy = getLocalProxyConfig();
    if (!proxy) {
      throw new Error('Local proxy mode enabled but local proxy configuration is missing');
    }
    return {
      apiKey: proxy.apiKey,
      model: proxy.model,
      provider,
      baseUrl: proxy.baseUrl,
    };
  }

  return {
    apiKey: getApiKey(),
    model: getModelName(),
    provider,
  };
}

function getDefaultModelForProvider(provider: ProviderType): string {
  if (provider === 'crs') {
    return process.env.CRS_MODEL || 'gpt-5.3-codex';
  }
  if (provider === 'local-proxy' || provider === 'openai-compatible') {
    return process.env.LOCAL_PROXY_MODEL || 'gemini-3.1-pro-high';
  }
  return getModelName();
}

function buildCRSConfig(config: Pick<NormalizedAIConfig, 'apiKey' | 'model' | 'baseUrl'>): CRSConfig {
  return {
    enabled: true,
    baseUrl: config.baseUrl || process.env.CRS_BASE_URL || 'https://ls.xingchentech.asia/openai',
    apiKey: config.apiKey || process.env.CRS_API_KEY || '',
    model: config.model || process.env.CRS_MODEL || 'gpt-5.3-codex',
    reasoningEffort: (process.env.CRS_REASONING_EFFORT as CRSConfig['reasoningEffort']) || 'xhigh',
  };
}

// ─────────────── AI Client Configuration ───────────────

export interface AIClientConfig {
  apiKey?: string;
  model?: string;
  geminiApiKey?: string;
  geminiModel?: string;
  provider?: ProviderType;
  baseUrl?: string;
}

export interface NormalizedAIConfig {
  apiKey?: string;
  model?: string;
  provider?: ProviderType;
  baseUrl?: string;
}

export function normalizeConfig(config: AIClientConfig = {}): NormalizedAIConfig {
  return {
    apiKey: config.apiKey ?? config.geminiApiKey,
    model: config.model ?? config.geminiModel,
    provider: config.provider,
    baseUrl: config.baseUrl,
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
 * Route order: explicit config -> CRS -> Local Proxy -> Gemini
 *
 * @param configOverride - Optional config to use instead of global state.
 *   Pass this to avoid relying on the global mutable `serverConfig`.
 */
export function getModel(configOverride?: NormalizedAIConfig): LanguageModel {
  // If explicit config is provided, build model from it directly (no global state)
  if (configOverride?.apiKey) {
    const provider = normalizeProviderType(configOverride.provider);

    if (provider === 'crs') {
      return createCRSModel(buildCRSConfig(configOverride));
    }

    if (provider === 'local-proxy' || provider === 'openai-compatible') {
      return createLocalProxyModel({
        apiKey: configOverride.apiKey,
        baseUrl: configOverride.baseUrl || process.env.LOCAL_PROXY_URL || 'http://127.0.0.1:8045/v1',
        model: configOverride.model || getDefaultModelForProvider(provider),
        providerName: provider,
      });
    }

    // Gemini with explicit config
    const google = createGoogleGenerativeAI({ apiKey: configOverride.apiKey });
    return google(configOverride.model || getModelName());
  }

  // Fallback to environment / global state (backward compat)
  if (isCRSMode()) {
    const crsConfig = getCRSConfig();
    if (!crsConfig) {
      throw new Error('CRS mode enabled but CRS configuration is missing');
    }
    return createCRSModel(crsConfig);
  }

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
 */
export function getModelWithConfig(config: AIClientConfig): LanguageModel {
  const normalized = normalizeConfig(config);
  const explicitProvider = normalized.provider ? normalizeProviderType(normalized.provider) : undefined;

  if (explicitProvider === 'crs') {
    return createCRSModel(buildCRSConfig(normalized));
  }

  if (explicitProvider === 'local-proxy' || explicitProvider === 'openai-compatible') {
    return createLocalProxyModel({
      apiKey: normalized.apiKey || process.env.LOCAL_PROXY_KEY || '',
      baseUrl: normalized.baseUrl || process.env.LOCAL_PROXY_URL || 'http://127.0.0.1:8045/v1',
      model: normalized.model || getDefaultModelForProvider(explicitProvider),
      providerName: explicitProvider,
    });
  }

  if (isCRSMode()) {
    const crsConfig = getCRSConfig();
    if (!crsConfig) {
      throw new Error('CRS mode enabled but CRS configuration is missing');
    }
    return createCRSModel(crsConfig);
  }

  if (isLocalProxyMode()) {
    const proxy = getLocalProxyProvider();
    const proxyConfig = getLocalProxyConfig()!;
    return proxy.chatModel(proxyConfig.model);
  }

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
    return getDefaultCredentialConfig();
  }

  const credential = await prisma.apiCredential.findUnique({
    where: { id: credentialId },
  });

  if (!credential || !credential.isValid || !credential.isActive) {
    console.warn(`Credential ${credentialId} not found, invalid, or inactive - falling back to env`);
    return getDefaultCredentialConfig();
  }

  // Update lastUsedAt
  await prisma.apiCredential.update({
    where: { id: credentialId },
    data: { lastUsedAt: new Date() },
  }).catch(() => {});

  const provider = normalizeProviderType(credential.provider);

  return {
    apiKey: decryptApiKey(credential.encryptedKey),
    model: credential.model || getDefaultModelForProvider(provider),
    provider,
    baseUrl: credential.baseUrl || undefined,
  };
}

/**
 * Get model using a credentialId (for Inngest workers)
 */
export async function getModelWithCredential(credentialId: string | null): Promise<LanguageModel> {
  const config = await resolveCredential(credentialId);
  const provider = normalizeProviderType(config.provider);

  if (provider === 'crs') {
    return createCRSModel(buildCRSConfig(config));
  }

  if (provider === 'local-proxy' || provider === 'openai-compatible') {
    return createLocalProxyModel({
      apiKey: config.apiKey || '',
      baseUrl: config.baseUrl || process.env.LOCAL_PROXY_URL || 'http://127.0.0.1:8045/v1',
      model: config.model || getDefaultModelForProvider(provider),
      providerName: provider,
    });
  }

  if (!config.apiKey) {
    throw new Error('No API key available');
  }
  const google = createGoogleGenerativeAI({ apiKey: config.apiKey });
  return google(config.model || 'gemini-2.0-flash');
}

export { getApiKey, getModelName };
