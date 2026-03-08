# Codex Review Result: Agent 模式对比功能 - Round 5

**日期**: 2026-03-08
**分支**: main
**评审轮次**: Round 5（修复 Round 4 问题后）
**评审状态**: ⚠️ 发现新问题需修复

---

## 评审结论

**总体评分**: 7.8/10

Codex 评审结果：
> 暂不建议判定为生产就绪（需先修复 P1 基线可变问题）

**翻译**：
- Round 4 的 P1-1（steps 加载）已完全修复 ✅
- Round 4 的 P1-2（originalMode 可靠性）部分修复 ⚠️
- 发现新的 P1 问题：`originalExecutionMode` 并非不可变基线
- 缺少针对性回归测试

---

## 发现问题

### P1 级别（必须解决）

**P1-1: originalExecutionMode 目前并非"不可变基线"**
- **文件**: `src/lib/inngest/functions/process-entry.ts:348, 374`
- **问题**: 每次 `process-entry` 都会重新从最新 trace 推导并写回 `originalExecutionMode`，没有"仅首次写入"的保护
- **影响**: 一旦后续重处理使用了不同模式，基线会被覆盖，模式对比统计会漂移
- **修复**: 将 `originalExecutionMode` 改为"仅在为空时写入"

### P2 级别（建议解决）

**P2-1: 本轮修复缺少针对性回归测试**
- **文件**: `src/lib/ai/agent/__tests__/comparison.test.ts`, `src/lib/ai/agent/__tests__/engine-mode-switch.test.ts`
- **问题**: 现有测试主要覆盖 `determineWinner` 和 `processWithMode` 可调用性，没有覆盖本轮两个修复点
- **影响**: 无法验证修复的正确性，未来可能回归
- **修复**: 增加 3 个回归测试：
  1. `steps` 重建测试
  2. mode 转换与持久化测试
  3. 缺基线拒绝路径测试

---

## 修复项核对结论

### ✅ P1-1（ACTIONABLE baselines steps）: 已修复
- `process-comparison-batch.ts:48` 已 include `steps`
- `process-comparison-batch.ts:95` 已带入 `steps`

### ⚠️ P1-2（originalMode 可靠性）: 部分修复
- ✅ 读路径已从 Entry 字段取值（避免比较流程被新 trace 污染）
- ❌ 写路径仍可覆盖该字段，尚未达到"不可变"语义

### ✅ snake_case → kebab-case 转换: 当前已覆盖已知值
- `process-entry.ts:356` 已实现转换

### ✅ 缺少基线时拒绝处理: 已实现
- API 入口拒绝: `compare-modes/route.ts:43`
- 批处理内也 fail-closed: `process-comparison-batch.ts:71`

---

## 测试验证

### 单元测试
```bash
✓ src/lib/ai/agent/__tests__/comparison.test.ts (3 tests)
✓ src/lib/ai/agent/__tests__/engine-mode-switch.test.ts (3 tests)
Total: 6/6 passed
```

### TypeScript 类型检查
```bash
npx tsc --noEmit
# No errors
```

---

## 改进建议

1. **P1 修复**: 将 `originalExecutionMode` 改为"仅在为空时写入"，避免后续重处理覆盖基线
2. **P2 修复**: 增加 3 个回归测试覆盖本轮修复点

---

**评审完成时间**: 2026-03-08 11:30
**评审模型**: gpt-5.3-codex (high reasoning)
**评审会话**: Round 5
