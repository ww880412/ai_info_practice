import type { NormalizedAgentIngestDecision } from './ingest-contract';
import { z } from 'zod';

// Quality evaluation output schema
export const QualityEvaluationSchema = z.object({
  overallScore: z.number().min(0).max(100),
  dimensions: z.object({
    completeness: z.number().min(0).max(100),
    accuracy: z.number().min(0).max(100),
    relevance: z.number().min(0).max(100),
    clarity: z.number().min(0).max(100),
    actionability: z.number().min(0).max(100).nullable(),
  }),
  issues: z.array(z.string()).max(20),
  suggestions: z.array(z.string()).max(20),
  reasoning: z.string().min(100).max(2000),
});

export type QualityEvaluation = z.infer<typeof QualityEvaluationSchema>;

// Scoring input interface
export interface ScoringInput {
  decision: NormalizedAgentIngestDecision;
  originalContent: {
    title: string;
    content: string;
    length: number;
  };
}

/**
 * Evaluate the quality of an AI decision output
 * @param input - Decision and original content
 * @returns Quality evaluation with scores and feedback
 */
export async function evaluateDecisionQuality(
  input: ScoringInput
): Promise<QualityEvaluation> {
  const { decision, originalContent } = input;

  // Build scoring prompt
  const prompt = buildScoringPrompt(decision, originalContent);

  // Use text generation instead of generateJSON to avoid CRS markdown wrapping issues
  const { generateText } = await import('@/lib/ai/generate');
  const text = await generateText(prompt);

  // Clean potential markdown code blocks (more aggressive)
  let jsonText = text.trim();

  // Remove markdown code blocks
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?\s*```\s*$/, '');
  }

  // Remove any leading/trailing whitespace again
  jsonText = jsonText.trim();

  // Parse and validate
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    console.error('[evaluateDecisionQuality] JSON parse failed. Text:', jsonText.substring(0, 200));
    throw new Error(`Failed to parse AI response as JSON: ${error instanceof Error ? error.message : String(error)}`);
  }

  const result = QualityEvaluationSchema.parse(parsed);

  return result;
}

/**
 * Build the scoring prompt for AI evaluation
 */
function buildScoringPrompt(
  decision: NormalizedAgentIngestDecision,
  originalContent: { title: string; content: string; length: number }
): string {
  const isPracticeActionable = decision.practiceValue === 'ACTIONABLE';

  return `你是 AI 知识提取质量评估专家。请对以下 AI 决策进行多维度评分。

## 原始内容

**标题**: ${JSON.stringify(originalContent.title)}

**内容长度**: ${originalContent.length} 字符

**内容摘要**（前 3000 字符）:
${JSON.stringify(originalContent.content.slice(0, 3000))}

---

## AI 决策输出

\`\`\`json
${JSON.stringify(decision, null, 2)}
\`\`\`

---

## 评分维度

### 1. 完整性 (Completeness) - 0-100 分
评估是否提取了所有关键信息：
- coreSummary 是否覆盖核心要点（30%）
- keyPointsNew.core 核心洞察是否完整（25%）
- summaryStructure.fields 结构化字段是否齐全（25%）
- boundaries 适用边界是否明确（10%）
- extractedMetadata 元数据是否提取（10%）

### 2. 准确性 (Accuracy) - 0-100 分
评估提取信息与原文的一致性：
- 事实准确：无捏造、无曲解（40%）
- 分类准确：contentType/techDomain 是否正确（30%）
- 标签准确：aiTags 是否贴切（20%）
- 难度评估：difficulty/timeliness 是否合理（10%）

### 3. 相关性 (Relevance) - 0-100 分
评估提取信息的相关性：
- 核心相关：coreSummary 是否聚焦核心（40%）
- 去冗余：keyPointsNew 是否去除重复和无关信息（30%）
- 结构匹配：summaryStructure.type 是否匹配内容特征（30%）

### 4. 清晰度 (Clarity) - 0-100 分
评估表述的清晰性：
- 语言质量：中文表达是否流畅（30%）
- 逻辑清晰：summaryStructure.fields 是否逻辑连贯（30%）
- 术语规范：技术术语使用是否准确（20%）
- 可读性：keyPointsNew 是否简洁明了（20%）

${isPracticeActionable ? `
### 5. 可操作性 (Actionability) - 0-100 分
评估实践任务的可执行性：
- 判断准确：practiceValue 判断是否正确（20%）
- 步骤完整：practiceTask.steps 是否完整可执行（40%）
- 难度合理：difficulty/estimatedTime 是否匹配（20%）
- 代码示例：是否提供必要的代码示例（20%）
` : `
### 5. 可操作性 (Actionability)
此内容为 KNOWLEDGE 类型，不评估可操作性，返回 null。
`}

---

## 输出要求

返回 JSON 格式的评分结果：

\`\`\`json
{
  "overallScore": 85,
  "dimensions": {
    "completeness": 90,
    "accuracy": 85,
    "relevance": 88,
    "clarity": 82,
    "actionability": ${isPracticeActionable ? '80' : 'null'}
  },
  "issues": [
    "coreSummary 过于简略，未提及核心概念 X",
    "keyPointsNew.core 第 3 条与原文不符",
    "summaryStructure 缺少 'mechanism' 字段"
  ],
  "suggestions": [
    "补充核心概念 X 的定义",
    "修正 keyPointsNew.core 第 3 条",
    "增加 mechanism 字段说明工作原理"
  ],
  "reasoning": "整体质量良好。完整性方面，coreSummary 覆盖了主要内容，但对核心概念 X 的描述不够深入。准确性方面，大部分信息与原文一致，但 keyPointsNew.core 第 3 条存在偏差。相关性和清晰度表现优秀。建议补充核心概念定义，修正不准确的关键点。"
}
\`\`\`

**评分原则**：
- 严格对照原文，不要过于宽容
- issues 和 suggestions 要具体，指出字段名和问题位置
- reasoning 要简洁，100-1000 字，重点说明总体评价和主要问题
- 总分计算：${isPracticeActionable
    ? 'completeness * 0.25 + accuracy * 0.25 + relevance * 0.2 + clarity * 0.15 + actionability * 0.15'
    : 'completeness * 0.3 + accuracy * 0.3 + relevance * 0.25 + clarity * 0.15'
  }

**重要**：请直接返回 JSON 对象，不要使用 markdown 代码块包裹。`;
}
