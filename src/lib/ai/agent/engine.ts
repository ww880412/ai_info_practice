import type { AgentConfig, ReasoningStep, ReasoningTrace } from "./types";
import type { ParseResult } from "../../parser/index";
import { generateJSON, getGeminiModel } from "../../gemini";
import { prisma } from "../../prisma";

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

export interface AgentProcessOptions {
  onProgress?: (message: string) => Promise<void> | void;
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

function summarizeObservation(value: unknown, limit = 1000): string {
  const serialized = JSON.stringify(value);
  if (!serialized) return "{}";
  if (serialized.length <= limit) return serialized;
  return `${serialized.slice(0, limit)}...`;
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

export class ReActAgent {
  private config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = config;
  }

  async process(
    entryId: string,
    input: ParseResult,
    options: AgentProcessOptions = {}
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
      observation: summarizeObservation(step1),
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
      observation: summarizeObservation(step2),
      reasoning: "执行 Step 2：结合 Step 1 的结构与边界生成最终知识结果。",
      context: {
        stage: "step2",
        inputLength: input.content.length,
        durationMs: Date.now() - step2StartedAt,
      },
    });

    const finalResult = mergeTwoStepResults(step1, step2);

    const trace = await this.saveTrace(entryId, input, steps, finalResult, {
      startTime,
      endTime: new Date().toISOString(),
      iterations: 2,
      toolsUsed: ["llm_step_1", "llm_step_2"],
    });

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
    try {
      const json = await generateJSON<Record<string, unknown>>(prompt);
      const normalized = toObject(json);
      if (!normalized) {
        throw new Error(`Agent ${stage} returned non-object JSON`);
      }
      return normalized;
    } catch (primaryError) {
      const model = getGeminiModel();
      const fallbackResponse = await model.generateContent(prompt);
      const text = fallbackResponse.response.text();
      const parsed = toObject(text);
      if (parsed) return parsed;
      throw primaryError;
    }
  }

  private buildStep1Prompt(input: ParseResult): string {
    const sampledContent = buildContentSnapshot(input.content, STEP1_INPUT_LIMIT);
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

返回严格 JSON（不要 markdown）：
{
  "contentType": "TUTORIAL" | "TOOL_RECOMMENDATION" | "TECH_PRINCIPLE" | "CASE_STUDY" | "OPINION",
  "techDomain": "PROMPT_ENGINEERING" | "AGENT" | "RAG" | "FINE_TUNING" | "DEPLOYMENT" | "OTHER",
  "aiTags": ["string"],
  "summaryStructure": {
    "type": "problem-solution-steps" | "concept-mechanism-flow" | "tool-feature-comparison" | "background-result-insight" | "argument-evidence-condition" | "generic",
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
    const contentSnapshot = buildContentSnapshot(input.content, STEP2_INPUT_LIMIT);
    const step1Json = JSON.stringify(step1, null, 2);

    return `你是知识提取专家，请执行 Step 2：基于 Step 1 的结构规划提取完整结果。

Step 1 结果：
${step1Json}

输入标题：${input.title}
输入来源：${input.sourceType}
原始内容长度：${input.content.length} 字符

信息密度要求：
- 长度 < 5000：core 建议 3-5 条，extended 1-2 条
- 长度 5000-20000：core 建议 5-8 条，extended 2-4 条
- 长度 > 20000：core 建议 8-12 条，extended 4-8 条

内容：
${contentSnapshot}

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
    "type": "problem-solution-steps" | "concept-mechanism-flow" | "tool-feature-comparison" | "background-result-insight" | "argument-evidence-condition" | "generic",
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
