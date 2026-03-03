# ReAct Agent 升级方案 v2.13 - Codex 第十四次评审修正版（最终版）

**修订日期**: 2026-03-02
**修订原因**: 修复 Codex 第十四次评审发现的问题（补齐 Inngest import 完整符号）
**状态**: ✅ Codex 第十五次评审通过 - 批准实施

---

## v2.12 → v2.13 关键修正

| 问题级别 | v2.12 错误 | v2.13 修正 |
|---------|-----------|-----------|
| **High #1** | Inngest import 示例缺少必要符号 | 补齐 downloadFromUrl、Prisma、ProcessStatus、SourceType、schemas |

---

## 一、接口定义

### 1.1 types.ts - 添加 IAgentEngine 接口

在 `src/lib/ai/agent/types.ts` 文件末尾添加：

```typescript
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

**注意**：`ParseResult` 已在文件开头导入，无需重复导入。

### 1.2 engine.ts - ReActAgent 实现接口

**修改步骤**：

1. 在文件顶部添加 import：
```typescript
import type { IAgentEngine } from "./types";
import { normalizeAgentIngestDecision, type NormalizedAgentIngestDecision } from './ingest-contract';
```

2. 修改类声明（第 269 行附近）：
```typescript
export class ReActAgent implements IAgentEngine {
```

3. 在现有 `process` 方法之前插入新的 `process` 方法：
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

4. 将现有的 `async process(...)` 方法签名改为 `private async executeReasoning(...)`：
   - 找到第 276 行的 `async process(`
   - 改为 `private async executeReasoning(`
   - 方法体保持不变

5. 确认 saveTrace 调用使用 5 参数形式（第 322 行附近应该已经是正确的）：
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

## 二、调用点改造

### 2.1 Inngest 函数改造

修改 `src/lib/inngest/functions/process-entry.ts`：

**步骤 1**: 替换完整的 import 区块（从文件开头到第一个非 import 语句之前）为：

```typescript
/**
 * Inngest function for processing entries
 * Replaces the in-memory queue with persistent task processing
 */
import { inngest } from '../client';
import { prisma } from '@/lib/prisma';
import { parseWithLogging, type ParseInput, type ParseResult } from '@/lib/parser';
import { classifyAndExtract, type ClassifyAndExtractResult } from '@/lib/ai/classifier';
import { convertToPractice } from '@/lib/ai/practiceConverter';
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
import { isDynamicSummaryEnabled } from '@/config/flags';
import { buildConfidenceScore } from '@/lib/ai/agent/confidence';
import { isLegacyClassifierFallbackEnabled } from '@/lib/ai/fallback-policy';
import {
  SummaryStructureSchema,
  KeyPointsSchema,
  BoundariesSchema,
} from '@/lib/ai/agent/schemas';
import { downloadFromUrl } from '@/lib/storage';
import type { Prisma, ProcessStatus, SourceType } from '@prisma/client';
```

**步骤 2**: 替换 agent 实例化和调用代码（第 268-286 行附近）为：

```typescript
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

**步骤 1**: 替换完整的 import 区块（从文件开头到第一个非 import 语句之前）为：

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { classifyAndExtract, type ClassifyAndExtractResult } from "@/lib/ai/classifier";
import { convertToPractice } from "@/lib/ai/practiceConverter";
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
import type { ParseResult } from "@/lib/parser";
import type { Prisma, ProcessStatus } from "@prisma/client";
import {
  SummaryStructureSchema,
  KeyPointsSchema,
  BoundariesSchema,
} from "@/lib/ai/agent/schemas";
```

**步骤 2**: 替换 agent 实例化和调用代码（第 179-220 行附近）为：

```typescript
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

## 四、Codex 第十四次评审问题修正清单

| Codex 问题 | 级别 | 修正状态 | 证据 |
|-----------|------|---------|------|
| **#1**: Inngest import 缺少必要符号 | High | ✅ 已修正 | 补齐 downloadFromUrl、Prisma、ProcessStatus、SourceType、schemas |

---

## 五、历次评审修正总结

| 版本 | 评审轮次 | 问题数 | 主要修正 | 状态 |
|------|---------|--------|----------|------|
| v2.0-v2.7 | 第1-8次 | 多个 | API用法、类型、接口设计等 | ❌ 拒绝 |
| v2.8 | 第9次 | 1H | saveTrace 调用签名 | ❌ 拒绝 |
| v2.9 | 第10次 | 2H | 代码示例可编译性 + API Route 漂移 | ❌ 拒绝 |
| v2.10 | 第11次 | 2H | diff 格式改为完整代码 + 省略符号 | ❌ 拒绝 |
| v2.11 | 第12次 | 2H+1M | 重复导入 + 补丁示例改为精确指令 | ❌ 拒绝 |
| v2.12 | 第13次 | 1H+1M | API Route import 不完整 + Inngest 指令不精确 | ❌ 拒绝 |
| v2.13 | 第14次 | 1H | Inngest import 缺少必要符号 | ❌ 拒绝 |
| v2.13 | 第15次 | 1L | engine.ts 可能重复导入（非阻断） | ✅ 批准 |

**关键收获**：
1. 所有 import 示例必须包含文件中实际使用的完整符号列表
2. 不能遗漏任何类型导入，包括 Prisma、ProcessStatus、SourceType 等
3. schemas 导入必须完整（SummaryStructureSchema、KeyPointsSchema、BoundariesSchema）
4. 工具函数导入不能遗漏（downloadFromUrl）
5. 替换指令应该明确"替换完整 import 区块"
6. 避免重复导入已存在的类型
7. `saveTrace` 使用 5 参数调用
8. `process` 方法直接返回 `NormalizedAgentIngestDecision`
9. Phase 1 只实现 v1，工厂函数简化
10. API Route 必须保留 runWithProgressRetry 重试逻辑
11. 实施时注意合并 import 语句，避免重复导入

---

## 六、Codex 第十五次评审结果

**评审时间**: 2026-03-02
**评审结论**: ✅ **批准实施（Approve）**

### 验证通过项
1. ✅ Inngest import 完整性：所有必要符号已补齐
2. ✅ API Route import 完整性：包含所有必要类型和函数
3. ✅ 代码示例可编译性：所有代码示例可直接编译
4. ✅ API Route 保留 runWithProgressRetry：重试逻辑完整保留
5. ✅ saveTrace 调用签名：5 参数形式正确
6. ✅ TypeScript 编译通过：当前基线编译无错误

### 发现的问题
**Low #1**（非阻断）：engine.ts 导入步骤可能导致重复导入
- 建议：实施时合并为单条 import，避免潜在 lint 风险

**v2.13 方案已获 Codex 批准，可以开始 Phase 1 实施。**
