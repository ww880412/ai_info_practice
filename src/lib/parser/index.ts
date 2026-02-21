/**
 * Unified content parser - routes to the appropriate parser based on input.
 */
import { isGitHubUrl, parseGitHub } from "./github";
import { parseWebpage } from "./webpage";
import { parseFile } from "./pdf";
import type { SourceType } from "@prisma/client";

export interface ParseResult {
  title: string;
  content: string;
  sourceType: SourceType;
}

/**
 * Parse content from a URL.
 */
export async function parseUrl(url: string): Promise<ParseResult> {
  if (isGitHubUrl(url)) {
    return parseGitHub(url);
  }
  return parseWebpage(url);
}

/**
 * Parse content from an uploaded file (PDF/image).
 */
export async function parseUploadedFile(
  buffer: Buffer,
  mimeType: string
): Promise<ParseResult> {
  return parseFile(buffer, mimeType);
}

export { isGitHubUrl } from "./github";
export { isWeChatUrl, isTwitterUrl } from "./webpage";
