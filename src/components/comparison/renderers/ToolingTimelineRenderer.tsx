// src/components/comparison/renderers/ToolingTimelineRenderer.tsx

import { EmptyState } from '../EmptyState';
import { Section } from './Section';

interface ToolingTimelineRendererProps {
  fields: Record<string, unknown>;
}

/**
 * Tooling Timeline Renderer - for narrative structure
 *
 * Displays narrative structure: focus + details
 * Shows additional metadata with null safety
 */
export function ToolingTimelineRenderer({ fields }: ToolingTimelineRendererProps) {
  if (!fields || Object.keys(fields).length === 0) {
    return <EmptyState message="暂无叙事结构" />;
  }

  const focus = fields.focus as string | undefined;
  const details = fields.details as string[] | undefined;
  const context = fields.context as string | undefined;
  const implications = fields.implications as string | undefined;

  if (!focus && (!details || details.length === 0)) {
    return <EmptyState message="暂无叙事结构" />;
  }

  return (
    <div className="space-y-4">
      {focus && (
        <Section title="核心焦点">
          <p className="font-medium">{focus}</p>
        </Section>
      )}

      {details && details.length > 0 && (
        <Section title="详细说明">
          <ul className="list-disc list-inside space-y-1">
            {details.map((detail, index) => (
              <li key={index}>{detail}</li>
            ))}
          </ul>
        </Section>
      )}

      {context && (
        <Section title="背景信息">
          <p className="text-xs">{context}</p>
        </Section>
      )}

      {implications && (
        <Section title="影响分析">
          <p className="text-xs">{implications}</p>
        </Section>
      )}
    </div>
  );
}
