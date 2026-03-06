import type { AgentConfig, ReasoningStep, ReasoningTrace, ReasoningTraceMetadata, ToolCallStats, ToolCallTelemetry, FallbackInfo, IAgentEngine, AgentProcessOptions } from "./types";
import type { ParseResult } from "../../parser/index";
import { generateJSON } from "../generate";
import { generateText as aiGenerateText, Output, stepCountIs } from 'ai';
import { getModel } from '../client';
import { prisma } from "../../prisma";
import { stringifyObservation } from "../../trace/observation";
import { normalizeAgentIngestDecision, type NormalizedAgentIngestDecision } from './ingest-contract';
import { createSDKTools, createToolExecutionContext } from './sdk-tools';
import { DecisionSchema } from './decision-schema';
import { getContentDepth, getFieldsGuidance } from './content-depth';

interface ParsedAction {
  action: string;
  params: Record<string, unknown>;
}

interface ParsedAgentResponse {
  thought: string;
  action: ParsedAction;
  reasoning: string;
  observation: string;
  final: unknown | null;
}

const STEP1_INPUT_LIMIT = 12_000;
const STEP2_INPUT_LIMIT = 90_000;

function parseJSONSafely(raw: string): unknown | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function toObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw) return null;

  const direct = parseJSONSafely(raw);
  if (direct && typeof direct === "object" && !Array.isArray(direct)) {
    return direct as Record<string, unknown>;
  }

  const fencedMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    const parsed = parseJSONSafely(fencedMatch[1].trim());
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  }

  const objectMatch = raw.match(/\{[\s\S]*\}/);
  if (objectMatch?.[0]) {
    const parsed = parseJSONSafely(objectMatch[0]);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  }

  return null;
}

function normalizeStep1Payload(payload: Record<string, unknown>): Record<string, unknown> {
  return {
    contentType: payload.contentType,
    techDomain: payload.techDomain,
    aiTags: payload.aiTags,
    summaryStructure: payload.summaryStructure,
    keyPoints: payload.keyPoints,
    boundaries: payload.boundaries,
    confidence: payload.confidence,
  };
}

function normalizeStep2Payload(payload: Record<string, unknown>): Record<string, unknown> {
  return {
    coreSummary: payload.coreSummary,
    practiceValue: payload.practiceValue,
    practiceReason: payload.practiceReason,
    practiceTask: payload.practiceTask,
    difficulty: payload.difficulty,
    sourceTrust: payload.sourceTrust,
    timeliness: payload.timeliness,
    contentForm: payload.contentForm,
    // Step 2 can also output these fields - preserve them
    summaryStructure: payload.summaryStructure,
    keyPoints: payload.keyPoints,
    boundaries: payload.boundaries,
    confidence: payload.confidence,
    extractedMetadata: payload.extractedMetadata,
  };
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => toNonEmptyString(item))
    .filter((item): item is string => Boolean(item));
}

function ensureObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export function mergeTwoStepResults(
  step1: Record<string, unknown>,
  step2: Record<string, unknown>
): Record<string, unknown> {
  const mergedSummaryStructure =
    step2.summaryStructure ?? step1.summaryStructure ?? {
      type: "generic",
      fields: {},
      reasoning: "",
    };

  const mergedKeyPoints = step2.keyPoints ?? step1.keyPoints ?? { core: [], extended: [] };
  const mergedBoundaries =
    step2.boundaries ?? step1.boundaries ?? { applicable: [], notApplicable: [] };

  return {
    ...step2,
    contentType: step2.contentType ?? step1.contentType,
    techDomain: step2.techDomain ?? step1.techDomain,
    aiTags: Array.from(
      new Set([
        ...toStringArray(step1.aiTags),
        ...toStringArray(step2.aiTags),
      ])
    ),
    summaryStructure: ensureObject(mergedSummaryStructure),
    keyPoints: ensureObject(mergedKeyPoints),
    boundaries: ensureObject(mergedBoundaries),
    confidence: step2.confidence ?? step1.confidence,
  };
}

export function buildContentSnapshot(content: string, limit = STEP2_INPUT_LIMIT): string {
  if (content.length <= limit) return content;

  const sectionLength = Math.floor(limit / 3);
  const head = content.slice(0, sectionLength);
  const middleStart = Math.max(0, Math.floor((content.length - sectionLength) / 2));
  const middle = content.slice(middleStart, middleStart + sectionLength);
  const tail = content.slice(-sectionLength);

  return [
    `[content truncated, original length=${content.length}]`,
    "[Head]",
    head,
    "[Middle]",
    middle,
    "[Tail]",
    tail,
  ].join("\n\n");
}

/**
 * Build semantic snapshot with intelligent content segmentation
 * - Short content (<12K): Pass through entirely
 * - Medium content (12K-50K): Extract first 2 sentences per paragraph, preserve code blocks
 * - Long content (>50K): Take head (65% of limit) + tail (35% of limit) with truncation marker
 */
export function buildSemanticSnapshot(content: string, limit = STEP2_INPUT_LIMIT): string {
  const SHORT_THRESHOLD = 12_000;
  const MEDIUM_THRESHOLD = 50_000;

  // Short content: no truncation
  if (content.length <= SHORT_THRESHOLD) {
    return content;
  }

  // Long content: head + tail strategy (proportional to limit)
  if (content.length > MEDIUM_THRESHOLD) {
    const headSize = Math.floor(limit * 0.65);
    const tailSize = Math.floor(limit * 0.35);
    const head = content.slice(0, headSize);
    const tail = content.slice(-tailSize);

    return [
      head,
      "\n\n[...truncated middle section...]\n\n",
      tail,
    ].join("");
  }

  // Medium content: semantic paragraph extraction
  // Split by double newlines (paragraphs)
  const paragraphs = content.split(/\n\n+/);
  const result: string[] = [];
  let currentLength = 0;

  for (const paragraph of paragraphs) {
    // Check if this is a code block
    const isCodeBlock = paragraph.trim().startsWith("```");

    if (isCodeBlock) {
      // Preserve code blocks intact
      if (currentLength + paragraph.length <= limit) {
        result.push(paragraph);
        currentLength += paragraph.length + 2; // +2 for \n\n
      }
    } else {
      // Extract first 2 sentences from text paragraphs
      const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [paragraph];
      const firstTwo = sentences.slice(0, 2).join(" ");

      if (currentLength + firstTwo.length <= limit) {
        result.push(firstTwo);
        currentLength += firstTwo.length + 2;
      }
    }

    // Stop if we've reached the limit
    if (currentLength >= limit) {
      break;
    }
  }

  return result.join("\n\n");
}

export function parseAgentResponse(response: string): ParsedAgentResponse {
  const thoughtMatch = response.match(/THINK:\s*([\s\S]*?)(?=\n(?:ACTION|REASONING|OBSERVATION|FINAL):|$)/);
  const actionMatch = response.match(/ACTION:\s*([a-zA-Z0-9_]+)\s*([\s\S]*?)(?=\n(?:REASONING|OBSERVATION|FINAL):|$)/);
  const reasoningMatch = response.match(/REASONING:\s*([\s\S]*?)(?=\n(?:OBSERVATION|FINAL):|$)/);
  const observationMatch = response.match(/OBSERVATION:\s*([\s\S]*?)(?=\nFINAL:|$)/);
  const finalMatch = response.match(/FINAL:\s*([\s\S]*)$/);

  let actionParams: Record<string, unknown> = {};
  if (actionMatch?.[2]?.trim()) {
    const parsed = parseJSONSafely(actionMatch[2].trim());
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      actionParams = parsed as Record<string, unknown>;
    }
  }

  let final: unknown | null = null;
  if (finalMatch?.[1]?.trim()) {
    const parsedFinal = parseJSONSafely(finalMatch[1].trim());
    final = parsedFinal ?? finalMatch[1].trim();
  }

  return {
    thought: thoughtMatch?.[1]?.trim() || "",
    action: {
      action: actionMatch?.[1]?.trim() || "",
      params: actionParams,
    },
    reasoning: reasoningMatch?.[1]?.trim() || "",
    observation: observationMatch?.[1]?.trim() || "",
    final,
  };
}

export class ReActAgent implements IAgentEngine {
  private config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = config;
  }

  /**
   * 处理条目并返回决策（新签名）
   * 内部执行推理过程，最终返回标准化的决策结果
   */
  async process(
    entryId: string,
    input: ParseResult,
    options?: AgentProcessOptions
  ): Promise<NormalizedAgentIngestDecision> {
    // 执行原有的推理过程
    const trace = await this.executeReasoning(entryId, input, options);

    // 在方法内部完成标准化转换
    const normalized = normalizeAgentIngestDecision(trace.finalResult, {
      contentLength: input.content.length,
    });

    if (!normalized) {
      throw new Error('Agent output missing required fields');
    }

    return normalized;
  }

  /**
   * Process entry with specific mode (for comparison testing)
   * @param entryId - Entry ID
   * @param input - Parsed content
   * @param mode - Mode to use ('two-step' | 'tool-calling')
   * @returns Normalized decision
   */
  async processWithMode(
    entryId: string,
    input: ParseResult,
    mode: 'two-step' | 'tool-calling'
  ): Promise<NormalizedAgentIngestDecision> {
    // Save original config
    const originalConfig = this.config;

    // Temporarily override config
    this.config = {
      ...originalConfig,
      useToolCalling: mode === 'tool-calling',
    };

    try {
      const trace = await this.executeReasoning(entryId, input);
      const normalized = normalizeAgentIngestDecision(trace.finalResult, {
        contentLength: input.content.length,
      });

      if (!normalized) {
        throw new Error('Agent output missing required fields');
      }

      return normalized;
    } finally {
      // Restore original config
      this.config = originalConfig;
    }
  }

  private async executeReasoning(
    entryId: string,
    input: ParseResult,
    options: AgentProcessOptions = {}
  ): Promise<ReasoningTrace> {
    // Phase 2a: 根据配置选择执行路径
    if (this.config.useToolCalling) {
      return this.executeWithTools(entryId, input, options);
    }
    // 配置关闭工具调用 - 明确原因
    return this.executeTwoStepReasoning(entryId, input, options, 'tool_calling_disabled');
  }

  /**
   * Phase 2a: 使用 AI SDK 工具调用的执行路径
   */
  private async executeWithTools(
    entryId: string,
    input: ParseResult,
    options: AgentProcessOptions = {}
  ): Promise<ReasoningTrace> {
    const startTime = new Date();
    const steps: ReasoningStep[] = [];
    const toolsUsed: string[] = [];
    const toolCallTelemetry: ToolCallTelemetry[] = [];

    await options.onProgress?.("AI 工具调用模式：分析内容...");

    // 创建工具执行上下文，传入运行时配置
    const ctx = createToolExecutionContext(entryId, input, this.config);
    const tools = createSDKTools(ctx);

    const systemPrompt = `你是知识管理助手。分析输入内容并生成结构化决策。

可用工具：
- classify_content: 对内容进行分类
- extract_summary: 提取详细摘要
- extract_code: 提取代码片段（适用于教程）
- extract_version: 提取版本信息（适用于工具推荐）
- check_duplicate: 检查重复内容
- route_to_strategy: 选择处理策略

请先调用 classify_content 分析内容类型，然后根据类型调用相应工具。
最后输出符合 schema 的决策结果。`;

    const userPrompt = `分析以下内容：

标题：${input.title}
来源：${input.sourceType}
长度：${input.content.length} 字符

内容：
${buildSemanticSnapshot(input.content, STEP2_INPUT_LIMIT)}`;

    try {
      const result = await aiGenerateText({
        model: getModel(),
        system: systemPrompt,
        prompt: userPrompt,
        tools,
        toolChoice: 'auto',
        stopWhen: stepCountIs(this.config.maxIterations),
        output: Output.object({
          schema: DecisionSchema,
        }),
      });

      // 从 result.steps 构建 ReasoningStep[] 并收集工具调用遥测
      result.steps.forEach((step, index) => {
        const stepToolCalls = step.toolCalls ?? [];
        const stepToolResults = step.toolResults ?? [];
        const stepToolNames = stepToolCalls.map(tc => tc.toolName);
        toolsUsed.push(...stepToolNames);

        const stepStartTime = Date.now();
        const toolCallDetails: Array<{ toolCallId: string; toolName: string; output: unknown; success: boolean; durationMs: number }> = [];

        const observation = stepToolResults.map(tr => {
          const output = 'result' in tr ? (tr as { result: unknown }).result : undefined;
          const outputObj = output as { success?: boolean } | undefined;
          const success = outputObj?.success !== false;
          const durationMs = Math.floor((Date.now() - stepStartTime) / Math.max(1, stepToolResults.length));

          toolCallTelemetry.push({
            toolCallId: tr.toolCallId,
            toolName: tr.toolName,
            success,
            durationMs,
          });

          toolCallDetails.push({
            toolCallId: tr.toolCallId,
            toolName: tr.toolName,
            output,
            success,
            durationMs,
          });

          return {
            toolCallId: tr.toolCallId,
            toolName: tr.toolName,
            output,
          };
        });

        steps.push({
          step: index + 1,
          timestamp: new Date().toISOString(),
          thought: step.text || '',
          action: stepToolNames[0] || 'reasoning',
          observation: JSON.stringify(observation),
          reasoning: step.text || '',
          context: {
            stepType: stepToolCalls.length > 0 ? 'tool_call' : 'reasoning',
            toolCallCount: stepToolCalls.length,
            toolCalls: toolCallDetails,
            durationMs: toolCallDetails.reduce((sum, tc) => sum + tc.durationMs, 0),
          },
        });
      });

      // 构建工具调用统计
      const toolCallStats = this.buildToolCallStats(toolCallTelemetry);

      // 合并工具调用结果与最终输出
      // Phase 2b-2: 确保 summaryStructure 来自 Step2，fallback 到 Step1
      const finalResult = {
        ...(ctx.shared.classification || {}),
        ...(ctx.shared.intermediateResults.summary || {}),
        ...(result.output || {}),

        // Phase 2b-2: summaryStructure fallback 链 - Step2 → Step1 → 默认值
        summaryStructure: (
          ctx.shared.intermediateResults.summary as { summaryStructure?: unknown }
        )?.summaryStructure
        ?? (result.output as { summaryStructure?: unknown })?.summaryStructure
        ?? (ctx.shared.classification as { summaryStructure?: unknown })?.summaryStructure
        ?? { type: 'generic', fields: {}, reasoning: '' },

        // ⚠️ 保留原有的 extractedMetadata 组装（engine.ts:431）
        extractedMetadata: {
          codeExamples: ctx.shared.intermediateResults.codeExamples,
          versionInfo: ctx.shared.intermediateResults.versionInfo,
          references: ctx.shared.intermediateResults.references,
        },
      };

      const metadata: ReasoningTraceMetadata = {
        startTime: startTime.toISOString(),
        endTime: new Date().toISOString(),
        iterations: steps.length,
        toolsUsed: [...new Set(toolsUsed)],
        schemaVersion: 2,
        executionIntent: 'tool_calling',
        executionMode: 'tool_calling',
        toolCallStats,
      };

      return this.saveTrace(entryId, input, steps, finalResult, metadata);
    } catch (error) {
      // 工具调用失败时回退到两步模式，记录失败信息
      const err = error as Error;
      console.warn('Tool calling failed, falling back to two-step mode:', err.message);

      const partialStats = this.buildToolCallStats(toolCallTelemetry);
      return this.executeTwoStepReasoning(
        entryId,
        input,
        options,
        'fallback_after_tool_error',
        {
          triggered: true,
          fromMode: 'tool_calling',
          reason: 'tool_calling_error',
          errorName: err.name,
          errorMessage: err.message,
        },
        partialStats
      );
    }
  }

  /**
   * 构建工具调用统计
   */
  private buildToolCallStats(telemetry: ToolCallTelemetry[]): ToolCallStats {
    const byTool: ToolCallStats['byTool'] = {};
    let total = 0;
    let success = 0;
    let failed = 0;

    for (const t of telemetry) {
      total++;
      if (t.success) success++;
      else failed++;

      if (!byTool[t.toolName]) {
        byTool[t.toolName] = { total: 0, success: 0, failed: 0, durationMsTotal: 0 };
      }
      byTool[t.toolName].total++;
      if (t.success) byTool[t.toolName].success++;
      else byTool[t.toolName].failed++;
      byTool[t.toolName].durationMsTotal += t.durationMs;
    }

    return { total, success, failed, byTool };
  }

  /**
   * 原有的两步推理执行路径
   */
  private async executeTwoStepReasoning(
    entryId: string,
    input: ParseResult,
    options: AgentProcessOptions = {},
    twoStepReason: 'tool_calling_disabled' | 'fallback_after_tool_error' | 'configured_two_step' = 'configured_two_step',
    fallbackInfo?: FallbackInfo,
    preFallbackToolStats?: ToolCallStats
  ): Promise<ReasoningTrace> {
    const startTime = new Date().toISOString();
    const steps: ReasoningStep[] = [];

    await options.onProgress?.("AI Step 1/2：内容分析与结构推理...");
    const step1StartedAt = Date.now();
    const step1Raw = await this.runStep1(input);
    const step1 = normalizeStep1Payload(step1Raw);
    steps.push({
      step: 1,
      timestamp: new Date().toISOString(),
      thought: toNonEmptyString((step1.summaryStructure as Record<string, unknown> | undefined)?.reasoning) || "完成结构推理",
      action: "ANALYZE_STRUCTURE",
      observation: stringifyObservation(step1),
      reasoning: "执行 Step 1：提取内容类型、结构类型、关键要点与边界。",
      context: {
        stage: "step1",
        inputLength: input.content.length,
        durationMs: Date.now() - step1StartedAt,
      },
    });

    await options.onProgress?.("AI Step 2/2：按结构提取知识...");
    const step2StartedAt = Date.now();
    const step2Raw = await this.runStep2(input, step1);
    const step2 = normalizeStep2Payload(step2Raw);
    steps.push({
      step: 2,
      timestamp: new Date().toISOString(),
      thought: "根据结构完成知识提取",
      action: "EXTRACT_KNOWLEDGE",
      observation: stringifyObservation(step2),
      reasoning: "执行 Step 2：结合 Step 1 的结构与边界生成最终知识结果。",
      context: {
        stage: "step2",
        inputLength: input.content.length,
        durationMs: Date.now() - step2StartedAt,
      },
    });

    const finalResult = mergeTwoStepResults(step1, step2);

    // 构建包含执行意图和回退信息的 metadata
    const metadata: ReasoningTraceMetadata = {
      startTime,
      endTime: new Date().toISOString(),
      iterations: 2,
      toolsUsed: ["llm_step_1", "llm_step_2"],
      schemaVersion: 2,
      executionIntent: twoStepReason === 'fallback_after_tool_error' ? 'tool_calling' : 'two_step',
      executionMode: 'two_step',
      twoStepReason,
      fallback: fallbackInfo || { triggered: false },
      toolCallStats: preFallbackToolStats,
    };

    const trace = await this.saveTrace(entryId, input, steps, finalResult, metadata);

    return trace;
  }

  private async runStep1(input: ParseResult): Promise<Record<string, unknown>> {
    const prompt = this.buildStep1Prompt(input);
    return this.generateStructuredObject(prompt, "step-1");
  }

  private async runStep2(
    input: ParseResult,
    step1: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const prompt = this.buildStep2Prompt(input, step1);
    return this.generateStructuredObject(prompt, "step-2");
  }

  private async generateStructuredObject(
    prompt: string,
    stage: "step-1" | "step-2"
  ): Promise<Record<string, unknown>> {
    const json = await generateJSON<Record<string, unknown>>(prompt);
    const normalized = toObject(json);
    if (!normalized) {
      throw new Error(`Agent ${stage} returned non-object JSON`);
    }
    return normalized;
  }

  private buildStep1Prompt(input: ParseResult): string {
    const sampledContent = buildSemanticSnapshot(input.content, STEP1_INPUT_LIMIT);
    const enabledDimensions = this.config.evaluationDimensions
      .filter((dimension) => dimension.enabled)
      .map((dimension) => `- ${dimension.name}: ${dimension.description}`)
      .join("\n");
    const strategyHints = this.config.processingStrategies
      .map((strategy) => `- ${strategy.type}: ${strategy.condition}`)
      .join("\n");

    return `你是知识结构规划专家，请先完成 Step 1：内容分析与结构推理。

输入标题：${input.title}
输入来源：${input.sourceType}
输入长度：${input.content.length} 字符

评估维度：
${enabledDimensions}

策略提示：
${strategyHints}

内容片段：
${sampledContent}

输出语言要求：
- 所有自然语言字段默认使用简体中文。
- 允许保留必要专业术语（如 RAG、Agent、LLM、API、CLIP、QPS）。
- 不要输出整句英文描述。

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
  }

  private buildStep2Prompt(
    input: ParseResult,
    step1: Record<string, unknown>
  ): string {
    const contentSnapshot = buildSemanticSnapshot(input.content, STEP2_INPUT_LIMIT);
    const step1Json = JSON.stringify(step1, null, 2);
    const contentType = step1.contentType as string | undefined;

    // Build differentiated extraction instructions based on contentType
    let extractionHints = "";
    if (contentType === "TUTORIAL") {
      extractionHints = `
特别提取要求（TUTORIAL）：
- extractedMetadata.codeExamples: 提取代码示例（language, code, description）
- extractedMetadata.references: 提取参考链接（官方文档、相关博客等）`;
    } else if (contentType === "TOOL_RECOMMENDATION") {
      extractionHints = `
特别提取要求（TOOL_RECOMMENDATION）：
- extractedMetadata.versionInfo: 提取工具版本信息（tool, version, releaseDate）
- extractedMetadata.references: 提取官方链接和相关资源`;
    } else if (contentType === "TECH_PRINCIPLE") {
      extractionHints = `
特别提取要求（TECH_PRINCIPLE）：
- extractedMetadata.references: 提取论文、权威来源链接`;
    } else if (contentType === "CASE_STUDY") {
      extractionHints = `
特别提取要求（CASE_STUDY）：
- extractedMetadata.author: 提取作者或团队信息
- extractedMetadata.references: 提取相关案例链接`;
    } else if (contentType === "OPINION") {
      extractionHints = `
特别提取要求（OPINION）：
- extractedMetadata.author: 提取作者信息
- extractedMetadata.publishDate: 提取发布日期`;
    }

    // Phase 2b-1: 动态输出深度 - 注入 fieldsGuidance
    const depth = getContentDepth(input.content?.length ?? 0);
    const step1Type = (step1.summaryStructure as Record<string, unknown> | undefined)?.type as string | undefined;
    const fieldsGuidance = getFieldsGuidance(depth, step1Type);

    return `你是知识提取专家，请执行 Step 2：基于 Step 1 的结构规划提取完整结果。

Step 1 结果：
${step1Json}

输入标题：${input.title}
输入来源：${input.sourceType}
原始内容长度：${input.content.length} 字符
${extractionHints}
${fieldsGuidance}

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

内容：
${contentSnapshot}

输出语言要求：
- 所有自然语言字段默认使用简体中文。
- 允许保留必要专业术语（如 RAG、Agent、LLM、API、CLIP、QPS）。
- 不要输出整句英文描述。

summaryStructure.type 选择指南：
- "api-reference": API 文档、SDK 参考、函数/方法文档
- "comparison-matrix": 工具对比、框架比较、技术评估
- "timeline-evolution": 版本历史、技术演进、发布说明

返回严格 JSON（不要 markdown）：
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
    "steps": [
      { "order": 1, "title": "string", "description": "string" }
    ]
  },
  "difficulty": "EASY" | "MEDIUM" | "HARD",
  "sourceTrust": "HIGH" | "MEDIUM" | "LOW",
  "timeliness": "RECENT" | "OUTDATED" | "CLASSIC",
  "contentForm": "TEXTUAL" | "CODE_HEAVY" | "VISUAL" | "MULTIMODAL",
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
  "confidence": 0.0,
  "extractedMetadata": {
    "author": "string (optional)",
    "publishDate": "string (optional)",
    "sourceUrl": "string (optional)",
    "codeExamples": [{ "language": "string", "code": "string", "description": "string" }] (optional),
    "references": [{ "title": "string", "url": "string", "type": "official|blog|paper|repo" }] (optional),
    "versionInfo": { "tool": "string", "version": "string", "releaseDate": "string (optional)" } (optional)
  }
}`;
  }

  private async saveTrace(
    entryId: string,
    input: ParseResult,
    steps: ReasoningStep[],
    finalResult: unknown,
    metadata: ReasoningTrace["metadata"]
  ): Promise<ReasoningTrace> {
    await prisma.reasoningTrace.create({
      data: {
        entryId,
        steps: JSON.stringify(steps),
        finalResult: JSON.stringify(finalResult),
        metadata: JSON.stringify(metadata),
      },
    });

    return {
      entryId,
      input,
      steps,
      finalResult,
      metadata,
    };
  }
}
