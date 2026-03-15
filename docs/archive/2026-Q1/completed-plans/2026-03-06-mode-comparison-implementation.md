# Agent 模式对比功能实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 构建模式对比功能，让用户可以批量选择 Entry，用不同 Agent 模式重新处理并对比质量评分

**Architecture:** 后端使用 Prisma 新增两张表存储对比数据，通过 Inngest 异步处理对比任务，前端使用 TanStack Query 管理状态并展示对比结果

**Tech Stack:** Next.js 16, Prisma 5, Inngest, TanStack Query, Tailwind CSS v4

---

## Task 1: Prisma Schema 更新

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: 添加 ModeComparison 表**

在 `schema.prisma` 文件末尾添加：

```prisma
// Mode comparison for A/B testing Agent modes
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
```

**Step 2: 添加 ComparisonBatch 表**

继续在 `schema.prisma` 文件末尾添加：

```prisma
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

**Step 3: 更新 Entry 模型添加关联**

在 Entry 模型的 relations 部分添加：

```prisma
  // Mode comparisons (1:many)
  modeComparisons ModeComparison[]
```

**Step 4: 生成 Prisma Client**

Run: `npx prisma generate`
Expected: "Generated Prisma Client"

**Step 5: 创建数据库迁移**

Run: `npx prisma db push`
Expected: "Your database is now in sync with your schema"

**Step 6: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(db): add ModeComparison and ComparisonBatch tables

- Add ModeComparison table for storing comparison results
- Add ComparisonBatch table for batch processing
- Add Entry.modeComparisons relation

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 2: 对比逻辑核心模块

**Files:**
- Create: `src/lib/ai/agent/comparison.ts`
- Create: `src/lib/ai/agent/__tests__/comparison.test.ts`

**Step 1: 编写对比逻辑测试**

创建 `src/lib/ai/agent/__tests__/comparison.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { compareDecisions, determineWinner } from '../comparison';
import type { NormalizedAgentIngestDecision } from '../ingest-contract';
import type { QualityEvaluation } from '../scoring-agent';

describe('comparison', () => {
  describe('determineWinner', () => {
    it('should return comparison as winner when scoreDiff > 5', () => {
      const result = determineWinner(15);
      expect(result).toBe('comparison');
    });

    it('should return original as winner when scoreDiff < -5', () => {
      const result = determineWinner(-10);
      expect(result).toBe('original');
    });

    it('should return tie when scoreDiff is between -5 and 5', () => {
      expect(determineWinner(3)).toBe('tie');
      expect(determineWinner(-3)).toBe('tie');
      expect(determineWinner(0)).toBe('tie');
    });
  });

  describe('compareDecisions', () => {
    it('should compare two decisions and return scores with winner', async () => {
      // Mock evaluateDecisionQuality
      const mockEvaluate = vi.fn()
        .mockResolvedValueOnce({
          overallScore: 75,
          dimensions: { completeness: 80, accuracy: 70, relevance: 75, clarity: 75, actionability: 75 },
          issues: [],
          suggestions: [],
          reasoning: 'Good quality',
        })
        .mockResolvedValueOnce({
          overallScore: 85,
          dimensions: { completeness: 90, accuracy: 80, relevance: 85, clarity: 85, actionability: 85 },
          issues: [],
          suggestions: [],
          reasoning: 'Better quality',
        });

      vi.mock('../scoring-agent', () => ({
        evaluateDecisionQuality: mockEvaluate,
      }));

      const original: NormalizedAgentIngestDecision = {
        contentType: 'TUTORIAL',
        techDomain: 'FRONTEND',
        aiTags: ['react'],
        coreSummary: 'Original summary',
        keyPoints: { core: ['point1'], extended: [] },
        boundaries: { applicable: [], notApplicable: [] },
        practiceValue: 'ACTIONABLE',
        practiceReason: 'Has steps',
        practiceTask: null,
        difficulty: 'MEDIUM',
        sourceTrust: 'HIGH',
        timeliness: 'RECENT',
        contentForm: 'TEXTUAL',
        summaryStructure: { type: 'tutorial', fields: {}, reasoning: '' },
        confidence: 0.8,
        extractedMetadata: {},
      };

      const comparison: NormalizedAgentIngestDecision = {
        ...original,
        coreSummary: 'Better summary',
      };

      const originalContent = {
        title: 'Test',
        content: 'Test content',
        length: 100,
      };

      const result = await compareDecisions(original, comparison, originalContent);

      expect(result.originalScore.overallScore).toBe(75);
      expect(result.comparisonScore.overallScore).toBe(85);
      expect(result.scoreDiff).toBe(10);
      expect(result.winner).toBe('comparison');
    });
  });
});
```

**Step 2: 运行测试确认失败**

Run: `npm test src/lib/ai/agent/__tests__/comparison.test.ts`
Expected: FAIL with "Cannot find module '../comparison'"

**Step 3: 实现对比逻辑**

创建 `src/lib/ai/agent/comparison.ts`:

```typescript
import { evaluateDecisionQuality, type QualityEvaluation } from './scoring-agent';
import type { NormalizedAgentIngestDecision } from './ingest-contract';

export interface ComparisonResult {
  originalScore: QualityEvaluation;
  comparisonScore: QualityEvaluation;
  winner: 'original' | 'comparison' | 'tie';
  scoreDiff: number;
}

/**
 * Determine winner based on score difference
 * @param scoreDiff - Difference between comparison and original scores
 * @returns Winner designation
 */
export function determineWinner(scoreDiff: number): 'original' | 'comparison' | 'tie' {
  if (scoreDiff > 5) return 'comparison';
  if (scoreDiff < -5) return 'original';
  return 'tie';
}

/**
 * Compare two Agent decisions using scoring agent
 * @param original - Original mode decision
 * @param comparison - Comparison mode decision
 * @param originalContent - Original content for context
 * @returns Comparison result with scores and winner
 */
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
```

**Step 4: 运行测试确认通过**

Run: `npm test src/lib/ai/agent/__tests__/comparison.test.ts`
Expected: PASS (all tests passing)

**Step 5: Commit**

```bash
git add src/lib/ai/agent/comparison.ts src/lib/ai/agent/__tests__/comparison.test.ts
git commit -m "feat(agent): add decision comparison logic with scoring

- Add compareDecisions function for parallel evaluation
- Add determineWinner with ±5 threshold
- Add comprehensive unit tests

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Agent Engine 模式切换支持

**Files:**
- Modify: `src/lib/ai/agent/engine.ts`
- Create: `src/lib/ai/agent/__tests__/engine-mode-switch.test.ts`

**Step 1: 编写模式切换测试**

创建 `src/lib/ai/agent/__tests__/engine-mode-switch.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentEngine } from '../engine';
import type { ParseResult } from '../../../parser';

describe('AgentEngine mode switching', () => {
  let engine: AgentEngine;

  beforeEach(() => {
    engine = new AgentEngine();
  });

  it('should process with two-step mode when specified', async () => {
    const input: ParseResult = {
      title: 'Test',
      content: 'Test content',
      sourceType: 'LINK',
      length: 100,
    };

    const result = await engine.processWithMode('test-entry-id', input, 'two-step');

    expect(result).toBeDefined();
    expect(result.contentType).toBeDefined();
  });

  it('should process with tool-calling mode when specified', async () => {
    const input: ParseResult = {
      title: 'Test',
      content: 'Test content',
      sourceType: 'LINK',
      length: 100,
    };

    const result = await engine.processWithMode('test-entry-id', input, 'tool-calling');

    expect(result).toBeDefined();
    expect(result.contentType).toBeDefined();
  });

  it('should restore original config after processing', async () => {
    const originalUseToolCalling = engine.config.useToolCalling;

    const input: ParseResult = {
      title: 'Test',
      content: 'Test content',
      sourceType: 'LINK',
      length: 100,
    };

    await engine.processWithMode('test-entry-id', input, 'two-step');

    expect(engine.config.useToolCalling).toBe(originalUseToolCalling);
  });
});
```

**Step 2: 运行测试确认失败**

Run: `npm test src/lib/ai/agent/__tests__/engine-mode-switch.test.ts`
Expected: FAIL with "engine.processWithMode is not a function"

**Step 3: 在 AgentEngine 类中添加 processWithMode 方法**

在 `src/lib/ai/agent/engine.ts` 的 AgentEngine 类中添加：

```typescript
/**
 * Process entry with specific mode (for comparison testing)
 * @param entryId - Entry ID
 * @param input - Parsed content
 * @param mode - Mode to use ('two-step' | 'tool-calling')
 * @returns Normalized decision
 */
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

**Step 4: 运行测试确认通过**

Run: `npm test src/lib/ai/agent/__tests__/engine-mode-switch.test.ts`
Expected: PASS (all tests passing)

**Step 5: Commit**

```bash
git add src/lib/ai/agent/engine.ts src/lib/ai/agent/__tests__/engine-mode-switch.test.ts
git commit -m "feat(agent): add processWithMode for mode comparison

- Add processWithMode method to AgentEngine
- Support temporary mode override with config restoration
- Add unit tests for mode switching

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 4: API Route - 创建对比批次

**Files:**
- Create: `src/app/api/entries/compare-modes/route.ts`
- Create: `src/app/api/entries/compare-modes/__tests__/route.test.ts`

**Step 1: 编写 API 测试**

创建 `src/app/api/entries/compare-modes/__tests__/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../route';
import { prisma } from '@/lib/prisma';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    entry: {
      findMany: vi.fn(),
    },
    comparisonBatch: {
      create: vi.fn(),
    },
  },
}));

vi.mock('@/lib/inngest/client', () => ({
  inngest: {
    send: vi.fn(),
  },
}));

describe('POST /api/entries/compare-modes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create comparison batch and trigger Inngest event', async () => {
    const mockEntries = [
      { id: 'entry1', title: 'Entry 1' },
      { id: 'entry2', title: 'Entry 2' },
    ];

    vi.mocked(prisma.entry.findMany).mockResolvedValue(mockEntries as any);
    vi.mocked(prisma.comparisonBatch.create).mockResolvedValue({
      id: 'batch123',
      targetMode: 'tool-calling',
      entryCount: 2,
      status: 'pending',
      progress: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      stats: null,
    });

    const request = new Request('http://localhost:3000/api/entries/compare-modes', {
      method: 'POST',
      body: JSON.stringify({
        entryIds: ['entry1', 'entry2'],
        targetMode: 'tool-calling',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.batchId).toBe('batch123');
    expect(data.data.entryCount).toBe(2);
  });

  it('should return 400 if entryIds is empty', async () => {
    const request = new Request('http://localhost:3000/api/entries/compare-modes', {
      method: 'POST',
      body: JSON.stringify({
        entryIds: [],
        targetMode: 'tool-calling',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('entryIds');
  });

  it('should return 400 if targetMode is invalid', async () => {
    const request = new Request('http://localhost:3000/api/entries/compare-modes', {
      method: 'POST',
      body: JSON.stringify({
        entryIds: ['entry1'],
        targetMode: 'invalid-mode',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('targetMode');
  });
});
```

**Step 2: 运行测试确认失败**

Run: `npm test src/app/api/entries/compare-modes/__tests__/route.test.ts`
Expected: FAIL with "Cannot find module '../route'"

**Step 3: 实现 API Route**

创建 `src/app/api/entries/compare-modes/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { inngest } from '@/lib/inngest/client';

const RequestSchema = z.object({
  entryIds: z.array(z.string()).min(1, 'At least one entry ID is required'),
  targetMode: z.enum(['two-step', 'tool-calling'], {
    errorMap: () => ({ message: 'targetMode must be either two-step or tool-calling' }),
  }),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = RequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { entryIds, targetMode } = validation.data;

    // Verify all entries exist
    const entries = await prisma.entry.findMany({
      where: { id: { in: entryIds } },
      select: { id: true },
    });

    if (entries.length !== entryIds.length) {
      return NextResponse.json(
        { error: 'Some entry IDs do not exist' },
        { status: 404 }
      );
    }

    // Create comparison batch
    const batch = await prisma.comparisonBatch.create({
      data: {
        targetMode,
        entryCount: entryIds.length,
        status: 'pending',
        progress: 0,
      },
    });

    // Trigger Inngest event
    await inngest.send({
      name: 'comparison/process-batch',
      data: {
        batchId: batch.id,
        entryIds,
        targetMode,
      },
    });

    // Estimate time (rough: 30s per entry)
    const estimatedMinutes = Math.ceil((entryIds.length * 30) / 60);
    const estimatedTime = estimatedMinutes === 1 ? '约 1 分钟' : `约 ${estimatedMinutes} 分钟`;

    return NextResponse.json({
      data: {
        batchId: batch.id,
        entryCount: entryIds.length,
        estimatedTime,
      },
    });
  } catch (error) {
    console.error('Failed to create comparison batch:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

**Step 4: 运行测试确认通过**

Run: `npm test src/app/api/entries/compare-modes/__tests__/route.test.ts`
Expected: PASS (all tests passing)

**Step 5: Commit**

```bash
git add src/app/api/entries/compare-modes/
git commit -m "feat(api): add POST /api/entries/compare-modes endpoint

- Create comparison batch with validation
- Trigger Inngest event for async processing
- Add comprehensive unit tests

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 5: API Route - 查询批次状态

**Files:**
- Create: `src/app/api/entries/compare-modes/[batchId]/route.ts`
- Create: `src/app/api/entries/compare-modes/[batchId]/__tests__/route.test.ts`

**Step 1: 编写 API 测试**

创建测试文件并添加测试用例（测试获取批次状态、进度计算、统计数据）

**Step 2: 运行测试确认失败**

**Step 3: 实现 API Route**

实现 GET 端点，查询批次状态、进度、结果和统计数据

**Step 4: 运行测试确认通过**

**Step 5: Commit**

---

## Task 6: Inngest 函数 - 批量对比处理

**Files:**
- Create: `src/lib/inngest/functions/process-comparison-batch.ts`
- Create: `src/lib/inngest/functions/__tests__/process-comparison-batch.test.ts`

**Step 1: 编写 Inngest 函数测试**

创建测试文件，测试批量处理逻辑、进度更新、错误处理

**Step 2: 运行测试确认失败**

**Step 3: 实现 Inngest 函数**

实现批量对比处理逻辑：
- 遍历 entryIds
- 对每个 Entry 调用 Agent Engine 重新处理
- 调用 compareDecisions 评分
- 保存 ModeComparison 记录
- 更新批次进度
- 计算统计数据

**Step 4: 运行测试确认通过**

**Step 5: 注册 Inngest 函数**

在 `src/lib/inngest/client.ts` 中注册新函数

**Step 6: Commit**

---

## Task 7: 前端 Hook - useComparisonBatch

**Files:**
- Create: `src/hooks/useComparisonBatch.ts`
- Create: `src/hooks/__tests__/useComparisonBatch.test.ts`

**Step 1: 编写 Hook 测试**

**Step 2: 运行测试确认失败**

**Step 3: 实现 Hook**

使用 TanStack Query 实现：
- 创建批次 mutation
- 查询批次状态 query
- 轮询进度更新

**Step 4: 运行测试确认通过**

**Step 5: Commit**

---

## Task 8: 前端组件 - Library 批量操作

**Files:**
- Modify: `src/app/library/page.tsx`
- Create: `src/components/library/CompareModes Dialog.tsx`

**Step 1: 添加批量选择状态**

**Step 2: 添加"模式对比"按钮**

**Step 3: 实现模式选择弹窗**

**Step 4: 集成 useComparisonBatch Hook**

**Step 5: 手动测试**

**Step 6: Commit**

---

## Task 9: 前端页面 - 对比结果展示

**Files:**
- Create: `src/app/comparison/[batchId]/page.tsx`
- Create: `src/components/comparison/BatchStats.tsx`
- Create: `src/components/comparison/ComparisonList.tsx`

**Step 1: 实现批次统计组件**

**Step 2: 实现结果列表组件**

**Step 3: 实现主页面布局**

**Step 4: 添加进度展示**

**Step 5: 手动测试**

**Step 6: Commit**

---

## Task 10: 前端页面 - 详细对比视图

**Files:**
- Create: `src/app/comparison/[batchId]/entry/[entryId]/page.tsx`
- Create: `src/components/comparison/DecisionPanel.tsx`
- Create: `src/components/comparison/ScoreComparison.tsx`

**Step 1: 实现决策展示面板**

**Step 2: 实现评分对比组件**

**Step 3: 实现并排布局**

**Step 4: 添加差异高亮**

**Step 5: 手动测试**

**Step 6: Commit**

---

## Task 11: 集成测试

**Files:**
- Create: `src/__tests__/integration/mode-comparison.test.ts`

**Step 1: 编写端到端测试**

测试完整流程：
- 创建批次
- 等待处理完成
- 验证结果正确性

**Step 2: 运行测试**

**Step 3: 修复发现的问题**

**Step 4: Commit**

---

## Task 12: 文档与清理

**Files:**
- Update: `PROGRESS.md`
- Update: `docs/PROJECT_STATUS.md`
- Create: `docs/guides/mode-comparison-guide.md`

**Step 1: 更新项目进度**

**Step 2: 编写使用指南**

**Step 3: 清理调试代码**

**Step 4: 最终测试**

**Step 5: Commit**

```bash
git add .
git commit -m "docs: update progress and add mode comparison guide

- Mark mode comparison feature as completed
- Add user guide for mode comparison
- Update project status

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## 验收清单

- [ ] AC1: 可批量选择 Entry 并触发对比
- [ ] AC2: 对比任务异步执行，不阻塞 UI
- [ ] AC3: 对比结果正确保存到数据库
- [ ] AC4: 评分 Agent 正确对两份结果打分
- [ ] AC5: 统计数据准确（胜率、平均分差）
- [ ] AC6: 前端正确展示对比结果
- [ ] AC7: 详细对比页面并排展示清晰
- [ ] 所有单元测试通过
- [ ] 集成测试通过
- [ ] TypeScript 类型检查通过
- [ ] 代码已提交到 Git

---

**计划创建日期**: 2026-03-06
**预计工时**: 8-12 小时
