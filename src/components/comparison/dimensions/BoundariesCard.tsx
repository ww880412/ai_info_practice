/**
 * Boundaries Card - Dimension 5: Boundaries Definition
 *
 * Displays applicable and notApplicable boundaries
 * for side-by-side comparison between two decisions.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/comparison/EmptyState";
import type { NormalizedDecision } from "@/lib/comparison/normalize";

interface BoundariesCardProps {
  original: NormalizedDecision;
  comparison: NormalizedDecision;
  originalMode: string;
  comparisonMode: string;
}

export function BoundariesCard({
  original,
  comparison,
  originalMode,
  comparisonMode,
}: BoundariesCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>维度 5：边界定义</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4 className="mb-3 text-sm font-medium">Original ({originalMode})</h4>
            <BoundariesContent boundaries={original.boundaries} />
          </div>
          <div>
            <h4 className="mb-3 text-sm font-medium">Comparison ({comparisonMode})</h4>
            <BoundariesContent boundaries={comparison.boundaries} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BoundariesContent({
  boundaries,
}: {
  boundaries: { applicable: string[]; notApplicable: string[] };
}) {
  const hasData = boundaries.applicable.length > 0 || boundaries.notApplicable.length > 0;

  if (!hasData) {
    return <EmptyState message="暂无边界定义" />;
  }

  return (
    <div className="space-y-4">
      {boundaries.applicable.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-2">适用场景</p>
          <ul className="space-y-1 list-disc list-inside">
            {boundaries.applicable.map((item, idx) => (
              <li key={idx} className="text-sm text-success">
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
      {boundaries.notApplicable.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-2">不适用场景</p>
          <ul className="space-y-1 list-disc list-inside">
            {boundaries.notApplicable.map((item, idx) => (
              <li key={idx} className="text-sm text-danger">
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
