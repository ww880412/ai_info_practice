/**
 * Practice Converter (L3).
 * Converts ACTIONABLE content into structured practice tasks with steps.
 */
import { generateJSON } from "./generate";
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

function buildConvertToPracticePrompt(content: string, summary: string): string {
  return `你是一个实践指导专家。将以下 AI 技术内容拆解为具体可操作的实践步骤。

内容摘要：${summary}

原始内容：
${content}

返回格式（严格 JSON，不要添加任何额外文字）：
{
  "title": "实践任务标题",
  "summary": "任务总结（50字以内）",
  "difficulty": "EASY" | "MEDIUM" | "HARD",
  "estimatedTime": "预计时间（如：30分钟、2小时）",
  "prerequisites": ["前置条件1", "前置条件2"],
  "steps": [
    {
      "order": 1,
      "title": "步骤标题",
      "description": "详细操作说明"
    }
  ]
}

难度说明：
- EASY: <30分钟，无特殊环境要求
- MEDIUM: 1-3小时，需要基本开发环境
- HARD: 数小时以上，需要特殊资源或深度知识

要求：
- 步骤要具体可执行，不要笼统
- 前置条件列出需要的工具、环境、账号等
- 每个步骤的 description 要足够详细，让人照着做`;
}

export async function convertToPractice(
  content: string,
  summary: string
): Promise<PracticeConvertResult> {
  const truncated = content.length > 15000 ? content.slice(0, 15000) + "\n...(content truncated)" : content;

  const result = await generateJSON<PracticeConvertResult>(
    buildConvertToPracticePrompt(truncated, summary)
  );

  return result;
}
