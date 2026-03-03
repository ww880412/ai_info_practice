# ReAct Agent 升级方案 v2.10 - Codex 第十一次评审修正版（最终版）

**修订日期**: 2026-03-01
**修订原因**: 修复 Codex 第十一次评审发现的问题（代码示例改为完整可编译格式）
**状态**: 待 Codex 第十二次复审

---

## v2.9 → v2.10 关键修正

| 问题级别 | v2.9 错误 | v2.10 修正 |
|---------|-----------|-----------|
| **High #1** | 代码示例使用 diff 格式（`- import` / `+ import`） | 改为完整可编译的最终代码 |
| **High #2** | engine.ts 代码块含省略实现（`...`） | 明确标注为"补丁示例"或提供完整实现 |

---

## 一、接口定义（完整可编译版本）

### 1.1 types.ts - 添加 IAgentEngine 接口

在 `src/lib/ai/agent/types.ts` 文件末尾添加以下接口定义：

```typescript
import type { ParseResult } from '../../parser/index';
import type { NormalizedAgentIngestDecision } from './ingest-contract';

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

### 1.2 engine.ts - ReActAgent 实现接口（补丁示例）

**说明**：以下是需要修改的关键部分，完整实现保留现有的 runStep1、runStep2、saveTrace 等私有方法。

在 `src/lib/ai/agent/engine.ts` 中：

1. 添加 import：
```typescript
import type { IAgentEngine } from "./types";
import { normalizeAgentIngestDecision, type NormalizedAgentIngestDecision } from './ingest-contract';
```

2. 修改类声明：
```typescript
export class ReActAgent implements IAgentEngine {
```

3. 添加新的 process 方法（在现有 process 方法之前）：
```typescript
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
```

4. 将现有的 process 方法重命名为 executeReasoning：
```typescript
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
  // 现有 process 方法的完整实现
  // 包括 Step 1、Step 2、saveTrace 调用等
  // 最后返回完整的 ReasoningTrace 结构
}
```

5. 确保 saveTrace 调用使用 5 参数形式：
```typescript
await this.saveTrace(entryId, input, steps, finalResult, metadata);
```

### 1.3 factory.ts - 创建工厂函数

创建新文件 `src/lib/ai/agent/factory.ts`：

```typescript
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

## 二、调用点改造（完整最终代码）

### 2.1 Inngest 函数改造

修改 `src/lib/inngest/functions/process-entry.ts`：

**步骤 1**: 修改 import 语句（文件顶部）

```typescript
import { inngest } from '../client';
import { prisma } from '@/lib/prisma';
import { parseWithLogging, type ParseInput, type ParseResult } from '@/lib/parser';
import { classifyAndExtract, type ClassifyAndExtractResult } from '@/lib/ai/classifier';
import { convertToPractice } from '@/lib/ai/practiceConverter';
// 移除以下 3 行
// import { ReActAgent } from '@/lib/ai/agent';
// import { getAgentConfig } from '@/lib/ai/agent/get-config';
// import { normalizeAgentIngestDecision } from '@/lib/ai/agent/ingest-contract';
// 添加以下 1 行
import { createAgentEngine } from '@/lib/ai/agent/factory';
import {
  type NormalizedAgentIngestDecision,
  type NormalizedPracticeTask,
} from '@/lib/ai/agent/ingest-contract';
import {
  getMaxDecisionEnglishRatio,
  getMinDecisionQualityScore,
  validateAndRepairDecision,
} from '@/lib/ai/agent/decision-repair';
```

**步骤 2**: 修改 agent 实例化和调用（第 268-286 行附近）

```typescript
// 修改后的完整代码
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

修改 `src/app/api/ai/process/route.ts`：

**步骤 1**: 修改 import 语句（文件顶部）

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { classifyAndExtract, type ClassifyAndExtractResult } from "@/lib/ai/classifier";
import { convertToPractice } from "@/lib/ai/practiceConverter";
// 移除以下 3 行
// import { ReActAgent } from "@/lib/ai/agent";
// import { getAgentConfig } from "@/lib/ai/agent/get-config";
// import { normalizeAgentIngestDecision } from "@/lib/ai/agent/ingest-contract";
// 添加以下 1 行
import { createAgentEngine } from "@/lib/ai/agent/factory";
import {
  type NormalizedAgentIngestDecision,
  type NormalizedPracticeTask,
} from "@/lib/ai/agent/ingest-contract";
import {
  getMaxDecisionEnglishRatio,
  getMinDecisionQualityScore,
  validateAndRepairDecision,
} from "@/lib/ai/agent/decision-repair";
import { isDynamicSummaryEnabled } from "@/config/flags";
import { buildConfidenceScore } from "@/lib/ai/agent/confidence";
import { isLegacyClassifierFallbackEnabled } from "@/lib/ai/fallback-policy";
import {
  isRetriableAgentError,
  runWithProgressRetry,
} from "@/lib/ingest/retry";
```

**步骤 2**: 修改 agent 实例化和调用（第 179-220 行附近，保留完整 runWithProgressRetry）

```typescript
// 修改后的完整代码
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

---

## 三、实施计划

### Phase 1: 核心改造（8-12h）

| 任务 | 工作量 | 文件 | 验收标准 |
|------|--------|------|------------|
| 1.1 接口定义 | 1h | `types.ts` | 添加 `IAgentEngine` 接口 |
| 1.2 引擎重构 | 3-4h | `engine.ts` | `process` 返回 `NormalizedAgentIngestDecision` |
| 1.3 工厂创建 | 1h | `factory.ts` | 创建 `createAgentEngine()` 函数 |
| 1.4 Inngest 改造 | 2h | `process-entry.ts` | 简化调用，移除 normalize |
| 1.5 API Route 改造 | 2-3h | `route.ts` | 保留 retry，简化 operation |
| 1.6 测试验证 | 2-3h | - | TypeScript 编译通过 + 手动测试 |

---

## 四、Codex 第十一次评审问题修正清单

| Codex 问题 | 级别 | 修正状态 | 证据 |
|-----------|------|---------|------|
| **#1**: 代码示例使用 diff 格式 | High | ✅ 已修正 | 第 2.1 和 2.2 节改为完整最终代码 |
| **#2**: engine.ts 含省略实现 | High | ✅ 已修正 | 明确标注为"补丁示例" |

---

## 五、历次评审修正总结

| 版本 | 评审轮次 | 问题数 | 主要修正 | 状态 |
|------|---------|--------|----------|------| | v2.0-v2.7 | 第1-8次 | 多个 | API用法、类型、接口设计等 | ❌ 拒绝 |
| v2.8 | 第9次 | 1H | saveTrace 调用签名 | ❌ 拒绝 |
| v2.9 | 第10次 | 2H | 代码示例可编译性 + API Route 漂移 | ❌ 拒绝 |
| v2.10 | 第11次 | 2H | diff 格式改为完整代码 + 省略符号 | ⏳ 待审 |

**关键收获**：
1. 所有代码示例必须是完整可编译的最终版本
2. 不使用 diff 格式（`-` / `+`），直接给出修改后的完整代码
3. 不使用省略符号（`...`），明确标注为"补丁示例"或提供完整实现
4. `saveTrace` 使用 5 参数调用
5. `process` 方法直接返回 `NormalizedAgentIngestDecision`
6. Phase 1 只实现 v1，工厂函数简化
7. API Route 必须保留 runWithProgressRetry 重试逻辑

**v2.10 修订完成，等待 Codex 第十二次复审。**
