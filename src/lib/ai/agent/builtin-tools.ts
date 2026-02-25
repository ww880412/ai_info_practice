import { z } from 'zod';
import { toolsRegistry } from './tools';
import type { AgentContext } from './types';
import { getGeminiModel } from '@/lib/gemini';
import { findSimilarEntries } from '@/lib/ai/deduplication';
import { DEFAULT_EVALUATION_DIMENSIONS } from './config';

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function getContent(params: Record<string, unknown>, context: AgentContext): string {
  return asString(params.content) ?? asString(context.input.content) ?? '';
}

// evaluate_dimension tool
toolsRegistry.register({
  name: 'evaluate_dimension',
  description: '评估内容的某个维度',
  parameters: z.object({
    dimensionId: z.string(),
    content: z.string().optional(),
    source: z.string().optional(),
  }),
  handler: async (params, context: AgentContext) => {
    const model = getGeminiModel();
    const dimensionId = asString(params.dimensionId);
    if (!dimensionId) {
      return { success: false, error: 'dimensionId is required' };
    }
    const content = getContent(params, context);
    const source = asString(params.source) ?? asString(context.input.sourceType) ?? 'UNKNOWN';

    // 从配置获取维度信息
    const dimension = DEFAULT_EVALUATION_DIMENSIONS.find(d => d.id === dimensionId);

    if (!dimension) {
      return { success: false, error: `Dimension ${dimensionId} not found` };
    }
    if (!content) {
      return { success: false, error: 'No content provided for dimension evaluation' };
    }

    // 构建 prompt
    let prompt = dimension.prompt;
    prompt = prompt.replace('{{source}}', source);
    // 对于 content 类型，需要截断避免超出 token 限制
    const truncatedContent = content.slice(0, 2000);
    prompt = prompt.replace('{{content}}', truncatedContent);

    const result = await model.generateContent(prompt);
    const evaluation = result.response.text();

    // 保存评估结果
    context.evaluations[dimensionId] = evaluation;

    return {
      success: true,
      data: {
        dimension: dimensionId,
        dimensionName: dimension.name,
        evaluation
      }
    };
  },
});

// classify_content tool
toolsRegistry.register({
  name: 'classify_content',
  description: 'Step 1: Classify content and determine structure type',
  parameters: z.object({
    content: z.string().optional(),
    title: z.string().optional(),
    sourceType: z.string().optional(),
  }),
  handler: async (params, context: AgentContext) => {
    const model = getGeminiModel();
    const content = getContent(params, context);
    const title = asString(params.title) ?? asString(context.input.title) ?? '';
    const sourceType = asString(params.sourceType) ?? asString(context.input.sourceType) ?? 'UNKNOWN';

    if (!content) return { success: false, error: 'No content provided for classification' };

    // Build Step 1 prompt (simplified version for tool)
    const sampledContent = content.slice(0, 12000);
    const dimensions = DEFAULT_EVALUATION_DIMENSIONS
      .filter(d => d.enabled)
      .map(d => `- ${d.name}: ${d.description}`)
      .join('\n');

    const prompt = `你是知识结构规划专家，请完成 Step 1：内容分析与结构推理。

输入标题：${title}
输入来源：${sourceType}
输入长度：${content.length} 字符

评估维度：
${dimensions}

内容片段：
${sampledContent}

输出语言要求：
- 所有自然语言字段默认使用简体中文。
- 允许保留必要专业术语（如 RAG、Agent、LLM、API、CLIP、QPS）。

返回严格 JSON（不要 markdown）：
{
  "contentType": "TUTORIAL" | "TOOL_RECOMMENDATION" | "TECH_PRINCIPLE" | "CASE_STUDY" | "OPINION",
  "techDomain": "PROMPT_ENGINEERING" | "AGENT" | "RAG" | "FINE_TUNING" | "DEPLOYMENT" | "OTHER",
  "aiTags": ["string"],
  "summaryStructure": {
    "type": "problem-solution-steps" | "concept-mechanism-flow" | "tool-feature-comparison" | "background-result-insight" | "argument-evidence-condition" | "generic" | "api-reference" | "comparison-matrix" | "timeline-evolution",
    "reasoning": "string",
    "fields": {}
  },
  "keyPoints": {
    "core": ["string"],
    "extended": ["string"]
  },
  "boundaries": {
    "applicable": ["string"],
    "notApplicable": ["string"]
  },
  "confidence": 0.0
}`;

    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return { success: true, data: parsed };
      }
      return { success: false, error: 'Failed to parse classification result' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  },
});

// extract_summary tool
toolsRegistry.register({
  name: 'extract_summary',
  description: 'Step 2: Extract knowledge based on Step 1 structure',
  parameters: z.object({
    content: z.string().optional(),
    title: z.string().optional(),
    sourceType: z.string().optional(),
    step1Result: z.record(z.string(), z.any()).optional(),
  }),
  handler: async (params, context: AgentContext) => {
    const model = getGeminiModel();
    const content = getContent(params, context);
    const title = asString(params.title) ?? asString(context.input.title) ?? '';
    const sourceType = asString(params.sourceType) ?? asString(context.input.sourceType) ?? 'UNKNOWN';
    const step1Result = asRecord(params.step1Result) ?? {};

    if (!content) return { success: false, error: 'No content provided for summary extraction' };

    const contentSnapshot = content.slice(0, 90000);
    const step1Json = JSON.stringify(step1Result, null, 2);
    const contentType = asString(step1Result.contentType);

    let extractionHints = '';
    if (contentType === 'TUTORIAL') {
      extractionHints = `
特别提取要求（TUTORIAL）：
- extractedMetadata.codeExamples: 提取代码示例（language, code, description）
- extractedMetadata.references: 提取参考链接（官方文档、相关博客等）`;
    } else if (contentType === 'TOOL_RECOMMENDATION') {
      extractionHints = `
特别提取要求（TOOL_RECOMMENDATION）：
- extractedMetadata.versionInfo: 提取工具版本信息（tool, version, releaseDate）
- extractedMetadata.references: 提取官方链接和相关资源`;
    }

    const prompt = `你是知识提取专家，请执行 Step 2：基于 Step 1 的结构规划提取完整结果。

Step 1 结果：
${step1Json}

输入标题：${title}
输入来源：${sourceType}
原始内容长度：${content.length} 字符
${extractionHints}

内容：
${contentSnapshot}

输出语言要求：
- 所有自然语言字段默认使用简体中文。
- 允许保留必要专业术语（如 RAG、Agent、LLM、API、CLIP、QPS）。

summaryStructure.type 选择指南：
- "api-reference": API 文档、SDK 参考、函数/方法文档
- "comparison-matrix": 工具对比、框架比较、技术评估
- "timeline-evolution": 版本历史、技术演进、发布说明

返回严格 JSON（不要 markdown）：
{
  "coreSummary": "string",
  "practiceValue": "KNOWLEDGE" | "ACTIONABLE",
  "practiceReason": "string",
  "practiceTask": null | { "title": "string", "summary": "string", "difficulty": "EASY" | "MEDIUM" | "HARD", "estimatedTime": "string", "prerequisites": ["string"], "steps": [{ "order": 1, "title": "string", "description": "string" }] },
  "difficulty": "EASY" | "MEDIUM" | "HARD",
  "sourceTrust": "HIGH" | "MEDIUM" | "LOW",
  "timeliness": "RECENT" | "OUTDATED" | "CLASSIC",
  "contentForm": "TEXTUAL" | "CODE_HEAVY" | "VISUAL" | "MULTIMODAL",
  "summaryStructure": { "type": "...", "reasoning": "string", "fields": {} },
  "keyPoints": { "core": ["string"], "extended": ["string"] },
  "boundaries": { "applicable": ["string"], "notApplicable": ["string"] },
  "confidence": 0.0,
  "extractedMetadata": {}
}`;

    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return { success: true, data: parsed };
      }
      return { success: false, error: 'Failed to parse extraction result' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  },
});

// find_relations tool
toolsRegistry.register({
  name: 'find_relations',
  description: '查找关联知识',
  parameters: z.object({
    content: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }),
  handler: async (params, context: AgentContext) => {
    const content = getContent(params, context);
    if (!content) return { success: false, error: 'No content provided for relation discovery' };
    const similar = await findSimilarEntries(content, 0.3);
    return { success: true, data: similar };
  },
});

// generate_practice tool
toolsRegistry.register({
  name: 'generate_practice',
  description: '生成实践任务',
  parameters: z.object({
    content: z.string().optional(),
    summary: z.string().optional(),
  }),
  handler: async (params, context: AgentContext) => {
    const model = getGeminiModel();
    const content = getContent(params, context);
    const summary =
      asString(params.summary) ??
      (typeof context.evaluations?.extract_summary === 'string'
        ? context.evaluations.extract_summary
        : '');
    if (!content) return { success: false, error: 'No content provided for practice generation' };
    const prompt = `根据以下内容生成实践任务：\n\n摘要：${summary}\n\n详细内容：${content.slice(0, 5000)}`;
    const result = await model.generateContent(prompt);
    return { success: true, data: result.response.text() };
  },
});

// extract_notes tool
toolsRegistry.register({
  name: 'extract_notes',
  description: '提取知识笔记',
  parameters: z.object({
    content: z.string().optional(),
  }),
  handler: async (params, context: AgentContext) => {
    const model = getGeminiModel();
    const content = getContent(params, context);
    if (!content) return { success: false, error: 'No content provided for note extraction' };
    const prompt = `从以下内容提取知识笔记：\n\n${content.slice(0, 5000)}`;
    const result = await model.generateContent(prompt);
    return { success: true, data: result.response.text() };
  },
});

// store_knowledge tool
toolsRegistry.register({
  name: 'store_knowledge',
  description: '存储到知识库',
  parameters: z.object({
    data: z.record(z.string(), z.any()),
  }),
  handler: async (params) => {
    const data = asRecord(params.data) ?? {};
    // 实际存储逻辑由 Agent 引擎处理
    return { success: true, data: { stored: true, data } };
  },
});

// extract_code tool (for TUTORIAL content)
toolsRegistry.register({
  name: 'extract_code',
  description: 'Extract code examples from TUTORIAL content',
  parameters: z.object({
    content: z.string().optional(),
  }),
  handler: async (params, context: AgentContext) => {
    const model = getGeminiModel();
    const content = getContent(params, context);
    if (!content) return { success: false, error: 'No content provided for code extraction' };

    const prompt = `从以下教程内容中提取代码示例。返回 JSON 格式：

内容：
${content.slice(0, 20000)}

返回格式：
{
  "codeExamples": [
    {
      "language": "string (e.g., python, javascript, bash)",
      "code": "string (actual code)",
      "description": "string (what this code does)",
      "runnable": boolean (can this code be run directly?)
    }
  ]
}`;

    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return { success: true, data: parsed };
      }
      return { success: false, error: 'Failed to parse code extraction result' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  },
});

// extract_version tool (for TOOL_RECOMMENDATION content)
toolsRegistry.register({
  name: 'extract_version',
  description: 'Extract version info and alternatives from TOOL_RECOMMENDATION content',
  parameters: z.object({
    content: z.string().optional(),
  }),
  handler: async (params, context: AgentContext) => {
    const model = getGeminiModel();
    const content = getContent(params, context);
    if (!content) return { success: false, error: 'No content provided for version extraction' };

    const prompt = `从以下工具推荐内容中提取版本信息和替代方案。返回 JSON 格式：

内容：
${content.slice(0, 20000)}

返回格式：
{
  "versionInfo": {
    "tool": "string (tool name)",
    "version": "string (current version)",
    "releaseDate": "string (optional)",
    "compatibility": ["string (compatible platforms/versions)"]
  },
  "alternatives": [
    {
      "name": "string",
      "comparison": "string (how it compares to main tool)"
    }
  ]
}`;

    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return { success: true, data: parsed };
      }
      return { success: false, error: 'Failed to parse version extraction result' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  },
});

export { toolsRegistry };
