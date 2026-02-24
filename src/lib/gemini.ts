import { GoogleGenerativeAI } from "@google/generative-ai";

export interface GeminiRuntimeConfig {
  apiKey?: string;
  model?: string;
  geminiApiKey?: string;
  geminiModel?: string;
}

export interface NormalizedGeminiConfig {
  apiKey?: string;
  model?: string;
}

export function normalizeServerConfig(
  config: GeminiRuntimeConfig = {}
): NormalizedGeminiConfig {
  return {
    apiKey: config.apiKey ?? config.geminiApiKey,
    model: config.model ?? config.geminiModel,
  };
}

export function shouldRecreateClient({
  hasClient,
  currentApiKey,
  nextApiKey,
}: {
  hasClient: boolean;
  currentApiKey: string;
  nextApiKey: string;
}): boolean {
  return !hasClient || currentApiKey !== nextApiKey;
}

// Store normalized config globally for server-side usage
let serverConfig: NormalizedGeminiConfig = {};

export function getServerConfig() {
  return serverConfig;
}

export function setServerConfig(config: GeminiRuntimeConfig) {
  serverConfig = normalizeServerConfig(config);
}

function getApiKey(): string {
  // First check server config (for API routes)
  if (serverConfig.apiKey) {
    return serverConfig.apiKey;
  }
  // Then check localStorage (for client)
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("ai-practice-config");
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
  // Fallback to environment variable
  return process.env.GEMINI_API_KEY || "";
}

function getModel(): string {
  // First check server config (for API routes)
  if (serverConfig.model) {
    return serverConfig.model;
  }
  // Then check localStorage (for client)
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("ai-practice-config");
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
  return process.env.GEMINI_MODEL || "gemini-2.0-flash";
}

let genAI: GoogleGenerativeAI | null = null;
let currentModel: string = "";
let currentApiKey: string = "";

function getGenAI(): GoogleGenerativeAI {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("Gemini API key is not configured");
  }
  if (
    shouldRecreateClient({
      hasClient: !!genAI,
      currentApiKey,
      nextApiKey: apiKey,
    })
  ) {
    genAI = new GoogleGenerativeAI(apiKey);
    currentApiKey = apiKey;
  }
  if (!genAI) {
    throw new Error("Gemini client initialization failed");
  }
  return genAI;
}

export function getGeminiModel() {
  const model = getModel();
  if (currentModel !== model || !genAI) {
    genAI = getGenAI();
    currentModel = model;
  }
  return genAI.getGenerativeModel({ model });
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string
): Promise<T> {
  let timeoutId: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
      timeoutMs
    );
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  }) as Promise<T>;
}

function isRetriableGeminiError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /fetch failed|network|timeout|timed out|429|500|502|503|504|ECONNRESET|ETIMEDOUT/i.test(
    message
  );
}

async function runWithRetry<T>(
  operation: () => Promise<T>,
  {
    attempts = 3,
    baseDelayMs = 1200,
    requestTimeoutMs = 60_000,
    label = "Gemini request",
  }: {
    attempts?: number;
    baseDelayMs?: number;
    requestTimeoutMs?: number;
    label?: string;
  } = {}
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await withTimeout(operation(), requestTimeoutMs, label);
    } catch (error) {
      lastError = error;
      const canRetry = attempt < attempts && isRetriableGeminiError(error);
      if (!canRetry) break;

      const backoff = baseDelayMs * Math.pow(2, attempt - 1);
      await wait(backoff);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/**
 * Generate structured JSON output from text prompt.
 */
export async function generateJSON<T>(prompt: string): Promise<T> {
  const model = getGeminiModel();
  const result = await runWithRetry(() =>
    model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
      },
    })
  , { label: "Gemini JSON generation" });
  return JSON.parse(result.response.text());
}

/**
 * Generate structured JSON output from file (PDF/image) + text prompt.
 */
export async function generateFromFile<T>(
  prompt: string,
  fileData: { base64: string; mimeType: string }
): Promise<T> {
  const model = getGeminiModel();
  const result = await runWithRetry(() =>
    model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                data: fileData.base64,
                mimeType: fileData.mimeType,
              },
            },
            { text: prompt },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
      },
    })
  , { label: `Gemini file generation (${fileData.mimeType})` });
  return JSON.parse(result.response.text());
}

/**
 * Generate plain text output with retry for transient failures.
 */
export async function generateText(prompt: string): Promise<string> {
  const model = getGeminiModel();
  const result = await runWithRetry(() =>
    model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    })
  , { label: "Gemini text generation" });
  return result.response.text();
}
