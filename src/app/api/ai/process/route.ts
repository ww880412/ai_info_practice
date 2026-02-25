import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { classifyAndExtract, type ClassifyAndExtractResult } from "@/lib/ai/classifier";
import { convertToPractice } from "@/lib/ai/practiceConverter";
import { ReActAgent } from "@/lib/ai/agent";
import { getAgentConfig } from "@/lib/ai/agent/get-config";
import {
  normalizeAgentIngestDecision,
  type NormalizedAgentIngestDecision,
  type NormalizedPracticeTask,
} from "@/lib/ai/agent/ingest-contract";
import {
  getMaxDecisionEnglishRatio,
  getMinDecisionQualityScore,
  validateAndRepairDecision,
} from "@/lib/ai/agent/decision-repair";
import { isDynamicSummaryEnabled } from "@/config/flags";
import { buildConfidenceScore } from "@/lib/ai/agent/confidence";
import { isLegacyClassifierFallbackEnabled } from "@/lib/ai/fallback-policy";
import {
  isRetriableAgentError,
  runWithProgressRetry,
} from "@/lib/ingest/retry";
import type { ParseResult } from "@/lib/parser";
import type { Prisma, ProcessStatus } from "@prisma/client";
import {
  SummaryStructureSchema,
  KeyPointsSchema,
  BoundariesSchema,
} from "@/lib/ai/agent/schemas";

function shouldAllowLegacyClassifierFallback(): boolean {
  return isLegacyClassifierFallbackEnabled(process.env.ALLOW_CLASSIFIER_FALLBACK);
}

function buildDecisionFromClassifier(
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

function normalizePracticeTaskFromLegacyResult(
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

async function updateProcessStatus(
  entryId: string,
  processStatus: ProcessStatus,
  message?: string | null
) {
  await prisma.entry.update({
    where: { id: entryId },
    data: {
      processStatus,
      processError: message ?? null,
    },
  });
}

/**
 * POST /api/ai/process - Re-run AI processing with ReAct + quality/language gates.
 */
export async function POST(request: NextRequest) {
  let entryId: string | null = null;

  try {
    const payload = await request.json();
    entryId =
      payload && typeof payload.entryId === "string"
        ? payload.entryId
        : null;

    if (!entryId) {
      return NextResponse.json({ error: "entryId is required" }, { status: 400 });
    }

    const targetEntryId = entryId;

    const entry = await prisma.entry.findUnique({
      where: { id: targetEntryId },
      include: { practiceTask: true },
    });

    if (!entry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    const content = entry.originalContent || entry.rawText || "";
    if (!content) {
      return NextResponse.json(
        { error: "No content available for processing" },
        { status: 400 }
      );
    }

    await updateProcessStatus(
      targetEntryId,
      "AI_PROCESSING",
      "正在进行 AI 重处理..."
    );

    if (entry.practiceTask) {
      await prisma.practiceTask.delete({
        where: { id: entry.practiceTask.id },
      }).catch(() => {});
    }

    const parseInput: ParseResult = {
      title: entry.title || "",
      content,
      sourceType: entry.sourceType,
    };

    let decision: NormalizedAgentIngestDecision | null = null;
    let agentFailureReason = "";

    try {
      const agentConfig = await getAgentConfig();
      const agent = new ReActAgent(agentConfig);

      decision = await runWithProgressRetry({
        label: "AI重处理",
        attempts: 5,
        baseDelayMs: 2000,
        heartbeatIntervalMs: 10_000,
        formatHeartbeat: ({ attempt, attempts, elapsedMs }) =>
          `AI重处理进行中（${attempt}/${attempts}，已运行 ${Math.round(
            elapsedMs / 1000
          )} 秒）...`,
        isRetriable: isRetriableAgentError,
        onProgress: async (message) => {
          await updateProcessStatus(targetEntryId, "AI_PROCESSING", message);
        },
        operation: async () => {
          const trace = await agent.process(targetEntryId, parseInput, {
            onProgress: async (message) => {
              await updateProcessStatus(targetEntryId, "AI_PROCESSING", message);
            },
          });

          const normalized = normalizeAgentIngestDecision(trace.finalResult, {
            contentLength: content.length,
          });
          if (!normalized) {
            throw new Error("Agent output missing required fields");
          }

          const { decision: repaired } = await validateAndRepairDecision(normalized, {
            contentLength: content.length,
            maxEnglishRatio: getMaxDecisionEnglishRatio(),
            minQualityScore: getMinDecisionQualityScore(),
            onProgress: async (message) => {
              await updateProcessStatus(targetEntryId, "AI_PROCESSING", message);
            },
          });

          return repaired;
        },
      });
    } catch (error) {
      agentFailureReason = error instanceof Error ? error.message : String(error);
      console.error("AI reprocess agent error:", error);
    }

    if (!decision) {
      if (!shouldAllowLegacyClassifierFallback()) {
        throw new Error("AI reprocessing failed after retries");
      }

      await updateProcessStatus(
        targetEntryId,
        "AI_PROCESSING",
        "主流程暂不可用，正在使用兼容模式..."
      );
      const fallbackClassifyResult = await runWithProgressRetry({
        label: "兼容模式分析",
        attempts: 3,
        baseDelayMs: 1500,
        isRetriable: isRetriableAgentError,
        onProgress: async (message) => {
          await updateProcessStatus(targetEntryId, "AI_PROCESSING", message);
        },
        operation: async () => classifyAndExtract(content),
      });
      const fallback = buildDecisionFromClassifier(fallbackClassifyResult);
      const repaired = await validateAndRepairDecision(fallback, {
        contentLength: content.length,
        maxEnglishRatio: getMaxDecisionEnglishRatio(),
        minQualityScore: getMinDecisionQualityScore(),
      }).catch(() => null);

      decision = repaired?.decision ?? fallback;
      if (!repaired) {
        console.warn(
          `Fallback decision repair skipped for ${targetEntryId}: ${agentFailureReason}`
        );
      }
    }

    const dynamicSummaryEnabled = isDynamicSummaryEnabled();
    const computedConfidence = decision.confidence ?? buildConfidenceScore(
      decision.sourceTrust,
      decision.timeliness,
      decision.difficulty,
      0.6
    );

    // Validate JSON fields before writing
    const validatedKeyPointsNew = decision.keyPointsNew
      ? KeyPointsSchema.safeParse(decision.keyPointsNew).success
        ? decision.keyPointsNew
        : { core: [], extended: [] }
      : { core: [], extended: [] };

    const validatedBoundaries = decision.boundaries
      ? BoundariesSchema.safeParse(decision.boundaries).success
        ? decision.boundaries
        : { applicable: [], notApplicable: [] }
      : { applicable: [], notApplicable: [] };

    const validatedSummaryStructure = decision.summaryStructure
      ? SummaryStructureSchema.safeParse(decision.summaryStructure).success
        ? decision.summaryStructure
        : { type: "generic", fields: { summary: decision.coreSummary, keyPoints: decision.keyPoints } }
      : { type: "generic", fields: { summary: decision.coreSummary, keyPoints: decision.keyPoints } };

    await prisma.entry.update({
      where: { id: targetEntryId },
      data: {
        contentType: decision.contentType,
        techDomain: decision.techDomain,
        aiTags: decision.aiTags,
        coreSummary: decision.coreSummary,
        keyPoints: decision.keyPoints,
        practiceValue: decision.practiceValue,
        ...(dynamicSummaryEnabled
          ? {
              keyPointsNew: validatedKeyPointsNew as unknown as Prisma.InputJsonValue,
              boundaries: validatedBoundaries as unknown as Prisma.InputJsonValue,
              summaryStructure: validatedSummaryStructure as unknown as Prisma.InputJsonValue,
              confidence: computedConfidence,
              difficulty: decision.difficulty,
              sourceTrust: decision.sourceTrust,
              timeliness: decision.timeliness,
              contentForm: decision.contentForm,
            }
          : {}),
      },
    });

    if (decision.practiceValue === "ACTIONABLE") {
      let practiceTask: NormalizedPracticeTask | null = decision.practiceTask;
      if (!practiceTask) {
        const practiceResult = await convertToPractice(content, decision.coreSummary);
        practiceTask = normalizePracticeTaskFromLegacyResult(
          practiceResult,
          decision.coreSummary
        );
      }

      if (practiceTask) {
        await prisma.practiceTask.upsert({
          where: { entryId: targetEntryId },
          update: {
            title: practiceTask.title,
            summary: practiceTask.summary,
            difficulty: practiceTask.difficulty,
            estimatedTime: practiceTask.estimatedTime,
            prerequisites: practiceTask.prerequisites,
            steps: {
              deleteMany: {},
              create: practiceTask.steps,
            },
          },
          create: {
            entryId: targetEntryId,
            title: practiceTask.title,
            summary: practiceTask.summary,
            difficulty: practiceTask.difficulty,
            estimatedTime: practiceTask.estimatedTime,
            prerequisites: practiceTask.prerequisites,
            steps: {
              create: practiceTask.steps,
            },
          },
        });
      }
    }

    await updateProcessStatus(targetEntryId, "DONE", null);

    return NextResponse.json({ status: "DONE", message: "Re-processing complete" });
  } catch (error) {
    console.error("AI process error:", error);
    if (entryId) {
      const message = error instanceof Error ? error.message : String(error);
      await updateProcessStatus(
        entryId,
        "FAILED",
        `AI processing failed: ${message}`
      ).catch((statusError) => {
        console.error("Failed to update process status:", statusError);
      });
    }
    return NextResponse.json(
      { error: "AI processing failed" },
      { status: 500 }
    );
  }
}
