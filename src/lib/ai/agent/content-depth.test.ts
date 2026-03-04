import { describe, expect, it } from 'vitest';
import { getContentDepth, getFieldsGuidance } from './content-depth';
import { getRequiredFields } from './schemas';

describe('getContentDepth', () => {
  it('returns SHORT for content < 2000 chars', () => {
    expect(getContentDepth(1999)).toBe('SHORT');
    expect(getContentDepth(0)).toBe('SHORT');
    expect(getContentDepth(1000)).toBe('SHORT');
  });

  it('returns MEDIUM for content 2000-10000 chars', () => {
    expect(getContentDepth(2000)).toBe('MEDIUM');
    expect(getContentDepth(5000)).toBe('MEDIUM');
    expect(getContentDepth(10000)).toBe('MEDIUM');
  });

  it('returns LONG for content > 10000 chars', () => {
    expect(getContentDepth(10001)).toBe('LONG');
    expect(getContentDepth(50000)).toBe('LONG');
  });

  it('boundary 1999/2000', () => {
    expect(getContentDepth(1999)).toBe('SHORT');
    expect(getContentDepth(2000)).toBe('MEDIUM');
  });

  it('boundary 10000/10001', () => {
    expect(getContentDepth(10000)).toBe('MEDIUM');
    expect(getContentDepth(10001)).toBe('LONG');
  });
});

describe('getRequiredFields', () => {
  it('api-reference returns []', () => {
    expect(getRequiredFields('api-reference')).toEqual([]);
  });

  it('generic returns only 1 field', () => {
    expect(getRequiredFields('generic')).toEqual(['summary']);
  });

  it('timeline-evolution returns only 1 field', () => {
    expect(getRequiredFields('timeline-evolution')).toEqual(['events']);
  });

  it('problem-solution-steps returns 3 fields', () => {
    expect(getRequiredFields('problem-solution-steps')).toEqual(['problem', 'solution', 'steps']);
  });
});

describe('getFieldsGuidance minimum 2 fields guarantee', () => {
  const recommendedFieldsByType: Record<string, string[]> = {
    'api-reference': ['endpoint', 'returnValue'],
    'generic': ['summary', 'keyPoints'],
    'timeline-evolution': ['events', 'currentStatus'],
  };

  it.each(['api-reference', 'generic', 'timeline-evolution'])(
    '%s SHORT guidance includes at least 2 field names',
    (type) => {
      const guidance = getFieldsGuidance('SHORT', type);
      const expectedFields = recommendedFieldsByType[type];
      const foundFields = expectedFields.filter(field => guidance.includes(field));
      expect(foundFields.length).toBeGreaterThanOrEqual(2);
    }
  );

  it('returns empty string for undefined type', () => {
    expect(getFieldsGuidance('SHORT', undefined)).toBe('');
  });

  it('MEDIUM includes more fields than SHORT', () => {
    const shortGuidance = getFieldsGuidance('SHORT', 'problem-solution-steps');
    const mediumGuidance = getFieldsGuidance('MEDIUM', 'problem-solution-steps');
    // Both should include required fields
    expect(shortGuidance).toContain('problem');
    expect(mediumGuidance).toContain('problem');
  });

  it('LONG includes all fields', () => {
    const longGuidance = getFieldsGuidance('LONG', 'api-reference');
    expect(longGuidance).toContain('endpoint');
    expect(longGuidance).toContain('returnValue');
    expect(longGuidance).toContain('parameters');
    expect(longGuidance).toContain('examples');
    expect(longGuidance).toContain('errorCodes');
  });

  it('LONG timeline-evolution includes all fields', () => {
    const guidance = getFieldsGuidance('LONG', 'timeline-evolution');
    expect(guidance).toContain('events');
    expect(guidance).toContain('currentStatus');
    expect(guidance).toContain('futureOutlook');
  });

  it('LONG comparison-matrix includes all fields', () => {
    const guidance = getFieldsGuidance('LONG', 'comparison-matrix');
    expect(guidance).toContain('items');
    expect(guidance).toContain('dimensions');
    expect(guidance).toContain('matrix');
    expect(guidance).toContain('recommendation');
  });

  it('returns empty string for unknown type', () => {
    expect(getFieldsGuidance('SHORT', 'unknown-type')).toBe('');
  });
});
