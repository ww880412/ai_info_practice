/**
 * Mode Comparison Data Normalization Layer
 *
 * Provides null-safe normalization for ModeComparison decision data
 * with backward compatibility for legacy keyPoints format.
 */

import type { NormalizedAgentIngestDecision } from '@/lib/ai/agent/ingest-contract';

/**
 * Normalized decision structure for frontend consumption
 */
export interface NormalizedDecision {
  contentType: string;
  techDomain: string;
  aiTags: string[];
  confidence: number | null;
  coreSummary: string;
  keyPoints: {
    core: string[];
    extended: string[];
  };
  summaryStructure: {
    type: string;
    fields: Record<string, unknown>;
  };
  boundaries: {
    applicable: string[];
    notApplicable: string[];
  };
  metadata: {
    difficulty: string | null;
    sourceTrust: string | null;
    timeliness: string | null;
    contentForm: string | null;
  };
}

/**
 * Normalize decision data with null safety and backward compatibility
 *
 * Key features:
 * 1. keyPoints fallback: Prefer keyPointsNew, fallback to keyPoints
 * 2. Null safety: All fields have default values
 * 3. Type safety: Explicit return type
 *
 * @param decision - Partial decision data from database
 * @returns Normalized decision with all required fields
 */
export function normalizeDecision(
  decision: Partial<NormalizedAgentIngestDecision> | null | undefined
): NormalizedDecision {
  if (!decision) {
    return getEmptyDecision();
  }

  // keyPoints fallback logic: prefer keyPointsNew, fallback to legacy keyPoints
  const keyPoints = decision.keyPointsNew
    ? {
        core: decision.keyPointsNew.core || [],
        extended: decision.keyPointsNew.extended || [],
      }
    : {
        core: decision.keyPoints || [],
        extended: [],
      };

  return {
    contentType: decision.contentType || '未知',
    techDomain: decision.techDomain || '未知',
    aiTags: decision.aiTags || [],
    confidence: decision.confidence ?? null,
    coreSummary: decision.coreSummary || '',
    keyPoints,
    summaryStructure: {
      type: decision.summaryStructure?.type || 'generic',
      fields: decision.summaryStructure?.fields || {},
    },
    boundaries: {
      applicable: decision.boundaries?.applicable || [],
      notApplicable: decision.boundaries?.notApplicable || [],
    },
    metadata: {
      difficulty: decision.difficulty || null,
      sourceTrust: decision.sourceTrust || null,
      timeliness: decision.timeliness || null,
      contentForm: decision.contentForm || null,
    },
  };
}

/**
 * Get empty decision with all default values
 */
export function getEmptyDecision(): NormalizedDecision {
  return {
    contentType: '未知',
    techDomain: '未知',
    aiTags: [],
    confidence: null,
    coreSummary: '',
    keyPoints: { core: [], extended: [] },
    summaryStructure: { type: 'generic', fields: {} },
    boundaries: { applicable: [], notApplicable: [] },
    metadata: {
      difficulty: null,
      sourceTrust: null,
      timeliness: null,
      contentForm: null,
    },
  };
}
