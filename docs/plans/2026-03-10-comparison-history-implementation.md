# Comparison History List - Implementation Plan

> **Version**: 1.0
> **Date**: 2026-03-10
> **Status**: Ready for Execution (Codex Approved)
> **Design Doc**: [2026-03-10-comparison-history-list.md](./2026-03-10-comparison-history-list.md)

## 1. Overview

This implementation plan breaks down the comparison history list feature into discrete, testable tasks with clear acceptance criteria.

**Estimated Total Time**: 10-12 hours (updated)

**Implementation Order**:
1. Database migration (1h)
2. Update batch creation logic (1h) **← NEW**
3. Shared query function (1h)
4. API route (2h)
5. Page component (2h)
6. Navigation integration (1h)
7. Testing & QA (2-3h)

---

## 2. Task Breakdown

### Task 1: Database Schema Migration

**Objective**: Update ComparisonBatch model with enums and new fields

**Files**:
- `prisma/schema.prisma`
- `prisma/migrations/YYYYMMDDHHMMSS_add_comparison_batch_enums/migration.sql`

**Steps**:

1. **Update schema.prisma**:
```prisma
// Add enums
enum ComparisonMode {
  TWO_STEP
  TOOL_CALLING
}

enum BatchStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
}

// Update ComparisonBatch model
model ComparisonBatch {
  id          String   @id @default(cuid())
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Comparison modes (nullable for migration, will be made required after backfill)
  sourceMode  ComparisonMode?  // Baseline mode
  targetMode  ComparisonMode?  // Comparison mode

  entryCount  Int
  status      BatchStatus     @default(PENDING)
  progress    Int             @default(0)  // Percentage: 0-100
  processedCount Int          @default(0)  // Actual processed entries

  // Statistics
  winRate     Float?
  avgScoreDiff Float?
  stats       Json?

  @@index([status])
  @@index([createdAt, id])  // Composite index for stable sorting
}
```

**Note**: `sourceMode` and `targetMode` are nullable initially to allow migration. After backfill, we'll create a second migration to make them required.

2. **Generate migration**:
```bash
docker compose exec app npx prisma migrate dev --name add_comparison_batch_enums
```

3. **Backfill existing data** (if any):
```typescript
// scripts/backfill-comparison-batches.ts
import { prisma } from '@/lib/prisma';

async function backfill() {
  const batches = await prisma.comparisonBatch.findMany({
    where: { sourceMode: null },
  });

  console.log(`Found ${batches.length} batches to backfill`);

  for (const batch of batches) {
    // Map old string values to enum values
    const targetModeEnum = batch.targetMode === 'tool-calling'
      ? 'TOOL_CALLING'
      : 'TWO_STEP';

    // Infer sourceMode from targetMode (opposite)
    const sourceModeEnum = targetModeEnum === 'TOOL_CALLING'
      ? 'TWO_STEP'
      : 'TOOL_CALLING';

    // Recalculate winRate/avgScoreDiff from stats if available
    const stats = batch.stats as any;
    const winRate = stats?.winRate ?? null;
    const avgScoreDiff = stats?.avgScoreDiff ?? null;

    await prisma.comparisonBatch.update({
      where: { id: batch.id },
      data: {
        sourceMode: sourceModeEnum,
        targetMode: targetModeEnum,
        winRate,
        avgScoreDiff,
      },
    });

    console.log(`Backfilled batch ${batch.id}`);
  }

  console.log('Backfill complete');
}

backfill()
  .catch((e) => {
    console.error('Backfill failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

**Run backfill**:
```bash
docker compose exec app npx tsx scripts/backfill-comparison-batches.ts
```

4. **Make fields required** (second migration):
```prisma
// After backfill, update schema.prisma
model ComparisonBatch {
  // ...
  sourceMode  ComparisonMode  // Remove ? to make required
  targetMode  ComparisonMode  // Remove ? to make required
  // ...
}
```

```bash
docker compose exec app npx prisma migrate dev --name make_comparison_modes_required
```

**Acceptance Criteria**:
- [ ] Migration runs successfully
- [ ] Enums are created
- [ ] New fields exist with correct types (nullable initially)
- [ ] Indexes are created
- [ ] Backfill script runs successfully
- [ ] Second migration makes fields required
- [ ] `npx prisma generate` succeeds

**Estimated Time**: 1.5 hours (increased due to two-step migration)

---

### Task 2: Update Batch Creation Logic

**Objective**: Ensure new batches write all required fields

**Files**:
- `src/app/api/comparison/ingest/route.ts` (or wherever batches are created)
- `src/lib/inngest/functions/create-comparison-batch.ts` (if exists)

**Implementation**:

```typescript
// Example: Update batch creation to include new fields
await prisma.comparisonBatch.create({
  data: {
    sourceMode: 'TWO_STEP',  // ← NEW: Must specify
    targetMode: 'TOOL_CALLING',  // ← NEW: Must specify
    entryCount: entries.length,
    status: 'PENDING',
    progress: 0,
    processedCount: 0,  // ← NEW: Initialize to 0
    // ... other fields
  },
});
```

**Update batch progress**:
```typescript
// When processing entries, update both progress and processedCount
await prisma.comparisonBatch.update({
  where: { id: batchId },
  data: {
    processedCount: { increment: 1 },
    progress: Math.round((processedCount / entryCount) * 100),
  },
});
```

**Acceptance Criteria**:
- [ ] All batch creation calls include sourceMode/targetMode
- [ ] processedCount is initialized and updated correctly
- [ ] progress is calculated from processedCount
- [ ] Existing batch creation tests updated

**Estimated Time**: 1 hour

---

### Task 3: Shared Query Function

**Objective**: Create reusable query function for consistent data fetching

**Files**:
- `src/lib/comparison/query-batches.ts` (new)
- `src/lib/comparison/query-batches.test.ts` (new)

**Implementation**:

```typescript
// src/lib/comparison/query-batches.ts
import { prisma } from '@/lib/prisma';
import { BatchStatus } from '@prisma/client';

export interface QueryBatchesParams {
  limit: number;
  offset: number;
  status?: BatchStatus;
}

export interface QueryBatchesResult {
  batches: Array<{
    id: string;
    createdAt: Date;
    sourceMode: string;
    targetMode: string;
    entryCount: number;
    status: string;
    progress: number;
    processedCount: number;
    winRate: number | null;
    avgScoreDiff: number | null;
    stats: any;
  }>;
  total: number;
}

export async function queryBatches(
  params: QueryBatchesParams
): Promise<QueryBatchesResult> {
  const { limit, offset, status } = params;

  const where = status ? { status } : undefined;

  const [batches, total] = await Promise.all([
    prisma.comparisonBatch.findMany({
      where,
      select: {
        id: true,
        createdAt: true,
        sourceMode: true,
        targetMode: true,
        entryCount: true,
        status: true,
        progress: true,
        processedCount: true,
        winRate: true,
        avgScoreDiff: true,
        stats: true,
      },
      orderBy: [
        { createdAt: 'desc' },
        { id: 'desc' },  // Stable sort
      ],
      take: limit,
      skip: offset,
    }),
    prisma.comparisonBatch.count({ where }),
  ]);

  return { batches, total };
}
```

**Tests**:

```typescript
// src/lib/comparison/query-batches.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { queryBatches } from './query-batches';
import { prisma } from '@/lib/prisma';

describe('queryBatches', () => {
  beforeEach(async () => {
    // Clean up
    await prisma.comparisonBatch.deleteMany();
  });

  it('should return empty array when no batches exist', async () => {
    const result = await queryBatches({ limit: 20, offset: 0 });
    expect(result.batches).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('should return batches sorted by createdAt desc', async () => {
    // Create test batches
    const batch1 = await prisma.comparisonBatch.create({
      data: {
        sourceMode: 'TWO_STEP',
        targetMode: 'TOOL_CALLING',
        entryCount: 5,
        status: 'COMPLETED',
      },
    });

    const batch2 = await prisma.comparisonBatch.create({
      data: {
        sourceMode: 'TOOL_CALLING',
        targetMode: 'TWO_STEP',
        entryCount: 10,
        status: 'PENDING',
      },
    });

    const result = await queryBatches({ limit: 20, offset: 0 });
    expect(result.batches).toHaveLength(2);
    expect(result.batches[0].id).toBe(batch2.id); // Newer first
    expect(result.total).toBe(2);
  });

  it('should filter by status', async () => {
    await prisma.comparisonBatch.create({
      data: {
        sourceMode: 'TWO_STEP',
        targetMode: 'TOOL_CALLING',
        entryCount: 5,
        status: 'COMPLETED',
      },
    });

    await prisma.comparisonBatch.create({
      data: {
        sourceMode: 'TWO_STEP',
        targetMode: 'TOOL_CALLING',
        entryCount: 10,
        status: 'PENDING',
      },
    });

    const result = await queryBatches({
      limit: 20,
      offset: 0,
      status: 'COMPLETED',
    });

    expect(result.batches).toHaveLength(1);
    expect(result.batches[0].status).toBe('COMPLETED');
    expect(result.total).toBe(1);
  });

  it('should respect limit and offset', async () => {
    // Create 5 batches
    for (let i = 0; i < 5; i++) {
      await prisma.comparisonBatch.create({
        data: {
          sourceMode: 'TWO_STEP',
          targetMode: 'TOOL_CALLING',
          entryCount: i,
          status: 'COMPLETED',
        },
      });
    }

    const page1 = await queryBatches({ limit: 2, offset: 0 });
    expect(page1.batches).toHaveLength(2);
    expect(page1.total).toBe(5);

    const page2 = await queryBatches({ limit: 2, offset: 2 });
    expect(page2.batches).toHaveLength(2);
    expect(page2.total).toBe(5);

    // Ensure no overlap
    expect(page1.batches[0].id).not.toBe(page2.batches[0].id);
  });
});
```

**Acceptance Criteria**:
- [ ] Function returns correct data structure
- [ ] Sorting is stable (createdAt + id)
- [ ] Filtering by status works
- [ ] Pagination works correctly
- [ ] All tests pass

**Estimated Time**: 1 hour

---

### Task 4: API Route

**Objective**: Create GET /api/comparison/batches endpoint

**Files**:
- `src/app/api/comparison/batches/route.ts` (new)
- `src/app/api/comparison/batches/route.test.ts` (new)

**Implementation**:

```typescript
// src/app/api/comparison/batches/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { queryBatches } from '@/lib/comparison/query-batches';
import { BatchStatus } from '@prisma/client';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse and validate query params
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');
    const statusParam = searchParams.get('status');

    // Robust parsing with NaN handling
    let limit = DEFAULT_LIMIT;
    if (limitParam) {
      const parsed = parseInt(limitParam, 10);
      if (!isNaN(parsed)) {
        limit = Math.min(Math.max(parsed, 1), MAX_LIMIT);
      }
    }

    let offset = 0;
    if (offsetParam) {
      const parsed = parseInt(offsetParam, 10);
      if (!isNaN(parsed) && parsed >= 0) {
        offset = parsed;
      }
    }

    // Validate status enum
    let status: BatchStatus | undefined;
    if (statusParam) {
      if (!['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'].includes(statusParam)) {
        return NextResponse.json(
          {
            error: {
              code: 'INVALID_PARAMS',
              message: 'status must be one of: PENDING, PROCESSING, COMPLETED, FAILED',
            },
          },
          { status: 400 }
        );
      }
      status = statusParam as BatchStatus;
    }

    // Query batches
    const { batches, total } = await queryBatches({ limit, offset, status });

    // Calculate pagination info
    const hasNext = offset + batches.length < total;
    const nextOffset = hasNext ? offset + limit : null;

    return NextResponse.json({
      data: {
        batches: batches.map((batch) => ({
          ...batch,
          createdAt: batch.createdAt.toISOString(),
        })),
        pageInfo: {
          total,
          limit,
          offset,
          hasNext,
          nextOffset,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching comparison batches:', error);
    return NextResponse.json(
      {
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to fetch comparison batches',
        },
      },
      { status: 500 }
    );
  }
}
```

**Tests**:

```typescript
// src/app/api/comparison/batches/route.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { GET } from './route';
import { prisma } from '@/lib/prisma';

describe('GET /api/comparison/batches', () => {
  beforeEach(async () => {
    await prisma.comparisonBatch.deleteMany();
  });

  it('should return empty array when no batches exist', async () => {
    const request = new Request('http://localhost:3000/api/comparison/batches');
    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.batches).toEqual([]);
    expect(data.data.pageInfo.total).toBe(0);
  });

  it('should return batches with pagination info', async () => {
    // Create test batch
    await prisma.comparisonBatch.create({
      data: {
        sourceMode: 'TWO_STEP',
        targetMode: 'TOOL_CALLING',
        entryCount: 5,
        status: 'COMPLETED',
      },
    });

    const request = new Request('http://localhost:3000/api/comparison/batches');
    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.batches).toHaveLength(1);
    expect(data.data.pageInfo).toMatchObject({
      total: 1,
      limit: 20,
      offset: 0,
      hasNext: false,
      nextOffset: null,
    });
  });

  it('should validate limit parameter', async () => {
    const request = new Request(
      'http://localhost:3000/api/comparison/batches?limit=200'
    );
    const response = await GET(request as any);
    const data = await response.json();

    expect(data.data.pageInfo.limit).toBe(100); // Clamped to MAX_LIMIT
  });

  it('should return 400 for invalid status', async () => {
    const request = new Request(
      'http://localhost:3000/api/comparison/batches?status=INVALID'
    );
    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe('INVALID_PARAMS');
  });

  it('should handle NaN limit gracefully', async () => {
    const request = new Request(
      'http://localhost:3000/api/comparison/batches?limit=abc'
    );
    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.pageInfo.limit).toBe(20); // Falls back to default
  });

  it('should handle negative offset gracefully', async () => {
    const request = new Request(
      'http://localhost:3000/api/comparison/batches?offset=-10'
    );
    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.pageInfo.offset).toBe(0); // Falls back to 0
  });

  it('should filter by status', async () => {
    await prisma.comparisonBatch.create({
      data: {
        sourceMode: 'TWO_STEP',
        targetMode: 'TOOL_CALLING',
        entryCount: 5,
        status: 'COMPLETED',
      },
    });

    await prisma.comparisonBatch.create({
      data: {
        sourceMode: 'TWO_STEP',
        targetMode: 'TOOL_CALLING',
        entryCount: 10,
        status: 'PENDING',
      },
    });

    const request = new Request(
      'http://localhost:3000/api/comparison/batches?status=COMPLETED'
    );
    const response = await GET(request as any);
    const data = await response.json();

    expect(data.data.batches).toHaveLength(1);
    expect(data.data.batches[0].status).toBe('COMPLETED');
  });
});
```

**Acceptance Criteria**:
- [ ] Endpoint returns correct data structure
- [ ] Query parameter validation works
- [ ] Error responses have correct format
- [ ] Pagination info is accurate
- [ ] All tests pass

**Estimated Time**: 2 hours

---

### Task 5: Page Component

**Objective**: Create /comparison page with batch list

**Files**:
- `src/app/comparison/page.tsx` (new)
- `src/components/comparison/BatchHistoryList.tsx` (new)
- `src/components/comparison/BatchCard.tsx` (new)
- `src/components/comparison/BatchHistoryList.test.tsx` (new)

**Implementation**:

```typescript
// src/app/comparison/page.tsx
import { queryBatches } from '@/lib/comparison/query-batches';
import { BatchHistoryList } from '@/components/comparison/BatchHistoryList';

// Force dynamic rendering to always fetch fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ComparisonHistoryPage() {
  const { batches, total } = await queryBatches({
    limit: 20,
    offset: 0,
  });

  // Serialize dates to strings for client component
  const serializedBatches = batches.map((batch) => ({
    ...batch,
    createdAt: batch.createdAt.toISOString(),
  }));

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Comparison History</h1>
      <BatchHistoryList
        initialBatches={serializedBatches}
        initialTotal={total}
      />
    </div>
  );
}
```

```typescript
// src/components/comparison/BatchHistoryList.tsx
'use client';

import { useState } from 'react';
import { BatchCard } from './BatchCard';
import { Loader2 } from 'lucide-react';

interface Batch {
  id: string;
  createdAt: string;  // ISO 8601 string (not Date)
  sourceMode: string;
  targetMode: string;
  entryCount: number;
  status: string;
  progress: number;
  processedCount: number;
  winRate: number | null;
  avgScoreDiff: number | null;
}

interface BatchHistoryListProps {
  initialBatches: Batch[];
  initialTotal: number;
}

export function BatchHistoryList({
  initialBatches,
  initialTotal,
}: BatchHistoryListProps) {
  const [batches, setBatches] = useState(initialBatches);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasMore = batches.length < total;

  async function loadMore() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/comparison/batches?limit=20&offset=${batches.length}`
      );

      if (!response.ok) {
        throw new Error('Failed to load more batches');
      }

      const data = await response.json();
      setBatches([...batches, ...data.data.batches]);
      setTotal(data.data.pageInfo.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  if (batches.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-4">
          No comparison batches yet.
        </p>
        <a
          href="/library"
          className="text-blue-600 hover:underline"
        >
          Go to Library to create one
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {batches.map((batch) => (
        <BatchCard key={batch.id} batch={batch} />
      ))}

      {error && (
        <div className="text-center py-4">
          <p className="text-red-600 mb-2">{error}</p>
          <button
            onClick={loadMore}
            className="text-blue-600 hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      {hasMore && !error && (
        <div className="text-center py-4">
          <button
            onClick={loadMore}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="inline w-4 h-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              'Load More'
            )}
          </button>
        </div>
      )}
    </div>
  );
}
```

```typescript
// src/components/comparison/BatchCard.tsx
'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

interface BatchCardProps {
  batch: {
    id: string;
    createdAt: string;  // ISO 8601 string
    sourceMode: string;
    targetMode: string;
    entryCount: number;
    status: string;
    progress: number;
    processedCount: number;
    winRate: number | null;
    avgScoreDiff: number | null;
  };
}

const STATUS_CONFIG = {
  PENDING: { icon: '⏳', color: 'text-gray-600', bg: 'bg-gray-100' },
  PROCESSING: { icon: '🔄', color: 'text-blue-600', bg: 'bg-blue-100' },
  COMPLETED: { icon: '✅', color: 'text-green-600', bg: 'bg-green-100' },
  FAILED: { icon: '⚠️', color: 'text-red-600', bg: 'bg-red-100' },
};

export function BatchCard({ batch }: BatchCardProps) {
  const statusConfig = STATUS_CONFIG[batch.status as keyof typeof STATUS_CONFIG];
  const createdAt = new Date(batch.createdAt);

  return (
    <Link
      href={`/comparison/${batch.id}`}
      className="block p-4 border rounded-lg hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="font-semibold text-lg mb-2">
            {batch.sourceMode} vs {batch.targetMode}
          </h3>

          <div className="text-sm text-gray-600 space-y-1">
            <p>
              Created: {formatDistanceToNow(createdAt, { addSuffix: true })}
            </p>
            <p>
              Entries: {batch.entryCount} | Progress: {batch.progress}% (
              {batch.processedCount}/{batch.entryCount} processed)
            </p>
            {batch.winRate !== null && (
              <p>
                Win Rate: {batch.winRate.toFixed(1)}% | Avg Diff:{' '}
                {batch.avgScoreDiff !== null
                  ? batch.avgScoreDiff > 0
                    ? `+${batch.avgScoreDiff.toFixed(2)}`
                    : batch.avgScoreDiff.toFixed(2)
                  : 'N/A'}
              </p>
            )}
          </div>
        </div>

        <div
          className={`px-3 py-1 rounded-full text-sm ${statusConfig.bg} ${statusConfig.color}`}
        >
          {statusConfig.icon} {batch.status}
        </div>
      </div>
    </Link>
  );
}
```

**Tests**:

```typescript
// src/components/comparison/BatchHistoryList.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { BatchHistoryList } from './BatchHistoryList';

describe('BatchHistoryList', () => {
  it('should show empty state when no batches', () => {
    render(<BatchHistoryList initialBatches={[]} initialTotal={0} />);
    expect(screen.getByText(/No comparison batches yet/i)).toBeInTheDocument();
  });

  it('should render batch cards', () => {
    const batches = [
      {
        id: '1',
        createdAt: new Date().toISOString(),  // String, not Date
        sourceMode: 'TWO_STEP',
        targetMode: 'TOOL_CALLING',
        entryCount: 10,
        status: 'COMPLETED',
        progress: 100,
        processedCount: 10,
        winRate: 60,
        avgScoreDiff: 0.15,
        stats: null,
      },
    ];

    render(<BatchHistoryList initialBatches={batches} initialTotal={1} />);
    expect(screen.getByText(/TWO_STEP vs TOOL_CALLING/i)).toBeInTheDocument();
  });

  it('should show load more button when hasMore', () => {
    const batches = [
      {
        id: '1',
        createdAt: new Date().toISOString(),
        sourceMode: 'TWO_STEP',
        targetMode: 'TOOL_CALLING',
        entryCount: 10,
        status: 'COMPLETED',
        progress: 100,
        processedCount: 10,
        winRate: 60,
        avgScoreDiff: 0.15,
        stats: null,
      },
    ];

    render(<BatchHistoryList initialBatches={batches} initialTotal={50} />);
    expect(screen.getByText(/Load More/i)).toBeInTheDocument();
  });

  it('should handle load more click', async () => {
    const user = userEvent.setup();

    render(
      <BatchHistoryList
        initialBatches={[]}
        initialTotal={50}
      />
    );

    // Mock fetch
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          data: {
            batches: [{
              id: '2',
              createdAt: new Date().toISOString(),
              sourceMode: 'TWO_STEP',
              targetMode: 'TOOL_CALLING',
              entryCount: 5,
              status: 'COMPLETED',
              progress: 100,
              processedCount: 5,
              winRate: 50,
              avgScoreDiff: 0.1,
              stats: null,
            }],
            pageInfo: { total: 50, hasNext: true },
          },
        }),
      })
    ) as any;

    const button = screen.getByText(/Load More/i);
    await user.click(button);

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/comparison/batches?limit=20&offset=0'
    );
  });
});
});
```

**Acceptance Criteria**:
- [ ] Page renders correctly
- [ ] Empty state shows when no batches
- [ ] Batch cards display all required info
- [ ] Load More button works
- [ ] Error handling works
- [ ] All tests pass

**Known Limitations (to be addressed in future iterations)**:
- No loading skeleton (shows empty state during initial load)
- No progress bar for PROCESSING status (only shows percentage)
- No special UI for FAILED status click (navigates to detail page)
- Timestamps show relative time, not explicit local timezone label

**Estimated Time**: 2.5 hours (increased due to serialization handling)

---

### Task 6: Navigation Integration

**Objective**: Add navigation link and toast notification

**Files**:
- `src/components/common/Navbar.tsx` (modify)
- `src/app/library/page.tsx` or comparison trigger component (modify)

**Implementation**:

```typescript
// src/components/common/Navbar.tsx
// Add link between Practice and Settings
<Link
  href="/comparison"
  className="text-gray-700 hover:text-gray-900"
>
  Comparison History
</Link>
```

```typescript
// In comparison trigger component (after batch creation)
import { toast } from 'sonner'; // or your toast library

// After successful batch creation
toast.success(
  <div>
    Comparison batch created!{' '}
    <Link
      href={`/comparison/${batchId}`}
      className="underline"
    >
      View Results
    </Link>
  </div>
);
```

**Acceptance Criteria**:
- [ ] Navigation link appears in navbar
- [ ] Link navigates to /comparison
- [ ] Toast shows after batch creation
- [ ] Toast link navigates to batch detail

**Estimated Time**: 1 hour

---

### Task 7: Testing & QA

**Objective**: Comprehensive testing and quality assurance

**Steps**:

1. **Run all tests**:
```bash
docker compose exec app npm run test:run
```

2. **Type check**:
```bash
docker compose exec app npm run type-check
```

3. **Lint**:
```bash
docker compose exec app npm run lint
```

4. **Manual testing checklist**:
- [ ] Create a new comparison batch
- [ ] Navigate to /comparison
- [ ] Verify batch appears in list
- [ ] Click batch card, verify navigation
- [ ] Test Load More button (if >20 batches)
- [ ] Test empty state (delete all batches)
- [ ] Test different status badges
- [ ] Test failed batch display
- [ ] Verify timestamps are in local timezone
- [ ] Test responsive layout (mobile/desktop)

5. **Performance testing**:
- [ ] Page loads in <1s
- [ ] API response time <100ms
- [ ] No console errors
- [ ] No memory leaks

**Acceptance Criteria**:
- [ ] All unit tests pass
- [ ] Type check passes
- [ ] Lint passes
- [ ] Manual testing checklist complete
- [ ] Performance metrics met

**Note**: Integration tests are covered by unit tests of individual components and API routes. End-to-end testing will be added in a future iteration.

**Estimated Time**: 2-3 hours

---

## 3. Rollout Plan

### 3.1 Pre-deployment Checklist
- [ ] All tests passing
- [ ] Code reviewed (Codex)
- [ ] Database migration tested locally
- [ ] No breaking changes to existing features

### 3.2 Deployment Steps
1. Merge feature branch to main
2. Run database migration in production
3. Deploy application
4. Verify /comparison page loads
5. Monitor for errors

### 3.3 Rollback Plan
If issues occur:
1. Revert application deployment
2. Database migration is additive (no rollback needed)
3. Monitor error logs

---

## 4. Success Criteria

- [ ] Users can view all historical comparison batches
- [ ] Pagination works correctly
- [ ] Status badges display correctly
- [ ] Navigation is intuitive
- [ ] Page loads quickly (<1s)
- [ ] No runtime errors
- [ ] All tests pass
- [ ] Codex implementation review approved (not process approval)

---

**Ready for Codex Review**
