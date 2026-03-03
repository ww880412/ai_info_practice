# ReAct Agent 升级方案 v2.9 - Codex 第十次评审修正版（最终版）

**修订日期**: 2026-03-01  
**修订原因**: 修复 Codex 第十次评审发现的 2 个问题（代码示例可编译性 + API Route 漂移）  
**状态**: 待 Codex 第十一次复审

---

## v2.8 → v2.9 关键修正

| 问题级别 | v2.8 错误 | v2.9 修正 |
|---------|-----------|-----------|
| **High #1** | 代码示例缺少 import，无法直接编译 | 补全所有 import 语句 |
| **High #2** | API Route 示例未保留 runWithProgressRetry | 明确保留重试逻辑 |

---

## 一、完整的接口定义（可编译版本）

### 1.1 types.ts - 添加 IAgentEngine 接口

```typescript
// src/lib/ai/agent/types.ts
import type { ParseResult } from '../../parser/index';
import type { NormalizedAgentIngestDecision } from './ingest-contract';

// ... 现有接口保持不变 ...

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

### 1.2 engine.ts - ReActAgent 实现接口

```typescript
// src/lib/ai/agent/engine.ts
import type { AgentConfig, ReasoningStep, ReasoningTrace } from "./types";
import type { IAgentEngine } from "./types";  // 新增
import type { ParseResult } from "../../parser/index";
import { generateJSON } from "../generate";
import { prisma } from "../../prisma";
import { stringifyObservation } from "../../trace/observation";
import { normalizeAgentIngestDecision, type NormalizedAgentIngestDecision } from './ingest-contract';  // 新增

// ... 现有代码保持不变 ...

export class ReActAgent implements IAgentEngine {
  private config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = config;
  }

  /**
   * 处理条目并返回决策（新签名）
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
   * 将原有的 process 方法实现移到这里
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

  // ... 其他私有方法（runStep1, runStep2, saveTrace 等）保持不变 ...
}
```

### 1.3 factory.ts - 创建工厂函数

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

---

## 二、调用点改造（保留重试逻辑）

### 2.1 Inngest 函数改造

```typescript
// src/lib/inngest/functions/process-entry.ts

// 移除的 import（3 个）
- import { ReActAgent } from '@/lib/ai/agent';
- import { getAgentConfig } from '@/lib/ai/agent/get-config';
- import { normalizeAgentIngestDecision } from '@/lib/ai/agent/ingest-contract';

// 添加的 import（1 个）
+ import { createAgentEngine } from '@/lib/ai/agent/factory';

// 修改实例化和调用（第 268-286 行）
// ❌ 当前代码
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

// ✅ 修改后
const agent = await createAgentEngine();
const decision = await agent.process(entryId, parsed);
const { decision: repairedDecision } = await validateAndRepairDecision(decision, {
  contentLength: parsed.content.length,
  maxEnglishRatio: getMaxDecisionEnglishRatio(),
  minQualityScore: getMinDecisionQualityScore(),
});
result = repairedDecision;
```

### 2.2 API Route 改造（保留 runWithProgressRetry）

```typescript
// src/app/api/ai/process/route.ts

// 移除的 import（3 个）
- import { ReActAgent } from "@/lib/ai/agent";
- import { getAgentConfig } from "@/lib/ai/agent/get-config";
- import { normalizeAgentIngestDecision } from "@/lib/ai/agent/ingest-contract";

// 添加的 import（1 个）
+ import { createAgentEngine } from "@/lib/ai/agent/factory";

// 修改实例化和调用（第 179-220 行）
// ❌ 当前代码
try {
  const agentConfig = await getAgentConfig();
  const agent = new ReActAgent(agentConfig);

  decision = await runWithProgressRetry({
    label: "AI重处理",
    attempts: 5,
    baseDelayMs: 2000,
    heartbeatIntervalMs: 10_000,
    formatHeartbeat: ({ attempt, attempts, elapsedMs }) =>
      `AI重处理进行中（${attempt}/${attempts}，已运行 ${Math.round(
        elapsedMs / 1000
      )} 秒）...`,
    isRetriable: isRetriableAgentError,
    onProgress: async (message) => {
      await updateProcessStatus(targetEntryId, "AI_PROCESSING", message);
    },
    operation: async () => {
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
    },
  });
} catch (error) {
  agentFailureReason = error instanceof Error ? error.message : String(error);
  console.error("AI reprocess agent error:", error);
}

// ✅ 修改后（保留 runWithProgressRetry 重试逻辑）
try {
  const agent = await createAgentEngine();

  decision = await runWithProgressRetry({
    label: "AI重处理",
    attempts: 5,
    baseDelayMs: 2000,
    heartbeatIntervalMs: 10_000,
    formatHeartbeat: ({ attempt, attempts, elapsedMs }) =>
      `AI重处理进行中（${attempt}/${attempts}，已运行 ${Math.round(
        elapsedMs / 1000
      )} 秒）...`,
    isRetriable: isRetriableAgentError,
    onProgress: async (message) => {
      await updateProcessStatus(targetEntryId, "AI_PROCESSING", message);
    },
    operation: async () => {
      // agent.process 现在直接返回 NormalizedAgentIngestDecision
      const decision = await agent.process(targetEntryId, parseInput, {
        onProgress: async (message) => {
          await updateProcessStatus(targetEntryId, "AI_PROCESSING", message);
        },
      });

      // 直接进行决策修复，无需再 normalize
      const { decision: repaired } = await validateAndRepairDecision(decision, {
        contentLength: content.length,
        maxEnglishRatio: getMaxDecisionEnglishRatio(),
        minQualityScore: getMinDecisionQualityScore(),
        onProgress: async (message) => {
          await updateProcessStatus(targetEntryId, "AI_PROCESSING", message);
        },
      });

      return repaired;
    },
  });
} catch (error) {
  agentFailureReason = error instanceof Error ? error.message : String(error);
  console.error("AI reprocess agent error:", error);
}
```

**关键修正**：
1. 保留完整的 `runWithProgressRetry` 重试逻辑
2. 只修改 `operation` 内部的 agent 调用和 normalize 流程
3. 删除 8 行（agentConfig + agent 实例化 + trace + normalize + 错误检查）
4. 新增 2 行（agent 工厂调用 + decision 直接获取）

---

## 三、实施计划

### Phase 1: 核心改造（8-12h）

| 任务 | 工作量 | 文件 | 验收标准 |
|------|--------|------|----------|
| 1.1 接口定义 | 1h | `types.ts` | 添加 `IAgentEngine` 接口 |
| 1.2 引擎重构 | 3-4h | `engine.ts` | `process` 返回 `NormalizedAgentIngestDecision` |
| 1.3 工厂创建 | 1h | `factory.ts` | 创建 `createAgentEngine()` 函数 |
| 1.4 Inngest 改造 | 2h | `process-entry.ts` | 简化调用，移除 normalize |
| 1.5 API Route 改造 | 2-3h | `route.ts` | 保留 retry，简化 operation |
| 1.6 测试验证 | 2-3h | - | TypeScript 编译通过 + 手动测试 |

---

## 四、Codex 第十次评审问题修正清单

| Codex 问题 | 级别 | 修正状态 | 证据 |
|-----------|------|---------|------|
| **#1**: 代码示例缺少 import | High | ✅ 已修正 | 所有代码块补全 import 语句 |
| **#2**: API Route 示例未保留 runWithProgressRetry | High | ✅ 已修正 | 明确保留完整重试逻辑 |

---

## 五、历次评审修正总结

| 版本 | 评审轮次 | 问题数 | 主要修正 | 状态 |
|------|---------|--------|----------|------|
| v2.0-v2.7 | 第1-8次 | 多个 | API用法、类型、接口设计等 | ❌ 拒绝 |
| v2.8 | 第9次 | 1H | saveTrace 调用签名 | ❌ 拒绝 |
| v2.9 | 第10次 | 2H | 代码示例可编译性 + API Route 漂移 | ⏳ 待审 |

**关键收获**：
1. 所有代码示例必须可直接编译（补全 import）
2. 保留现有的重试逻辑，只修改核心调用
3. `saveTrace` 使用 5 参数调用
4. `process` 方法直接返回 `NormalizedAgentIngestDecision`
5. Phase 1 只实现 v1，工厂函数简化

**v2.9 修订完成，等待 Codex 第十一次复审。**
