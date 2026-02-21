/**
 * All AI prompt templates for knowledge processing pipeline.
 */
export const PROMPTS = {
  /**
   * L1 Classification + L2 Extraction (merged to save API calls).
   */
  classifyAndExtract: (content: string) =>
    `你是一个 AI 领域知识分析专家。分析以下内容并返回 JSON。

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
- aiTags: 3-5个具体技术标签，如具体工具名、方法名、框架名`,

  /**
   * L3 Practice conversion (only called for ACTIONABLE entries).
   */
  convertToPractice: (content: string, summary: string) =>
    `你是一个实践指导专家。将以下 AI 技术内容拆解为具体可操作的实践步骤。

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
- 每个步骤的 description 要足够详细，让人照着做`,

  /**
   * Extract content from PDF/screenshot via multimodal.
   */
  extractFromFile: () =>
    `提取这个文件/图片中的所有文字内容。

返回格式（严格 JSON，不要添加任何额外文字）：
{
  "title": "文档标题（从内容推断）",
  "content": "提取的完整文字内容（保留原始结构，使用 Markdown 格式）"
}

要求：
- 提取所有可见文字，不要遗漏
- 保留文章结构（标题、段落、列表、代码块等）
- 如果是截图，识别所有文字内容
- 不要进行总结或改写，忠实提取原文`,
};
