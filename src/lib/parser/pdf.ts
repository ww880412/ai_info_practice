/**
 * PDF/Image parser - uses Gemini multimodal to extract text content.
 */
import { generateFromFile } from "../gemini";
import { PROMPTS } from "../ai/prompts";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

interface FileParseResult {
  title: string;
  content: string;
  sourceType: "PDF";
}

function parsePositiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
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

async function renderPdfPagesAsImages(buffer: Buffer): Promise<Buffer[]> {
  const maxPages = parsePositiveNumber(process.env.PARSER_PDF_MAX_IMAGE_PAGES, 3);
  const timeoutMs = parsePositiveNumber(process.env.PARSER_PDF_RENDER_TIMEOUT_MS, 90_000);
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
    const pageFiles = files
      .filter((name) => /^page-\d+\.png$/.test(name))
      .sort((a, b) => {
        const left = Number(a.match(/\d+/)?.[0] || "0");
        const right = Number(b.match(/\d+/)?.[0] || "0");
        return left - right;
      })
      .slice(0, maxPages);

    if (pageFiles.length === 0) return [];

    const images: Buffer[] = [];
    for (const pageFile of pageFiles) {
      images.push(await readFile(join(tempDir, pageFile)));
    }
    return images;
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function parsePdfViaPageImages(buffer: Buffer): Promise<FileParseResult | null> {
  const pageImages = await renderPdfPagesAsImages(buffer);
  if (pageImages.length === 0) return null;

  const prompt = PROMPTS.extractFromFile();
  const pageResults: Array<{ title?: string; content?: string }> = [];

  for (const imageBuffer of pageImages) {
    const base64 = imageBuffer.toString("base64");
    const result = await generateFromFile<{ title?: string; content?: string }>(prompt, {
      base64,
      mimeType: "image/png",
    });
    pageResults.push(result);
  }

  const content = pageResults
    .map((result) => result.content?.trim())
    .filter((value): value is string => Boolean(value))
    .join("\n\n")
    .trim();

  if (!content) return null;

  const title = pageResults.find((result) => result.title?.trim())?.title?.trim() || "Uploaded Document";
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
    try {
      const pageBased = await parsePdfViaPageImages(buffer);
      if (pageBased) return pageBased;
    } catch {
      // Fall through to the direct-file approach below.
    }
  }

  const base64 = buffer.toString("base64");

  const result = await generateFromFile<{ title: string; content: string }>(
    PROMPTS.extractFromFile(),
    { base64, mimeType }
  );

  return {
    title: result.title || "Uploaded Document",
    content: result.content,
    sourceType: "PDF",
  };
}
