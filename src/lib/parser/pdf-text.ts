/**
 * PDF Text Strategy - extracts text from PDF using pdftotext
 * Falls back to multimodal approach for scanned/image-based PDFs
 */
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ParseStrategy, ParseInput, ParseResult } from './strategy';
import { SourceType } from '@prisma/client';

interface PdfTextStrategyOptions {
  timeoutMs?: number;
  minTextLength?: number;
  extractor?: (buffer: Buffer) => Promise<string>;
}

function parsePositiveNumber(
  value: string | undefined,
  fallback: number
): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
    }),
  ]);
}

export class PdfTextStrategy implements ParseStrategy {
  name = 'PdfTextStrategy';
  fallback?: ParseStrategy;
  private timeoutMs: number;
  private minTextLength: number;
  private extractor: (buffer: Buffer) => Promise<string>;

  constructor(options: PdfTextStrategyOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? parsePositiveNumber(
      process.env.PARSER_PDF_TEXT_TIMEOUT_MS,
      20_000
    );
    this.minTextLength = options.minTextLength ?? parsePositiveNumber(
      process.env.PARSER_PDF_MIN_TEXT_LENGTH,
      80
    );
    this.extractor = options.extractor ?? this.extractWithPdfToText.bind(this);
  }

  setFallback(strategy: ParseStrategy) {
    this.fallback = strategy;
  }

  canHandle(input: ParseInput): boolean {
    return input.type === 'PDF' && input.size < 20 * 1024 * 1024;
  }

  async execute(input: ParseInput): Promise<ParseResult> {
    const start = Date.now();
    const buffer = input.data as Buffer;

    try {
      const rawText = await withTimeout(
        this.extractor(buffer),
        this.timeoutMs,
        `PdfTextStrategy timeout after ${this.timeoutMs}ms`
      );

      const content = rawText.replace(/\u0000/g, '').trim();
      if (!content || content.length < this.minTextLength) {
        throw new Error(
          `PdfTextStrategy insufficient text (${content.length} < ${this.minTextLength})`
        );
      }

      const firstLine = content
        .split('\n')
        .map((line) => line.trim())
        .find((line) => line.length > 0);

      const title = firstLine?.slice(0, 50) ||
        'PDF Document';

      return {
        title,
        content,
        sourceType: 'PDF' as SourceType,
        strategy: this.name,
        processingTime: Date.now() - start,
      };
    } catch (error) {
      if (this.fallback) {
        return this.fallback.execute(input);
      }
      throw error;
    }
  }

  private async extractWithPdfToText(buffer: Buffer): Promise<string> {
    const tempDir = await mkdtemp(join(tmpdir(), 'ai-info-practice-pdf-'));
    const tempPdfPath = join(tempDir, 'input.pdf');

    try {
      await writeFile(tempPdfPath, buffer);

      const { stdout } = await new Promise<{ stdout: string; stderr: string }>(
        (resolve, reject) => {
          execFile(
            'pdftotext',
            ['-layout', '-enc', 'UTF-8', tempPdfPath, '-'],
            {
              timeout: this.timeoutMs,
              maxBuffer: 20 * 1024 * 1024,
              encoding: 'utf8',
            },
            (error, stdout, stderr) => {
              if (error) {
                reject(
                  new Error(
                    stderr?.trim()
                      ? `pdftotext failed: ${stderr.trim()}`
                      : `pdftotext failed: ${error.message}`
                  )
                );
                return;
              }

              resolve({
                stdout,
                stderr,
              });
            }
          );
        }
      );

      return stdout;
    } finally {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
