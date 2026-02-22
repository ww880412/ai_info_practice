import { describe, expect, it, vi } from 'vitest';
import type { ParseResult, ParseStrategy } from './strategy';
import { PdfTextStrategy } from './pdf-text';

describe('PdfTextStrategy', () => {
  it('uses extracted text without invoking fallback', async () => {
    const extractor = vi
      .fn<(buffer: Buffer) => Promise<string>>()
      .mockResolvedValue('Line 1\nLine 2');

    const fallbackExecute = vi.fn<ParseStrategy['execute']>();
    const fallback: ParseStrategy = {
      name: 'fallback',
      canHandle: () => true,
      execute: fallbackExecute,
    };

    const strategy = new PdfTextStrategy({ minTextLength: 1, extractor });
    strategy.setFallback(fallback);

    const result = await strategy.execute({
      type: 'PDF',
      data: Buffer.from('pdf-data'),
      size: 8,
    });

    expect(result.title).toBe('Line 1');
    expect(result.content).toBe('Line 1\nLine 2');
    expect(extractor).toHaveBeenCalledOnce();
    expect(fallbackExecute).not.toHaveBeenCalled();
  });

  it('falls back when text extraction times out', async () => {
    const extractor = vi
      .fn<(buffer: Buffer) => Promise<string>>()
      .mockImplementation(() => new Promise(() => {}));

    const fallbackResult: ParseResult = {
      title: 'Fallback title',
      content: 'Fallback content',
      sourceType: 'PDF',
      strategy: 'fallback',
      processingTime: 1,
    };

    const fallbackExecute = vi.fn<ParseStrategy['execute']>().mockResolvedValue(fallbackResult);
    const fallback: ParseStrategy = {
      name: 'fallback',
      canHandle: () => true,
      execute: fallbackExecute,
    };

    const strategy = new PdfTextStrategy({
      timeoutMs: 20,
      minTextLength: 1,
      extractor,
    });
    strategy.setFallback(fallback);

    const result = await strategy.execute({
      type: 'PDF',
      data: Buffer.from('pdf-data'),
      size: 8,
    });

    expect(fallbackExecute).toHaveBeenCalledOnce();
    expect(result).toEqual(fallbackResult);
  });
});
