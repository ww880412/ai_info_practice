# Knowledge Agent Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** 实现 ReAct Agent 驱动的知识摄入系统，包含解析层优化和 AI 处理层重构

**Architecture:** 解析层采用策略模式支持动态选择和降级；AI 处理层采用 ReAct Agent 实现多维度评估和动态路由

**Tech Stack:** Next.js 16, TypeScript, Prisma, Gemini API

---

## Phase 1: 解析层优化

### Task 1: 重构 Parser 架构 - 策略模式基础

**Files:**
- Create: `src/lib/parser/strategy.ts`
- Modify: `src/lib/parser/index.ts`

**Step 1: 创建策略接口**

```typescript
// src/lib/parser/strategy.ts

export interface ParseInput {
  type: 'PDF' | 'IMAGE' | 'WEBPAGE' | 'TEXT';
  data: Buffer | string;
  mimeType?: string;
  size: number;
}

export interface ParseResult {
  title: string;
  content: string;
  sourceType: "GITHUB" | "WECHAT" | "TWITTER" | "WEBPAGE" | "PDF" | "TEXT";
  strategy: string;
  processingTime: number;
}

export interface ParseStrategy {
  name: string;
  canHandle(input: ParseInput): boolean;
  execute(input: ParseInput): Promise<ParseResult>;
  fallback?: ParseStrategy;
}
```

**Step 2: 创建策略注册器**

```typescript
// src/lib/parser/registry.ts

import type { ParseStrategy, ParseInput, ParseResult } from './strategy';

export class ParserRegistry {
  private strategies: ParseStrategy[] = [];

  register(strategy: ParseStrategy) {
    this.strategies.push(strategy);
  }

  async parse(input: ParseInput): Promise<ParseResult> {
    // 按优先级尝试
    for (const strategy of this.strategies) {
      if (strategy.canHandle(input)) {
        try {
          return await strategy.execute(input);
        } catch (error) {
          // 尝试降级
          if (strategy.fallback) {
            return await strategy.fallback.execute(input);
          }
          throw error;
        }
      }
    }
    throw new Error('No strategy can handle this input');
  }
}

 = new ParserRegistryexport const parserRegistry 3: 修改入口
// src/lib文件**

```typescript();
```

**Step/parser/index.ts

importRegistry } from './ { parserregistry';
import { TextStrategy } from './text';
import { WebpageStrategy } from './webpage';
import { PdfTextStrategy } from './pdf-text';
import { PdfImageStrategy } from './pdf-image';
import { OcrStrategy } from './ocr';
import { ImageMultimodalStrategy } from './image-multimodal';

// 注册策略（按优先级）
parserRegistry.register(new TextStrategy());
parserRegistry.register(new WebpageStrategy());
parserRegistry.register(new PdfTextStrategy());
parserRegistry.register(new PdfImageStrategy());
parserRegistry.register(new OcrStrategy());
parserRegistry.register(new ImageMultimodalStrategy());

export async function parseContent(input: ParseInput): Promise<ParseResult> {
  return parserRegistry.parse(input);
}

export { ParseInput, ParseResult } from './strategy';
```

**Step 4: Commit**

```bash
git add src/lib/parser/strategy.ts src/lib/parser/registry.ts src/lib/parser/index.ts
git commit -m "feat(parser): add strategy pattern for content parsing"
```

---

### Task 2: 实现 TextStrategy 和 WebpageStrategy

**Files:**
- Create: `src/lib/parser/text.ts`
- Modify: `src/lib/parser/webpage.ts`

**Step 1: 创建 TextStrategy**

```typescript
// src/lib/parser/text.ts

import type { ParseStrategy, ParseInput, ParseResult } from './strategy';

export class TextStrategy implements ParseStrategy {
  name = 'TextStrategy';

  canHandle(input: ParseInput): boolean {
    return input.type === 'TEXT' || typeof input.data === 'string';
  }

  async execute(input: ParseInput): Promise<ParseResult> {
    const start = Date.now();
    const content = input.data as string;

    // 提取标题（取前50字符）
    const title = content.slice(0, 50).replace(/[\\n\\r]/g, ' ').trim();

    return {
      title: title || 'Text Entry',
      content,
      sourceType: 'TEXT',
      strategy: this.name,
      processingTime: Date.now() - start,
    };
  }
}
```

**Step 2: 修改 WebpageStrategy（复用现有代码）**

```typescript
// src/lib/parser/webpage.ts - 简化并包装为策略

import { parseWebpage as _parseWebpage } from './webpage-original';
import type { ParseStrategy, ParseInput, ParseResult } from './strategy';

export class WebpageStrategy implements ParseStrategy {
  name = 'WebpageStrategy';

  canHandle(input: ParseInput): boolean {
    return input.type === 'WEBPAGE';
  }

  async execute(input: ParseInput): Promise<ParseResult> {
    const start = Date.now();
    const url = input.data as string;

    const parsed = await _parseWebpage(url);

    return {
      title: parsed.title,
      content: parsed.content,
      sourceType: 'WEBPAGE',
      strategy: this.name,
      processingTime: Date.now() - start,
    };
  }
}
```

**Step 3: Commit**

```bash
git add src/lib/parser/text.ts src/lib/parser/webpage.ts
git commit -m "feat(parser): implement TextStrategy and WebpageStrategy"
```

---

### Task 3: 实现 PdfTextStrategy（文字提取）

**Files:**
- Create: `src/lib/parser/pdf-text.ts`
- Modify: `package.json`

**Step 1: 安装 pdf-parse**

```bash
npm install pdf-parse --save
npm install @types/pdf-parse --save-dev
```

**Step 2: 创建 PdfTextStrategy**

```typescript
// src/lib/parser/pdf-text.ts

import pdf from 'pdf-parse';
import type { ParseStrategy, ParseInput, ParseResult } from './strategy';

export class PdfTextStrategy implements ParseStrategy {
  name = 'PdfTextStrategy';
  fallback?: ParseStrategy; // 降级策略

  setFallback(strategy: ParseStrategy) {
    this.fallback = strategy;
  }

  canHandle(input: ParseInput): boolean {
    return input.type === 'PDF' && input.size < 20 * 1024 * 1024;
  }

  async execute(input: ParseInput): Promise<ParseResult> {
    const start = Date.now();
    const buffer = input.data as Buffer;

    try {
      const data = await pdf(buffer);

      // 提取标题（从 PDF 元数据或第一行）
      const title = data.info?.Title || data.text.slice(0, 50).split('\\n')[0].trim() || 'PDF Document';

      return {
        title,
        content: data.text,
        sourceType: 'PDF',
        strategy: this.name,
        processingTime: Date.now() - start,
      };
    } catch (error) {
      // 降级到多模态
      if (this.fallback) {
        return this.fallback.execute(input);
      }
      throw error;
    }
  }
}
```

**Step 3: Commit**

```bash
git add src/lib/parser/pdf-text.ts package.json package-lock.json
git commit -m "feat(parser): add PdfTextStrategy for text extraction from PDF"
```

---

### Task 4: 实现 PdfImageStrategy 和大文件降级

**Files:**
- Create: `src/lib/parser/pdf-image.ts`
- Modify: `src/lib/parser/registry.ts`

**Step 1: 创建 PdfImageStrategy**

```typescript
// src/lib/parser/pdf-image.ts

import { generateFromFile } from '../gemini';
import { PROMPTS } from '../ai/prompts';
import type { ParseStrategy, ParseInput, ParseResult } from './strategy';

export class PdfImageStrategy implements ParseStrategy {
  name = 'PdfImageStrategy';

  canHandle(input: ParseInput): boolean {
    return input.type === 'PDF';
  }

  async execute(input: ParseInput): Promise<ParseResult> {
    const start = Date.now();
    const buffer = input.data as Buffer;
    const base64 = buffer.toString('base64');

    const result = await generateFromFile<{ title: string; content: string }>(
      PROMPTS.extractFromFile(),
      { base64, mimeType: 'application/pdf' }
    );

    return {
      title: result.title || 'PDF Document',
      content: result.content,
      sourceType: 'PDF',
      strategy: this.name,
      processingTime: Date.now() - start,
    };
  }
}
```

**Step 2: 更新注册器配置降级链**

```typescript
// src/lib/parser/registry.ts 中配置

import { PdfTextStrategy } from './pdf-text';
import { PdfImageStrategy } from './pdf-image';

// 创建策略实例并配置降级
const pdfText = new PdfTextStrategy();
const pdfImage = new PdfImageStrategy();
pdfText.setFallback(pdfImage);

// 注册（PdfText 优先）
parserRegistry.register(pdfText);
```

**Step 3: Commit**

```bash
git add src/lib/parser/pdf-image.ts src/lib/parser/registry.ts
git commit -m "feat(parser): add PdfImageStrategy with fallback for large PDFs"
```

---

### Task 5: 实现图片 OCR 策略

**Files:**
- Create: `src/lib/parser/ocr.ts`
- Create: `src/lib/parser/image-multimodal.ts`

**Step 1: 安装 Tesseract**

```bash
npm install tesseract.js --save
```

**Step 2: 创建 OcrStrategy**

```typescript
// src/lib/parser/ocr.ts

import Tesseract from 'tesseract.js';
import type { ParseStrategy, ParseInput, ParseResult } from './strategy';

export class OcrStrategy implements ParseStrategy {
  name = 'OcrStrategy';
  fallback?: ParseStrategy;

  setFallback(strategy: ParseStrategy) {
    this.fallback = strategy;
  }

  canHandle(input: ParseInput): boolean {
    return input.type === 'IMAGE' && input.mimeType?.startsWith('image/');
  }

  async execute(input: ParseInput): Promise<ParseResult> {
    const start = Date.now();
    const buffer = input.data as Buffer;

    try {
      const { data: { text } } = await Tesseract.recognize(
        buffer,
        'chi_sim+eng', // 中文+英文
        { logger: () => {} }
      );

      return {
        title: 'OCR Document',
        content: text,
        sourceType: 'TEXT',
        strategy: this.name,
        processingTime: Date.now() - start,
      };
    } catch (error) {
      if (this.fallback) {
        return this.fallback.execute(input);
      }
      throw error;
    }
  }
}
```

**Step 3: 创建 ImageMultimodalStrategy**

```typescript
// src/lib/parser/image-multimodal.ts

import { generateFromFile } from '../gemini';
import { PROMPTS } from '../ai/prompts';
import type { ParseStrategy, ParseInput, ParseResult } from './strategy';

export class ImageMultimodalStrategy implements ParseStrategy {
  name = 'ImageMultimodalStrategy';

  canHandle(input: ParseInput): boolean {
    return input.type === 'IMAGE';
  }

  async execute(input: ParseInput): Promise<ParseResult> {
    const start = Date.now();
    const buffer = input.data as Buffer;
    const base64 = buffer.toString('base64');

    const result = await generateFromFile<{ title: string; content: string }>(
      PROMPTS.extractFromFile(),
      { base64, mimeType: input.mimeType || 'image/png' }
    );

    return {
      title: result.title || 'Image',
      content: result.content,
      sourceType: 'TEXT',
      strategy: this.name,
      processingTime: Date.now() - start,
    };
  }
}
```

**Step 4: Commit**

```bash
git add src/lib/parser/ocr.ts src/lib/parser/image-multimodal.ts package.json package-lock.json
git commit -m "feat(parser): add OCR and multimodal strategies for images"
```

---

### Task 6: 添加 ParseLog 模型和记录

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `src/lib/parser/logger.ts`
- Modify: `src/lib/parser/registry.ts`

**Step 1: 更新 Prisma Schema**

```prisma
// prisma/schema.prisma 添加

model ParseLog {
  id            String   @id @default(cuid())
  entryId       String
  strategy      String
  inputSize     Int
  outputSize    Int
  processingTime Int
  success       Boolean
  error         String?
  createdAt    DateTime @default(now())

  entry         Entry   @relation(fields: [entryId], references: [id])
}
```

**Step 2: 运行 Prisma 生成**

```bash
npx prisma generate
```

**Step 3: 创建 logger**

```typescript
// src/lib/parser/logger.ts

import { prisma } from '@/lib/prisma';

export async function logParse({
  entryId,
  strategy,
  inputSize,
  outputSize,
  processingTime,
  success,
  error,
}: {
  entryId: string;
  strategy: string;
  inputSize: number;
  outputSize: number;
  processingTime: number;
  success: boolean;
  error?: string;
}) {
  await prisma.parseLog.create({
    data: {
      entryId,
      strategy,
      inputSize,
      outputSize,
      processingTime,
      success,
      error,
    },
  });
}
```

**Step 4: 在注册器中集成日志**

```typescript
// src/lib/parser/registry.ts 添加日志

export async function parseWithLogging(
  entryId: string,
  input: ParseInput
): Promise<ParseResult> {
  const start = Date.now();
  const inputSize = input.data.length;

  try {
    const result = await parserRegistry.parse(input);

    await logParse({
      entryId,
      strategy: result.strategy,
      inputSize,
      outputSize: result.content.length,
      processingTime: Date.now() - start,
      success: true,
    });

    return result;
  } catch (error) {
    await logParse({
      entryId,
      strategy: 'FAILED',
      inputSize,
      outputSize: 0,
      processingTime: Date.now() - start,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
```

**Step 5: Commit**

```bash
git add prisma/schema.prisma src/lib/parser/logger.ts src/lib/parser/registry.ts
npx prisma generate
git add prisma/generated
git commit -m "feat(parser): add ParseLog model and logging"
```

---

## Phase 2: Agent 基础框架

### Task 7: 实现 Config Manager

**Files:**
- Create: `src/lib/ai/agent/config.ts`
- Create: `src/lib/ai/agent/types.ts`

**Step 1: 创建类型定义**

```typescript
// src/lib/ai/agent/types.ts

export interface EvaluationDimension {
  id: string;
  name: string;
  description: string;
  prompt: string;
  weight?: number;
  enabled: boolean;
}

export interface ProcessingStrategy {
  type: 'NOTE' | 'PRACTICE' | 'COLLECTION' | 'RESEARCH' | 'DISCARD';
  name: string;
  description: string;
  condition: string;
  outputSchema: object;
}

export interface AgentConfig {
  evaluationDimensions: EvaluationDimension[];
  processingStrategies: ProcessingStrategy[];
  availableTools: string[];
  maxIterations: number;
}

export interface ReasoningStep {
  step: number;
  timestamp: string;
  thought: string;
  action: string;
  observation: string;
  reasoning: string;
  context: any;
  error?: string;
}

export interface ReasoningTrace {
  entryId: string;
  input: ParseResult;
  steps: ReasoningStep[];
  finalResult: any;
  metadata: {
    startTime: string;
    endTime: string;
    iterations: number;
    toolsUsed: string[];
  };
}
```

**Step 2: 创建 Config Manager**

```typescript
// src/lib/ai/agent/config.ts

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
```

**Step 3: Commit**

```bash
git add src/lib/ai/agent/types.ts src/lib/ai/agent/config.ts
git commit -m "feat(agent): add Config Manager with default dimensions and strategies"
```

---

### Task 8: 实现 Tools Registry

**Files:**
- Create: `src/lib/ai/agent/tools.ts`

**Step 1: 创建工具基类和注册器**

```typescript
// src/lib/ai/agent/tools.ts

import { z } from 'zod';
import type { AgentContext } from './types';

export interface Tool {
  name: string;
  description: string;
  parameters: z.ZodSchema;
  handler: (params: any, context: AgentContext) => Promise<ToolResult>;
}

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
}

export class ToolsRegistry {
  private tools: Map<string, Tool> = new Map();

  register(tool: Tool) {
    this.tools.set(tool.name, tool);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  list(): Tool[] {
    return Array.from(this.tools.values());
  }

  async execute(action: string, params: any, context: AgentContext): Promise<ToolResult> {
    const [toolName] = action.split('_').slice(0, 2);
    const tool = this.tools.get(toolName);

    if (!tool) {
      return { success: false, error: `Tool ${toolName} not found` };
    }

    try {
      const validatedParams = tool.parameters.parse(params);
      const result = await tool.handler(validatedParams, context);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

export const toolsRegistry = new ToolsRegistry();
```

**Step 2: 注册内置工具**

```typescript
// src/lib/ai/agent/builtin-tools.ts

import { toolsRegistry } from './tools';
import { getGeminiModel } from '@/lib/gemini';
import { findSimilarEntries } from '@/lib/ai/deduplication';

// 注册所有内置工具
export function registerBuiltinTools() {
  // evaluate_dimension
  toolsRegistry.register({
    name: 'evaluate_dimension',
    description: '评估内容的某个维度',
    parameters: z.object({
      dimensionId: z.string(),
      content: z.string(),
    }),
    handler: async (params) => {
      const model = getGeminiModel();
      const prompt = `评估以下内容的${params.dimensionId}维度：${params.content}`;
      const result = await model.generateContent(prompt);
      return { success: true, data: result.response.text() };
    },
  });

  // classify_content
  toolsRegistry.register({
    name: 'classify_content',
    description: '对内容进行分类',
    parameters: z.object({
      content: z.string(),
    }),
    handler: async (params) => {
      const model = getGeminiModel();
      const prompt = `分类以下内容，返回 JSON：${params.content}`;
      const result = await model.generateContent(prompt);
      return { success: true, data: result.response.text() };
    },
  });

  // extract_summary
  toolsRegistry.register({
    name: 'extract_summary',
    description: '提取内容摘要',
    parameters: z.object({
      content: z.string(),
      type: z.enum(['brief', 'detailed', 'tldr']).default('brief'),
    }),
    handler: async (params) => {
      const model = getGeminiModel();
      const prompt = `提取以下内容的${params.type}摘要：${params.content}`;
      const result = await model.generateContent(prompt);
      return { success: true, data: result.response.text() };
    },
  });

  // find_relations
  toolsRegistry.register({
    name: 'find_relations',
    description: '查找关联知识',
    parameters: z.object({
      content: z.string(),
      tags: z.array(z.string()),
    }),
    handler: async (params) => {
      const similar = await findSimilarEntries(params.content, 0.3);
      return { success: true, data: similar };
    },
  });
}
```

**Step 3: Commit**

```bash
git add src/lib/ai/agent/tools.ts src/lib/ai/agent/builtin-tools.ts
git commit -me "feat(agent): implement Tools Registry with built-in tools"
```

---

### Task 9: 实现 ReAct Loop 引擎

**Files:**
- Create: `src/lib/ai/agent/engine.ts`

**Step 1: 创建 ReAct Agent 引擎**

```typescript
// src/lib/ai/agent/engine.ts

import type { AgentConfig, AgentContext, ReasoningStep, ReasoningTrace } from './types';
import type { ParseResult } from '@/lib/parser/strategy';
import { toolsRegistry } from './tools';
import { getGeminiModel } from '@/lib/gemini';
import { prisma } from '@/lib/prisma';

export class ReActAgent {
  private config: AgentConfig;
  private maxIterations: number;

  constructor(config: AgentConfig) {
    this.config = config;
    this.maxIterations = config.maxIterations || 10;
  }

  async process(entryId: string, input: ParseResult): Promise<ReasoningTrace> {
    const steps: ReasoningStep[] = [];
    const startTime = new Date().toISOString();
    const toolsUsed: string[] = [];

    const context: AgentContext = {
      input,
      evaluations: {},
      observations: [],
      history: steps,
    };

    // 构建系统提示
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(input);

    let iteration = 0;
    let isDone = false;
    let finalResult: any = null;

    while (!isDone && iteration < this.maxIterations) {
      iteration++;

      // 1. Thought - LLM 决定下一步
      const llmResponse = await this.callLLM(systemPrompt, userPrompt, context);
      const { thought, action, reasoning } = this.parseLLMResponse(llmResponse);

      // 2. Action - 执行工具
      let observation: string;
      try {
        const toolResult = await toolsRegistry.execute(action.action, action.params, context);
        observation = toolResult.success
          ? JSON.stringify(toolResult.data)
          : `Error: ${toolResult.error}`;

        if (!toolsUsed.includes(action.action)) {
          toolsUsed.push(action.action);
        }
      } catch (error) {
        observation = `Error: ${error instanceof Error ? error.message : String(error)}`;
      }

      // 3. 记录推理步骤
      steps.push({
        step: iteration,
        timestamp: new Date().toISOString(),
        thought,
        action: action.action,
        observation,
        reasoning,
        context: { inputLength: input.content.length },
      });

      // 4. 检查是否完成
      isDone = this.checkDone(steps, context);

      // 5. 如果完成，提取结果
      if (isDone) {
        finalResult = this.extractResult(steps);
      }

      // 6. 更新上下文
      context.observations.push(observation);
    }

    // 7. 保存推理轨迹
    const trace = await this.saveTrace(entryId, input, steps, finalResult, {
      startTime,
      endTime: new Date().toISOString(),
      iterations: iteration,
      toolsUsed,
    });

    return trace;
  }

  private buildSystemPrompt(): string {
    const tools = this.config.availableTools.map(t => `- ${t}`).join('\\n');
    const dimensions = this.config.evaluationDimensions
      .filter(d => d.enabled)
      .map(d => `- ${d.name}: ${d.description}`)
      .join('\\n');
    const strategies = this.config.processingStrategies
      .map(s => `- ${s.type}: ${s.condition}`)
      .join('\\n');

    return `你是一个知识管理专家。根据内容特征，动态选择处理方式。

## 可用工具
${tools}

## 评估维度
${dimensions}

## 处理策略
${strategies}

## 输出格式
每一步用以下格式：
THINK: [你的思考]
ACTION: [工具名_操作] [参数]
REASONING: [决策理由]
OBSERVATION: [工具返回结果]

完成时用：
FINAL: [最终结果 JSON]`;
  }

  private buildUserPrompt(input: ParseResult): string {
    return `内容标题：${input.title}
内容类型：${input.sourceType}
内容长度：${input.content.length} 字符

内容：
${input.content.slice(0, 2000)}`;
  }

  private parseLLMResponse(response: string) {
    const thoughtMatch = response.match(/THINK:\\s*([\\s\\S]*?)(?=ACTION:|$)/);
    const actionMatch = response.match(/ACTION:\\s*(\\w+)\\s*(.*)/);
    const reasoningMatch = response.match(/REASONING:\\s*([\\s\\S]*?)(?=OBSERVATION:|$)/);
    const observationMatch = response.match(/OBSERVATION:\\s*([\\s\\S]*?)(?=FINAL:|$)/);

    return {
      thought: thoughtMatch?.[1]?.trim() || '',
      action: {
        action: actionMatch?.[1]?.trim() || '',
        params: actionMatch?.[2]?.trim() || '{}',
      },
      reasoning: reasoningMatch?.[1]?.trim() || '',
      observation: observationMatch?.[1]?.trim() || '',
    };
  }

  private checkDone(steps: ReasoningStep[], context: AgentContext): boolean {
    const lastStep = steps[steps.length - 1];
    if (!lastStep) return false;
    return lastStep.observation.includes('FINAL:');
  }

  private extractResult(steps: ReasoningStep[]): any {
    const lastStep = steps[steps.length - 1];
    if (!lastStep) return null;

    const finalMatch = lastStep.observation.match(/FINAL:\\s*([\\s\\S]*)/);
    if (finalMatch) {
      try {
        return JSON.parse(finalMatch[1]);
      } catch {
        return finalMatch[1];
      }
    }
    return null;
  }

  private async callLLM(system: string, user: string, context: AgentContext) {
    const model = getGeminiModel();
    const history = context.history.map(s =>
      `Step ${s.step}: ${s.thought}\\nAction: ${s.action}\\nObservation: ${s.observation}`
    ).join('\\n\\n');

    const prompt = `${system}\\n\\n历史步骤:\\n${history}\\n\\n当前:\\n${user}`;
    const result = await model.generateContent(prompt);
    return result.response.text();
  }

  private async saveTrace(
    entryId: string,
    input: ParseResult,
    steps: ReasoningStep[],
    finalResult: any,
    metadata: ReasoningTrace['metadata']
  ): Promise<ReasoningTrace> {
    const trace = await prisma.reasoningTrace.create({
      data: {
        entryId,
        steps: JSON.stringify(steps),
        finalResult: JSON.stringify(finalResult),
        metadata: JSON.stringify(metadata),
      },
    });

    return {
      entryId,
      input,
      steps,
      finalResult,
      metadata,
    };
  }
}
```

**Step 2: Commit**

```bash
git add src/lib/ai/agent/engine.ts
git commit -m "feat(agent): implement ReAct Loop Engine"
```

---

### Task 10: 创建 ReasoningTrace Prisma 模型

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: 添加模型**

```prisma
// prisma/schema.prisma 添加

model ReasoningTrace {
  id          String   @id @default(cuid())
  entryId     String
  steps       Json
  finalResult Json
  metadata    Json
  createdAt   DateTime @default(now())

  entry       Entry    @relation(fields: [entryId], references: [id])
}
```

**Step 2: 运行 Prisma**

```bash
npx prisma generate
npx prisma db push
```

**Step 3: Commit**

```bash
git add prisma/schema.prisma
npx prisma generate
git add prisma/
git commit -m "feat(db): add ReasoningTrace and ParseLog models"
```

---

## Phase 3: Agent 智能化

### Task 11: 实现评估维度处理

**Files:**
- Modify: `src/lib/ai/agent/builtin-tools.ts`

**Step 1: 添加 evaluate_dimension 完整实现**

```typescript
// 在 builtin-tools.ts 中添加

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

    // 获取维度配置
    const dimension = DEFAULT_EVALUATION_DIMENSIONS.find(d => d.id === params.dimensionId);
    if (!dimension) {
      return { success: false, error: `Dimension ${params.dimensionId} not found` };
    }

    // 构建 prompt
    let prompt = dimension.prompt.replace('{{content}}', params.content);
    if (params.source) {
      prompt = prompt.replace('{{source}}', params.source);
    }

    const result = await model.generateContent(prompt);
    const evaluation = result.response.text();

    // 保存评估结果
    context.evaluations[params.dimensionId] = evaluation;

    return { success: true, data: { dimension: params.dimensionId, evaluation } };
  },
});
```

**Step 2: Commit**

```bash
git commit -m "feat(agent): implement dimension evaluation tool"
```

---

### Task 12: 实现策略路由

**Files:**
- Modify: `src/lib/ai/agent/builtin-tools.ts`

**Step 1: 添加路由工具**

```typescript
// 添加 route_to_strategy 工具

toolsRegistry.register({
  name: 'route_to_strategy',
  description: '根据评估结果选择处理策略',
  parameters: z.object({
    evaluations: z.record(z.string()),
    content: z.string(),
  }),
  handler: async (params, context) => {
    const model = getGeminiModel();

    const strategies = DEFAULT_PROCESSING_STRATEGIES.map(s =>
      `${s.type}: ${s.condition}`
    ).join('\\n');

    const evaluations = Object.entries(params.evaluations)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\\n');

    const prompt = `根据以下评估结果，选择最合适的处理策略：

评估结果：
${evaluations}

可用策略：
${strategies}

返回格式（JSON）：
{
  "strategy": "策略类型",
  "confidence": 0.0-1.0,
  "reason": "选择理由"
}`;

    const result = await model.generateContent(prompt);

    try {
      const jsonMatch = result.response.text().match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch?.[0] || '{}');
      return { success: true, data: parsed };
    } catch {
      return { success: false, error: 'Failed to parse strategy selection' };
    }
  },
});
```

**Step 2: Commit**

```bash
git commit -m "feat(agent): add strategy routing tool"
```

---

### Task 13: 实现前端推理可视化

**Files:**
- Create: `src/components/agent/ReasoningTraceView.tsx`

**Step 1: 创建组件**

```tsx
// src/components/agent/ReasoningTraceView.tsx

'use client';

import { useState } from 'react';

interface ReasoningStep {
  step: number;
  thought: string;
  action: string;
  observation: string;
  reasoning: string;
}

interface ReasoningTraceViewProps {
  steps: ReasoningStep[];
}

export function ReasoningTraceView({ steps }: ReasoningTraceViewProps) {
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">推理过程</h3>

      <div className="space-y-2">
        {steps.map((step, index) => (
          <div
            key={step.step}
            className="border rounded-lg overflow-hidden"
          >
            <button
              onClick={() => setExpandedStep(expandedStep === index ? null : index)}
              className="w-full px-4 py-3 text-left bg-muted hover:bg-muted/80 flex items-center gap-3"
            >
              <span className="text-sm font-medium text-muted-foreground">
                步骤 {step.step}
              </span>
              <span className="text-sm truncate">{step.thought}</span>
            </button>

            {expandedStep === index && (
              <div className="p-4 space-y-3 text-sm">
                <div>
                  <span className="font-medium">思考：</span>
                  <p className="mt-1">{step.thought}</p>
                </div>
                <div>
                  <span className="font-medium">动作：</span>
                  <code className="ml-2 px-2 py-1 bg-muted rounded">{step.action}</code>
                </div>
                <div>
                  <span className="font-medium">理由：</span>
                  <p className="mt-1">{step.reasoning}</p>
                </div>
                <div>
                  <span className="font-medium">观察：</span>
                  <pre className="mt-1 p-2 bg-muted rounded overflow-x-auto text-xs">
                    {step.observation}
                  </pre>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: 创建 API 获取推理轨迹**

```typescript
// src/app/api/entries/[id]/trace/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const trace = await prisma.reasoningTrace.findFirst({
    where: { entryId: params.id },
    orderBy: { createdAt: 'desc' },
  });

  if (!trace) {
    return NextResponse.json({ error: 'Trace not found' }, { status: 404 });
  }

  return NextResponse.json({
    steps: trace.steps,
    finalResult: trace.finalResult,
    metadata: trace.metadata,
  });
}
```

**Step 3: Commit**

```bash
git add src/components/agent/ReasoningTraceView.tsx src/app/api/entries/[id]/trace/route.ts
git commit -m "feat(ui): add reasoning trace visualization"
```

---

## Phase 4: 优化与扩展

### Task 14: 添加配置管理 API

**Files:**
- Create: `src/app/api/agent/config/route.ts`

**Step 1: 创建 API**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getDefaultConfig } from '@/lib/ai/agent/config';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const saved = await prisma.agentConfig.findFirst({
    where: { isDefault: true },
  });

  return NextResponse.json({
    config: saved ? saved.config : getDefaultConfig(),
  });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();

  const config = await prisma.agentConfig.upsert({
    where: { id: body.id || 'default' },
    update: { config: body.config },
    create: {
      id: 'default',
      name: 'default',
      config: body.config,
      isDefault: true,
    },
  });

  return NextResponse.json({ success: true, config });
}

export async function POST() {
  // 重置为默认
  await prisma.agentConfig.deleteMany({
    where: { isDefault: true },
  });

  return NextResponse.json({ success: true, config: getDefaultConfig() });
}
```

**Step 2: Commit**

```bash
git add src/app/api/agent/config/route.ts
git commit -m "feat(api): add agent config management API"
```

---

### Task 15: 集成到 Ingest 流程

**Files:**
- Modify: `src/app/api/ingest/route.ts`

**Step 1: 使用新的 Parser 和 Agent**

```typescript
// 在 asyncProcess 函数中使用

import { parseContent } from '@/lib/parser';
import { ReActAgent } from '@/lib/ai/agent/engine';
import { getDefaultConfig } from '@/lib/ai/agent/config';

// 替换原来的解析调用
const parsed = await parseContent({
  type: input.type,
  data: input.data,
  size: input.size,
});

// 替换 AI 处理
const agent = new ReActAgent(getDefaultConfig());
const result = await agent.process(entryId, parsed);
```

**Step 2: Commit**

```bash
git commit -m "feat(ingest): integrate new parser and agent into ingest flow"
```

---

## Summary

完成所有任务后，你将拥有：

1. **解析层**
   - 策略模式的 Parser 架构
   - 智能降级（文字提取 → OCR → 多模态）
   - 解析日志记录
   - 支持大文件处理

2. **Agent 基础框架**
   - Config Manager（可配置维度/策略）
   - Tools Registry（可扩展工具箱）
   - ReAct Loop 引擎

3. **Agent 智能化**
   - 多维度评估
   - 动态策略路由
   - 推理过程可视化

4. **优化**
   - 配置管理 API
   - 完整集成到 ingest 流程
