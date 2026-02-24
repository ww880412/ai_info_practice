/**
 * Confidence Score Calculation
 */

import type { TrustLevel, Timeliness, Difficulty } from '@prisma/client';

// Confidence score components
export interface ConfidenceScore {
  source: number;      // 来源可信度: 0.3-1.0 (LOW=0.3, MEDIUM=0.6, HIGH=1.0)
  completeness: number; // 内容完整度: 0.3-1.0
  evaluation: number;  // 评估可信度: 0.3-1.0
}

// Trust level to score mapping
export const trustLevelToScore: Record<TrustLevel, number> = {
  HIGH: 1.0,
  MEDIUM: 0.6,
  LOW: 0.3,
};

// Timeliness to completeness mapping
export const timelinessToScore: Record<Timeliness, number> = {
  RECENT: 1.0,
  CLASSIC: 0.8,
  OUTDATED: 0.3,
};

// Difficulty to completeness mapping
export const difficultyToScore: Record<Difficulty, number> = {
  EASY: 0.9,
  MEDIUM: 0.8,
  HARD: 0.7,
};

// Calculate confidence using weighted average
export function calculateConfidence(scores: ConfidenceScore): number {
  return scores.source * 0.3 + scores.completeness * 0.4 + scores.evaluation * 0.3;
}

// Confidence threshold for generic fallback
export const CONFIDENCE_THRESHOLD = 0.5;

// Calculate evaluation score based on response
export function calculateEvaluation(
  response: string,
  requiredFields: string[]
): number {
  if (!requiredFields || requiredFields.length === 0) return 0.3;

  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(response);
  } catch {
    // Parse failed - return low score to trigger generic fallback
    return 0.3;
  }

  // Field presence score
  const fieldScore =
    requiredFields.filter((f) => parsed?.[f] !== undefined).length / requiredFields.length;

  // Non-empty content score
  const nonEmptyScore =
    requiredFields.reduce((acc, f) => {
      const val = parsed?.[f];
      if (val === undefined || val === null) return acc;
      if (typeof val === 'string' && val.trim().length > 0) return acc + 1;
      if (Array.isArray(val) && val.length > 0) return acc + 1;
      if (typeof val === 'object' && Object.keys(val as Record<string, unknown>).length > 0)
        return acc + 1;
      return acc;
    }, 0) / requiredFields.length;

  // Weighted calculation: JSON parse success * 0.3 + field score * 0.4 + non-empty * 0.3
  return 1.0 * 0.3 + fieldScore * 0.4 + nonEmptyScore * 0.3;
}

// Build confidence score from entry data
export function buildConfidenceScore(
  sourceTrust: TrustLevel | null,
  timeliness: Timeliness | null,
  difficulty: Difficulty | null,
  evaluationScore: number
): number {
  const source = sourceTrust ? trustLevelToScore[sourceTrust] : 0.6; // default MEDIUM
  const completeness = timeliness
    ? timelinessToScore[timeliness]
    : difficulty
      ? difficultyToScore[difficulty]
      : 0.6; // default MEDIUM

  return calculateConfidence({
    source,
    completeness,
    evaluation: evaluationScore,
  });
}
