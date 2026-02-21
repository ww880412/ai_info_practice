/**
 * Parser Registry - Strategy Pattern
 */
import type { ParseStrategy, ParseInput, ParseResult } from './strategy';

export class ParserRegistry {
  private strategies: ParseStrategy[] = [];

  register(strategy: ParseStrategy) {
    this.strategies.push(strategy);
  }

  async parse(input: ParseInput): Promise<ParseResult> {
    for (const strategy of this.strategies) {
      if (strategy.canHandle(input)) {
        const startTime = Date.now();
        try {
          const result = await strategy.execute(input);
          return {
            ...result,
            strategy: strategy.name,
            processingTime: Date.now() - startTime,
          };
        } catch (error) {
          if (strategy.fallback) {
            const startTime = Date.now();
            const result = await strategy.fallback.execute(input);
            return {
              ...result,
              strategy: strategy.fallback.name,
              processingTime: Date.now() - startTime,
            };
          }
          throw error;
        }
      }
    }
    throw new Error('No strategy can handle this input');
  }
}

export const parserRegistry = new ParserRegistry();
