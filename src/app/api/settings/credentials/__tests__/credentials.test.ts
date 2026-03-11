/**
 * Tests for API Credentials CRUD Endpoints
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { validateCredentialRequest, validateCredentialUpdate } from '@/lib/settings/validation';
import { encryptApiKey, decryptApiKey, getKeyHint } from '@/lib/crypto';
import { validateBaseUrl } from '@/lib/security/ssrf-protection';

describe('Validation Module', () => {
  describe('validateCredentialRequest', () => {
    it('should accept valid gemini credential', () => {
      const result = validateCredentialRequest({
        provider: 'gemini',
        name: 'My Gemini Key',
        apiKey: 'test-api-key-12345',
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual({});
    });

    it('should accept valid crs credential with baseUrl', () => {
      const result = validateCredentialRequest({
        provider: 'crs',
        name: 'CRS Production',
        apiKey: 'crs-api-key-12345',
        baseUrl: 'https://api.crs.example.com',
      });
      expect(result.valid).toBe(true);
    });

    it('should accept valid openai-compatible credential', () => {
      const result = validateCredentialRequest({
        provider: 'openai-compatible',
        name: 'Local LLM',
        apiKey: 'local-key-12345',
        baseUrl: 'http://localhost:8080',
      });
      expect(result.valid).toBe(true);
    });

    it('should reject invalid provider', () => {
      const result = validateCredentialRequest({
        provider: 'invalid-provider',
        apiKey: 'test-key',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.provider).toContain('must be one of');
    });

    it('should reject invalid name format', () => {
      const result = validateCredentialRequest({
        provider: 'gemini',
        name: 'Invalid@Name!',
        apiKey: 'test-key-12345',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.name).toContain('alphanumeric');
    });

    it('should reject name longer than 50 characters', () => {
      const result = validateCredentialRequest({
        provider: 'gemini',
        name: 'a'.repeat(51),
        apiKey: 'test-key-12345',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.name).toContain('1-50 characters');
    });

    it('should reject short API key', () => {
      const result = validateCredentialRequest({
        provider: 'gemini',
        apiKey: 'short',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.apiKey).toContain('at least 8 characters');
    });

    it('should reject missing API key', () => {
      const result = validateCredentialRequest({
        provider: 'gemini',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.apiKey).toContain('required');
    });

    it('should reject invalid baseUrl format', () => {
      const result = validateCredentialRequest({
        provider: 'crs',
        apiKey: 'test-key-12345',
        baseUrl: 'not-a-url',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.baseUrl).toContain('Invalid URL format');
    });

    it('should reject invalid temperature', () => {
      const result = validateCredentialRequest({
        provider: 'gemini',
        apiKey: 'test-key-12345',
        config: { temperature: 3 },
      });
      expect(result.valid).toBe(false);
      expect(result.errors.config).toContain('between 0 and 2');
    });

    it('should reject negative maxTokens', () => {
      const result = validateCredentialRequest({
        provider: 'gemini',
        apiKey: 'test-key-12345',
        config: { maxTokens: -100 },
      });
      expect(result.valid).toBe(false);
      expect(result.errors.config).toContain('positive number');
    });

    it('should accept valid config', () => {
      const result = validateCredentialRequest({
        provider: 'gemini',
        apiKey: 'test-key-12345',
        config: { temperature: 0.7, maxTokens: 1000 },
      });
      expect(result.valid).toBe(true);
    });
  });
});

describe('Encryption Module', () => {
  // Set up test environment variable
  beforeEach(() => {
    process.env.KEY_ENCRYPTION_SECRET = 'test-secret-key-for-encryption';
  });

  afterEach(() => {
    delete process.env.KEY_ENCRYPTION_SECRET;
  });

  describe('encryptApiKey and decryptApiKey', () => {
    it('should encrypt and decrypt API key correctly', () => {
      const originalKey = 'my-secret-api-key-12345';
      const encrypted = encryptApiKey(originalKey);
      const decrypted = decryptApiKey(encrypted);

      expect(decrypted).toBe(originalKey);
      expect(encrypted).not.toBe(originalKey);
    });

    it('should produce different encrypted values for same key', () => {
      const originalKey = 'my-secret-api-key-12345';
      const encrypted1 = encryptApiKey(originalKey);
      const encrypted2 = encryptApiKey(originalKey);

      expect(encrypted1).not.toBe(encrypted2);
      expect(decryptApiKey(encrypted1)).toBe(originalKey);
      expect(decryptApiKey(encrypted2)).toBe(originalKey);
    });

    it('should throw error when KEY_ENCRYPTION_SECRET is missing', () => {
      delete process.env.KEY_ENCRYPTION_SECRET;
      expect(() => encryptApiKey('test-key')).toThrow('KEY_ENCRYPTION_SECRET');
    });

    it('should throw error for invalid encrypted format', () => {
      expect(() => decryptApiKey('invalid-format')).toThrow('Invalid encrypted key format');
    });
  });

  describe('getKeyHint', () => {
    it('should return last 4 characters for long keys', () => {
      const hint = getKeyHint('my-secret-api-key-12345');
      expect(hint).toBe('...2345');
    });

    it('should return *** for short keys', () => {
      const hint = getKeyHint('abc');
      expect(hint).toBe('***');
    });

    it('should handle exactly 4 character keys', () => {
      const hint = getKeyHint('abcd');
      expect(hint).toBe('***');
    });
  });
});

describe('SSRF Protection Integration', () => {
  it('should allow valid gemini URL', () => {
    const result = validateBaseUrl('gemini', 'https://generativelanguage.googleapis.com/');
    expect(result.valid).toBe(true);
  });

  it('should allow localhost for openai-compatible', () => {
    const result = validateBaseUrl('openai-compatible', 'http://localhost:8080');
    expect(result.valid).toBe(true);
  });

  it('should block private IPs for non-allowlisted URLs', () => {
    const result = validateBaseUrl('gemini', 'http://192.168.1.1');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Private IP');
  });

  it('should block non-allowlisted URLs', () => {
    const result = validateBaseUrl('gemini', 'https://evil.com');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('allowlist');
  });
});
