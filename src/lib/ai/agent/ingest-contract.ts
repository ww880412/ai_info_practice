import type {
  ContentForm,
  ContentType,
  Difficulty,
  PracticeValue,
  TechDomain,
  Timeliness,
  TrustLevel,
} from "@prisma/client";

export interface NormalizedPracticeStep {
  order: number;
  title: string;
  description: string;
}

export interface NormalizedPracticeTask {
  title: string;
  summary: string;
  difficulty: Difficulty;
  estimatedTime: string;
  prerequisites: string[];
  steps: NormalizedPracticeStep[];
}

export type SummaryStructureType =
  | "problem-solution-steps"
  | "concept-mechanism-flow"
  | "tool-feature-comparison"
  | "background-result-insight"
  | "argument-evidence-condition"
  | "generic";

export interface NormalizedSummaryStructure {
  type: SummaryStructureType;
  reasoning?: string;
  fields: Record<string, unknown>;
}

export interface NormalizedKeyPoints {
  core: string[];
  extended: string[];
}

export interface NormalizedBoundaries {
  applicable: string[];
  notApplicable: string[];
}

export interface NormalizedAgentIngestDecision {
  contentType: ContentType;
  techDomain: TechDomain;
  aiTags: string[];
  coreSummary: string;
  keyPoints: string[];
  summaryStructure: NormalizedSummaryStructure;
  keyPointsNew: NormalizedKeyPoints;
  boundaries: NormalizedBoundaries;
  confidence: number | null;
  difficulty: Difficulty | null;
  sourceTrust: TrustLevel | null;
  timeliness: Timeliness | null;
  contentForm: ContentForm | null;
  practiceValue: PracticeValue;
  practiceReason: string;
  practiceTask: NormalizedPracticeTask | null;
}

const CONTENT_TYPES: ContentType[] = [
  "TUTORIAL",
  "TOOL_RECOMMENDATION",
  "TECH_PRINCIPLE",
  "CASE_STUDY",
  "OPINION",
];

const TECH_DOMAINS: TechDomain[] = [
  "PROMPT_ENGINEERING",
  "AGENT",
  "RAG",
  "FINE_TUNING",
  "DEPLOYMENT",
  "OTHER",
];

const PRACTICE_VALUES: PracticeValue[] = ["KNOWLEDGE", "ACTIONABLE"];
const DIFFICULTIES: Difficulty[] = ["EASY", "MEDIUM", "HARD"];
const CONTENT_FORMS: ContentForm[] = ["TEXTUAL", "CODE_HEAVY", "VISUAL", "MULTIMODAL"];
const TIMELINESS_VALUES: Timeliness[] = ["RECENT", "OUTDATED", "CLASSIC"];
const TRUST_LEVELS: TrustLevel[] = ["HIGH", "MEDIUM", "LOW"];
const SUMMARY_STRUCTURE_TYPES: SummaryStructureType[] = [
  "problem-solution-steps",
  "concept-mechanism-flow",
  "tool-feature-comparison",
  "background-result-insight",
  "argument-evidence-condition",
  "generic",
];

function toStringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeToken(value: unknown): string {
  return toStringValue(value)
    .replace(/[`"'“”‘’]/g, "")
    .trim()
    .toUpperCase()
    .replace(/[-\s]+/g, "_");
}

function toObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const attempts = [trimmed];
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (jsonMatch?.[0] && jsonMatch[0] !== trimmed) {
    attempts.push(jsonMatch[0]);
  }

  for (const attempt of attempts) {
    try {
      const parsed = JSON.parse(attempt);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Continue trying.
    }
  }

  return null;
}

function normalizeStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => toStringValue(item))
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/[\n,;，；]/g)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    output.push(value);
  }

  return output;
}

function normalizeContentType(value: unknown): ContentType | null {
  const token = normalizeToken(value);
  if (CONTENT_TYPES.includes(token as ContentType)) {
    return token as ContentType;
  }

  const raw = toStringValue(value).toLowerCase();
  if (!raw) return null;
  if (/tutorial|how[\s-]?to|教程|指南|步骤/.test(raw)) return "TUTORIAL";
  if (/tool|resource|插件|工具|推荐/.test(raw)) return "TOOL_RECOMMENDATION";
  if (/case|study|案例|实战/.test(raw)) return "CASE_STUDY";
  if (/opinion|view|观点|评论/.test(raw)) return "OPINION";
  if (/principle|concept|原理|概念|知识|理论/.test(raw)) return "TECH_PRINCIPLE";
  return null;
}

function normalizeTechDomain(value: unknown): TechDomain | null {
  const token = normalizeToken(value);
  if (TECH_DOMAINS.includes(token as TechDomain)) {
    return token as TechDomain;
  }

  const raw = toStringValue(value).toLowerCase();
  if (!raw) return null;
  if (/prompt/.test(raw) || /提示/.test(raw)) return "PROMPT_ENGINEERING";
  if (/agent/.test(raw) || /智能体/.test(raw)) return "AGENT";
  if (/rag/.test(raw) || /检索增强/.test(raw)) return "RAG";
  if (/fine[\s-]?tun|微调/.test(raw)) return "FINE_TUNING";
  if (/deploy|infra|ops|生产|上线|部署/.test(raw)) return "DEPLOYMENT";
  return "OTHER";
}

function normalizePracticeValue(value: unknown): PracticeValue | null {
  const token = normalizeToken(value);
  if (PRACTICE_VALUES.includes(token as PracticeValue)) {
    return token as PracticeValue;
  }

  const raw = toStringValue(value).toLowerCase();
  if (!raw) return null;
  if (/action|practice|hands[\s-]?on|可实践|可落地|实操/.test(raw)) {
    return "ACTIONABLE";
  }
  if (/knowledge|learn|阅读|了解|知识/.test(raw)) {
    return "KNOWLEDGE";
  }
  return null;
}

function normalizeDifficulty(value: unknown): Difficulty {
  const token = normalizeToken(value);
  if (DIFFICULTIES.includes(token as Difficulty)) {
    return token as Difficulty;
  }

  const raw = toStringValue(value).toLowerCase();
  if (!raw) return "MEDIUM";
  if (/easy|beginner|entry|基础|入门/.test(raw)) return "EASY";
  if (/hard|advanced|expert|困难|复杂/.test(raw)) return "HARD";
  return "MEDIUM";
}

function normalizePracticeTask(value: unknown): NormalizedPracticeTask | null {
  const record = toObject(value);
  if (!record) return null;

  const rawSteps = Array.isArray(record.steps) ? record.steps : [];
  const steps: NormalizedPracticeStep[] = rawSteps
    .map((step, index) => {
      if (typeof step === "string") {
        const title = step.trim();
        if (!title) return null;
        return { order: index + 1, title, description: "" };
      }

      const item = toObject(step);
      if (!item) return null;
      const title = toStringValue(item.title);
      if (!title) return null;

      const orderCandidate = item.order;
      const order =
        typeof orderCandidate === "number" && Number.isFinite(orderCandidate)
          ? orderCandidate
          : index + 1;

      return {
        order,
        title,
        description: toStringValue(item.description),
      };
    })
    .filter((step): step is NormalizedPracticeStep => Boolean(step))
    .sort((a, b) => a.order - b.order);

  if (steps.length === 0) return null;

  return {
    title: toStringValue(record.title) || "Practice Task",
    summary: toStringValue(record.summary),
    difficulty: normalizeDifficulty(record.difficulty),
    estimatedTime: toStringValue(record.estimatedTime) || "30-60 min",
    prerequisites: normalizeStringList(record.prerequisites),
    steps,
  };
}

function normalizeSummaryStructureType(value: unknown): SummaryStructureType | null {
  const normalized = toStringValue(value).toLowerCase().trim();
  if (!normalized) return null;
  if (SUMMARY_STRUCTURE_TYPES.includes(normalized as SummaryStructureType)) {
    return normalized as SummaryStructureType;
  }
  return null;
}

function normalizeOptionalDifficulty(value: unknown): Difficulty | null {
  const raw = toStringValue(value);
  if (!raw) return null;
  return normalizeDifficulty(raw);
}

function normalizeTimeliness(value: unknown): Timeliness | null {
  const token = normalizeToken(value);
  if (TIMELINESS_VALUES.includes(token as Timeliness)) {
    return token as Timeliness;
  }

  const raw = toStringValue(value).toLowerCase();
  if (!raw) return null;
  if (/recent|new|latest|近期|最新/.test(raw)) return "RECENT";
  if (/classic|timeless|经典/.test(raw)) return "CLASSIC";
  if (/outdated|old|过时/.test(raw)) return "OUTDATED";
  return null;
}

function normalizeTrustLevel(value: unknown): TrustLevel | null {
  const token = normalizeToken(value);
  if (TRUST_LEVELS.includes(token as TrustLevel)) {
    return token as TrustLevel;
  }

  const raw = toStringValue(value).toLowerCase();
  if (!raw) return null;
  if (/high|authoritative|权威|高/.test(raw)) return "HIGH";
  if (/medium|一般|中/.test(raw)) return "MEDIUM";
  if (/low|questionable|低/.test(raw)) return "LOW";
  return null;
}

function normalizeContentForm(value: unknown): ContentForm | null {
  const token = normalizeToken(value);
  if (CONTENT_FORMS.includes(token as ContentForm)) {
    return token as ContentForm;
  }

  const raw = toStringValue(value).toLowerCase();
  if (!raw) return null;
  if (/code|代码/.test(raw)) return "CODE_HEAVY";
  if (/visual|图|diagram/.test(raw)) return "VISUAL";
  if (/multi|混合/.test(raw)) return "MULTIMODAL";
  if (/text|文本/.test(raw)) return "TEXTUAL";
  return null;
}

function normalizeConfidence(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  if (value < 0 || value > 1) {
    return null;
  }
  return Number(value.toFixed(4));
}

function normalizeKeyPoints(value: unknown, coreSummary: string): {
  flat: string[];
  structured: NormalizedKeyPoints;
} {
  const record = toObject(value);
  if (record) {
    const core = normalizeStringList(record.core);
    const extended = normalizeStringList(record.extended);
    const flat = [...core, ...extended];
    if (flat.length > 0) {
      return {
        flat,
        structured: { core, extended },
      };
    }
  }

  const legacyList = normalizeStringList(value);
  if (legacyList.length > 0) {
    return {
      flat: legacyList,
      structured: { core: legacyList, extended: [] },
    };
  }

  return {
    flat: [coreSummary],
    structured: { core: [coreSummary], extended: [] },
  };
}

function normalizeBoundaries(value: unknown): NormalizedBoundaries {
  const record = toObject(value);
  if (!record) {
    return { applicable: [], notApplicable: [] };
  }

  return {
    applicable: normalizeStringList(record.applicable),
    notApplicable: normalizeStringList(record.notApplicable),
  };
}

function buildFallbackSummaryFields(coreSummary: string, keyPoints: string[]): Record<string, unknown> {
  return {
    summary: coreSummary,
    keyPoints,
  };
}

function normalizeSummaryStructure(
  value: unknown,
  coreSummary: string,
  keyPoints: string[]
): NormalizedSummaryStructure {
  const fallbackFields = buildFallbackSummaryFields(coreSummary, keyPoints);
  const record = toObject(value);

  if (!record) {
    return {
      type: "generic",
      fields: fallbackFields,
    };
  }

  const type = normalizeSummaryStructureType(record.type) ?? "generic";
  const fields = toObject(record.fields) ?? fallbackFields;
  const reasoning = toStringValue(record.reasoning) || undefined;

  return {
    type,
    fields,
    reasoning,
  };
}

export function normalizeAgentIngestDecision(
  finalResult: unknown
): NormalizedAgentIngestDecision | null {
  const record = toObject(finalResult);
  if (!record) return null;

  const contentType = normalizeContentType(record.contentType);
  const techDomain = normalizeTechDomain(record.techDomain);
  const practiceValue = normalizePracticeValue(record.practiceValue);
  const coreSummary = toStringValue(record.coreSummary);

  if (!contentType || !techDomain || !practiceValue || !coreSummary) {
    return null;
  }

  const normalizedKeyPoints = normalizeKeyPoints(record.keyPoints, coreSummary);
  const aiTags = dedupeStrings(
    normalizeStringList(record.aiTags).length > 0
      ? normalizeStringList(record.aiTags)
      : normalizeStringList(record.tags)
  );
  const summaryStructure = normalizeSummaryStructure(
    record.summaryStructure,
    coreSummary,
    normalizedKeyPoints.flat
  );
  const boundaries = normalizeBoundaries(record.boundaries);
  const confidence = normalizeConfidence(record.confidence);
  const difficulty = normalizeOptionalDifficulty(record.difficulty);
  const sourceTrust = normalizeTrustLevel(record.sourceTrust);
  const timeliness = normalizeTimeliness(record.timeliness);
  const contentForm = normalizeContentForm(record.contentForm);

  const practiceTask = normalizePracticeTask(
    record.practiceTask ?? record.practice ?? record.task
  );

  return {
    contentType,
    techDomain,
    aiTags,
    coreSummary,
    keyPoints: normalizedKeyPoints.flat,
    summaryStructure,
    keyPointsNew: normalizedKeyPoints.structured,
    boundaries,
    confidence,
    difficulty,
    sourceTrust,
    timeliness,
    contentForm,
    practiceValue,
    practiceReason: toStringValue(record.practiceReason),
    practiceTask,
  };
}
