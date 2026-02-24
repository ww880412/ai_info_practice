import Tesseract from 'tesseract.js';
import type { ParseStrategy, ParseInput, ParseResult } from './strategy';
import { SourceType } from '@prisma/client';

export class OcrStrategy implements ParseStrategy {
  name = 'OcrStrategy';
  fallback?: ParseStrategy;

  setFallback(strategy: ParseStrategy) {
    this.fallback = strategy;
  }

  canHandle(input: ParseInput): boolean {
    return input.type === 'IMAGE' &&
           !!input.mimeType?.startsWith('image/') &&
           input.size < 10 * 1024 * 1024; // 10MB 以下用 OCR
  }

  async execute(input: ParseInput): Promise<ParseResult> {
    const start = Date.now();
    const buffer = input.data as Buffer;

    try {
      const { data: { text } } = await Tesseract.recognize(
        buffer,
        'chi_sim+eng',
        { logger: () => {} }
      );

      if (!text || text.trim().length < 10) {
        throw new Error('OCR returned insufficient text');
      }

      return {
        title: 'OCR Document',
        content: text,
        sourceType: 'TEXT' as SourceType,
        strategy: this.name,
        processingTime: Date.now() - start,
      };
    } catch (error) {
      if (this.fallback) {
        return this.fallback.execute(input);
      }
      throw error;
    }
  }
}
