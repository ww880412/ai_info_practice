/**
 * PDF/Image parser - resilient multimodal extraction.
 * For PDF: render pages and extract page-by-page with partial-success tolerance.
 */
import { generateFromFile } from "../ai/generate";
import { z } from "zod";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const FileExtractSchema = z.object({
  title: z.string().optional().default("Uploaded Document"),
  content: z.string().min(1, "Content cannot be empty"),
});

const EXTRACT_FROM_FILE_PROMPT = `提取这个文件/图片中的所有文字内容。

返回格式（严格 JSON，不要添加任何额外文字）：
{
  "title": "文档标题（从内容推断）",
  "content": "提取的完整文字内容（保留原始结构，使用 Markdown 格式）"
}

要求：
- 提取所有可见文字，不要遗漏
- 保留文章结构（标题、段落、列表、代码块等）
- 如果是截图，识别所有文字内容
- 不要进行总结或改写，忠实提取原文`;

interface FileParseResult {
  title: string;
  content: string;
  sourceType: "PDF";
}

interface RenderedPage {
  page: number;
  image: Buffer;
}

interface PageExtractionResult {
  page: number;
  title: string;
  content: string;
}

function parsePositiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isMissingPopplerBinaryError(error: unknown): boolean {
  const message = toErrorMessage(error);
  return /spawn\s+(pdftoppm|pdftotext)\s+ENOENT|pdftoppm failed:.*ENOENT|pdftotext failed:.*ENOENT/i.test(
    message
  );
}

function shouldFallbackToDirectPdfParsing(
  error: unknown,
  directFallbackEnabled: boolean
): boolean {
  if (directFallbackEnabled) return true;
  return isMissingPopplerBinaryError(error);
}

function runCommand(
  command: string,
  args: string[],
  timeoutMs: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      { timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024 },
      (error, _stdout, stderr) => {
        if (error) {
          const stderrText = typeof stderr === "string" ? stderr.trim() : "";
          reject(
            new Error(
              stderrText
                ? `${command} failed: ${stderrText}`
                : `${command} failed: ${error.message}`
            )
          );
          return;
        }
        resolve();
      }
    );
  });
}

function getDefaultMaxPdfPages(fileSizeBytes: number): number {
  const sizeMb = fileSizeBytes / (1024 * 1024);
  if (sizeMb >= 20) return 16;
  if (sizeMb >= 10) return 12;
  return 8;
}

function toRenderedPages(tempDir: string, files: string[], maxPages: number): string[] {
  return files
    .filter((name) => /^page-\d+\.png$/.test(name))
    .sort((a, b) => {
      const left = Number(a.match(/\d+/)?.[0] || "0");
      const right = Number(b.match(/\d+/)?.[0] || "0");
      return left - right;
    })
    .slice(0, maxPages)
    .map((name) => join(tempDir, name));
}

async function renderPdfPagesAsImages(buffer: Buffer): Promise<RenderedPage[]> {
  const defaultMaxPages = getDefaultMaxPdfPages(buffer.length);
  const maxPages = Math.min(
    30,
    parsePositiveNumber(process.env.PARSER_PDF_MAX_IMAGE_PAGES, defaultMaxPages)
  );
  const timeoutMs = parsePositiveNumber(
    process.env.PARSER_PDF_RENDER_TIMEOUT_MS,
    90_000
  );
  const tempDir = await mkdtemp(join(tmpdir(), "ai-info-practice-pdf-images-"));
  const pdfPath = join(tempDir, "input.pdf");
  const outputPrefix = join(tempDir, "page");

  try {
    await writeFile(pdfPath, buffer);
    await runCommand(
      "pdftoppm",
      ["-f", "1", "-l", String(maxPages), "-png", pdfPath, outputPrefix],
      timeoutMs
    );

    const files = await readdir(tempDir);
    const pageFiles = toRenderedPages(tempDir, files, maxPages);
    if (pageFiles.length === 0) return [];

    const pages: RenderedPage[] = [];
    for (const filePath of pageFiles) {
      const match = filePath.match(/page-(\d+)\.png$/);
      const page = Number(match?.[1] || "0");
      pages.push({
        page,
        image: await readFile(filePath),
      });
    }
    return pages;
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

function buildPdfContentFromPages(results: PageExtractionResult[]): string {
  return results
    .map((result) => `[Page ${result.page}]\n${result.content.trim()}`)
    .join("\n\n")
    .trim();
}

async function parsePdfViaPageImages(buffer: Buffer): Promise<FileParseResult> {
  const pages = await renderPdfPagesAsImages(buffer);
  if (pages.length === 0) {
    throw new Error("No rendered pages from PDF");
  }

  const results: PageExtractionResult[] = [];
  const failures: string[] = [];

  for (const page of pages) {
    try {
      const base64 = page.image.toString("base64");
      const result = await generateFromFile<{ title?: string; content?: string }>(
        EXTRACT_FROM_FILE_PROMPT,
        {
          base64,
          mimeType: "image/png",
        }
      );

      const content = (result.content || "").trim();
      if (!content) {
        failures.push(`page ${page.page}: empty content`);
        continue;
      }

      results.push({
        page: page.page,
        title: (result.title || "").trim(),
        content,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`page ${page.page}: ${message}`);
    }
  }

  const minSuccessPages = parsePositiveNumber(
    process.env.PARSER_PDF_MIN_SUCCESS_PAGES,
    1
  );

  if (results.length < minSuccessPages) {
    const reason = failures[0] || "no successful page extraction";
    throw new Error(`PDF page extraction failed: ${reason}`);
  }

  const title =
    results.find((item) => item.title.length > 0)?.title || "Uploaded Document";
  const content = buildPdfContentFromPages(results);

  if (!content) {
    throw new Error("PDF page extraction returned empty content");
  }

  return {
    title,
    content,
    sourceType: "PDF",
  };
}

export async function parseFile(
  buffer: Buffer,
  mimeType: string
): Promise<FileParseResult> {
  if (mimeType.startsWith("application/pdf")) {
    const directFallbackEnabled =
      process.env.PARSER_PDF_ENABLE_DIRECT_FALLBACK === "true";
    try {
      return await parsePdfViaPageImages(buffer);
    } catch (error) {
      if (!shouldFallbackToDirectPdfParsing(error, directFallbackEnabled)) {
        throw error;
      }
    }
  }

  const base64 = buffer.toString("base64");
  const result = await generateFromFile(
    EXTRACT_FROM_FILE_PROMPT,
    { base64, mimeType },
    FileExtractSchema
  );

  return {
    title: result.title || "Uploaded Document",
    content: result.content,
    sourceType: "PDF",
  };
}

export const __internal = {
  getDefaultMaxPdfPages,
  buildPdfContentFromPages,
  shouldFallbackToDirectPdfParsing,
};
