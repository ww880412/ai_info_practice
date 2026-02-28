/**
 * Vercel AI SDK generation utilities
 * Replacement for gemini.ts generateJSON/generateFromFile/generateText
 */
import { generateObject, generateText as aiGenerateText } from 'ai';
import { z } from 'zod';
import { getModel } from './client';

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetriableError(error: unknown): boolean {
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
  }: {
    attempts?: number;
    baseDelayMs?: number;
  } = {}
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const canRetry = attempt < attempts && isRetriableError(error);
      if (!canRetry) break;

      const backoff = baseDelayMs * Math.pow(2, attempt - 1);
      await wait(backoff);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/**
 * Generate structured JSON output from text prompt.
 * Uses Zod schema for type-safe parsing when provided.
 */
export async function generateJSON<T>(
  prompt: string,
  schema?: z.ZodSchema<T>
): Promise<T> {
  return runWithRetry(async () => {
    const model = getModel();

    if (schema) {
      const { object } = await generateObject({
        model,
        schema,
        prompt,
      });
      return object;
    }

    // Fallback: use text generation with JSON mode
    const { text } = await aiGenerateText({
      model,
      prompt: `${prompt}\n\nRespond with valid JSON only, no markdown or explanations.`,
    });

    // Clean potential markdown code blocks
    let jsonText = text.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    return JSON.parse(jsonText) as T;
  });
}

/**
 * Generate structured JSON output from file (PDF/image) + text prompt.
 */
export async function generateFromFile<T>(
  prompt: string,
  fileData: { base64: string; mimeType: string },
  schema?: z.ZodSchema<T>
): Promise<T> {
  return runWithRetry(async () => {
    const model = getModel();
    const dataUrl = `data:${fileData.mimeType};base64,${fileData.base64}`;

    if (schema) {
      const { object } = await generateObject({
        model,
        schema,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', image: dataUrl },
              { type: 'text', text: prompt },
            ],
          },
        ],
      });
      return object;
    }

    // Fallback: use text generation
    const { text } = await aiGenerateText({
      model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', image: dataUrl },
            { type: 'text', text: `${prompt}\n\nRespond with valid JSON only, no markdown or explanations.` },
          ],
        },
      ],
    });

    // Clean potential markdown code blocks
    let jsonText = text.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    return JSON.parse(jsonText) as T;
  });
}

/**
 * Generate plain text output.
 */
export async function generateText(prompt: string): Promise<string> {
  return runWithRetry(async () => {
    const model = getModel();
    const { text } = await aiGenerateText({
      model,
      prompt,
    });
    return text;
  });
}
