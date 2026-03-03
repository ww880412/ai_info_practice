# 灰度监控工具调用效果方案

**版本**: v2.0
**日期**: 2026-03-02
**状态**: 已实施

---

## 一、目标

监控 Phase 2a 工具调用模式的运行效果，提供数据支撑后续优化决策。

## 二、监控指标

### 2.1 运行级指标（trace 粒度）

| 指标 | 数据来源 | 计算方式 |
|------|----------|----------|
| 工具调用模式占比 | `ReasoningTrace.metadata.executionMode` | `tool_calling` trace / 总 trace |
| 回退率 | `ReasoningTrace.metadata.fallback` | `fallback.triggered=true` / `executionIntent=tool_calling` |
| 配置关闭占比 | `ReasoningTrace.metadata.twoStepReason` | `tool_calling_disabled` / 总 trace |

### 2.2 调用级指标（tool call 粒度）

| 指标 | 数据来源 | 说明 |
|------|----------|------|
| 工具调用成功率 | `metadata.toolCallStats` 或 `step.context.toolCalls` | 成功调用数 / 总调用数 |
| 工具调用频率 | `step.context.toolCalls` | 每个工具的调用总次数 |
| 工具调用时延 | `toolCalls[].durationMs` | P50/P95 时延 |

### 2.3 覆盖率（trace 粒度）

| 指标 | 数据来源 | 说明 |
|------|----------|------|
| 工具覆盖率 | `metadata.toolsUsed` | 至少调用过该工具的 trace 占比 |

## 三、技术方案

### 3.1 数据结构

`ReasoningTrace` 存储在独立表（与 `Entry` 1:N 关联）：

```typescript
interface ReasoningTraceMetadata {
  startTime: string;
  endTime: string;
  iterations: number;
  toolsUsed: string[];

  // v2 新增字段
  schemaVersion?: number;  // 2
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
    byTool: Record<string, { total, success, failed, durationMsTotal }>;
  };
}
```

### 3.2 判断逻辑

**新数据（schemaVersion=2）**：
- 直接读取 `executionIntent/executionMode/fallback` 字段

**旧数据兼容**：
- 含 SDK 工具名 → `executionMode=tool_calling`
- 仅有 `llm_step_1/2` → `executionMode=two_step`（回退状态未知）

**成功/失败判断**：
- Entry.processStatus === 'DONE' → 成功
- Entry.processStatus === 'FAILED' → 失败

## 四、使用方式

```bash
# 查看最近 1 天
npm run monitor:tools

# 查看最近 7 天
npm run monitor:tools 7
```

## 五、验收标准

- [x] 脚本可成功运行并输出报告
- [x] 回退率公式正确（不再出现负值）
- [x] 区分工具调用频率与覆盖率
- [x] 支持新旧数据兼容解析
- [x] 显示数据质量指标

---

**预估工时**: 3.5h
**风险等级**: Low
**实施状态**: ✅ 已完成
