/**
 * Metadata Card - Dimension 6: Metadata
 *
 * Displays difficulty, sourceTrust, timeliness, and contentForm
 * for side-by-side comparison between two decisions.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/comparison/EmptyState";
import type { NormalizedDecision } from "@/lib/comparison/normalize";

interface MetadataCardProps {
  original: NormalizedDecision;
  comparison: NormalizedDecision;
  originalMode: string;
  comparisonMode: string;
}

export function MetadataCard({
  original,
  comparison,
  originalMode,
  comparisonMode,
}: MetadataCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>维度 6：元数据</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4 className="mb-3 text-sm font-medium">Original ({originalMode})</h4>
            <MetadataContent metadata={original.metadata} />
          </div>
          <div>
            <h4 className="mb-3 text-sm font-medium">Comparison ({comparisonMode})</h4>
            <MetadataContent metadata={comparison.metadata} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MetadataContent({
  metadata,
}: {
  metadata: {
    difficulty: string | null;
    sourceTrust: string | null;
    timeliness: string | null;
    contentForm: string | null;
  };
}) {
  const hasData =
    metadata.difficulty !== null ||
    metadata.sourceTrust !== null ||
    metadata.timeliness !== null ||
    metadata.contentForm !== null;

  if (!hasData) {
    return <EmptyState message="暂无元数据" />;
  }

  return (
    <div className="space-y-3">
      {metadata.difficulty && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">难度</span>
          <Badge variant="outline">{metadata.difficulty}</Badge>
        </div>
      )}
      {metadata.sourceTrust && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">来源可信度</span>
          <Badge variant="outline">{metadata.sourceTrust}</Badge>
        </div>
      )}
      {metadata.timeliness && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">时效性</span>
          <Badge variant="outline">{metadata.timeliness}</Badge>
        </div>
      )}
      {metadata.contentForm && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">内容形式</span>
          <Badge variant="outline">{metadata.contentForm}</Badge>
        </div>
      )}
    </div>
  );
}
