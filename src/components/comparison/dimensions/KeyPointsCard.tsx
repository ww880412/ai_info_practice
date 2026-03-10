/**
 * Key Points Card - Dimension 3: Key Points
 *
 * Displays core and extended key points
 * for side-by-side comparison between two decisions.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/comparison/EmptyState";
import type { NormalizedDecision } from "@/lib/comparison/normalize";

interface KeyPointsCardProps {
  original: NormalizedDecision;
  comparison: NormalizedDecision;
  originalMode: string;
  comparisonMode: string;
}

export function KeyPointsCard({
  original,
  comparison,
  originalMode,
  comparisonMode,
}: KeyPointsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>维度 3：关键要点</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h4 className="mb-3 text-sm font-medium">Original ({originalMode})</h4>
            <KeyPointsContent keyPoints={original.keyPoints} />
          </div>
          <div>
            <h4 className="mb-3 text-sm font-medium">Comparison ({comparisonMode})</h4>
            <KeyPointsContent keyPoints={comparison.keyPoints} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function KeyPointsContent({
  keyPoints,
}: {
  keyPoints: { core: string[]; extended: string[] };
}) {
  const hasData = keyPoints.core.length > 0 || keyPoints.extended.length > 0;

  if (!hasData) {
    return <EmptyState message="暂无关键要点" />;
  }

  return (
    <div className="space-y-4">
      {keyPoints.core.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-2">核心要点</p>
          <ul className="space-y-1 list-disc list-inside">
            {keyPoints.core.map((point, idx) => (
              <li key={idx} className="text-sm">
                {point}
              </li>
            ))}
          </ul>
        </div>
      )}
      {keyPoints.extended.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-2">扩展要点</p>
          <ul className="space-y-1 list-disc list-inside">
            {keyPoints.extended.map((point, idx) => (
              <li key={idx} className="text-sm text-muted-foreground">
                {point}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
