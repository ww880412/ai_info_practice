/**
 * Jina Reader - AI-powered webpage content extraction
 * Supports JavaScript-rendered pages and provides clean markdown output
 */

const JINA_READER_TIMEOUT = 30000;
const MIN_CONTENT_LENGTH = 100;

export interface JinaParseResult {
  title: string;
  content: string;
  success: boolean;
  error?: string;
}

/**
 * Parse webpage content using Jina Reader API
 * @param url - The URL to parse
 * @returns Parsed content in markdown format
 */
export async function parseWithJina(url: string): Promise<JinaParseResult> {
  try {
    // Jina Reader API - free tier, no API key required
    const response = await fetch(`https://r.jina.ai/${encodeURIComponent(url)}`, {
      headers: {
        'Accept': 'text/markdown',
        'X-Return-Format': 'markdown',
      },
      signal: AbortSignal.timeout(JINA_READER_TIMEOUT),
    });

    if (!response.ok) {
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

    return {
      title,
      content: markdown,
      success: true,
    };
  } catch (error) {
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
