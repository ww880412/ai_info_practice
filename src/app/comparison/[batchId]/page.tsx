"use client";

import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, ArrowLeft, RefreshCw } from "lucide-react";
import { useComparisonBatch } from "@/hooks/useComparisonBatch";
import { BatchStats } from "@/components/comparison/BatchStats";
import { ComparisonList } from "@/components/comparison/ComparisonList";

export default function ComparisonBatchPage() {
  const params = useParams<{ batchId: string }>();
  const router = useRouter();
  const batchId = useMemo(
    () => (Array.isArray(params.batchId) ? params.batchId[0] : params.batchId),
    [params.batchId]
  );

  const { batchQuery, isProcessing, isCompleted, isFailed } = useComparisonBatch(batchId);
  const batchStatus = batchQuery.data;

  if (batchQuery.isLoading) {
    return (
      <div className="mx-auto min-h-[400px] max-w-6xl py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-secondary" />
        </div>
      </div>
    );
  }

  if (batchQuery.isError) {
    return (
      <div className="mx-auto min-h-[400px] max-w-6xl py-8">
        <div className="flex min-h-[400px] flex-col items-center justify-center gap-4">
          <p className="text-lg text-secondary">加载失败</p>
          <Button onClick={() => void batchQuery.refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            重试
          </Button>
        </div>
      </div>
    );
  }

  if (!batchStatus || !batchId) {
    return null;
  }

  const progressPercentage =
    batchStatus.entryCount > 0 ? (batchStatus.completedCount / batchStatus.entryCount) * 100 : 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6 py-8">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/library")}
            aria-label="返回"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">模式对比结果</h1>
            <p className="text-sm text-secondary">批次 ID: {batchId}</p>
          </div>
        </div>

        {isProcessing && (
          <div className="flex items-center gap-2 text-sm text-secondary">
            <Loader2 className="h-4 w-4 animate-spin" />
            处理中...
          </div>
        )}
      </div>

      {isProcessing && (
        <div className="space-y-4 rounded-lg border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">处理进度</h2>
              <p className="text-sm text-secondary">
                {batchStatus.completedCount} / {batchStatus.entryCount} 已完成
              </p>
            </div>
            <div className="text-2xl font-bold">{progressPercentage.toFixed(0)}%</div>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>
      )}

      {isFailed && (
        <div className="rounded-lg border border-danger bg-danger/10 p-6">
          <h2 className="text-lg font-semibold text-danger">处理失败</h2>
          <p className="mt-2 text-sm text-secondary">批次处理过程中发生错误，请稍后重试。</p>
        </div>
      )}

      {isCompleted && batchStatus.stats && (
        <>
          <BatchStats
            stats={batchStatus.stats}
            comparisonMode={batchStatus.results?.[0]?.comparisonMode || "tool-calling"}
          />

          {batchStatus.results && batchStatus.results.length > 0 ? (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">详细结果</h2>
              <ComparisonList results={batchStatus.results} batchId={batchId} />
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-card p-6 text-sm text-secondary">暂无对比结果。</div>
          )}
        </>
      )}
    </div>
  );
}
