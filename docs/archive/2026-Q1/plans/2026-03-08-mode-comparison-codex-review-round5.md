# Codex Review Request: Agent 模式对比功能 - Round 5

**日期**: 2026-03-08
**分支**: main
**评审轮次**: Round 5（修复 Round 4 问题后）
**评审范围**: 后端实现修复验证

---

## 评审目标

请验证 Round 4 发现的 2 个 P1 问题是否已完全修复：
1. **P1-1**: ACTIONABLE baselines 不完整（steps 为空）
2. **P1-2**: originalMode 不可靠（snake_case vs kebab-case 不一致）

---

## Round 4 问题回顾

### P1-1: ACTIONABLE baselines are still incomplete
- **原问题**: Prisma 查询加载 `practiceTask` 但没有加载嵌套的 `steps`
- **影响**: `normalizePracticeTask()` 在 steps 为空时返回 `null`，导致 ACTIONABLE entry 的 actionability 维度被系统性低估
- **修复方案**:
  - Prisma 查询改为 `practiceTask: { include: { steps: true } }`
  - 重建时使用 `steps: entry.practiceTask.steps || []`

### P1-2: originalMode is still not reliable
- **原问题**:
  1. 读取最新 trace metadata，但重复对比会追加新 trace
  2. `executionMode` 存储为 snake_case，但功能契约是 kebab-case
- **影响**: 重复对比时 originalMode 标签错误，统计数据不可靠
- **修复方案**:
  - 添加 `Entry.originalExecutionMode` 字段作为不可变基线
  - 在 `process-entry.ts` 中从 trace metadata 提取并转换格式
  - 在 `process-comparison-batch.ts` 中直接读取 Entry 字段

---

## 修复实施

### 修复 1: 加载完整 practiceTask（P1-1）

**文件**: `src/lib/inngest/functions/process-comparison-batch.ts`

**修改位置**: 第 48-52 行

```typescript
include: {
  practiceTask: {
    include: {
      steps: true, // P1-2 Fix: Load nested steps for complete baseline
    },
  },
},
```

**修改位置**: 第 95 行

```typescript
steps: entry.practiceTask.steps || [], // P1-2 Fix: Include loaded steps
```

### 修复 2: 使用不可变 originalExecutionMode（P1-2）

**相关 Commit**: `abebe4c` - "fix(agent): resolve Codex Round 5 P1 issue - originalMode reliability"

**Schema 变更**: `prisma/schema.prisma`

```prisma
model Entry {
  // ... existing fields
  originalExecutionMode String? // 'two-step' or 'tool-calling'
}
```

**Ingest 流程**: `src/lib/inngest/functions/process-entry.ts` (第 348-361 行)

```typescript
let originalExecutionMode: string | undefined;
if (latestTrace) {
  try {
    const metadata = JSON.parse(latestTrace.metadata || '{}');
    if (metadata.executionMode) {
      // Convert snake_case to kebab-case for consistency
      originalExecutionMode = metadata.executionMode.replace('_', '-');
    }
  } catch {
    // Ignore parsing errors - leave originalExecutionMode as undefined
  }
}

// Save to Entry
await prisma.entry.update({
  where: { id: entryId },
  data: {
    // ... other fields
    originalExecutionMode, // Save original execution mode
  },
});
```

**Comparison 流程**: `src/lib/inngest/functions/process-comparison-batch.ts` (第 69-78 行)

```typescript
// P1-3 Fix: Read originalMode from Entry field (immutable baseline)
// Fail closed: reject entries without baseline instead of fabricating mode
if (!entry.originalExecutionMode) {
  throw new Error(
    `Entry ${entryId} missing originalExecutionMode. ` +
    `Only entries processed with Agent can be compared.`
  );
}

const originalMode = entry.originalExecutionMode as 'two-step' | 'tool-calling';
```

---

## 测试验证

### 单元测试

```bash
✓ src/lib/ai/agent/__tests__/comparison.test.ts (3 tests) 1ms
✓ src/lib/ai/agent/__tests__/engine-mode-switch.test.ts (3 tests) 23ms
```

### TypeScript 类型检查

```bash
npx tsc --noEmit
# No errors
```

---

## 评审重点

### P0 级别（必须确认）
- [ ] P1-1 修复是否完整？practiceTask.steps 是否正确加载和使用？
- [ ] P1-2 修复是否完整？originalMode 是否在重复对比时保持可靠？
- [ ] 格式转换是否正确？snake_case → kebab-case 转换是否覆盖所有场景？
- [ ] 错误处理是否合理？缺少 originalExecutionMode 时是否正确拒绝？

### P1 级别（建议确认）
- [ ] 是否有新的边界情况未覆盖？
- [ ] 测试覆盖是否充分？
- [ ] 是否有性能问题？

---

## 相关文件

### 核心修改
- `src/lib/inngest/functions/process-comparison-batch.ts` - 对比批处理逻辑
- `src/lib/inngest/functions/process-entry.ts` - Entry 入库流程
- `prisma/schema.prisma` - 数据库 Schema

### 测试文件
- `src/lib/ai/agent/__tests__/comparison.test.ts` - 对比逻辑测试
- `src/lib/ai/agent/__tests__/engine-mode-switch.test.ts` - 模式切换测试

---

## 期望输出

请提供：
1. **总体评分**: 0-10 分（8 分以上可进入前端实施）
2. **问题清单**: 按 P0/P1/P2 分类（如有）
3. **改进建议**: 具体的修改建议（如有）
4. **验收结论**: 后端是否已生产就绪？

---

**评审请求人**: Claude (Opus 4.6)
**评审日期**: 2026-03-08
