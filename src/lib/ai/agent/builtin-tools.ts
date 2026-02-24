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
  description: '对内容进行分类',
  parameters: z.object({
    content: z.string().optional(),
  }),
  handler: async (params, context: AgentContext) => {
    const model = getGeminiModel();
    const content = getContent(params, context);
    if (!content) return { success: false, error: 'No content provided for classification' };
    const prompt = `对以下内容进行分类，返回 JSON 格式：\n\n${content.slice(0, 5000)}\n\n分类维度：contentType, techDomain, aiTags`;
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return { success: true, data: JSON.parse(jsonMatch[0]) };
      } catch {
        // Fall through to raw text
      }
    }
    return { success: true, data: text };
  },
});

// extract_summary tool
toolsRegistry.register({
  name: 'extract_summary',
  description: '提取内容摘要',
  parameters: z.object({
    content: z.string().optional(),
    type: z.enum(['brief', 'detailed', 'tldr']).default('brief'),
  }),
  handler: async (params, context: AgentContext) => {
    const model = getGeminiModel();
    const content = getContent(params, context);
    if (!content) return { success: false, error: 'No content provided for summary extraction' };
    const typeMap: Record<string, string> = {
      brief: '简短摘要',
      detailed: '详细摘要',
      tldr: 'TL;DR 要点总结',
    };
    const requestedType = asString(params.type);
    const typeKey = requestedType === 'detailed' || requestedType === 'tldr' ? requestedType : 'brief';
    const prompt = `提取以下内容的${typeMap[typeKey]}：\n\n${content.slice(0, 5000)}`;
    const result = await model.generateContent(prompt);
    return { success: true, data: result.response.text() };
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

export { toolsRegistry };
