# ReAct Agent 升级方案 v2.8 - Codex 第九次评审修正版

**修订日期**: 2026-03-01
**修订原因**: 修复 Codex 第九次评审发现的 saveTrace 调用签名冲突问题（1 High）
**状态**: 待 Codex 第十次复审

---

## v2.7 → v2.8 关键修正

| 问题级别 | v2.7 错误 | v2.8 修正 |
|---------|-----------|-----------|
| **High #1** | `saveTrace` 调用签名冲突（传递对象 vs 5 个参数） | 改用 5 参数调用，与现有签名一致 |

**Codex 发现的问题**：
- v2.7 中 `executeReasoning` 调用 `this.saveTrace(entryId, { entryId, input, steps, finalResult, metadata })`（传递对象）
- 但实际 `engine.ts:517` 中 `saveTrace` 签名是 5 个参数：`saveTrace(entryId, input, steps, finalResult, metadata)`
- 这会导致编译错误

**v2.8 解决方案**：
- 修正 `saveTrace` 调用为 5 参数形式：`this.saveTrace(entryId, input, steps, finalResult, metadata)`
- 保持 `saveTrace` 方法签名不变（最小改动原则）

---

## 一、共享接口设计（保持 v2.6）

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

### 1.2 ReActAgent 实现接口（修正 executeReasoning）

```typescript
// src/lib/ai/agent/engine.ts

import { normalizeAgentIngestDecision } from './ingest-contract';
import type { ReasoningTrace } from './types';

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
    // 执行原有的推理过程
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
   * 返回完整的推理轨迹（包含 input, steps, finalResult, metadata）
   */
  private async executeReasoning(
    entryId: string,
    input: ParseResult,
    options?: {
      onProgress?: (message: string) => Promise<void>;
    }
  ): Promise<ReasoningTrace> {
    const startTime = new Date().toISOString();
    const steps: ReasoningStep[] = [];
    const toolsUsed: string[] = [];

    // Step 1: 内容分析与结构推理
    await options?.onProgress?.("AI Step 1/2：内容分析与结构推理...");
    const step1StartedAt = Date.now();
    const step1Raw = await this.runStep1(input);
    const step1 = normalizeStep1Payload(step1Raw);
    steps.push({
      step: 1,
      timestamp: new Date().toISOString(),
      thought: toNonEmptyString((step1.summaryStructure as Record<string, unknown> | undefined)?.reasoning) || "完成结构推理",
      action: "ANALYZE_STRUCTURE",
      observation: stringifyObservation(step1),
      reasoning: "执行 Step 1：提取内容类型、结构类型、关键要点与边界。",
      context: {
        stage: "step1",
        inputLength: input.content.length,
        durationMs: Date.now() - step1StartedAt,
      },
    });

    // Step 2: 深度提取与练习生成
    await options?.onProgress?.("AI Step 2/2：深度提取与练习生成...");
    const step2StartedAt = Date.now();
    const step2Raw = await this.runStep2(input, step1);
    const step2 = normalizeStep2Payload(step2Raw);
    steps.push({
      step: 2,
      timestamp: new Date().toISOString(),
      thought: "完成深度提取",
      action: "EXTRACT_DETAILS",
      observation: stringifyObservation(step2),
      reasoning: "执行 Step 2：生成摘要、关键点、边界与练习任务。",
      context: {
        stage: "step2",
        durationMs: Date.now() - step2StartedAt,
      },
    });

    // 合并两步结果
    const finalResult = mergeTwoStepResults(step1, step2);
    const endTime = new Date().toISOString();

    // 构建 metadata 对象
    const metadata = {
      startTime,
      endTime,
      iterations: steps.length,
      toolsUsed,
    };

    // 保存推理轨迹到数据库（使用 5 参数调用）
    await this.saveTrace(entryId, input, steps, finalResult, metadata);

    // 返回完整的 ReasoningTrace 结构
    return {
      entryId,
      input,
      steps,
      finalResult,
      metadata,
    };
  }

  // ... 其他私有方法保持不变
}
```

**关键修正**：
1. `executeReasoning` 返回完整的 `ReasoningTrace` 结构，包含 `input` 和 `metadata` 字段
2. 保留 `saveTrace` 调用，使用 5 参数形式：`this.saveTrace(entryId, input, steps, finalResult, metadata)`
3. `metadata` 包含 `startTime`, `endTime`, `iterations`, `toolsUsed` 四个字段
4. 与现有 `saveTrace` 方法签名完全一致（`engine.ts:517`）

### 1.3 工厂函数返回接口类型（Phase 1 简化版）

```typescript
// src/lib/ai/agent/factory.ts
import type { IAgentEngine } from './types';
import { ReActAgent } from './engine';
import { getAgentConfig } from './get-config';

/**
 * 创建 Agent 引擎实例
 * Phase 1: 只返回 v1 实现
 * Phase 2: 添加 v2 支持（通过环境变量切换）
 */
export async function createAgentEngine(): Promise<IAgentEngine> {
  const config = await getAgentConfig();
  return new ReActAgent(config);
}
```

**关键修正**：
1. Phase 1 只实现 v1，移除对不存在的 `react-engine-v2` 的引用
2. 工厂函数简化为直接返回 `ReActAgent` 实例
3. Phase 2 再添加 v2 支持（需要先创建 `react-engine-v2.ts` 文件）

---

## 二、调用点简化改造（保持 v2.6）

### 2.1 调用点 #1: Inngest 函数

```typescript
// src/lib/inngest/functions/process-entry.ts:268-286

// ❌ 当前代码（手动 normalize）
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

// ✅ v2.7 正确（agent.process 直接返回决策）
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

// ❌ 当前代码（手动 normalize）
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

// ✅ v2.7 正确（agent.process 直接返回决策）
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

## 三、实施计划

### Phase 1: 最小可行 ReAct（24-32h, 3-4 天）

| 任务 | 工作量 | 依赖 | 验收标准 |
|------|--------|------|----------|
| **1.1 接口定义** | 2-3h | - | `IAgentEngine` 接口定义完成 |
| **1.2 引擎重构** | 4-5h | 1.1 | `ReActAgent.process` 返回 `NormalizedAgentIngestDecision` |
| **1.3 工厂模式** | 2-3h | 1.2 | `createAgentEngine()` 工厂函数完成 |
| **1.4 调用点改造** | 3-4h | 1.3 | 两处调用点简化完成 |
| **1.5 测试验证** | 4-6h | 1.4 | 黄金数据集 10 条通过 |
| **1.6 灰度发布** | 3-4h | 1.5 | API Route 先行，Inngest 跟进 |

### Phase 2: v2 引擎支持（未来）

| 任务 | 工作量 | 依赖 | 验收标准 |
|------|--------|------|----------|
| **2.1 创建 v2 文件** | 6-8h | Phase 1 | `react-engine-v2.ts` 实现完成 |
| **2.2 工厂切换** | 2-3h | 2.1 | 环境变量控制 v1/v2 切换 |
| **2.3 测试验证** | 4-6h | 2.2 | v2 引擎测试通过 |

---

## 四、关键 API 用法总结

### 4.1 正确的接口工厂和调用

```typescript
// 定义接口
export interface IAgentEngine {
  process(
    entryId: string,
    input: ParseResult,
    options?: { onProgress?: (message: string) => Promise<void> }
  ): Promise<NormalizedAgentIngestDecision>;
}

// Phase 1 工厂函数（简化版）
export async function createAgentEngine(): Promise<IAgentEngine> {
  const config = await getAgentConfig();
  return new ReActAgent(config);
}

// 调用（两处）- 简化版
const agent = await createAgentEngine();
const decision = await agent.process(entryId, input, { onProgress });
// decision 已经是 NormalizedAgentIngestDecision，无需再 normalize
const { decision: repaired } = await validateAndRepairDecision(decision, { ... });
```

### 4.2 正确的 ReasoningTrace 结构

```typescript
export interface ReasoningTrace {
  entryId: string;
  input: ParseResult;  // ✅ 必须包含
  steps: ReasoningStep[];
  finalResult: unknown;
  metadata: {  // ✅ 必须包含
    startTime: string;
    endTime: string;
    iterations: number;
    toolsUsed: string[];
  };
}
```

---

## 五、Codex 第九次评审问题修正清单

| Codex 问题 | 级别 | 修正状态 | 证据 |
|-----------|------|---------|------|
| **#1**: `saveTrace` 调用签名冲突 | High | ✅ 已修正 | 改用 5 参数调用：`this.saveTrace(entryId, input, steps, finalResult, metadata)` |

---

## 六、10 个问题完整闭环

| # | 问题 | v2.8 解决方案 |
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

**v2.8 修订完成，等待 Codex 第十次复审。**

## 附录：历次评审修正总结

| 版本 | 评审轮次 | 问题数 | 主要修正 | 状态 |
|------|---------|--------|----------|------|
| v2.0 | 第一次 | 10 | LangGraph → Vercel AI SDK | ❌ 拒绝 |
| v2.1 | 第二次 | 8 (2C+4H+2M) | API 用法、函数依赖、成本计算 | ❌ 拒绝 |
| v2.2 | 第三次 | 8 (2C+4H+2M) | 同 v2.1（未通过） | ❌ 拒绝 |
| v2.3 | 第四次 | 4 (1C+2H+1M) | maxSteps → stopWhen、Prisma 字段 | ❌ 拒绝 |
| v2.4 | 第五次 | 3 (1H+2M) | 枚举值、返回类型、改造步骤 | ❌ 拒绝 |
| v2.5 | 第六次 | 3 (1H+2M) | 接口设计、类型兼容、import 清理 | ❌ 拒绝 |
| v2.6 | 第七次 | 1 (1H) | 接口返回类型与实现一致性 | ❌ 拒绝 |
| v2.7 | 第八次 | 2 (1H+1M) | 移除不存在文件引用、修正 ReasoningTrace 结构 | ❌ 拒绝 |
| v2.8 | 第九次 | 1 (1H) | 修正 saveTrace 调用签名 | ⏳ 待审 |

**关键收获**：
1. AI SDK 用法：`inputSchema` + `Output.object()` + `result.output` + `stopWhen: stepCountIs(5)`
2. Prisma 字段：`knowledgeStatus: 'ACTIVE'` + `processStatus: 'DONE'` + `coreSummary`
3. 接口设计：`IAgentEngine` 统一接口 + 工厂返回接口类型
4. 改造清单：完整 import 清理（移除 `ReActAgent` + `getAgentConfig` + `normalizeAgentIngestDecision`，添加 `createAgentEngine`）
5. 返回类型：`process` 方法直接返回 `NormalizedAgentIngestDecision`，简化调用点代码
6. Phase 1 专注：只实现 v1，Phase 2 再添加 v2 支持
7. ReasoningTrace 结构：必须包含 `input` 和 `metadata` 字段
8. saveTrace 调用：使用 5 参数形式，与现有方法签名一致
