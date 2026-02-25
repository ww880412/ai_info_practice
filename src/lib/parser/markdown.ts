/**
 * Markdown parser - handles .md files
 */
import type { ParseStrategy, ParseInput, ParseResult } from './strategy';
import { SourceType } from '@prisma/client';

export class MarkdownStrategy implements ParseStrategy {
  name = 'MarkdownStrategy';

  canHandle(input: ParseInput): boolean {
    return input.type === 'TEXT' && input.mimeType === 'text/markdown';
  }

  async execute(input: ParseInput): Promise<ParseResult> {
    const start = Date.now();
    const content = input.data as string;

    // Extract title from first heading or first line
    let title = 'Markdown Document';
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('# ')) {
        title = trimmed.substring(2).trim();
        break;
      }
    }

    // If no heading found, use first non-empty line
    if (title === 'Markdown Document') {
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          title = trimmed.substring(0, 100);
          break;
        }
      }
    }

    return {
      title,
      content,
      sourceType: 'TEXT' as SourceType,
      strategy: this.name,
      processingTime: Date.now() - start,
    };
  }
}
