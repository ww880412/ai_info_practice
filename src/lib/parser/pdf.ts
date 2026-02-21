/**
 * PDF/Image parser - uses Gemini multimodal to extract text content.
 */
import { generateFromFile } from "../gemini";
import { PROMPTS } from "../ai/prompts";

interface FileParseResult {
  title: string;
  content: string;
  sourceType: "PDF";
}

export async function parseFile(
  buffer: Buffer,
  mimeType: string
): Promise<FileParseResult> {
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
