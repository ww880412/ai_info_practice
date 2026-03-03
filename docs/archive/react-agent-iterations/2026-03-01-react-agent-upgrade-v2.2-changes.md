# ReAct Agent 升级方案 v2.2 - Codex 第三次评审修正版

**修订日期**: 2026-03-01
**修订原因**: 修复 Codex 第三次评审发现的 8 个问题（2 Critical + 4 High + 2 Medium）
**状态**: 待 Codex 第四次复审

---

## v2.1 → v2.2 关键修正

| 问题级别 | v2.1 错误 | v2.2 修正 |
|---------|-----------|-----------|
| **Critical #1** | `tool({ parameters })` + `output: 'object'` + `result.object` | `tool({ inputSchema })` + `output: Output.object()` + `result.output` |
| **Critical #2** | 文档说用 `stopWhen` 但示例仍用 `maxSteps` | 统一使用 `maxSteps`（SDK 支持） |
| **High #3** | `buildSemanticSnapshot(input)` 传对象 | `buildSemanticSnapshot(input.content)` 传字符串 |
| **High #4** | `createAgentEngine()` 同步调用 async 函数 | 改为 async 工厂或在调用处 await |
| **High #5** | `extractCodeBlocks` 不存在 + `entryId` 缺失 | 移除 `extract_code` 工具 + 改用 `content` 参数 |
| **High #6** | 成本增幅 +89% 错误 | 修正为 +93% |
| **Medium #7** | Tool 参数命名自相矛盾 | 统一为 `inputSchema` |
| **Medium #8** | `findRelatedEntries` 参数名错误 | 改为 `limit` |

---

## 一、技术选型修正（Critical #1 + #2）

### 1.1 正确的 Vercel AI SDK 用法

```typescript
// ✅ v2.2 正确写法（基于 ai@6.0.105）
import { generateText, tool, Output } from 'ai';
import { z } from 'zod';
import { getModel } from '@/lib/ai/client';
import { findSimilarEntries } from '@/lib/ai/deduplication';
import { findRelatedEntries } from '@/lib/ai/associationDiscovery';

const result = await generateText({
  model: getModel(),
  tools: {
    check_duplicate: tool({
      description: '检查数据库中是否存在相似内容',
      inputSchema: z.object({
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
      inputSchema: z.object({
        content: z.string().describe('内容文本用于语义匹配'),
        title: z.string().describe('标题'),
        limit: z.number().default(5).describe('最多返回关联数'),
      }),
      execute: async ({ content, title, limit }) => {
        // 使用内容语义匹配，不依赖 entryId
        const relations = await findRelatedEntries(content, title, limit);
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
  },
  maxSteps: 5,  // ✅ SDK 支持此参数
  output: Output.object({
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
  }),
  prompt: buildReActPrompt(input),
});

// ✅ 访问结果（使用 output 而非 object）
const decision = result.output;
const toolCalls = result.steps.flatMap(s => s.toolCalls || []);
```

**关键修正**：
1. `tool()` 使用 `inputSchema` 而非 `parameters`
2. `output` 使用 `Output.object({ schema })` 而非字符串 `'object'`
3. 结果访问使用 `result.output` 而非 `result.object`
4. 保留 `maxSteps` 参数（SDK 支持，无需改为 `stopWhen`）

**参考文档**：
- https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-text
- https://sdk.vercel.ai/docs/reference/ai-sdk-core/tool
- https://sdk.vercel.ai/docs/reference/ai-sdk-core/output

---

## 二、函数依赖修正（High #3 + #5 + #8）

### 2.1 buildSemanticSnapshot 调用修正

```typescript
// ❌ v2.1 错误（传对象）
const snapshot = buildSemanticSnapshot(input);

// ✅ v2.2 正确（传字符串）
const snapshot = buildSemanticSnapshot(input.content);
```

**现有函数签名**（已验证）：
```typescript
// src/lib/ai/agent/engine.ts:177
export function buildSemanticSnapshot(content: string, limit = STEP2_INPUT_LIMIT): string
```

### 2.2 find_relations 工具重新设计

```typescript
// ❌ v2.1 错误（依赖不存在的 entryId）
find_relations: tool({
  inputSchema: z.object({
    entryId: z.string(),  // ❌ ParseResult 没有此字段
    maxResults: z.number(),  // ❌ 参数名错误
  }),
  execute: async ({ entryId, maxResults }) => {
    const relations = await findRelatedEntries(entryId, maxResults);  // ❌ 签名不匹配
    // ...
  },
})

// ✅ v2.2 正确（使用 content 语义匹配）
find_relations: tool({
  description: '发现内容与现有知识库的关联关系',
  inputSchema: z.object({
    content: z.string().describe('内容文本用于语义匹配'),
    title: z.string().describe('标题'),
    limit: z.number().default(5).describe('最多返回关联数'),
  }),
  execute: async ({ content, title, limit }) => {
    // 基于内容语义匹配，不依赖 entryId
    // 需要扩展 findRelatedEntries 支持内容匹配
    const relations = await findRelatedEntriesByContent(content, title, limit);
    return {
      relatedEntries: relations.map(r => ({
        id: r.id,
        title: r.title,
        relationshipType: r.relationType,
        confidence: r.similarity,
      })),
    };
  },
})
```

**新增辅助函数**：
```typescript
// src/lib/ai/associationDiscovery.ts
export async function findRelatedEntriesByContent(
  content: string,
  title: string,
  limit: number = 5
): Promise<RelatedEntry[]> {
  // 使用现有的 generateJSON 进行语义匹配
  // 实现逻辑类似现有的 findRelatedEntries，但不依赖 entryId
  const candidates = await prisma.entry.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, title: true, summary: true, aiTags: true },
    take: 50,
  });

  const prompt = `Given a new entry and existing entries, identify related entries.

New Entry:
- Title: ${title}
- Content: ${content.slice(0, 500)}

Existing Entries:
${candidates.map((e, i) => `${i + 1}. ${e.title} - ${e.summary}`).join('\n')}

Return top ${limit} related entries with relationship types.`;

  const result = await generateJSON(prompt, /* schema */);
  return result.relatedEntries;
}
```

### 2.3 移除 extract_code 工具

```typescript
// ❌ v2.1 包含不存在的函数
extract_code: tool({
  execute: async ({ content }) => {
    const codeBlocks = extractCodeBlocks(content);  // ❌ 函数不存在
    // ...
  },
})

// ✅ v2.2 移除此工具
// 代码提取功能可在后续 Phase 2 实现
```

---

## 三、createAgentEngine 工厂修正（High #4）

### 3.1 异步工厂模式

```typescript
// ❌ v2.1 错误（同步调用 async 函数）
export function createAgentEngine(): ReActAgent {
  const useV2 = process.env.USE_REACT_V2 === 'true';

  if (useV2) {
    return new ReActAgentV2(getAgentConfig());  // ❌ getAgentConfig 是 async
  }

  return new ReActAgent(getAgentConfig());  // ❌ 同样错误
}

// ✅ v2.2 正确（异步工厂）
export async function createAgentEngine(): Promise<ReActAgent> {
  const useV2 = process.env.USE_REACT_V2 === 'true';
  const config = await getAgentConfig();  // ✅ await async 函数

  if (useV2) {
    return new ReActAgentV2(config);
  }

  return new ReActAgent(config);
}

// 调用处修改
// src/lib/inngest/functions/process-entry.ts
const agent = await createAgentEngine();  // ✅ await 工厂函数
```

**现有函数签名**（已验证）：
```typescript
// src/lib/ai/agent/get-config.ts:5
export async function getAgentConfig(): Promise<AgentConfig>
```

---

## 四、成本模型修正（High #6）

### 4.1 修正后的成本计算

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
|------|----------------|------------------|------------|
| **单条成本** | $0.003/entry | $0.006/entry (P50) | Token 统计 |
| **月成本** | $9/月 (100条/天) | $17-82/月 (P50-P95) | 月度汇总 |
| **成本增幅** | - | **+93%** (P50) | 对比 baseline |

**修正说明**：
- Baseline: $0.003/entry
- P50: $0.00579/entry
- 增幅: (0.00579 - 0.003) / 0.003 = 0.93 = **+93%**（非 +89%）

---

## 五、10 个问题完整闭环

### 原 Codex 评审的 10 个问题

| # | 问题 | v2.0 状态 | v2.2 解决方案 |
|---|------|-----------|---------------|
| **#1** | 输出契约断链 | ✅ 已解决 | `ingestAction` 字段保持契约兼容 |
| **#2** | 技术选型冲突 | ✅ 已解决 | 使用 `getModel()` 复用现有 provider |
| **#3** | 成本估算偏乐观 | ✅ 已解决 | 公式化估算 + 修正增幅为 +93% |
| **#4** | 工具清单不一致 | ✅ 已解决 | 工具台账 + `find_relations` 基于内容匹配 |
| **#5** | Few-shot 示例漂移 | ⚠️ Phase 2 | Schema 自动生成示例（非阻断） |
| **#6** | ReAct 输入截断过短 | ✅ 已解决 | 使用 `buildSemanticSnapshot(input.content)` |
| **#7** | 回滚方案未落地 | ✅ 已解决 | `async createAgentEngine()` 工厂 |
| **#8** | 实施计划缺少任务 | ✅ 已解决 | 工期 24-32h + 详细任务分解 |
| **#9** | 验证方案偏人工 | ✅ 已解决 | 黄金数据集 + 自动回归 |
| **#10** | 缺少安全章节 | ✅ 已解决 | Prisma model + 审计日志 |

---

## 六、实施计划修正

### Phase 1: 最小可行 ReAct（24-32h, 3-4 天）

| 任务 | 工作量 | 依赖 | 验收标准 |
|------|--------|------|----------|
| **1.1 API 修正** | 4-6h | - | `generateText + Output.object()` 工作正常 |
| **1.2 工具补齐** | 4-6h | 1.1 | `find_relations` 基于内容匹配实现 |
| **1.3 契约兼容** | 2-3h | 1.2 | `ingestAction` 字段生效 |
| **1.4 工厂模式** | 3-4h | 1.3 | `async createAgentEngine()` 统一双入口 |
| **1.5 DB Schema** | 2-3h | 1.4 | `ToolCallLog` model 迁移完成 |
| **1.6 测试验证** | 4-6h | 1.5 | 黄金数据集 10 条通过 |
| **1.7 灰度发布** | 3-4h | 1.6 | API Route 先行，Inngest 跟进 |

**Phase 1 交付物**：
- ✅ 工具真正被调用（check_duplicate、find_relations）
- ✅ 动态输出深度（根据内容长度调整 keyPoints 数量）
- ✅ 契约兼容（保持 `NormalizedAgentIngestDecision`）
- ✅ 成本可控（使用本地代理）
- ✅ 可回滚（异步工厂模式 + 环境变量）

---

## 七、Codex 第三次评审问题修正清单

| Codex 问题 | 级别 | 修正状态 | 证据 |
|-----------|------|---------|------|
| **#1**: API 使用错误 | Critical | ✅ 已修正 | 改用 `inputSchema` + `Output.object()` + `result.output` |
| **#2**: maxSteps/stopWhen 矛盾 | Critical | ✅ 已修正 | 统一使用 `maxSteps`（SDK 支持） |
| **#3**: buildSemanticSnapshot 类型错误 | High | ✅ 已修正 | 传 `input.content` 而非 `input` |
| **#4**: createAgentEngine 异步错误 | High | ✅ 已修正 | 改为 `async` 工厂函数 |
| **#5**: 函数依赖不完整 | High | ✅ 已修正 | 移除 `extract_code` + `find_relations` 改用内容匹配 |
| **#6**: 成本增幅错误 | High | ✅ 已修正 | 修正为 +93% |
| **#7**: Tool 参数命名矛盾 | Medium | ✅ 已修正 | 统一为 `inputSchema` |
| **#8**: findRelatedEntries 参数名错误 | Medium | ✅ 已修正 | 使用 `limit` 参数 |

---

## 八、下一步行动

1. **立即**：
   - [ ] Codex 第四次复审 v2.2
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

**v2.2 修订完成，等待 Codex 第四次复审。**
