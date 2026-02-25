export type ConfidenceLevel = "high" | "medium" | "low";
export type SourceType = "ai" | "user" | "system";

interface SummaryMeta {
  fieldConfidence?: Record<string, ConfidenceLevel>;
  fieldSourceMap?: Record<string, SourceType>;
}

interface SummaryStructure {
  type?: string;
  fields?: Record<string, unknown>;
  meta?: SummaryMeta;
}

export interface MetadataRow {
  key: string;
  label: string;
  value: string;
  confidence: ConfidenceLevel | null;
  source: SourceType;
}

interface BuildMetadataRowsInput {
  summaryStructure?: SummaryStructure | null;
  coreSummary?: string | null;
  keyPoints?: unknown;
  boundaries?: unknown;
  hasPracticeTask?: boolean;
  hasRelatedEntries?: boolean;
  confidence?: number | null;
}

const FIELD_DEFS: Array<{ key: string; label: string }> = [
  { key: "keyPoints", label: "Key Points" },
  { key: "summaryStructure", label: "Summary Structure" },
  { key: "boundaries", label: "Boundaries" },
  { key: "practiceTask", label: "Practice Task" },
  { key: "relatedEntries", label: "Related Entries" },
  { key: "confidence", label: "Confidence" },
];

export function buildMetadataRows(input: BuildMetadataRowsInput): MetadataRow[] {
  const structure = input.summaryStructure ?? undefined;
  const fields = structure?.fields ?? {};
  const confidenceMap = structure?.meta?.fieldConfidence ?? {};
  const sourceMap = structure?.meta?.fieldSourceMap ?? {};
  const globalConfidence = deriveConfidenceLevel(input.confidence);

  const rows: MetadataRow[] = [];

  for (const def of FIELD_DEFS) {
    const value = getFieldValue(def.key, input, fields, structure);
    if (!value) continue;

    rows.push({
      key: def.key,
      label: def.label,
      value,
      confidence: confidenceMap[def.key] ?? globalConfidence,
      source: sourceMap[def.key] ?? "ai",
    });
  }

  return rows;
}

function deriveConfidenceLevel(value?: number | null): ConfidenceLevel | null {
  if (value === null || value === undefined) return null;
  if (value >= 0.75) return "high";
  if (value >= 0.45) return "medium";
  return "low";
}

function getFieldValue(
  key: string,
  input: BuildMetadataRowsInput,
  fields: Record<string, unknown>,
  structure?: SummaryStructure
): string | null {
  switch (key) {
    case "keyPoints": {
      const points = extractKeyPoints(input.keyPoints ?? fields.keyPoints);
      if (points.length === 0) return null;
      return points.map((point) => `• ${point}`).join("\n");
    }

    case "summaryStructure": {
      if (!structure?.type) return null;
      const fieldCount = Object.keys(structure.fields ?? {}).length;
      return fieldCount > 0
        ? `${structure.type} (${fieldCount} fields)`
        : structure.type;
    }

    case "boundaries": {
      const boundary = parseBoundaries(input.boundaries ?? fields.boundaries);
      if (!boundary) return null;
      const { applicableCount, notApplicableCount } = boundary;
      return `Applicable ${applicableCount} / Not applicable ${notApplicableCount}`;
    }

    case "practiceTask": {
      return input.hasPracticeTask ? "Available" : null;
    }

    case "relatedEntries": {
      return input.hasRelatedEntries ? "Available" : null;
    }

    case "confidence": {
      if (input.confidence === null || input.confidence === undefined) return null;
      return `${Math.round(input.confidence * 100)}%`;
    }

    default:
      return null;
  }
}

function extractKeyPoints(value: unknown): string[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof value === "object" && value !== null) {
    const maybe = value as { core?: unknown; extended?: unknown };
    const core = Array.isArray(maybe.core)
      ? maybe.core.filter((item): item is string => typeof item === "string")
      : [];
    const extended = Array.isArray(maybe.extended)
      ? maybe.extended.filter((item): item is string => typeof item === "string")
      : [];

    return [...core, ...extended]
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function parseBoundaries(value: unknown): { applicableCount: number; notApplicableCount: number } | null {
  if (!value || typeof value !== "object") return null;

  const boundaries = value as {
    applicable?: unknown;
    notApplicable?: unknown;
  };

  const applicableCount = Array.isArray(boundaries.applicable)
    ? boundaries.applicable.length
    : 0;
  const notApplicableCount = Array.isArray(boundaries.notApplicable)
    ? boundaries.notApplicable.length
    : 0;

  if (applicableCount === 0 && notApplicableCount === 0) return null;

  return {
    applicableCount,
    notApplicableCount,
  };
}
