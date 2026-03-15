# Agent 模式对比功能设计

**版本**: v1.0
**日期**: 2026-03-06
**状态**: 设计阶段
**前置**: Phase 3a 评分 Agent 已完成

---

## 一、目标

构建一个实用的模式对比功能，让用户可以在 Knowledge Base 中批量选择 Entry，用不同的 Agent 模式重新处理，并通过评分 Agent 对比输出质量。

### 核心价值

- **数据驱动决策**：用真实数据验证两种模式的质量差异
- **灵活对比**：用户自主选择对比样本，针对性强
- **可复用**：功能持久化，可随时进行新的对比实验

---

## 二、功能设计

### 2.1 用户流程

```
1. 在 Library 页面批量选择 Entry（支持筛选）
   ↓
2. 点击"模式对比"按钮，选择目标模式
   ↓
3. 后台异步处理：用目标模式重新处理 + 评分对比
   ↓
4. 查看对比结果页面：并排展示 + 评分差异 + 统计分析
```

### 2.2 核心功能点

| 功能 | 说明 |
|------|------|
| 批量选择 | 支持多选 Entry，可按类型/标签/日期筛选 |
| 模式切换 | 选择目标模式（two-step / tool-calling） |
| 异步处理 | 后台队列处理，避免阻塞 UI |
| 质量评分 | 使用评分 Agent 对两种输出打分 |
| 结果对比 | 并排展示决策结果 + 5 维度评分对比 |
| 统计分析 | 胜率、平均分差、维度分析 |

---

## 三、技术架构

### 3.1 数据模型

**新增表：ModeComparison**

```prisma
model ModeComparison {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())

  // 关联的 Entry
  entryId   String
  entry     Entry    @relation(fields: [entryId], references: [id], onDelete: Cascade)

  // 原始模式信息
  originalMode      String  // 'two-step' | 'tool-calling'
  originalDecision  Json    // NormalizedAgentIngestDecision
  originalScore     Json    // QualityEvaluation

  // 对比模式信息
  comparisonMode     String  // 'two-step' | 'tool-calling'
  comparisonDecision Json    // NormalizedAgentIngestDecision
  comparisonScore    Json    // QualityEvaluation

  // 对比结果
  winner            String?  // 'original' | 'comparison' | 'tie'
  scoreDiff         Float    // comparisonScore.overallScore - originalScore.overallScore

  // 批次信息（支持批量对比）
  batchId           String
  batchIndex        Int

  @@index([entryId])
  @@index([batchId])
}
```

**新增表：ComparisonBatch**

```prisma
model ComparisonBatch {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // 批次配置
  targetMode    String   // 目标模式
  entryCount    Int      // Entry 总数

  // 执行状态
  status        String   // 'pending' | 'processing' | 'completed' | 'failed'
  progress      Int      @default(0)  // 已处理数量

  // 统计结果
  stats         Json?    // 批次统计（胜率、平均分差等）

  @@index([status])
}
```

### 3.2 API 设计

**POST /api/entries/compare-modes**

触发模式对比任务。

```typescript
// Request
{
  entryIds: string[];
  targetMode: 'two-step' | 'tool-calling';
}

// Response
{
  data: {
    batchId: string;
    entryCount: number;
    estimatedTime: string;  // "约 5 分钟"
  }
}
```

**GET /api/entries/compare-modes/:batchId**

查询对比批次状态和结果。

```typescript
// Response
{
  data: {
    batchId: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress: number;  // 0-100
    entryCount: number;
    completedCount: number;
    results?: ModeComparison[];  // status=completed 时返回
    stats?: {
      originalWins: number;
      comparisonWins: number;
      ties: number;
      avgScoreDiff: number;
      dimensionBreakdown: {
        completeness: number;
        accuracy: number;
        relevance: number;
        clarity: number;
        actionability: number;
      };
    };
  }
}
```

**GET /api/entries/compare-modes/:batchId/results/:entryId**

查询单个 Entry 的详细对比结果。

```typescript
// Response
{
  data: {
    entryId: string;
    entryTitle: string;
    originalMode: string;
    comparisonMode: string;
    originalDecision: NormalizedAgentIngestDecision;
    comparisonDecision: NormalizedAgentIngestDecision;
    originalScore: QualityEvaluation;
    comparisonScore: QualityEvaluation;
    winner: 'original' | 'comparison' | 'tie';
    scoreDiff: number;
  }
}
```

### 3.3 后端实现

**核心流程**：

1. **创建批次**：
   - 验证 entryIds 存在
   - 创建 ComparisonBatch 记录
   - 触发 Inngest 任务

2. **Inngest 任务**（`comparison/process-batch`）：
   - 遍历 entryIds
   - 对每个 Entry：
     - 读取原始 ParseResult
     - 用目标模式重新处理（调用 Agent Engine）
     - 用评分 Agent 对两份结果打分
     - 保存 ModeComparison 记录
   - 更新批次进度
   - 完成后计算统计数据

3. **评分对比**：
   - 调用 `evaluateDecisionQuality()` 对两份决策打分
   - 计算 scoreDiff = comparisonScore - originalScore
   - 判断 winner：
     - scoreDiff > 5: 'comparison'
     - scoreDiff < -5: 'original'
     - else: 'tie'

### 3.4 前端实现

**Library 页面改动**：

```tsx
// 新增批量操作按钮
<Button onClick={handleCompareModesClick}>
  模式对比 ({selectedEntries.length})
</Button>

// 弹窗选择目标模式
<Dialog>
  <RadioGroup>
    <Radio value="two-step">两步模式</Radio>
    <Radio value="tool-calling">工具调用模式</Radio>
  </RadioGroup>
  <Button onClick={startComparison}>开始对比</Button>
</Dialog>
```

**新增对比结果页面**（`/comparison/:batchId`）：

```tsx
// 进度展示（processing 状态）
<ProgressBar value={progress} />
<Text>{completedCount} / {entryCount} 已完成</Text>

// 统计概览（completed 状态）
<StatsCard>
  <Stat label="对比模式胜率" value="60%" />
  <Stat label="平均分差" value="+8.5" />
  <Stat label="最大提升" value="+25" />
</StatsCard>

// 维度分析
<DimensionChart data={dimensionBreakdown} />

// 详细结果列表
<ComparisonList>
  {results.map(result => (
    <ComparisonCard
      entry={result.entry}
      winner={result.winner}
      scoreDiff={result.scoreDiff}
      onClick={() => viewDetail(result.entryId)}
    />
  ))}
</ComparisonList>
```

**详细对比页面**（`/comparison/:batchId/entry/:entryId`）：

```tsx
// 并排对比布局
<SplitView>
  <DecisionPanel
    title="原始模式 (two-step)"
    decision={originalDecision}
    score={originalScore}
  />
  <DecisionPanel
    title="对比模式 (tool-calling)"
    decision={comparisonDecision}
    score={comparisonScore}
  />
</SplitView>

// 评分对比
<ScoreComparison
  original={originalScore}
  comparison={comparisonScore}
  dimensions={['completeness', 'accuracy', 'relevance', 'clarity', 'actionability']}
/>

// 差异高亮
<DiffView
  field="coreSummary"
  original={originalDecision.coreSummary}
  comparison={comparisonDecision.coreSummary}
/>
```

---

## 四、实施计划

### Phase 1: 后端基础（2-3h）

- [ ] Prisma Schema 添加 ModeComparison 和 ComparisonBatch 表
- [ ] 数据库迁移
- [ ] API Route: POST /api/entries/compare-modes
- [ ] API Route: GET /api/entries/compare-modes/:batchId
- [ ] 核心逻辑：批次创建、Entry 验证

### Phase 2: Inngest 任务（2-3h）

- [ ] 创建 Inngest 函数：comparison/process-batch
- [ ] 实现对比处理逻辑：
  - 读取原始 ParseResult
  - 用目标模式重新处理
  - 调用评分 Agent
  - 保存对比结果
- [ ] 进度更新机制
- [ ] 统计数据计算

### Phase 3: 前端 UI（3-4h）

- [ ] Library 页面：批量选择 + 模式对比按钮
- [ ] 对比结果页面：进度展示 + 统计概览 + 结果列表
- [ ] 详细对比页面：并排展示 + 评分对比 + 差异高亮
- [ ] Hooks: useComparisonBatch, useComparisonResults

### Phase 4: 测试与优化（1-2h）

- [ ] 单元测试：对比逻辑、评分计算
- [ ] 集成测试：完整对比流程
- [ ] 性能优化：批量处理、并发控制
- [ ] 错误处理：失败重试、部分失败处理

---

## 五、技术细节

### 5.1 模式切换实现

```typescript
// src/lib/ai/agent/engine.ts
async function processWithMode(
  entryId: string,
  input: ParseResult,
  mode: 'two-step' | 'tool-calling'
): Promise<NormalizedAgentIngestDecision> {
  // 临时覆盖配置
  const originalConfig = this.config;
  this.config = {
    ...originalConfig,
    useToolCalling: mode === 'tool-calling',
  };

  try {
    const trace = await this.executeReasoning(entryId, input);
    return normalizeAgentIngestDecision(trace.finalResult);
  } finally {
    this.config = originalConfig;
  }
}
```

### 5.2 评分对比逻辑

```typescript
// src/lib/ai/agent/comparison.ts
export async function compareDecisions(
  original: NormalizedAgentIngestDecision,
  comparison: NormalizedAgentIngestDecision,
  originalContent: { title: string; content: string; length: number }
): Promise<{
  originalScore: QualityEvaluation;
  comparisonScore: QualityEvaluation;
  winner: 'original' | 'comparison' | 'tie';
  scoreDiff: number;
}> {
  // 并行评分
  const [originalScore, comparisonScore] = await Promise.all([
    evaluateDecisionQuality({ decision: original, originalContent }),
    evaluateDecisionQuality({ decision: comparison, originalContent }),
  ]);

  const scoreDiff = comparisonScore.overallScore - originalScore.overallScore;

  let winner: 'original' | 'comparison' | 'tie';
  if (scoreDiff > 5) winner = 'comparison';
  else if (scoreDiff < -5) winner = 'original';
  else winner = 'tie';

  return { originalScore, comparisonScore, winner, scoreDiff };
}
```

### 5.3 批量处理策略

- **并发控制**：使用 `p-limit` 限制并发数（建议 3-5）
- **失败重试**：单个 Entry 失败不影响整体，记录错误继续处理
- **进度更新**：每处理完一个 Entry 更新进度（避免频繁写库）

---

## 六、验收标准

| ID | 标准 | 验证方式 |
|----|------|----------|
| AC1 | 可批量选择 Entry 并触发对比 | 手动测试 |
| AC2 | 对比任务异步执行，不阻塞 UI | 手动测试 |
| AC3 | 对比结果正确保存到数据库 | 数据库查询 |
| AC4 | 评分 Agent 正确对两份结果打分 | 单元测试 |
| AC5 | 统计数据准确（胜率、平均分差） | 单元测试 |
| AC6 | 前端正确展示对比结果 | 手动测试 |
| AC7 | 详细对比页面并排展示清晰 | 手动测试 |

---

## 七、后续优化方向

- **历史对比记录**：保存对比历史，支持查看过往对比
- **导出报告**：导出对比结果为 PDF/CSV
- **自动化对比**：定期自动对比新入库的 Entry
- **A/B 测试**：支持新模式灰度发布时的 A/B 对比
- **维度权重调整**：允许用户自定义评分维度权重

---

## 八、风险与依赖

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 批量处理耗时长 | 用户体验差 | 异步处理 + 进度展示 |
| 评分 Agent 调用失败 | 对比结果不完整 | 失败重试 + 错误记录 |
| 数据库写入压力 | 性能问题 | 批量写入 + 事务优化 |
| 前端状态管理复杂 | 开发难度高 | 使用 TanStack Query 管理异步状态 |

---

**设计完成日期**: 2026-03-06
**设计者**: Claude (Opus 4.6)
