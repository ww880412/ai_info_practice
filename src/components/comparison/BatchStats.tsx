"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown, Minus, Target, BarChart3 } from "lucide-react";
import type { BatchStats as BatchStatsType } from "@/hooks/useComparisonBatch";

interface BatchStatsProps {
  stats: BatchStatsType;
  comparisonMode: string;
}

function getScoreDiffColor(diff: number) {
  if (diff > 5) return "text-success";
  if (diff < -5) return "text-danger";
  return "text-secondary";
}

function getScoreDiffIcon(diff: number) {
  if (diff > 5) return <TrendingUp className="h-4 w-4" />;
  if (diff < -5) return <TrendingDown className="h-4 w-4" />;
  return <Minus className="h-4 w-4" />;
}

function toProgressValue(diff: number) {
  return Math.min(100, Math.max(0, 50 + diff));
}

export function BatchStats({ stats, comparisonMode }: BatchStatsProps) {
  const totalComparisons = stats.originalWins + stats.comparisonWins + stats.ties;
  const comparisonWinRate = totalComparisons > 0 ? ((stats.comparisonWins / totalComparisons) * 100).toFixed(1) : "0.0";

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{comparisonMode} 胜率</CardTitle>
          <Target className="h-4 w-4 text-secondary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{comparisonWinRate}%</div>
          <p className="text-xs text-secondary">
            {stats.comparisonWins} 胜 / {stats.originalWins} 负 / {stats.ties} 平
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">平均分差</CardTitle>
          <BarChart3 className="h-4 w-4 text-secondary" />
        </CardHeader>
        <CardContent>
          <div className={`flex items-center gap-2 text-2xl font-bold ${getScoreDiffColor(stats.avgScoreDiff)}`}>
            {getScoreDiffIcon(stats.avgScoreDiff)}
            {stats.avgScoreDiff > 0 ? "+" : ""}
            {stats.avgScoreDiff.toFixed(1)}
          </div>
          <p className="text-xs text-secondary">
            {stats.avgScoreDiff > 0 ? "对比模式更优" : stats.avgScoreDiff < 0 ? "原始模式更优" : "两者相当"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">完整性提升</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${getScoreDiffColor(stats.dimensionBreakdown.completeness)}`}>
            {stats.dimensionBreakdown.completeness > 0 ? "+" : ""}
            {stats.dimensionBreakdown.completeness.toFixed(1)}
          </div>
          <Progress value={toProgressValue(stats.dimensionBreakdown.completeness)} className="mt-2" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">准确性提升</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${getScoreDiffColor(stats.dimensionBreakdown.accuracy)}`}>
            {stats.dimensionBreakdown.accuracy > 0 ? "+" : ""}
            {stats.dimensionBreakdown.accuracy.toFixed(1)}
          </div>
          <Progress value={toProgressValue(stats.dimensionBreakdown.accuracy)} className="mt-2" />
        </CardContent>
      </Card>
    </div>
  );
}
