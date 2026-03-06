import type {
  JSONObject,
  LanguageModelV3,
  LanguageModelV3CallOptions,
  LanguageModelV3FinishReason,
  LanguageModelV3GenerateResult,
  LanguageModelV3Prompt,
  LanguageModelV3StreamResult,
  LanguageModelV3Usage,
} from '@ai-sdk/provider';

const DEFAULT_CRS_BASE_URL = 'https://ls.xingchentech.asia/openai';
const DEFAULT_CRS_MODEL = 'gpt-5.4';
const DEFAULT_REASONING_EFFORT = 'xhigh';
const ALLOWED_CRS_DOMAINS = ['ls.xingchentech.asia'];
const VALID_REASONING_EFFORTS = ['low', 'medium', 'high', 'xhigh'] as const;

type ReasoningEffort = (typeof VALID_REASONING_EFFORTS)[number];

export interface CRSConfig {
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  model: string;
  reasoningEffort?: ReasoningEffort;
  disableStorage?: boolean;
}

export interface CRSMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
}

export interface CRSResponsesRequest {
  model: string;
  input: string | CRSMessage[];
  reasoning_effort?: ReasoningEffort;
  store?: boolean;
  temperature?: number;
  max_output_tokens?: number;
  top_p?: number;
  stop?: string[];
}

export interface CRSResponsesUsage {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  input_tokens_details?: {
    cached_tokens?: number;
    cache_read_tokens?: number;
    cache_write_tokens?: number;
    cache_creation_tokens?: number;
  };
  output_tokens_details?: {
    text_tokens?: number;
    reasoning_tokens?: number;
  };
  [key: string]: unknown;
}

export interface CRSResponsesOutput {
  id: string;
  model: string;
  output_text: string;
  finish_reason?: string;
  usage?: CRSResponsesUsage;
  created_at?: string | number;
  status?: string;
}

interface CRSResponsesCallResult {
  data: CRSResponsesOutput;
  body: unknown;
  headers: Record<string, string>;
}

function isReasoningEffort(value: string): value is ReasoningEffort {
  return (VALID_REASONING_EFFORTS as readonly string[]).includes(value);
}

function normalizeReasoningEffort(value: string | undefined): ReasoningEffort {
  if (!value) return DEFAULT_REASONING_EFFORT;
  if (isReasoningEffort(value)) return value;
  return DEFAULT_REASONING_EFFORT;
}

function sanitizeHeaders(headers: Record<string, string | undefined> = {}): Record<string, string> {
  return Object.entries(headers).reduce<Record<string, string>>((acc, [key, value]) => {
    if (typeof value === 'string') {
      acc[key] = value;
    }
    return acc;
  }, {});
}

function headersToRecord(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of headers.entries()) {
    result[key] = value;
  }
  return result;
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function convertPartToText(part: unknown): string {
  if (!part || typeof part !== 'object') return '';

  const partRecord = part as {
    type?: string;
    text?: string;
    data?: unknown;
    mediaType?: string;
    toolName?: string;
    input?: unknown;
    output?: unknown;
    approved?: boolean;
    reason?: string;
  };

  if (partRecord.type === 'text' || partRecord.type === 'reasoning') {
    return typeof partRecord.text === 'string' ? partRecord.text : '';
  }

  if (partRecord.type === 'file') {
    if (partRecord.data instanceof URL) {
      return `[file:${partRecord.mediaType ?? 'unknown'}] ${partRecord.data.toString()}`;
    }
    if (typeof partRecord.data === 'string') {
      return `[file:${partRecord.mediaType ?? 'unknown'}]`;
    }
    if (partRecord.data instanceof Uint8Array) {
      return `[file:${partRecord.mediaType ?? 'unknown'} bytes=${partRecord.data.length}]`;
    }
    return `[file:${partRecord.mediaType ?? 'unknown'}]`;
  }

  if (partRecord.type === 'tool-call') {
    return `[tool-call:${partRecord.toolName ?? 'unknown'}] ${safeStringify(partRecord.input ?? {})}`;
  }

  if (partRecord.type === 'tool-result') {
    return `[tool-result:${partRecord.toolName ?? 'unknown'}] ${safeStringify(partRecord.output ?? {})}`;
  }

  if (partRecord.type === 'tool-approval-response') {
    return `[tool-approval-response:${String(partRecord.approved ?? false)}] ${partRecord.reason ?? ''}`.trim();
  }

  return '';
}

function extractOutputText(rawBody: Record<string, unknown>): string {
  if (typeof rawBody.output_text === 'string') {
    return rawBody.output_text;
  }

  const output = rawBody.output;
  if (!Array.isArray(output)) {
    return '';
  }

  const chunks: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== 'object') continue;
    const itemRecord = item as Record<string, unknown>;

    const directText = itemRecord.text;
    if (typeof directText === 'string') {
      chunks.push(directText);
    }

    const content = itemRecord.content;
    if (Array.isArray(content)) {
      for (const part of content) {
        if (!part || typeof part !== 'object') continue;
        const partRecord = part as Record<string, unknown>;
        if (typeof partRecord.text === 'string') {
          chunks.push(partRecord.text);
        }
      }
    }
  }

  return chunks.join('');
}

function extractFinishReason(rawBody: Record<string, unknown>): string | undefined {
  const direct = rawBody.finish_reason;
  if (typeof direct === 'string') {
    return direct;
  }

  const output = rawBody.output;
  if (Array.isArray(output)) {
    for (const item of output) {
      if (!item || typeof item !== 'object') continue;
      const reason = (item as Record<string, unknown>).finish_reason;
      if (typeof reason === 'string') {
        return reason;
      }
    }
  }

  if (rawBody.status === 'completed') {
    return 'stop';
  }

  return undefined;
}

function toV3Usage(usage?: CRSResponsesUsage): LanguageModelV3Usage {
  const inputTotal = toNumber(usage?.input_tokens);
  const cacheRead = toNumber(
    usage?.input_tokens_details?.cache_read_tokens ?? usage?.input_tokens_details?.cached_tokens
  );
  const cacheWrite = toNumber(
    usage?.input_tokens_details?.cache_write_tokens ?? usage?.input_tokens_details?.cache_creation_tokens
  );
  const noCache =
    inputTotal !== undefined
      ? Math.max(inputTotal - (cacheRead ?? 0), 0)
      : undefined;

  const outputTotal = toNumber(usage?.output_tokens);
  const outputText =
    toNumber(usage?.output_tokens_details?.text_tokens) ?? outputTotal;
  const outputReasoning = toNumber(usage?.output_tokens_details?.reasoning_tokens);

  return {
    inputTokens: {
      total: inputTotal,
      noCache,
      cacheRead,
      cacheWrite,
    },
    outputTokens: {
      total: outputTotal,
      text: outputText,
      reasoning: outputReasoning,
    },
    raw: usage as JSONObject | undefined,
  };
}

function mapFinishReason(rawFinishReason: string | undefined): LanguageModelV3FinishReason {
  const normalized = rawFinishReason?.toLowerCase();

  if (!normalized) {
    return { unified: 'other', raw: undefined };
  }

  if (normalized === 'stop' || normalized === 'completed') {
    return { unified: 'stop', raw: rawFinishReason };
  }
  if (normalized.includes('length') || normalized.includes('max')) {
    return { unified: 'length', raw: rawFinishReason };
  }
  if (normalized.includes('content')) {
    return { unified: 'content-filter', raw: rawFinishReason };
  }
  if (normalized.includes('tool')) {
    return { unified: 'tool-calls', raw: rawFinishReason };
  }
  if (normalized.includes('error') || normalized.includes('fail')) {
    return { unified: 'error', raw: rawFinishReason };
  }

  return { unified: 'other', raw: rawFinishReason };
}

function parseResponseTimestamp(value: string | number | undefined): Date | undefined {
  if (typeof value === 'number') {
    return new Date(value * 1000);
  }
  if (typeof value === 'string') {
    const timestamp = Date.parse(value);
    if (!Number.isNaN(timestamp)) {
      return new Date(timestamp);
    }
  }
  return undefined;
}

function buildResponsesEndpoint(baseUrl: string): string {
  const normalized = baseUrl.replace(/\/+$/, '');
  if (normalized.endsWith('/v1/responses')) {
    return normalized;
  }
  if (normalized.endsWith('/v1')) {
    return `${normalized}/responses`;
  }
  return `${normalized}/v1/responses`;
}

export function getCRSConfig(): CRSConfig | null {
  const enabled = process.env.USE_CRS_PROVIDER === 'true';
  if (!enabled) return null;

  return {
    enabled,
    baseUrl: process.env.CRS_BASE_URL || DEFAULT_CRS_BASE_URL,
    apiKey: process.env.CRS_API_KEY || '',
    model: process.env.CRS_MODEL || DEFAULT_CRS_MODEL,
    reasoningEffort: normalizeReasoningEffort(process.env.CRS_REASONING_EFFORT),
    disableStorage: process.env.CRS_DISABLE_STORAGE === 'true',
  };
}

export function isCRSMode(): boolean {
  return process.env.USE_CRS_PROVIDER === 'true';
}

export function validateCRSUrl(urlStr: string): void {
  let url: URL;

  try {
    url = new URL(urlStr);
  } catch {
    throw new Error(`Invalid CRS URL: ${urlStr}`);
  }

  if (url.protocol !== 'https:') {
    throw new Error(`CRS must use HTTPS, got: ${url.protocol}`);
  }

  if (url.username || url.password) {
    throw new Error('CRS URL must not contain credentials');
  }

  if (url.search || url.hash) {
    throw new Error('CRS URL must not contain query parameters or fragments');
  }

  if (url.port && url.port !== '443') {
    throw new Error(`CRS URL must use standard HTTPS port (443), got: ${url.port}`);
  }

  if (!ALLOWED_CRS_DOMAINS.includes(url.hostname.toLowerCase())) {
    throw new Error(
      `CRS URL not in whitelist. Allowed: ${ALLOWED_CRS_DOMAINS.join(', ')}, got: ${url.hostname}`
    );
  }
}

export async function callCRSResponses(
  config: CRSConfig,
  request: CRSResponsesRequest,
  options: { abortSignal?: AbortSignal; headers?: Record<string, string | undefined> } = {}
): Promise<CRSResponsesCallResult> {
  if (!config.enabled) {
    throw new Error('CRS provider not enabled');
  }
  if (!config.apiKey) {
    throw new Error('CRS enabled but CRS_API_KEY not set');
  }
  if (!config.baseUrl) {
    throw new Error('CRS enabled but CRS_BASE_URL not set');
  }

  validateCRSUrl(config.baseUrl);

  const endpoint = buildResponsesEndpoint(config.baseUrl);
  const response = await fetch(endpoint, {
    method: 'POST',
    signal: options.abortSignal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
      ...sanitizeHeaders(options.headers),
    },
    body: JSON.stringify(request),
  });

  const responseText = await response.text();
  let rawBody: unknown = {};

  if (responseText) {
    try {
      rawBody = JSON.parse(responseText);
    } catch {
      throw new Error(`CRS returned non-JSON response (status ${response.status})`);
    }
  }

  const rawRecord = rawBody && typeof rawBody === 'object' ? (rawBody as Record<string, unknown>) : {};

  if (!response.ok) {
    const error = rawRecord.error;
    const errorMessage =
      typeof error === 'object' && error && 'message' in error
        ? String((error as Record<string, unknown>).message)
        : `HTTP ${response.status}`;

    throw new Error(`CRS API request failed (${response.status}): ${errorMessage}`);
  }

  const data: CRSResponsesOutput = {
    id: typeof rawRecord.id === 'string' ? rawRecord.id : '',
    model: typeof rawRecord.model === 'string' ? rawRecord.model : config.model,
    output_text: extractOutputText(rawRecord),
    finish_reason: extractFinishReason(rawRecord),
    usage: rawRecord.usage as CRSResponsesUsage | undefined,
    created_at:
      typeof rawRecord.created_at === 'number' || typeof rawRecord.created_at === 'string'
        ? rawRecord.created_at
        : undefined,
    status: typeof rawRecord.status === 'string' ? rawRecord.status : undefined,
  };

  return {
    data,
    body: rawBody,
    headers: headersToRecord(response.headers),
  };
}

export function convertPromptToCRSInput(prompt: LanguageModelV3Prompt): string | CRSMessage[] {
  const messages: CRSMessage[] = [];

  for (const message of prompt) {
    if (message.role === 'system') {
      if (message.content.trim()) {
        messages.push({ role: 'system', content: message.content });
      }
      continue;
    }

    const content = message.content
      .map((part) => convertPartToText(part))
      .filter((part) => part.length > 0)
      .join('\n');

    if (!content) continue;
    messages.push({ role: message.role, content });
  }

  if (messages.length === 1 && messages[0]?.role === 'user') {
    return messages[0].content;
  }

  return messages;
}

class CRSLanguageModel implements LanguageModelV3 {
  readonly specificationVersion = 'v3' as const;
  readonly provider = 'crs';
  readonly modelId: string;
  readonly supportedUrls = {};

  constructor(private readonly config: CRSConfig) {
    this.modelId = config.model;
  }

  async doGenerate(options: LanguageModelV3CallOptions): Promise<LanguageModelV3GenerateResult> {
    const request: CRSResponsesRequest = {
      model: this.config.model,
      input: convertPromptToCRSInput(options.prompt),
      reasoning_effort: this.config.reasoningEffort,
      store: this.config.disableStorage === undefined ? undefined : !this.config.disableStorage,
      temperature: options.temperature,
      max_output_tokens: options.maxOutputTokens,
      top_p: options.topP,
      stop: options.stopSequences,
    };

    const { data, body, headers } = await callCRSResponses(this.config, request, {
      abortSignal: options.abortSignal,
      headers: options.headers,
    });

    const text = data.output_text || '';

    return {
      content: text ? [{ type: 'text', text }] : [],
      finishReason: mapFinishReason(data.finish_reason),
      usage: toV3Usage(data.usage),
      request: { body: request },
      response: {
        id: data.id || undefined,
        modelId: data.model || this.modelId,
        timestamp: parseResponseTimestamp(data.created_at),
        headers,
        body,
      },
      warnings: [],
    };
  }

  async doStream(options: LanguageModelV3CallOptions): Promise<LanguageModelV3StreamResult> {
    void options;
    throw new Error('CRS provider does not support streaming in Phase 1');
  }
}

export function createCRSLanguageModel(config: CRSConfig): LanguageModelV3 {
  return new CRSLanguageModel(config);
}
