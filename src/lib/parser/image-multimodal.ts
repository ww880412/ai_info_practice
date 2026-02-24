import { generateFromFile } from '../gemini';
import { PROMPTS } from '../ai/prompts';
import type { ParseStrategy, ParseInput, ParseResult } from './strategy';
import { SourceType } from '@prisma/client';

export class ImageMultimodalStrategy implements ParseStrategy {
  name = 'ImageMultimodalStrategy';

  canHandle(input: ParseInput): boolean {
    return input.type === 'IMAGE';
  }

  async execute(input: ParseInput): Promise<ParseResult> {
    const start = Date.now();
    const buffer = input.data as Buffer;
    const base64 = buffer.toString('base64');

    const result = await generateFromFile<{ title: string; content: string }>(
      PROMPTS.extractFromFile(),
      { base64, mimeType: input.mimeType || 'image/png' }
    );

    return {
      title: result.title || 'Image',
      content: result.content,
      sourceType: 'TEXT' as SourceType,
      strategy: this.name,
      processingTime: Date.now() - start,
    };
  }
}
