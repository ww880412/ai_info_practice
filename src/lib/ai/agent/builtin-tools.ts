import { z } from 'zod';
import { toolsRegistry } from './tools';
import type { AgentContext } from './types';
import { getGeminiModel } from '@/lib/gemini';
import { findSimilarEntries } from '@/lib/ai/deduplication';

// evaluate_dimension tool
toolsRegistry.register({
  name: 'evaluate_dimension',
  description: '评估内容的某个维度',
  parameters: z.object({
    dimensionId: z.string(),
    content: z.string(),
    source: z.string().optional(),
  }),
  handler: async (params, context) => {
    const model = getGeminiModel();
    const prompt = `评估以下内容的${params.dimensionId}维度：\n\n${params.content}\n\n请返回评估结果和理由。`;
    const result = await model.generateContent(prompt);
    const evaluation = result.response.text();

    context.evaluations[params.dimensionId] = evaluation;

    return { success: true, data: { dimension: params.dimensionId, evaluation } };
  },
});

// classify_content tool
toolsRegistry.register({
  name: 'classify_content',
  description: '对内容进行分类',
  parameters: z.object({
    content: z.string(),
  }),
  handler: async (params) => {
    const model = getGeminiModel();
    const prompt = `对以下内容进行分类，返回 JSON 格式：\n\n${params.content}\n\n分类维度：contentType, techDomain, aiTags`;
    const result = await model.generateContent(prompt);
    return { success: true, data: result.response.text() };
  },
});

// extract_summary tool
toolsRegistry.register({
  name: 'extract_summary',
  description: '提取内容摘要',
  parameters: z.object({
    content: z.string(),
    type: z.enum(['brief', 'detailed', 'tldr']).default('brief'),
  }),
  handler: async (params) => {
    const model = getGeminiModel();
    const typeMap: Record<string, string> = {
      brief: '简短摘要',
      detailed: '详细摘要',
      tldr: 'TL;DR 要点总结',
    };
    const typeKey = params.type as string;
    const prompt = `提取以下内容的${typeMap[typeKey]}：\n\n${params.content}`;
    const result = await model.generateContent(prompt);
    return { success: true, data: result.response.text() };
  },
});

// find_relations tool
toolsRegistry.register({
  name: 'find_relations',
  description: '查找关联知识',
  parameters: z.object({
    content: z.string(),
    tags: z.array(z.string()).optional(),
  }),
  handler: async (params) => {
    const similar = await findSimilarEntries(params.content, 0.3);
    return { success: true, data: similar };
  },
});

// generate_practice tool
toolsRegistry.register({
  name: 'generate_practice',
  description: '生成实践任务',
  parameters: z.object({
    content: z.string(),
    summary: z.string(),
  }),
  handler: async (params) => {
    const model = getGeminiModel();
    const prompt = `根据以下内容生成实践任务：\n\n摘要：${params.summary}\n\n详细内容：${params.content.slice(0, 5000)}`;
    const result = await model.generateContent(prompt);
    return { success: true, data: result.response.text() };
  },
});

// extract_notes tool
toolsRegistry.register({
  name: 'extract_notes',
  description: '提取知识笔记',
  parameters: z.object({
    content: z.string(),
  }),
  handler: async (params) => {
    const model = getGeminiModel();
    const prompt = `从以下内容提取知识笔记：\n\n${params.content.slice(0, 5000)}`;
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
    // 实际存储逻辑由 Agent 引擎处理
    return { success: true, data: { stored: true, data: params.data } };
  },
});

export { toolsRegistry };
