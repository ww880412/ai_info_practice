import { z } from 'zod';
import { toolsRegistry } from './tools';
import type { AgentContext } from './types';
import { generateJSON, generateText } from '../generate';
import { findSimilarEntries } from '@/lib/ai/deduplication';
import { DEFAULT_EVALUATION_DIMENSIONS } from './config';

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function getContent(params: Record<string, unknown>, context: AgentContext): string {
  return asString(params.content) ?? asString(context.input.content) ?? '';
}

// evaluate_dimension tool
toolsRegistry.register({
  name: 'evaluate_dimension',
  description: '评估内容的某个维度',
  parameters: z.object({
    dimensionId: z.string(),
    content: z.string().optional(),
    source: z.string().optional(),
  }),
  handler: async (params, context: AgentContext) => {
    const dimensionId = asString(params.dimensionId);
    if (!dimensionId) {
      return { success: false, error: 'dimensionId is required' };
    }
    const content = getContent(params, context);
    const source = asString(params.source) ?? asString(context.input.sourceType) ?? 'UNKNOWN';

    // 从配置获取维度信息
    const dimension = DEFAULT_EVALUATION_DIMENSIONS.find(d => d.id === dimensionId);

    if (!dimension) {
      return { success: false, error: `Dimension ${dimensionId} not found` };
    }
    if (!content) {
      return { success: false, error: 'No content provided for dimension evaluation' };
    }

    // 构建 prompt
    let prompt = dimension.prompt;
    prompt = prompt.replace('{{source}}', source);
    // 对于 content 类型，需要截断避免超出 token 限制
    const truncatedContent = content.slice(0, 2000);
    prompt = prompt.replace('{{content}}', truncatedContent);

    const evaluation = await generateText(prompt);

    // 保存评估结果
    context.evaluations[dimensionId] = evaluation;

    return {
      success: true,
      data: {
        dimension: dimensionId,
        dimensionName: dimension.name,
        evaluation
      }
    };
  },
});

// classify_content tool
toolsRegistry.register({
  name: 'classify_content',
  description: 'Step 1: Classify content and determine structure type',
  parameters: z.object({
    content: z.string().optional(),
    title: z.string().optional(),
    sourceType: z.string().optional(),
  }),
  handler: async (params, context: AgentContext) => {
    const content = getContent(params, context);
    const title = asString(params.title) ?? asString(context.input.title) ?? '';
    const sourceType = asString(params.sourceType) ?? asString(context.input.sourceType) ?? 'UNKNOWN';

    if (!content) return { success: false, error: 'No content provided for classification' };

    // Build Step 1 prompt (simplified version for tool)
    const sampledContent = content.slice(0, 12000);
    const dimensions = DEFAULT_EVALUATION_DIMENSIONS
      .filter(d => d.enabled)
      .map(d => `- ${d.name}: ${d.description}`)
      .join('\n');

    const prompt = `你是知识结构规划专家，请完成 Step 1：内容分析与结构推理。

输入标题：${title}
输入来源：${sourceType}
输入长度：${content.length} 字符

评估维度：
${dimensions}

内容片段：
${sampledContent}

输出语言要求：
- 所有自然语言字段默认使用简体中文。
- 允许保留必要专业术语（如 RAG、Agent、LLM、API、CLIP、QPS）。

返回严格 JSON（不要 markdown）：
{
  "contentType": "TUTORIAL" | "TOOL_RECOMMENDATION" | "TECH_PRINCIPLE" | "CASE_STUDY" | "OPINION",
  "techDomain": "PROMPT_ENGINEERING" | "AGENT" | "RAG" | "FINE_TUNING" | "DEPLOYMENT" | "OTHER",
  "aiTags": ["string"],
  "summaryStructure": {
    "type": "problem-solution-steps" | "concept-mechanism-flow" | "tool-feature-comparison" | "background-result-insight" | "argument-evidence-condition" | "generic" | "api-reference" | "comparison-matrix" | "timeline-evolution",
    "reasoning": "string",
    "fields": {}
  },
  "keyPoints": {
    "core": ["string"],
    "extended": ["string"]
  },
  "boundaries": {
    "applicable": ["string"],
    "notApplicable": ["string"]
  },
  "confidence": 0.0
}`;

    const classification = await generateJSON<Record<string, unknown>>(prompt);

    // Store in context for next steps
    context.intermediateResults.classification = classification;

    return {
      success: true,
      data: classification
    };
  },
});

// extract_summary tool
toolsRegistry.register({
  name: 'extract_summary',
  description: 'Step 2: Extract detailed summary based on classification',
  parameters: z.object({
    content: z.string().optional(),
    title: z.string().optional(),
  }),
  handler: async (params, context: AgentContext) => {
    const content = getContent(params, context);
    const title = asString(params.title) ?? asString(context.input.title) ?? '';
    const classification = asRecord(context.intermediateResults.classification);

    if (!classification) {
      return { success: false, error: 'Classification result not found. Run classify_content first.' };
    }
    if (!content) return { success: false, error: 'No content provided' };

    const sampledContent = content.slice(0, 90000);
    const step1Json = JSON.stringify(classification, null, 2);

    const prompt = `你是知识提取专家，请执行 Step 2：基于 Step 1 的结构规划提取完整结果。

Step 1 结果：
${step1Json}

输入标题：${title}
原始内容长度：${content.length} 字符

信息密度要求：
- 长度 < 5000：core 建议 3-5 条，extended 1-2 条
- 长度 5000-20000：core 建议 5-8 条，extended 2-4 条
- 长度 > 20000：core 建议 8-12 条，extended 4-8 条

内容：
${sampledContent}

输出语言要求：
- 所有自然语言字段默认使用简体中文。
- 允许保留必要专业术语。

返回严格 JSON：
{
  "coreSummary": "string",
  "practiceValue": "KNOWLEDGE" | "ACTIONABLE",
  "practiceReason": "string",
  "practiceTask": null | {
    "title": "string",
    "summary": "string",
    "difficulty": "EASY" | "MEDIUM" | "HARD",
    "estimatedTime": "string",
    "prerequisites": ["string"],
    "steps": [{ "order": 1, "title": "string", "description": "string" }]
  },
  "difficulty": "EASY" | "MEDIUM" | "HARD",
  "sourceTrust": "HIGH" | "MEDIUM" | "LOW",
  "timeliness": "RECENT" | "OUTDATED" | "CLASSIC",
  "contentForm": "TEXTUAL" | "CODE_HEAVY" | "VISUAL" | "MULTIMODAL"
}`;

    const summary = await generateJSON<Record<string, unknown>>(prompt);

    return {
      success: true,
      data: summary
    };
  },
});

// extract_code tool (for TUTORIAL content)
toolsRegistry.register({
  name: 'extract_code',
  description: 'Extract code examples from tutorial content',
  parameters: z.object({
    content: z.string().optional(),
  }),
  handler: async (params, context: AgentContext) => {
    const content = getContent(params, context);

    if (!content) return { success: false, error: 'No content provided' };

    const prompt = `从以下内容中提取代码示例。返回 JSON：
{
  "codeExamples": [
    { "language": "string", "code": "string", "description": "string" }
  ]
}

内容：
${content.slice(0, 50000)}`;

    const result = await generateJSON<{ codeExamples: Array<{ language: string; code: string; description: string }> }>(prompt);

    context.intermediateResults.codeExamples = result.codeExamples;

    return {
      success: true,
      data: result
    };
  },
});

// extract_version tool (for TOOL_RECOMMENDATION content)
toolsRegistry.register({
  name: 'extract_version',
  description: 'Extract version information from tool recommendation content',
  parameters: z.object({
    content: z.string().optional(),
  }),
  handler: async (params, context: AgentContext) => {
    const content = getContent(params, context);

    if (!content) return { success: false, error: 'No content provided' };

    const prompt = `从以下内容中提取工具版本信息。返回 JSON：
{
  "versionInfo": {
    "tool": "string",
    "version": "string",
    "releaseDate": "string (optional)"
  },
  "references": [
    { "title": "string", "url": "string", "type": "official|blog|paper|repo" }
  ]
}

内容：
${content.slice(0, 30000)}`;

    const result = await generateJSON<{ versionInfo: Record<string, unknown>; references: Array<Record<string, unknown>> }>(prompt);

    context.intermediateResults.versionInfo = result.versionInfo;
    context.intermediateResults.references = result.references;

    return {
      success: true,
      data: result
    };
  },
});

// check_duplicate tool
toolsRegistry.register({
  name: 'check_duplicate',
  description: '检查是否有重复或相似内容',
  parameters: z.object({
    content: z.string().optional(),
    threshold: z.number().optional(),
  }),
  handler: async (params, context: AgentContext) => {
    const content = getContent(params, context);
    const threshold = typeof params.threshold === 'number' ? params.threshold : 0.5;

    if (!content) return { success: false, error: 'No content provided' };

    const similarEntries = await findSimilarEntries(content, threshold);

    context.intermediateResults.duplicateCheck = {
      hasDuplicates: similarEntries.length > 0,
      similarEntries
    };

    return {
      success: true,
      data: {
        hasDuplicates: similarEntries.length > 0,
        count: similarEntries.length,
        entries: similarEntries.slice(0, 3) // Return top 3
      }
    };
  },
});
