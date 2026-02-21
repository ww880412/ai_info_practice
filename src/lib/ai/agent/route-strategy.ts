import { z } from 'zod';
import { toolsRegistry } from './tools';
import { DEFAULT_PROCESSING_STRATEGIES, DEFAULT_EVALUATION_DIMENSIONS } from './config';
import { getGeminiModel } from '@/lib/gemini';

toolsRegistry.register({
  name: 'route_to_strategy',
  description: '根据评估结果选择处理策略',
  parameters: z.object({
    evaluations: z.record(z.string(), z.string()),
    content: z.string(),
  }),
  handler: async (params) => {
    const model = getGeminiModel();

    const strategies = DEFAULT_PROCESSING_STRATEGIES.map(s =>
      `${s.type}: ${s.condition}`
    ).join('\n');

    const evaluations = Object.entries(params.evaluations)
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

    const result = await model.generateContent(prompt);

    try {
      const jsonMatch = result.response.text().match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch?.[0] || '{}');
      return { success: true, data: parsed };
    } catch {
      return { success: false, error: 'Failed to parse strategy selection' };
    }
  },
});
