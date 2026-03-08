# Codex Review Result: Agent 模式对比功能 - Round 4

**日期**: 2026-03-06
**分支**: codex/mode-comparison
**评审轮次**: Round 4（修复 Round 3 问题后）
**评审状态**: ❌ 发现新问题需修复

---

## 评审结论

**总体评分**: 需要修复（2 个 P1）

Codex 评审结果：
> Not all Round 3 P1/P2 issues are resolved, and I would not treat `e6f4a52` as production-ready yet.

**翻译**：
- Round 3 的 P1/P2 问题并未全部解决
- 不建议将 `e6f4a52` 视为生产就绪
- ACTIONABLE 基线仍不完整（steps 为空导致 normalizePracticeTask 返回 null）
- originalMode 仍不可靠（snake_case vs kebab-case 不一致）

---

## 发现问题

### P1 级别（必须解决）

**P1-1: ACTIONABLE baselines are still incomplete**
- **文件**: `src/lib/inngest/functions/process-comparison-batch.ts:45, 91`
- **问题**: 虽然加载了 `practiceTask` 关联，但没有加载嵌套的 `PracticeStep` 行，重建时使用 `steps: []`
- **影响**: `normalizePracticeTask()` 在 steps 为空时返回 `null`，导致原始决策在评分前丢失 practice task，actionability 维度被系统性低估
- **修复**: Prisma 查询改为 `practiceTask: { include: { steps: true } }`，并在重建时使用 `steps: entry.practiceTask.steps || []`

**P1-2: originalMode is still not reliable**
- **文件**: `src/lib/inngest/functions/process-comparison-batch.ts:49, 69` + `src/lib/ai/agent/engine.ts:487, 601`
- **问题 1**: 读取最新 trace metadata，但重复对比会追加新 trace，导致后续批次读到上次对比的 trace
- **问题 2**: `executionMode` 存储为 `two_step`/`tool_calling`（snake_case），但功能契约是 `two-step`/`tool-calling`（kebab-case），代码直接复制导致格式不一致
- **影响**: 重复对比时 originalMode 标签错误，统计数据不可靠
- **修复**: 添加 snake_case 到 kebab-case 的转换：`executionMode.replace('_', '-')`

### 已解决 ✅

**P1-1 (Round 3): Server credential reset**
- 已修复，在成功和错误路径都重置了配置

**P2-1 (Round 3): Progress counting**
- 已修复，使用 successCount 变量

---

## 修复计划

1. ✅ P1-1: 加载完整 practiceTask 包含 steps（简单）
2. ✅ P1-2: 转换 snake_case 到 kebab-case（简单）

---

## 测试状态

- ✅ TypeScript 类型检查通过
- ✅ 现有测试通过（comparison, ingest-contract, engine-mode-switch）
- ⚠️ `process-comparison-batch.ts` 没有直接测试覆盖

---

**评审完成时间**: 2026-03-06 18:25
**评审模型**: gpt-5.4 (CRS Provider)
**评审会话**: 019cc2a9-2447-75f1-b3b2-cb50ffb35af5
