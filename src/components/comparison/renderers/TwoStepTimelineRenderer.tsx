// src/components/comparison/renderers/TwoStepTimelineRenderer.tsx

import { EmptyState } from '../EmptyState';
import { Section } from './Section';

interface TwoStepTimelineRendererProps {
  fields: Record<string, unknown>;
}

interface TimelineEvent {
  date?: string;
  version?: string;
  stage?: string;
  description: string;
}

/**
 * Two-Step Timeline Renderer - for timeline-evolution structure
 *
 * Displays evolution chain using events array
 * Visualizes timeline effect with null safety
 */
export function TwoStepTimelineRenderer({ fields }: TwoStepTimelineRendererProps) {
  if (!fields || Object.keys(fields).length === 0) {
    return <EmptyState message="暂无演进时间线" />;
  }

  const events = fields.events as TimelineEvent[] | string[] | undefined;
  const reasoning = fields.reasoning as string | undefined;

  if (!events || !Array.isArray(events) || events.length === 0) {
    return <EmptyState message="暂无演进时间线" />;
  }

  return (
    <div className="space-y-4">
      {events.map((event, index) => {
        const isString = typeof event === 'string';
        const eventObj = isString ? { description: event } : (event as TimelineEvent);

        const title = eventObj.stage || eventObj.version || eventObj.date || `阶段 ${index + 1}`;

        return (
          <div key={index}>
            <Section title={title}>
              <p>{eventObj.description}</p>
            </Section>

            {index < events.length - 1 && (
              <div className="flex items-center justify-center py-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <div className="h-px w-8 bg-border" />
                  <span className="text-xs">↓</span>
                  <div className="h-px w-8 bg-border" />
                </div>
              </div>
            )}
          </div>
        );
      })}

      {reasoning && (
        <Section title="演进原因">
          <p className="text-sm text-muted-foreground">{reasoning}</p>
        </Section>
      )}
    </div>
  );
}
