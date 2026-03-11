"use client";

import Link from "next/link";
import { ComparisonHistoryItem } from "@/hooks/useComparisonHistory";
import { Trophy, Clock, CheckCircle, XCircle, Loader2, ArrowRight } from "lucide-react";

interface ComparisonCardProps {
  comparison: ComparisonHistoryItem;
  entryId: string;
}

const statusConfig = {
  PENDING: { label: "Pending", icon: Clock, color: "text-gray-500" },
  PROCESSING: { label: "Processing", icon: Loader2, color: "text-blue-500" },
  COMPLETED: { label: "Completed", icon: CheckCircle, color: "text-green-500" },
  FAILED: { label: "Failed", icon: XCircle, color: "text-red-500" },
};

const modeLabels: Record<string, string> = {
  "two-step": "Two-Step",
  "tool-calling": "Tool Calling",
};

export function ComparisonCard({ comparison, entryId }: ComparisonCardProps) {
  const statusInfo = statusConfig[comparison.batchStatus];
  const StatusIcon = statusInfo.icon;
  const hasResult = comparison.resultId && comparison.batchStatus === "COMPLETED";

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatScore = (score?: number) => {
    if (score === undefined) return "N/A";
    return score.toFixed(2);
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-mono text-gray-600">
              Batch #{comparison.batchId.slice(0, 8)}
            </span>
            <div className={`flex items-center gap-1 text-sm ${statusInfo.color}`}>
              <StatusIcon size={14} className={comparison.batchStatus === "PROCESSING" ? "animate-spin" : ""} />
              <span>{statusInfo.label}</span>
            </div>
          </div>
          <div className="text-xs text-gray-500">
            Created {formatDate(comparison.batchCreatedAt)}
          </div>
        </div>

        {hasResult && comparison.winner && (
          <div className="flex items-center gap-1 px-2 py-1 bg-yellow-50 border border-yellow-200 rounded text-xs font-medium text-yellow-700">
            <Trophy size={12} />
            <span className="capitalize">{comparison.winner}</span>
          </div>
        )}
      </div>

      {/* Modes Comparison */}
      <div className="flex items-center gap-3 mb-3 text-sm">
        <div className="flex-1 px-3 py-2 bg-blue-50 rounded border border-blue-100">
          <div className="text-xs text-gray-600 mb-1">Original</div>
          <div className="font-medium text-blue-700">
            {comparison.originalMode ? modeLabels[comparison.originalMode] : "Unknown"}
          </div>
        </div>
        <ArrowRight size={16} className="text-gray-400 flex-shrink-0" />
        <div className="flex-1 px-3 py-2 bg-purple-50 rounded border border-purple-100">
          <div className="text-xs text-gray-600 mb-1">Comparison</div>
          <div className="font-medium text-purple-700">
            {comparison.comparisonMode ? modeLabels[comparison.comparisonMode] : "Unknown"}
          </div>
        </div>
      </div>

      {/* Scores */}
      {hasResult && (
        <div className="flex items-center gap-3 mb-3 text-sm">
          <div className="flex-1">
            <div className="text-xs text-gray-600 mb-1">Original Score</div>
            <div className="text-lg font-semibold text-blue-600">
              {formatScore(comparison.originalOverallScore)}
            </div>
          </div>
          <div className="flex-1">
            <div className="text-xs text-gray-600 mb-1">Comparison Score</div>
            <div className="text-lg font-semibold text-purple-600">
              {formatScore(comparison.comparisonOverallScore)}
            </div>
          </div>
          {comparison.scoreDiff !== undefined && (
            <div className="flex-1">
              <div className="text-xs text-gray-600 mb-1">Difference</div>
              <div className={`text-lg font-semibold ${comparison.scoreDiff > 0 ? "text-green-600" : comparison.scoreDiff < 0 ? "text-red-600" : "text-gray-600"}`}>
                {comparison.scoreDiff > 0 ? "+" : ""}{formatScore(comparison.scoreDiff)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        {comparison.processedAt && (
          <div className="text-xs text-gray-500">
            Processed {formatDate(comparison.processedAt)}
          </div>
        )}
        <div className="flex-1" />
        <Link
          href={
            hasResult
              ? `/comparison/${comparison.batchId}/entry/${entryId}`
              : `/comparison/${comparison.batchId}`
          }
          className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
        >
          View Details
          <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
