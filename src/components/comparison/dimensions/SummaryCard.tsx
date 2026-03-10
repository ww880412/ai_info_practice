/**
 * Summary Card - Dimension 2: Core Summary
 *
 * Displays coreSummary with character count
 * for side-by-side comparison between two decisions.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/comparison/EmptyState";
import type { NormalizedDecision } from "@/lib/comparison/normalize";

interface SummaryCardProps {
  original: NormalizedDecision;
  comparison: NormalizedDecision;
  originalMode: string;
  comparisonMode: string;
}

export function SummaryCard({
  original,
  comparison,
  originalMode,
  comparisonMode,
}: SummaryCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>维度 2：核心摘要</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4 className="mb-3 text-sm font-medium">Original ({originalMode})</h4>
            <SummaryContent summary={original.coreSummary} />
          </div>
          <div>
            <h4 className="mb-3 text-sm font-medium">Comparison ({comparisonMode})</h4>
            <SummaryContent summary={comparison.coreSummary} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryContent({ summary }: { summary: string }) {
  if (!summary) {
    return <EmptyState message="暂无摘要" />;
  }

  const charCount = summary.length;
  const unit = /[\u4e00-\u9fa5]/.test(summary) ? "字" : "chars";

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        {charCount} {unit}
      </p>
      <p className="text-sm leading-relaxed">{summary}</p>
    </div>
  );
}
