# Codex Review Result: Agent 模式对比功能 - Round 3

**日期**: 2026-03-06
**分支**: codex/mode-comparison
**评审轮次**: Round 3（修复 Round 2 问题后）
**评审状态**: ❌ 发现新问题需修复

---

## 评审结论

**总体评分**: 需要修复（3 个 P1 + 1 个 P2）

Codex 评审结果：
> The new mode-comparison workflow has multiple correctness issues: credentials can leak across entries, actionable baselines are reconstructed without their stored practice task, the original mode is mislabeled, and progress can still overcount after failures. Together these make the saved comparison results unreliable.

**翻译**：
- 凭证可能在 entry 之间泄漏
- actionable 基线重建时缺少存储的 practice task
- originalMode 标签错误
- 进度仍可能在失败后过度计数
- 这些问题使保存的对比结果不可靠

---

## 发现问题

### P1 级别（必须解决）

**P1-1: Reset server credential between comparison entries**
- **文件**: `src/lib/inngest/functions/process-comparison-batch.ts:50-56`
- **问题**: `setServerConfig()` 设置全局状态，不会自动重置
- **影响**: 混合凭证的批次会导致后续 entry 使用错误的凭证/模型
- **修复**: 在处理完每个 entry 后重置为默认配置

**P1-2: Load the full original decision before scoring**
- **文件**: `src/lib/inngest/functions/process-comparison-batch.ts:61-67`
- **问题**: `practiceTask` 在关联表中，`practiceReason` 未存储在 Entry
- **影响**: ACTIONABLE entry 的基线不完整，系统性偏向新模式
- **修复**: 从 Entry 关联加载完整的 practiceTask

**P1-3: Derive originalMode from persisted execution data**
- **文件**: `src/lib/inngest/functions/process-comparison-batch.ts:31-32`
- **问题**: 硬编码 originalMode 为 targetMode 的反面，但实际可能相同
- **影响**: 标签和统计数据错误
- **修复**: 从 ReasoningTrace metadata 读取实际执行模式

### P2 级别（建议解决）

**P2-1: Count only successful comparisons in progress**
- **文件**: `src/lib/inngest/functions/process-comparison-batch.ts:137-141`
- **问题**: 使用 `i + 1` 而非成功计数，失败后成功会过度计数
- **影响**: 部分失败的批次显示为完全处理
- **修复**: 使用独立的成功计数器

---

## 修复计划

1. ✅ P1-1: 重置服务器凭证（简单）
2. ✅ P1-2: 加载完整原始决策（中等）
3. ✅ P1-3: 从 metadata 派生 originalMode（中等）
4. ✅ P2-1: 使用成功计数器（简单）

---

**评审完成时间**: 2026-03-06
**评审模型**: gpt-5.4 (CRS Provider)
