# 实施计划：/comparison 页面重构

> 方案文档：docs/plans/2026-03-14-comparison-page-redesign.md
> 实施顺序：类型 → 查询层 → API → Hook → 组件 → 页面
> Codex 实施计划评审：0 P0 + 3 P1 + 3 P2，已处理

## Step 1: 新建类型文件

文件：`src/types/comparison.ts`（新建）

```typescript
export interface GlobalComparisonItem {
  id: string;
  createdAt: string;
  batchId: string;
  originalMode: string;
  comparisonMode: string;
  winner: string | null;
  scoreDiff: number;
  originalOverallScore: number | null;
  comparisonOverallScore: number | null;
  entryId: string;
  entryTitle: string | null;
  batchStatus: string;
}
```

验证：`npm run type-check` 通过（无消费者，纯类型文件）

## Step 2: 新建查询函数

文件：`src/lib/comparison/query-comparisons.ts`（新建）

核心逻辑：

```typescript
import { prisma } from '@/lib/prisma';
import { BatchStatus } from '@prisma/client';
import type { GlobalComparisonItem } from '@/types/comparison';

interface QueryComparisonsParams {
  limit: number;
  offset: number;
  status?: BatchStatus;
  winner?: string;
  modePair?: string;            // P1: 'two-step-vs-tool-calling' 格式
  sort?: 'createdAt';
  order?: 'asc' | 'desc';
}

interface QueryComparisonsResult {
  comparisons: GlobalComparisonItem[];
  total: number;
}

export async function queryComparisons(params: QueryComparisonsParams): Promise<QueryComparisonsResult> {
  const { limit, offset, status, winner, modePair, sort = 'createdAt', order = 'desc' } = params;

  // Step 1: 默认只查 COMPLETED/FAILED 的 batch（P1-2: 排除 PENDING/PROCESSING）
  const batchWhere: any = {};
  if (status) {
    batchWhere.status = status;
  } else {
    batchWhere.status = { in: ['COMPLETED', 'FAILED'] };
  }
  const batches = await prisma.comparisonBatch.findMany({
    where: batchWhere,
    select: { id: true, status: true },
  });
  if (batches.length === 0) return { comparisons: [], total: 0 };
  const batchIdFilter = batches.map(b => b.id);
  const statusMap = new Map(batches.map(b => [b.id, b.status]));

  // Step 2: 构建 ModeComparison where
  const where: any = { batchId: { in: batchIdFilter } };
  if (winner) where.winner = winner;
  // P1-1: Mode pair 过滤（格式 'two-step-vs-tool-calling'）
  if (modePair) {
    const [orig, comp] = modePair.split('-vs-');
    if (orig && comp) {
      where.originalMode = orig;
      where.comparisonMode = comp;
    }
  }

  // Step 3: 并行查询 findMany + count
  const [rows, total] = await Promise.all([
    prisma.modeComparison.findMany({
      where,
      select: {
        id: true, createdAt: true, batchId: true,
        originalMode: true, comparisonMode: true,
        originalScore: true, comparisonScore: true,
        winner: true, scoreDiff: true,
        entryId: true,
        entry: { select: { title: true } },
      },
      orderBy: [{ createdAt: order }, { id: 'desc' }], // 稳定排序
      take: limit,
      skip: offset,
    }),
    prisma.modeComparison.count({ where }),
  ]);

  // Step 4: statusMap 已在 Step 1 构建，直接使用

  // Step 5: 组装结果，提取 JSON overallScore
  const comparisons: GlobalComparisonItem[] = rows.map(row => {
    const origScore = row.originalScore as any;
    const compScore = row.comparisonScore as any;
    return {
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      batchId: row.batchId,
      originalMode: row.originalMode,
      comparisonMode: row.comparisonMode,
      winner: row.winner,
      scoreDiff: row.scoreDiff,
      originalOverallScore: origScore?.overallScore ?? null,
      comparisonOverallScore: compScore?.overallScore ?? null,
      entryId: row.entryId,
      entryTitle: row.entry.title,
      batchStatus: statusMap.get(row.batchId) ?? 'UNKNOWN',
    };
  });

  return { comparisons, total };
}
```

验证：`npm run type-check` 通过

## Step 3: 新建 API Route

文件：`src/app/api/comparisons/route.ts`（新建）

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { queryComparisons } from '@/lib/comparison/query-comparisons';

const QuerySchema = z.object({
  status: z.enum(['COMPLETED', 'FAILED']).optional(),
  winner: z.enum(['original', 'comparison', 'tie']).optional(),
  modePair: z.string().regex(/^[\w-]+-vs-[\w-]+$/).optional(),  // P1-1
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const validation = QuerySchema.safeParse({
      status: searchParams.get('status') ?? undefined,
      winner: searchParams.get('winner') ?? undefined,
      modePair: searchParams.get('modePair') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      offset: searchParams.get('offset') ?? undefined,
      order: searchParams.get('order') ?? undefined,
    });

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const query = validation.data;
    const result = await queryComparisons({
      limit: query.limit,
      offset: query.offset,
      status: query.status as any,
      winner: query.winner,
      modePair: query.modePair,
      order: query.order,
    });

    const hasNext = query.offset + query.limit < result.total;
    return NextResponse.json({
      data: {
        comparisons: result.comparisons,
        pageInfo: {
          total: result.total,
          limit: query.limit,
          offset: query.offset,
          hasNext,
          nextOffset: hasNext ? query.offset + query.limit : null,
        },
      },
    });
  } catch (error) {
    console.error('Get global comparisons error:', error);
    return NextResponse.json(
      { error: 'Failed to get comparisons' },
      { status: 500 }
    );
  }
}
```

验证：`npm run type-check` 通过

## Step 4: 新建 Hook

文件：`src/hooks/useGlobalComparisons.ts`（新建）

```typescript
"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { GlobalComparisonItem } from "@/types/comparison";

export interface GlobalComparisonFilters {
  status?: "COMPLETED" | "FAILED";
  winner?: "original" | "comparison" | "tie";
  modePair?: string;  // P1-1: 'two-step-vs-tool-calling'
}

export function useGlobalComparisons(
  initialComparisons: GlobalComparisonItem[],
  initialTotal: number
) {
  const [comparisons, setComparisons] = useState(initialComparisons);
  const [total, setTotal] = useState(initialTotal);
  const [filters, setFilters] = useState<GlobalComparisonFilters>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // filter 变更时重新请求
  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;

    const fetchFiltered = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("limit", "20");
        params.set("offset", "0");
        if (filters.status) params.set("status", filters.status);
        if (filters.winner) params.set("winner", filters.winner);
        if (filters.modePair) params.set("modePair", filters.modePair);

        const res = await fetch(`/api/comparisons?${params}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("Failed to fetch");
        const json = await res.json();
        setComparisons(json.data.comparisons);
        setTotal(json.data.pageInfo.total);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    };

    // 只在有 filter 时请求，初始数据由 SSR 提供
    if (filters.status || filters.winner || filters.modePair) {
      fetchFiltered();
    } else {
      setComparisons(initialComparisons);
      setTotal(initialTotal);
    }

    return () => controller.abort();
  }, [filters, initialComparisons, initialTotal]);

  const loadMore = useCallback(async () => {
    if (isLoading) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("limit", "20");
      params.set("offset", comparisons.length.toString());
      if (filters.status) params.set("status", filters.status);
      if (filters.winner) params.set("winner", filters.winner);
      if (filters.modePair) params.set("modePair", filters.modePair);

      const res = await fetch(`/api/comparisons?${params}`, {
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("Failed to load more");
      const json = await res.json();
      setComparisons(prev => [...prev, ...json.data.comparisons]);
      setTotal(json.data.pageInfo.total);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [comparisons.length, filters, isLoading]);

  const hasMore = comparisons.length < total;

  return { comparisons, total, isLoading, error, hasMore, loadMore, filters, setFilters };
}
```

验证：`npm run type-check` 通过

## Step 5: 新建 GlobalComparisonCard 组件

文件：`src/components/comparison/GlobalComparisonCard.tsx`（新建）

参考 `ComparisonCard.tsx` 的布局，但使用 `GlobalComparisonItem` 类型：

```typescript
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { GlobalComparisonItem } from "@/types/comparison";
import { Trophy, CheckCircle, XCircle, ArrowRight } from "lucide-react";

const modeLabels: Record<string, string> = {
  "two-step": "Two-Step",
  "tool-calling": "Tool Calling",
};

const formatScore = (score: number | null) =>
  score !== null ? score.toFixed(2) : "N/A";

export function GlobalComparisonCard({ item }: { item: GlobalComparisonItem }) {
  const router = useRouter();
  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleString("en-US", {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });

  return (
    <div
      className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => router.push(`/comparison/${item.batchId}`)}
    >
      {/* Entry Title */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <Link href={`/entry/${item.entryId}`}
            onClick={e => e.stopPropagation()}
            className="text-sm font-medium text-gray-900 hover:text-blue-600 line-clamp-1">
            {item.entryTitle || "未命名条目"}
          </Link>
          <div className="text-xs text-gray-500 mt-1">
            {formatDate(item.createdAt)}
          </div>
        </div>
        {item.winner && (
          <div className="flex items-center gap-1 px-2 py-1 bg-yellow-50 border border-yellow-200 rounded text-xs font-medium text-yellow-700">
            <Trophy size={12} />
            <span className="capitalize">{item.winner}</span>
          </div>
        )}
      </div>

      {/* Mode Comparison */}
      <div className="flex items-center gap-3 mb-3 text-sm">
        <div className="flex-1 px-3 py-2 bg-blue-50 rounded border border-blue-100">
          <div className="text-xs text-gray-600 mb-1">Original</div>
          <div className="font-medium text-blue-700">
            {modeLabels[item.originalMode] || item.originalMode}
          </div>
        </div>
        <ArrowRight size={16} className="text-gray-400 flex-shrink-0" />
        <div className="flex-1 px-3 py-2 bg-purple-50 rounded border border-purple-100">
          <div className="text-xs text-gray-600 mb-1">Comparison</div>
          <div className="font-medium text-purple-700">
            {modeLabels[item.comparisonMode] || item.comparisonMode}
          </div>
        </div>
      </div>

      {/* Scores */}
      <div className="flex items-center gap-3 mb-3 text-sm">
        <div className="flex-1">
          <div className="text-xs text-gray-600 mb-1">Original Score</div>
          <div className="text-lg font-semibold text-blue-600">
            {formatScore(item.originalOverallScore)}
          </div>
        </div>
        <div className="flex-1">
          <div className="text-xs text-gray-600 mb-1">Comparison Score</div>
          <div className="text-lg font-semibold text-purple-600">
            {formatScore(item.comparisonOverallScore)}
          </div>
        </div>
        <div className="flex-1">
          <div className="text-xs text-gray-600 mb-1">Difference</div>
          <div className={`text-lg font-semibold ${
            item.scoreDiff > 0 ? "text-green-600" :
            item.scoreDiff < 0 ? "text-red-600" : "text-gray-600"
          }`}>
            {item.scoreDiff > 0 ? "+" : ""}{formatScore(item.scoreDiff)}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <div className="flex items-center gap-2">
          {item.batchStatus === "COMPLETED" ? (
            <CheckCircle size={14} className="text-green-500" />
          ) : (
            <XCircle size={14} className="text-red-500" />
          )}
          <span className="text-xs text-gray-500">{item.batchStatus}</span>
        </div>
        <Link href={`/comparison/${item.batchId}`}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
          View Batch <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
```

验证：`npm run type-check` 通过

## Step 6: 新建 ComparisonHistoryList 组件

文件：`src/components/comparison/ComparisonHistoryList.tsx`（新建）

```typescript
"use client";

import { GlobalComparisonCard } from "./GlobalComparisonCard";
import { useGlobalComparisons } from "@/hooks/useGlobalComparisons";
import type { GlobalComparisonItem } from "@/types/comparison";
import { Loader2 } from "lucide-react";

interface Props {
  initialComparisons: GlobalComparisonItem[];
  initialTotal: number;
}

export function ComparisonHistoryList({ initialComparisons, initialTotal }: Props) {
  const {
    comparisons, total, isLoading, error, hasMore, loadMore, filters, setFilters,
  } = useGlobalComparisons(initialComparisons, initialTotal);

  // Filter bar
  const FilterBar = () => (
    <div className="flex gap-3 mb-6 flex-wrap">
      <select
        value={filters.status || ""}
        onChange={e => setFilters(f => ({ ...f, status: e.target.value as any || undefined }))}
        className="px-3 py-2 border border-gray-300 rounded-md text-sm"
      >
        <option value="">All Status</option>
        <option value="COMPLETED">Completed</option>
        <option value="FAILED">Failed</option>
      </select>
      <select
        value={filters.winner || ""}
        onChange={e => setFilters(f => ({ ...f, winner: e.target.value as any || undefined }))}
        className="px-3 py-2 border border-gray-300 rounded-md text-sm"
      >
        <option value="">All Winners</option>
        <option value="original">Original Wins</option>
        <option value="comparison">Comparison Wins</option>
        <option value="tie">Tie</option>
      </select>
      <select
        value={filters.modePair || ""}
        onChange={e => setFilters(f => ({ ...f, modePair: e.target.value || undefined }))}
        className="px-3 py-2 border border-gray-300 rounded-md text-sm"
      >
        <option value="">All Modes</option>
        <option value="two-step-vs-tool-calling">Two-Step vs Tool-Calling</option>
        <option value="tool-calling-vs-two-step">Tool-Calling vs Two-Step</option>
      </select>
    </div>
  );

  if (comparisons.length === 0 && !isLoading) {
    return (
      <>
        <FilterBar />
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No comparison results found</p>
          <p className="text-gray-400 text-sm mt-2">
            Start a comparison from the Library page
          </p>
        </div>
      </>
    );
  }

  return (
    <div>
      <FilterBar />
      <div className="grid gap-4">
        {comparisons.map(item => (
          <GlobalComparisonCard key={item.id} item={item} />
        ))}
      </div>

      {/* Pagination info + load more */}
      <div className="mt-6 text-center">
        <p className="text-sm text-gray-500 mb-3">
          Showing {comparisons.length} of {total}
        </p>
        {error && (
          <p className="text-sm text-red-500 mb-3">{error}</p>
        )}
        {hasMore && (
          <button
            onClick={loadMore}
            disabled={isLoading}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-md text-sm font-medium disabled:opacity-50"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" /> Loading...
              </span>
            ) : (
              "Load More"
            )}
          </button>
        )}
      </div>
    </div>
  );
}
```

验证：`npm run type-check` 通过

## Step 7: 修改 comparison page

文件：`src/app/comparison/page.tsx`（修改）

```diff
- import { queryBatches } from '@/lib/comparison/query-batches';
- import { BatchHistoryList } from '@/components/comparison/BatchHistoryList';
+ import { queryComparisons } from '@/lib/comparison/query-comparisons';
+ import { ComparisonHistoryList } from '@/components/comparison/ComparisonHistoryList';

  export const dynamic = 'force-dynamic';
  export const revalidate = 0;

  export default async function ComparisonPage() {
-   const result = await queryBatches({ limit: 10, offset: 0 });
-   const serializedBatches = result.batches.map((batch) => { ... });
+   const result = await queryComparisons({ limit: 20, offset: 0 });

    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Mode Comparison History</h1>
          <p className="text-secondary mt-2">
-           View and compare Agent processing results across different modes
+           Review and compare AI analysis results across different modes
          </p>
        </div>

-       <BatchHistoryList
-         initialBatches={serializedBatches}
-         initialTotal={result.total}
-       />
+       <ComparisonHistoryList
+         initialComparisons={result.comparisons}
+         initialTotal={result.total}
+       />
      </div>
    );
  }
```

## Step 8: 最终验证

```bash
# 1. 类型检查
docker compose exec app npm run type-check

# 2. Lint
docker compose exec app npm run lint

# 3. 现有测试不破坏
docker compose exec app npm run test

# 4. 手动验证
# - /comparison 页面显示条目级卡片
# - filter 下拉可用
# - load more 正常
# - /comparison/{batchId} 不受影响
# - entry detail 页面 ComparisonCard 不受影响
```

## 改动总结

| 步骤 | 文件 | 操作 | 依赖 |
|------|------|------|------|
| 1 | `src/types/comparison.ts` | 新建 | 无 |
| 2 | `src/lib/comparison/query-comparisons.ts` | 新建 | Step 1 |
| 3 | `src/app/api/comparisons/route.ts` | 新建 | Step 2 |
| 4 | `src/hooks/useGlobalComparisons.ts` | 新建 | Step 1 |
| 5 | `src/components/comparison/GlobalComparisonCard.tsx` | 新建 | Step 1 |
| 6 | `src/components/comparison/ComparisonHistoryList.tsx` | 新建 | Step 4, 5 |
| 7 | `src/app/comparison/page.tsx` | 修改 | Step 2, 6 |

新建 6 个文件，修改 1 个文件，不动任何现有文件（除 page.tsx 的 import 切换）。

## Codex 实施计划评审处理记录

| # | 级别 | 问题 | 处理 |
|---|------|------|------|
| P1-1 | 采纳 | 缺少 Mode 过滤链路 | 全链路加 modePair 参数（query/API/hook/UI） |
| P1-2 | 采纳 | batchStatus 范围不一致 | query 层默认只查 COMPLETED/FAILED |
| P1-3 | 不采纳 | 枚举映射缺失 | ModeComparison.originalMode 已是小写，无需映射 |
| P2-1 | 延后 | from/to/sort 过滤 | 本次不实现，后续按需补充 |
| P2-2 | 采纳 | 整卡点击跳转 | div onClick + router.push |
| P2-3 | 采纳 | 未使用 import | 移除 GlobalComparisonFilters import |
