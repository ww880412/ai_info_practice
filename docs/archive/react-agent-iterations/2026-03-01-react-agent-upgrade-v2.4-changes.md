# ReAct Agent 升级方案 v2.4 - Codex 第五次评审修正版

**修订日期**: 2026-03-01
**修订原因**: 修复 Codex 第五次评审发现的 3 个问题（1 High + 2 Medium）
**状态**: 待 Codex 第六次复审

---

## v2.3 → v2.4 关键修正

| 问题级别 | v2.3 错误 | v2.4 修正 |
|---------|-----------|-----------|
| **High #1** | `processStatus: 'COMPLETED'` 枚举值错误 | 改用 `processStatus: 'DONE'` |
| **Medium #2** | `createAgentEngine` 返回类型不兼容 | 改为 `Promise<ReActAgent \| ReActAgentV2>` |
| **Medium #3** | 调用点 #2 原代码描述不准确 | 补全完整改造步骤（含 import 清理） |

---

## 一、技术选型修正（Critical #1）

### 1.1 正确的 Vercel AI SDK 用法

```typescript
// ✅ v2.3 正确写法（基于 ai@6.0.105）
import { generateText, tool, Output, stepCountIs } from 'ai';
import { z } from 'zod';
import { getModel } from '@/lib/ai/client';
import { findSimilarEntries } from '@/lib/ai/deduplication';

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
        // 使用新函数：基于内容语义匹配
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
    }),
  },
  stopWhen: stepCountIs(5),  // ✅ 正确：使用 stopWhen 而非 maxSteps
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
1. 导入 `stepCountIs` 辅助函数
2. 使用 `stopWhen: stepCountIs(5)` 替代 `maxSteps: 5`
3. 保持其他正确用法：`inputSchema`、`Output.object()`、`result.output`

**参考文档**：
- https://sdk.vercel.ai/docs/reference/ai-sdk-core/step-count-is

---

## 二、函数依赖修正（High #2 + #3）

### 2.1 新增 findRelatedEntriesByContent 函数

```typescript
// src/lib/ai/associationDiscovery.ts

/**
 * 基于内容语义匹配查找关联条目（不依赖 entryId）
 * 用于 ReAct Agent 的 find_relations 工具
 */
export async function findRelatedEntriesByContent(
  content: string,
  title: string,
  limit: number = 5
): Promise<RelatedEntry[]> {
  // Step 1: 获取候选条目（使用正确的 Prisma 字段和枚举值）
  const candidates = await prisma.entry.findMany({
    where: {
      knowledgeStatus: 'ACTIVE',  // ✅ 正确字段名
      processStatus: 'DONE',      // ✅ 正确枚举值（非 COMPLETED）
    },
    select: {
      id: true,
      title: true,
      coreSummary: true,  // ✅ 正确字段名（非 summary）
      aiTags: true,
    },
    take: 50,
  });

  // Step 2: 使用 AI 进行语义匹配
  const prompt = `Given a new entry and existing entries, identify the top ${limit} most related entries.

New Entry:
- Title: ${title}
- Content: ${content.slice(0, 500)}

Existing Entries:
${candidates.map((e, i) => `${i + 1}. [${e.id}] ${e.title}\n   Summary: ${e.coreSummary || 'N/A'}\n   Tags: ${e.aiTags.join(', ')}`).join('\n\n')}

Return the top ${limit} related entries with relationship types and confidence scores.`;

  const schema = z.object({
    relatedEntries: z.array(z.object({
      id: z.string(),
      relationType: z.enum(['similar_topic', 'builds_on', 'complementary', 'contrasting']),
      similarity: z.number().min(0).max(1),
      reasoning: z.string(),
    })),
  });

  const result = await generateJSON(prompt, schema);

  // Step 3: 补充完整信息
  return result.relatedEntries.map(r => {
    const entry = candidates.find(c => c.id === r.id);
    return {
      id: r.id,
      title: entry?.title || '',
      summary: entry?.coreSummary || '',
      similarity: r.similarity,
      relationType: r.relationType,
    };
  });
}
```

**关键修正**：
1. 使用 `knowledgeStatus: 'ACTIVE'` 而非 `status: 'ACTIVE'`
2. 使用 `coreSummary` 而非 `summary`
3. 统一函数名为 `findRelatedEntriesByContent`（全文一致）

---

## 三、createAgentEngine 工厂修正（Medium #4）

### 3.1 异步工厂函数定义

```typescript
// src/lib/ai/agent/factory.ts
import { ReActAgent } from './engine';
import { getAgentConfig } from './get-config';
import type { AgentConfig } from './types';

/**
 * 创建 Agent 引擎实例（支持 v1/v2 切换）
 * 必须使用 async 因为 getAgentConfig() 是异步的
 */
export async function createAgentEngine(): Promise<ReActAgent | ReActAgentV2> {
  const useV2 = process.env.USE_REACT_V2 === 'true';
  const config = await getAgentConfig();  // ✅ await async 函数

  if (useV2) {
    // Phase 2: 使用新版 ReAct 引擎
    const { ReActAgentV2 } = await import('./react-engine-v2');
    return new ReActAgentV2(config);
  }

  // Phase 1: 使用现有引擎
  return new ReActAgent(config);
}
```

### 3.2 调用点改造清单

#### 调用点 #1: Inngest 函数

```typescript
// src/lib/inngest/functions/process-entry.ts:269

// ❌ v2.2 错误（直接 new）
const agentConfig = await getAgentConfig();
const agent = new ReActAgent(agentConfig);

// ✅ v2.3 正确（使用工厂）
const agent = await createAgentEngine();
```

#### 调用点 #2: API Route

```typescript
// src/app/api/ai/process/route.ts:179-180

// ❌ v2.3 错误（直接 new）
const agentConfig = await getAgentConfig();
const agent = new ReActAgent(agentConfig);

// ✅ v2.4 正确（使用工厂 + 清理 import）
// 1. 移除 import: import { getAgentConfig } from '@/lib/ai/agent/get-config';
// 2. 添加 import: import { createAgentEngine } from '@/lib/ai/agent/factory';
// 3. 替换代码：
const agent = await createAgentEngine();
```

**完整改造步骤**：
1. 移除不再需要的 import：
   ```typescript
   - import { getAgentConfig } from '@/lib/ai/agent/get-config';
   ```
2. 添加新的 import：
   ```typescript
   + import { createAgentEngine } from '@/lib/ai/agent/factory';
   ```
3. 替换实例化代码（删除 2 行，新增 1 行）：
   ```typescript
   - const agentConfig = await getAgentConfig();
   - const agent = new ReActAgent(agentConfig);
   + const agent = await createAgentEngine();
   ```

**完整改造清单**：
| 文件 | 行号 | 原代码 | 修改后 | 额外步骤 |
|------|------|--------|--------|----------|
| `src/lib/inngest/functions/process-entry.ts` | 268-269 | `const agentConfig = await getAgentConfig();`<br>`const agent = new ReActAgent(agentConfig);` | `const agent = await createAgentEngine();` | 添加 import: `createAgentEngine` |
| `src/app/api/ai/process/route.ts` | 179-180 | `const agentConfig = await getAgentConfig();`<br>`const agent = new ReActAgent(agentConfig);` | `const agent = await createAgentEngine();` | 移除 import: `getAgentConfig`<br>添加 import: `createAgentEngine` |

---

## 四、buildSemanticSnapshot 调用修正

```typescript
// src/lib/ai/agent/react-engine-v2.ts

function buildReActPrompt(input: ParseResult): string {
  // ✅ 正确：传字符串而非对象
  const snapshot = buildSemanticSnapshot(input.content);

  return `你是知识入库分析专家。

输入标题：${input.title}
输入长度：${input.content.length} 字符
输入来源：${input.sourceType}

内容快照：
${snapshot}

可用工具：
- check_duplicate: 检查是否有重复内容
- find_relations: 发现与现有知识的关联

请分析内容并决定需要调用哪些工具。`;
}
```

**现有函数签名**（已验证）：
```typescript
// src/lib/ai/agent/engine.ts:177
export function buildSemanticSnapshot(content: string, limit = STEP2_INPUT_LIMIT): string
```

---

## 五、成本模型（保持 v2.2 正确计算）

### 5.1 成本计算公式

```typescript
// P50 成本
const p50Cost = (
  (8000 * 0.075/1e6 + 2000 * 0.30/1e6) *
  (1 + 0.15) *
  (1 + 0.20) *
  3.5
);
// = 0.00579 per entry

// 月成本（100 条/天）
const monthlyCostP50 = 100 * 30 * 0.00579 = $17.37
```

### 5.2 统一成本口径

| 指标 | Baseline (现状) | Target (Phase 1) | 测量方法 |
|------|----------------|------------------|----------|
| **单条成本** | $0.003/entry | $0.006/entry (P50) | Token 统计 |
| **月成本** | $9/月 (100条/天) | $17-82/月 (P50-P95) | 月度汇总 |
| **成本增幅** | - | **+93%** (P50) | 对比 baseline |

**计算验证**：
- Baseline: $0.003/entry
- P50: $0.00579/entry
- 增幅: (0.00579 - 0.003) / 0.003 = 0.93 = **+93%** ✅

---

## 六、10 个问题完整闭环

| # | 问题 | v2.3 解决方案 |
|---|------|---------------|
| **#1** | 输出契约断链 | ✅ `ingestAction` 字段保持契约兼容 |
| **#2** | 技术选型冲突 | ✅ 使用 `getModel()` 复用现有 provider |
| **#3** | 成本估算偏乐观 | ✅ 公式化估算 + 修正增幅为 +93% |
| **#4** | 工具清单不一致 | ✅ 工具台账 + `find_relations` 统一实现 |
| **#5** | Few-shot 示例漂移 | ⚠️ Phase 2（非阻断） |
| **#6** | ReAct 输入截断过短 | ✅ 使用 `buildSemanticSnapshot(input.content)` |
| **#7** | 回滚方案未落地 | ✅ `async createAgentEngine()` 工厂 + 两处调用点 |
| **#8** | 实施计划缺少任务 | ✅ 工期 24-32h + 详细任务分解 |
| **#9** | 验证方案偏人工 | ✅ 黄金数据集 + 自动回归 |
| **#10** | 缺少安全章节 | ✅ Prisma model + 审计日志 |

---

## 七、实施计划

### Phase 1: 最小可行 ReAct（24-32h, 3-4 天）

| 任务 | 工作量 | 依赖 | 验收标准 |
|------|--------|------|----------|
| **1.1 API 修正** | 4-6h | - | `generateText + stopWhen + Output.object()` 工作正常 |
| **1.2 工具补齐** | 4-6h | 1.1 | `findRelatedEntriesByContent` 实现并测试通过 |
| **1.3 契约兼容** | 2-3h | 1.2 | `ingestAction` 字段生效 |
| **1.4 工厂模式** | 3-4h | 1.3 | `async createAgentEngine()` + 两处调用点改造 |
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

## 八、Codex 第五次评审问题修正清单

| Codex 问题 | 级别 | 修正状态 | 证据 |
|-----------|------|---------|------|
| **#1**: processStatus 枚举值错误 | High | ✅ 已修正 | 改用 `processStatus: 'DONE'` |
| **#2**: createAgentEngine 返回类型不兼容 | Medium | ✅ 已修正 | 改为 `Promise<ReActAgent \| ReActAgentV2>` |
| **#3**: 调用点 #2 改造描述不完整 | Medium | ✅ 已修正 | 补全完整步骤（含 import 清理） |

---

## 九、关键 API 用法总结

### 9.1 正确的 generateText 调用

```typescript
import { generateText, tool, Output, stepCountIs } from 'ai';

const result = await generateText({
  model: getModel(),
  tools: {
    tool_name: tool({
      inputSchema: z.object({ /* ... */ }),  // ✅ 使用 inputSchema
      execute: async (params) => { /* ... */ },
    }),
  },
  stopWhen: stepCountIs(5),  // ✅ 使用 stopWhen 而非 maxSteps
  output: Output.object({    // ✅ 使用 Output.object()
    schema: z.object({ /* ... */ }),
  }),
  prompt: '...',
});

const decision = result.output;  // ✅ 访问 output 而非 object
```

### 9.2 正确的 Prisma 查询

```typescript
const entries = await prisma.entry.findMany({
  where: {
    knowledgeStatus: 'ACTIVE',  // ✅ 正确字段名
    processStatus: 'DONE',      // ✅ 正确枚举值（非 COMPLETED）
  },
  select: {
    id: true,
    title: true,
    coreSummary: true,  // ✅ 正确字段名（非 summary）
    aiTags: true,
  },
});
```

**Prisma 枚举值参考**：
```prisma
enum ProcessStatus {
  PENDING
  PARSING
  AI_PROCESSING
  DONE      // ✅ 使用 DONE
  FAILED
  PARTIAL
}

enum KnowledgeStatus {
  PENDING
  ACTIVE    // ✅ 使用 ACTIVE
  ARCHIVED
  DEPRECATED
}
```

### 9.3 正确的异步工厂

```typescript
// 定义（支持类型兼容）
export async function createAgentEngine(): Promise<ReActAgent | ReActAgentV2> {
  const config = await getAgentConfig();  // ✅ await async 函数

  if (process.env.USE_REACT_V2 === 'true') {
    const { ReActAgentV2 } = await import('./react-engine-v2');
    return new ReActAgentV2(config);
  }

  return new ReActAgent(config);
}

// 调用（两处）
// 1. src/lib/inngest/functions/process-entry.ts
const agent = await createAgentEngine();

// 2. src/app/api/ai/process/route.ts
const agent = await createAgentEngine();
```

---

## 十、下一步行动

1. **立即**：
   - [ ] Codex 第五次复审 v2.3
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

**v2.4 修订完成，等待 Codex 第六次复审。**

## 附录：历次评审修正总结

| 版本 | 评审轮次 | 问题数 | 主要修正 | 状态 |
|------|---------|--------|----------|------|
| v2.0 | 第一次 | 10 | LangGraph → Vercel AI SDK | ❌ 拒绝 |
| v2.1 | 第二次 | 8 (2C+4H+2M) | API 用法、函数依赖、成本计算 | ❌ 拒绝 |
| v2.2 | 第三次 | 8 (2C+4H+2M) | 同 v2.1（未通过） | ❌ 拒绝 |
| v2.3 | 第四次 | 4 (1C+2H+1M) | maxSteps → stopWhen、Prisma 字段 | ❌ 拒绝 |
| v2.4 | 第五次 | 3 (1H+2M) | 枚举值、返回类型、改造步骤 | ⏳ 待审 |

**关键收获**：
1. AI SDK 用法：`inputSchema` + `Output.object()` + `result.output` + `stopWhen: stepCountIs(5)`
2. Prisma 字段：`knowledgeStatus: 'ACTIVE'` + `processStatus: 'DONE'` + `coreSummary`
3. 异步工厂：返回类型 `Promise<ReActAgent | ReActAgentV2>` 支持类型兼容
4. 改造清单：必须包含完整步骤（代码替换 + import 清理）
