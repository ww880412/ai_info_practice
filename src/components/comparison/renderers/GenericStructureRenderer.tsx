// src/components/comparison/renderers/GenericStructureRenderer.tsx

import { EmptyState } from '../EmptyState';

interface GenericStructureRendererProps {
  fields: Record<string, unknown>;
}

/**
 * Generic structure renderer - for unknown or unsupported summaryStructure.type
 *
 * Features:
 * 1. Safe rendering of objects and arrays
 * 2. Depth limit (prevent infinite recursion)
 * 3. Key-value pair display
 */
export function GenericStructureRenderer({ fields }: GenericStructureRendererProps) {
  if (!fields || Object.keys(fields).length === 0) {
    return <EmptyState message="暂无结构化内容" />;
  }

  return (
    <div className="space-y-3">
      {Object.entries(fields).map(([key, value]) => (
        <div key={key} className="border-l-2 border-muted pl-3">
          <h5 className="font-medium text-sm capitalize">{key}</h5>
          <div className="mt-1 text-sm text-muted-foreground">
            {renderValue(value, 0)}
          </div>
        </div>
      ))}
    </div>
  );
}

function renderValue(value: unknown, depth: number): React.ReactNode {
  // Depth limit
  if (depth > 3) {
    return <span className="text-xs text-muted">[嵌套过深]</span>;
  }

  if (value === null || value === undefined) {
    return <span className="text-muted">-</span>;
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return <span>{String(value)}</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-muted">[]</span>;
    }
    return (
      <ul className="list-disc list-inside space-y-1">
        {value.slice(0, 10).map((item, i) => (
          <li key={i}>{renderValue(item, depth + 1)}</li>
        ))}
        {value.length > 10 && (
          <li className="text-xs text-muted">...还有 {value.length - 10} 项</li>
        )}
      </ul>
    );
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      return <span className="text-muted">{'{}'}</span>;
    }
    return (
      <div className="space-y-1 pl-3">
        {entries.slice(0, 5).map(([k, v]) => (
          <div key={k}>
            <span className="font-medium">{k}:</span> {renderValue(v, depth + 1)}
          </div>
        ))}
        {entries.length > 5 && (
          <div className="text-xs text-muted">...还有 {entries.length - 5} 个字段</div>
        )}
      </div>
    );
  }

  return <span className="text-muted">[无法渲染]</span>;
}
