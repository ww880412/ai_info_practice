# AI Knowledge Management System - Iteration Design

**Date**: 2026-02-21
**Status**: Draft

## 1. Product Direction

| Dimension | Decision |
|-----------|----------|
| Core Position | Intelligent Knowledge Management (not learning paths, but a knowledge base) |
| Knowledge Organization | Tag/Dimension filtering as primary, Timeline as secondary |
| Intelligence Features | Deduplication, Smart Summary, Association Discovery, Learning Suggestions (all) |
| Content Sources | WeChat, Twitter/X, GitHub (user provides links/files manually) |
| Priority | ① Run basic flow ② UI/UX ③ AI Quality |

## 2. Architecture Evolution

### V1 (Current)
```
Input → Parse → L1/L2/L3 Processing → Knowledge Library / Practice Queue
```

### V2 (Next Step)
- Add **Deduplication Detection** (compare similarity with existing content on ingestion)
- Add **Smart Summary** (regenerate refined summary)
- Add **Association Discovery** (remind users when new content relates to existing)

### V3 (Long-term)
- Add **Topic Albums** (user creates knowledge collections)
- Add **Learning Suggestions** (recommendations based on collection distribution)

## 3. Feature: Frontend Configuration Panel

### Problem
Currently users need to edit `.env` file to configure API keys, which is inconvenient.

### Solution
Add a settings page accessible via navbar button, allowing users to input and save configurations directly in the UI.

### Implementation

**Data Storage**
- Store in `SystemConfig` table in database (encrypted for sensitive values)
- Or use `localStorage` for simple non-sensitive configs

**UI Components**
- `SettingsPage` - `/settings` route
- `ConfigButton` in Navbar - opens settings modal or navigates to page

**Configurable Items**
| Key | Description | Sensitive |
|-----|-------------|-----------|
| GEMINI_API_KEY | Gemini API Key | Yes |
| GEMINI_MODEL | Model name (default: gemini-2.0-flash-exp) | No |
| DATABASE_URL | Database connection (usually not changed) | No |

### Page Design
```
┌─────────────────────────────┐
│  Settings                  │
├─────────────────────────────┤
│  API Configuration         │
│  ┌───────────────────────┐ │
│  │ Gemini API Key    [●]│ │  ← password field
│  │ Model            [▼]  │ │
│  └───────────────────────┘ │
│                             │
│  [Save] [Reset to Default] │
└─────────────────────────────┘
```

## 4. Priority Tasks

### Phase 1: Run Basic Flow + Frontend Config (This Iteration)
1. Fix any environment/dependency issues
2. Add Settings page with API key configuration
3. Verify: Ingest → Parse → AI Process → View in Library works end-to-end
4. UI polish: EntryCard, Filters, StepTracker improvements

### Phase 2: AI Quality (Next Iteration)
1. Optimize L1/L2/L3 prompts
2. Add retry logic for failed AI calls
3. Add progress indicators during AI processing

### Phase 3: Intelligence Features (V2)
1. Deduplication on ingestion
2. Smart summary generation
3. Association discovery

## 5. Database Schema Changes (Future)

```prisma
// For V2 - System Configuration
model SystemConfig {
  id        String   @id @default(cuid())
  key       String   @unique
  value     String
  isSecret  Boolean  @default(false)
  updatedAt DateTime @updatedAt
}
```

---

## Approval

- [ ] Product Direction Confirmed
- [ ] Architecture Evolution Approved
- [ ] Settings Feature Approved
