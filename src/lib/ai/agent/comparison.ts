import { evaluateDecisionQuality, type QualityEvaluation } from './scoring-agent';
import type { NormalizedAgentIngestDecision } from './ingest-contract';

export interface ComparisonResult {
  originalScore: QualityEvaluation;
  comparisonScore: QualityEvaluation;
  winner: 'original' | 'comparison' | 'tie';
  scoreDiff: number;
}

/**
 * Determine winner based on score difference
 * @param scoreDiff - Difference between comparison and original scores
 * @returns Winner designation
 */
export function determineWinner(scoreDiff: number): 'original' | 'comparison' | 'tie' {
  if (scoreDiff > 5) return 'comparison';
  if (scoreDiff < -5) return 'original';
  return 'tie';
}

/**
 * Compare two Agent decisions using scoring agent
 * @param original - Original mode decision
 * @param comparison - Comparison mode decision
 * @param originalContent - Original content for context
 * @returns Comparison result with scores and winner
 */
export async function compareDecisions(
  original: NormalizedAgentIngestDecision,
  comparison: NormalizedAgentIngestDecision,
  originalContent: { title: string; content: string; length: number }
): Promise<ComparisonResult> {
  // Evaluate both decisions in parallel
  const [originalScore, comparisonScore] = await Promise.all([
    evaluateDecisionQuality({ decision: original, originalContent }),
    evaluateDecisionQuality({ decision: comparison, originalContent }),
  ]);

  const scoreDiff = comparisonScore.overallScore - originalScore.overallScore;
  const winner = determineWinner(scoreDiff);

  return {
    originalScore,
    comparisonScore,
    winner,
    scoreDiff,
  };
}
