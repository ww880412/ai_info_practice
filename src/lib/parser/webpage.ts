/**
 * Generic webpage parser using cheerio.
 */
import * as cheerio from "cheerio";
import type { ParseMetadata } from "./strategy";

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
  return url.includes("twitter.com") || url.includes("x.com");
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
  let sourceType: WebpageParseResult["sourceType"] = "WEBPAGE";
  if (isWeChatUrl(url)) sourceType = "WECHAT";
  if (isTwitterUrl(url)) sourceType = "TWITTER";

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
