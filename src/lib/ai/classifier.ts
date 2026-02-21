/**
 * AI Classifier + Extractor (L1 + L2 merged).
 * Single API call for classification and key info extraction.
 */
import { generateJSON } from "../gemini";
import { PROMPTS } from "./prompts";
import type { ContentType, TechDomain, PracticeValue } from "@prisma/client";

export interface ClassifyAndExtractResult {
  contentType: ContentType;
  techDomain: TechDomain;
  aiTags: string[];
  coreSummary: string;
  keyPoints: string[];
  practiceValue: PracticeValue;
  practiceReason: string;
}

export async function classifyAndExtract(
  content: string
): Promise<ClassifyAndExtractResult> {
  // Truncate very long content to avoid token limits
  const truncated = content.length > 15000 ? content.slice(0, 15000) + "\n...(content truncated)" : content;

  const result = await generateJSON<ClassifyAndExtractResult>(
    PROMPTS.classifyAndExtract(truncated)
  );

  return result;
}
