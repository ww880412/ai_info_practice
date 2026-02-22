/**
 * Text Strategy - handles plain text content
 */
import type { ParseStrategy, ParseInput, ParseResult } from './strategy';
import type { SourceType } from "@prisma/client";

export class TextStrategy implements ParseStrategy {
  name = 'TextStrategy';

  canHandle(input: ParseInput): boolean {
    return input.type === 'TEXT';
  }

  async execute(input: ParseInput): Promise<ParseResult> {
    const start = Date.now();
    const content = input.data as string;

    const title = content.slice(0, 50).replace(/[\n\r]/g, ' ').trim() || 'Text Entry';

    return {
      title,
      content,
      sourceType: 'TEXT' as SourceType,
      strategy: this.name,
      processingTime: Date.now() - start,
    };
  }
}
