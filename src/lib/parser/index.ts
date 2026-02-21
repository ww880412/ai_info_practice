/**
 * Unified content parser - routes to the appropriate parser based on input.
 * Uses Strategy Pattern for extensible parser architecture.
 */
import { isGitHubUrl, parseGitHub } from "./github";
import { parseWebpage, isWeChatUrl, isTwitterUrl } from "./webpage";
import { parseFile } from "./pdf";
import { TextStrategy } from "./text";
import { PdfTextStrategy } from "./pdf-text";
import { OcrStrategy } from "./ocr";
import { ImageMultimodalStrategy } from "./image-multimodal";
import type { SourceType } from "@prisma/client";
import type { ParseInput, ParseResult as StrategyParseResult, ParseStrategy } from "./strategy";
import { ParserRegistry, parserRegistry } from "./registry";

// Re-export strategy types for external use
export type { ParseInput, ParseStrategy } from "./strategy";
export { parserRegistry } from "./registry";

/**
 * Legacy ParseResult interface for backward compatibility
 */
export interface ParseResult {
  title: string;
  content: string;
  sourceType: SourceType;
}

/**
 * GitHub Strategy - handles GitHub URLs
 */
const githubStrategy: ParseStrategy = {
  name: "github",
  canHandle: (input: ParseInput): boolean => {
    return input.type === "TEXT" && typeof input.data === "string" && isGitHubUrl(input.data);
  },
  execute: async (input: ParseInput): Promise<StrategyParseResult> => {
    const result = await parseGitHub(input.data as string);
    return {
      title: result.title,
      content: result.content,
      sourceType: result.sourceType,
      strategy: "github",
      processingTime: 0,
    };
  },
};

/**
 * Webpage Strategy - handles generic webpages, WeChat, Twitter
 */
const webpageStrategy: ParseStrategy = {
  name: "webpage",
  canHandle: (input: ParseInput): boolean => {
    return input.type === "WEBPAGE" || (input.type === "TEXT" && typeof input.data === "string" && !isGitHubUrl(input.data));
  },
  execute: async (input: ParseInput): Promise<StrategyParseResult> => {
    const url = input.data as string;
    const result = await parseWebpage(url);
    return {
      title: result.title,
      content: result.content,
      sourceType: result.sourceType,
      strategy: "webpage",
      processingTime: 0,
    };
  },
};

/**
 * PDF Strategy - handles PDF and image files
 */
const pdfStrategy: ParseStrategy = {
  name: "pdf",
  canHandle: (input: ParseInput): boolean => {
    if (input.type === "PDF" || input.type === "IMAGE") return true;
    if (input.mimeType) {
      return input.mimeType.startsWith("application/pdf") || input.mimeType.startsWith("image/");
    }
    return false;
  },
  execute: async (input: ParseInput): Promise<StrategyParseResult> => {
    const buffer = input.data as Buffer;
    const mimeType = input.mimeType || "application/pdf";
    const result = await parseFile(buffer, mimeType);
    return {
      title: result.title,
      content: result.content,
      sourceType: result.sourceType,
      strategy: "pdf",
      processingTime: 0,
    };
  },
};

/**
 * Initialize registry with strategies
 * Order matters: more specific strategies should be registered first
 */
function initializeRegistry() {
  parserRegistry.register(githubStrategy);
  parserRegistry.register(webpageStrategy);

  // Image strategies: OCR first (for small images), then multimodal fallback
  // Must register before PDF strategy since pdfStrategy also handles IMAGE
  const imageMultimodalStrategy = new ImageMultimodalStrategy();
  const ocrStrategy = new OcrStrategy();
  ocrStrategy.setFallback(imageMultimodalStrategy);
  parserRegistry.register(ocrStrategy);
  parserRegistry.register(imageMultimodalStrategy);

  // PDF strategies: PdfTextStrategy first (for text-based PDFs), then fallback to pdfStrategy (multimodal)
  const pdfTextStrategy = new PdfTextStrategy();
  pdfTextStrategy.setFallback(pdfStrategy);
  parserRegistry.register(pdfTextStrategy);
  parserRegistry.register(pdfStrategy);

  const textStrategy = new TextStrategy();
  parserRegistry.register(textStrategy);
}

// Initialize on module load
initializeRegistry();

/**
 * Parse content using the strategy registry
 */
export async function parseWithStrategy(input: ParseInput): Promise<StrategyParseResult> {
  return parserRegistry.parse(input);
}

/**
 * Parse content from a URL.
 * @deprecated Use parseWithStrategy instead
 */
export async function parseUrl(url: string): Promise<ParseResult> {
  if (isGitHubUrl(url)) {
    return parseGitHub(url);
  }
  return parseWebpage(url);
}

/**
 * Parse content from an uploaded file (PDF/image).
 * @deprecated Use parseWithStrategy instead
 */
export async function parseUploadedFile(
  buffer: Buffer,
  mimeType: string
): Promise<ParseResult> {
  return parseFile(buffer, mimeType);
}

// Re-export utility functions
export { isGitHubUrl } from "./github";
export { isWeChatUrl, isTwitterUrl } from "./webpage";
