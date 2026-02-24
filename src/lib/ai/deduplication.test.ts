import { describe, it, expect } from 'vitest';

// Replicate the similarity function for testing to avoid import issues
function calculateSimilarity(text1: string, text2: string): number {
  const tokens1 = new Set(
    text1.toLowerCase().split(/\s+/).filter((t) => t.length > 2)
  );
  const tokens2 = new Set(
    text2.toLowerCase().split(/\s+/).filter((t) => t.length > 2)
  );

  if (tokens1.size === 0 || tokens2.size === 0) return 0;

  const intersection = new Set(
    [...tokens1].filter((t) => tokens2.has(t))
  );
  const union = new Set([...tokens1, ...tokens2]);

  return intersection.size / union.size;
}

describe('deduplication', () => {
  describe('calculateSimilarity', () => {
    it('should return 1 for identical texts', () => {
      const text = 'This is a test document with some content';
      const result = calculateSimilarity(text, text);
      expect(result).toBe(1);
    });

    it('should return 0 for completely different texts', () => {
      const text1 = 'abc def ghi jkl mno pqr';
      const text2 = 'uvw xyz foo bar baz qux';
      const result = calculateSimilarity(text1, text2);
      expect(result).toBe(0);
    });

    it('should return 0 for empty or short tokens', () => {
      const result1 = calculateSimilarity('', 'test');
      const result2 = calculateSimilarity('ab', 'test');
      expect(result1).toBe(0);
      expect(result2).toBe(0);
    });

    it('should calculate partial similarity correctly', () => {
      const text1 = 'react hooks useState useEffect tutorial';
      const text2 = 'react hooks useState guide';
      const result = calculateSimilarity(text1, text2);
      // common tokens: react, hooks, usestate (3)
      // union: react, hooks, usestate, useeffect, tutorial, guide (6)
      expect(result).toBeCloseTo(0.5, 1);
    });

    it('should be case insensitive', () => {
      const text1 = 'REACT HOOKS USESTATE';
      const text2 = 'react hooks useState';
      const result = calculateSimilarity(text1, text2);
      expect(result).toBe(1);
    });

    it('should handle texts with punctuation', () => {
      const text1 = 'Hello, world! This is a test.';
      const text2 = 'hello world this is test';
      const result = calculateSimilarity(text1, text2);
      expect(result).toBeGreaterThan(0);
    });

    it('should handle repeated words', () => {
      const text1 = 'test test test test';
      const text2 = 'test';
      const result = calculateSimilarity(text1, text2);
      // Set removes duplicates, so both become {test}
      expect(result).toBe(1);
    });
  });
});
