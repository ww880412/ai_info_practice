"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { GlobalComparisonItem } from "@/types/comparison";
import { Trophy, CheckCircle, XCircle, ArrowRight } from "lucide-react";

const modeLabels: Record<string, string> = {
  "two-step": "Two-Step",
  "tool-calling": "Tool Calling",
};

const formatScore = (score: number | null) =>
  score !== null ? score.toFixed(2) : "N/A";

export function GlobalComparisonCard({ item }: { item: GlobalComparisonItem }) {
  const router = useRouter();
  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div
      className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => router.push(`/comparison/${item.batchId}`)}
    >
      {/* Entry Title */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <Link
            href={`/entry/${item.entryId}`}
            onClick={(e) => e.stopPropagation()}
            className="text-sm font-medium text-gray-900 hover:text-blue-600 line-clamp-1"
          >
            {item.entryTitle || "未命名条目"}
          </Link>
          <div className="text-xs text-gray-500 mt-1">
            {formatDate(item.createdAt)}
          </div>
        </div>
        {item.winner && (
          <div className="flex items-center gap-1 px-2 py-1 bg-yellow-50 border border-yellow-200 rounded text-xs font-medium text-yellow-700">
            <Trophy size={12} />
            <span className="capitalize">{item.winner}</span>
          </div>
        )}
      </div>

      {/* Mode Comparison */}
      <div className="flex items-center gap-3 mb-3 text-sm">
        <div className="flex-1 px-3 py-2 bg-blue-50 rounded border border-blue-100">
          <div className="text-xs text-gray-600 mb-1">Original</div>
          <div className="font-medium text-blue-700">
            {modeLabels[item.originalMode] || item.originalMode}
          </div>
        </div>
        <ArrowRight size={16} className="text-gray-400 flex-shrink-0" />
        <div className="flex-1 px-3 py-2 bg-purple-50 rounded border border-purple-100">
          <div className="text-xs text-gray-600 mb-1">Comparison</div>
          <div className="font-medium text-purple-700">
            {modeLabels[item.comparisonMode] || item.comparisonMode}
          </div>
        </div>
      </div>

      {/* Scores */}
      <div className="flex items-center gap-3 mb-3 text-sm">
        <div className="flex-1">
          <div className="text-xs text-gray-600 mb-1">Original Score</div>
          <div className="text-lg font-semibold text-blue-600">
            {formatScore(item.originalOverallScore)}
          </div>
        </div>
        <div className="flex-1">
          <div className="text-xs text-gray-600 mb-1">Comparison Score</div>
          <div className="text-lg font-semibold text-purple-600">
            {formatScore(item.comparisonOverallScore)}
          </div>
        </div>
        <div className="flex-1">
          <div className="text-xs text-gray-600 mb-1">Difference</div>
          <div
            className={`text-lg font-semibold ${
              item.scoreDiff > 0
                ? "text-green-600"
                : item.scoreDiff < 0
                  ? "text-red-600"
                  : "text-gray-600"
            }`}
          >
            {item.scoreDiff > 0 ? "+" : ""}
            {formatScore(item.scoreDiff)}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <div className="flex items-center gap-2">
          {item.batchStatus === "COMPLETED" ? (
            <CheckCircle size={14} className="text-green-500" />
          ) : (
            <XCircle size={14} className="text-red-500" />
          )}
          <span className="text-xs text-gray-500">{item.batchStatus}</span>
        </div>
        <span className="text-sm text-blue-600 font-medium flex items-center gap-1">
          View Batch <ArrowRight size={14} />
        </span>
      </div>
    </div>
  );
}
