# Mode Comparison Frontend - Task 9: 对比结果展示页面

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 创建对比结果展示页面，显示批次进度、统计概览和结果列表

**Architecture:** 使用 Next.js App Router 动态路由，实现进度展示、统计卡片和结果列表组件

**Tech Stack:** Next.js 16, React 19, shadcn/ui, Tailwind CSS v4, Recharts, TypeScript

---

## Task 9: 前端页面 - 对比结果展示

### Step 1: 创建批次统计组件

**Files:**
- Create: `src/components/comparison/BatchStats.tsx`

创建统计卡片组件：

```typescript
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, Minus, Target, BarChart3 } from 'lucide-react';
import type { BatchStats as BatchStatsType } from '@/hooks/useComparisonBatch';

interface BatchStatsProps {
  stats: BatchStatsType;
  comparisonMode: string;
}

export function BatchStats({ stats, comparisonMode }: BatchStatsProps) {
  const totalComparisons = stats.originalWins + stats.comparisonWins + stats.ties;
  const comparisonWinRate = totalComparisons > 0
    ? ((stats.comparisonWins / totalComparisons) * 100).toFixed(1)
    : '0.0';

  const getScoreDiffColor = (diff: number) => {
    if (diff > 5) return 'text-green-600';
    if (diff < -5) return 'text-red-600';
    return 'text-gray-600';
  };

  const getScoreDiffIcon = (diff: number) => {
    if (diff > 5) return <TrendingUp className="h-4 w-4" />;
    if (diff < -5) return <TrendingDown className="h-4 w-4" />;
    return <Minus className="h-4 w-4" />;
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Win rate card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            {comparisonMode} 胜率
          </CardTitle>
          <Target className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{comparisonWinRate}%</div>
          <p className="text-xs text-muted-foreground">
            {stats.comparisonWins} 胜 / {stats.originalWins} 负 / {stats.ties} 平
          </p>
        </CardContent>
      </Card>

      {/* Average score diff card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">平均分差</CardTitle>
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold flex items-center gap-2 ${getScoreDiffColor(stats.avgScoreDiff)}`}>
            {getScoreDiffIcon(stats.avgScoreDiff)}
            {stats.avgScoreDiff > 0 ? '+' : ''}{stats.avgScoreDiff.toFixed(1)}
          </div>
          <p className="text-xs text-muted-foreground">
            {stats.avgScoreDiff > 0 ? '对比模式更优' : stats.avgScoreDiff < 0 ? '原始模式更优' : '两者相当'}
          </p>
        </CardContent>
      </Card>

      {/* Dimension breakdown - Completeness */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">完整性提升</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${getScoreDiffColor(stats.dimensionBreakdown.completeness)}`}>
            {stats.dimensionBreakdown.completeness > 0 ? '+' : ''}
            {stats.dimensionBreakdown.completeness.toFixed(1)}
          </div>
          <Progress
            value={50 + stats.dimensionBreakdown.completeness}
            className="mt-2"
          />
        </CardContent>
      </Card>

      {/* Dimension breakdown - Accuracy */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">准确性提升</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${getScoreDiffColor(stats.dimensionBreakdown.accuracy)}`}>
            {stats.dimensionBreakdown.accuracy > 0 ? '+' : ''}
            {stats.dimensionBreakdown.accuracy.toFixed(1)}
          </div>
          <Progress
            value={50 + stats.dimensionBreakdown.accuracy}
            className="mt-2"
          />
        </CardContent>
      </Card>
    </div>
  );
}
```

### Step 2: 创建结果列表组件

**Files:**
- Create: `src/components/comparison/ComparisonList.tsx`

创建结果列表组件：

```typescript
'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus, ExternalLink } from 'lucide-react';
import type { ModeComparisonResult } from '@/hooks/useComparisonBatch';

interface ComparisonListProps {
  results: ModeComparisonResult[];
  batchId: string;
}

export function ComparisonList({ results, batchId }: ComparisonListProps) {
  const getWinnerBadge = (winner: string) => {
    switch (winner) {
      case 'comparison':
        return <Badge variant="default" className="bg-green-600">对比模式胜出</Badge>;
      case 'original':
        return <Badge variant="secondary">原始模式胜出</Badge>;
      case 'tie':
        return <Badge variant="outline">平局</Badge>;
      default:
        return null;
    }
  };

  const getScoreDiffIcon = (diff: number) => {
    if (diff > 5) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (diff < -5) return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <Minus className="h-4 w-4 text-gray-600" />;
  };

  const getScoreDiffColor = (diff: number) => {
    if (diff > 5) return 'text-green-600';
    if (diff < -5) return 'text-red-600';
    return 'text-gray-600';
  };

  return (
    <div className="space-y-4">
      {results.map((result) => (
        <Link
          key={result.entryId}
          href={`/comparison/${batchId}/entry/${result.entryId}`}
        >
          <Card className="hover:bg-accent transition-colors cursor-pointer">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium line-clamp-1">
                      {result.entryTitle}
                    </h3>
                    <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </div>

                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>原始: {result.originalMode}</span>
                    <span>→</span>
                    <span>对比: {result.comparisonMode}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className={`text-lg font-bold flex items-center gap-1 ${getScoreDiffColor(result.scoreDiff)}`}>
                      {getScoreDiffIcon(result.scoreDiff)}
                      {result.scoreDiff > 0 ? '+' : ''}{result.scoreDiff.toFixed(1)}
                    </div>
                    <div className="text-xs text-muted-foreground">分差</div>
                  </div>

                  {getWinnerBadge(result.winner)}
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
```

### Step 3: 创建主页面

**Files:**
- Create: `src/app/comparison/[batchId]/page.tsx`

创建对比结果主页面：

```typescript
'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Loader2, ArrowLeft, RefreshCw } from 'lucide-react';
import { useComparisonBatch } from '@/hooks/useComparisonBatch';
import { BatchStats } from '@/components/comparison/BatchStats';
import { ComparisonList } from '@/components/comparison/ComparisonList';

interface PageProps {
  params: Promise<{ batchId: string }>;
}

export default function ComparisonBatchPage({ params }: PageProps) {
  const { batchId } = use(params);
  const router = useRouter();
  const { batchQuery, isProcessing, isCompleted, isFailed } = useComparisonBatch(batchId);

  const batchStatus = batchQuery.data;

  if (batchQuery.isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (batchQuery.isError) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <p className="text-lg text-muted-foreground">加载失败</p>
          <Button onClick={() => batchQuery.refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            重试
          </Button>
        </div>
      </div>
    );
  }

  if (!batchStatus) {
    return null;
  }

  const progressPercentage = batchStatus.entryCount > 0
    ? (batchStatus.completedCount / batchStatus.entryCount) * 100
    : 0;

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/library')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">模式对比结果</h1>
            <p className="text-sm text-muted-foreground">
              批次 ID: {batchId}
            </p>
          </div>
        </div>

        {isProcessing && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            处理中...
          </div>
        )}
      </div>

      {/* Progress section (when processing) */}
      {isProcessing && (
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">处理进度</h2>
              <p className="text-sm text-muted-foreground">
                {batchStatus.completedCount} / {batchStatus.entryCount} 已完成
              </p>
            </div>
            <div className="text-2xl font-bold">
              {progressPercentage.toFixed(0)}%
            </div>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>
      )}

      {/* Failed status */}
      {isFailed && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-6">
          <h2 className="text-lg font-semibold text-destructive">处理失败</h2>
          <p className="text-sm text-muted-foreground mt-2">
            批次处理过程中发生错误，请稍后重试。
          </p>
        </div>
      )}

      {/* Statistics (when completed) */}
      {isCompleted && batchStatus.stats && (
        <>
          <BatchStats
            stats={batchStatus.stats}
            comparisonMode={batchStatus.results?.[0]?.comparisonMode || 'tool-calling'}
          />

          {/* Results list */}
          {batchStatus.results && batchStatus.results.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">详细结果</h2>
              <ComparisonList
                results={batchStatus.results}
                batchId={batchId}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

### Step 4: 手动测试

测试场景：
1. 创建一个对比批次
2. 访问 `/comparison/[batchId]` 页面
3. 验证进度展示（processing 状态）
4. 等待处理完成
5. 验证统计卡片显示
6. 验证结果列表显示
7. 点击结果卡片跳转到详情页

### Step 5: TypeScript 类型检查

Run: `npx tsc --noEmit`
Expected: No errors

### Step 6: Commit

```bash
git add src/app/comparison/[batchId]/page.tsx src/components/comparison/BatchStats.tsx src/components/comparison/ComparisonList.tsx
git commit -m "feat(comparison): add batch result page with stats and list

- Create BatchStats component with win rate and dimension breakdown
- Create ComparisonList component with result cards
- Implement comparison batch page with progress tracking
- Support processing, completed, and failed states
- Auto-refresh when processing (via useComparisonBatch polling)
- Add navigation to detail page

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## 验收清单

- [ ] BatchStats 组件正确显示统计数据
- [ ] ComparisonList 组件正确显示结果列表
- [ ] 主页面正确处理 processing/completed/failed 状态
- [ ] 进度条正确显示处理进度
- [ ] 自动轮询更新（通过 useComparisonBatch）
- [ ] 点击结果卡片正确跳转
- [ ] 手动测试通过
- [ ] TypeScript 类型检查通过
- [ ] 代码已提交到 Git

---

**任务创建日期**: 2026-03-08
**预计工时**: 1.5-2 小时
**前置任务**: Task 7（useComparisonBatch Hook）
