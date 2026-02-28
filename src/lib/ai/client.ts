/**
 * Vercel AI SDK unified client configuration
 * Replaces @google/generative-ai with @ai-sdk/google
 */
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { LanguageModel } from 'ai';

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
 */
export function getModel(): LanguageModel {
  const google = getGoogleProvider();
  const modelName = getModelName();
  return google(modelName);
}

/**
 * Get model with specific configuration override
 */
export function getModelWithConfig(config: AIClientConfig): LanguageModel {
  const normalized = normalizeConfig(config);
  const apiKey = normalized.apiKey || getApiKey();
  const modelName = normalized.model || getModelName();

  if (!apiKey) {
    throw new Error('Gemini API key is not configured');
  }

  const google = createGoogleGenerativeAI({ apiKey });
  return google(modelName);
}

export { getApiKey, getModelName };
