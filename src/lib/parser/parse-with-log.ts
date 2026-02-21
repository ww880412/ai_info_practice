import { parserRegistry } from './index';
import { logParse } from './logger';
import type { ParseInput, ParseResult } from './strategy';

export async function parseWithLogging(
  entryId: string,
  input: ParseInput
): Promise<ParseResult> {
  const start = Date.now();
  const inputSize = input.data instanceof Buffer
    ? input.data.length
    : (input.data as string).length;

  try {
    const result = await parserRegistry.parse(input);

    await logParse({
      entryId,
      strategy: result.strategy,
      inputSize,
      outputSize: result.content.length,
      processingTime: Date.now() - start,
      success: true,
    });

    return result;
  } catch (error) {
    await logParse({
      entryId,
      strategy: 'FAILED',
      inputSize,
      outputSize: 0,
      processingTime: Date.now() - start,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
