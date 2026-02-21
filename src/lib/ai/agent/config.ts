import type { AgentConfig, EvaluationDimension, ProcessingStrategy } from './types';

export const DEFAULT_EVALUATION_DIMENSIONS: EvaluationDimension[] = [
  {
    id: 'source',
    name: '来源可信度',
    description: '评估内容来源的权威性',
    prompt: '评估以下内容来源的可靠程度：{{source}}。返回 HIGH/MEDIUM/LOW 并说明理由。',
    weight: 0.2,
    enabled: true,
  },
  {
    id: 'timeliness',
    name: '时效性',
    description: '评估内容的时效性',
    prompt: '评估以下内容的时效性：{{content}}。返回 RECENT/OUTDATED/CLASSIC。',
    weight: 0.15,
    enabled: true,
  },
  {
    id: 'completeness',
    name: '完整度',
    description: '评估内容完整程度',
    prompt: '评估以下内容的完整度：{{content}}。返回 COMPLETE/FRAGMENT/INCREMENTAL。',
    weight: 0.2,
    enabled: true,
  },
  {
    id: 'form',
    name: '内容形式',
    description: '识别主要内容形式',
    prompt: '识别以下内容的主要形式：{{content}}。返回 TEXTUAL/CODE_HEAVY/VISUAL/MULTIMODAL。',
    weight: 0.15,
    enabled: true,
  },
  {
    id: 'difficulty',
    name: '难度级别',
    description: '评估内容难度',
    prompt: '评估以下内容的难度：{{content}}。返回 BEGINNER/INTERMEDIATE/ADVANCED/EXPERT。',
    weight: 0.2,
    enabled: true,
  },
];

export const DEFAULT_PROCESSING_STRATEGIES: ProcessingStrategy[] = [
  {
    type: 'PRACTICE',
    name: '实践任务',
    description: '完整教程，可生成实践任务',
    condition: '内容完整、有明确操作步骤、技术深度适中',
    outputSchema: {
      title: 'string',
      summary: 'string',
      difficulty: 'EASY|MEDIUM|HARD',
      estimatedTime: 'string',
      prerequisites: 'string[]',
      steps: 'object[]',
    },
  },
  {
    type: 'NOTE',
    name: '知识笔记',
    description: '碎片知识点，记录即可',
    condition: '碎片信息、技术点、概念解释',
    outputSchema: {
      title: 'string',
      summary: 'string',
      keyPoints: 'string[]',
      tags: 'string[]',
    },
  },
  {
    type: 'COLLECTION',
    name: '工具收藏',
    description: '工具、资源收藏',
    condition: '工具推荐、资源列表、插件库',
    outputSchema: {
      title: 'string',
      items: 'object[]',
      categories: 'string[]',
      notes: 'string',
    },
  },
  {
    type: 'RESEARCH',
    name: '研究材料',
    description: '深入研究材料',
    condition: '深度分析、论文、架构讨论',
    outputSchema: {
      title: 'string',
      abstract: 'string',
      keyFindings: 'string[]',
      questions: 'string[]',
      relatedTopics: 'string[]',
    },
  },
];

export function getDefaultConfig(): AgentConfig {
  return {
    evaluationDimensions: DEFAULT_EVALUATION_DIMENSIONS,
    processingStrategies: DEFAULT_PROCESSING_STRATEGIES,
    availableTools: [
      'evaluate_dimension',
      'classify_content',
      'extract_summary',
      'generate_practice',
      'extract_notes',
      'translate_content',
      'find_relations',
      'store_knowledge',
    ],
    maxIterations: 10,
  };
}
