import { inngest } from '../client';
import { prisma } from '@/lib/prisma';
import { ReActAgent } from '@/lib/ai/agent/engine';
import { getAgentConfig } from '@/lib/ai/agent/get-config';
import { compareDecisions } from '@/lib/ai/agent/comparison';
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

    // Determine original mode (opposite of target)
    const originalMode = targetMode === 'two-step' ? 'tool-calling' : 'two-step';

    // Process each entry
    const results = [];
    for (let i = 0; i < entryIds.length; i++) {
      const entryId = entryIds[i];

      try {
        const result = await step.run(`process-entry-${i}`, async () => {
          // Fetch entry with parse result
          const entry = await prisma.entry.findUnique({
            where: { id: entryId },
            include: {
              reasoningTraces: {
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
            },
          });

          if (!entry) {
            throw new Error(`Entry ${entryId} not found`);
          }

          // Get original decision from latest reasoning trace
          const latestTrace = entry.reasoningTraces[0];
          if (!latestTrace) {
            throw new Error(`No reasoning trace found for entry ${entryId}`);
          }

          const originalDecision = JSON.parse(latestTrace.finalResult);

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

        // Update progress
        await step.run(`update-progress-${i}`, async () => {
          await prisma.comparisonBatch.update({
            where: { id: batchId },
            data: { progress: i + 1 },
          });
        });
      } catch (error) {
        console.error(`Failed to process entry ${entryId}:`, error);
        // Continue with next entry
      }
    }

    // Calculate statistics
    await step.run('calculate-stats', async () => {
      const comparisons = await prisma.modeComparison.findMany({
        where: { batchId },
      });

      const originalWins = comparisons.filter(c => c.winner === 'original').length;
      const comparisonWins = comparisons.filter(c => c.winner === 'comparison').length;
      const ties = comparisons.filter(c => c.winner === 'tie').length;

      const avgScoreDiff = comparisons.length > 0
        ? comparisons.reduce((sum, c) => sum + c.scoreDiff, 0) / comparisons.length
        : 0;

      // Calculate dimension breakdown
      const dimensionBreakdown = {
        completeness: 0,
        accuracy: 0,
        relevance: 0,
        clarity: 0,
        actionability: 0,
      };

      comparisons.forEach(c => {
        const compScore = c.comparisonScore as any;
        const origScore = c.originalScore as any;
        dimensionBreakdown.completeness += compScore.dimensions.completeness - origScore.dimensions.completeness;
        dimensionBreakdown.accuracy += compScore.dimensions.accuracy - origScore.dimensions.accuracy;
        dimensionBreakdown.relevance += compScore.dimensions.relevance - origScore.dimensions.relevance;
        dimensionBreakdown.clarity += compScore.dimensions.clarity - origScore.dimensions.clarity;
        if (compScore.dimensions.actionability !== null && origScore.dimensions.actionability !== null) {
          dimensionBreakdown.actionability += compScore.dimensions.actionability - origScore.dimensions.actionability;
        }
      });

      // Average dimension differences
      Object.keys(dimensionBreakdown).forEach(key => {
        dimensionBreakdown[key as keyof typeof dimensionBreakdown] /= comparisons.length;
      });

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
