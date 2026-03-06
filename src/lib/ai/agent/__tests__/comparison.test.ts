import { describe, it, expect, vi, beforeEach } from 'vitest';
import { determineWinner } from '../comparison';

describe('comparison', () => {
  describe('determineWinner', () => {
    it('should return comparison as winner when scoreDiff > 5', () => {
      const result = determineWinner(15);
      expect(result).toBe('comparison');
    });

    it('should return original as winner when scoreDiff < -5', () => {
      const result = determineWinner(-10);
      expect(result).toBe('original');
    });

    it('should return tie when scoreDiff is between -5 and 5', () => {
      expect(determineWinner(3)).toBe('tie');
      expect(determineWinner(-3)).toBe('tie');
      expect(determineWinner(0)).toBe('tie');
      expect(determineWinner(5)).toBe('tie');
      expect(determineWinner(-5)).toBe('tie');
    });
  });
});
