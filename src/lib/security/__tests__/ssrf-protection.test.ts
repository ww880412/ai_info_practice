/**
 * SSRF Protection Tests
 *
 * Comprehensive test suite for URL validation and SSRF protection
 */

import { validateBaseUrl } from '../ssrf-protection';

describe('SSRF Protection', () => {
  describe('Gemini Provider', () => {
    it('should allow valid Gemini API URLs', () => {
      const result = validateBaseUrl('gemini', 'https://generativelanguage.googleapis.com/');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should allow Gemini API URLs with paths', () => {
      const result = validateBaseUrl('gemini', 'https://generativelanguage.googleapis.com/v1beta/models');
      expect(result.valid).toBe(true);
    });

    it('should reject non-Gemini URLs', () => {
      const result = validateBaseUrl('gemini', 'https://example.com/');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('URL does not match allowlist patterns');
    });
  });

  describe('CRS Provider', () => {
    it('should allow CRS URLs from environment variable', () => {
      process.env.CRS_BASE_URL = 'https://api.crs.example.com';
      const result = validateBaseUrl('crs', 'https://api.crs.example.com');
      expect(result.valid).toBe(true);
    });

    it('should allow CRS URLs with trailing slash', () => {
      process.env.CRS_BASE_URL = 'https://api.crs.example.com';
      const result = validateBaseUrl('crs', 'https://api.crs.example.com/');
      expect(result.valid).toBe(true);
    });

    it('should respect CRS_BASE_URL_PATTERN environment variable', () => {
      process.env.CRS_BASE_URL_PATTERN = '^https://custom\\.crs\\.com';
      const result = validateBaseUrl('crs', 'https://custom.crs.com');
      expect(result.valid).toBe(true);
    });

    afterEach(() => {
      delete process.env.CRS_BASE_URL;
      delete process.env.CRS_BASE_URL_PATTERN;
    });
  });

  describe('OpenAI-Compatible Provider', () => {
    it('should allow localhost HTTP URLs', () => {
      const result = validateBaseUrl('openai-compatible', 'http://localhost:8080');
      expect(result.valid).toBe(true);
    });

    it('should allow 127.0.0.1 HTTP URLs', () => {
      const result = validateBaseUrl('openai-compatible', 'http://127.0.0.1:11434');
      expect(result.valid).toBe(true);
    });

    it('should allow host.docker.internal URLs', () => {
      const result = validateBaseUrl('openai-compatible', 'http://host.docker.internal:8080');
      expect(result.valid).toBe(true);
    });

    it('should allow allowlisted HTTPS URLs', () => {
      process.env.OPENAI_COMPATIBLE_ALLOWLIST = 'api.openai.com,api.anthropic.com';
      const result = validateBaseUrl('openai-compatible', 'https://api.openai.com');
      expect(result.valid).toBe(true);
    });

    it('should reject non-allowlisted HTTPS URLs', () => {
      const result = validateBaseUrl('openai-compatible', 'https://evil.com');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('URL does not match allowlist patterns');
    });

    it('should provide warning for custom HTTPS endpoints', () => {
      const result = validateBaseUrl('openai-compatible', 'https://custom.api.com');
      expect(result.valid).toBe(false);
      expect(result.warning).toBe('Custom HTTPS endpoints must be explicitly allowlisted via OPENAI_COMPATIBLE_ALLOWLIST');
    });

    afterEach(() => {
      delete process.env.OPENAI_COMPATIBLE_ALLOWLIST;
    });
  });

  describe('Private IP Blocking', () => {
    const privateIPs = [
      // Class A private network
      'http://10.0.0.1',
      'http://10.255.255.255',

      // Class B private network
      'http://172.16.0.1',
      'http://172.31.255.255',

      // Class C private network
      'http://192.168.0.1',
      'http://192.168.255.255',

      // Loopback
      'http://127.0.0.1',
      'http://127.255.255.255',

      // Link-local
      'http://169.254.0.1',
      'http://169.254.255.255',

      // IPv6 loopback
      'http://[::1]',

      // IPv6 link-local
      'http://[fe80::1]',

      // IPv6 unique local
      'http://[fc00::1]',
      'http://[fd00::1]',
    ];

    privateIPs.forEach(ip => {
      it(`should block private IP: ${ip}`, () => {
        const result = validateBaseUrl('openai-compatible', ip);
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Private IP addresses are not allowed');
      });
    });
  });

  describe('Public IP Allowance', () => {
    it('should allow public IPs when in allowlist', () => {
      process.env.OPENAI_COMPATIBLE_ALLOWLIST = '8.8.8.8';
      const result = validateBaseUrl('openai-compatible', 'https://8.8.8.8');
      expect(result.valid).toBe(true);
    });

    it('should reject public IPs not in allowlist', () => {
      const result = validateBaseUrl('openai-compatible', 'https://8.8.8.8');
      expect(result.valid).toBe(false);
    });

    afterEach(() => {
      delete process.env.OPENAI_COMPATIBLE_ALLOWLIST;
    });
  });

  describe('Invalid URLs', () => {
    it('should reject malformed URLs', () => {
      const result = validateBaseUrl('gemini', 'not-a-url');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid URL format');
    });

    it('should reject empty URLs', () => {
      const result = validateBaseUrl('gemini', '');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid URL format');
    });
  });

  describe('Unknown Provider', () => {
    it('should reject URLs for unknown providers', () => {
      const result = validateBaseUrl('unknown-provider', 'https://example.com');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('No allowlist configured for provider: unknown-provider');
    });
  });

  describe('Edge Cases', () => {
    it('should handle URLs with ports', () => {
      const result = validateBaseUrl('openai-compatible', 'http://localhost:3000');
      expect(result.valid).toBe(true);
    });

    it('should handle URLs with paths and query strings', () => {
      const result = validateBaseUrl('gemini', 'https://generativelanguage.googleapis.com/v1/models?key=abc');
      expect(result.valid).toBe(true);
    });

    it('should reject URLs with authentication (userinfo bypass prevention)', () => {
      process.env.OPENAI_COMPATIBLE_ALLOWLIST = 'api.example.com';
      const result = validateBaseUrl('openai-compatible', 'https://user:pass@api.example.com');
      expect(result.valid).toBe(false);
    });

    afterEach(() => {
      delete process.env.OPENAI_COMPATIBLE_ALLOWLIST;
    });
  });

  describe('Environment Variable Configuration', () => {
    it('should handle multiple allowlist entries', () => {
      process.env.OPENAI_COMPATIBLE_ALLOWLIST = 'api1.com, api2.com, api3.com';

      expect(validateBaseUrl('openai-compatible', 'https://api1.com').valid).toBe(true);
      expect(validateBaseUrl('openai-compatible', 'https://api2.com').valid).toBe(true);
      expect(validateBaseUrl('openai-compatible', 'https://api3.com').valid).toBe(true);
      expect(validateBaseUrl('openai-compatible', 'https://api4.com').valid).toBe(false);
    });

    it('should handle allowlist with whitespace', () => {
      process.env.OPENAI_COMPATIBLE_ALLOWLIST = '  api.example.com  ,  another.com  ';
      const result = validateBaseUrl('openai-compatible', 'https://api.example.com');
      expect(result.valid).toBe(true);
    });

    afterEach(() => {
      delete process.env.OPENAI_COMPATIBLE_ALLOWLIST;
    });
  });

  describe('Security Bypass Prevention', () => {
    describe('IPv6 Complete Range Coverage', () => {
      const ipv6LinkLocal = [
        'http://[fe80::1]',
        'http://[fe8f::1]',
        'http://[fe90::1]',
        'http://[fe9f::1]',
        'http://[fea0::1]',
        'http://[feaf::1]',
        'http://[feb0::1]',
        'http://[febf::1]',
      ];

      ipv6LinkLocal.forEach(ip => {
        it(`should block IPv6 link-local: ${ip}`, () => {
          const result = validateBaseUrl('openai-compatible', ip);
          expect(result.valid).toBe(false);
          expect(result.error).toBe('Private IP addresses are not allowed');
        });
      });

      const ipv6UniqueLocal = [
        'http://[fc00::1]',
        'http://[fcff::1]',
        'http://[fd00::1]',
        'http://[fdff::1]',
      ];

      ipv6UniqueLocal.forEach(ip => {
        it(`should block IPv6 unique local: ${ip}`, () => {
          const result = validateBaseUrl('openai-compatible', ip);
          expect(result.valid).toBe(false);
          expect(result.error).toBe('Private IP addresses are not allowed');
        });
      });
    });

    describe('Allowlist Bypass Prevention', () => {
      it('should reject suffix domain attacks', () => {
        process.env.OPENAI_COMPATIBLE_ALLOWLIST = 'api.example.com';
        const result = validateBaseUrl('openai-compatible', 'https://evilapi.example.com');
        expect(result.valid).toBe(false);
      });

      it('should reject userinfo bypass attempts', () => {
        process.env.OPENAI_COMPATIBLE_ALLOWLIST = 'api.example.com';
        const result = validateBaseUrl('openai-compatible', 'https://user@evil.com');
        expect(result.valid).toBe(false);
      });

      it('should reject subdomain attacks', () => {
        process.env.OPENAI_COMPATIBLE_ALLOWLIST = 'example.com';
        const result = validateBaseUrl('openai-compatible', 'https://evil.example.com');
        expect(result.valid).toBe(false);
      });

      afterEach(() => {
        delete process.env.OPENAI_COMPATIBLE_ALLOWLIST;
      });
    });

    describe('Gemini Trailing Slash Flexibility', () => {
      it('should allow Gemini URLs without trailing slash', () => {
        const result = validateBaseUrl('gemini', 'https://generativelanguage.googleapis.com');
        expect(result.valid).toBe(true);
      });

      it('should allow Gemini URLs with trailing slash', () => {
        const result = validateBaseUrl('gemini', 'https://generativelanguage.googleapis.com/');
        expect(result.valid).toBe(true);
      });

      it('should allow Gemini URLs with paths', () => {
        const result = validateBaseUrl('gemini', 'https://generativelanguage.googleapis.com/v1/models');
        expect(result.valid).toBe(true);
      });
    });

    describe('CRS Escaping Correctness', () => {
      it('should handle CRS_BASE_URL without double-escaping', () => {
        process.env.CRS_BASE_URL = 'https://api.crs.example.com';
        const result = validateBaseUrl('crs', 'https://api.crs.example.com');
        expect(result.valid).toBe(true);
      });

      it('should allow CRS URLs with trailing slash', () => {
        process.env.CRS_BASE_URL = 'https://api.crs.example.com';
        const result = validateBaseUrl('crs', 'https://api.crs.example.com/');
        expect(result.valid).toBe(true);
      });

      it('should allow CRS URLs with paths', () => {
        process.env.CRS_BASE_URL = 'https://api.crs.example.com';
        const result = validateBaseUrl('crs', 'https://api.crs.example.com/v1/endpoint');
        expect(result.valid).toBe(true);
      });

      afterEach(() => {
        delete process.env.CRS_BASE_URL;
      });
    });
  });
});
