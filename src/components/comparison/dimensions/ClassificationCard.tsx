/**
 * Classification Card - Dimension 1: Basic Classification
 *
 * Displays contentType, techDomain, aiTags, and confidence
 * for side-by-side comparison between two decisions.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/comparison/EmptyState";
import type { NormalizedDecision } from "@/lib/comparison/normalize";

interface ClassificationCardProps {
  original: NormalizedDecision;
  comparison: NormalizedDecision;
  originalMode: string;
  comparisonMode: string;
}

export function ClassificationCard({
  original,
  comparison,
  originalMode,
  comparisonMode,
}: ClassificationCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>维度 1：基础分类</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h4 className="mb-3 text-sm font-medium">Original ({originalMode})</h4>
            <ClassificationContent decision={original} />
          </div>
          <div>
            <h4 className="mb-3 text-sm font-medium">Comparison ({comparisonMode})</h4>
            <ClassificationContent decision={comparison} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ClassificationContent({ decision }: { decision: NormalizedDecision }) {
  const hasData =
    decision.contentType !== "未知" ||
    decision.techDomain !== "未知" ||
    decision.aiTags.length > 0 ||
    decision.confidence !== null;

  if (!hasData) {
    return <EmptyState message="暂无分类信息" />;
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs text-muted-foreground">内容类型</p>
        <p className="text-sm font-medium">{decision.contentType}</p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">技术领域</p>
        <p className="text-sm font-medium">{decision.techDomain}</p>
      </div>
      {decision.aiTags.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-1">AI 标签</p>
          <div className="flex flex-wrap gap-1">
            {decision.aiTags.map((tag, idx) => (
              <Badge key={idx} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      )}
      {decision.confidence !== null && (
        <div>
          <p className="text-xs text-muted-foreground">置信度</p>
          <p className="text-sm font-medium">{(decision.confidence * 100).toFixed(1)}%</p>
        </div>
      )}
    </div>
  );
}
