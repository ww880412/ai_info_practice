# Codex Review Result: Agent 模式对比功能 - Round 2

**日期**: 2026-03-06
**分支**: codex/mode-comparison
**评审轮次**: Round 2（修复后重新评审）
**评审状态**: ❌ 发现问题需修复

---

## 评审结论

**总体评分**: 需要修复（4 个 P1 + 1 个 P2）

Codex 评审结果：
> The new mode-comparison workflow has several correctness issues: the status endpoint does not read route params correctly, the batch worker derives and scores its baseline from the wrong data, and comparison runs ignore per-entry credentials. Those bugs make the feature unreliable even though the overall structure is reasonable.

**翻译**：
- 新的模式对比工作流存在几个正确性问题
- 状态端点未正确读取路由参数
- 批处理 worker 从错误的数据派生和评分基线
- 对比运行忽略了每个 entry 的凭证
- 这些 bug 使功能不可靠，尽管整体结构合理

---

## 发现问题

### P1 级别（必须解决）

**P1-1: Await params before reading batchId**
- **文件**: `src/app/api/entries/compare-modes/[batchId]/route.ts:6-9`
- **问题**: Next.js 16 中动态路由参数是 Promise，需要 await
- **影响**: GET 请求会 404/500，无法读取批次进度
- **修复**: `const { batchId } = await params;`

**P1-2: Stop using the latest trace as the comparison baseline**
- **文件**: `src/lib/inngest/functions/process-comparison-batch.ts:44-46`
- **问题**: 使用 `reasoningTraces[0]` 作为基线，但 `processWithMode()` 也会创建新 trace
- **影响**: 重复对比会读取上次实验结果作为基线，导致自我对比和无效统计
- **修复**: 需要从 Entry 的当前字段读取原始决策，而不是从 trace

**P1-3: Normalize the stored trace before scoring**
- **文件**: `src/lib/inngest/functions/process-comparison-batch.ts:61-61`
- **问题**: `latestTrace.finalResult` 是原始 payload，而 `processWithMode()` 返回标准化结果
- **影响**: 对比时使用不同 schema，导致评分偏差
- **修复**: 对原始 trace 也进行标准化

**P1-4: Reuse each entry's configured credential**
- **文件**: `src/lib/inngest/functions/process-comparison-batch.ts:72-77`
- **问题**: 批处理 worker 未解析 `entry.credentialId`
- **影响**: 使用默认凭证而非 entry 指定的凭证，导致对比无效
- **修复**: 在处理前解析并设置凭证

### P2 级别（建议解决）

**P2-1: Don't count failed entries as completed**
- **文件**: `src/lib/inngest/functions/process-comparison-batch.ts:115-119`
- **问题**: `progress` 在 finally 块中递增，失败的 entry 也计入完成
- **影响**: 部分失败显示为 100% 完成，UI 无法区分
- **修复**: 只在成功时递增 progress，或添加 failedCount 字段

---

## 修复计划

1. ✅ P1-1: Await params（简单）
2. ✅ P1-2: 修复基线读取逻辑（中等）
3. ✅ P1-3: 标准化原始 trace（简单）
4. ✅ P1-4: 解析 entry 凭证（中等）
5. ✅ P2-1: 改进进度计数（简单）

---

**评审完成时间**: 2026-03-06
**评审模型**: gpt-5.4 (CRS Provider)
**评审会话**: 019cc18b-cac2-7681-9ed9-7e0a42e3cbbb
