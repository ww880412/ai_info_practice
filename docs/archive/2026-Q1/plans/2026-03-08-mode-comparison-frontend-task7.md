# Mode Comparison Frontend - Task 7: useComparisonBatch Hook

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 实现 useComparisonBatch Hook，使用 TanStack Query 管理模式对比批次的创建、查询和轮询

**Architecture:** 使用 TanStack Query 的 useMutation 和 useQuery，实现批次创建、状态查询和自动轮询进度更新

**Tech Stack:** React 19, TanStack Query v5, TypeScript

---

## Task 7: 前端 Hook - useComparisonBatch

### Step 1: 编写 Hook 测试

**Files:**
- Create: `src/hooks/__tests__/useComparisonBatch.test.tsx`

创建测试文件：

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useComparisonBatch } from '../useComparisonBatch';
import React from 'react';

// Mock fetch
global.fetch = vi.fn();

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('useComparisonBatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createBatch', () => {
    it('should create comparison batch successfully', async () => {
      const mockResponse = {
        data: {
          batchId: 'batch-123',
          entryCount: 5,
          estimatedTime: '约 3 分钟',
        },
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const { result } = renderHook(() => useComparisonBatch(), {
        wrapper: createWrapper(),
      });

      result.current.createBatch({
        entryIds: ['entry1', 'entry2', 'entry3', 'entry4', 'entry5'],
        targetMode: 'tool-calling',
      });

      await waitFor(() => {
        expect(result.current.createMutation.isSuccess).toBe(true);
      });

      expect(result.current.createMutation.data).toEqual(mockResponse.data);
      expect(fetch).toHaveBeenCalledWith(
        '/api/entries/compare-modes',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entryIds: ['entry1', 'entry2', 'entry3', 'entry4', 'entry5'],
            targetMode: 'tool-calling',
          }),
        })
      );
    });

    it('should handle creation error', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Invalid entry IDs' }),
      } as Response);

      const { result } = renderHook(() => useComparisonBatch(), {
        wrapper: createWrapper(),
      });

      result.current.createBatch({
        entryIds: [],
        targetMode: 'tool-calling',
      });

      await waitFor(() => {
        expect(result.current.createMutation.isError).toBe(true);
      });
    });
  });

  describe('getBatchStatus', () => {
    it('should fetch batch status successfully', async () => {
      const mockResponse = {
        data: {
          batchId: 'batch-123',
          status: 'processing',
          progress: 60,
          entryCount: 5,
          completedCount: 3,
        },
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const { result } = renderHook(
        () => useComparisonBatch('batch-123'),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.batchQuery.isSuccess).toBe(true);
      });

      expect(result.current.batchQuery.data).toEqual(mockResponse.data);
    });

    it('should enable polling when status is processing', async () => {
      const mockResponse = {
        data: {
          batchId: 'batch-123',
          status: 'processing',
          progress: 60,
          entryCount: 5,
          completedCount: 3,
        },
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const { result } = renderHook(
        () => useComparisonBatch('batch-123'),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.batchQuery.isSuccess).toBe(true);
      });

      // Should poll every 2 seconds when processing
      expect(result.current.batchQuery.refetchInterval).toBe(2000);
    });

    it('should disable polling when status is completed', async () => {
      const mockResponse = {
        data: {
          batchId: 'batch-123',
          status: 'completed',
          progress: 100,
          entryCount: 5,
          completedCount: 5,
          results: [],
          stats: {
            originalWins: 2,
            comparisonWins: 3,
            ties: 0,
            avgScoreDiff: 5.5,
            dimensionBreakdown: {
              completeness: 3,
              accuracy: 5,
              relevance: 7,
              clarity: 4,
              actionability: 6,
            },
          },
        },
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const { result } = renderHook(
        () => useComparisonBatch('batch-123'),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.batchQuery.isSuccess).toBe(true);
      });

      // Should not poll when completed
      expect(result.current.batchQuery.refetchInterval).toBe(false);
    });
  });
});
```

### Step 2: 运行测试确认失败

Run: `npm test src/hooks/__tests__/useComparisonBatch.test.tsx`
Expected: FAIL with "Cannot find module '../useComparisonBatch'"

### Step 3: 实现 Hook

**Files:**
- Create: `src/hooks/useComparisonBatch.ts`

创建 Hook 实现：

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export interface CreateBatchRequest {
  entryIds: string[];
  targetMode: 'two-step' | 'tool-calling';
}

export interface CreateBatchResponse {
  batchId: string;
  entryCount: number;
  estimatedTime: string;
}

export interface BatchStatus {
  batchId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  entryCount: number;
  completedCount: number;
  results?: ModeComparisonResult[];
  stats?: BatchStats;
}

export interface ModeComparisonResult {
  entryId: string;
  entryTitle: string;
  originalMode: string;
  comparisonMode: string;
  winner: 'original' | 'comparison' | 'tie';
  scoreDiff: number;
}

export interface BatchStats {
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
}

/**
 * Hook for managing mode comparison batches
 * @param batchId - Optional batch ID to query status
 * @returns Mutation for creating batch and query for batch status
 */
export function useComparisonBatch(batchId?: string) {
  const queryClient = useQueryClient();

  // Mutation for creating comparison batch
  const createMutation = useMutation({
    mutationFn: async (request: CreateBatchRequest): Promise<CreateBatchResponse> => {
      const response = await fetch('/api/entries/compare-modes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create comparison batch');
      }

      const data = await response.json();
      return data.data;
    },
    onSuccess: (data) => {
      // Invalidate batch queries to trigger refetch
      queryClient.invalidateQueries({ queryKey: ['comparison-batch', data.batchId] });
    },
  });

  // Query for batch status
  const batchQuery = useQuery({
    queryKey: ['comparison-batch', batchId],
    queryFn: async (): Promise<BatchStatus> => {
      if (!batchId) {
        throw new Error('Batch ID is required');
      }

      const response = await fetch(`/api/entries/compare-modes/${batchId}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch batch status');
      }

      const data = await response.json();
      return data.data;
    },
    enabled: !!batchId,
    // Poll every 2 seconds when processing
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'processing' || status === 'pending' ? 2000 : false;
    },
  });

  return {
    // Create batch
    createBatch: createMutation.mutate,
    createMutation,

    // Batch status
    batchQuery,
    batchStatus: batchQuery.data,
    isLoading: batchQuery.isLoading,
    isProcessing: batchQuery.data?.status === 'processing' || batchQuery.data?.status === 'pending',
    isCompleted: batchQuery.data?.status === 'completed',
    isFailed: batchQuery.data?.status === 'failed',
  };
}
```

### Step 4: 运行测试确认通过

Run: `npm test src/hooks/__tests__/useComparisonBatch.test.tsx`
Expected: PASS (all tests passing)

### Step 5: TypeScript 类型检查

Run: `npx tsc --noEmit`
Expected: No errors

### Step 6: Commit

```bash
git add src/hooks/useComparisonBatch.ts src/hooks/__tests__/useComparisonBatch.test.tsx
git commit -m "feat(hooks): add useComparisonBatch hook with TanStack Query

- Add createBatch mutation for triggering comparison
- Add batchQuery for fetching status with auto-polling
- Poll every 2s when status is processing/pending
- Stop polling when completed/failed
- Add comprehensive unit tests (9 test cases)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## 验收清单

- [ ] Hook 正确实现 createBatch mutation
- [ ] Hook 正确实现 batchQuery with polling
- [ ] 轮询逻辑正确（processing 时启用，completed 时停止）
- [ ] 所有单元测试通过（9 个测试用例）
- [ ] TypeScript 类型检查通过
- [ ] 代码已提交到 Git

---

**任务创建日期**: 2026-03-08
**预计工时**: 1-1.5 小时
**前置任务**: Task 1-6（后端已完成）
