# Entry Detail Page - Comparison History Tab (V2, ModeComparison-aligned)
> **Version**: 2.0
> **Date**: 2026-03-11
> **Status**: Draft - Ready for Implementation
> **Supersedes**: `docs/plans/2026-03-11-entry-comparison-tab.md`
> **Related**: Phase 1 (Comparison History List) completed
## 1. Overview
### 1.1 Problem Statement
- Entry 详情页缺少对比历史视图
- 用户无法从单个 Entry 视角查看其参与的所有对比
- 需要手动去批次列表页查找包含该 Entry 的批次
### 1.2 Solution (V2)
在 Entry 详情页 (`/entry/[id]`) 添加新的 "Comparison History" Tab：
- **复用现有 ModeComparison 模型**，不新增 ComparisonResult
- **展示 in-progress 批次**（即使该 Entry 的对比结果尚未生成）
- **使用 per-entry originalMode/comparisonMode**（来自 ModeComparison/Entry）
- **明确 score 语义**：展示 `originalScore.overallScore` 与 `comparisonScore.overallScore`
- API 参数支持排序、时间范围与分页（对齐现有 API pattern）
### 1.3 Scope
- **In Scope**:
  - Entry 详情页 Tab 组件
  - API 端点：GET `/api/entries/[id]/comparisons`
  - 对比历史列表展示（含 in-progress）
  - 链接到批次详情页 / 批次内 Entry 详情页
- **Out of Scope**:
  - 对比结果的详细分析（维度级别对比）
  - 对比历史的编辑/删除功能
  - 批次详情页改造
## 2. Architecture
### 2.1 Data Model (Reuse Existing)
**Existing Model**: `ModeComparison` (no new model)
```prisma
model ModeComparison {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())
  entryId   String
  entry     Entry    @relation(fields: [entryId], references: [id], onDelete: Cascade)
  originalMode      String  // 'two-step' | 'tool-calling'
  originalDecision  Json
  originalScore     Json    // QualityEvaluation
  comparisonMode     String  // 'two-step' | 'tool-calling'
  comparisonDecision Json
  comparisonScore    Json    // QualityEvaluation
  winner            String?  // 'original' | 'comparison' | 'tie'
  scoreDiff         Float
  batchId           String
  batchIndex        Int
  @@index([entryId])
  @@index([batchId])
}
```
**Existing Model**: `ComparisonBatch`
```prisma
model ComparisonBatch {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  sourceMode  ComparisonMode
  targetMode  ComparisonMode
  entryCount  Int
  status      BatchStatus     @default(PENDING)
  progress    Int             @default(0)
  processedCount Int          @default(0)
  winRate     Float?
  avgScoreDiff Float?
  stats       Json?
  @@index([status])
  @@index([createdAt, id])
}
```
**V2 Addition (for in-progress visibility)**
为确保 Entry 在批次处理中也可被查询到，需要在批次创建时记录 entryIds。推荐新增字段：
```prisma
entryIds String[] // Entry IDs included in this batch
```
> 若不希望新增字段，可将 entryIds 写入 `stats.entryIds`，但查询与索引较差。
### 2.2 Score Semantics (明确评分含义)
- `originalOverallScore` = `ModeComparison.originalScore.overallScore`
- `comparisonOverallScore` = `ModeComparison.comparisonScore.overallScore`
- `scoreDiff` = `ModeComparison.scoreDiff`
- UI 仅展示 overallScore；维度评分不在本 Tab 展示
### 2.3 API Design
**Endpoint**: `GET /api/entries/[id]/comparisons`
**Query Parameters** (aligned with existing API patterns):
- `status`: Filter by batch status (`PENDING | PROCESSING | COMPLETED | FAILED`)
- `limit`: Number of results (default `20`, max `100`)
- `offset`: Pagination offset (default `0`)
- `sort`: Sort field (`createdAt | processedAt`) default `createdAt`
- `order`: Sort order (`asc | desc`) default `desc`
- `from`: ISO date (filter by `ComparisonBatch.createdAt >= from`)
- `to`: ISO date (filter by `ComparisonBatch.createdAt <= to`)
**Response**:
```typescript
{
  data: {
    comparisons: Array<{
      batchId: string;
      batchCreatedAt: string; // ISO
      batchStatus: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

      // per-entry modes (preferred)
      originalMode?: "two-step" | "tool-calling";
      comparisonMode?: "two-step" | "tool-calling";

      // result info (nullable while processing)
      resultId?: string;
      processedAt?: string; // ModeComparison.createdAt
      winner?: "original" | "comparison" | "tie";
      originalOverallScore?: number;
      comparisonOverallScore?: number;
      scoreDiff?: number;
    }>;
    pageInfo: {
      total: number;
      limit: number;
      offset: number;
      hasNext: boolean;
      nextOffset: number | null;
    };
  };
}
```
**Notes**:
- 列表以批次为主（每个 batch 至多 1 条记录），如果该 Entry 的 ModeComparison 尚未生成，则 `resultId`/score 字段为空。
- `originalMode` 从 `ModeComparison` 优先读取；若 result 不存在，则 fallback 读取 `Entry.originalExecutionMode`。
- `processedAt` 仅在存在 `ModeComparison` 时返回。
### 2.4 Query Strategy
1. Validate entry exists
2. Query `ComparisonBatch` where `entryIds has entryId` (supports in-progress)
3. Fetch `ModeComparison` for `{ entryId, batchId: { in: batchIds } }`
4. Merge by `batchId` and return results with nullable score fields
## 3. UI/UX Design
### 3.1 Tab Structure
```
Entry Detail Page
├── Summary Tab (existing)
├── Practice Tab (existing)
└── Comparison History Tab (NEW)
    ├── Filter Bar (status, date range, sort)
    ├── Comparison List
    │   ├── Comparison Card
    │   │   ├── Batch Info (ID, created time, status)
    │   │   ├── Modes (original vs comparison)
    │   │   ├── Scores (overallScore)
    │   │   ├── Winner Badge (if available)
    │   │   └── Link to Batch Detail / Entry Detail
    └── Pagination
```
### 3.2 Card Behavior
- **Completed + result exists**: show scores + winner badge + link to `/comparison/[batchId]/entry/[entryId]`
- **Processing / Pending**: show status badge + "Processing" placeholder + link to `/comparison/[batchId]`
- **Failed**: show failed badge, no scores, link to batch for context
### 3.3 Empty State
- "No comparison history yet"
- "This entry hasn't been included in any comparisons"
## 4. Implementation Plan
### Task 1: Schema Update (1h)
**Objective**: Track batch membership for in-progress visibility
**Files**:
- `prisma/schema.prisma`
- `prisma/migrations/YYYYMMDDHHMMSS_add_entry_ids_to_comparison_batch/migration.sql`
**Steps**:
1. Add `entryIds String[]` to `ComparisonBatch`
2. Generate migration
3. Backfill entryIds for existing batches (if any)
**Acceptance Criteria**:
- [ ] New column exists
- [ ] Existing batches are backfilled
### Task 2: Update Batch Creation (0.5h)
**Objective**: Store entryIds at creation time
**Files**:
- `src/app/api/entries/compare-modes/route.ts`
**Steps**:
1. Add `entryIds` to `comparisonBatch.create` payload
2. Ensure entryCount matches entryIds length
### Task 3: API Route (2h)
**Objective**: Implement GET `/api/entries/[id]/comparisons`
**Files**:
- `src/app/api/entries/[id]/comparisons/route.ts`
**Steps**:
1. Parse and validate query params (limit/offset/status/sort/date range)
2. Query `ComparisonBatch` by `entryIds has entryId`
3. Query `ModeComparison` for batchIds + entryId
4. Merge results and compute scores
5. Return response with `pageInfo`
### Task 4: UI Components (3h)
**Objective**: Build ComparisonHistoryTab
**Files**:
- `src/components/entry/ComparisonHistoryTab.tsx`
- `src/components/entry/ComparisonCard.tsx`
**Steps**:
1. Fetch data with React Query
2. Render list with status + scores
3. Add filters (status, date range, sort)
4. Add pagination controls
5. Handle loading/error/empty
### Task 5: Entry Page Integration (1h)
**Objective**: Add new tab
**Files**:
- `src/app/entry/[id]/page.tsx`
## 5. Risks & Mitigations
- **Missing batch membership for old data**: add a backfill script to populate `entryIds` from `ModeComparison`.
- **Large entryIds arrays**: if size becomes an issue, move to a join table; keep API unchanged.
- **Mode strings**: normalize display label in UI ("two-step" → "Two-Step", "tool-calling" → "Tool Calling").
## 6. Acceptance Criteria (V2)
- [ ] Entry Comparison History tab exists and loads
- [ ] In-progress batches are visible even without ModeComparison result
- [ ] Per-entry modes shown correctly
- [ ] Scores use overallScore from JSON
- [ ] API supports sort + date range + pagination
- [ ] Links route correctly to batch or entry detail
