/**
 * Dynamic Summary Components
 * 根据 summaryStructure.type 动态渲染不同的展示组件
 */

import type { Difficulty, ContentForm, Timeliness, TrustLevel } from '@prisma/client';

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
  | 'generic';

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

  // Render appropriate component based on type
  const renderStructure = () => {
    switch (type) {
      case 'problem-solution-steps':
        return <ProblemSolutionSteps data={fields as any} />;
      case 'concept-mechanism-flow':
        return <ConceptMechanismFlow data={fields as any} />;
      case 'tool-feature-comparison':
        return <ToolFeatureComparison data={fields as any} />;
      case 'background-result-insight':
        return <BackgroundResultInsight data={fields as any} />;
      case 'argument-evidence-condition':
        return <ArgumentEvidenceCondition data={fields as any} />;
      case 'generic':
      default:
        return <GenericSummary data={fields as any} />;
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
