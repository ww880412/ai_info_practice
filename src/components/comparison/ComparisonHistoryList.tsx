"use client";

import { GlobalComparisonCard } from "./GlobalComparisonCard";
import { useGlobalComparisons } from "@/hooks/useGlobalComparisons";
import type { GlobalComparisonItem } from "@/types/comparison";
import { Loader2 } from "lucide-react";

import type {
  GlobalComparisonFilters,
} from "@/hooks/useGlobalComparisons";

interface Props {
  initialComparisons: GlobalComparisonItem[];
  initialTotal: number;
}

function FilterBar({
  filters,
  setFilters,
}: {
  filters: GlobalComparisonFilters;
  setFilters: React.Dispatch<React.SetStateAction<GlobalComparisonFilters>>;
}) {
  return (
    <div className="flex gap-3 mb-6 flex-wrap">
      <select
        value={filters.status || ""}
        onChange={(e) =>
          setFilters((f) => ({
            ...f,
            status: (e.target.value as "COMPLETED" | "FAILED") || undefined,
          }))
        }
        className="px-3 py-2 border border-gray-300 rounded-md text-sm"
      >
        <option value="">All Status</option>
        <option value="COMPLETED">Completed</option>
        <option value="FAILED">Failed</option>
      </select>
      <select
        value={filters.winner || ""}
        onChange={(e) =>
          setFilters((f) => ({
            ...f,
            winner: (e.target.value as "original" | "comparison" | "tie") || undefined,
          }))
        }
        className="px-3 py-2 border border-gray-300 rounded-md text-sm"
      >
        <option value="">All Winners</option>
        <option value="original">Original Wins</option>
        <option value="comparison">Comparison Wins</option>
        <option value="tie">Tie</option>
      </select>
      <select
        value={filters.modePair || ""}
        onChange={(e) =>
          setFilters((f) => ({ ...f, modePair: e.target.value || undefined }))
        }
        className="px-3 py-2 border border-gray-300 rounded-md text-sm"
      >
        <option value="">All Modes</option>
        <option value="two-step-vs-tool-calling">Two-Step vs Tool-Calling</option>
        <option value="tool-calling-vs-two-step">Tool-Calling vs Two-Step</option>
      </select>
    </div>
  );
}

export function ComparisonHistoryList({
  initialComparisons,
  initialTotal,
}: Props) {
  const {
    comparisons,
    total,
    isLoading,
    error,
    hasMore,
    loadMore,
    filters,
    setFilters,
  } = useGlobalComparisons(initialComparisons, initialTotal);

  if (comparisons.length === 0 && !isLoading) {
    return (
      <>
        <FilterBar filters={filters} setFilters={setFilters} />
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No comparison results found</p>
          <p className="text-gray-400 text-sm mt-2">
            Start a comparison from the Library page
          </p>
        </div>
      </>
    );
  }

  return (
    <div>
      <FilterBar filters={filters} setFilters={setFilters} />
      <div className="grid gap-4">
        {comparisons.map((item) => (
          <GlobalComparisonCard key={item.id} item={item} />
        ))}
      </div>

      <div className="mt-6 text-center">
        <p className="text-sm text-gray-500 mb-3">
          Showing {comparisons.length} of {total}
        </p>
        {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
        {hasMore && (
          <button
            onClick={loadMore}
            disabled={isLoading}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-md text-sm font-medium disabled:opacity-50"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" /> Loading...
              </span>
            ) : (
              "Load More"
            )}
          </button>
        )}
      </div>
    </div>
  );
}
