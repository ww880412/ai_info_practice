import { generateJSON } from "../generate";
import {
  evaluateDecisionQuality,
  isDecisionMostlyChinese,
  isDecisionStructurallyComplete,
  normalizeAgentIngestDecision,
  type DecisionQualityReport,
  type NormalizedAgentIngestDecision,
} from "./ingest-contract";

interface DecisionRepairOptions {
  contentLength: number;
  maxEnglishRatio?: number;
  minQualityScore?: number;
}

function parseRatio(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed <= 0 || parsed > 1) return fallback;
  return parsed;
}

export function getMaxDecisionEnglishRatio(): number {
  return parseRatio(process.env.AGENT_MAX_ENGLISH_RATIO, 0.35);
}

export function getMinDecisionQualityScore(): number {
  return parseRatio(process.env.AGENT_MIN_QUALITY_SCORE, 0.72);
}

export async function rewriteDecisionToChinese(
  decision: NormalizedAgentIngestDecision,
  options: DecisionRepairOptions
): Promise<NormalizedAgentIngestDecision | null> {
  const maxEnglishRatio = options.maxEnglishRatio ?? getMaxDecisionEnglishRatio();
  const decisionJson = JSON.stringify(decision, null, 2);

  const rewritten = await generateJSON<Record<string, unknown>>(
    `你是知识内容本地化助手。请将下列 JSON 结果中的自然语言字段改写为简体中文。

约束：
1. 保持 JSON 结构不变，不新增/删除字段。
2. 枚举字段必须保持原值：contentType/techDomain/practiceValue/difficulty/sourceTrust/timeliness/contentForm。
3. 专业术语可以保留英文（例如 RAG、Agent、LLM、API、CLIP、QPS、SFT、RL、vLLM）。
4. 其他自然语言默认输出中文，避免整句英文。
5. 仅返回 JSON，不要 Markdown。

输入 JSON：
${decisionJson}`
  );

  const normalized = normalizeAgentIngestDecision(rewritten, {
    contentLength: options.contentLength,
  });
  if (!normalized) return null;
  if (!isDecisionMostlyChinese(normalized, { maxEnglishRatio })) return null;
  return normalized;
}

export async function rewriteDecisionForQuality(
  decision: NormalizedAgentIngestDecision,
  options: DecisionRepairOptions
): Promise<NormalizedAgentIngestDecision | null> {
  const maxEnglishRatio = options.maxEnglishRatio ?? getMaxDecisionEnglishRatio();
  const qualityReport = evaluateDecisionQuality(decision, {
    contentLength: options.contentLength,
  });
  const decisionJson = JSON.stringify(decision, null, 2);

  const rewritten = await generateJSON<Record<string, unknown>>(
    `你是知识提取质量修复助手。请修复下列 JSON 的结构与信息密度问题，输出更完整的结果。

当前质量问题：
${qualityReport.issues.map((issue, index) => `${index + 1}. ${issue}`).join("\n")}

约束：
1. 保持 JSON 根结构和枚举字段不变，不新增或删除字段。
2. 优先补全 summaryStructure.fields、keyPoints、boundaries、practiceTask（如果 practiceValue=ACTIONABLE）。
3. 输出语言默认简体中文，可保留必要技术术语（RAG/LLM/Agent/API 等）。
4. 仅返回 JSON，不要 markdown。

输入 JSON：
${decisionJson}`
  );

  const normalized = normalizeAgentIngestDecision(rewritten, {
    contentLength: options.contentLength,
  });
  if (!normalized) return null;
  if (!isDecisionMostlyChinese(normalized, { maxEnglishRatio })) return null;
  return normalized;
}

export interface DecisionValidationResult {
  decision: NormalizedAgentIngestDecision;
  qualityReport: DecisionQualityReport;
}

export async function validateAndRepairDecision(
  initialDecision: NormalizedAgentIngestDecision,
  options: DecisionRepairOptions & {
    onProgress?: (message: string) => Promise<void> | void;
  }
): Promise<DecisionValidationResult> {
  const maxEnglishRatio = options.maxEnglishRatio ?? getMaxDecisionEnglishRatio();
  const minQualityScore = options.minQualityScore ?? getMinDecisionQualityScore();
  let candidate = initialDecision;

  if (!isDecisionMostlyChinese(candidate, { maxEnglishRatio })) {
    await options.onProgress?.("AI 输出语言修正中（默认中文）...");
    const rewritten = await rewriteDecisionToChinese(candidate, options);
    if (!rewritten) {
      throw new Error("Agent output language rewrite failed");
    }
    candidate = rewritten;
  }

  if (
    !isDecisionStructurallyComplete(candidate, {
      contentLength: options.contentLength,
      minScore: minQualityScore,
    })
  ) {
    await options.onProgress?.("AI 输出结构修正中（补全要点与边界）...");
    const repaired = await rewriteDecisionForQuality(candidate, options);
    if (!repaired) {
      throw new Error("Agent output structure repair failed");
    }
    candidate = repaired;
  }

  const qualityReport = evaluateDecisionQuality(candidate, {
    contentLength: options.contentLength,
  });
  if (qualityReport.score < minQualityScore) {
    throw new Error(
      `Agent output quality validation failed: ${qualityReport.issues.join("; ")}`
    );
  }

  return {
    decision: candidate,
    qualityReport,
  };
}
