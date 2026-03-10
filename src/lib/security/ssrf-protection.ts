/**
 * SSRF Protection Module
 *
 * Validates URLs to prevent Server-Side Request Forgery attacks by:
 * - Blocking private IP addresses
 * - Enforcing provider-specific allowlists
 * - Supporting environment variable configuration
 */

const PRIVATE_IP_RANGES = [
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[01])\./,
  /^192\.168\./,
  /^127\./,
  /^169\.254\./,
  /^\[?::1\]?$/,
  /^\[?fe80:/i,
  /^\[?fc00:/i,
  /^\[?fd00:/i,
];

function getAllowedBaseUrls(provider: string): RegExp[] {
  switch (provider) {
    case 'gemini':
      return [/^https:\/\/generativelanguage\.googleapis\.com\//];

    case 'crs': {
      const patterns: RegExp[] = [];
      const baseUrl = process.env.CRS_BASE_URL || 'https://api\\.crs\\.example\\.com';
      patterns.push(new RegExp(`^${baseUrl.replace(/\./g, '\\.')}/?`));
      if (process.env.CRS_BASE_URL_PATTERN) {
        patterns.push(new RegExp(process.env.CRS_BASE_URL_PATTERN));
      }
      return patterns;
    }

    case 'openai-compatible': {
      const patterns: RegExp[] = [
        /^http:\/\/localhost:\d+/,
        /^http:\/\/127\.0\.0\.1:\d+/,
        /^http:\/\/host\.docker\.internal:\d+/,
      ];
      if (process.env.OPENAI_COMPATIBLE_ALLOWLIST) {
        const hosts = process.env.OPENAI_COMPATIBLE_ALLOWLIST.split(',');
        hosts.forEach(host => {
          const trimmed = host.trim().replace(/\./g, '\\.');
          // Match URLs with or without authentication
          patterns.push(new RegExp(`^https://(?:[^@]+@)?${trimmed}`));
        });
      }
      return patterns;
    }

    default:
      return [];
  }
}

export interface ValidationResult {
  valid: boolean;
  warning?: string;
  error?: string;
}

export function validateBaseUrl(provider: string, baseUrl: string): ValidationResult {
  try {
    const url = new URL(baseUrl);
    const hostname = url.hostname;

    // Check allowlist first (before private IP check)
    // This allows localhost/127.0.0.1 for openai-compatible provider
    const patterns = getAllowedBaseUrls(provider);
    if (patterns.length === 0) {
      return { valid: false, error: `No allowlist configured for provider: ${provider}` };
    }

    const matchesAllowlist = patterns.some(pattern => pattern.test(baseUrl));

    // If it matches allowlist, check if it's a private IP
    // Only block private IPs that aren't explicitly allowed
    if (matchesAllowlist) {
      return { valid: true };
    }

    // Check private IPs for non-allowlisted URLs
    if (PRIVATE_IP_RANGES.some(pattern => pattern.test(hostname))) {
      return { valid: false, error: 'Private IP addresses are not allowed' };
    }

    const warning = provider === 'openai-compatible' && baseUrl.startsWith('https://') && !baseUrl.startsWith('https://localhost')
      ? 'Custom HTTPS endpoints must be explicitly allowlisted via OPENAI_COMPATIBLE_ALLOWLIST'
      : undefined;

    return { valid: false, warning, error: 'URL does not match allowlist patterns' };
  } catch (error) {
    return { valid: false, error: 'Invalid URL format' };
  }
}
