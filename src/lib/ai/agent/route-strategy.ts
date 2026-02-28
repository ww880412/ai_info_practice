import { z } from 'zod';
import { toolsRegistry } from './tools';
import { DEFAULT_PROCESSING_STRATEGIES } from './config';
import { generateJSON } from '../generate';

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asStringRecord(value: unknown): Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => typeof v === 'string')
  ) as Record<string, string>;
}

/**
 * Route to appropriate tool pipeline based on contentType
 * Returns array of tool names to execute in sequence
 */
export function selectToolPipeline(contentType: string): string[] {
  switch (contentType) {
    case 'TUTORIAL':
      return ['classify_content', 'extract_code', 'extract_summary'];
    case 'TOOL_RECOMMENDATION':
      return ['classify_content', 'extract_version', 'extract_summary'];
    default:
      // Default pipeline for other content types
      return ['classify_content', 'extract_summary'];
  }
}

toolsRegistry.register({
  name: 'route_to_strategy',
  description: '根据评估结果选择处理策略',
  parameters: z.object({
    evaluations: z.record(z.string(), z.string()).optional(),
    content: z.string().optional(),
  }),
  handler: async (params, context) => {
    const evaluationsMap = Object.keys(asStringRecord(params.evaluations)).length > 0
      ? asStringRecord(params.evaluations)
      : asStringRecord(context.evaluations);
    const content = asString(params.content) ?? asString(context.input.content) ?? '';
    if (!content) {
      return { success: false, error: 'No content provided for strategy routing' };
    }

    const strategies = DEFAULT_PROCESSING_STRATEGIES.map(s =>
      `${s.type}: ${s.condition}`
    ).join('\n');

    const evaluations = Object.entries(evaluationsMap)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');

    const prompt = `根据以下评估结果，从可用策略中选择最合适的一个。

评估结果：
${evaluations}

可用策略：
${strategies}

返回格式（严格 JSON）：
{
  "strategy": "策略类型",
  "confidence": 0.0-1.0,
  "reason": "选择理由"
}`;

    try {
      const parsed = await generateJSON<{ strategy: string; confidence: number; reason: string }>(prompt);
      return { success: true, data: parsed };
    } catch {
      return { success: false, error: 'Failed to parse strategy selection' };
    }
  },
});
