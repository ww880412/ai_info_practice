# ReAct Agent 升级方案 v2.6 - Codex 第七次评审修正版

**修订日期**: 2026-03-01
**修订原因**: 修复 Codex 第七次评审发现的接口返回类型不一致问题（1 High）
**状态**: 待 Codex 第八次复审

---

## v2.5 → v2.6 关键修正

| 问题级别 | v2.5 错误 | v2.6 修正 |
|---------|-----------|-----------|
| **High #1** | `IAgentEngine.process` 返回 `NormalizedAgentIngestDecision` 但现有实现返回 `ReasoningTrace` | 修改 `ReActAgent.process` 内部调用 `normalizeAgentIngestDecision` 并直接返回决策结果 |

**Codex 发现的问题**：
- v2.5 定义接口返回 `Promise<NormalizedAgentIngestDecision>`
- 但现有 `ReActAgent.process` 实际返回 `Promise<ReasoningTrace>`
- 两处调用点都依赖 `trace.finalResult` 属性
- 这导致接口定义与实际实现不一致，无法通过 TypeScript 编译

**v2.6 解决方案**：
- 采用方案 B（彻底重构）：让 `process` 方法直接返回 `NormalizedAgentIngestDecision`
- 在 `ReActAgent.process` 内部完成 `normalizeAgentIngestDecision` 转换
- 简化两处调用点的代码（移除重复的 normalize 逻辑）

---

## 一、共享接口设计（保持 v2.5）

### 1.1 定义 IAgentEngine 接口

```typescript
// src/lib/ai/agent/types.ts

/**
 * Agent 引擎统一接口
 * 确保 v1 和 v2 实现兼容
 */
export interface IAgentEngine {
  /**
   * 处理条目并返回决策
   * @param entryId 条目 ID
   * @param input 解析后的输入
   * @param options 可选配置（进度回调等）
   */
  process(
    entryId: string,
    input: ParseResult,
    options?: {
      onProgress?: (message: string) => Promise<void>;
    }
  ): Promise<NormalizedAgentIngestDecision>;
}
```

### 1.2 ReActAgent 实现接口（修正返回类型）

```typescript
// src/lib/ai/agent/engine.ts

import { normalizeAgentIngestDecision } from './ingest-contract';

export class ReActAgent implements IAgentEngine {
  private config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = config;
  }

  /**
   * 处理条目并返回决策
   * 内部执行推理过程，最终返回标准化的决策结果
   */
  async process(
    entryId: string,
    input: ParseResult,
    options?: {
      onProgress?: (message: string) => Promise<void>;
    }
  ): Promise<NormalizedAgentIngestDecision> {
    // 执行原有的推理过程（保持不变）
    const trace = await this.executeReasoning(entryId, input, options);

    // 在方法内部完成标准化转换
    const normalized = normalizeAgentIngestDecision(trace.finalResult, {
      contentLength: input.content.length,
    });

    if (!normalized) {
      throw new Error('Agent output missing required fields');
    }

    return normalized;
  }

  /**
   * 内部方法：执行推理过程
   * 返回完整的推理轨迹（包含 steps 和 finalResult）
   */
  private async executeReasoning(
    entryId: string,
    input: ParseResult,
    options?: {
      onProgress?: (message: string) => Promise<void>;
    }
  ): Promise<ReasoningTrace> {
    // 原有的 process 方法实现移到这里
    const startTime = new Date().toISOString();
    const steps: ReasoningStep[] = [];

    await options?.onProgress?.("AI Step 1/2：内容分析与结构推理...");
    // ... 原有实现保持不变

    return {
      entryId,
      startTime,
      endTime: new Date().toISOString(),
      steps,
      finalResult: /* ... */,
    };
  }
}
```

**关键修正**：
1. `process` 方法现在直接返回 `Promise<NormalizedAgentIngestDecision>`
2. 原有推理逻辑移到私有方法 `executeReasoning`
3. 在 `process` 内部调用 `normalizeAgentIngestDecision` 完成转换
4. 如果转换失败，抛出明确的错误信息

### 1.3 工厂函数返回接口类型（保持 v2.5）

```typescript
// src/lib/ai/agent/factory.ts
import type { IAgentEngine } from './types';
import { ReActAgent } from './engine';
import { getAgentConfig } from './get-config';

/**
 * 创建 Agent 引擎实例（支持 v1/v2 切换）
 * 返回统一接口，确保类型兼容
 */
export async function createAgentEngine(): Promise<IAgentEngine> {
  const useV2 = process.env.USE_REACT_V2 === 'true';
  const config = await getAgentConfig();

  if (useV2) {
    // Phase 2: 动态导入 v2 实现
    const { ReActAgentV2 } = await import('./react-engine-v2');
    return new ReActAgentV2(config);
  }

  // Phase 1: 使用现有引擎
  return new ReActAgent(config);
}
```

---

## 二、调用点简化改造（High #1 修正）

### 2.1 调用点 #1: Inngest 函数

```typescript
// src/lib/inngest/functions/process-entry.ts:268-286

// ❌ v2.5 错误（调用点仍需手动 normalize）
const agentConfig = await getAgentConfig();
const agent = new ReActAgent(agentConfig);
const trace = await agent.process(entryId, parsed);
const normalized = normalizeAgentIngestDecision(trace.finalResult, {
  contentLength: parsed.content.length,
});
if (!normalized) {
  throw new Error('Agent output missing required fields');
}
const { decision: repairedDecision } = await validateAndRepairDecision(normalized, {
  contentLength: parsed.content.length,
  maxEnglishRatio: getMaxDecisionEnglishRatio(),
  minQualityScore: getMinDecisionQualityScore(),
});
result = repairedDecision;

// ✅ v2.6 正确（agent.process 直接返回决策）
const agent = await createAgentEngine();
const decision = await agent.process(entryId, parsed);
const { decision: repairedDecision } = await validateAndRepairDecision(decision, {
  contentLength: parsed.content.length,
  maxEnglishRatio: getMaxDecisionEnglishRatio(),
  minQualityScore: getMinDecisionQualityScore(),
});
result = repairedDecision;
```

**完整改造步骤**：
1. 移除不再需要的 import（3 个）：
   ```typescript
   - import { ReActAgent } from '@/lib/ai/agent';
   - import { getAgentConfig } from '@/lib/ai/agent/get-config';
   - import { normalizeAgentIngestDecision } from '@/lib/ai/agent/ingest-contract';
   ```
2. 添加新的 import（1 个）：
   ```typescript
   + import { createAgentEngine } from '@/lib/ai/agent/factory';
   ```
3. 简化实例化和调用代码（删除 8 行，新增 2 行）：
   ```typescript
   - const agentConfig = await getAgentConfig();
   - const agent = new ReActAgent(agentConfig);
   - const trace = await agent.process(entryId, parsed);
   - const normalized = normalizeAgentIngestDecision(trace.finalResult, {
   -   contentLength: parsed.content.length,
   - });
   - if (!normalized) {
   -   throw new Error('Agent output missing required fields');
   - }
   + const agent = await createAgentEngine();
   + const decision = await agent.process(entryId, parsed);
   ```
4. 修改后续引用（1 处）：
   ```typescript
   - const { decision: repairedDecision } = await validateAndRepairDecision(normalized, {
   + const { decision: repairedDecision } = await validateAndRepairDecision(decision, {
   ```

### 2.2 调用点 #2: API Route

```typescript
// src/app/api/ai/process/route.ts:179-218

// ❌ v2.5 错误（调用点仍需手动 normalize）
const agentConfig = await getAgentConfig();
const agent = new ReActAgent(agentConfig);
const trace = await agent.process(targetEntryId, parseInput, {
  onProgress: async (message) => {
    await updateProcessStatus(targetEntryId, "AI_PROCESSING", message);
  },
});
const normalized = normalizeAgentIngestDecision(trace.finalResult, {
  contentLength: content.length,
});
if (!normalized) {
  throw new Error("Agent output missing required fields");
}
const { decision: repaired } = await validateAndRepairDecision(normalized, {
  contentLength: content.length,
  maxEnglishRatio: getMaxDecisionEnglishRatio(),
  minQualityScore: getMinDecisionQualityScore(),
  onProgress: async (message) => {
    await updateProcessStatus(targetEntryId, "AI_PROCESSING", message);
  },
});
return repaired;

// ✅ v2.6 正确（agent.process 直接返回决策）
const agent = await createAgentEngine();
const decision = await agent.process(targetEntryId, parseInput, {
  onProgress: async (message) => {
    await updateProcessStatus(targetEntryId, "AI_PROCESSING", message);
  },
});
const { decision: repaired } = await validateAndRepairDecision(decision, {
  contentLength: content.length,
  maxEnglishRatio: getMaxDecisionEnglishRatio(),
  minQualityScore: getMinDecisionQualityScore(),
  onProgress: async (message) => {
    await updateProcessStatus(targetEntryId, "AI_PROCESSING", message);
  },
});
return repaired;
```

**完整改造步骤**：
1. 移除不再需要的 import（3 个）：
   ```typescript
   - import { ReActAgent } from "@/lib/ai/agent";
   - import { getAgentConfig } from "@/lib/ai/agent/get-config";
   - import { normalizeAgentIngestDecision } from "@/lib/ai/agent/ingest-contract";
   ```
2. 添加新的 import（1 个）：
   ```typescript
   + import { createAgentEngine } from "@/lib/ai/agent/factory";
   ```
3. 简化实例化和调用代码（删除 8 行，新增 2 行）：
   ```typescript
   - const agentConfig = await getAgentConfig();
   - const agent = new ReActAgent(agentConfig);
   - const trace = await agent.process(targetEntryId, parseInput, { ... });
   - const normalized = normalizeAgentIngestDecision(trace.finalResult, {
   -   contentLength: content.length,
   - });
   - if (!normalized) {
   -   throw new Error("Agent output missing required fields");
   - }
   + const agent = await createAgentEngine();
   + const decision = await agent.process(targetEntryId, parseInput, { ... });
   ```
4. 修改后续引用（1 处）：
   ```typescript
   - const { decision: repaired } = await validateAndRepairDecision(normalized, {
   + const { decision: repaired } = await validateAndRepairDecision(decision, {
   ```

### 2.3 完整改造清单

| 文件 | 行号 | 移除 import | 添加 import | 代码简化 |
|------|------|------------|------------|----------|
| `src/lib/inngest/functions/process-entry.ts` | 10-12<br>268-286 | `ReActAgent`<br>`getAgentConfig`<br>`normalizeAgentIngestDecision` | `createAgentEngine` | 删除 8 行<br>新增 2 行<br>修改 1 处引用 |
| `src/app/api/ai/process/route.ts` | 5-8<br>179-218 | `ReActAgent`<br>`getAgentConfig`<br>`normalizeAgentIngestDecision` | `createAgentEngine` | 删除 8 行<br>新增 2 行<br>修改 1 处引用 |

---

## 三、正确的 Vercel AI SDK 用法（保持 v2.5）

```typescript
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
  stopWhen: stepCountIs(5),  // ✅ 正确
  output: Output.object({    // ✅ 正确
    schema: z.object({
      ingestAction: z.enum(['INGEST', 'SKIP_DUPLICATE', 'SKIP_LOW_QUALITY']),
      // ... 完整 schema
    }),
  }),
  prompt: buildReActPrompt(input),
});

const decision = result.output;  // ✅ 正确
```

---

## 四、findRelatedEntriesByContent 实现（保持 v2.5）

```typescript
// src/lib/ai/associationDiscovery.ts

export async function findRelatedEntriesByContent(
  content: string,
  title: string,
  limit: number = 5
): Promise<RelatedEntry[]> {
  const candidates = await prisma.entry.findMany({
    where: {
      knowledgeStatus: 'ACTIVE',  // ✅ 正确字段名
      processStatus: 'DONE',      // ✅ 正确枚举值
    },
    select: {
      id: true,
      title: true,
      coreSummary: true,  // ✅ 正确字段名
      aiTags: true,
    },
    take: 50,
  });

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

---

## 五、实施计划

### Phase 1: 最小可行 ReAct（24-32h, 3-4 天）

| 任务 | 工作量 | 依赖 | 验收标准 |
|------|--------|------|----------|
| **1.1 接口定义** | 2-3h | - | `IAgentEngine` 接口定义完成 |
| **1.2 API 修正** | 4-6h | 1.1 | `generateText + stopWhen + Output.object()` 工作正常 |
| **1.3 工具补齐** | 4-6h | 1.2 | `findRelatedEntriesByContent` 实现并测试通过 |
| **1.4 契约兼容** | 2-3h | 1.3 | `ingestAction` 字段生效 |
| **1.5 引擎重构** | 4-5h | 1.4 | `ReActAgent.process` 返回 `NormalizedAgentIngestDecision` |
| **1.6 工厂模式** | 3-4h | 1.5 | `createAgentEngine()` + 两处调用点简化 |
| **1.7 DB Schema** | 2-3h | 1.6 | `ToolCallLog` model 迁移完成 |
| **1.8 测试验证** | 4-6h | 1.7 | 黄金数据集 10 条通过 |
| **1.9 灰度发布** | 3-4h | 1.8 | API Route 先行，Inngest 跟进 |

---

## 六、关键 API 用法总结

### 6.1 正确的 generateText 调用

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

### 6.2 正确的 Prisma 查询

```typescript
const entries = await prisma.entry.findMany({
  where: {
    knowledgeStatus: 'ACTIVE',  // ✅ 正确字段名
    processStatus: 'DONE',      // ✅ 正确枚举值
  },
  select: {
    id: true,
    title: true,
    coreSummary: true,  // ✅ 正确字段名
    aiTags: true,
  },
});
```

### 6.3 正确的接口工厂和调用

```typescript
// 定义接口
export interface IAgentEngine {
  process(
    entryId: string,
    input: ParseResult,
    options?: { onProgress?: (message: string) => Promise<void> }
  ): Promise<NormalizedAgentIngestDecision>;
}

// 工厂函数
export async function createAgentEngine(): Promise<IAgentEngine> {
  const config = await getAgentConfig();

  if (process.env.USE_REACT_V2 === 'true') {
    const { ReActAgentV2 } = await import('./react-engine-v2');
    return new ReActAgentV2(config);
  }

  return new ReActAgent(config);
}

// 调用（两处）- 简化版
const agent = await createAgentEngine();
const decision = await agent.process(entryId, input, { onProgress });
// decision 已经是 NormalizedAgentIngestDecision，无需再 normalize
const { decision: repaired } = await validateAndRepairDecision(decision, { ... });
```

---

## 七、Codex 第七次评审问题修正清单

| Codex 问题 | 级别 | 修正状态 | 证据 |
|-----------|------|---------|------|
| **#1**: `IAgentEngine.process` 返回类型与实现不一致 | High | ✅ 已修正 | `ReActAgent.process` 内部调用 `normalizeAgentIngestDecision` 并直接返回决策 |

---

## 八、10 个问题完整闭环

| # | 问题 | v2.6 解决方案 |
|---|------|---------------|
| **#1** | 输出契约断链 | ✅ `ingestAction` 字段保持契约兼容 |
| **#2** | 技术选型冲突 | ✅ 使用 `getModel()` 复用现有 provider |
| **#3** | 成本估算偏乐观 | ✅ 公式化估算 + 修正增幅为 +93% |
| **#4** | 工具清单不一致 | ✅ 工具台账 + `find_relations` 统一实现 |
| **#5** | Few-shot 示例漂移 | ⚠️ Phase 2（非阻断） |
| **#6** | ReAct 输入截断过短 | ✅ 使用 `buildSemanticSnapshot(input.content)` |
| **#7** | 回滚方案未落地 | ✅ `IAgentEngine` 接口 + 工厂模式 |
| **#8** | 实施计划缺少任务 | ✅ 工期 24-32h + 详细任务分解 |
| **#9** | 验证方案偏人工 | ✅ 黄金数据集 + 自动回归 |
| **#10** | 缺少安全章节 | ✅ Prisma model + 审计日志 |

---

**v2.6 修订完成，等待 Codex 第八次复审。**

## 附录：历次评审修正总结

| 版本 | 评审轮次 | 问题数 | 主要修正 | 状态 |
|------|---------|--------|----------|------|
| v2.0 | 第一次 | 10 | LangGraph → Vercel AI SDK | ❌ 拒绝 |
| v2.1 | 第二次 | 8 (2C+4H+2M) | API 用法、函数依赖、成本计算 | ❌ 拒绝 |
| v2.2 | 第三次 | 8 (2C+4H+2M) | 同 v2.1（未通过） | ❌ 拒绝 |
| v2.3 | 第四次 | 4 (1C+2H+1M) | maxSteps → stopWhen、Prisma 字段 | ❌ 拒绝 |
| v2.4 | 第五次 | 3 (1H+2M) | 枚举值、返回类型、改造步骤 | ❌ 拒绝 |
| v2.5 | 第六次 | 3 (1H+2M) | 接口设计、类型兼容、import 清理 | ❌ 拒绝 |
| v2.6 | 第七次 | 1 (1H) | 接口返回类型与实现一致性 | ⏳ 待审 |

**关键收获**：
1. AI SDK 用法：`inputSchema` + `Output.object()` + `result.output` + `stopWhen: stepCountIs(5)`
2. Prisma 字段：`knowledgeStatus: 'ACTIVE'` + `processStatus: 'DONE'` + `coreSummary`
3. 接口设计：`IAgentEngine` 统一接口 + 工厂返回接口类型
4. 改造清单：完整 import 清理（移除 `ReActAgent` + `getAgentConfig` + `normalizeAgentIngestDecision`，添加 `createAgentEngine`）
5. 返回类型：`process` 方法直接返回 `NormalizedAgentIngestDecision`，简化调用点代码
