import { inngest } from '../client';
import { prisma } from '@/lib/prisma';
import { ReActAgent } from '@/lib/ai/agent/engine';
import { getAgentConfig } from '@/lib/ai/agent/get-config';
import { compareDecisions } from '@/lib/ai/agent/comparison';
import { normalizeAgentIngestDecision } from '@/lib/ai/agent/ingest-contract';
import type { ParseResult } from '@/lib/parser';

export const processComparisonBatch = inngest.createFunction(
  { id: 'comparison-process-batch' },
  { event: 'comparison/process-batch' },
  async ({ event, step }) => {
    const { batchId, entryIds, targetMode } = event.data as {
      batchId: string;
      entryIds: string[];
      targetMode: 'two-step' | 'tool-calling';
    };

    // Update batch status to processing
    await step.run('update-batch-status', async () => {
      await prisma.comparisonBatch.update({
        where: { id: batchId },
        data: { status: 'processing' },
      });
    });

    // Initialize agent
    const config = await getAgentConfig();
    const agent = new ReActAgent(config);

    // Store default config for credential reset
    const { getServerConfig, setServerConfig } = await import('@/lib/ai/client');
    const defaultConfig = getServerConfig();

    // Process each entry
    const results = [];
    let successCount = 0; // P2-1 Fix: Track successful comparisons separately

    for (let i = 0; i < entryIds.length; i++) {
      const entryId = entryIds[i];

      try {
        const result = await step.run(`process-entry-${i}`, async () => {
          // Fetch entry with relations
          const entry = await prisma.entry.findUnique({
            where: { id: entryId },
            include: {
              practiceTask: {
                include: {
                  steps: true, // P1-2 Fix: Load nested steps for complete baseline
                },
              },
            },
          });

          if (!entry) {
            throw new Error(`Entry ${entryId} not found`);
          }

          // P1-1 Fix: Resolve and set credential if entry has one
          if (entry.credentialId) {
            const { resolveCredential } = await import('@/lib/ai/client');
            const credConfig = await resolveCredential(entry.credentialId);
            if (credConfig.apiKey) {
              setServerConfig({ apiKey: credConfig.apiKey, model: credConfig.model });
            }
          }

          // P1-3 Fix: Read originalMode from Entry field (immutable baseline)
          // Fail closed: reject entries without baseline instead of fabricating mode
          if (!entry.originalExecutionMode) {
            throw new Error(
              `Entry ${entryId} missing originalExecutionMode. ` +
              `Only entries processed with Agent can be compared.`
            );
          }

          const originalMode = entry.originalExecutionMode as 'two-step' | 'tool-calling';

          // P1-2 Fix: Build complete original decision including practice task
          const originalDecisionRaw = {
            contentType: entry.contentType,
            techDomain: entry.techDomain,
            aiTags: entry.aiTags,
            coreSummary: entry.coreSummary,
            keyPoints: entry.keyPoints,
            practiceValue: entry.practiceValue,
            practiceReason: entry.practiceTask?.summary || null, // Reconstruct from task
            practiceTask: entry.practiceTask ? {
              title: entry.practiceTask.title,
              summary: entry.practiceTask.summary,
              difficulty: entry.practiceTask.difficulty,
              estimatedTime: entry.practiceTask.estimatedTime,
              prerequisites: entry.practiceTask.prerequisites,
              steps: entry.practiceTask.steps || [], // P1-2 Fix: Include loaded steps
            } : null,
            summaryStructure: entry.summaryStructure,
            keyPointsNew: entry.keyPointsNew,
            boundaries: entry.boundaries,
            confidence: entry.confidence,
            difficulty: entry.difficulty,
            sourceTrust: entry.sourceTrust,
            timeliness: entry.timeliness,
            contentForm: entry.contentForm,
            extractedMetadata: entry.extractedMetadata,
          };

          // Normalize the original decision
          const originalDecision = normalizeAgentIngestDecision(originalDecisionRaw, {
            contentLength: entry.originalContent?.length || 0,
          });

          if (!originalDecision) {
            throw new Error(`Failed to normalize original decision for entry ${entryId}`);
          }

          // Reconstruct ParseResult
          const parseResult: ParseResult = {
            title: entry.title || '',
            content: entry.originalContent || '',
            sourceType: entry.sourceType,
          };

          const contentLength = entry.originalContent?.length || 0;

          // Process with target mode
          const comparisonDecision = await agent.processWithMode(
            entryId,
            parseResult,
            targetMode
          );

          // P1-1 Fix: Reset server config to default after processing
          setServerConfig(defaultConfig);

          // Compare decisions
          const comparison = await compareDecisions(
            originalDecision,
            comparisonDecision,
            {
              title: parseResult.title,
              content: parseResult.content,
              length: contentLength,
            }
          );

          // Save comparison result
          await prisma.modeComparison.create({
            data: {
              entryId,
              originalMode,
              originalDecision: originalDecision as any,
              originalScore: comparison.originalScore as any,
              comparisonMode: targetMode,
              comparisonDecision: comparisonDecision as any,
              comparisonScore: comparison.comparisonScore as any,
              winner: comparison.winner,
              scoreDiff: comparison.scoreDiff,
              batchId,
              batchIndex: i,
            },
          });

          return comparison;
        });

        results.push(result);
        successCount++; // P2-1 Fix: Increment only on success

        // Update progress with success count
        await step.run(`update-progress-${i}`, async () => {
          await prisma.comparisonBatch.update({
            where: { id: batchId },
            data: { progress: successCount },
          });
        });
      } catch (error) {
        console.error(`Failed to process entry ${entryId}:`, error);
        // P1-1 Fix: Reset config even on error
        setServerConfig(defaultConfig);
        // Continue with next entry (progress not incremented for failures)
      }
    }

    // Calculate statistics
    await step.run('calculate-stats', async () => {
      const comparisons = await prisma.modeComparison.findMany({
        where: { batchId },
      });

      if (comparisons.length === 0) {
        // No successful comparisons
        await prisma.comparisonBatch.update({
          where: { id: batchId },
          data: {
            status: 'failed',
            stats: {
              originalWins: 0,
              comparisonWins: 0,
              ties: 0,
              avgScoreDiff: 0,
              dimensionBreakdown: {
                completeness: 0,
                accuracy: 0,
                relevance: 0,
                clarity: 0,
                actionability: 0,
              },
            } as any,
          },
        });
        return;
      }

      const originalWins = comparisons.filter(c => c.winner === 'original').length;
      const comparisonWins = comparisons.filter(c => c.winner === 'comparison').length;
      const ties = comparisons.filter(c => c.winner === 'tie').length;

      const avgScoreDiff = comparisons.reduce((sum, c) => sum + c.scoreDiff, 0) / comparisons.length;

      // Calculate dimension breakdown
      const dimensionBreakdown = {
        completeness: 0,
        accuracy: 0,
        relevance: 0,
        clarity: 0,
        actionability: 0,
      };

      let actionabilityCount = 0;

      comparisons.forEach(c => {
        const compScore = c.comparisonScore as any;
        const origScore = c.originalScore as any;
        dimensionBreakdown.completeness += compScore.dimensions.completeness - origScore.dimensions.completeness;
        dimensionBreakdown.accuracy += compScore.dimensions.accuracy - origScore.dimensions.accuracy;
        dimensionBreakdown.relevance += compScore.dimensions.relevance - origScore.dimensions.relevance;
        dimensionBreakdown.clarity += compScore.dimensions.clarity - origScore.dimensions.clarity;
        if (compScore.dimensions.actionability !== null && origScore.dimensions.actionability !== null) {
          dimensionBreakdown.actionability += compScore.dimensions.actionability - origScore.dimensions.actionability;
          actionabilityCount++;
        }
      });

      // Average dimension differences
      dimensionBreakdown.completeness /= comparisons.length;
      dimensionBreakdown.accuracy /= comparisons.length;
      dimensionBreakdown.relevance /= comparisons.length;
      dimensionBreakdown.clarity /= comparisons.length;
      dimensionBreakdown.actionability = actionabilityCount > 0
        ? dimensionBreakdown.actionability / actionabilityCount
        : 0;

      const stats = {
        originalWins,
        comparisonWins,
        ties,
        avgScoreDiff,
        dimensionBreakdown,
      };

      await prisma.comparisonBatch.update({
        where: { id: batchId },
        data: {
          status: 'completed',
          stats: stats as any,
        },
      });
    });

    return { success: true, processedCount: results.length };
  }
);
