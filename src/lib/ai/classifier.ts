/**
 * AI Classifier + Extractor (L1 + L2 merged).
 * Single API call for classification and key info extraction.
 */
import { generateJSON } from "./generate";
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

function buildClassifyAndExtractPrompt(content: string): string {
  return `你是一个 AI 领域知识分析专家。分析以下内容并返回 JSON。

内容：
${content}

返回格式（严格 JSON，不要添加任何额外文字）：
{
  "contentType": "TUTORIAL" | "TOOL_RECOMMENDATION" | "TECH_PRINCIPLE" | "CASE_STUDY" | "OPINION",
  "techDomain": "PROMPT_ENGINEERING" | "AGENT" | "RAG" | "FINE_TUNING" | "DEPLOYMENT" | "OTHER",
  "aiTags": ["标签1", "标签2", "标签3"],
  "coreSummary": "一句话核心观点（30字以内）",
  "keyPoints": ["技术点1", "技术点2", "技术点3"],
  "practiceValue": "KNOWLEDGE" | "ACTIONABLE",
  "practiceReason": "判断理由"
}

分类说明：
- contentType: TUTORIAL=教程, TOOL_RECOMMENDATION=工具推荐, TECH_PRINCIPLE=技术原理, CASE_STUDY=实战案例, OPINION=观点讨论
- techDomain: 根据内容主题判断最相关的领域
- practiceValue: KNOWLEDGE=了解即可的知识, ACTIONABLE=可以立即动手实践的内容
- aiTags: 3-5个具体技术标签，如具体工具名、方法名、框架名`;
}

export async function classifyAndExtract(
  content: string
): Promise<ClassifyAndExtractResult> {
  // Truncate very long content to avoid token limits
  const truncated = content.length > 15000 ? content.slice(0, 15000) + "\n...(content truncated)" : content;

  const result = await generateJSON<ClassifyAndExtractResult>(
    buildClassifyAndExtractPrompt(truncated)
  );

  return result;
}
