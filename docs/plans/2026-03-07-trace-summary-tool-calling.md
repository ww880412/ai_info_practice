# Trace / Dynamic Summary / Tool Calling Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修复 entry 详情页里 tool calling 结果不可见、Trace 信息不足、Dynamic Summary 兼容性差的问题，并补上后端约束，避免同类数据继续漂移。

**Architecture:** 这次不做大改。前端层面补展示与兼容；后端层面补 summaryStructure 的按类型校验 / normalize；agent 层面补 tool-calling 失败时的可观测性与验收路径。所有修复都围绕现有 entry detail / reasoning trace / dynamic summary 链路展开。

**Tech Stack:** Next.js 16, React 19, TypeScript, Prisma, Vitest

### Task 1: 明确并修复 tool-calling 结果链路

**Files:**
- Modify: `src/lib/ai/agent/engine.ts`
- Modify: `src/lib/ai/agent/engine.test.ts`
- Modify: `src/lib/ai/agent/__tests__/engine-mode-switch.test.ts`

**Step 1: 写失败测试，覆盖 tool-calling 失败后 fallback metadata**

新增或扩展测试，断言：
- `executionIntent` 仍保留 `tool_calling`
- `executionMode` 为 `two_step`
- `twoStepReason` 为 `fallback_after_tool_error`
- `fallback.errorName / errorMessage` 被保留
- `toolCallStats` 在未真正调用 tool 时为 0

**Step 2: 运行测试确认当前行为与预期差距**

Run: `npm run test:run -- src/lib/ai/agent/engine.test.ts src/lib/ai/agent/__tests__/engine-mode-switch.test.ts`

**Step 3: 最小修复**

如果测试已证明 metadata 正确，则不改执行逻辑，只补更稳定的验收入口：
- 确认 `processWithMode(..., 'tool-calling')` 在 fallback 场景能稳定保存 trace metadata
- 如有缺口，只修 metadata 持久化 / 暴露层，不改 agent 主流程

**Step 4: 复跑测试**

Run: `npm run test:run -- src/lib/ai/agent/engine.test.ts src/lib/ai/agent/__tests__/engine-mode-switch.test.ts`

**Step 5: 验收命令**

提供一个可重复的本地验收路径，至少包含：
- 重新处理指定 entry
- 在 DB 中确认 trace metadata
- 在前端页面确认展示

### Task 2: 升级 Trace 页，展示真正关键的信息

**Files:**
- Modify: `src/app/api/entries/[id]/trace/route.ts`
- Modify: `src/app/entry/[id]/page.tsx`
- Modify: `src/components/agent/ReasoningTraceView.tsx`
- Create or Modify: `src/components/agent/ReasoningTraceView.test.tsx`

**Step 1: 写失败测试或最小渲染测试**

覆盖以下信息可见：
- `executionIntent`
- `executionMode`
- `twoStepReason`
- fallback 是否触发
- fallback error 名称 / 摘要
- tool call 总数

**Step 2: 运行测试确认当前 Trace 页只显示 steps**

Run: `npm run test:run -- src/components/agent/ReasoningTraceView.test.tsx`

**Step 3: 最小实现**

Trace 页建议展示：
- 顶部状态条：`Intent` / `Actual Mode`
- fallback badge：是否从 tool calling 回退
- error 摘要：`AI_NoObjectGeneratedError` + message
- tool telemetry 摘要：`total / success / failed`
- 原有 steps 保持不变

不要上复杂历史列表；当前 API 仍取 latest trace 即可，先把“这一条 trace 到底是什么”说清楚。

**Step 4: 复跑测试**

Run: `npm run test:run -- src/components/agent/ReasoningTraceView.test.tsx`

### Task 3: 升级 Dynamic Summary，兼容 timeline-evolution 的新 shape

**Files:**
- Modify: `src/components/entry/DynamicSummary.tsx`
- Modify: `src/components/entry/DynamicSummary.test.tsx`

**Step 1: 先写失败测试**

在现有测试上新增 case，覆盖：
- `events: string[]`
- `stages: string[]`
- `background / currentStatus / decisionLogic / outcome / insight / futureOutlook`

断言页面至少能展示：
- `stages` 或 `events` 的主内容
- `currentStatus`
- `futureOutlook`

**Step 2: 运行测试确认当前解析失败**

Run: `npm run test:run -- src/components/entry/DynamicSummary.test.tsx`

**Step 3: 最小实现**

扩展 `parseTimelineEvolution()`：
- 保留已有 stage-object / date-object 兼容
- 新增 string-array 兼容
- string-array 没有结构化 detail 时，降级成可读 timeline item，而不是直接返回 `null`
- 补渲染块，展示 `background / decisionLogic / outcome / insight`

**Step 4: 复跑测试**

Run: `npm run test:run -- src/components/entry/DynamicSummary.test.tsx`

### Task 4: 后端补 summaryStructure 类型校验或 normalize

**Files:**
- Modify: `src/lib/inngest/functions/process-entry.ts`
- Modify: `src/app/api/ai/process/route.ts`
- Modify: `src/lib/ai/agent/schemas.ts`
- Create or Modify: `src/lib/ai/agent/summary-structure.test.ts`

**Step 1: 写失败测试**

覆盖：
- `type=timeline-evolution` 且 `fields` 为不兼容 shape 时，系统不会无声写库
- 合法 shape 可通过
- 不兼容 shape 会被 normalize 或回退到 `generic`

**Step 2: 运行测试确认当前仅做外层 safeParse**

Run: `npm run test:run -- src/lib/ai/agent/summary-structure.test.ts`

**Step 3: 最小实现**

优先方案：
- 新增统一 helper，先 `SummaryStructureSchema.safeParse`
- 再按 `type` 调 `validateSummaryStructure(type, fields)`
- 如果不合法：
  - 能 normalize 就 normalize
  - 不能 normalize 就降级到 `generic`

`process-entry` 与 `/api/ai/process` 统一走同一 helper，避免双份漂移。

**Step 4: 复跑测试**

Run: `npm run test:run -- src/lib/ai/agent/summary-structure.test.ts`

### Task 5: 端到端验收

**Files:**
- No code changes required

**Step 1: 运行目标测试集**

Run:
`npm run test:run -- src/components/entry/DynamicSummary.test.tsx src/components/agent/ReasoningTraceView.test.tsx src/lib/ai/agent/engine.test.ts src/lib/ai/agent/__tests__/engine-mode-switch.test.ts src/lib/ai/agent/summary-structure.test.ts`

**Step 2: 手动验收页面**

检查：
- 新旧两个 entry 的 Summary 都能读
- 新 entry 的 Trace 能看出“本想跑 tool calling，但 fallback 到 two-step”
- 页面上能看到 fallback error 摘要

**Step 3: 记录验收结果**

至少输出：
- 通过的测试
- 页面可见变化
- 剩余风险

