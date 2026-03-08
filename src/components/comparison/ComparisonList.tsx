"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, ExternalLink } from "lucide-react";
import type { ModeComparisonResult } from "@/hooks/useComparisonBatch";

type ComparisonResultItem = ModeComparisonResult & {
  entry?: {
    id?: string;
    title?: string | null;
  };
};

interface ComparisonListProps {
  results: ComparisonResultItem[];
  batchId: string;
}

function getWinnerBadge(winner: string) {
  switch (winner) {
    case "comparison":
      return <Badge className="bg-success text-white">对比模式胜出</Badge>;
    case "original":
      return <Badge variant="secondary">原始模式胜出</Badge>;
    case "tie":
      return <Badge variant="outline">平局</Badge>;
    default:
      return null;
  }
}

function getScoreDiffIcon(diff: number) {
  if (diff > 5) return <TrendingUp className="h-4 w-4 text-success" />;
  if (diff < -5) return <TrendingDown className="h-4 w-4 text-danger" />;
  return <Minus className="h-4 w-4 text-secondary" />;
}

function getScoreDiffColor(diff: number) {
  if (diff > 5) return "text-success";
  if (diff < -5) return "text-danger";
  return "text-secondary";
}

export function ComparisonList({ results, batchId }: ComparisonListProps) {
  return (
    <div className="space-y-4">
      {results.map((result) => {
        const entryId = result.entryId || result.entry?.id || "";
        const entryTitle = result.entryTitle || result.entry?.title || "未命名条目";

        return (
          <Link key={entryId} href={`/comparison/${batchId}/entry/${entryId}`}>
            <Card data-testid="comparison-result-card" className="cursor-pointer transition-colors hover:bg-accent">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium line-clamp-1">{entryTitle}</h3>
                      <ExternalLink className="h-4 w-4 flex-shrink-0 text-secondary" />
                    </div>

                    <div className="flex items-center gap-4 text-sm text-secondary">
                      <span>原始: {result.originalMode}</span>
                      <span>→</span>
                      <span>对比: {result.comparisonMode}</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:gap-4">
                    <div className="text-right">
                      <div className={`text-lg font-bold flex items-center gap-1 ${getScoreDiffColor(result.scoreDiff)}`}>
                        {getScoreDiffIcon(result.scoreDiff)}
                        {result.scoreDiff > 0 ? "+" : ""}
                        {result.scoreDiff.toFixed(1)}
                      </div>
                      <div className="text-xs text-secondary">分差</div>
                    </div>

                    {getWinnerBadge(result.winner)}
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
