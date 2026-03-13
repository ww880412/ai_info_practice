# Entry Detail Page - Comparison History Tab

> **Version**: 1.0
> **Date**: 2026-03-11
> **Status**: Draft - Ready for Implementation
> **Related**: Phase 1 (Comparison History List) completed

## 1. Overview

### 1.1 Problem Statement
- Entry 详情页缺少对比历史视图
- 用户无法从单个 Entry 视角查看其参与的所有对比
- 需要手动去批次列表页查找包含该 Entry 的批次

### 1.2 Solution
在 Entry 详情页 (`/entry/[id]`) 添加新的 "Comparison History" Tab：
- 显示该 Entry 参与的所有对比批次
- 展示对比时间、模式（source vs target）、得分
- 提供快速链接到批次详情页
- 支持按状态和时间排序

### 1.3 Scope
- **In Scope**:
  - Entry 详情页 Tab 组件
  - API 端点：GET /api/entries/[id]/comparisons
  - 对比历史列表展示
  - 链接到批次详情页
- **Out of Scope**:
  - 批次详情页（Phase 1 已完成）
  - 对比结果的详细分析
  - 对比历史的编辑/删除功能

## 2. Architecture

### 2.1 Data Model

**Current Schema** (Phase 1 已实现):
```prisma
model ComparisonBatch {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  sourceMode  ComparisonMode  // TWO_STEP | TOOL_CALLING
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

**Missing**: ComparisonResult 模型（需要新增）
```prisma
model ComparisonResult {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())

  batchId   String
  batch     ComparisonBatch @relation(fields: [batchId], references: [id], onDelete: Cascade)

  entryId   String
  entry     Entry @relation(fields: [entryId], references: [id], onDelete: Cascade)

  sourceScore Float?  // Score from source mode
  targetScore Float?  // Score from target mode
  winner      String?  // "source" | "target" | "tie"

  sourceOutput Json?   // Full output from source mode
  targetOutput Json?   // Full output from target mode

  @@unique([batchId, entryId])
  @@index([entryId])
  @@index([batchId])
}
```

### 2.2 API Design

**Endpoint**: `GET /api/entries/[id]/comparisons`

**Query Parameters**:
- `status`: Filter by batch status (PENDING | PROCESSING | COMPLETED | FAILED)
- `limit`: Number of results (default: 20)
- `offset`: Pagination offset (default: 0)

**Response**:
```typescript
{
  data: {
    comparisons: Array<{
      id: string;
      batchId: string;
      createdAt: string;
      sourceMode: "TWO_STEP" | "TOOL_CALLING";
      targetMode: "TWO_STEP" | "TOOL_CALLING";
      status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
      sourceScore?: number;
      targetScore?: number;
      winner?: "source" | "target" | "tie";
    }>;
    total: number;
  }
}
```

### 2.3 UI Design

**Tab Structure**:
```
Entry Detail Page
├── Summary Tab (existing)
├── Practice Tab (existing)
└── Comparison History Tab (NEW)
    ├── Filter Bar (status, date range)
    ├── Comparison List
    │   ├── Comparison Card
    │   │   ├── Batch Info (ID, created time)
    │   │   ├── Modes (source vs target)
    │   │   ├── Scores (source score vs target score)
    │   │   ├── Winner Badge
    │   │   └── Link to Batch Detail
    │   └── ...
    └── Pagination
```

**Empty State**:
- "No comparison history yet"
- "This entry hasn't been included in any comparisons"

## 3. Implementation Plan

### Task 1: Database Migration (1h)
**Objective**: Add ComparisonResult model

**Files**:
- `prisma/schema.prisma`
- `prisma/migrations/YYYYMMDDHHMMSS_add_comparison_result/migration.sql`

**Steps**:
1. Add ComparisonResult model to schema
2. Add relation to ComparisonBatch (one-to-many)
3. Add relation to Entry (one-to-many)
4. Generate migration: `npx prisma migrate dev --name add_comparison_result`
5. Update Prisma Client: `npx prisma generate`

**Acceptance Criteria**:
- [ ] Migration applied successfully
- [ ] ComparisonResult table created
- [ ] Foreign keys and indexes created
- [ ] Prisma Client types updated

### Task 2: API Route (2h)
**Objective**: Implement GET /api/entries/[id]/comparisons

**Files**:
- `src/app/api/entries/[id]/comparisons/route.ts`

**Steps**:
1. Create API route handler
2. Query ComparisonResult with batch info
3. Apply filters (status, pagination)
4. Return formatted response
5. Add error handling (404 if entry not found)

**Acceptance Criteria**:
- [ ] API returns comparison list for valid entry ID
- [ ] Filters work correctly (status, limit, offset)
- [ ] Returns 404 for non-existent entry
- [ ] Response matches TypeScript interface

### Task 3: Tab Component (3h)
**Objective**: Create ComparisonHistoryTab component

**Files**:
- `src/components/entry/ComparisonHistoryTab.tsx`
- `src/components/entry/ComparisonCard.tsx`

**Steps**:
1. Create ComparisonHistoryTab component
2. Integrate with React Query for data fetching
3. Create ComparisonCard component
4. Add filter UI (status dropdown)
5. Add pagination controls
6. Handle loading/error/empty states

**Acceptance Criteria**:
- [ ] Tab displays comparison list
- [ ] Each card shows batch info, modes, scores
- [ ] Winner badge displayed correctly
- [ ] Link to batch detail page works
- [ ] Filters and pagination work
- [ ] Empty state shown when no comparisons

### Task 4: Entry Page Integration (1h)
**Objective**: Add Comparison History tab to Entry detail page

**Files**:
- `src/app/entry/[id]/page.tsx`

**Steps**:
1. Import ComparisonHistoryTab
2. Add new tab to tab list
3. Update tab routing/state management
4. Test tab switching

**Acceptance Criteria**:
- [ ] New tab appears in Entry detail page
- [ ] Tab switching works smoothly
- [ ] Tab content loads correctly
- [ ] No layout issues

### Task 5: Testing (2h)
**Objective**: Add tests for new functionality

**Files**:
- `src/app/api/entries/[id]/comparisons/__tests__/route.test.ts`
- `src/components/entry/__tests__/ComparisonHistoryTab.test.tsx`

**Steps**:
1. Write API route tests (happy path, error cases)
2. Write component tests (rendering, interactions)
3. Test pagination and filtering
4. Test empty states

**Acceptance Criteria**:
- [ ] API tests cover all scenarios
- [ ] Component tests pass
- [ ] Edge cases handled

## 4. Estimated Timeline

| Task | Time | Dependencies |
|------|------|--------------|
| Task 1: Database Migration | 1h | None |
| Task 2: API Route | 2h | Task 1 |
| Task 3: Tab Component | 3h | Task 2 |
| Task 4: Entry Page Integration | 1h | Task 3 |
| Task 5: Testing | 2h | Task 2-4 |

**Total**: 9 hours

## 5. Open Questions

1. Should we show comparison results even if batch is still PROCESSING?
   - **Recommendation**: Yes, show partial results with "In Progress" badge

2. Should we cache comparison history?
   - **Recommendation**: Use React Query with 5-minute stale time

3. Should we support bulk actions (e.g., delete multiple comparisons)?
   - **Recommendation**: Out of scope for Phase 2, add to backlog

## 6. Success Metrics

- [ ] Users can view comparison history from Entry detail page
- [ ] Average time to find comparison results reduced by 50%
- [ ] Zero errors in production after 1 week
- [ ] All tests passing
