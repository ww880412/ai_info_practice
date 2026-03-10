/**
 * Tests for getDefaultCredential helper
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getDefaultCredential } from '../get-default-credential';
import { prisma } from '@/lib/prisma';
import { encryptApiKey } from '@/lib/crypto';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    apiCredential: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('@/lib/crypto', () => ({
  decryptApiKey: vi.fn((encrypted: string) => `decrypted-${encrypted}`),
  encryptApiKey: vi.fn((key: string) => `encrypted-${key}`),
}));

describe('getDefaultCredential', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear env vars
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_MODEL;
    delete process.env.CRS_API_KEY;
    delete process.env.CRS_MODEL;
    delete process.env.CRS_BASE_URL;
    delete process.env.LOCAL_PROXY_KEY;
    delete process.env.LOCAL_PROXY_MODEL;
    delete process.env.LOCAL_PROXY_URL;
  });

  describe('Gemini provider', () => {
    it('should return default credential when found', async () => {
      const mockCredential = {
        id: 'cred-1',
        provider: 'gemini',
        encryptedKey: 'encrypted-key-123',
        model: 'gemini-2.0-flash-exp',
        baseUrl: null,
        isActive: true,
        isValid: true,
        isDefault: true,
        createdAt: new Date(),
      };

      vi.mocked(prisma.apiCredential.findFirst).mockResolvedValue(mockCredential as any);

      const result = await getDefaultCredential('gemini');

      expect(result).toEqual({
        apiKey: 'decrypted-encrypted-key-123',
        model: 'gemini-2.0-flash-exp',
        provider: 'gemini',
        baseUrl: undefined,
      });

      expect(prisma.apiCredential.findFirst).toHaveBeenCalledWith({
        where: {
          provider: 'gemini',
          isActive: true,
          isValid: true,
        },
        orderBy: [
          { isDefault: 'desc' },
          { createdAt: 'asc' },
        ],
      });
    });

    it('should fallback to env when no credential found', async () => {
      vi.mocked(prisma.apiCredential.findFirst).mockResolvedValue(null);
      process.env.GEMINI_API_KEY = 'env-api-key';
      process.env.GEMINI_MODEL = 'gemini-2.0-flash';

      const result = await getDefaultCredential('gemini');

      expect(result).toEqual({
        apiKey: 'env-api-key',
        model: 'gemini-2.0-flash',
        provider: 'gemini',
      });
    });

    it('should use default model when env not set', async () => {
      vi.mocked(prisma.apiCredential.findFirst).mockResolvedValue(null);
      process.env.GEMINI_API_KEY = 'env-api-key';

      const result = await getDefaultCredential('gemini');

      expect(result.model).toBe('gemini-2.0-flash-exp');
    });
  });

  describe('CRS provider', () => {
    it('should return default credential when found', async () => {
      const mockCredential = {
        id: 'cred-2',
        provider: 'crs',
        encryptedKey: 'encrypted-crs-key',
        model: 'gpt-5.4',
        baseUrl: 'https://api.crs.example.com',
        isActive: true,
        isValid: true,
        isDefault: true,
        createdAt: new Date(),
      };

      vi.mocked(prisma.apiCredential.findFirst).mockResolvedValue(mockCredential as any);

      const result = await getDefaultCredential('crs');

      expect(result).toEqual({
        apiKey: 'decrypted-encrypted-crs-key',
        model: 'gpt-5.4',
        provider: 'crs',
        baseUrl: 'https://api.crs.example.com',
      });
    });

    it('should fallback to env when no credential found', async () => {
      vi.mocked(prisma.apiCredential.findFirst).mockResolvedValue(null);
      process.env.CRS_API_KEY = 'crs-env-key';
      process.env.CRS_MODEL = 'gpt-5.3-codex';
      process.env.CRS_BASE_URL = 'https://crs.example.com';

      const result = await getDefaultCredential('crs');

      expect(result).toEqual({
        apiKey: 'crs-env-key',
        model: 'gpt-5.3-codex',
        provider: 'crs',
        baseUrl: 'https://crs.example.com',
      });
    });

    it('should use default values when env not set', async () => {
      vi.mocked(prisma.apiCredential.findFirst).mockResolvedValue(null);
      process.env.CRS_API_KEY = 'crs-key';

      const result = await getDefaultCredential('crs');

      expect(result.model).toBe('gpt-5.3-codex');
      expect(result.baseUrl).toBe('https://ls.xingchentech.asia/openai');
    });
  });

  describe('OpenAI-compatible provider', () => {
    it('should return default credential when found', async () => {
      const mockCredential = {
        id: 'cred-3',
        provider: 'openai-compatible',
        encryptedKey: 'encrypted-proxy-key',
        model: 'custom-model',
        baseUrl: 'http://localhost:8080/v1',
        isActive: true,
        isValid: true,
        isDefault: true,
        createdAt: new Date(),
      };

      vi.mocked(prisma.apiCredential.findFirst).mockResolvedValue(mockCredential as any);

      const result = await getDefaultCredential('openai-compatible');

      expect(result).toEqual({
        apiKey: 'decrypted-encrypted-proxy-key',
        model: 'custom-model',
        provider: 'openai-compatible',
        baseUrl: 'http://localhost:8080/v1',
      });
    });

    it('should fallback to env when no credential found', async () => {
      vi.mocked(prisma.apiCredential.findFirst).mockResolvedValue(null);
      process.env.LOCAL_PROXY_KEY = 'proxy-key';
      process.env.LOCAL_PROXY_MODEL = 'proxy-model';
      process.env.LOCAL_PROXY_URL = 'http://localhost:9000/v1';

      const result = await getDefaultCredential('openai-compatible');

      expect(result).toEqual({
        apiKey: 'proxy-key',
        model: 'proxy-model',
        provider: 'openai-compatible',
        baseUrl: 'http://localhost:9000/v1',
      });
    });

    it('should use default values when env not set', async () => {
      vi.mocked(prisma.apiCredential.findFirst).mockResolvedValue(null);

      const result = await getDefaultCredential('openai-compatible');

      expect(result.apiKey).toBe('');
      expect(result.model).toBe('gemini-3.1-pro-high');
      expect(result.baseUrl).toBe('http://127.0.0.1:8045/v1');
    });
  });

  describe('Deterministic ordering', () => {
    it('should prefer isDefault=true over isDefault=false', async () => {
      const defaultCred = {
        id: 'cred-default',
        provider: 'gemini',
        encryptedKey: 'key-default',
        model: 'model-default',
        isActive: true,
        isValid: true,
        isDefault: true,
        createdAt: new Date('2024-01-02'),
      };

      vi.mocked(prisma.apiCredential.findFirst).mockResolvedValue(defaultCred as any);

      const result = await getDefaultCredential('gemini');

      expect(result.apiKey).toBe('decrypted-key-default');
    });

    it('should prefer older createdAt when isDefault is same', async () => {
      const olderCred = {
        id: 'cred-older',
        provider: 'gemini',
        encryptedKey: 'key-older',
        model: 'model-older',
        isActive: true,
        isValid: true,
        isDefault: false,
        createdAt: new Date('2024-01-01'),
      };

      vi.mocked(prisma.apiCredential.findFirst).mockResolvedValue(olderCred as any);

      const result = await getDefaultCredential('gemini');

      expect(result.apiKey).toBe('decrypted-key-older');
    });
  });

  describe('Filtering', () => {
    it('should only query active and valid credentials', async () => {
      vi.mocked(prisma.apiCredential.findFirst).mockResolvedValue(null);
      process.env.GEMINI_API_KEY = 'fallback-key';

      await getDefaultCredential('gemini');

      expect(prisma.apiCredential.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
            isValid: true,
          }),
        })
      );
    });
  });
});
