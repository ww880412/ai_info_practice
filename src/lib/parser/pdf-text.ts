/**
 * PDF Text Strategy - extracts text from PDF using pdf-parse
 * Falls back to multimodal approach for scanned/image-based PDFs
 */
import { PDFParse } from 'pdf-parse';
import type { ParseStrategy, ParseInput, ParseResult } from './strategy';
import { SourceType } from '@prisma/client';

export class PdfTextStrategy implements ParseStrategy {
  name = 'PdfTextStrategy';
  fallback?: ParseStrategy;

  setFallback(strategy: ParseStrategy) {
    this.fallback = strategy;
  }

  canHandle(input: ParseInput): boolean {
    return input.type === 'PDF' && input.size < 20 * 1024 * 1024;
  }

  async execute(input: ParseInput): Promise<ParseResult> {
    const start = Date.now();
    const buffer = input.data as Buffer;

    let parser: PDFParse | null = null;

    try {
      parser = new PDFParse({ data: buffer });
      const [textResult, infoResult] = await Promise.all([
        parser.getText(),
        parser.getInfo(),
      ]);

      const title = infoResult?.info?.Title ||
        textResult.text.slice(0, 50).split('\n')[0].trim() ||
        'PDF Document';

      return {
        title,
        content: textResult.text,
        sourceType: 'PDF' as SourceType,
        strategy: this.name,
        processingTime: Date.now() - start,
      };
    } catch (error) {
      if (this.fallback) {
        return this.fallback.execute(input);
      }
      throw error;
    } finally {
      if (parser) {
        await parser.destroy();
      }
    }
  }
}
