/**
 * Generic webpage parser - Jina Reader primary, cheerio fallback.
 */
import * as cheerio from "cheerio";
import type { ParseMetadata } from "./strategy";
import { parseWithJina } from "./jina";

interface WebpageParseResult {
  title: string;
  content: string;
  sourceType: "WEBPAGE" | "WECHAT" | "TWITTER";
  metadata?: ParseMetadata;
}

export function isWeChatUrl(url: string): boolean {
  return url.includes("mp.weixin.qq.com");
}

export function isTwitterUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname === 'twitter.com' || hostname === 'www.twitter.com' ||
           hostname === 'x.com' || hostname === 'www.x.com';
  } catch {
    return false;
  }
}

function detectSourceType(url: string): WebpageParseResult["sourceType"] {
  if (isWeChatUrl(url)) return "WECHAT";
  if (isTwitterUrl(url)) return "TWITTER";
  return "WEBPAGE";
}

function extractMetadata($: ReturnType<typeof cheerio.load>): ParseMetadata {
  const metadata: ParseMetadata = {};

  // Extract author
  const author =
    $("meta[property='og:author']").attr("content") ||
    $("meta[name='author']").attr("content") ||
    $("meta[property='article:author']").attr("content");
  if (author) metadata.author = author.trim();

  // Extract publish date
  const publishDate =
    $("meta[property='article:published_time']").attr("content") ||
    $("meta[name='date']").attr("content") ||
    $("meta[property='og:published_time']").attr("content");
  if (publishDate) metadata.publishDate = publishDate.trim();

  // Extract keywords
  const keywordsStr = $("meta[name='keywords']").attr("content");
  if (keywordsStr) {
    metadata.keywords = keywordsStr
      .split(",")
      .map(k => k.trim())
      .filter(k => k.length > 0);
  }

  return metadata;
}

export async function parseWebpage(url: string): Promise<WebpageParseResult> {
  const sourceType = detectSourceType(url);

  // Primary: Try Jina Reader (supports JS-rendered pages)
  const jinaResult = await parseWithJina(url);
  if (jinaResult.success && jinaResult.content.length > 100) {
    // Try to extract metadata even when Jina succeeds
    const metadata = await extractMetadataFromUrl(url).catch(() => undefined);
    return {
      title: jinaResult.title,
      content: jinaResult.content,
      sourceType,
      metadata,
    };
  }

  // Store Jina error for better debugging
  const jinaError = jinaResult.error;

  // Fallback: Use cheerio (static HTML only)
  try {
    return await parseWithCheerio(url, sourceType);
  } catch (cheerioError) {
    // Combine errors for better debugging
    const cheerioMessage = cheerioError instanceof Error ? cheerioError.message : String(cheerioError);
    const combinedMessage = jinaError
      ? `Jina failed: ${jinaError}; Cheerio failed: ${cheerioMessage}`
      : cheerioMessage;
    throw new Error(combinedMessage);
  }
}

/**
 * Extract metadata from URL without full content parsing
 */
async function extractMetadataFromUrl(url: string): Promise<ParseMetadata> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
    signal: AbortSignal.timeout(5000), // Short timeout for metadata only
  });

  if (!response.ok) {
    return {};
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  return extractMetadata($);
}

/**
 * Parse webpage using cheerio (fallback for static content)
 */
async function parseWithCheerio(
  url: string,
  sourceType: WebpageParseResult["sourceType"]
): Promise<WebpageParseResult> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // Extract metadata
  const metadata = extractMetadata($);

  // Remove noise elements
  $("script, style, nav, footer, header, aside, .sidebar, .ads, .comment, .navigation").remove();

  // Extract title
  const title =
    $("meta[property='og:title']").attr("content") ||
    $("title").text().trim() ||
    $("h1").first().text().trim() ||
    "Untitled";

  // Extract main content - try common content selectors
  let content = "";
  const contentSelectors = [
    "article",
    "#js_content", // WeChat article content
    ".rich_media_content", // WeChat
    "main",
    ".post-content",
    ".article-content",
    ".entry-content",
    '[role="main"]',
  ];

  for (const selector of contentSelectors) {
    const el = $(selector);
    if (el.length && el.text().trim().length > 100) {
      content = el.text().trim();
      break;
    }
  }

  // Fallback: collect all paragraphs
  if (!content) {
    const paragraphs: string[] = [];
    $("p").each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 20) paragraphs.push(text);
    });
    content = paragraphs.join("\n\n");
  }

  if (!content || content.length < 50) {
    throw new Error(
      "Failed to extract meaningful content from URL. Please upload a screenshot or PDF instead."
    );
  }

  return { title, content, sourceType, metadata };
}
