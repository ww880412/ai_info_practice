/**
 * Jina Reader - AI-powered webpage content extraction
 * Supports JavaScript-rendered pages and provides clean markdown output
 */

const JINA_READER_TIMEOUT = 15000; // Reduced from 30s to avoid long delays
const MIN_CONTENT_LENGTH = 100;
const CIRCUIT_BREAKER_THRESHOLD = 3;
const CIRCUIT_BREAKER_RESET_MS = 60_000; // 1 minute

let consecutiveFailures = 0;
let lastFailureTime = 0;

const SENSITIVE_PARAMS = [
  'token', 'api_key', 'apikey', 'key', 'secret', 'password', 'pwd',
  'access_token', 'auth', 'auth_token', 'session', 'sessionid',
  'credential', 'sig', 'signature', 'private_token',
];

export interface JinaParseResult {
  title: string;
  content: string;
  success: boolean;
  error?: string;
}

/**
 * Check if Jina Reader is enabled via environment variable
 */
export function isJinaEnabled(): boolean {
  return process.env.PARSER_JINA_ENABLED !== 'false';
}

/**
 * Sanitize URL by removing sensitive query parameters
 */
function sanitizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const keysToDelete: string[] = [];

    urlObj.searchParams.forEach((_, key) => {
      const lowerKey = key.toLowerCase();
      // Use exact match to avoid false positives (e.g., 'monkey' matching 'key')
      if (SENSITIVE_PARAMS.some(p => lowerKey === p)) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => urlObj.searchParams.delete(key));
    return urlObj.toString();
  } catch {
    return url;
  }
}

/**
 * Parse webpage content using Jina Reader API
 * @param url - The URL to parse
 * @returns Parsed content in markdown format
 */
export async function parseWithJina(url: string): Promise<JinaParseResult> {
  // Check if Jina is enabled
  if (!isJinaEnabled()) {
    return {
      title: '',
      content: '',
      success: false,
      error: 'Jina Reader is disabled',
    };
  }

  // Circuit breaker: skip if too many recent failures
  const now = Date.now();
  if (consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
    if (now - lastFailureTime < CIRCUIT_BREAKER_RESET_MS) {
      return {
        title: '',
        content: '',
        success: false,
        error: `Circuit breaker open (${consecutiveFailures} consecutive failures)`,
      };
    }
    // Reset circuit breaker after timeout
    consecutiveFailures = 0;
  }

  try {
    // Sanitize URL to remove sensitive query parameters before sending to Jina
    const sanitizedUrl = sanitizeUrl(url);

    // Jina Reader API - free tier, no API key required
    // Using x-respond-with header per official documentation
    const response = await fetch(`https://r.jina.ai/${encodeURIComponent(sanitizedUrl)}`, {
      headers: {
        'Accept': 'text/markdown',
        'x-respond-with': 'markdown',
      },
      signal: AbortSignal.timeout(JINA_READER_TIMEOUT),
    });

    if (!response.ok) {
      // Track failure for circuit breaker (only 429/5xx are service issues)
      const status = response.status;
      if (status === 429 || status >= 500) {
        consecutiveFailures++;
        lastFailureTime = now;
      }
      return {
        title: '',
        content: '',
        success: false,
        error: `Jina Reader returned ${response.status}: ${response.statusText}`,
      };
    }

    const markdown = await response.text();

    // Validate we got meaningful content
    if (!markdown || markdown.length < MIN_CONTENT_LENGTH) {
      return {
        title: '',
        content: '',
        success: false,
        error: 'Content too short or empty',
      };
    }

    // Extract title from markdown (first heading)
    const titleMatch = markdown.match(/^#\s+(.+)$/m);
    const title = titleMatch?.[1]?.trim() || extractTitleFromUrl(url);

    // Success: reset circuit breaker
    consecutiveFailures = 0;

    return {
      title,
      content: markdown,
      success: true,
    };
  } catch (error) {
    // Track failure for circuit breaker (network/timeout errors)
    consecutiveFailures++;
    lastFailureTime = Date.now();

    return {
      title: '',
      content: '',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Extract a fallback title from URL
 */
function extractTitleFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    // Get last path segment or hostname
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    if (pathParts.length > 0) {
      const last = pathParts[pathParts.length - 1];
      // Remove file extension and decode
      return decodeURIComponent(last.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '));
    }
    return urlObj.hostname;
  } catch {
    return url;
  }
}
