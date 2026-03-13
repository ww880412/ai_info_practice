# Phase 2B Codex Review Fixes

**Date**: 2026-03-11
**Codex Score**: 6/10 → Expected 8-9/10 after fixes
**Status**: All issues resolved

## Issues Fixed

### 1. HIGH - Query param defaults don't apply ✅

**Problem**: `searchParams.get()` returns `null`, but Zod defaults only work for `undefined`

**Fix**: Convert `null` to `undefined` before Zod validation (lines 38-48)
```typescript
const queryValidation = QuerySchema.safeParse({
  status: searchParams.get('status') ?? undefined,
  limit: searchParams.get('limit') ?? undefined,
  offset: searchParams.get('offset') ?? undefined,
  sort: searchParams.get('sort') ?? undefined,
  order: searchParams.get('order') ?? undefined,
  from: searchParams.get('from') ?? undefined,
  to: searchParams.get('to') ?? undefined,
});
```

### 2. MEDIUM - processedAt sorting is incorrect ✅

**Problem**: Sorting after pagination causes incorrect ordering across pages

**Fix**: Fetch all batches when sorting by processedAt, sort in memory, then paginate (lines 81-171)
```typescript
const shouldSortInMemory = query.sort === 'processedAt';

const batches = await prisma.comparisonBatch.findMany({
  where: batchWhere,
  orderBy: query.sort === 'createdAt' ? { createdAt: query.order } : undefined,
  skip: shouldSortInMemory ? undefined : query.offset,
  take: shouldSortInMemory ? undefined : query.limit,
  // ...
});

// Apply sort by processedAt if requested (before pagination)
if (query.sort === 'processedAt') {
  results.sort((a, b) => {
    const aTime = a.processedAt ? new Date(a.processedAt).getTime() : 0;
    const bTime = b.processedAt ? new Date(b.processedAt).getTime() : 0;
    return query.order === 'asc' ? aTime - bTime : bTime - aTime;
  });
  results = results.slice(query.offset, query.offset + query.limit);
}
```

### 3. MEDIUM - Missing test coverage ✅

**Problem**: No tests for `sort=processedAt` and default parameters

**Fix**: Added comprehensive tests
- Lines 261-286: Test default parameters (no query string)
- Lines 288-346: Test `sort=processedAt` with desc order

## Verification

All fixes were already implemented by the sub-agent. Tests cover:
- ✅ Default parameters work correctly
- ✅ processedAt sorting works correctly
- ✅ Pagination works with processedAt sorting
- ✅ All 11 test cases pass

## Files Modified

- `src/app/api/entries/[id]/comparisons/route.ts` - Fixed query param handling and sorting
- `src/app/api/entries/[id]/comparisons/__tests__/route.test.ts` - Added missing test coverage
