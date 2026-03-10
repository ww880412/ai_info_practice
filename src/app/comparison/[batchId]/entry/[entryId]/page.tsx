"use client";

import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useComparisonBatch, type ModeComparisonResult } from "@/hooks/useComparisonBatch";
import { normalizeDecision } from "@/lib/comparison/normalize";
import { ClassificationCard } from "@/components/comparison/dimensions/ClassificationCard";
import { SummaryCard } from "@/components/comparison/dimensions/SummaryCard";
import { KeyPointsCard } from "@/components/comparison/dimensions/KeyPointsCard";
import { BoundariesCard } from "@/components/comparison/dimensions/BoundariesCard";
import { MetadataCard } from "@/components/comparison/dimensions/MetadataCard";

type ScoreDimensions = {
  completeness: number | null;
  accuracy: number | null;
  relevance: number | null;
  clarity: number | null;
  actionability: number | null;
};

type ScorePayload = {
  overallScore: number;
  dimensions: ScoreDimensions;
};

type ComparisonRecord = ModeComparisonResult & {
  entry?: {
    id?: string;
    title?: string | null;
  };
  originalScore?: ScorePayload;
  comparisonScore?: ScorePayload;
};

const dimensionLabels: Record<keyof ScoreDimensions, string> = {
  completeness: "完整性",
  accuracy: "准确性",
  relevance: "相关性",
  clarity: "清晰度",
  actionability: "可操作性",
};

export default function ComparisonDetailPage() {
  const params = useParams<{ batchId: string; entryId: string }>();
  const router = useRouter();

  const batchId = useMemo(
    () => (Array.isArray(params.batchId) ? params.batchId[0] : params.batchId),
    [params.batchId]
  );
  const entryId = useMemo(
    () => (Array.isArray(params.entryId) ? params.entryId[0] : params.entryId),
    [params.entryId]
  );

  const { batchQuery, batchStatus } = useComparisonBatch(batchId);

  const result = useMemo(() => {
    const records = (batchStatus?.results ?? []) as ComparisonRecord[];
    return records.find((item) => item.entryId === entryId || item.entry?.id === entryId);
  }, [batchStatus?.results, entryId]);

  // Normalize decisions for comparison cards
  const normalizedOriginal = useMemo(
    () => normalizeDecision(result?.originalDecision),
    [result?.originalDecision]
  );
  const normalizedComparison = useMemo(
    () => normalizeDecision(result?.comparisonDecision),
    [result?.comparisonDecision]
  );

  if (batchQuery.isLoading) {
    return (
      <div className="mx-auto min-h-[400px] max-w-6xl py-8">
        <div className="flex items-center justify-center min-h-[300px]">
          <Loader2 className="h-8 w-8 animate-spin text-secondary" />
        </div>
      </div>
    );
  }

  if (batchQuery.isError) {
    return (
      <div className="mx-auto max-w-6xl py-8">
        <div className="rounded-lg border border-danger bg-danger/10 p-6 text-danger">
          详情加载失败，请返回重试。
        </div>
      </div>
    );
  }

  if (!result || !result.originalScore || !result.comparisonScore) {
    return (
      <div className="mx-auto max-w-6xl py-8 space-y-4">
        <Button variant="ghost" size="icon" aria-label="返回" onClick={() => router.push(`/comparison/${batchId}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="rounded-lg border border-border bg-card p-6 text-secondary">
          当前条目暂无详细对比数据。
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 py-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" aria-label="返回" onClick={() => router.push(`/comparison/${batchId}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{result.entryTitle || result.entry?.title || "条目详情"}</h1>
          <p className="text-sm text-secondary">Entry ID: {entryId}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>原始模式</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-secondary">
            {result.originalMode}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>对比模式</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-secondary">
            {result.comparisonMode}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>总体评分</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3 md:items-center">
            <div className="rounded-lg border border-border bg-background p-4">
              <p className="text-xs text-secondary">原始模式</p>
              <p className="mt-1 text-3xl font-bold">{result.originalScore.overallScore.toFixed(1)}</p>
            </div>
            <div className="text-center text-sm text-secondary">
              分差 {result.scoreDiff > 0 ? "+" : ""}
              {result.scoreDiff.toFixed(1)}
            </div>
            <div className="rounded-lg border border-border bg-background p-4">
              <p className="text-xs text-secondary">对比模式</p>
              <p className="mt-1 text-3xl font-bold">{result.comparisonScore.overallScore.toFixed(1)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>维度对比</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(Object.keys(dimensionLabels) as Array<keyof ScoreDimensions>).map((dimension) => {
            const originalScore = result.originalScore?.dimensions?.[dimension];
            const comparisonScore = result.comparisonScore?.dimensions?.[dimension];

            if (originalScore == null && comparisonScore == null) {
              return null;
            }

            const safeOriginal = originalScore ?? 0;
            const safeComparison = comparisonScore ?? 0;
            const diff = safeComparison - safeOriginal;
            const diffLabel = `${diff > 0 ? "+" : ""}${diff.toFixed(1)}`;

            return (
              <div key={dimension} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{dimensionLabels[dimension]}</span>
                  <span className={diff > 0 ? "text-success" : diff < 0 ? "text-danger" : "text-secondary"}>
                    {diffLabel}
                  </span>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs text-secondary">
                      <span>原始</span>
                      <span>{safeOriginal.toFixed(1)}</span>
                    </div>
                    <Progress value={safeOriginal} />
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs text-secondary">
                      <span>对比</span>
                      <span>{safeComparison.toFixed(1)}</span>
                    </div>
                    <Progress value={safeComparison} />
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Dimension Comparison Cards - Responsive Grid */}
      <div className="space-y-6">
        <h2 className="text-xl font-semibold">详细维度对比</h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <ClassificationCard
            original={normalizedOriginal}
            comparison={normalizedComparison}
            originalMode={result.originalMode}
            comparisonMode={result.comparisonMode}
          />

          <SummaryCard
            original={normalizedOriginal}
            comparison={normalizedComparison}
            originalMode={result.originalMode}
            comparisonMode={result.comparisonMode}
          />

          <KeyPointsCard
            original={normalizedOriginal}
            comparison={normalizedComparison}
            originalMode={result.originalMode}
            comparisonMode={result.comparisonMode}
          />

          <BoundariesCard
            original={normalizedOriginal}
            comparison={normalizedComparison}
            originalMode={result.originalMode}
            comparisonMode={result.comparisonMode}
          />

          <MetadataCard
            original={normalizedOriginal}
            comparison={normalizedComparison}
            originalMode={result.originalMode}
            comparisonMode={result.comparisonMode}
          />
        </div>
      </div>
    </div>
  );
}
