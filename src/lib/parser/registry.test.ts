import { describe, expect, it } from 'vitest';
import type { ParseInput, ParseResult, ParseStrategy } from './strategy';
import { ParserRegistry } from './registry';

const input: ParseInput = {
  type: 'PDF',
  data: Buffer.from('pdf'),
  size: 3,
};

const fallbackResult: ParseResult = {
  title: 'fallback-title',
  content: 'fallback-content',
  sourceType: 'PDF',
  strategy: 'fallback',
  processingTime: 0,
};

describe('ParserRegistry timeout behavior', () => {
  it('uses fallback when primary strategy execution times out', async () => {
    const fallback: ParseStrategy = {
      name: 'fallback',
      canHandle: () => true,
      execute: async () => fallbackResult,
    };

    const primary: ParseStrategy = {
      name: 'primary',
      canHandle: () => true,
      execute: async () => new Promise<ParseResult>(() => {}),
      fallback,
    };

    const registry = new ParserRegistry({
      defaultTimeoutMs: 30,
      perTypeTimeoutMs: { PDF: 30 },
    });
    registry.register(primary);

    const result = await registry.parse(input);
    expect(result.strategy).toBe('fallback');
    expect(result.content).toBe('fallback-content');
  });
});
