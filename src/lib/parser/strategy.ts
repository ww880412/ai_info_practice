/**
 * Parser Strategy Interface - Strategy Pattern
 */
import type { SourceType } from "@prisma/client";

export interface ParseInput {
  type: 'PDF' | 'IMAGE' | 'WEBPAGE' | 'TEXT';
  data: Buffer | string;
  mimeType?: string;
  size: number;
}

export interface ParseMetadata {
  author?: string;
  publishDate?: string;
  keywords?: string[];
  stars?: number;
  topics?: string[];
  language?: string;
}

export interface ParseResult {
  title: string;
  content: string;
  sourceType: SourceType;
  strategy: string;
  processingTime: number;
  metadata?: ParseMetadata;
}

export interface ParseStrategy {
  name: string;
  canHandle(input: ParseInput): boolean;
  execute(input: ParseInput): Promise<ParseResult>;
  fallback?: ParseStrategy;
}
