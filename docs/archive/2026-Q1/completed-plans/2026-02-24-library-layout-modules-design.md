# Library Layout & Module Architecture Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild `/library` into a cleaner, collapsible, and scalable information architecture while preserving existing filtering and grouping behavior.

**Architecture:** Keep current data/query contracts (`useEntries`, `useGroups`, `/api/tags/stats`) and refactor only presentation/state orchestration. Convert the page into three explicit zones: global filters, collapsible navigation panels, and results workspace. Use URL as source of truth for group/tag filters; local UI state only controls panel visibility.

**Tech Stack:** Next.js App Router (client component), React Query, Tailwind CSS, lucide-react.

## Module Functional Design

### Module A: Page Shell (Header + CTA)
- Purpose: orient the user and provide one high-priority action (`Add`).
- Inputs: `total` from entries query.
- States: loading-safe counter, normal counter.
- Interaction: always visible; no hidden actions.
- Success metric: user can understand page purpose in <3 seconds and find ingest入口 immediately.

### Module B: Query Workspace (Search + Quick Filters)
- Purpose: support quick narrowing without opening advanced panels.
- Inputs: `q`, `contentType`, `techDomain`, `practiceValue`.
- States: default, active filters, clear-all.
- Interaction: debounce on search; filter change resets page and selection.
- Constraints: keep existing URL-compatible API parameters.

### Module C: Navigation Panels (Collapsible)
- Purpose: prevent visual overload while keeping hierarchy visible on demand.
- Panels:
  - `Groups` panel (tree selection + CRUD)
  - `Tag Intelligence` panel (AI/User grouped tags with semantic alias aggregation)
- States: expanded/collapsed per panel, desktop always available, mobile toggle visibility.
- Interaction rules:
  - Group selection writes `groupId` to URL.
  - Tag toggles write `aiTagsAny/userTagsAny` to URL.
  - Clear action can remove panel-specific filters only.

### Module D: Active Filter Bar
- Purpose: show active constraints transparently and allow one-click rollback.
- Tokens:
  - group token
  - ai tag tokens
  - user tag tokens
- Interaction: each token supports remove action; changing any token resets pagination and selection.

### Module E: Results Control Rail
- Purpose: isolate bulk operations from content grid.
- Inputs: current page entry ids + selected ids.
- States: none selected, partial selected, all selected, deleting.
- Interaction: select-all current page; destructive action guarded by confirm.

### Module F: Entry Grid + Pagination
- Purpose: primary content workspace.
- States: loading skeleton, empty state, populated grid, paginated.
- Interaction: entry card click to detail route; pagination clears current selection to avoid accidental cross-page deletes.

### Module G: Responsive Behavior
- Desktop (`xl+`): two-column layout with sticky left panel.
- Tablet/Mobile (`<xl`): panel stack hidden by default, toggled by one button.
- Guarantee: all filters available without horizontal overflow.

## Task 1: Refactor library page layout orchestration

**Files:**
- Modify: `src/app/library/LibraryPageClient.tsx`
- Reuse: `src/components/library/GroupSidebar.tsx`
- Reuse: `src/components/library/TagSidebar.tsx`
- Reuse: `src/components/library/EntryFilters.tsx`

**Step 1: Add panel visibility state model**
- Add local state for:
  - mobile panel visibility
  - group panel expand/collapse
  - tag panel expand/collapse
- Remove obsolete advanced-tag-inline block state.

**Step 2: Recompose page layout zones**
- Move quick filters to top workspace.
- Move groups + tags into dedicated sidebar panel stack.
- Keep entries grid and bulk rail in main workspace only.

**Step 3: Add active-filter token rail**
- Render removable chips for selected group/ai/user tags.
- Wire remove actions to existing URL update handlers.

**Step 4: Harden mobile behavior**
- Add explicit toggle button for panel stack on small screens.
- Ensure `xl` breakpoint restores panel visibility regardless of toggle.

## Task 2: Preserve behavior invariants

**Files:**
- Modify: `src/app/library/LibraryPageClient.tsx`

**Step 1: Keep URL contract stable**
- `groupId`, `aiTagsAny`, `userTagsAny` behavior remains unchanged.

**Step 2: Keep destructive flow stable**
- Batch delete still acts only on current page selection.

**Step 3: Keep navigation stable**
- Entry card click still routes to `/entry/[id]`.

## Task 3: Verification

**Files:**
- N/A (command verification)

**Step 1: Run linter**
- `npm run lint`
- Expected: no errors.

**Step 2: Run unit tests**
- `npm run test:run`
- Expected: existing tests pass.

**Step 3: Run production build**
- `npm run build`
- Expected: build succeeds and `/library` compiles.

## Acceptance Criteria
- `/library` no longer has oversized inline advanced filter section dominating the page.
- Groups and tags are both collapsible and remain usable on mobile.
- Active filters are visible and removable individually.
- Existing group/tag filtering API behavior is unchanged.
- Bulk select/delete and pagination still work as before.
