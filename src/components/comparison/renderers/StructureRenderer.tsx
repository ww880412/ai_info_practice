// src/components/comparison/renderers/StructureRenderer.tsx

import { NormalizedDecision } from '@/lib/comparison/normalize';
import { TwoStepTimelineRenderer } from './TwoStepTimelineRenderer';
import { GenericStructureRenderer } from './GenericStructureRenderer';

interface StructureRendererProps {
  decision: NormalizedDecision;
}

/**
 * Structure Renderer - routes to appropriate renderer based on summaryStructure.type
 *
 * Routing logic:
 * - timeline-evolution → TwoStepTimelineRenderer
 * - other → GenericStructureRenderer
 *
 * Null-safe handling for all cases
 */
export function StructureRenderer({ decision }: StructureRendererProps) {
  const { type, fields } = decision.summaryStructure;

  switch (type) {
    case 'timeline-evolution':
      return <TwoStepTimelineRenderer fields={fields} />;
    default:
      return <GenericStructureRenderer fields={fields} />;
  }
}
