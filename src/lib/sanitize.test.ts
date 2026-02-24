import { describe, it, expect } from 'vitest';
import { sanitizeForLogging, createInputSummary } from './sanitize';

describe('sanitize', () => {
  describe('sanitizeForLogging', () => {
    it('should sanitize API key in URL params', () => {
      const url = 'https://api.example.com?api_key=sk-abcdefghijklmnopqrst';
      const result = sanitizeForLogging(url);
      expect(result).toContain('api_key=***');
    });

    it('should sanitize Bearer token', () => {
      const input = 'Authorization: bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxx';
      const result = sanitizeForLogging(input);
      expect(result).toContain('***');
    });

    it('should sanitize email addresses', () => {
      const input = 'Contact: user@example.com';
      const result = sanitizeForLogging(input);
      expect(result).toBe('Contact: ***');
    });

    it('should sanitize phone numbers', () => {
      const input = 'Phone: 13812345678';
      const result = sanitizeForLogging(input);
      expect(result).toBe('Phone: ***');
    });

    it('should sanitize AWS keys', () => {
      const input = 'AWS_KEY=AKIAIOSFODNN7EXAMPLE';
      const result = sanitizeForLogging(input);
      expect(result).toContain('***');
    });

    it('should sanitize object with sensitive fields', () => {
      const input = {
        username: 'testuser',
        password: 'secret123',
        data: 'normal data'
      };
      const result = sanitizeForLogging(input);
      expect(result).toContain('username');
      expect(result).toContain('"password": "***"');
      expect(result).toContain('data');
    });

    it('should handle null and undefined', () => {
      expect(sanitizeForLogging(null)).toBe('');
      expect(sanitizeForLogging(undefined)).toBe('');
    });

    it('should handle non-string objects', () => {
      expect(sanitizeForLogging(123)).toBe('123');
      expect(sanitizeForLogging(true)).toBe('true');
    });

    it('should handle arrays', () => {
      const input = ['user@email.com', 'pass123', 'normal'];
      const result = sanitizeForLogging(input);
      expect(result).toContain('***');
      expect(result).toContain('normal');
    });
  });

  describe('createInputSummary', () => {
    it('should truncate long input', () => {
      const longInput = 'a'.repeat(600);
      const result = createInputSummary(longInput);
      expect(result.length).toBeLessThanOrEqual(503); // 500 + '...'
      expect(result.endsWith('...')).toBe(true);
    });

    it('should not truncate short input', () => {
      const input = 'short text';
      const result = createInputSummary(input);
      expect(result).toBe('short text');
    });

    it('should return empty string for null/undefined', () => {
      expect(createInputSummary(null)).toBe('');
      expect(createInputSummary(undefined)).toBe('');
    });
  });
});
