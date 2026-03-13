# Mode Comparison Frontend - Task 10: 详细对比视图

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 创建详细对比视图页面，并排展示两种模式的决策结果和评分对比

**Architecture:** 使用 Next.js App Router 动态路由，实现并排布局、评分对比和差异高亮

**Tech Stack:** Next.js 16, React 19, shadcn/ui, Tailwind CSS v4, Recharts, TypeScript

---

## Task 10: 前端页面 - 详细对比视图

### Step 1: 创建决策展示面板组件

**Files:**
- Create: `src/components/comparison/DecisionPanel.tsx`

创建决策展示面板：

```typescript
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { NormalizedAgentIngestDecision } from '@/lib/ai/agent/ingest-contract';

interface DecisionPanelProps {
  title: string;
  decision: NormalizedAgentIngestDecision;
  mode: string;
}

export function DecisionPanel({ title, decision, mode }: DecisionPanelProps) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{title}</h2>
        <Badge variant="outline">{mode}</Badge>
      </div>

      {/* Content Type & Domain */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">分类信息</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">内容类型</span>
            <span className="font-medium">{decision.contentType}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">技术领域</span>
            <span className="font-medium">{decision.techDomain}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">难度</span>
            <span className="font-medium">{decision.difficulty}</span>
          </div>
        </CardContent>
      </Card>

      {/* Core Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">核心摘要</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed">{decision.coreSummary}</p>
        </CardContent>
      </Card>

      {/* Key Points */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">关键要点</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {decision.keyPoints.core.map((point, index) => (
              <li key={index} className="text-sm flex items-start gap-2">
                <span className="text-muted-foreground">•</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* AI Tags */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">AI 标签</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {decision.aiTags.map((tag, index) => (
              <Badge key={index} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Practice Task (if exists) */}
      {decision.practiceTask && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">实践任务</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="font-medium text-sm">{decision.practiceTask.title}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {decision.practiceTask.summary}
              </p>
            </div>
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span>难度: {decision.practiceTask.difficulty}</span>
              <span>预计: {decision.practiceTask.estimatedTime}</span>
            </div>
            {decision.practiceTask.steps && decision.practiceTask.steps.length > 0 && (
              <ol className="space-y-2 mt-3">
                {decision.practiceTask.steps.map((step, index) => (
                  <li key={index} className="text-sm flex items-start gap-2">
                    <span className="text-muted-foreground">{index + 1}.</span>
                    <span>{step.description}</span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

### Step 2: 创建评分对比组件

**Files:**
- Create: `src/components/comparison/ScoreComparison.tsx`

创建评分对比组件：

```typescript
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { QualityEvaluation } from '@/lib/ai/agent/scoring-agent';

interface ScoreComparisonProps {
  original: QualityEvaluation;
  comparison: QualityEvaluation;
  dimensions: string[];
}

export function ScoreComparison({ original, comparison, dimensions }: ScoreComparisonProps) {
  const getDimensionLabel = (dimension: string) => {
    const labels: Record<string, string> = {
      completeness: '完整性',
      accuracy: '准确性',
      relevance: '相关性',
      clarity: '清晰度',
      actionability: '可操作性',
    };
    return labels[dimension] || dimension;
  };

  const getDimensionScore = (evaluation: QualityEvaluation, dimension: string) => {
    return evaluation.dimensions[dimension as keyof typeof evaluation.dimensions] || 0;
  };

  const getScoreDiff = (dimension: string) => {
    const origScore = getDimensionScore(original, dimension);
    const compScore = getDimensionScore(comparison, dimension);
    return compScore - origScore;
  };

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

  const overallDiff = comparison.overallScore - original.overallScore;

  return (
    <div className="space-y-4">
      {/* Overall Score */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">总体评分</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">原始模式</div>
              <div className="text-2xl font-bold">{original.overallScore}</div>
            </div>
            <div className={`flex items-center gap-2 ${getScoreDiffColor(overallDiff)}`}>
              {getScoreDiffIcon(overallDiff)}
              <span className="text-xl font-bold">
                {overallDiff > 0 ? '+' : ''}{overallDiff.toFixed(1)}
              </span>
            </div>
            <div className="space-y-1 text-right">
              <div className="text-sm text-muted-foreground">对比模式</div>
              <div className="text-2xl font-bold">{comparison.overallScore}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dimension Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">维度对比</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {dimensions.map((dimension) => {
            const origScore = getDimensionScore(original, dimension);
            const compScore = getDimensionScore(comparison, dimension);
            const diff = getScoreDiff(dimension);

            // Skip if both scores are null (actionability for non-actionable entries)
            if (origScore === null && compScore === null) {
              return null;
            }

            return (
              <div key={dimension} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{getDimensionLabel(dimension)}</span>
                  <div className={`flex items-center gap-2 ${getScoreDiffColor(diff)}`}>
                    {getScoreDiffIcon(diff)}
                    <span className="font-medium">
                      {diff > 0 ? '+' : ''}{diff.toFixed(1)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span>原始</span>
                      <span>{origScore}</span>
                    </div>
                    <Progress value={origScore} className="h-2" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span>对比</span>
                      <span>{compScore}</span>
                    </div>
                    <Progress value={compScore} className="h-2" />
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Issues & Suggestions */}
      {(comparison.issues.length > 0 || comparison.suggestions.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">评分说明</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {comparison.issues.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">发现的问题</h4>
                <ul className="space-y-1">
                  {comparison.issues.map((issue, index) => (
                    <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span>•</span>
                      <span>{issue}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {comparison.suggestions.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">改进建议</h4>
                <ul className="space-y-1">
                  {comparison.suggestions.map((suggestion, index) => (
                    <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span>•</span>
                      <span>{suggestion}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

### Step 3: 创建详细对比页面

**Files:**
- Create: `src/app/comparison/[batchId]/entry/[entryId]/page.tsx`

创建详细对比页面：

```typescript
'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft } from 'lucide-react';
import { DecisionPanel } from '@/components/comparison/DecisionPanel';
import { ScoreComparison } from '@/components/comparison/ScoreComparison';

interface PageProps {
  params: Promise<{ batchId: string; entryId: string }>;
}

export default function ComparisonDetailPage({ params }: PageProps) {
  const { batchId, entryId } = use(params);
  const router = useRouter();

  // Fetch comparison detail
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDetail() {
      try {
        const response = await fetch(`/api/entries/compare-modes/${batchId}/results/${entryId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch comparison detail');
        }
        const result = await response.json();
        setData(result.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    }

    fetchDetail();
  }, [batchId, entryId]);

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <p className="text-lg text-muted-foreground">加载失败</p>
          <Button onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push(`/comparison/${batchId}`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{data.entryTitle}</h1>
          <p className="text-sm text-muted-foreground">
            {data.originalMode} vs {data.comparisonMode}
          </p>
        </div>
      </div>

      {/* Score Comparison */}
      <ScoreComparison
        original={data.originalScore}
        comparison={data.comparisonScore}
        dimensions={['completeness', 'accuracy', 'relevance', 'clarity', 'actionability']}
      />

      {/* Side-by-side Decision Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DecisionPanel
          title="原始模式"
          decision={data.originalDecision}
          mode={data.originalMode}
        />
        <DecisionPanel
          title="对比模式"
          decision={data.comparisonDecision}
          mode={data.comparisonMode}
        />
      </div>
    </div>
  );
}
```

### Step 4: 手动测试

测试场景：
1. 从对比结果列表点击某个 Entry
2. 访问 `/comparison/[batchId]/entry/[entryId]` 页面
3. 验证评分对比显示
4. 验证并排决策面板显示
5. 验证差异高亮
6. 点击返回按钮

### Step 5: TypeScript 类型检查

Run: `npx tsc --noEmit`
Expected: No errors

### Step 6: Commit

```bash
git add src/app/comparison/[batchId]/entry/[entryId]/page.tsx src/components/comparison/DecisionPanel.tsx src/components/comparison/ScoreComparison.tsx
git commit -m "feat(comparison): add detailed comparison view with side-by-side panels

- Create DecisionPanel component for displaying decision details
- Create ScoreComparison component with dimension breakdown
- Implement detailed comparison page with split view
- Support overall score and dimension-level comparison
- Display issues and suggestions from scoring agent
- Add navigation back to batch results

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## 验收清单

- [ ] DecisionPanel 组件正确显示决策详情
- [ ] ScoreComparison 组件正确显示评分对比
- [ ] 详细对比页面正确实现并排布局
- [ ] 维度对比正确显示差异
- [ ] 手动测试通过
- [ ] TypeScript 类型检查通过
- [ ] 代码已提交到 Git

---

**任务创建日期**: 2026-03-08
**预计工时**: 1.5-2 小时
**前置任务**: Task 7（useComparisonBatch Hook）
