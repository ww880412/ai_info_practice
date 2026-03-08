# Codex Review Request: Agent 模式对比功能

**日期**: 2026-03-06
**分支**: codex/mode-comparison
**评审轮次**: Round 1
**评审范围**: 设计文档 + 实施计划

---

## 评审目标

请评审 Agent 模式对比功能的设计和实施计划，确保：
1. 架构设计合理，符合项目现有模式
2. 数据模型设计正确，关联关系清晰
3. API 设计符合 RESTful 规范
4. 实施计划完整，任务粒度合理
5. 测试策略充分，覆盖关键路径

---

## 背景

Phase 3a 已完成评分 Agent（5 维度质量评分系统），现在需要构建模式对比功能，让用户可以：
- 在 Knowledge Base 中批量选择 Entry
- 用不同的 Agent 模式（two-step vs tool-calling）重新处理
- 使用评分 Agent 对比输出质量
- 查看详细的对比结果和统计分析

---

## 评审文档

### 1. 设计文档
**文件**: `docs/plans/2026-03-06-mode-comparison-design.md`

**核心内容**:
- 功能设计：用户流程、核心功能点
- 技术架构：数据模型、API 设计、前后端实现
- 实施计划：4 个 Phase（后端基础、Inngest 任务、前端 UI、测试优化）
- 验收标准：7 条验收标准
- 风险与依赖：4 个主要风险及缓解措施

**关键设计决策**:
1. **数据模型**: 新增 ModeComparison 和 ComparisonBatch 两张表
2. **异步处理**: 使用 Inngest 任务队列处理批量对比
3. **评分对比**: 并行调用评分 Agent，计算 scoreDiff 判断 winner
4. **前端状态**: 使用 TanStack Query 管理异步状态

### 2. 实施计划
**文件**: `docs/plans/2026-03-06-mode-comparison-implementation.md`

**核心内容**:
- 12 个任务，每个任务 2-5 分钟粒度
- TDD 方法：先写测试 → 运行失败 → 实现代码 → 运行通过 → 提交
- 完整覆盖：Prisma Schema、对比逻辑、API Route、Inngest 函数、前端 UI
- 验收清单：7 条功能验收 + 3 条质量验收

**任务分解**:
1. Task 1: Prisma Schema 更新（ModeComparison + ComparisonBatch）
2. Task 2: 对比逻辑核心模块（comparison.ts）
3. Task 3: Agent Engine 模式切换支持（processWithMode）
4. Task 4: API Route - 创建对比批次（POST /api/entries/compare-modes）
5. Task 5: API Route - 查询批次状态（GET /api/entries/compare-modes/:batchId）
6. Task 6: Inngest 函数 - 批量对比处理
7. Task 7: 前端 Hook - useComparisonBatch
8. Task 8: 前端组件 - Library 批量操作
9. Task 9: 前端页面 - 对比结果展示
10. Task 10: 前端页面 - 详细对比视图
11. Task 11: 集成测试
12. Task 12: 文档与清理

---

## 关键代码片段

### 数据模型（Prisma Schema）

```prisma
model ModeComparison {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())

  // Associated Entry
  entryId   String
  entry     Entry    @relation(fields: [entryId], references: [id], onDelete: Cascade)

  // Original mode info
  originalMode      String  // 'two-step' | 'tool-calling'
  originalDecision  Json    // NormalizedAgentIngestDecision
  originalScore     Json    // QualityEvaluation

  // Comparison mode info
  comparisonMode     String  // 'two-step' | 'tool-calling'
  comparisonDecision Json    // NormalizedAgentIngestDecision
  comparisonScore    Json    // QualityEvaluation

  // Comparison result
  winner            String?  // 'original' | 'comparison' | 'tie'
  scoreDiff         Float    // comparisonScore.overallScore - originalScore.overallScore

  // Batch info
  batchId           String
  batchIndex        Int

  @@index([entryId])
  @@index([batchId])
}

model ComparisonBatch {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Batch configuration
  targetMode    String   // Target mode to compare against
  entryCount    Int      // Total number of entries

  // Execution status
  status        String   // 'pending' | 'processing' | 'completed' | 'failed'
  progress      Int      @default(0)  // Number of processed entries

  // Statistics
  stats         Json?    // Batch statistics (win rate, avg score diff, etc.)

  @@index([status])
}
```

### 对比逻辑（comparison.ts）

```typescript
export async function compareDecisions(
  original: NormalizedAgentIngestDecision,
  comparison: NormalizedAgentIngestDecision,
  originalContent: { title: string; content: string; length: number }
): Promise<ComparisonResult> {
  // Evaluate both decisions in parallel
  const [originalScore, comparisonScore] = await Promise.all([
    evaluateDecisionQuality({ decision: original, originalContent }),
    evaluateDecisionQuality({ decision: comparison, originalContent }),
  ]);

  const scoreDiff = comparisonScore.overallScore - originalScore.overallScore;
  const winner = determineWinner(scoreDiff);

  return {
    originalScore,
    comparisonScore,
    winner,
    scoreDiff,
  };
}

export function determineWinner(scoreDiff: number): 'original' | 'comparison' | 'tie' {
  if (scoreDiff > 5) return 'comparison';
  if (scoreDiff < -5) return 'original';
  return 'tie';
}
```

### 模式切换（engine.ts）

```typescript
async processWithMode(
  entryId: string,
  input: ParseResult,
  mode: 'two-step' | 'tool-calling'
): Promise<NormalizedAgentIngestDecision> {
  // Save original config
  const originalConfig = this.config;

  // Temporarily override config
  this.config = {
    ...originalConfig,
    useToolCalling: mode === 'tool-calling',
  };

  try {
    const trace = await this.executeReasoning(entryId, input);
    return normalizeAgentIngestDecision(trace.finalResult);
  } finally {
    // Restore original config
    this.config = originalConfig;
  }
}
```

---

## 评审重点

### P0 级别（必须解决）
- [ ] 数据模型设计是否有缺陷？
- [ ] API 契约是否完整？
- [ ] 模式切换逻辑是否会影响全局状态？
- [ ] 评分对比逻辑是否正确？

### P1 级别（建议解决）
- [ ] 实施计划是否有遗漏的步骤？
- [ ] 测试覆盖是否充分？
- [ ] 错误处理是否完善？
- [ ] 性能优化是否考虑？

### P2 级别（可选优化）
- [ ] 代码结构是否可以更优雅？
- [ ] 用户体验是否可以提升？
- [ ] 文档是否清晰易懂？

---

## 项目上下文

### 相关文件
- `src/lib/ai/agent/engine.ts` - Agent 引擎（两种模式实现）
- `src/lib/ai/agent/scoring-agent.ts` - 评分 Agent（Phase 3a 已完成）
- `src/lib/ai/agent/ingest-contract.ts` - 决策契约定义
- `prisma/schema.prisma` - 数据库 Schema
- `src/lib/inngest/functions/process-entry.ts` - 现有 Inngest 函数示例

### 技术栈
- Next.js 16 (App Router)
- Prisma 5.22.0
- Inngest (任务队列)
- TanStack Query (状态管理)
- Tailwind CSS v4

### 测试框架
- Vitest (单元测试)
- Testing Library (组件测试)

---

## 期望输出

请提供：
1. **总体评分**: 0-10 分（7 分以上可进入实施）
2. **问题清单**: 按 P0/P1/P2 分类
3. **改进建议**: 具体的修改建议
4. **风险提示**: 实施过程中需要注意的风险点

---

**评审请求人**: Claude (Opus 4.6)
**评审日期**: 2026-03-06
