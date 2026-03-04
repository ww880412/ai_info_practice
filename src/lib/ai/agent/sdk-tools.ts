/**
 * Phase 2a: AI SDK 工具适配层
 * 将现有 builtin-tools 适配为 Vercel AI SDK generateText 的 tools 格式
 */
import { tool } from 'ai';
import { z } from 'zod';
import type { ParseResult } from '../../parser/index';
import type { AgentConfig, EvaluationDimension, ProcessingStrategy } from './types';
import { generateJSON, generateText } from '../generate';
import { findSimilarEntries } from '@/lib/ai/deduplication';
import { selectToolPipeline } from './route-strategy';
import { getContentDepth, getFieldsGuidance } from './content-depth';

/**
 * 工具执行时的共享上下文
 * 用于跨工具传递状态
 */
export interface ToolExecutionContext {
  entryId: string;
  input: ParseResult;
  config: {
    evaluationDimensions: EvaluationDimension[];
    processingStrategies: ProcessingStrategy[];
  };
  shared: {
    evaluations: Record<string, unknown>;
    classification: Record<string, unknown> | null;
    intermediateResults: Record<string, unknown>;
  };
}

/**
 * 创建工具执行上下文
 */
export function createToolExecutionContext(
  entryId: string,
  input: ParseResult,
  config: AgentConfig
): ToolExecutionContext {
  return {
    entryId,
    input,
    config: {
      evaluationDimensions: config.evaluationDimensions,
      processingStrategies: config.processingStrategies,
    },
    shared: {
      evaluations: {},
      classification: null,
      intermediateResults: {},
    },
  };
}

/**
 * 创建 AI SDK 格式的工具集
 * 每个工具通过闭包访问共享的 ToolExecutionContext
 */
export function createSDKTools(ctx: ToolExecutionContext) {
  const getContent = (): string => {
    return ctx.input.content || '';
  };

  return {
    evaluate_dimension: tool({
      description: '评估内容的某个维度（来源可信度、时效性等）',
      inputSchema: z.object({
        dimensionId: z.string().describe('维度 ID'),
      }),
      execute: async ({ dimensionId }: { dimensionId: string }) => {
        const content = getContent();
        const source = ctx.input.sourceType || 'UNKNOWN';

        const dimension = ctx.config.evaluationDimensions.find(d => d.id === dimensionId);
        if (!dimension) {
          return { success: false, error: `Dimension ${dimensionId} not found` };
        }
        if (!content) {
          return { success: false, error: 'No content provided' };
        }

        let prompt = dimension.prompt;
        prompt = prompt.replace('{{source}}', source);
        prompt = prompt.replace('{{content}}', content.slice(0, 2000));

        const evaluation = await generateText(prompt);
        ctx.shared.evaluations[dimensionId] = evaluation;

        return {
          success: true,
          data: {
            dimension: dimensionId,
            dimensionName: dimension.name,
            evaluation,
          },
        };
      },
    }),

    classify_content: tool({
      description: 'Step 1: 对内容进行分类（类型、领域、标签、结构）',
      inputSchema: z.object({
        useFullContent: z.boolean().optional().describe('是否使用完整内容'),
      }),
      execute: async ({ useFullContent }: { useFullContent?: boolean }) => {
        const content = getContent();
        const title = ctx.input.title || '';
        const sourceType = ctx.input.sourceType || 'UNKNOWN';

        if (!content) {
          return { success: false, error: 'No content provided' };
        }

        const sampledContent = useFullContent ? content.slice(0, 50000) : content.slice(0, 12000);
        const dimensions = ctx.config.evaluationDimensions
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
        ctx.shared.classification = classification;

        return { success: true, data: classification };
      },
    }),

    extract_summary: tool({
      description: 'Step 2: 基于分类结果提取详细摘要（如缺少分类会返回错误提示）',
      inputSchema: z.object({}),
      execute: async () => {
        const content = getContent();
        const title = ctx.input.title || '';
        let classification = ctx.shared.classification;

        // M2 修复：如果缺少分类，返回明确错误提示让模型先调用 classify_content
        if (!classification) {
          return {
            success: false,
            error: 'Classification result not found. Please call classify_content first before extract_summary.',
            hint: 'Call classify_content tool first to analyze content structure.'
          };
        }
        if (!content) {
          return { success: false, error: 'No content provided' };
        }

        const sampledContent = content.slice(0, 90000);
        const step1Json = JSON.stringify(classification, null, 2);

        // Phase 2b-2: 计算内容深度并生成 fields 指导
        const depth = getContentDepth(content.length);
        const structureType = (classification?.summaryStructure as { type?: string })?.type;
        const fieldsGuidance = getFieldsGuidance(depth, structureType);

        // Phase 2b-2: 使用 JSON.stringify 防止 prompt 注入
        const safeStep1Json = JSON.stringify(step1Json);

        const prompt = `你是知识提取专家，请执行 Step 2：基于 Step 1 的结构规划提取完整结果。

Step 1 结果：
${safeStep1Json}

输入标题：${title}
原始内容长度：${content.length} 字符

信息密度要求：
- 长度 < 5000：core 建议 3-5 条，extended 1-2 条
- 长度 5000-20000：core 建议 5-8 条，extended 2-4 条
- 长度 > 20000：core 建议 8-12 条，extended 4-8 条

${fieldsGuidance ? `fieldsGuidance:\n${fieldsGuidance}\n` : ''}
内容：
${sampledContent}

输出语言要求：
- 所有自然语言字段默认使用简体中文。
- 允许保留必要专业术语。

返回严格 JSON：
{
  "coreSummary": "string",
  "summaryStructure": {
    "type": "string",
    "fields": {},
    "reasoning": "string"
  },
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
        ctx.shared.intermediateResults.summary = summary;

        return { success: true, data: summary };
      },
    }),

    extract_code: tool({
      description: '从内容中提取代码片段（适用于 TUTORIAL 类型）',
      inputSchema: z.object({}),
      execute: async () => {
        const content = getContent();
        if (!content) {
          return { success: false, error: 'No content provided' };
        }

        const prompt = `从以下内容中提取代码示例。返回 JSON：
{
  "codeExamples": [
    { "language": "string", "code": "string", "description": "string" }
  ]
}

内容：
${content.slice(0, 50000)}`;

        const result = await generateJSON<{ codeExamples: Array<{ language: string; code: string; description: string }> }>(prompt);
        ctx.shared.intermediateResults.codeExamples = result.codeExamples;

        return { success: true, data: result };
      },
    }),

    extract_version: tool({
      description: '提取版本信息（适用于 TOOL_RECOMMENDATION 类型）',
      inputSchema: z.object({}),
      execute: async () => {
        const content = getContent();
        if (!content) {
          return { success: false, error: 'No content provided' };
        }

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
        ctx.shared.intermediateResults.versionInfo = result.versionInfo;
        ctx.shared.intermediateResults.references = result.references;

        return { success: true, data: result };
      },
    }),

    check_duplicate: tool({
      description: '检查内容是否与已有条目重复',
      inputSchema: z.object({
        threshold: z.number().optional().describe('相似度阈值，默认 0.5'),
      }),
      execute: async ({ threshold = 0.5 }: { threshold?: number }) => {
        const content = getContent();
        if (!content) {
          return { success: false, error: 'No content provided' };
        }

        const similarEntries = await findSimilarEntries(content, threshold);
        ctx.shared.intermediateResults.duplicateCheck = {
          hasDuplicates: similarEntries.length > 0,
          similarEntries,
        };

        return {
          success: true,
          data: {
            hasDuplicates: similarEntries.length > 0,
            count: similarEntries.length,
            entries: similarEntries.slice(0, 3),
          },
        };
      },
    }),

    route_to_strategy: tool({
      description: '根据内容类型选择处理策略管道',
      inputSchema: z.object({
        contentType: z.string().describe('内容类型'),
      }),
      execute: async ({ contentType }: { contentType: string }) => {
        const evaluations = ctx.shared.evaluations;
        const pipeline = selectToolPipeline(contentType);

        const strategies = ctx.config.processingStrategies.map(s =>
          `${s.type}: ${s.condition}`
        ).join('\n');

        return {
          success: true,
          data: {
            contentType,
            recommendedPipeline: pipeline,
            availableStrategies: strategies,
            evaluationsSummary: Object.keys(evaluations),
          },
        };
      },
    }),
  };
}

/**
 * SDK 工具集类型
 */
export type SDKTools = ReturnType<typeof createSDKTools>;
