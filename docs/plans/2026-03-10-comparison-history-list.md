# Comparison History List - Design Document

> **Version**: 1.0
> **Date**: 2026-03-10
> **Status**: Ready for Implementation (Codex Approved - Score 8.5/10)

## 1. Overview

### 1.1 Problem Statement
Users cannot view historical comparison batches after they are created. The comparison results are "one-time" and cannot be revisited.

### 1.2 Solution
Create a batch history list page at `/comparison` that displays all historical comparison batches with navigation to detailed results.

### 1.3 Scope
- **In Scope**: Batch list page, API endpoint, navigation integration
- **Out of Scope**: Entry-level comparison history (Phase 2), Settings redesign (Phase 3)

## 2. Architecture

### 2.1 Data Model

**Current Schema**:
```prisma
model ComparisonBatch {
  id          String   @id @default(cuid())
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  targetMode  String   // 'two-step' | 'tool-calling'
  entryCount  Int
  status      String   // 'pending' | 'processing' | 'completed' | 'failed'
  progress    Int      @default(0)
  stats       Json?    // { winRate, avgScoreDiff, etc. }

  @@index([status])
}
```

**Required Schema Changes**:
```prisma
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

model ComparisonBatch {
  id          String   @id @default(cuid())
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Comparison modes
  sourceMode  ComparisonMode  // Baseline mode (original)
  targetMode  ComparisonMode  // Comparison mode (new)

  entryCount  Int
  status      BatchStatus     @default(PENDING)
  progress    Int             @default(0)  // Percentage: 0-100
  processedCount Int          @default(0)  // Actual processed entries

  // Statistics (extracted key fields for sorting/filtering)
  winRate     Float?          // Percentage of wins (0-100)
  avgScoreDiff Float?         // Average score difference
  stats       Json?           // Extended stats (totalWins, totalLosses, totalTies, etc.)

  @@index([status])
  @@index([createdAt])  // For sorting by creation date
}
```

**Migration Required**: Yes - add enums, sourceMode field, winRate/avgScoreDiff columns, createdAt index

**Migration Strategy**:
1. Add new columns with nullable defaults
2. Backfill existing batches:
   - `sourceMode`: Infer from existing comparison records or default to `TWO_STEP`
   - `winRate` / `avgScoreDiff`: Recalculate from `stats` JSON if available, otherwise null
3. After backfill, make `sourceMode` non-nullable
4. Display "N/A" for null winRate/avgScoreDiff in UI (acceptable for historical data)

### 2.2 API Design

#### GET /api/comparison/batches

**Request**:
```typescript
// Query params (optional)
{
  limit?: number;    // Default: 20, Max: 100
  offset?: number;   // Default: 0, Min: 0
  status?: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
}
```

**Validation**:
- `limit`: 1-100, default 20
- `offset`: >= 0, default 0
- `status`: Must be valid BatchStatus enum value

**Important**: `total`, `hasNext`, and `nextOffset` in pageInfo must respect the same `status` filter applied to `batches` query to ensure pagination consistency.

**Response**:
```typescript
{
  data: {
    batches: Array<{
      id: string;
      createdAt: string;  // ISO 8601 UTC
      sourceMode: 'TWO_STEP' | 'TOOL_CALLING';
      targetMode: 'TWO_STEP' | 'TOOL_CALLING';
      entryCount: number;
      status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
      progress: number;  // Percentage: 0-100
      processedCount: number;  // Actual count: e.g., 7 out of 10
      winRate: number | null;  // 0-100 or null if not completed
      avgScoreDiff: number | null;  // Score difference or null
      stats: {
        totalWins?: number;
        totalLosses?: number;
        totalTies?: number;
      } | null;
    }>;
    pageInfo: {
      total: number;      // Total number of batches
      limit: number;      // Current limit
      offset: number;     // Current offset
      hasNext: boolean;   // Whether there are more results
      nextOffset: number | null;  // Next offset for pagination, null if no more
    };
  }
}
```

**Error Response**:
```typescript
{
  error: {
    code: string;      // 'INVALID_PARAMS' | 'DATABASE_ERROR' | 'INTERNAL_ERROR'
    message: string;   // Human-readable error message
  }
}
```

**HTTP Status Codes**:
- 200: Success
- 400: Invalid query parameters
- 500: Database or internal error

### 2.3 Frontend Components

#### Page: `/comparison/page.tsx`
- Server component for initial data fetch
- Client component for interactions

**Layout**:
```
┌─────────────────────────────────────────┐
│ Comparison History                      │
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │ TWO_STEP vs TOOL_CALLING           │ │
│ │ Created: 2026-03-10 14:30 (Local)  │ │
│ │ Entries: 10 | Status: ✅ Completed │ │
│ │ Win Rate: 60% | Avg Diff: +0.15    │ │
│ │ Progress: 100% (10/10 processed)   │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ TOOL_CALLING vs TWO_STEP           │ │
│ │ Created: 2026-03-09 10:15 (Local)  │ │
│ │ Entries: 5 | Status: ⚠️ Failed     │ │
│ │ Win Rate: N/A | Avg Diff: N/A      │ │
│ │ Progress: 60% (3/5 processed)      │ │
│ └─────────────────────────────────────┘ │
│ [Load More]                             │
└─────────────────────────────────────────┘
```

**Features**:
- Sort by creation date (newest first)
- Status badge with icons:
  - ⏳ Pending (gray)
  - 🔄 Processing (blue, with progress)
  - ✅ Completed (green)
  - ⚠️ Failed (red, clickable for error details)
- Display both sourceMode and targetMode
- Show progress for processing/failed batches
- Display "N/A" for null winRate/avgScoreDiff
- Convert UTC timestamps to local timezone
- Click to navigate to `/comparison/[batchId]`
- Empty state with CTA: "No comparison batches yet. Go to Library to create one."
- "Load More" button for pagination
- Loading skeleton during fetch

#### Component: `src/components/comparison/BatchHistoryList.tsx`
```typescript
interface BatchHistoryListProps {
  batches: ComparisonBatch[];
}
```

Responsibilities:
- Render batch cards
- Handle click navigation
- Display status badges
- Format dates and statistics

### 2.4 Navigation Integration

#### Update: `src/components/common/Navbar.tsx`
Add navigation link:
```tsx
<Link href="/comparison">
  Comparison History
</Link>
```

Position: Between "Practice" and "Settings"

#### Update: `src/app/library/page.tsx` (or comparison trigger component)
After comparison completes, show toast with link:
```tsx
toast.success(
  <div>
    Comparison batch created!
    <Link href={`/comparison/${batchId}`}>View Results</Link>
  </div>
);
```

## 3. User Flow

```
User Journey:
1. User clicks "Comparison History" in navbar
2. System fetches all batches from DB
3. User sees list of historical batches
4. User clicks a batch card
5. System navigates to /comparison/[batchId]
6. User views detailed comparison results
```

## 4. Technical Decisions

### 4.1 Pagination
- **Decision**: Implement offset-based pagination with "Load More" button
- **Rationale**: Batch count expected to be low (<100), simple pagination sufficient
- **Default limit**: 20 (reduced from 50 to improve initial load time)
- **Future**: Upgrade to cursor-based pagination when batch count > 500

### 4.2 Real-time Updates
- **Decision**: No real-time updates in Phase 1
- **Rationale**: Batch processing is async, users can refresh manually
- **Future**: Add polling or WebSocket in Phase 2 if needed

### 4.3 Filtering
- **Decision**: No filtering in Phase 1
- **Rationale**: Keep MVP simple, add filters if users request
- **Future**: Filter by status, date range, target mode

## 5. Error Handling

### 5.1 API Errors
- **Database connection failure** → 500 error with code `DATABASE_ERROR`
- **Invalid query params** → 400 error with code `INVALID_PARAMS` and specific message
  - `limit` out of range: "limit must be between 1 and 100"
  - `offset` negative: "offset must be >= 0"
  - `status` invalid: "status must be one of: PENDING, PROCESSING, COMPLETED, FAILED"
- **No batches found** → Return empty array with `total: 0` (not an error)

### 5.2 Frontend Errors
- **API fetch failure** → Show error toast with retry button, exponential backoff (1s, 2s, 4s)
- **Empty state** → Show friendly message: "No comparison batches yet. Go to Library to create one." with link button
- **Loading state** → Show skeleton cards (3 placeholders)
- **Partial data** → Handle null/undefined gracefully:
  - `winRate` null → Display "N/A"
  - `avgScoreDiff` null → Display "N/A"
  - `stats` null → Hide extended stats section
  - `progress` out of range → Clamp to 0-100

### 5.3 Edge Cases
- **Failed batch** → Show error badge, allow click to view details (if available)
- **Processing batch** → Show progress bar, optional auto-refresh with limits:
  - Refresh interval: 5s
  - Max refresh attempts: 60 (5 minutes total)
  - Stop conditions: Status changes to COMPLETED/FAILED, user navigates away, tab becomes inactive
  - Use `document.visibilityState` to pause polling when tab is hidden
- **Timezone display** → Convert UTC to user's local timezone with clear label
- **Status/progress mismatch** → Trust status field, display progress as-is with warning icon if inconsistent

## 6. Testing Strategy

### 6.1 Unit Tests
- API route handler
- BatchHistoryList component rendering
- Date formatting utilities

### 6.2 Integration Tests
- Full page rendering with mock data
- Navigation flow

### 6.3 Manual Testing
- Create multiple batches
- Verify list display
- Test navigation
- Test empty state

## 7. Performance Considerations

### 7.1 Database Query
```sql
SELECT
  id, createdAt, sourceMode, targetMode,
  entryCount, status, progress,
  winRate, avgScoreDiff, stats
FROM ComparisonBatch
ORDER BY createdAt DESC, id DESC  -- Stable sort to avoid pagination duplicates
LIMIT 20 OFFSET 0;
```
- **Optimization**: Only select fields needed for list display (no full JSON expansion)
- **Indexes**: `createdAt` (for sorting), `status` (for filtering)
- **Stable sorting**: Use `id` as secondary sort key to ensure consistent pagination
- **Expected query time**: <50ms for <1000 batches

**Shared Query Function**:
```typescript
// src/lib/comparison/query-batches.ts
export async function queryBatches(params: {
  limit: number;
  offset: number;
  status?: BatchStatus;
}) {
  return prisma.comparisonBatch.findMany({
    where: params.status ? { status: params.status } : undefined,
    select: {
      id: true,
      createdAt: true,
      sourceMode: true,
      targetMode: true,
      entryCount: true,
      status: true,
      progress: true,
      winRate: true,
      avgScoreDiff: true,
      stats: true,
    },
    orderBy: [
      { createdAt: 'desc' },
      { id: 'desc' },  // Stable sort
    ],
    take: params.limit,
    skip: params.offset,
  });
}
```
- Used by both server component (initial load) and API route (pagination)
- Ensures consistent query logic and prevents drift

### 7.2 Frontend
- Server-side rendering for initial load (Next.js App Router)
- Client-side pagination with "Load More" button
- No heavy computations
- Lazy load batch details on demand

## 8. Security Considerations

- No authentication required in Phase 1 (internal tool)
- **Future-proofing**: API responses include standard HTTP status codes (401/403) for future auth integration
- No sensitive data exposure (batch metadata only)
- Standard SQL injection protection (Prisma ORM)
- Rate limiting: Not required in Phase 1, consider if exposed publicly

## 9. Rollout Plan

### 9.1 Implementation Order
1. Create API route
2. Create page component
3. Create BatchHistoryList component
4. Update Navbar
5. Add toast notification
6. Write tests

### 9.2 Deployment
- Deploy to staging first
- Manual QA
- Deploy to production
- Monitor for errors

## 10. Success Metrics

- Users can view all historical batches
- Navigation works correctly
- Page loads in <1s
- Zero runtime errors

## 11. Future Enhancements (Out of Scope)

- Real-time status updates
- Advanced filtering (date range, status, mode)
- Batch deletion
- Batch export (CSV/JSON)
- Batch comparison (compare multiple batches)

---

## Appendix A: File Changes

### New Files
- `src/app/api/comparison/batches/route.ts`
- `src/app/comparison/page.tsx`
- `src/components/comparison/BatchHistoryList.tsx`
- `src/lib/comparison/query-batches.ts` (shared query function)

### Modified Files
- `src/components/common/Navbar.tsx`
- `src/app/library/page.tsx` (or comparison trigger component)
- `prisma/schema.prisma` (add enums, sourceMode, winRate, avgScoreDiff, indexes)

### Migration Files
- `prisma/migrations/YYYYMMDDHHMMSS_add_comparison_batch_enums_and_fields/migration.sql`

### Test Files
- `src/app/api/comparison/batches/route.test.ts`
- `src/components/comparison/BatchHistoryList.test.tsx`
- `src/lib/comparison/query-batches.test.ts`

---

**Ready for Codex Review**
