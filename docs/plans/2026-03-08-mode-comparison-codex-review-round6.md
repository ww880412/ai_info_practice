# Codex Review Request: Agent 模式对比功能 - Round 6

**日期**: 2026-03-08
**分支**: main
**评审轮次**: Round 6（修复 Round 5 P1 问题后）
**评审范围**: 验证 originalExecutionMode 不可变基线修复

---

## 评审目标

请验证 Round 5 发现的 P1 问题是否已完全修复：
- **P1**: `originalExecutionMode` 现在是否真正成为不可变基线？

---

## Round 5 问题回顾

### P1: originalExecutionMode 目前并非"不可变基线"
- **原问题**: 每次 `process-entry` 都会重新从最新 trace 推导并写回 `originalExecutionMode`，没有"仅首次写入"的保护
- **影响**: 一旦后续重处理使用了不同模式，基线会被覆盖，模式对比统计会漂移
- **修复方案**: 将 `originalExecutionMode` 改为"仅在为空时写入"

---

## 修复实施

**相关 Commit**: `8015d67` - "fix(agent): make originalExecutionMode immutable baseline"

**文件**: `src/lib/inngest/functions/process-entry.ts`

**修改内容**:

```typescript
// Transaction to save all results
await prisma.$transaction(async (tx) => {
  // Read current Entry to check if originalExecutionMode is already set
  const currentEntry = await tx.entry.findUnique({
    where: { id: entryId },
    select: { originalExecutionMode: true },
  });

  // Only derive originalExecutionMode if not already set (immutable baseline)
  let originalExecutionMode: string | undefined;
  if (!currentEntry?.originalExecutionMode) {
    // Get the latest reasoning trace to extract execution mode
    const latestTrace = await tx.reasoningTrace.findFirst({
      where: { entryId },
      orderBy: { createdAt: 'desc' },
      select: { metadata: true },
    });

    if (latestTrace) {
      try {
        const metadata = JSON.parse(latestTrace.metadata);
        // Only set if executionMode exists in metadata
        // Do not fabricate default value - leave as undefined if missing
        if (metadata.executionMode) {
          // Convert snake_case to kebab-case for consistency
          originalExecutionMode = metadata.executionMode.replace('_', '-');
        }
      } catch {
        // Ignore parsing errors - leave originalExecutionMode as undefined
      }
    }
  }

  // Update Entry
  await tx.entry.update({
    where: { id: entryId },
    data: {
      title: parsed.title || undefined,
      contentType: decision.contentType,
      techDomain: decision.techDomain,
      aiTags: decision.aiTags,
      coreSummary: decision.coreSummary,
      keyPoints: decision.keyPoints,
      practiceValue: decision.practiceValue,
      // Only update originalExecutionMode if it was just derived (not already set)
      ...(originalExecutionMode ? { originalExecutionMode } : {}),
```

**关键变化**:
1. 在事务开始时读取当前 Entry 的 `originalExecutionMode`
2. 只有当该字段为空时，才从 trace metadata 提取
3. 使用条件展开运算符，只在新推导时才更新字段

---

## 验证场景

### 场景 1: 首次处理 Entry
- **预期**: `originalExecutionMode` 从 trace metadata 提取并保存
- **验证**: 字段应该被正确设置为 `two-step` 或 `tool-calling`

### 场景 2: 重新处理已有 Entry（相同模式）
- **预期**: `originalExecutionMode` 保持不变
- **验证**: 字段值不应该被覆盖

### 场景 3: 重新处理已有 Entry（不同模式）
- **预期**: `originalExecutionMode` 保持原始值，不受新模式影响
- **验证**: 字段值应该保持首次处理时的模式

### 场景 4: 模式对比批处理
- **预期**: 读取到的 `originalMode` 始终是首次处理时的模式
- **验证**: 重复对比不会导致 `originalMode` 标签错误

---

## 测试验证

### TypeScript 类型检查
```bash
npx tsc --noEmit
# No errors
```

### 相关单元测试
```bash
✓ src/lib/ai/agent/__tests__/comparison.test.ts (3 tests)
✓ src/lib/ai/agent/__tests__/engine-mode-switch.test.ts (3 tests)
```

---

## 评审重点

### P0 级别（必须确认）
- [ ] P1 修复是否完整？`originalExecutionMode` 是否真正不可变？
- [ ] 条件逻辑是否正确？`if (!currentEntry?.originalExecutionMode)` 是否覆盖所有场景？
- [ ] 条件展开是否正确？`...(originalExecutionMode ? { originalExecutionMode } : {})` 是否会导致意外行为？
- [ ] 是否有边界情况未覆盖？（如 Entry 不存在、并发写入等）

### P1 级别（建议确认）
- [ ] 性能影响如何？额外的 `findUnique` 查询是否可接受？
- [ ] 是否需要数据库索引？`originalExecutionMode` 字段是否需要索引？
- [ ] 是否有更优雅的实现方式？

### P2 级别（可选）
- [ ] Round 5 的 P2 问题（缺少回归测试）是否需要在本轮解决？

---

## 相关文件

### 核心修改
- `src/lib/inngest/functions/process-entry.ts` - Entry 入库流程（已修改）

### 依赖文件
- `src/lib/inngest/functions/process-comparison-batch.ts` - 对比批处理逻辑（读取 originalExecutionMode）
- `prisma/schema.prisma` - Entry.originalExecutionMode 字段定义

### 测试文件
- `src/lib/ai/agent/__tests__/comparison.test.ts` - 对比逻辑测试
- `src/lib/ai/agent/__tests__/engine-mode-switch.test.ts` - 模式切换测试

---

## 期望输出

请提供：
1. **总体评分**: 0-10 分（8 分以上可进入前端实施）
2. **问题清单**: 按 P0/P1/P2 分类（如有）
3. **改进建议**: 具体的修改建议（如有）
4. **验收结论**: 后端是否已生产就绪？可以开始前端实施吗？

---

**评审请求人**: Claude (Opus 4.6)
**评审日期**: 2026-03-08
**前置评审**: Round 5 (7.8/10)
