import { generateJSON } from "../gemini";

export interface SmartSummaryResult {
  conciseSummary: string;
  keyInsights: string[];
  "tl;DR": string;
}

const SMART_SUMMARY_PROMPT = `You are an AI that creates concise, actionable summaries.

Analyze the following content and create:
1. A concise summary (2-3 sentences max)
2. Key insights (3-5 bullet points)
3. A one-line TL;DR

Content:
{content}

Respond in JSON format:
{
  "conciseSummary": "...",
  "keyInsights": ["...", "..."],
  "tl;DR": "..."
}`;

export async function generateSmartSummary(content: string): Promise<SmartSummaryResult> {
  const prompt = SMART_SUMMARY_PROMPT.replace("{content}", content.slice(0, 8000));
  return generateJSON<SmartSummaryResult>(prompt);
}
