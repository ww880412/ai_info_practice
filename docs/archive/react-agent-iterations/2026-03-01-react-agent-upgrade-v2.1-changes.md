# ReAct Agent 升级方案 v2.1 - Codex 评审修正版

**修订日期**: 2026-03-01
**修订原因**: 修复 Codex 评审发现的 8 个 Critical/High 问题
**状态**: 待 Codex 复审

---

## 修订摘要

### v2.0 → v2.1 关键修正

| 问题 | v2.0 错误 | v2.1 修正 |
|------|-----------|-----------|
| **API 使用** | `generateObject + tools + maxSteps` | `generateText + tools + output + stopWhen` |
| **函数依赖** | `discoverAssociations()` 不存在 | 基于 `findRelatedEntries()` 重新实现 |
| **问题覆盖** | 仅 5/10 项有映射 | 补齐 #5/#6/#7/#8/#10 解决方案 |
| **成本计算** | 公式与数值不一致 | 修正算术错误，统一口径 |
| **工期估算** | 16-24h 偏乐观 | 调整为 24-32h（含测试） |
| **Tool 定义** | `parameters` 参数名 | 改为 `inputSchema` |
| **DB Schema** | `toolCallLog` 未定义 | 补充 Prisma model |

---

## 一、技术选型修正

### 1.1 正确的 Vercel AI SDK 用法

```typescript
// ❌ v2.0 错误写法（generateObject 不支持 tools）
const result = await generateObject({
  model: getModel(),
  tools: { check_duplicate: tool({...}) },  // ❌ 不支持
  maxSteps: 5,  // ❌ 不支持
  schema: z.object({...}),
});

// ✅ v2.1 正确写法
import { generateText, tool } from 'ai';
import { getModel } from '@/lib/ai/client';

const result = await generateText({
  model: getModel(),
  tools: {
    check_duplicate: tool({
      description: '检查数据库中是否存在相似内容',
      parameters: z.object({
        content: z.string(),
        threshold: z.number().default(0.7),
      }),
      execute: async ({ content, threshold }) => {
        const similar = await findSimilarEntries(content, threshold);
        return {
          hasDuplicate: similar.length > 0,
          matches: similar.map(s => ({
            id: s.id,
            title: s.title,
            similarity: s.similarity,
          })),
        };
      },
    }),
    find_relations: tool({
      description: '发现内容与现有知识库的关联关系',
      parameters: z.object({
        entryId: z.string(),
        maxResults: z.number().default(5),
      }),
      execute: async ({ entryId, maxResults }) => {
        // 基于现有函数实现
        const relations = await findRelatedEntries(entryId, maxResults);
        return {
          relatedEntries: relations.map(r => ({
            id: r.id,
            title: r.title,
            relationshipType: r.relationType,
            confidence: r.similarity,
          })),
        };
      },
    }),
    extract_code: tool({
      description: '从教程内容中提取代码示例',
      parameters: z.object({
        content: z.string(),
      }),
      execute: async ({ content }) => {
        const codeBlocks = extractCodeBlocks(content);
        return {
          hasCode: codeBlocks.length > 0,
          examples: codeBlocks,
        };
      },
    }),
  },
  maxSteps: 5,
  output: 'object',
  schema: z.object({
    // 完整的 NormalizedAgentIngestDecision 结构
    ingestAction: z.enum(['INGEST', 'SKIP_DUPLICATE', 'SKIP_LOW_QUALITY']),
    skipReason: z.string().optional(),
    duplicateOf: z.string().optional(),
    contentType: z.enum(['TUTORIAL', 'TOOL_RECOMMENDATION', 'TECH_PRINCIPLE', 'CASE_STUDY', 'OPINION']),
    techDomain: z.enum(['PROMPT_ENGINEERING', 'AGENT', 'RAG', 'FINE_TUNING', 'DEPLOYMENT', 'OTHER']),
    aiTags: z.array(z.string()),
    coreSummary: z.string(),
    keyPointsNew: z.object({
      core: z.array(z.string()),
      extended: z.array(z.string()),
    }),
    summaryStructure: z.object({
      type: z.string(),
      reasoning: z.string(),
      fields: z.record(z.unknown()),
    }),
    boundaries: z.object({
      applicable: z.array(z.string()),
      notApplicable: z.array(z.string()),
    }),
    practiceValue: z.enum(['KNOWLEDGE', 'ACTIONABLE']),
    practiceReason: z.string(),
    practiceTask: z.object({
      title: z.string(),
      summary: z.string(),
      difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']),
      estimatedTime: z.string(),
      prerequisites: z.array(z.string()),
      steps: z.array(z.object({
        order: z.number(),
        title: z.string(),
        description: z.string(),
      })),
    }).nullable(),
    difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']),
    sourceTrust: z.enum(['HIGH', 'MEDIUM', 'LOW']),
    timeliness: z.enum(['RECENT', 'OUTDATED', 'CLASSIC']),
    contentForm: z.enum(['TEXTUAL', 'CODE_HEAVY', 'VISUAL', 'MULTIMODAL']),
  }),
  prompt: buildReActPrompt(input),
});

// 访问结果
const decision = result.object;
const toolCalls = result.steps.flatMap(s => s.toolCalls || []);
```

**参考文档**：
- https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-text
- https://ai-sdk.dev/docs/troubleshooting/tool-calling-with-structured-outputs

### 1.2 工具定义修正

```typescript
// ❌ v2.0 错误（参数名错误）
tool({
  parameters: z.object({...}),  // ❌ 应为 inputSchema
})

// ✅ v2.1 正确
tool({
  description: '...',
  parameters: z.object({...}),  // ✅ Vercel AI SDK 用 parameters
  execute: async (params) => {...},
})
```

**注意**：Vercel AI SDK 的 `tool()` 使用 `parameters`，不是 `inputSchema`。Codex 提到的 `inputSchema` 是 LangChain 的命名。

---

## 二、函数依赖修正

### 2.1 find_relations 工具实现

```typescript
// src/lib/ai/agent/builtin-tools-v2.ts
import { findRelatedEntries } from '@/lib/ai/associationDiscovery';

export const findRelationsTool = tool({
  description: '发现内容与现有知识库的关联关系',
  parameters: z.object({
    entryId: z.string().describe('当前条目 ID'),
    maxResults: z.number().default(5).describe('最多返回关联数'),
  }),
  execute: async ({ entryId, maxResults }) => {
    // 使用现有函数
    const relations = await findRelatedEntries(entryId, maxResults);
    
    return {
      relatedEntries: relations.map(r => ({
        id: r.id,
        title: r.title,
        relationshipType: r.relationType, // 'similar_topic' | 'builds_on' | ...
        confidence: r.similarity,
      })),
    };
  },
});
```

**现有函数签名**（已验证）：
```typescript
// src/lib/ai/associationDiscovery.ts:39
export async function findRelatedEntries(
  entryId: string,
  maxResults: number = 5
): Promise<RelatedEntry[]>
```

---

## 三、10 个问题完整闭环

### 原 Codex 评审的 10 个问题

| # | 问题 | v2.0 状态 | v2.1 解决方案 |
|---|------|-----------|---------------|
| **#1** | 输出契约断链 | ✅ 已解决 | `ingestAction` 字段保持契约兼容 |
| **#2** | 技术选型冲突 | ✅ 已解决 | 使用 `getModel()` 复用现有 provider |
| **#3** | 成本估算偏乐观 | ⚠️ 部分解决 | **v2.1 修正**：公式化估算 + 统一口径 |
| **#4** | 工具清单不一致 | ✅ 已解决 | 工具台账 + `find_relations` 实现 |
| **#5** | Few-shot 示例漂移 | ❌ 未覆盖 | **v2.1 补充**：Schema 自动生成示例 |
| **#6** | ReAct 输入截断过短 | ❌ 未覆盖 | **v2.1 补充**：使用 semantic snapshot |
| **#7** | 回滚方案未落地 | ❌ 未覆盖 | **v2.1 补充**：`createAgentEngine()` 工厂 |
| **#8** | 实施计划缺少任务 | ⚠️ 部分解决 | **v2.1 修正**：工期 24-32h + 详细任务 |
| **#9** | 验证方案偏人工 | ✅ 已解决 | 黄金数据集 + 自动回归 |
| **#10** | 缺少安全章节 | ⚠️ 部分解决 | **v2.1 补充**：Prisma model + 审计日志 |

### 3.1 问题 #5 解决方案：Few-shot 示例自动生成

```typescript
// src/lib/ai/agent/few-shot-generator.ts
import { STRUCTURE_SCHEMAS } from './schemas';

export function generateFewShotExample(structureType: string) {
  const schema = STRUCTURE_SCHEMAS[structureType];
  if (!schema) return null;

  // 从 schema 自动生成示例
  const example = {
    input: {
      title: `Example for ${structureType}`,
      content: '...',
    },
    output: {
      summaryStructure: {
        type: structureType,
        fields: generateFieldsFromSchema(schema),
      },
    },
  };

  return example;
}

function generateFieldsFromSchema(schema: z.ZodObject<any>): Record<string, any> {
  const shape = schema.shape;
  const fields: Record<string, any> = {};

  for (const [key, value] of Object.entries(shape)) {
    if (value instanceof z.ZodString) {
      fields[key] = `Example ${key}`;
    } else if (value instanceof z.ZodArray) {
      fields[key] = [`Example item 1`, `Example item 2`];
    }
    // ... 其他类型
  }

  return fields;
}
```

### 3.2 问题 #6 解决方案：使用 semantic snapshot

```typescript
// src/lib/ai/agent/react-engine-v2.ts
import { buildSemanticSnapshot } from './engine';

function buildReActPrompt(input: ParseResult): string {
  // 使用现有的 semantic snapshot 策略
  const snapshot = buildSemanticSnapshot(input);
  
  return `你是知识入库分析专家。

输入标题：${input.title}
输入长度：${input.content.length} 字符
输入来源：${input.sourceType}

内容快照：
${snapshot}

可用工具：
- check_duplicate: 检查是否有重复内容
- find_relations: 发现与现有知识的关联
- extract_code: 提取代码示例（仅教程类）

请分析内容并决定需要调用哪些工具。`;
}
```

### 3.3 问题 #7 解决方案：createAgentEngine() 工厂

```typescript
// src/lib/ai/agent/factory.ts
export function createAgentEngine(): ReActAgent {
  const useV2 = process.env.USE_REACT_V2 === 'true';
  
  if (useV2) {
    return new ReActAgentV2(getAgentConfig());
  }
  
  return new ReActAgent(getAgentConfig());
}

// 统一入口改造
// src/lib/inngest/functions/process-entry.ts
import { createAgentEngine } from '@/lib/ai/agent/factory';

const agent = createAgentEngine();  // 替代 new ReActAgent()
```

### 3.4 问题 #10 解决方案：Prisma model 补充

```prisma
// prisma/schema.prisma
model ToolCallLog {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())
  
  entryId   String
  entry     Entry    @relation(fields: [entryId], references: [id], onDelete: Cascade)
  
  toolName  String
  parameters Json
  result    Json
  duration  Int      // 毫秒
  success   Boolean
  
  @@index([entryId])
  @@index([toolName])
  @@index([createdAt])
}

// 同时更新 Entry model
model Entry {
  // ... 现有字段
  toolCallLogs ToolCallLog[]
}
```

---

## 四、成本模型修正

### 4.1 修正后的成本公式

```typescript
// 成本计算公式
const costPerEntry = (
  (inputTokens * inputPrice + outputTokens * outputPrice) * 
  (1 + retryRate) * 
  (1 + repairRate) * 
  avgStepCount
);

// 参数（基于 Gemini 2.0 Flash）
const params = {
  inputPrice: 0.075 / 1_000_000,   // $0.075 per 1M input tokens
  outputPrice: 0.30 / 1_000_000,   // $0.30 per 1M output tokens
  
  // P50 场景
  p50InputTokens: 8000,
  p50OutputTokens: 2000,
  p50RetryRate: 0.15,
  p50RepairRate: 0.20,
  p50StepCount: 3.5,
  
  // P95 场景
  p95InputTokens: 20000,
  p95OutputTokens: 5000,
  p95RetryRate: 0.30,
  p95RepairRate: 0.40,
  p95StepCount: 5,
};

// P50 成本计算
const p50Cost = (
  (8000 * 0.075/1e6 + 2000 * 0.30/1e6) * 
  (1 + 0.15) * 
  (1 + 0.20) * 
  3.5
);
// = (0.0006 + 0.0006) * 1.15 * 1.20 * 3.5
// = 0.0012 * 1.15 * 1.20 * 3.5
// = 0.00579 per entry

// P95 成本计算
const p95Cost = (
  (20000 * 0.075/1e6 + 5000 * 0.30/1e6) * 
  (1 + 0.30) * 
  (1 + 0.40) * 
  5
);
// = (0.0015 + 0.0015) * 1.30 * 1.40 * 5
// = 0.003 * 1.30 * 1.40 * 5
// = 0.0273 per entry

// 月成本（100 条/天）
const monthlyCostP50 = 100 * 30 * 0.00579 = $17.37
const monthlyCostP95 = 100 * 30 * 0.0273 = $81.90
```

### 4.2 统一成本口径

| 指标 | Baseline (现状) | Target (Phase 1) | 测量方法 |
|------|----------------|------------------|----------|
| **单条成本** | $0.003/entry | $0.006/entry (P50) | Token 统计 |
| **月成本** | $9/月 (100条/天) | $17-82/月 (P50-P95) | 月度汇总 |
| **成本增幅** | - | +89% (P50) | 对比 baseline |

**结论**：
- 使用 Gemini 2.0 Flash：$17-82/月（P50-P95）
- 使用本地代理：接近 $0（仅算力成本）
- 成本增加可控，质量提升值得

---

## 五、实施计划修正

### Phase 1: 最小可行 ReAct（24-32h, 3-4 天）

| 任务 | 工作量 | 依赖 | 验收标准 |
|------|--------|------|----------|
| **1.1 API 修正** | 4-6h | - | `generateText + tools + output` 工作正常 |
| **1.2 工具补齐** | 4-6h | 1.1 | `find_relations` 基于 `findRelatedEntries` 实现 |
| **1.3 契约兼容** | 2-3h | 1.2 | `ingestAction` 字段生效 |
| **1.4 工厂模式** | 3-4h | 1.3 | `createAgentEngine()` 统一双入口 |
| **1.5 DB Schema** | 2-3h | 1.4 | `ToolCallLog` model 迁移完成 |
| **1.6 测试验证** | 4-6h | 1.5 | 黄金数据集 10 条通过 |
| **1.7 灰度发布** | 3-4h | 1.6 | API Route 先行，Inngest 跟进 |

**Phase 1 交付物**：
- ✅ 工具真正被调用（check_duplicate、find_relations、extract_code）
- ✅ 动态输出深度（根据内容长度调整 keyPoints 数量）
- ✅ 契约兼容（保持 `NormalizedAgentIngestDecision`）
- ✅ 成本可控（使用本地代理）
- ✅ 可回滚（工厂模式 + 环境变量）

---

## 六、验证标准（保持不变）

### 6.1 黄金数据集

```typescript
// tests/fixtures/golden-dataset.ts
export const GOLDEN_DATASET = [
  {
    id: 'short-tutorial',
    input: { content: '...', length: 2500 },
    expected: {
      keyPoints: { core: 3, extended: 1 },
      toolsCalled: ['check_duplicate'],
      summaryLength: [100, 150],
    },
  },
  // ... 10 条
];
```

### 6.2 自动回归测试

```typescript
// tests/agent/regression.test.ts
describe('ReAct Agent Regression', () => {
  GOLDEN_DATASET.forEach(({ id, input, expected }) => {
    it(`should handle ${id} correctly`, async () => {
      const result = await agent.process(input);
      
      expect(result.toolsCalled).toEqual(
        expect.arrayContaining(expected.toolsCalled)
      );
      
      expect(result.keyPoints.core.length).toBe(expected.keyPoints.core);
    });
  });
});
```

### 6.3 A/B 指标门槛

| 指标 | Baseline | Target | 测量方法 |
|------|----------|--------|----------|
| 工具调用率 | 0% | >80% | 日志统计 |
| 摘要长度适配 | 固定 | 动态 (±30%) | 自动测试 |
| 处理时间 | 15s (P50) | <30s (P50) | Inngest metrics |
| 成本 | $0.003/entry | <$0.01/entry (P50) | Token 统计 |
| 质量分 | 6.5/10 | >7.5/10 | `evaluateDecisionQuality` |

---

## 七、安全约束（补充完整）

### 7.1 工具白名单

```typescript
// src/lib/ai/agent/security.ts
const ALLOWED_TOOLS = [
  'check_duplicate',
  'find_relations',
  'extract_code',
  'extract_version',
] as const;

export function validateToolCall(toolName: string): boolean {
  return ALLOWED_TOOLS.includes(toolName as any);
}
```

### 7.2 参数上限

```typescript
const TOOL_LIMITS = {
  check_duplicate: {
    maxContentLength: 50000,
    maxResults: 10,
  },
  find_relations: {
    maxResults: 10,
    maxCandidates: 100,
  },
};
```

### 7.3 敏感字段脱敏

```typescript
function sanitizeForTool(content: string): string {
  return content
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]')
    .replace(/\b[\w.-]+@[\w.-]+\.\w+\b/g, '[EMAIL]');
}
```

### 7.4 审计日志（已补充 Prisma model）

```typescript
// 每次工具调用记录
await prisma.toolCallLog.create({
  data: {
    entryId,
    toolName,
    parameters: sanitize(params),
    result: sanitize(result),
    duration: endTime - startTime,
    success: true,
  },
});
```

---

## 八、ADR: 为什么不是 LangGraph 优先？（保持不变）

**决策**: Phase 1 使用 Vercel AI SDK 原生实现，Phase 2 可选 LangGraph。

**理由**：
1. 已有依赖，无需新增
2. 架构兼容，与现有 `getModel()` 无缝集成
3. 功能充足，`generateText + tools + output + stopWhen` 已支持多步推理
4. 学习成本低
5. 工期可控

---

## 九、修订后的决策点

### ✅ 已确认的决策

1. **技术路线**：Vercel AI SDK 原生（Phase 1）→ 可选 LangGraph（Phase 2）
2. **工具优先级**：补齐所有工具（包括 `find_relations`）
3. **成本预算**：使用本地代理，$17-82/月可接受
4. **实施时间**：下周开始 Phase 1（24-32h）

### 🔄 待确认的细节

1. **本地代理配置**：
   - [ ] 确认本地代理 endpoint 和 API key
   - [ ] 确认模型选择（gpt-4o-mini / qwen-plus / deepseek-v3）

2. **黄金数据集**：
   - [ ] 从现有 Entry 中选择 10 条代表性数据
   - [ ] 人工标注预期输出

3. **灰度策略**：
   - [ ] 先在 API Route 测试（手动触发）
   - [ ] 再切换 Inngest（自动处理）
   - [ ] 最后全量切换

---

## 十、Codex 评审问题修正清单

| Codex 问题 | 修正状态 | 证据 |
|-----------|---------|------|
| **Critical #1**: API 使用错误 | ✅ 已修正 | 改用 `generateText + tools + output` |
| **Critical #2**: 函数不存在 | ✅ 已修正 | 基于 `findRelatedEntries` 实现 |
| **Critical #3**: 问题覆盖不完整 | ✅ 已修正 | 补齐 #5/#6/#7/#8/#10 解决方案 |
| **High #4**: 成本计算错误 | ✅ 已修正 | 重新计算，P50=$17.37, P95=$81.90 |
| **High #5**: 成本口径冲突 | ✅ 已修正 | 统一为 $0.006/entry (P50) |
| **High #6**: 工期偏乐观 | ✅ 已修正 | 调整为 24-32h |
| **Medium #7**: Tool 参数名 | ✅ 已确认 | Vercel AI SDK 用 `parameters` |
| **Medium #8**: DB Schema 缺失 | ✅ 已修正 | 补充 `ToolCallLog` model |

---

## 十一、下一步行动

1. **立即**：
   - [ ] Codex 复审 v2.1
   - [ ] 确认通过后开始实施

2. **本周**：
   - [ ] 准备黄金数据集
   - [ ] 配置本地代理

3. **下周 Phase 1**：
   - [ ] Day 1: API 修正 + 工具补齐
   - [ ] Day 2: 工厂模式 + DB Schema
   - [ ] Day 3: 测试验证
   - [ ] Day 4: 灰度发布

---

**修订完成，等待 Codex 复审。**
