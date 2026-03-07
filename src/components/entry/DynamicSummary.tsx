/**
 * Dynamic Summary Components
 * 根据 summaryStructure.type 动态渲染不同的展示组件
 */

import type { Difficulty } from '@prisma/client';

// Types matching Prisma schema
export interface SummaryStructure {
  type: SummaryStructureType;
  reasoning?: string;
  fields: Record<string, unknown>;
}

export type SummaryStructureType =
  | 'problem-solution-steps'
  | 'concept-mechanism-flow'
  | 'tool-feature-comparison'
  | 'background-result-insight'
  | 'argument-evidence-condition'
  | 'generic'
  | 'api-reference'
  | 'comparison-matrix'
  | 'timeline-evolution';

export interface KeyPointsData {
  core: string[];
  extended?: string[];
}

export interface BoundariesData {
  applicable: string[];
  notApplicable?: string[];
}

interface DynamicSummaryProps {
  summaryStructure?: SummaryStructure | null;
  keyPoints?: KeyPointsData | string[] | null;
  boundaries?: BoundariesData | null;
  difficulty?: Difficulty | null;
  confidence?: number | null;
}

// Sub-components
import { ProblemSolutionSteps } from './ProblemSolutionSteps';
import { ConceptMechanismFlow } from './ConceptMechanismFlow';
import { ToolFeatureComparison } from './ToolFeatureComparison';
import { BackgroundResultInsight } from './BackgroundResultInsight';
import { ArgumentEvidenceCondition } from './ArgumentEvidenceCondition';
import { GenericSummary } from './GenericSummary';
import { ApiReference } from './ApiReference';
import { ComparisonMatrix } from './ComparisonMatrix';
import { TimelineEvolution } from './TimelineEvolution';

// Difficulty colors
const difficultyColors: Record<string, string> = {
  EASY: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  MEDIUM: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  HARD: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

const difficultyLabels: Record<string, string> = {
  EASY: 'Easy',
  MEDIUM: 'Medium',
  HARD: 'Hard',
};

// Confidence display
function ConfidenceBadge({ confidence }: { confidence: number }) {
  const color = confidence >= 0.7 ? 'bg-green-100 text-green-700'
    : confidence >= 0.5 ? 'bg-yellow-100 text-yellow-700'
    : 'bg-red-100 text-red-700';

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>
      {Math.round(confidence * 100)}% confidence
    </span>
  );
}

// Key Points display
function KeyPointsDisplay({ keyPoints }: { keyPoints: KeyPointsData | string[] | null | undefined }) {
  if (!keyPoints) return null;

  // Handle legacy string[] format
  const isLegacyArray = Array.isArray(keyPoints);
  const core = isLegacyArray ? keyPoints : keyPoints.core || [];
  const extended = isLegacyArray ? [] : keyPoints.extended || [];

  if (core.length === 0 && extended.length === 0) return null;

  return (
    <div className="mt-4">
      <h4 className="text-sm font-medium mb-2">Key Points</h4>
      <ul className="space-y-1">
        {core.map((point, idx) => (
          <li key={`core-${idx}`} className="flex items-start gap-2">
            <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 rounded font-medium shrink-0">
              Core
            </span>
            <span className="text-sm text-foreground">{point}</span>
          </li>
        ))}
        {extended.map((point, idx) => (
          <li key={`extended-${idx}`} className="flex items-start gap-2 ml-16">
            <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 rounded shrink-0">
              Extended
            </span>
            <span className="text-sm text-secondary">{point}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Boundaries display
function BoundariesDisplay({ boundaries }: { boundaries: BoundariesData | null | undefined }) {
  if (!boundaries || (!boundaries.applicable?.length && !boundaries.notApplicable?.length)) {
    return null;
  }

  return (
    <div className="mt-4 grid grid-cols-2 gap-4">
      {(boundaries.applicable?.length ?? 0) > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            Applicable
          </h4>
          <ul className="space-y-1">
            {boundaries.applicable?.map((item, idx) => (
              <li key={idx} className="text-sm text-green-700 dark:text-green-400">
                • {item}
              </li>
            ))}
          </ul>
        </div>
      )}
      {(boundaries.notApplicable?.length ?? 0) > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            Not Applicable
          </h4>
          <ul className="space-y-1">
            {boundaries.notApplicable?.map((item, idx) => (
              <li key={idx} className="text-sm text-red-700 dark:text-red-400">
                • {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// Main component
export function DynamicSummary({
  summaryStructure,
  keyPoints,
  boundaries,
  difficulty,
  confidence,
}: DynamicSummaryProps) {
  if (!summaryStructure) {
    // No dynamic summary, return null to use legacy display
    return null;
  }

  const { type, fields, reasoning } = summaryStructure;

  const toObject = (value: unknown): Record<string, unknown> | null => {
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return null;
  };

  const toString = (value: unknown): string => (typeof value === "string" ? value : "");
  const toStringArray = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

  const parseProblemSolutionSteps = (value: unknown) => {
    const record = toObject(value);
    if (!record) return null;
    const stepsRaw = Array.isArray(record.steps) ? record.steps : [];
    type ParsedStep = { order: number; title: string; description: string | undefined };
    const steps = stepsRaw
      .map((step, index) => {
        const stepRecord = toObject(step);
        if (!stepRecord) return null;
        const title = toString(stepRecord.title);
        if (!title) return null;
        const order = typeof stepRecord.order === "number" ? stepRecord.order : index + 1;
        return {
          order,
          title,
          description: toString(stepRecord.description) || undefined,
        };
      })
      .filter((step): step is ParsedStep => step !== null);

    if (!toString(record.problem) || !toString(record.solution) || steps.length === 0) {
      return null;
    }

    return {
      problem: toString(record.problem),
      solution: toString(record.solution),
      steps,
      tips: toString(record.tips) || undefined,
    };
  };

  const parseConceptMechanismFlow = (value: unknown) => {
    const record = toObject(value);
    if (!record) return null;
    if (!toString(record.concept) || !toString(record.mechanism)) return null;
    return {
      concept: toString(record.concept),
      mechanism: toString(record.mechanism),
      flow: toStringArray(record.flow),
      boundary: toString(record.boundary) || undefined,
    };
  };

  const parseToolFeatureComparison = (value: unknown) => {
    const record = toObject(value);
    if (!record) return null;
    if (!toString(record.tool)) return null;
    return {
      tool: toString(record.tool),
      features: toStringArray(record.features),
      pros: toStringArray(record.pros),
      cons: toStringArray(record.cons),
      scenarios: toStringArray(record.scenarios),
    };
  };

  const parseBackgroundResultInsight = (value: unknown) => {
    const record = toObject(value);
    if (!record) return null;
    if (!toString(record.background) || !toString(record.result)) return null;
    return {
      background: toString(record.background),
      result: toString(record.result),
      insights: toStringArray(record.insights),
    };
  };

  const parseArgumentEvidenceCondition = (value: unknown) => {
    const record = toObject(value);
    if (!record) return null;
    if (!toString(record.argument)) return null;
    return {
      argument: toString(record.argument),
      evidence: toStringArray(record.evidence),
      conditions: toStringArray(record.conditions),
    };
  };

  const parseGenericSummary = (value: unknown) => {
    const record = toObject(value);
    if (!record) return null;
    return {
      summary: toString(record.summary) || undefined,
      keyPoints: toStringArray(record.keyPoints),
    };
  };

  const parseApiReference = (value: unknown) => {
    const record = toObject(value);
    if (!record) return null;

    const parameters = Array.isArray(record.parameters)
      ? record.parameters.map((p) => {
          const param = toObject(p);
          if (!param) return null;
          return {
            name: toString(param.name),
            type: toString(param.type),
            required: Boolean(param.required),
            description: toString(param.description),
          };
        }).filter((p): p is NonNullable<typeof p> => p !== null)
      : undefined;

    const examples = Array.isArray(record.examples)
      ? record.examples.map((e) => {
          const example = toObject(e);
          if (!example) return null;
          return {
            title: toString(example.title),
            code: toString(example.code),
            language: toString(example.language) || undefined,
          };
        }).filter((e): e is NonNullable<typeof e> => e !== null)
      : undefined;

    const errorCodes = Array.isArray(record.errorCodes)
      ? record.errorCodes.map((ec) => {
          const errorCode = toObject(ec);
          if (!errorCode) return null;
          return {
            code: toString(errorCode.code),
            description: toString(errorCode.description),
          };
        }).filter((ec): ec is NonNullable<typeof ec> => ec !== null)
      : undefined;

    return {
      endpoint: toString(record.endpoint) || undefined,
      parameters,
      returnValue: toString(record.returnValue) || undefined,
      examples,
      errorCodes,
    };
  };

  const parseComparisonMatrix = (value: unknown) => {
    const record = toObject(value);
    if (!record) return null;

    const items = Array.isArray(record.items)
      ? record.items.map((i) => {
          const item = toObject(i);
          if (!item) return null;
          return {
            name: toString(item.name),
            description: toString(item.description) || undefined,
          };
        }).filter((i): i is NonNullable<typeof i> => i !== null)
      : [];

    const dimensions = toStringArray(record.dimensions);

    const matrix = toObject(record.matrix);
    const matrixData: Record<string, Record<string, string>> = {};
    if (matrix) {
      for (const [key, value] of Object.entries(matrix)) {
        const innerRecord = toObject(value);
        if (innerRecord) {
          matrixData[key] = {};
          for (const [innerKey, innerValue] of Object.entries(innerRecord)) {
            matrixData[key][innerKey] = toString(innerValue);
          }
        }
      }
    }

    if (items.length === 0 || dimensions.length === 0) return null;

    return {
      items,
      dimensions,
      matrix: matrixData,
      recommendation: toString(record.recommendation) || undefined,
    };
  };

  const parseTimelineEvolution = (value: unknown) => {
    const record = toObject(value);
    if (!record) return null;

    const timelineDetailLabels: Array<[string, string]> = [
      ['initialApproach', 'Initial Approach'],
      ['problem', 'Problem'],
      ['iteration', 'Iteration'],
      ['finalChoice', 'Final Choice'],
      ['result', 'Result'],
    ];

    const events = Array.isArray(record.events)
      ? record.events.map((e, index) => {
          const event = toObject(e);
          if (!event) return null;

          const stage = toString(event.stage);
          const date = toString(event.date);
          const title = toString(event.title);
          const description = toString(event.description);
          const significance = toString(event.significance);

          if (stage) {
            const details = timelineDetailLabels
              .map(([key, label]) => {
                const detailValue = toString(event[key]);
                if (!detailValue) return null;
                return {
                  label,
                  value: detailValue,
                };
              })
              .filter((detail): detail is NonNullable<typeof detail> => detail !== null);

            if (details.length === 0) return null;

            return {
              marker: stage,
              markerVariant: 'stage' as const,
              version: toString(event.version) || undefined,
              details,
            };
          }

          if (!date && !title && !description) {
            return null;
          }

          return {
            marker: date || `Event ${index + 1}`,
            markerVariant: 'date' as const,
            version: toString(event.version) || undefined,
            title: title || undefined,
            description: description || undefined,
            significance: (['major', 'minor', 'patch'].includes(significance)
              ? significance as 'major' | 'minor' | 'patch'
              : undefined),
          };
        }).filter((e): e is NonNullable<typeof e> => e !== null)
      : [];

    if (events.length === 0) return null;

    return {
      events,
      currentStatus: toString(record.currentStatus) || undefined,
      futureOutlook: toString(record.futureOutlook) || undefined,
    };
  };

  // Render appropriate component based on type
  const renderStructure = () => {
    switch (type) {
      case 'problem-solution-steps': {
        const data = parseProblemSolutionSteps(fields);
        return data ? <ProblemSolutionSteps data={data} /> : null;
      }
      case 'concept-mechanism-flow': {
        const data = parseConceptMechanismFlow(fields);
        return data ? <ConceptMechanismFlow data={data} /> : null;
      }
      case 'tool-feature-comparison': {
        const data = parseToolFeatureComparison(fields);
        return data ? <ToolFeatureComparison data={data} /> : null;
      }
      case 'background-result-insight': {
        const data = parseBackgroundResultInsight(fields);
        return data ? <BackgroundResultInsight data={data} /> : null;
      }
      case 'argument-evidence-condition': {
        const data = parseArgumentEvidenceCondition(fields);
        return data ? <ArgumentEvidenceCondition data={data} /> : null;
      }
      case 'api-reference': {
        const data = parseApiReference(fields);
        return data ? <ApiReference data={data} /> : null;
      }
      case 'comparison-matrix': {
        const data = parseComparisonMatrix(fields);
        return data ? <ComparisonMatrix data={data} /> : null;
      }
      case 'timeline-evolution': {
        const data = parseTimelineEvolution(fields);
        return data ? <TimelineEvolution data={data} /> : null;
      }
      case 'generic':
      default: {
        const data = parseGenericSummary(fields);
        return data ? <GenericSummary data={data} /> : null;
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Structure type badge */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full font-medium">
          {type}
        </span>
        {difficulty && difficulty !== 'MEDIUM' && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${difficultyColors[difficulty]}`}>
            {difficultyLabels[difficulty]}
          </span>
        )}
        {confidence !== null && confidence !== undefined && (
          <ConfidenceBadge confidence={confidence} />
        )}
        {reasoning && (
          <details className="group">
            <summary className="text-xs text-secondary cursor-pointer hover:text-primary">
              Why this structure?
            </summary>
            <p className="text-xs text-secondary mt-1 p-2 bg-accent rounded">
              {reasoning}
            </p>
          </details>
        )}
      </div>

      {/* Structure-specific content */}
      {renderStructure()}

      {/* Common displays */}
      <KeyPointsDisplay keyPoints={keyPoints} />
      <BoundariesDisplay boundaries={boundaries} />
    </div>
  );
}
