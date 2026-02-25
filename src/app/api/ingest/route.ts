import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseWithLogging, type ParseInput, type ParseResult } from "@/lib/parser";
import { classifyAndExtract, type ClassifyAndExtractResult } from "@/lib/ai/classifier";
import { convertToPractice } from "@/lib/ai/practiceConverter";
import { findSimilarEntries } from "@/lib/ai/deduplication";
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
import { setServerConfig } from "@/lib/gemini";
import { isDynamicSummaryEnabled } from "@/config/flags";
import { buildConfidenceScore } from "@/lib/ai/agent/confidence";
import { isLegacyClassifierFallbackEnabled } from "@/lib/ai/fallback-policy";
import {
  isRetriableAgentError,
  isRetriableParseError,
  runWithProgressRetry,
} from "@/lib/ingest/retry";
import {
  enqueueIngestTask,
  initializeIngestQueue,
  type IngestTaskConfig,
} from "@/lib/ingest/queue";
import { readFile, unlink } from "fs/promises";
import { join } from "path";
import type { Prisma, ProcessStatus, SourceType } from "@prisma/client";
import {
  SummaryStructureSchema,
  KeyPointsSchema,
  BoundariesSchema,
} from "@/lib/ai/agent/schemas";

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

function shouldAllowLegacyClassifierFallback(): boolean {
  return isLegacyClassifierFallbackEnabled(process.env.ALLOW_CLASSIFIER_FALLBACK);
}

async function updateEntryProcessStatus(
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

async function saveFallbackTrace(
  entryId: string,
  input: ParseResult,
  reason: string,
  finalResult: NormalizedAgentIngestDecision
) {
  const timestamp = new Date().toISOString();

  await prisma.reasoningTrace.create({
    data: {
      entryId,
      steps: JSON.stringify([
        {
          step: 1,
          timestamp,
          thought: "主 Agent 流程失败，已切换兼容分类流程。",
          action: "FALLBACK_CLASSIFIER",
          observation: JSON.stringify({
            reason,
            inputLength: input.content.length,
          }),
          reasoning: "为了提高任务成功率，使用兼容分类链路生成可用结果。",
          context: {
            stage: "fallback",
            sourceType: input.sourceType,
          },
        },
      ]),
      finalResult: JSON.stringify(finalResult),
      metadata: JSON.stringify({
        startTime: timestamp,
        endTime: timestamp,
        iterations: 1,
        toolsUsed: ["legacy_classifier_fallback"],
        fallback: true,
      }),
    },
  });
}

/**
 * Async processing pipeline - runs after response is sent.
 */
async function asyncProcess(
  entryId: string,
  config: IngestTaskConfig = {}
) {
  // Set server config for Gemini
  if (config.geminiApiKey || config.geminiModel) {
    setServerConfig(config);
  }

  try {
    const entry = await prisma.entry.findUnique({ where: { id: entryId } });
    if (!entry) return;

    let content = entry.originalContent || "";
    let title = entry.title || "";

    // Step 1: Parse content if needed
    if (entry.inputType === "LINK" && entry.rawUrl) {
      await updateEntryProcessStatus(entryId, "PARSING", "正在解析链接内容...");

      try {
        const parsed = await runWithProgressRetry({
          label: "链接解析",
          attempts: 3,
          baseDelayMs: 1500,
          heartbeatIntervalMs: 15_000,
          formatHeartbeat: ({ attempt, attempts, elapsedMs }) =>
            `链接解析进行中（${attempt}/${attempts}，已运行 ${Math.round(
              elapsedMs / 1000
            )} 秒）...`,
          isRetriable: isRetriableParseError,
          onProgress: async (message) => {
            await updateEntryProcessStatus(entryId, "PARSING", message);
          },
          operation: async () =>
            parseWithLogging(entryId, {
              type: "WEBPAGE",
              data: entry.rawUrl!,
              size: entry.rawUrl!.length,
            }),
        });

        content = parsed.content;
        title = parsed.title;
        await prisma.entry.update({
          where: { id: entryId },
          data: {
            title,
            originalContent: content,
            sourceType: parsed.sourceType as SourceType,
          },
        });
      } catch (parseError) {
        await updateEntryProcessStatus(
          entryId,
          "FAILED",
          `Content parsing failed: ${parseError instanceof Error ? parseError.message : String(parseError)}`
        );
        return;
      }
    } else if (entry.inputType === "PDF") {
      await updateEntryProcessStatus(entryId, "PARSING", "正在解析文件内容（大文件可能需要更久）...");

      try {
        // rawUrl stores the fileKey for uploaded files
        const fileKey = entry.rawUrl;
        if (!fileKey) throw new Error("No file key found");

        const filePath = join(process.cwd(), "public", "uploads", fileKey);
        const buffer = await readFile(filePath);

        // Detect mime type from extension
        const ext = fileKey.split(".").pop()?.toLowerCase();
        const mimeMap: Record<string, string> = {
          pdf: "application/pdf",
          png: "image/png",
          jpg: "image/jpeg",
          jpeg: "image/jpeg",
          webp: "image/webp",
          heic: "image/heic",
        };
        const mimeType = mimeMap[ext || ""] || "application/pdf";
        const parseType: ParseInput["type"] = mimeType.startsWith("image/")
          ? "IMAGE"
          : "PDF";

        const parsed = await runWithProgressRetry({
          label: "文件解析",
          attempts: 4,
          baseDelayMs: 3000,
          heartbeatIntervalMs: 15_000,
          formatHeartbeat: ({ attempt, attempts, elapsedMs }) =>
            `文件解析进行中（${attempt}/${attempts}，已运行 ${Math.round(
              elapsedMs / 1000
            )} 秒）...`,
          isRetriable: isRetriableParseError,
          onProgress: async (message) => {
            await updateEntryProcessStatus(entryId, "PARSING", message);
          },
          operation: async () =>
            parseWithLogging(entryId, {
              type: parseType,
              data: buffer,
              mimeType,
              size: buffer.length,
            }),
        });

        content = parsed.content;
        title = parsed.title;

        await prisma.entry.update({
          where: { id: entryId },
          data: {
            title,
            originalContent: content,
            sourceType: parsed.sourceType as SourceType,
          },
        });

        // Clean up uploaded file
        await unlink(filePath).catch(() => {});
      } catch (parseError) {
        console.error("PDF parse branch failed:", parseError);
        // Clean up uploaded file even on failure
        const fileKey = entry.rawUrl;
        if (fileKey) {
          const filePath = join(process.cwd(), "public", "uploads", fileKey);
          await unlink(filePath).catch(() => {});
        }
        await updateEntryProcessStatus(
          entryId,
          "FAILED",
          `File parsing failed: ${parseError instanceof Error ? parseError.message : String(parseError)}`
        );
        return;
      }
    } else if (entry.inputType === "TEXT") {
      await updateEntryProcessStatus(entryId, "PARSING", "正在处理文本内容...");
      try {
        const rawText = entry.rawText || "";
        const parsed = await parseWithLogging(entryId, {
          type: "TEXT",
          data: rawText,
          size: rawText.length,
        });
        content = parsed.content;
        title = parsed.title;
      } catch (parseError) {
        await updateEntryProcessStatus(
          entryId,
          "FAILED",
          `Text parsing failed: ${parseError instanceof Error ? parseError.message : String(parseError)}`
        );
        return;
      }
    }

    if (!content) {
      await updateEntryProcessStatus(entryId, "FAILED", "No content to process");
      return;
    }

    // Step 2: AI processing (Agent-first, retry-first)
    await updateEntryProcessStatus(entryId, "AI_PROCESSING", "正在进行 AI 分析...");

    let decision: NormalizedAgentIngestDecision | null = null;
    let agentFailureReason = "";
    const parseInput: ParseResult = {
      title: title || entry.title || "",
      content,
      sourceType: entry.sourceType,
    };

    try {
      const agentConfig = await getAgentConfig();
      const agent = new ReActAgent(agentConfig);

      decision = await runWithProgressRetry({
        label: "AI分析",
        attempts: 5,
        baseDelayMs: 2000,
        heartbeatIntervalMs: 10_000,
        formatHeartbeat: ({ attempt, attempts, elapsedMs }) =>
          `AI分析进行中（${attempt}/${attempts}，已运行 ${Math.round(
            elapsedMs / 1000
          )} 秒）...`,
        isRetriable: isRetriableAgentError,
        onProgress: async (message) => {
          await updateEntryProcessStatus(entryId, "AI_PROCESSING", message);
        },
        operation: async () => {
          const trace = await agent.process(entryId, parseInput, {
            onProgress: async (message) => {
              await updateEntryProcessStatus(entryId, "AI_PROCESSING", message);
            },
          });
          const normalized = normalizeAgentIngestDecision(trace.finalResult, {
            contentLength: content.length,
          });
          if (!normalized) {
            throw new Error("Agent output missing required fields");
          }
          const { decision } = await validateAndRepairDecision(normalized, {
            contentLength: content.length,
            maxEnglishRatio: getMaxDecisionEnglishRatio(),
            minQualityScore: getMinDecisionQualityScore(),
            onProgress: async (message) => {
              await updateEntryProcessStatus(entryId, "AI_PROCESSING", message);
            },
          });
          return decision;
        },
      });
    } catch (agentError) {
      agentFailureReason =
        agentError instanceof Error ? agentError.message : String(agentError);
      console.error("Agent processing error:", agentError);
    }

    if (!decision) {
      if (shouldAllowLegacyClassifierFallback()) {
        await updateEntryProcessStatus(
          entryId,
          "AI_PROCESSING",
          "主流程暂不可用，正在使用兼容模式..."
        );
        const fallbackResult = await runWithProgressRetry({
          label: "兼容模式分析",
          attempts: 3,
          baseDelayMs: 1500,
          isRetriable: isRetriableAgentError,
          onProgress: async (message) => {
            await updateEntryProcessStatus(entryId, "AI_PROCESSING", message);
          },
          operation: async () => classifyAndExtract(content),
        });
        decision = buildDecisionFromClassifier(fallbackResult);
        const repaired = await validateAndRepairDecision(decision, {
          contentLength: content.length,
          maxEnglishRatio: getMaxDecisionEnglishRatio(),
          minQualityScore: getMinDecisionQualityScore(),
        }).catch(() => null);
        if (repaired?.decision) {
          decision = repaired.decision;
        }
        await saveFallbackTrace(
          entryId,
          parseInput,
          agentFailureReason || "Agent retries exhausted",
          decision
        ).catch((error) => {
          console.warn("Failed to persist fallback reasoning trace:", error);
        });
      } else {
        throw new Error("AI processing failed after retries");
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

    // B2.1: Dual-write to both Entry (old fields) and new split tables
    await prisma.$transaction(async (tx) => {
      // Update Entry with old fields (backward compat)
      await tx.entry.update({
        where: { id: entryId },
        data: {
          title: title || undefined,
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
          extractedMetadata: decision.extractedMetadata as unknown as Prisma.InputJsonValue,
        },
      });

      // Write to EntryAIResult (new table) with versioning
      // First, deactivate old versions
      await tx.entryAIResult.updateMany({
        where: { entryId, isActive: true },
        data: { isActive: false },
      });

      // Get the latest version number
      const latestVersion = await tx.entryAIResult.findFirst({
        where: { entryId },
        orderBy: { version: 'desc' },
        select: { version: true },
      });

      const newVersion = (latestVersion?.version ?? 0) + 1;

      // Create new version
      await tx.entryAIResult.create({
        data: {
          entryId,
          version: newVersion,
          isActive: true,
          contentType: decision.contentType,
          techDomain: decision.techDomain,
          aiTags: decision.aiTags,
          coreSummary: decision.coreSummary,
          keyPoints: decision.keyPoints,
          practiceValue: decision.practiceValue,
          summaryStructure: validatedSummaryStructure as unknown as Prisma.InputJsonValue,
          keyPointsNew: validatedKeyPointsNew as unknown as Prisma.InputJsonValue,
          boundaries: validatedBoundaries as unknown as Prisma.InputJsonValue,
          confidence: computedConfidence,
          extractedMetadata: decision.extractedMetadata as unknown as Prisma.InputJsonValue,
        },
      });

      // Write to EntryEvaluation (new table) if dynamic summary enabled
      if (dynamicSummaryEnabled) {
        await tx.entryEvaluation.upsert({
          where: { entryId },
          create: {
            entryId,
            difficulty: decision.difficulty,
            contentForm: decision.contentForm,
            timeliness: decision.timeliness,
            sourceTrust: decision.sourceTrust,
          },
          update: {
            difficulty: decision.difficulty,
            contentForm: decision.contentForm,
            timeliness: decision.timeliness,
            sourceTrust: decision.sourceTrust,
          },
        });
      }
    });

    // Step 3: Practice conversion (L3) - actionable only
    if (decision.practiceValue === "ACTIONABLE") {
      let practiceTask: NormalizedPracticeTask | null = decision.practiceTask;

      if (!practiceTask) {
        const practiceResult = await convertToPractice(
          content,
          decision.coreSummary
        );
        practiceTask = normalizePracticeTaskFromLegacyResult(
          practiceResult,
          decision.coreSummary
        );
      }

      if (practiceTask) {
        await prisma.practiceTask.upsert({
          where: { entryId },
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
            entryId,
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
      } else {
        console.warn("No valid practice task produced for actionable content");
      }
    }

    // Mark as done and transition to TO_REVIEW
    await prisma.entry.update({
      where: { id: entryId },
      data: {
        processStatus: "DONE",
        processError: null,
        knowledgeStatus: "TO_REVIEW",
      },
    });
  } catch (error) {
    console.error("Async processing error:", error);
    await updateEntryProcessStatus(
      entryId,
      "FAILED",
      error instanceof Error ? error.message : String(error)
    ).catch(() => {});
  }
}

initializeIngestQueue(asyncProcess);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { inputType, url, fileKey, text } = body;

    if (!inputType || !["LINK", "PDF", "TEXT"].includes(inputType)) {
      return NextResponse.json(
        { error: "Invalid inputType. Must be LINK, PDF, or TEXT." },
        { status: 400 }
      );
    }

    // Validate required fields
    if (inputType === "LINK" && !url) {
      return NextResponse.json({ error: "url is required for LINK input" }, { status: 400 });
    }
    if (inputType === "PDF" && !fileKey) {
      return NextResponse.json({ error: "fileKey is required for PDF input" }, { status: 400 });
    }
    if (inputType === "TEXT" && !text) {
      return NextResponse.json({ error: "text is required for TEXT input" }, { status: 400 });
    }

    // Determine source type
    let sourceType: SourceType = "WEBPAGE";
    if (inputType === "TEXT") sourceType = "TEXT";
    if (inputType === "PDF") sourceType = "PDF";
    if (inputType === "LINK" && url) {
      if (url.includes("github.com")) sourceType = "GITHUB";
      else if (url.includes("mp.weixin.qq.com")) sourceType = "WECHAT";
      else if (url.includes("twitter.com") || url.includes("x.com")) sourceType = "TWITTER";
    }

    // Create entry
    const entry = await prisma.entry.create({
      data: {
        inputType,
        rawUrl: inputType === "LINK" ? url : inputType === "PDF" ? fileKey : null,
        rawText: inputType === "TEXT" ? text : null,
        sourceType,
        processStatus: "PENDING",
        processError: "任务已提交，等待处理...",
      },
    });

    // Check for similar entries (only for TEXT type, as LINK/PDF content is parsed asynchronously)
    let similarEntries: Array<{
      id: string;
      title: string | null;
      coreSummary: string | null;
      similarity: number;
    }> = [];

    if (inputType === "TEXT" && text) {
      similarEntries = await findSimilarEntries(text, 0.5);
    }

    // Extract config from request body
    const config = body.config || {};

    // Trigger async processing via ingest queue
    enqueueIngestTask(entry.id, config, "submit");

    return NextResponse.json({
      entryId: entry.id,
      status: "PENDING",
      message: "Content submitted for processing",
      similarEntries: similarEntries.length > 0 ? similarEntries : undefined,
    });
  } catch (error) {
    console.error("Ingest error:", error);
    return NextResponse.json(
      { error: "Failed to ingest content" },
      { status: 500 }
    );
  }
}
