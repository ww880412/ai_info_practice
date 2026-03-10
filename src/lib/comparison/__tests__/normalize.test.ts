/**
 * Unit tests for normalization layer
 */

import { describe, it, expect } from 'vitest';
import { normalizeDecision, getEmptyDecision } from '../normalize';
import type { NormalizedAgentIngestDecision } from '@/lib/ai/agent/ingest-contract';

describe('normalizeDecision', () => {
  it('should handle null input', () => {
    const result = normalizeDecision(null);
    expect(result).toEqual(getEmptyDecision());
  });

  it('should handle undefined input', () => {
    const result = normalizeDecision(undefined);
    expect(result).toEqual(getEmptyDecision());
  });

  it('should normalize complete decision data', () => {
    const input: Partial<NormalizedAgentIngestDecision> = {
      contentType: 'tutorial',
      techDomain: 'frontend',
      aiTags: ['react', 'typescript'],
      confidence: 0.95,
      coreSummary: 'A comprehensive React tutorial',
      keyPointsNew: {
        core: ['Core concept 1', 'Core concept 2'],
        extended: ['Extended point 1'],
      },
      summaryStructure: {
        type: 'timeline-evolution',
        fields: { phase1: 'Setup', phase2: 'Implementation' },
      },
      boundaries: {
        applicable: ['Web development'],
        notApplicable: ['Mobile development'],
      },
      difficulty: 'intermediate',
      sourceTrust: 'high',
      timeliness: 'current',
      contentForm: 'tutorial',
    };

    const result = normalizeDecision(input);

    expect(result.contentType).toBe('tutorial');
    expect(result.techDomain).toBe('frontend');
    expect(result.aiTags).toEqual(['react', 'typescript']);
    expect(result.confidence).toBe(0.95);
    expect(result.coreSummary).toBe('A comprehensive React tutorial');
    expect(result.keyPoints.core).toEqual(['Core concept 1', 'Core concept 2']);
    expect(result.keyPoints.extended).toEqual(['Extended point 1']);
    expect(result.summaryStructure.type).toBe('timeline-evolution');
    expect(result.boundaries.applicable).toEqual(['Web development']);
    expect(result.metadata.difficulty).toBe('intermediate');
  });

  it('should fallback to legacy keyPoints when keyPointsNew is missing', () => {
    const input: Partial<NormalizedAgentIngestDecision> = {
      contentType: 'article',
      keyPoints: ['Point 1', 'Point 2', 'Point 3'],
    };

    const result = normalizeDecision(input);

    expect(result.keyPoints.core).toEqual(['Point 1', 'Point 2', 'Point 3']);
    expect(result.keyPoints.extended).toEqual([]);
  });

  it('should prefer keyPointsNew over legacy keyPoints', () => {
    const input: Partial<NormalizedAgentIngestDecision> = {
      contentType: 'article',
      keyPoints: ['Legacy point 1', 'Legacy point 2'],
      keyPointsNew: {
        core: ['New core point'],
        extended: ['New extended point'],
      },
    };

    const result = normalizeDecision(input);

    expect(result.keyPoints.core).toEqual(['New core point']);
    expect(result.keyPoints.extended).toEqual(['New extended point']);
  });

  it('should handle partial keyPointsNew with missing fields', () => {
    const input: Partial<NormalizedAgentIngestDecision> = {
      contentType: 'article',
      keyPointsNew: {
        core: ['Core point'],
        extended: undefined as any,
      },
    };

    const result = normalizeDecision(input);

    expect(result.keyPoints.core).toEqual(['Core point']);
    expect(result.keyPoints.extended).toEqual([]);
  });

  it('should provide default values for missing fields', () => {
    const input: Partial<NormalizedAgentIngestDecision> = {
      contentType: 'article',
    };

    const result = normalizeDecision(input);

    expect(result.contentType).toBe('article');
    expect(result.techDomain).toBe('未知');
    expect(result.aiTags).toEqual([]);
    expect(result.confidence).toBeNull();
    expect(result.coreSummary).toBe('');
    expect(result.keyPoints.core).toEqual([]);
    expect(result.keyPoints.extended).toEqual([]);
    expect(result.summaryStructure.type).toBe('generic');
    expect(result.summaryStructure.fields).toEqual({});
    expect(result.boundaries.applicable).toEqual([]);
    expect(result.boundaries.notApplicable).toEqual([]);
    expect(result.metadata.difficulty).toBeNull();
  });

  it('should handle empty summaryStructure', () => {
    const input: Partial<NormalizedAgentIngestDecision> = {
      contentType: 'article',
      summaryStructure: undefined,
    };

    const result = normalizeDecision(input);

    expect(result.summaryStructure.type).toBe('generic');
    expect(result.summaryStructure.fields).toEqual({});
  });

  it('should handle partial summaryStructure', () => {
    const input: Partial<NormalizedAgentIngestDecision> = {
      contentType: 'article',
      summaryStructure: {
        type: 'narrative',
        fields: undefined as any,
      },
    };

    const result = normalizeDecision(input);

    expect(result.summaryStructure.type).toBe('narrative');
    expect(result.summaryStructure.fields).toEqual({});
  });

  it('should handle empty boundaries', () => {
    const input: Partial<NormalizedAgentIngestDecision> = {
      contentType: 'article',
      boundaries: undefined,
    };

    const result = normalizeDecision(input);

    expect(result.boundaries.applicable).toEqual([]);
    expect(result.boundaries.notApplicable).toEqual([]);
  });

  it('should handle confidence as 0', () => {
    const input: Partial<NormalizedAgentIngestDecision> = {
      contentType: 'article',
      confidence: 0,
    };

    const result = normalizeDecision(input);

    expect(result.confidence).toBe(0);
  });

  it('should handle confidence as null', () => {
    const input: Partial<NormalizedAgentIngestDecision> = {
      contentType: 'article',
      confidence: null,
    };

    const result = normalizeDecision(input);

    expect(result.confidence).toBeNull();
  });
});

describe('getEmptyDecision', () => {
  it('should return decision with all default values', () => {
    const result = getEmptyDecision();

    expect(result.contentType).toBe('未知');
    expect(result.techDomain).toBe('未知');
    expect(result.aiTags).toEqual([]);
    expect(result.confidence).toBeNull();
    expect(result.coreSummary).toBe('');
    expect(result.keyPoints.core).toEqual([]);
    expect(result.keyPoints.extended).toEqual([]);
    expect(result.summaryStructure.type).toBe('generic');
    expect(result.summaryStructure.fields).toEqual({});
    expect(result.boundaries.applicable).toEqual([]);
    expect(result.boundaries.notApplicable).toEqual([]);
    expect(result.metadata.difficulty).toBeNull();
    expect(result.metadata.sourceTrust).toBeNull();
    expect(result.metadata.timeliness).toBeNull();
    expect(result.metadata.contentForm).toBeNull();
  });
});
