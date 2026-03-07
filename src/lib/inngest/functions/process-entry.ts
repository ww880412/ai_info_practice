/**
 * Inngest function for processing entries
 * Replaces the in-memory queue with persistent task processing
 */
import { inngest } from '../client';
import { prisma } from '@/lib/prisma';
import { parseWithLogging, type ParseInput, type ParseResult } from '@/lib/parser';
import { classifyAndExtract, type ClassifyAndExtractResult } from '@/lib/ai/classifier';
import { convertToPractice } from '@/lib/ai/practiceConverter';
import { createAgentEngine } from '@/lib/ai/agent/factory';
import {
  type NormalizedAgentIngestDecision,
  type NormalizedPracticeTask,
} from '@/lib/ai/agent/ingest-contract';
import {
  getMaxDecisionEnglishRatio,
  getMinDecisionQualityScore,
  validateAndRepairDecision,
} from '@/lib/ai/agent/decision-repair';
import { isDynamicSummaryEnabled } from '@/config/flags';
import { buildConfidenceScore } from '@/lib/ai/agent/confidence';
import { isLegacyClassifierFallbackEnabled } from '@/lib/ai/fallback-policy';
import {
  SummaryStructureSchema,
  KeyPointsSchema,
  BoundariesSchema,
} from '@/lib/ai/agent/schemas';
import { downloadFromUrl } from '@/lib/storage';
import type { Prisma, ProcessStatus, SourceType } from '@prisma/client';

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

export const processEntry = inngest.createFunction(
  {
    id: 'process-entry',
    retries: 3,
    concurrency: {
      key: 'event.data.entryId',
      limit: 1,
    },
    onFailure: async (ctx) => {
      const entryId = ctx.event.data.event.data.entryId;
      const errorMessage = ctx.event.data.error.message || 'Processing failed after retries';
      await prisma.entry.update({
        where: { id: entryId },
        data: {
          processStatus: 'FAILED',
          processError: errorMessage,
        },
      }).catch(console.error);
    },
  },
  { event: 'entry/ingest' },
  async ({ event, step }) => {
    const { entryId } = event.data;

    // Step 1: Load entry, resolve credential, and parse content
    const parsed = await step.run('parse-content', async () => {
      const entry = await prisma.entry.findUnique({ where: { id: entryId } });
      if (!entry) throw new Error('Entry not found');

      // Resolve credential and set server config for this processing run
      if (entry.credentialId) {
        const { resolveCredential, setServerConfig } = await import('@/lib/ai/client');
        const config = await resolveCredential(entry.credentialId);
        if (config.apiKey) {
          setServerConfig({ apiKey: config.apiKey, model: config.model });
        }
      }

      let content = entry.originalContent || '';
      let title = entry.title || '';

      // Parse based on input type
      if (entry.inputType === 'LINK' && entry.rawUrl) {
        await updateEntryProcessStatus(entryId, 'PARSING', '正在解析链接内容...');

        const result = await parseWithLogging(entryId, {
          type: 'WEBPAGE',
          data: entry.rawUrl,
          size: entry.rawUrl.length,
        });

        content = result.content;
        title = result.title;

        await prisma.entry.update({
          where: { id: entryId },
          data: {
            title,
            originalContent: content,
            sourceType: result.sourceType as SourceType,
          },
        });
      } else if (entry.inputType === 'PDF') {
        await updateEntryProcessStatus(entryId, 'PARSING', '正在解析文件内容...');

        const fileUrl = entry.rawUrl;
        if (!fileUrl) throw new Error('No file URL found');

        const { buffer, mimeType: detectedMimeType } = await downloadFromUrl(fileUrl);

        const ext = fileUrl.split('.').pop()?.toLowerCase();
        const mimeMap: Record<string, string> = {
          pdf: 'application/pdf',
          png: 'image/png',
          jpg: 'image/jpeg',
          jpeg: 'image/jpeg',
          webp: 'image/webp',
          heic: 'image/heic',
        };
        const mimeType = detectedMimeType !== 'application/octet-stream'
          ? detectedMimeType
          : (mimeMap[ext || ''] || 'application/pdf');
        const parseType: ParseInput['type'] = mimeType.startsWith('image/')
          ? 'IMAGE'
          : 'PDF';

        const result = await parseWithLogging(entryId, {
          type: parseType,
          data: buffer,
          mimeType,
          size: buffer.length,
        });

        content = result.content;
        title = result.title;

        await prisma.entry.update({
          where: { id: entryId },
          data: {
            title,
            originalContent: content,
            sourceType: result.sourceType as SourceType,
          },
        });
      } else if (entry.inputType === 'TEXT') {
        await updateEntryProcessStatus(entryId, 'PARSING', '正在处理文本内容...');

        const rawText = entry.rawText || '';
        const result = await parseWithLogging(entryId, {
          type: 'TEXT',
          data: rawText,
          size: rawText.length,
        });
        content = result.content;
        title = result.title;

        // Persist parsed content for TEXT input (consistent with LINK/PDF)
        await prisma.entry.update({
          where: { id: entryId },
          data: {
            title,
            originalContent: content,
            sourceType: result.sourceType as SourceType,
          },
        });
      }

      if (!content) {
        throw new Error('No content to process');
      }

      return {
        title: title || entry.title || '',
        content,
        sourceType: entry.sourceType,
      } as ParseResult;
    });

    // Step 2: AI processing
    const decision = await step.run('ai-process', async () => {
      await updateEntryProcessStatus(entryId, 'AI_PROCESSING', '正在进行 AI 分析...');

      let result: NormalizedAgentIngestDecision | null = null;
      let agentFailureReason = '';

      try {
        const agent = await createAgentEngine();
        const decision = await agent.process(entryId, parsed);
        const { decision: repairedDecision } = await validateAndRepairDecision(decision, {
          contentLength: parsed.content.length,
          maxEnglishRatio: getMaxDecisionEnglishRatio(),
          minQualityScore: getMinDecisionQualityScore(),
        });
        result = repairedDecision;
      } catch (error) {
        agentFailureReason = error instanceof Error ? error.message : String(error);
        console.error('Agent processing error:', error);
      }

      // Fallback to classifier if agent failed
      if (!result && shouldAllowLegacyClassifierFallback()) {
        await updateEntryProcessStatus(
          entryId,
          'AI_PROCESSING',
          '主流程暂不可用，正在使用兼容模式...'
        );

        const fallbackResult = await classifyAndExtract(parsed.content);
        result = buildDecisionFromClassifier(fallbackResult);

        const repaired = await validateAndRepairDecision(result, {
          contentLength: parsed.content.length,
          maxEnglishRatio: getMaxDecisionEnglishRatio(),
          minQualityScore: getMinDecisionQualityScore(),
        }).catch(() => null);

        if (repaired?.decision) {
          result = repaired.decision;
        }
      }

      if (!result) {
        throw new Error(`AI processing failed: ${agentFailureReason}`);
      }

      return result;
    });

    // Step 3: Save results
    await step.run('save-results', async () => {
      const dynamicSummaryEnabled = isDynamicSummaryEnabled();
      const computedConfidence = decision.confidence ?? buildConfidenceScore(
        decision.sourceTrust,
        decision.timeliness,
        decision.difficulty,
        0.6
      );

      // Validate JSON fields
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
          : { type: 'generic', fields: { summary: decision.coreSummary, keyPoints: decision.keyPoints } }
        : { type: 'generic', fields: { summary: decision.coreSummary, keyPoints: decision.keyPoints } };

      // Transaction to save all results
      await prisma.$transaction(async (tx) => {
        // Get the latest reasoning trace to extract execution mode
        const latestTrace = await tx.reasoningTrace.findFirst({
          where: { entryId },
          orderBy: { createdAt: 'desc' },
          select: { metadata: true },
        });

        let originalExecutionMode: string | undefined;
        if (latestTrace) {
          try {
            const metadata = JSON.parse(latestTrace.metadata);
            // Convert snake_case to kebab-case for consistency
            const executionMode = metadata.executionMode || 'two_step';
            originalExecutionMode = executionMode.replace('_', '-');
          } catch {
            // Ignore parsing errors
          }
        }

        // Update Entry
        await tx.entry.update({
          where: { id: entryId },
          data: {
            title: parsed.title || undefined,
            contentType: decision.contentType,
            techDomain: decision.techDomain,
            aiTags: decision.aiTags,
            coreSummary: decision.coreSummary,
            keyPoints: decision.keyPoints,
            practiceValue: decision.practiceValue,
            originalExecutionMode, // Save original execution mode
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

        // Deactivate old AI results
        await tx.entryAIResult.updateMany({
          where: { entryId, isActive: true },
          data: { isActive: false },
        });

        // Get latest version
        const latestVersion = await tx.entryAIResult.findFirst({
          where: { entryId },
          orderBy: { version: 'desc' },
          select: { version: true },
        });

        const newVersion = (latestVersion?.version ?? 0) + 1;

        // Create new AI result version
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

        // Evaluation if dynamic summary enabled
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

      return { saved: true };
    });

    // Step 4: Practice conversion (for actionable content)
    if (decision.practiceValue === 'ACTIONABLE') {
      await step.run('practice-conversion', async () => {
        let practiceTask: NormalizedPracticeTask | null = decision.practiceTask;

        if (!practiceTask) {
          const practiceResult = await convertToPractice(
            parsed.content,
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
        }
      });
    }

    // Step 5: Mark as done and cleanup
    await step.run('finalize', async () => {
      await prisma.entry.update({
        where: { id: entryId },
        data: {
          processStatus: 'DONE',
          processError: null,
          knowledgeStatus: 'TO_REVIEW',
        },
      });

      // Reset global config to prevent credential leakage to subsequent jobs
      const { setServerConfig } = await import('@/lib/ai/client');
      setServerConfig({});
    });

    return { success: true, entryId };
  }
);
