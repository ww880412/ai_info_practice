# 2026-03-02 工具调用灰度监控修复方案（评审问题闭环）

## 1. 目标与范围

目标：修复当前灰度监控口径错误与可观测性缺口，确保 Phase 2a 工具调用上线可被准确评估。

范围：
- 修改 `src/lib/ai/agent/engine.ts`（补充可区分的 trace 语义与工具调用明细）
- 修改 `scripts/monitor-tool-calling.ts`（修正公式、口径、分母、去重策略）
- 同步修正文档错误（数据源、状态值、两步模式判定、分母定义）

非目标：
- 不改 Prisma 表结构（`ReasoningTrace.metadata`/`steps` 继续 JSON string）
- 不追溯重写历史 trace 数据

---

## 2. 问题与修复映射

| 级别 | 问题 | 根因 | 修复点 |
|---|---|---|---|
| Blocking | 回退率公式错误 | 以互斥关系硬推回退，公式可为负 | 统一定义 `fallbackRate = fallbackRuns / toolCallingAttemptRuns` |
| Blocking | 回退与正常两步不可区分 | trace 未记录两步触发原因 | 在 metadata 写入 `executionIntent/executionMode/twoStepReason/fallback` |
| High | 成功率口径错误 | 统计了 Entry 状态成功率，而非工具调用成功率 | 新增工具调用级成功率 `toolCallSuccessRate` |
| High | 去重掩盖失败 | 仅保留 latest trace | 核心指标按 trace 粒度统计；latest 仅做辅助视图 |
| High | 频率变覆盖率 | 基于去重后的 `toolsUsed` 统计 | 频率改为“调用次数”，覆盖率单独输出 |
| High | 缺 `durationMs` | tool_call 步骤未记录耗时 | 在工具执行处埋点并回填到 step/context |
| Medium | 文档数据源错误 | 写成 Entry 内嵌 JSON | 更正为 `ReasoningTrace` 表（1:N） |
| Medium | 文档状态值错误 | 写成 `COMPLETED` | 更正为 `DONE` |
| Medium | 两步模式逻辑不一致 | 引擎与脚本判定不一致 | 统一以 metadata 显式字段为准，旧数据走推断 |
| Medium | 分母口径不一致 | 不同指标分母混用 total | 为每个指标固定分母并输出 numerator/denominator |

---

## 3. 指标口径（修复后统一定义）

### 3.1 运行级指标（trace 粒度）

- `toolCallingModeRate = toolCallingRuns / totalRuns`
- `fallbackRate = fallbackRuns / toolCallingAttemptRuns`
- `twoStepConfiguredRate = twoStepConfiguredRuns / totalRuns`
- `toolCallingRunSuccessRate = toolCallingSuccessRuns / toolCallingAttemptRuns`

说明：
- `totalRuns`：时间窗内全部 `ReasoningTrace` 条数（不去重）
- `toolCallingAttemptRuns`：启动意图为工具调用（`executionIntent=tool_calling`）的 trace
- `fallbackRuns`：`fallback.triggered=true` 的 trace

### 3.2 调用级指标（tool call 粒度）

- `toolCallSuccessRate = successfulToolCalls / totalToolCalls`
- `toolCallFailureRate = failedToolCalls / totalToolCalls`
- `avgToolCallsPerToolCallingRun = totalToolCalls / toolCallingRuns`
- `toolCallDurationP50/P95`：对单次工具调用 `durationMs` 求分位数

### 3.3 频率与覆盖率拆分

- `toolCallFrequencyDistribution[tool] = 调用总次数`
- `toolCoverageDistribution[tool] = 至少调用过该工具的 trace 数`

---

## 4. `engine.ts` 修复方案

文件：`src/lib/ai/agent/engine.ts`

### 4.1 metadata 扩展（不破坏旧字段）

保留现有字段：`startTime/endTime/iterations/toolsUsed`。
新增可选字段：

```ts
metadata: {
  startTime: string;
  endTime: string;
  iterations: number;
  toolsUsed: string[]; // 保持现语义（去重后的工具名）

  schemaVersion?: 2;
  executionIntent?: 'tool_calling' | 'two_step';
  executionMode?: 'tool_calling' | 'two_step';
  twoStepReason?: 'tool_calling_disabled' | 'fallback_after_tool_error' | 'configured_two_step';
  fallback?: {
    triggered: boolean;
    fromMode?: 'tool_calling';
    reason?: 'tool_calling_error';
    errorName?: string;
    errorMessage?: string;
  };
  toolCallStats?: {
    total: number;
    success: number;
    failed: number;
    byTool: Record<string, {
      total: number;
      success: number;
      failed: number;
      durationMsTotal: number;
    }>;
  };
}
```

### 4.2 区分“配置关闭两步”与“失败回退两步”

调整执行路径：
- `executeReasoning()` 调用 `executeTwoStepReasoning(..., reason)` 时显式传入原因
- 原因枚举：
  - `tool_calling_disabled`：配置关闭
  - `fallback_after_tool_error`：工具调用失败后回退

建议签名：

```ts
private async executeTwoStepReasoning(
  entryId: string,
  input: ParseResult,
  options: AgentProcessOptions = {},
  reason: 'tool_calling_disabled' | 'fallback_after_tool_error' | 'configured_two_step' = 'configured_two_step',
  fallbackError?: unknown,
  preFallbackToolStats?: ToolCallStats
): Promise<ReasoningTrace>
```

### 4.3 工具调用步骤补充 `durationMs`

在 `createSDKTools(ctx)` 返回值外层做一次“执行包装”，记录每次工具调用：
- `toolCallId`
- `toolName`
- `startedAt/endedAt/durationMs`
- `success`（依据工具返回体 `success !== false`）
- `error`（异常时记录）

包装可在 `engine.ts` 内完成，不要求改 Prisma schema。

示意：

```ts
const rawTools = createSDKTools(ctx);
const telemetryByToolCallId = new Map<string, ToolCallTelemetry>();
const tools = instrumentTools(rawTools, telemetryByToolCallId);
```

构建 `steps` 时：
- `context.durationMs` = 当前 step 关联 tool calls 的耗时总和
- `context.toolCalls` = `[{ toolCallId, toolName, success, durationMs, error? }]`

> 兼容要求：旧字段 `stepType/toolCallCount` 保留，新增字段均为可选。

### 4.4 回退场景落盘策略

当前 catch 直接回退，导致回退原因丢失。修复后：
- catch 中保留错误摘要与已采集的工具调用统计
- 进入 `executeTwoStepReasoning(..., 'fallback_after_tool_error', error, stats)`
- 保存 trace metadata：
  - `executionIntent='tool_calling'`
  - `executionMode='two_step'`
  - `fallback.triggered=true`
  - `twoStepReason='fallback_after_tool_error'`

配置关闭工具调用路径：
- `executionIntent='two_step'`
- `executionMode='two_step'`
- `fallback.triggered=false`
- `twoStepReason='tool_calling_disabled'`

### 4.5 类型更新（编译必需）

同步更新 `src/lib/ai/agent/types.ts` 中 `ReasoningTrace.metadata` 为“旧字段必填 + 新字段可选”，确保对历史数据与新数据都兼容。

---

## 5. `monitor-tool-calling.ts` 修复方案

文件：`scripts/monitor-tool-calling.ts`

### 5.1 统计粒度调整

当前：按 `entryId` 去重后只看最新 trace。

修复：
- 核心指标默认按 trace 粒度（不去重）
- 可附带输出 `latestByEntry` 视图用于运营观察，但不参与核心 KPI

### 5.2 新旧 trace 兼容解析器

实现 `parseTraceMode(trace)`：
1. 新数据：优先读 `metadata.executionIntent/executionMode/fallback`
2. 旧数据：回退到 `toolsUsed + steps.context.stepType` 推断

旧数据推断规则：
- 含 SDK 工具名 => `executionMode=tool_calling`
- 仅有 `llm_step_1/llm_step_2` => `executionMode=two_step`
- 是否 fallback：`unknown`（无法精确区分），纳入 `legacyAmbiguousTwoStepCount`

### 5.3 成功率口径修正（调用级）

新增 `extractToolCalls(trace)`：
- 优先读新字段 `step.context.toolCalls`
- 兼容旧字段：解析 `step.observation` 中的工具结果数组
- 若缺失明细，回退 `step.context.toolCallCount` 仅计次数（成功未知）

成功判定：
- `output.success === false` => failure
- 抛错/记录 error => failure
- 其余 => success

### 5.4 回退率公式修正

替换为：

```ts
fallbackRate = ratio(fallbackRuns, toolCallingAttemptRuns)
```

不再使用差值公式，不再 `Math.max(0, ...)` 掩盖计算错误。

### 5.5 分母统一与显式输出

每个 rate 输出三元组：
- `rate`
- `numerator`
- `denominator`

避免“口径漂移”与排查困难。

### 5.6 频率/覆盖率拆分输出

输出两个分布：
- `toolCallFrequencyDistribution`
- `toolCoverageDistribution`

并在报告中明确标签，不再将频率写成覆盖率。

### 5.7 `durationMs` 指标补齐

基于新埋点输出：
- `toolCallDurationP50/P95`
- `avgToolCallDurationMs`
- 慢工具 TopN（按平均耗时）

旧数据无 `durationMs` 时：
- 不参与调用级时延分位数
- 输出 `missingToolDurationCount` 提示采集缺口

---

## 6. 文档修复清单（Medium 问题）

目标文档：`docs/plans/2026-03-02-tool-calling-monitor.md`

需要改动：
1. 数据源：`Entry.reasoningTrace` 改为 `ReasoningTrace` 表（`Entry.reasoningTraces` 1:N）
2. 状态值：`COMPLETED` 改为 `DONE`
3. 两步模式判定：改为优先读取 metadata 显式字段；旧数据才推断
4. 分母说明：每个指标写明独立分母，禁止共享 `total` 兜底

可选同步：`docs/architecture/DATA_MODEL.md` 中 `ProcessStatus` 的历史残留 `COMPLETED` 一并清理为 `DONE`（若该处描述 Entry 处理状态）。

---

## 7. 向后兼容策略

1. 数据层兼容
- 不改表结构，不做 migration
- 新增字段全部 optional，写入 metadata/steps JSON

2. 读路径兼容
- 脚本优先读新字段，缺失则按旧规则推断
- 推断失败归类为 `unknown`，不抛错中断

3. 指标兼容
- 历史数据仍可统计基础指标
- 对“无法区分回退来源”的旧数据单独暴露 `legacyAmbiguousTwoStepCount`

4. 行为兼容
- 保留 `toolsUsed` 字段与现有含义，避免影响已有消费逻辑

---

## 8. 实施步骤

1. 改 `engine.ts`：新增 metadata 字段、两步原因、fallback 记录、tool duration 埋点
2. 改 `types.ts`：扩展 `ReasoningTrace.metadata` 可选字段
3. 改 `monitor-tool-calling.ts`：重写统计口径与兼容解析器
4. 改文档：修正数据源/状态值/判定逻辑/分母描述
5. 运行验证：`npm run lint`、`npm run test:run`、`npm run monitor:tools -- 1`

---

## 9. 验证用例（必须覆盖）

1. 配置关闭工具调用
- 预期：`executionIntent=two_step`，`fallback.triggered=false`，不计入 fallbackRate 分子

2. 工具调用成功
- 预期：`executionMode=tool_calling`，有 `toolCallStats`，`toolCallSuccessRate` > 0

3. 工具调用抛错并回退
- 预期：`executionIntent=tool_calling`，`executionMode=two_step`，`fallback.triggered=true`

4. 重试多次同一 entry
- 预期：trace 粒度统计能看到失败与重试，不被 latest 去重吞掉

5. 历史旧数据（无新增字段）
- 预期：脚本不报错，fallback 未知计入 `legacyAmbiguousTwoStepCount`

---

## 10. 风险与应对

- 风险：工具包装影响原行为
  - 应对：包装仅增加旁路采集，不改工具输入输出语义
- 风险：旧 trace `observation` 非 JSON
  - 应对：容错解析，失败则降级到 `toolCallCount`
- 风险：指标跳变（口径修复导致）
  - 应对：发布说明中标注“2026-03-02 口径变更”，保留旧口径一周对照

---

## 11. 交付定义（DoD）

- 回退率不再出现负值或被 `Math.max` 掩盖
- 可区分“配置关闭两步”与“失败回退两步”
- 成功率为工具调用级而非 Entry 状态级
- 频率与覆盖率拆分且定义一致
- 工具调用步骤具备 `durationMs`
- 文档与实现口径一致

