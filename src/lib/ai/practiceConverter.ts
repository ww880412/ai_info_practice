/**
 * Practice Converter (L3).
 * Converts ACTIONABLE content into structured practice tasks with steps.
 */
import { generateJSON } from "../gemini";
import { PROMPTS } from "./prompts";
import type { Difficulty } from "@prisma/client";

export interface PracticeConvertResult {
  title: string;
  summary: string;
  difficulty: Difficulty;
  estimatedTime: string;
  prerequisites: string[];
  steps: {
    order: number;
    title: string;
    description: string;
  }[];
}

export async function convertToPractice(
  content: string,
  summary: string
): Promise<PracticeConvertResult> {
  const truncated = content.length > 15000 ? content.slice(0, 15000) + "\n...(content truncated)" : content;

  const result = await generateJSON<PracticeConvertResult>(
    PROMPTS.convertToPractice(truncated, summary)
  );

  return result;
}
