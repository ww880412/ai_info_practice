# Mode Comparison Data Audit Report

**Date**: 2026-03-10
**Auditor**: AI Agent
**Purpose**: Understand actual data structure before implementing frontend normalization layer

## Executive Summary

The `ModeComparison` table is currently **empty** (0 records). This audit documents the expected schema structure based on the database schema and implementation plans.

## Database Query Results

```sql
SELECT COUNT(*) FROM "ModeComparison";
```

**Result**: 0 rows

## Expected Schema Structure

Based on the Prisma schema and implementation plans, the table should contain:

### Core Fields
- `id`: UUID primary key
- `entryId`: Reference to Entry
- `originalMode`: String (e.g., "fast", "deep")
- `comparisonMode`: String (e.g., "fast", "deep")
- `originalDecision`: JSONB (NormalizedAgentIngestDecision)
- `comparisonDecision`: JSONB (NormalizedAgentIngestDecision)
- `scores`: JSONB (dimension scores)
- `createdAt`: Timestamp

### Decision Structure (JSONB)

Each decision object should contain:
- `contentType`: string
- `techDomain`: string
- `aiTags`: string[]
- `confidence`: number | null
- `coreSummary`: string
- `keyPoints`: string[] (legacy) OR `keyPointsNew`: { core: string[], extended: string[] }
- `summaryStructure`: { type: string, fields: Record<string, unknown> }
- `boundaries`: { applicable: string[], notApplicable: string[] }
- `metadata`: { difficulty, sourceTrust, timeliness, contentForm }

## Key Findings

1. **No Production Data**: Table is empty, cannot verify actual field usage patterns
2. **keyPoints Migration**: Need to support both `keyPoints` (legacy array) and `keyPointsNew` (structured object)
3. **summaryStructure.type**: Expected values include "timeline-evolution", "narrative", "generic", etc.

## Recommendations

1. ✅ Implement normalization layer with defensive programming (null safety)
2. ✅ Support backward compatibility for keyPoints field migration
3. ✅ Provide sensible defaults for all fields
4. ⚠️ Add integration tests once comparison data is generated
5. ⚠️ Monitor actual data patterns after feature deployment

## Next Steps

- Proceed with normalization layer implementation
- Create unit tests with mock data covering various scenarios
- Implement frontend components with empty state handling
- Generate test data to validate implementation

---

**Note**: This audit will need to be updated once actual comparison data is available in the database.
