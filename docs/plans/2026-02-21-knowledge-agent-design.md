# Knowledge Ingestion Agent - 架构设计文档

> **Date**: 2026-02-21
> **Status**: Draft

---

## 1. 背景与目标

### 1.1 当前问题

1. **解析阶段**：
   - PDF 硬编码 20MB 限制（Gemini inline 上限）
   - 所有文件类型统一送多模态模型，成本高
   - 没有降级策略

2. **AI 处理阶段**：
   - 所有内容统一 prompt 处理
   - ContentType 枚举固定，不够泛化
   - 缺乏多维度评估（来源、可信度、时效性等）
   - 处理流程固定，无法动态选择

### 1.2 目标

- **解析层**：智能选择解析策略，支持降级
- **AI 层**：ReAct Agent 驱动，多维度评估，动态路由，可配置
- **白盒化**：推理过程完整记录，可追溯

---

## 2. 整体架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Knowledge Ingestion Flow                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐       │
│  │   Input      │────▶│   Parsing    │────▶│   AI Agent   │       │
│  │  (URL/File/  │     │   Layer      │     │   Processing │       │
│  │   Text)      │     │              │     │   Layer      │       │
│  └──────────────┘     └──────────────┘     └──────────────┘       │
│                              │                     │                 │
│                              ▼                     ▼                 │
│                      ┌──────────────┐     ┌──────────────┐         │
│                      │  Parse      │     │  ReAct Loop  │         │
│                      │  Strategy   │     │  + Tools     │         │
│                      │  Selection  │     │  + Config    │         │
│                      └──────────────┘     └──────────────┘         │
│                                               │                     │
│                                               ▼                     │
│                                      ┌──────────────┐              │
│                                      │  Reasoning   │              │
│                                      │  Trace       │              │
│                                      │  (白盒记录)   │              │
│                                      └──────────────┘              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. 解析层设计

### 3.1 解析策略

| 输入类型 | 策略选择 | 降级方案 |
|---------|---------|---------|
| 文字版 PDF | pdf-parse 提取文字 → 文本模型 | 失败 → 多模态 |
| 图片/截图 | OCR 提取文字 → 文本模型 | 失败 → 多模态原图 |
| 扫描版 PDF | 多模态原图 | - |
| 纯文字 | 直接文本模型 | - |
| 网页 | cheerio 提取文本 | 失败 → 多模态截屏 |

### 3.2 解析流程

```
输入文件/内容
      │
      ▼
┌─────────────────┐
│  Detect Type    │  ← 识别：PDF/图片/网页/文本
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Estimate Size  │  ← 文件大小
└────────┬────────┘
         │
    ┌────┴────┐
    │ > 20MB? │  ← 判断是否需要降级
    └────┬────┘
    Yes  │  No
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌────────┐
│Strategy│ │Strategy│
│  A     │ │  B     │
└───┬────┘ └───┬────┘
    │         │
    └────┬────┘
         ▼
┌─────────────────┐
│  Execute Parse  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Validate       │  ← 提取结果校验
└────────┬────────┘
         │
    ┌────┴────┐
    │ Success? │
    └────┬────┘
    Yes  │  No
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌────────┐
│ Return │ │Fallback│
│ Result │ │ to Alt │
└────────┘ └────────┘
```

### 3.3 模块设计

```typescript
// src/lib/parser/strategy.ts

interface ParseStrategy {
  name: string;
  canHandle(input: ParseInput): boolean;
  execute(input: ParseInput): Promise<ParseResult>;
  fallback?: ParseStrategy;
}

interface ParseInput {
  type: 'PDF' | 'IMAGE' | 'WEBPAGE' | 'TEXT';
  data: Buffer | string;
  mimeType?: string;
  size: number;
}

interface ParseResult {
  title: string;
  content: string;
  sourceType: SourceType;
  strategy: string;  // 记录使用的策略
  processingTime: number;
}
```

### 3.4 内置策略

1. **PdfTextStrategy** - pdf-parse 提取文字
2. **PdfImageStrategy** - 多模态直接处理
3. **OcrStrategy** - OCR 提取文字（Tesseract）
4. **ImageMultimodalStrategy** - 多模态处理图片
5. **WebpageStrategy** - cheerio 提取网页文本
6. **TextStrategy** - 直接使用文本

### 3.5 扩展机制

```typescript
// 注册自定义策略
parserRegistry.register(new CustomStrategy());

// 配置优先级
parserRegistry.setPriority([
  'PdfTextStrategy',
  'OcrStrategy',
  'PdfImageStrategy',
]);
```

---

## 4. AI 处理层设计

### 4.1 ReAct Agent 架构

```
┌─────────────────────────────────────────────────────────────┐
│                  Knowledge Agent (ReAct)                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌───────────────┐    ┌───────────────┐    ┌────────────┐  │
│  │ Config Manager│    │ Tools Registry│    │Memory Store │  │
│  │ (可配置维度)   │    │  (工具箱)      │    │ (上下文)    │  │
│  └───────────────┘    └───────────────┘    └────────────┘  │
│          ↑                   ↑                  ↑           │
│          └────────────┬──────┴──────────────────┘          │
│                       ▼                                       │
│  ┌───────────────────────────────────────────────────────┐ │
│  │                  ReAct Loop Engine                      │ │
│  │                                                        │ │
│  │   ┌──────┐    ┌──────┐    ┌──────────┐                │ │
│  │   │Thought│───▶│Action│───▶│Observation│                │ │
│  │   └──────┘    └──────┘    └──────────┘                │ │
│  │       │                                      │         │ │
│  │       └───────────────◀──────────────────────┘         │ │
│  │                  (Loop until done)                     │ │
│  └───────────────────────────────────────────────────────┘ │
│                          │                                   │
│                          ▼                                   │
│  ┌───────────────────────────────────────────────────────┐ │
│  │              Reasoning Trace (白盒记录)                 │ │
│  │  { step, thought, action, observation, reasoning }[]   │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 配置管理（Config Manager）

```typescript
// src/lib/ai/agent/config.ts

interface AgentConfig {
  // 评估维度（可配置、可扩展）
  evaluationDimensions: EvaluationDimension[];

  // 处理策略（可配置）
  processingStrategies: ProcessingStrategy[];

  // 工具箱
  availableTools: string[];

  // 最大迭代次数
  maxIterations: number;

  // 是否启用某些维度
  enabledDimensions: string[];
}

interface EvaluationDimension {
  id: string;           // 唯一标识
  name: string;         // 显示名称
  description: string; // 描述
  prompt: string;       // 评估 prompt 模板
  weight?: number;      // 权重 (0-1)
  enabled: boolean;     // 是否启用
}

interface ProcessingStrategy {
  type: 'NOTE' | 'PRACTICE' | 'COLLECTION' | 'RESEARCH' | 'DISCARD';
  name: string;
  description: string;
  condition: string;    // 触发条件描述
  outputSchema: object; // 输出 JSON Schema
}
```

### 4.3 默认评估维度

```typescript
const DEFAULT_EVALUATION_DIMENSIONS: EvaluationDimension[] = [
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
    prompt: '评估以下内容的时效性：{{content}}。返回 RECENT/OUTDATED/CLASSIC 并说明理由。',
    weight: 0.15,
    enabled: true,
  },
  {
    id: 'completeness',
    name: '完整度',
    description: '评估内容完整程度',
    prompt: '评估以下内容的完整度：{{content}}。返回 COMPLETE/FRAGMENT/INCREMENTAL 并说明理由。',
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
    id: 'language',
    name: '语言',
    description: '识别内容语言',
    prompt: '识别以下内容的语言：{{content}}。返回 ZH/EN/MULTI。',
    weight: 0.1,
    enabled: false, // 默认关闭
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
```

### 4.4 默认处理策略

```typescript
const DEFAULT_PROCESSING_STRATEGIES: ProcessingStrategy[] = [
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
  {
    type: 'DISCARD',
    name: '丢弃',
    description: '低价值内容',
    condition: '重复、过时、无价值',
    outputSchema: {
      reason: 'string',
      suggestedAction: 'string',
    },
  },
];
```

### 4.5 工具注册（Tools Registry）

```typescript
// src/lib/ai/agent/tools.ts

interface Tool {
  name: string;
  description: string;
  parameters: z.Schema;
  handler: (params: any, context: AgentContext) => Promise<ToolResult>;
}

interface AgentContext {
  input: ParseResult;
  evaluations: Record<string, any>;
  observations: string[];
  history: ReasoningStep[];
}

// 内置工具
const BUILTIN_TOOLS: Tool[] = [
  {
    name: 'evaluate_dimension',
    description: '评估内容的某个维度',
    parameters: z.object({
      dimensionId: z.string(),
      content: z.string(),
    }),
    handler: async (params, context) => { /* ... */ },
  },
  {
    name: 'classify_content',
    description: '对内容进行分类',
    parameters: z.object({
      content: z.string(),
      categories: z.array(z.string()).optional(),
    }),
    handler: async (params, context) => { /* ... */ },
  },
  {
    name: 'extract_summary',
    description: '提取内容摘要',
    parameters: z.object({
      content: z.string(),
      type: z.enum(['brief', 'detailed', 'tldr']),
    }),
    handler: async (params, context) => { /* ... */ },
  },
  {
    name: 'generate_practice',
    description: '生成实践任务',
    parameters: z.object({
      content: z.string(),
      summary: z.string(),
      difficulty: z.string().optional(),
    }),
    handler: async (params, context) => { /* ... */ },
  },
  {
    name: 'extract_notes',
    description: '提取知识笔记',
    parameters: z.object({
      content: z.string(),
    }),
    handler: async (params, context) => { /* ... */ },
  },
  {
    name: 'translate_content',
    description: '翻译内容',
    parameters: z.object({
      content: z.string(),
      targetLang: z.string(),
    }),
    handler: async (params, context) => { /* ... */ },
  },
  {
    name: 'find_relations',
    description: '查找关联知识',
    parameters: z.object({
      content: z.string(),
      tags: z.array(z.string()),
    }),
    handler: async (params, context) => { /* ... */ },
  },
  {
    name: 'store_knowledge',
    description: '存储到知识库',
    parameters: z.object({
      data: z.record(z.any()),
    }),
    handler: async (params, context) => { /* ... */ },
  },
];
```

### 4.6 ReAct Loop 引擎

```typescript
// src/lib/ai/agent/engine.ts

interface ReasoningStep {
  step: number;
  timestamp: string;

  // ReAct 三要素
  thought: string;      // 思考：分析当前状态，决定下一步
  action: string;      // 动作：调用哪个工具 + 参数
  observation: string; // 观察：工具返回结果

  // 额外信息
  reasoning: string;   // 决策理由
  context: any;        // 当时上下文
  error?: string;      // 错误信息
}

interface ReasoningTrace {
  entryId: string;
  input: ParseResult;
  steps: ReasoningStep[];
  finalResult: KnowledgeEntry;
  metadata: {
    startTime: string;
    endTime: string;
    iterations: number;
    toolsUsed: string[];
  };
}

class ReActAgent {
  constructor(
    private config: AgentConfig,
    private tools: ToolRegistry,
    private llm: GeminiClient
  ) {}

  async process(input: ParseResult): Promise<ReasoningTrace> {
    const steps: ReasoningStep[] = [];
    const context: AgentContext = {
      input,
      evaluations: {},
      observations: [],
      history: steps,
    };

    // 构建系统提示
    const systemPrompt = this.buildSystemPrompt(this.config);

    let iteration = 0;
    let isDone = false;

    while (!isDone && iteration < this.config.maxIterations) {
      iteration++;

      // 1. Thought - LLM 决定下一步
      const thoughtResponse = await this.llm.generate({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: this.buildUserPrompt(context) },
        ],
      });

      const { thought, action, reasoning } = this.parseThoughtResponse(thoughtResponse);

      // 2. Action - 执行工具
      let observation: string;
      try {
        const result = await this.tools.execute(action, context);
        observation = this.formatObservation(result);
      } catch (error) {
        observation = `Error: ${error.message}`;
      }

      // 3. 记录推理步骤
      steps.push({
        step: iteration,
        timestamp: new Date().toISOString(),
        thought,
        action,
        observation,
        reasoning,
        context: { inputLength: input.content.length },
      });

      // 4. 检查是否完成
      isDone = this.checkDone(steps, context);

      // 5. 更新上下文
      context.observations.push(observation);
    }

    // 6. 返回推理轨迹
    return this.buildTrace(input, steps, context);
  }

  private buildSystemPrompt(config: AgentConfig): string {
    return `你是一个知识管理专家。你的任务是根据内容特征，动态选择处理方式。

## 可用工具
${config.availableTools.map(t => `- ${t.name}: ${t.description}`).join('\n')}

## 评估维度
${config.evaluationDimensions
  .filter(d => d.enabled)
  .map(d => `- ${d.name}: ${d.description}`)
  .join('\n')}

## 处理策略
${config.processingStrategies.map(s => `- ${s.type}: ${s.condition}`).join('\n')}

## 输出要求
1. 先分析内容特征
2. 评估各维度
3. 选择合适的处理策略
4. 执行处理
5. 给出最终结果

每一步都要说明理由。`;
  }
}
```

### 4.7 推理记录存储

```typescript
// 存储到数据库
const reasoningTrace = await prisma.reasoningTrace.create({
  data: {
    entryId,
    steps: JSON.stringify(trace.steps),
    finalResult: JSON.stringify(trace.finalResult),
    metadata: trace.metadata,
  },
});

// 展示给用户
interface TraceView {
  steps: {
    step: number;
    thought: string;
    action: string;
    observation: string;
    reasoning: string;
  }[];
  summary: string;
  result: any;
}
```

---

## 5. 数据模型变更

### 5.1 新增表

```prisma
// 推理轨迹表
model ReasoningTrace {
  id        String   @id @default(cuid())
  entryId   String
  steps     Json     // ReasoningStep[]
  finalResult Json   // 最终处理结果
  metadata  Json     // { startTime, endTime, iterations, toolsUsed }
  createdAt DateTime @default(now())

  entry    Entry    @relation(fields: [entryId], references: [id])
}

// Agent 配置表
model AgentConfig {
  id        String   @id @default(cuid())
  name      String   @unique
  config    Json     // AgentConfig JSON
  isDefault Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// 解析策略记录
model ParseLog {
  id          String   @id @default(cuid())
  entryId     String
  strategy    String   // 使用的策略名
  inputSize   Int      // 输入大小
  outputSize  Int      // 输出大小
  processingTime Int   // 处理时间(ms)
  success     Boolean
  error       String?
  createdAt   DateTime @default(now())

  entry      Entry    @relation(fields: [entryId], references: [id])
}
```

### 5.2 Entry 表扩展

```prisma
model Entry {
  // ... existing fields

  // 新增字段
  processingStrategy ProcessingStrategy? @default(NOTE)  // 最终处理策略
  confidence        Float?                                 // 处理置信度
  confidenceDetails Json?                                   // 各维度置信度
}
```

---

## 6. API 设计

### 6.1 配置管理

```
GET    /api/agent/config          # 获取当前配置
PUT    /api/agent/config          # 更新配置
GET    /api/agent/config/default  # 获取默认配置
POST   /api/agent/config/reset   # 重置为默认
```

### 6.2 推理轨迹

```
GET    /api/entries/[id]/trace    # 获取推理轨迹
```

### 6.3 解析日志

```
GET    /api/entries/[id]/parse-log  # 获取解析日志
```

---

## 7. 前端展示

### 7.1 推理过程可视化

```
┌────────────────────────────────────────────────────────┐
│  推理过程                                              │
├────────────────────────────────────────────────────────┤
│                                                        │
│  步骤 1: 评估来源                                       │
│  ─────────────────────────────────────────────────    │
│  思考: 需要先评估内容来源可靠性...                      │
│  动作: evaluate_dimension(source)                      │
│  观察: 来源 = GitHub, 可靠性 = HIGH                    │
│  理由: GitHub 官方仓库，可信度高                        │
│                                                        │
│  步骤 2: 评估时效性                                     │
│  ─────────────────────────────────────────────────    │
│  思考: 内容是技术文章，需要判断时效性...                 │
│  动作: evaluate_dimension(timeliness)                   │
│  观察: 发布于 2 周前，RECENT                            │
│  理由: 最新的最佳实践                                   │
│                                                        │
│  步骤 3: 选择处理策略                                   │
│  ─────────────────────────────────────────────────    │
│  思考: 完整教程 + 实践导向 → 选择 PRACTICE              │
│  动作: generate_practice(content, summary)             │
│  观察: 生成了 5 个步骤的实践任务                        │
│  理由: 内容完整，有明确操作步骤，适合生成实践             │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### 7.2 配置界面

- 维度开关：启用/禁用评估维度
- 权重调节：拖拽设置权重
- 策略配置：添加/修改处理策略
- 预设管理：保存/加载配置

---

## 8. 实现计划

### Phase 1: 解析层优化
1. 重构 parser 架构，支持策略模式
2. 实现文件大小检测和降级逻辑
3. 添加 PDF 文字提取策略
4. 添加 OCR 降级策略

### Phase 2: Agent 基础框架
1. 实现 Config Manager
2. 实现 Tools Registry
3. 实现 ReAct Loop 引擎
4. 实现基础工具

### Phase 3: Agent 智能化
1. 实现评估维度处理
2. 实现策略路由
3. 实现推理记录存储
4. 实现前端可视化

### Phase 4: 优化与扩展
1. 添加更多内置工具
2. 优化 prompt
3. 添加配置预设
4. 性能优化

---

## 9. 附录

### A. 完整配置示例

```json
{
  "evaluationDimensions": [
    {
      "id": "source",
      "name": "来源可信度",
      "description": "评估内容来源的权威性",
      "prompt": "评估以下内容来源的可靠程度：{{source}}。返回 HIGH/MEDIUM/LOW 并说明理由。",
      "weight": 0.2,
      "enabled": true
    }
  ],
  "processingStrategies": [
    {
      "type": "PRACTICE",
      "name": "实践任务",
      "condition": "内容完整、有明确操作步骤、技术深度适中",
      "outputSchema": {}
    }
  ],
  "availableTools": [
    "evaluate_dimension",
    "classify_content",
    "extract_summary",
    "generate_practice",
    "extract_notes",
    "find_relations",
    "store_knowledge"
  ],
  "maxIterations": 10
}
```

---

## Approval

- [ ] 解析层设计确认
- [ ] AI Agent 架构确认
- [ ] 数据模型确认
- [ ] 实施计划确认
