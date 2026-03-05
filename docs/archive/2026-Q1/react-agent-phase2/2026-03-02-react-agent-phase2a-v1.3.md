# ReAct Agent Phase 2a 实施方案 - 工具系统激活（v1.3 修正版）

**版本**: v1.3
**日期**: 2026-03-02
**状态**: Codex 第二轮评审中
**基于**: Codex 第一轮评审结果（3 Blocking + 3 High + 4 Medium）

---

## 一、v1.2 → v1.3 关键修正

### Blocking 修复

| 问题 | v1.2 错误 | v1.3 修正 |
|------|----------|----------|
| **B1** | `DecisionSchema` 字段与 ingest 契约不匹配 | 完全对齐 `NormalizedAgentIngestDecision` 接口 |
| **B2** | `ReasoningTrace` 结构不兼容 | 对齐 `types.ts` 中的 `ReasoningTrace` 契约 |
| **B3** | `import { ToolCall, ToolResult }` 编译失败 | 使用 `TypedToolCall<TOOLS>` 和 `result.steps[].toolCalls/toolResults` |

### High 修复

| 问题 | v1.2 错误 | v1.3 修正 |
|------|----------|----------|
| **H1** | 缺少工具共享上下文设计 | 增加 `ToolContext` 传递机制 |
| **H2** | Feature flag 空切换 | 在 `AgentConfig` 增加 `useToolCalling` 字段 |
| **H3** | 数据库配置覆盖本地 | 增加迁移脚本同步 DB 配置 |

---

## 二、技术方案（修正版）

### 2.1 DecisionSchema 对齐契约

```typescript
import { generateText, Output, tool, stepCountIs } from 'ai';
import { z } from 'zod';
import type { ContentType, TechDomain, PracticeValue, Difficulty } from '@prisma/client';

// 完全对齐 NormalizedAgentIngestDecision 接口
const DecisionSchema = z.object({
  // 必填字段 - 与 Prisma 枚举对齐
  contentType: z.enum([
    'ARTICLE', 'TUTORIAL', 'DOCUMENTATION', 'CODE_SNIPPET',
    'DISCUSSION', 'CASE_STUDY', 'TOOL_INTRO', 'NEWS',
    'OPINION', 'REFERENCE', 'OTHER'
  ]),
  techDomain: z.enum([
    'LLM', 'RAG', 'AGENT', 'PROMPT', 'FINE_TUNING',
    'EMBEDDING', 'MULTIMODAL', 'TOOLING', 'INFRA',
    'PRODUCT', 'RESEARCH', 'OTHER'
  ]),
  aiTags: z.array(z.string()),
  coreSummary: z.string().min(20),

  // keyPoints - 简化版本，标准化函数会处理
  keyPoints: z.array(z.string()),

  // summaryStructure - 与 NormalizedSummaryStructure 对齐
  summaryStructure: z.object({
    type: z.enum([
      'problem-solution-steps', 'concept-mechanism-flow',
      'tool-feature-comparison', 'background-result-insight',
      'argument-evidence-condition', 'generic', 'api-reference',
      'comparison-matrix', 'timeline-evolution'
    ]),
    reasoning: z.string().optional(),
    fields: z.record(z.unknown()),
  }),

  // boundaries - 与 NormalizedBoundaries 对齐
  boundaries: z.object({
    applicable: z.array(z.string()),
    notApplicable: z.array(z.string()),
  }),

  // practiceValue - 与 Prisma 枚举对齐
  practiceValue: z.enum(['ACTIONABLE', 'REFERENCE', 'ARCHIVE']),
  practiceReason: z.string(),

  // practiceTask - 可选，与 NormalizedPracticeTask 对齐
  practiceTask: z.object({
    title: z.string(),
    description: z.string(),
    difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']),
    estimatedMinutes: z.number().optional(),
    steps: z.array(z.object({
      order: z.number(),
      title: z.string(),
      description: z.string(),
    })),
  }).nullable(),

  // 可选评估字段
  confidence: z.number().min(0).max(1).optional(),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).nullable().optional(),
  sourceTrust: z.enum(['HIGH', 'MEDIUM', 'LOW']).nullable().optional(),
  timeliness: z.enum(['RECENT', 'OUTDATED', 'CLASSIC']).nullable().optional(),
  contentForm: z.enum(['TEXTUAL', 'CODE_HEAVY', 'VISUAL', 'MULTIMODAL']).nullable().optional(),
});

type AgentDecision = z.infer<typeof DecisionSchema>;
```

### 2.2 工具上下文传递机制

```typescript
import type { AgentContext } from './types';

// 工具执行时的共享上下文
interface ToolExecutionContext {
  entryId: string;
  input: ParseResult;
  // 跨工具共享的状态
  shared: {
    evaluations: Record<string, unknown>;
    classification: Record<string, unknown> | null;
    intermediateResults: Record<string, unknown>;
  };
}

// 将现有工具适配为 Vercel AI SDK 格式
function createSDKTools(ctx: ToolExecutionContext) {
  return {
    evaluate_dimension: tool({
      description: '评估内容的某个维度（来源可信度、时效性等）',
      inputSchema: z.object({
        dimensionId: z.string().describe('维度 ID'),
      }),
      execute: async ({ dimensionId }) => {
        const dimension = DEFAULT_EVALUATION_DIMENSIONS.find(d => d.id === dimensionId);
        if (!dimension) return { success: false, error: `Unknown dimension: ${dimensionId}` };

        const result = await generateJSON<{ score: string; reasoning: string }>(...);
        // 写入共享上下文
        ctx.shared.evaluations[dimensionId] = result;
        return { success: true, data: result };
      },
    }),

    classify_content: tool({
      description: '对内容进行分类（类型、领域、标签）',
      inputSchema: z.object({
        content: z.string().describe('要分类的内容'),
      }),
      execute: async ({ content }) => {
        const result = await generateJSON<ClassificationResult>(...);
        // 写入共享上下文供后续工具使用
        ctx.shared.classification = result;
        return { success: true, data: result };
      },
    }),

    extract_summary: tool({
      description: '提取内容摘要（依赖 classify_content 结果）',
      inputSchema: z.object({
        content: z.string().describe('要提取摘要的内容'),
      }),
      execute: async ({ content }) => {
        // 读取共享上下文
        const classification = ctx.shared.classification;
        const result = await generateJSON<SummaryResult>(..., { classification });
        ctx.shared.intermediateResults.summary = result;
        return { success: true, data: result };
      },
    }),

    extract_code: tool({
      description: '从内容中提取代码片段',
      inputSchema: z.object({
        content: z.string().describe('包含代码的内容'),
      }),
      execute: async ({ content }) => {
        const result = extractCodeBlocks(content);
        ctx.shared.intermediateResults.codeExamples = result;
        return { success: true, data: result };
      },
    }),

    extract_version: tool({
      description: '提取版本信息',
      inputSchema: z.object({
        content: z.string().describe('要提取版本信息的内容'),
      }),
      execute: async ({ content }) => {
        const result = await generateJSON<VersionInfo>(...);
        ctx.shared.intermediateResults.versionInfo = result;
        return { success: true, data: result };
      },
    }),

    check_duplicate: tool({
      description: '检查内容是否与已有条目重复',
      inputSchema: z.object({
        content: z.string().describe('要检查的内容'),
      }),
      execute: async ({ content }) => {
        const similar = await findSimilarEntries(content);
        return {
          success: true,
          data: {
            isDuplicate: similar.length > 0,
            similarEntries: similar.map(e => ({
              id: e.id,
              title: e.title,
              similarity: e.similarity,
            })),
          },
        };
      },
    }),

    route_to_strategy: tool({
      description: '根据内容类型选择处理策略',
      inputSchema: z.object({
        contentType: z.string().describe('内容类型'),
      }),
      execute: async ({ contentType }) => {
        // 读取共享上下文中的评估结果
        const evaluations = ctx.shared.evaluations;
        const strategy = selectStrategy(contentType, evaluations);
        return { success: true, data: strategy };
      },
    }),
  };
}
```

### 2.3 ReasoningTrace 适配（对齐契约）

```typescript
import type { ReasoningTrace, ReasoningStep } from './types';
import type { GenerateTextResult } from 'ai';

type SDKTools = ReturnType<typeof createSDKTools>;

// 从 generateText 结果构建符合契约的 trace
function buildReasoningTrace(
  entryId: string,
  input: ParseResult,
  result: GenerateTextResult<SDKTools, Output<AgentDecision>>,
  startTime: Date
): ReasoningTrace {
  const toolsUsed: string[] = [];

  const steps: ReasoningStep[] = result.steps.map((step, index) => {
    // 收集使用的工具名
    const stepToolNames = step.toolCalls?.map(tc => tc.toolName) || [];
    toolsUsed.push(...stepToolNames);

    return {
      step: index + 1,
      timestamp: new Date().toISOString(),
      thought: step.text || '',
      action: stepToolNames[0] || 'reasoning',
      observation: step.toolResults
        ? JSON.stringify(step.toolResults.map(tr => tr.result))
        : '',
      reasoning: step.text || '',
      context: {
        stepType: step.toolCalls?.length ? 'tool_call' : 'reasoning',
        toolCallCount: step.toolCalls?.length || 0,
      },
    };
  });

  return {
    entryId,
    input,
    steps,
    finalResult: result.output,
    metadata: {
      startTime: startTime.toISOString(),
      endTime: new Date().toISOString(),
      iterations: steps.length,
      toolsUsed: [...new Set(toolsUsed)], // 去重
    },
  };
}
```

### 2.4 Feature Flag 完整设计

```typescript
// src/lib/ai/agent/types.ts - 扩展 AgentConfig
export interface AgentConfig {
  evaluationDimensions: EvaluationDimension[];
  processingStrategies: ProcessingStrategy[];
  availableTools: string[];
  maxIterations: number;
  // 新增：工具调用开关
  useToolCalling: boolean;
}

// src/lib/ai/agent/config.ts - 默认配置
export function getDefaultConfig(): AgentConfig {
  return {
    // ... 现有配置
    availableTools: [
      'evaluate_dimension',
      'classify_content',
      'extract_summary',
      'extract_code',
      'extract_version',
      'check_duplicate',
      'route_to_strategy',
    ],
    maxIterations: 3,
    // 默认关闭，通过环境变量开启
    useToolCalling: process.env.REACT_AGENT_USE_TOOLS === 'true',
  };
}

// src/lib/ai/agent/factory.ts - 工厂函数
export async function createAgentEngine(): Promise<IAgentEngine> {
  const config = await getAgentConfig();

  // 根据配置决定使用哪种模式
  return new ReActAgent(config);
  // ReActAgent 内部根据 config.useToolCalling 选择执行路径
}
```

### 2.5 数据库配置迁移脚本

```typescript
// scripts/migrate-agent-config.ts
import { prisma } from '@/lib/prisma';
import { getDefaultConfig } from '@/lib/ai/agent/config';

async function migrateAgentConfig() {
  const defaultConfig = getDefaultConfig();

  // 更新数据库中的默认配置
  await prisma.agentConfig.upsert({
    where: { id: 'default' },
    create: {
      id: 'default',
      isDefault: true,
      config: defaultConfig as unknown as Prisma.InputJsonValue,
    },
    update: {
      config: defaultConfig as unknown as Prisma.InputJsonValue,
    },
  });

  console.log('Agent config migrated successfully');
}

migrateAgentConfig();
```

---

## 三、实施步骤（修正版）

### Step 1: 类型和配置更新（30min）

1. 在 `types.ts` 中添加 `useToolCalling` 字段
2. 更新 `config.ts` 默认配置（移除未实现工具）
3. 创建数据库迁移脚本

### Step 2: 工具迁移（2-3h）

1. 创建 `sdk-tools.ts` 文件
2. 实现 `createSDKTools()` 函数
3. 实现 `ToolExecutionContext` 共享机制
4. 逐个迁移 7 个工具

### Step 3: engine.ts 修改（1-2h）

1. 在 `executeReasoning` 中增加分支逻辑
2. `useToolCalling=true` 时使用 `generateText + tools`
3. `useToolCalling=false` 时保持现有 `generateJSON` 逻辑
4. 实现 `buildReasoningTrace()` 函数

### Step 4: 测试覆盖（1h）

```typescript
// src/lib/ai/agent/sdk-tools.test.ts
describe('SDK Tools', () => {
  it('should create tools with shared context', () => {
    const ctx = createToolExecutionContext('entry-1', mockInput);
    const tools = createSDKTools(ctx);
    expect(Object.keys(tools)).toHaveLength(7);
  });

  it('should share evaluations between tools', async () => {
    const ctx = createToolExecutionContext('entry-1', mockInput);
    const tools = createSDKTools(ctx);

    await tools.evaluate_dimension.execute({ dimensionId: 'source' });
    expect(ctx.shared.evaluations.source).toBeDefined();
  });

  it('should pass classification to extract_summary', async () => {
    const ctx = createToolExecutionContext('entry-1', mockInput);
    const tools = createSDKTools(ctx);

    await tools.classify_content.execute({ content: '...' });
    await tools.extract_summary.execute({ content: '...' });

    expect(ctx.shared.classification).toBeDefined();
    expect(ctx.shared.intermediateResults.summary).toBeDefined();
  });
});
```

### Step 5: 验证（30min）

1. TypeScript 编译：`npx tsc --noEmit`
2. 单元测试：`npm run test`
3. 集成测试：手动测试 3 种内容类型

---

## 四、验收标准（修正版）

### 功能验收
- [ ] 7 个工具迁移到 Vercel AI SDK 格式
- [ ] 工具间共享上下文正常工作
- [ ] `ReasoningTrace` 符合现有契约
- [ ] Feature flag 可以切换新旧路径
- [ ] TypeScript 编译通过
- [ ] 单元测试覆盖工具迁移和上下文传递

### 质量指标
- [ ] 工具调用成功率 >= 95%
- [ ] `normalizeAgentIngestDecision` 成功率 >= 98%
- [ ] P95 处理时延不劣化超过 25%

### 回退方案
- [ ] `useToolCalling=false` 回退到 Phase 1 行为
- [ ] 数据库配置可快速恢复

---

## 五、与 v1.2 的差异总结

| 维度 | v1.2 | v1.3 |
|------|------|------|
| Schema | 自定义字段 | 完全对齐 `NormalizedAgentIngestDecision` |
| Trace | 新结构 | 对齐 `types.ts` 中的 `ReasoningTrace` |
| 类型导入 | `ToolCall/ToolResult` | 使用 SDK 内置类型 |
| 工具上下文 | 无 | `ToolExecutionContext` 共享机制 |
| Feature flag | 空切换 | `AgentConfig.useToolCalling` |
| DB 同步 | 无 | 迁移脚本 |
| 测试文件 | 引用不存在 | 新建 `sdk-tools.test.ts` |
| `stopWhen` | 硬编码 3 | 从 `config.maxIterations` 读取 |

---

**工作量估算**：5-7h（比 v1.2 增加 1-2h 处理上下文传递）
**风险等级**：Medium
**优先级**：High
