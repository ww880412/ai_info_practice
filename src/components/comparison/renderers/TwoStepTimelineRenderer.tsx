// src/components/comparison/renderers/TwoStepTimelineRenderer.tsx

import { EmptyState } from '../EmptyState';
import { Section } from './Section';

interface TwoStepTimelineRendererProps {
  fields: Record<string, unknown>;
}

/**
 * Two-Step Timeline Renderer - for timeline-evolution structure
 *
 * Displays evolution chain: initialApproach → finalChoice
 * Visualizes timeline effect with null safety
 */
export function TwoStepTimelineRenderer({ fields }: TwoStepTimelineRendererProps) {
  if (!fields || Object.keys(fields).length === 0) {
    return <EmptyState message="暂无演进时间线" />;
  }

  const initialApproach = fields.initialApproach as string | undefined;
  const finalChoice = fields.finalChoice as string | undefined;
  const reasoning = fields.reasoning as string | undefined;

  if (!initialApproach && !finalChoice) {
    return <EmptyState message="暂无演进时间线" />;
  }

  return (
    <div className="space-y-4">
      {initialApproach && (
        <Section title="初始方案">
          <p>{initialApproach}</p>
        </Section>
      )}

      {initialApproach && finalChoice && (
        <div className="flex items-center justify-center py-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="h-px w-8 bg-border" />
            <span className="text-xs">演进</span>
            <div className="h-px w-8 bg-border" />
          </div>
        </div>
      )}

      {finalChoice && (
        <Section title="最终选择">
          <p>{finalChoice}</p>
        </Section>
      )}

      {reasoning && (
        <Section title="演进原因">
          <p className="text-xs">{reasoning}</p>
        </Section>
      )}
    </div>
  );
}
