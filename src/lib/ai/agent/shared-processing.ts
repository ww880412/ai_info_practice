/**
 * Shared processing utilities used by both:
 * - Inngest process-entry function (src/lib/inngest/functions/process-entry.ts)
 * - AI process API route (src/app/api/ai/process/route.ts)
 *
 * Extracted to eliminate code duplication.
 */
import type { ClassifyAndExtractResult } from "@/lib/ai/classifier";
import type { convertToPractice } from "@/lib/ai/practiceConverter";
import type {
  NormalizedAgentIngestDecision,
  NormalizedPracticeTask,
} from "@/lib/ai/agent/ingest-contract";
import { isLegacyClassifierFallbackEnabled } from "@/lib/ai/fallback-policy";

export function buildDecisionFromClassifier(
  result: ClassifyAndExtractResult
): NormalizedAgentIngestDecision {
  return {
    contentType: result.contentType,
    techDomain: result.techDomain,
    aiTags: result.aiTags,
    coreSummary: result.coreSummary,
    keyPoints: result.keyPoints,
    summaryStructure: {
      type: "generic",
      reasoning: "Fallback from classifier output",
      fields: {
        summary: result.coreSummary,
        keyPoints: result.keyPoints,
      },
    },
    keyPointsNew: {
      core: result.keyPoints,
      extended: [],
    },
    boundaries: {
      applicable: [],
      notApplicable: [],
    },
    confidence: null,
    difficulty: null,
    sourceTrust: null,
    timeliness: null,
    contentForm: null,
    practiceValue: result.practiceValue,
    practiceReason: result.practiceReason,
    practiceTask: null,
  };
}

export function normalizePracticeTaskFromLegacyResult(
  practiceResult: Awaited<ReturnType<typeof convertToPractice>>,
  summaryFallback: string
): NormalizedPracticeTask | null {
  const steps = Array.isArray(practiceResult.steps)
    ? practiceResult.steps
        .filter(
          (step) =>
            step &&
            typeof step.order === "number" &&
            typeof step.title === "string"
        )
        .map((step) => ({
          order: step.order,
          title: step.title,
          description: step.description || "",
        }))
    : [];

  if (steps.length === 0) {
    return null;
  }

  return {
    title: practiceResult.title || "Practice Task",
    summary: practiceResult.summary || summaryFallback,
    difficulty: practiceResult.difficulty || "MEDIUM",
    estimatedTime: practiceResult.estimatedTime || "30-60 min",
    prerequisites: Array.isArray(practiceResult.prerequisites)
      ? practiceResult.prerequisites
      : [],
    steps,
  };
}

export function shouldAllowLegacyClassifierFallback(): boolean {
  return isLegacyClassifierFallbackEnabled(process.env.ALLOW_CLASSIFIER_FALLBACK);
}
