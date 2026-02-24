/**
 * Parser Registry - Strategy Pattern
 */
import type { ParseStrategy, ParseInput, ParseResult } from './strategy';

interface ParserRegistryOptions {
  defaultTimeoutMs?: number;
  perTypeTimeoutMs?: Partial<Record<ParseInput['type'], number>>;
}

function parsePositiveNumber(
  value: string | undefined,
  fallback: number
): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string
): Promise<T> {
  let timeoutId: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  }) as Promise<T>;
}

export class ParserRegistry {
  private strategies: ParseStrategy[] = [];
  private timeoutByType: Record<ParseInput['type'], number>;

  constructor(options: ParserRegistryOptions = {}) {
    const defaultTimeoutMs = options.defaultTimeoutMs ?? parsePositiveNumber(
      process.env.PARSER_STRATEGY_TIMEOUT_MS,
      60_000
    );
    const fileTimeoutMs = parsePositiveNumber(
      process.env.PARSER_FILE_TIMEOUT_MS,
      600_000
    );

    this.timeoutByType = {
      PDF: options.perTypeTimeoutMs?.PDF ?? fileTimeoutMs,
      IMAGE: options.perTypeTimeoutMs?.IMAGE ?? fileTimeoutMs,
      WEBPAGE: options.perTypeTimeoutMs?.WEBPAGE ?? defaultTimeoutMs,
      TEXT: options.perTypeTimeoutMs?.TEXT ?? defaultTimeoutMs,
    };
  }

  register(strategy: ParseStrategy) {
    this.strategies.push(strategy);
  }

  private async executeWithTimeout(
    strategy: ParseStrategy,
    input: ParseInput
  ): Promise<ParseResult> {
    const timeoutMs = this.timeoutByType[input.type];
    return withTimeout(
      strategy.execute(input),
      timeoutMs,
      `${strategy.name} timed out after ${timeoutMs}ms`
    );
  }

  async parse(input: ParseInput): Promise<ParseResult> {
    for (const strategy of this.strategies) {
      if (strategy.canHandle(input)) {
        const startTime = Date.now();
        try {
          const result = await this.executeWithTimeout(strategy, input);
          return {
            ...result,
            strategy: result.strategy || strategy.name,
            processingTime: Date.now() - startTime,
          };
        } catch (error) {
          if (strategy.fallback) {
            const startTime = Date.now();
            const result = await this.executeWithTimeout(strategy.fallback, input);
            return {
              ...result,
              strategy: result.strategy || strategy.fallback.name,
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
