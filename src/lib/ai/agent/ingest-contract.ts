import type {
  ContentForm,
  ContentType,
  Difficulty,
  PracticeValue,
  TechDomain,
  Timeliness,
  TrustLevel,
} from "@prisma/client";
import type { ExtractedMetadata } from "./schemas";

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
  | "generic"
  | "api-reference"
  | "comparison-matrix"
  | "timeline-evolution";

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
  extractedMetadata?: ExtractedMetadata;
}

interface NormalizeAgentDecisionOptions {
  contentLength?: number;
}

interface DecisionLanguageOptions {
  maxEnglishRatio?: number;
}

interface DecisionQualityOptions {
  contentLength?: number;
  minScore?: number;
}

export interface DecisionQualityReport {
  score: number;
  issues: string[];
  metrics: {
    coreSummaryLength: number;
    summaryFieldCount: number;
    keyPointsCoreCount: number;
    keyPointsExtendedCount: number;
    boundariesApplicableCount: number;
    boundariesNotApplicableCount: number;
    practiceTaskStepsCount: number;
  };
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
  "api-reference",
  "comparison-matrix",
  "timeline-evolution",
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

function clampString(value: string, maxLength = 180): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function collectTextValues(value: unknown, depth = 0): string[] {
  if (depth > 3) return [];

  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized ? [normalized] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectTextValues(item, depth + 1));
  }

  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap((item) =>
      collectTextValues(item, depth + 1)
    );
  }

  return [];
}

function stripTechnicalTermsForLanguageCheck(text: string): string {
  const patterns: RegExp[] = [
    /\b[A-Z]{2,10}\b/g, // Acronyms like RAG/LLM/API
    /\b[A-Za-z]+(?:[-_/.][A-Za-z0-9]+)+\b/g, // feature-dev, vllm/v1
    /\b(?:v?\d+(?:\.\d+){0,2})\b/gi, // versions such as v2.5 / 1.0
    /`[^`]+`/g, // code snippets
  ];

  return patterns.reduce((current, pattern) => current.replace(pattern, " "), text);
}

function buildDecisionLanguageSample(
  decision: NormalizedAgentIngestDecision
): string {
  const texts: string[] = [
    decision.coreSummary,
    decision.practiceReason,
    ...decision.keyPoints,
    ...decision.keyPointsNew.core,
    ...decision.keyPointsNew.extended,
    ...decision.boundaries.applicable,
    ...decision.boundaries.notApplicable,
    ...(decision.summaryStructure.reasoning ? [decision.summaryStructure.reasoning] : []),
    ...collectTextValues(decision.summaryStructure.fields),
  ];

  if (decision.practiceTask) {
    texts.push(
      decision.practiceTask.title,
      decision.practiceTask.summary,
      ...decision.practiceTask.prerequisites
    );
    for (const step of decision.practiceTask.steps) {
      texts.push(step.title, step.description);
    }
  }

  return texts.join("\n");
}

export function calculateDecisionEnglishRatio(
  decision: NormalizedAgentIngestDecision
): number {
  const sample = stripTechnicalTermsForLanguageCheck(
    buildDecisionLanguageSample(decision)
  );
  const zh = (sample.match(/[\u4e00-\u9fff]/g) || []).length;
  const en = (sample.match(/[A-Za-z]/g) || []).length;
  const total = zh + en;
  if (total === 0) return 0;
  return Number((en / total).toFixed(4));
}

export function isDecisionMostlyChinese(
  decision: NormalizedAgentIngestDecision,
  options: DecisionLanguageOptions = {}
): boolean {
  const maxEnglishRatio = options.maxEnglishRatio ?? 0.35;
  return calculateDecisionEnglishRatio(decision) <= maxEnglishRatio;
}

function parseSummaryFieldCount(
  summaryStructure: NormalizedSummaryStructure
): number {
  const fields = summaryStructure.fields;
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) return 0;
  return Object.keys(fields).length;
}

function getSummaryLengthTarget(contentLength?: number): number {
  if (!contentLength || !Number.isFinite(contentLength) || contentLength <= 0) {
    return 60;
  }
  if (contentLength < 5000) return 60;
  if (contentLength <= 20000) return 90;
  return 120;
}

function getQualityKeyPointTarget(contentLength?: number): {
  minCore: number;
  minExtended: number;
} {
  const target = getKeyPointDensityTarget(contentLength);
  if (!target) return { minCore: 3, minExtended: 1 };
  return { minCore: target.minCore, minExtended: target.minExtended };
}

export function evaluateDecisionQuality(
  decision: NormalizedAgentIngestDecision,
  options: DecisionQualityOptions = {}
): DecisionQualityReport {
  const issues: string[] = [];
  let passedChecks = 0;
  const checks: boolean[] = [];

  const coreSummaryLength = decision.coreSummary.length;
  const summaryFieldCount = parseSummaryFieldCount(decision.summaryStructure);
  const keyPointsCoreCount = decision.keyPointsNew.core.length;
  const keyPointsExtendedCount = decision.keyPointsNew.extended.length;
  const boundariesApplicableCount = decision.boundaries.applicable.length;
  const boundariesNotApplicableCount = decision.boundaries.notApplicable.length;
  const practiceTaskStepsCount = decision.practiceTask?.steps.length ?? 0;

  const summaryLengthTarget = getSummaryLengthTarget(options.contentLength);
  const keyPointTarget = getQualityKeyPointTarget(options.contentLength);

  checks.push(coreSummaryLength >= summaryLengthTarget);
  if (coreSummaryLength < summaryLengthTarget) {
    issues.push(
      `coreSummary too short (${coreSummaryLength} < ${summaryLengthTarget})`
    );
  }

  checks.push(summaryFieldCount >= 2);
  if (summaryFieldCount < 2) {
    issues.push(`summaryStructure fields too sparse (${summaryFieldCount})`);
  }

  checks.push(keyPointsCoreCount >= keyPointTarget.minCore);
  if (keyPointsCoreCount < keyPointTarget.minCore) {
    issues.push(
      `core key points too few (${keyPointsCoreCount} < ${keyPointTarget.minCore})`
    );
  }

  checks.push(keyPointsExtendedCount >= keyPointTarget.minExtended);
  if (keyPointsExtendedCount < keyPointTarget.minExtended) {
    issues.push(
      `extended key points too few (${keyPointsExtendedCount} < ${keyPointTarget.minExtended})`
    );
  }

  checks.push(
    boundariesApplicableCount >= 1 && boundariesNotApplicableCount >= 1
  );
  if (boundariesApplicableCount < 1 || boundariesNotApplicableCount < 1) {
    issues.push(
      `boundaries incomplete (applicable=${boundariesApplicableCount}, notApplicable=${boundariesNotApplicableCount})`
    );
  }

  if (decision.practiceValue === "ACTIONABLE") {
    checks.push(Boolean(decision.practiceTask && practiceTaskStepsCount >= 2));
    if (!decision.practiceTask) {
      issues.push("practiceTask missing for ACTIONABLE content");
    } else if (practiceTaskStepsCount < 2) {
      issues.push(`practiceTask steps too few (${practiceTaskStepsCount} < 2)`);
    }
  }

  for (const check of checks) {
    if (check) passedChecks += 1;
  }
  const score = checks.length > 0 ? Number((passedChecks / checks.length).toFixed(4)) : 0;

  return {
    score,
    issues,
    metrics: {
      coreSummaryLength,
      summaryFieldCount,
      keyPointsCoreCount,
      keyPointsExtendedCount,
      boundariesApplicableCount,
      boundariesNotApplicableCount,
      practiceTaskStepsCount,
    },
  };
}

export function isDecisionStructurallyComplete(
  decision: NormalizedAgentIngestDecision,
  options: DecisionQualityOptions = {}
): boolean {
  const minScore = options.minScore ?? 0.72;
  const report = evaluateDecisionQuality(decision, options);
  return report.score >= minScore;
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

function collectStringCandidates(value: unknown, depth = 0): string[] {
  if (depth > 2) return [];

  if (typeof value === "string") {
    const normalized = value.replace(/\s+/g, " ").trim();
    if (normalized.length < 6) return [];
    return [clampString(normalized)];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectStringCandidates(item, depth + 1));
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const preferred = [
      toStringValue(record.title),
      toStringValue(record.description),
      toStringValue(record.summary),
      toStringValue(record.reasoning),
    ].filter(Boolean);

    const nested = Object.values(record).flatMap((item) =>
      collectStringCandidates(item, depth + 1)
    );

    return [...preferred.map((item) => clampString(item)), ...nested];
  }

  return [];
}

function splitSentenceCandidates(value: string): string[] {
  return value
    .split(/[。！？!?；;：:\n]+/g)
    .map((item) => item.trim())
    .filter((item) => item.length >= 6)
    .map((item) => clampString(item));
}

function getKeyPointDensityTarget(
  contentLength?: number
): { minCore: number; maxCore: number; minExtended: number; maxExtended: number } | null {
  if (typeof contentLength !== "number" || !Number.isFinite(contentLength) || contentLength <= 0) {
    return null;
  }

  if (contentLength < 5000) {
    return { minCore: 3, maxCore: 5, minExtended: 1, maxExtended: 2 };
  }

  if (contentLength <= 20000) {
    return { minCore: 5, maxCore: 8, minExtended: 2, maxExtended: 4 };
  }

  return { minCore: 8, maxCore: 12, minExtended: 4, maxExtended: 8 };
}

function buildDensityCandidates(params: {
  coreSummary: string;
  practiceReason: string;
  summaryStructure: NormalizedSummaryStructure;
  boundaries: NormalizedBoundaries;
  practiceTask: NormalizedPracticeTask | null;
}): string[] {
  const candidates = [
    ...collectStringCandidates(params.summaryStructure.fields),
    ...collectStringCandidates(params.boundaries.applicable),
    ...collectStringCandidates(params.boundaries.notApplicable),
    ...collectStringCandidates(
      params.practiceTask
        ? params.practiceTask.steps.map((step) => `${step.title}：${step.description}`)
        : []
    ),
    ...splitSentenceCandidates(params.practiceReason),
    ...splitSentenceCandidates(params.coreSummary),
  ];

  return dedupeStrings(candidates);
}

function enforceKeyPointDensity(params: {
  keyPoints: NormalizedKeyPoints;
  coreSummary: string;
  practiceReason: string;
  summaryStructure: NormalizedSummaryStructure;
  boundaries: NormalizedBoundaries;
  practiceTask: NormalizedPracticeTask | null;
  contentLength?: number;
}): NormalizedKeyPoints {
  const target = getKeyPointDensityTarget(params.contentLength);
  if (!target) {
    return {
      core: dedupeStrings(params.keyPoints.core),
      extended: dedupeStrings(params.keyPoints.extended),
    };
  }

  const core = dedupeStrings(params.keyPoints.core);
  const extended = dedupeStrings(params.keyPoints.extended);

  while (core.length < target.minCore && extended.length > 0) {
    core.push(extended.shift() as string);
  }

  const used = new Set<string>([...core, ...extended]);
  const candidates = buildDensityCandidates({
    coreSummary: params.coreSummary,
    practiceReason: params.practiceReason,
    summaryStructure: params.summaryStructure,
    boundaries: params.boundaries,
    practiceTask: params.practiceTask,
  });

  for (const candidate of candidates) {
    if (used.has(candidate)) continue;

    if (core.length < target.minCore) {
      core.push(candidate);
      used.add(candidate);
      continue;
    }

    if (extended.length < target.minExtended) {
      extended.push(candidate);
      used.add(candidate);
    }

    if (core.length >= target.minCore && extended.length >= target.minExtended) {
      break;
    }
  }

  return {
    core: core.slice(0, target.maxCore),
    extended: extended.slice(0, target.maxExtended),
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
  finalResult: unknown,
  options: NormalizeAgentDecisionOptions = {}
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

  const densifiedKeyPoints = enforceKeyPointDensity({
    keyPoints: normalizedKeyPoints.structured,
    coreSummary,
    practiceReason: toStringValue(record.practiceReason),
    summaryStructure,
    boundaries,
    practiceTask,
    contentLength: options.contentLength,
  });
  const flatKeyPoints = dedupeStrings([
    ...densifiedKeyPoints.core,
    ...densifiedKeyPoints.extended,
  ]);

  return {
    contentType,
    techDomain,
    aiTags,
    coreSummary,
    keyPoints: flatKeyPoints,
    summaryStructure,
    keyPointsNew: densifiedKeyPoints,
    boundaries,
    confidence,
    difficulty,
    sourceTrust,
    timeliness,
    contentForm,
    practiceValue,
    practiceReason: toStringValue(record.practiceReason),
    practiceTask,
    extractedMetadata: toObject(record.extractedMetadata) as ExtractedMetadata | undefined,
  };
}
