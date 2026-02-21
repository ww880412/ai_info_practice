/**
 * Generic webpage parser using cheerio.
 */
import * as cheerio from "cheerio";

interface WebpageParseResult {
  title: string;
  content: string;
  sourceType: "WEBPAGE" | "WECHAT" | "TWITTER";
}

export function isWeChatUrl(url: string): boolean {
  return url.includes("mp.weixin.qq.com");
}

export function isTwitterUrl(url: string): boolean {
  return url.includes("twitter.com") || url.includes("x.com");
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

  return { title, content, sourceType };
}
