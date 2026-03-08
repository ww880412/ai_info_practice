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
import { evaluateDecisionQuality, type ScoringInput } from './scoring-agent';
import type { NormalizedAgentIngestDecision } from './ingest-contract';

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

【techDomain 判断优先级】
1. 如果内容主要讲神经网络、深度学习、反向传播、梯度下降 → DEEP_LEARNING
2. 如果内容主要讲大语言模型、Transformer、Token、词嵌入 → LLM
3. 如果内容主要讲 Agent 开发、工具调用、多智能体 → AGENT
4. 如果内容主要讲 Prompt 工程、提示词优化 → PROMPT_ENGINEERING
5. 如果内容主要讲 RAG、向量数据库、检索增强 → RAG
6. 如果内容主要讲模型微调、LoRA、PEFT → FINE_TUNING
7. 如果内容主要讲模型部署、推理优化、量化 → DEPLOYMENT
8. 只有在无法归类到以上任何领域时才选择 OTHER

【重要】keyPoints 定义：
- keyPoints.core：核心洞察、关键结论、反直觉发现（3-5条）
- keyPoints.extended：补充细节、技术要点（1-3条）
- ❌ 错误：不要把 steps/流程/定义/方法 放入 keyPoints
- ✅ 正确：提炼出"为什么重要"、"核心发现"、"关键洞察"、"底层原理"

示例对比（增强版）：
❌ 错误：keyPoints.core = ["经验一：开发专属提问工具", "经验二：替换待办清单"]  // 这是方法
✅ 正确：keyPoints.core = ["核心洞察：工具设计必须随模型能力进化", "反直觉：简单工具可能成为绊脚石"]  // 这是洞察

❌ 错误：keyPoints.core = ["神经网络由输入层、隐藏层、输出层组成"]  // 这是定义
✅ 正确：keyPoints.core = ["核心洞察：神经网络的本质是矩阵连乘"]  // 这是洞察

❌ 错误：keyPoints.core = ["步骤1：配置环境", "步骤2：安装依赖"]  // 这是步骤
✅ 正确：keyPoints.core = ["关键发现：环境配置是最大的坑", "核心原则：依赖版本必须锁定"]  // 这是洞察

返回严格 JSON（不要 markdown）：
{
  "contentType": "TUTORIAL" | "TOOL_RECOMMENDATION" | "TECH_PRINCIPLE" | "CASE_STUDY" | "OPINION",
  "techDomain": "PROMPT_ENGINEERING" | "AGENT" | "RAG" | "FINE_TUNING" | "DEPLOYMENT" | "DEEP_LEARNING" | "LLM" | "OTHER",
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

【coreSummary 长度要求】
- 长度 < 10000：100-150字
- 长度 10000-50000：150-200字
- 长度 > 50000：200-250字
- 目标：快速浏览，抓住核心，详细内容放在 summaryStructure.fields

【practiceValue 判断标准】
ACTIONABLE 必须同时满足以下条件：
1. 有完整的操作步骤（step-by-step）
2. 有代码示例或配置文件
3. 读者可以立即动手实践

KNOWLEDGE 包括：
1. 经验分享（即使有步骤结构，但缺少代码示例）
2. 原理科普
3. 案例研究
4. 理论探讨

示例对比：
❌ 错误：四条经验分享（无代码） → ACTIONABLE
✅ 正确：四条经验分享（无代码） → KNOWLEDGE
✅ 正确：带完整代码的 React 教程 → ACTIONABLE
✅ 正确：API 使用指南（有代码示例） → ACTIONABLE

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

    evaluate_quality: tool({
      description: '评估 AI 决策输出的质量（完整性、准确性、相关性、清晰度、可操作性）',
      inputSchema: z.object({
        decision: z.string().describe('AI 决策输出的 JSON 字符串'),
      }),
      execute: async ({ decision }: { decision: string }) => {
        try {
          const parsedDecision = JSON.parse(decision);

          const scoringInput: ScoringInput = {
            decision: parsedDecision as unknown as NormalizedAgentIngestDecision,
            originalContent: {
              title: ctx.input.title || '',
              content: ctx.input.content || '',
              length: ctx.input.content?.length || 0,
            },
          };

          const evaluation = await evaluateDecisionQuality(scoringInput);

          return {
            success: true,
            data: evaluation,
            message: `质量评分完成。总分: ${evaluation.overallScore}/100`,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      },
    }),
  };
}

export function createToolCallingTools(ctx: ToolExecutionContext) {
  const allTools = createSDKTools(ctx);

  return {
    classify_content: allTools.classify_content,
    extract_summary: allTools.extract_summary,
    extract_code: allTools.extract_code,
    extract_version: allTools.extract_version,
  };
}

/**
 * SDK 工具集类型
 */
export type SDKTools = ReturnType<typeof createSDKTools>;
