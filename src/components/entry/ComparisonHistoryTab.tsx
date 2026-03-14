"use client";

import { useComparisonHistory } from "@/hooks/useComparisonHistory";
import { ComparisonCard } from "./ComparisonCard";
import { Loader2, AlertCircle, GitCompareArrows } from "lucide-react";

interface ComparisonHistoryTabProps {
  entryId: string;
}

export function ComparisonHistoryTab({ entryId }: ComparisonHistoryTabProps) {
  const { data, isLoading, error } = useComparisonHistory(entryId, {
    sort: "createdAt",
    order: "desc",
    limit: 50,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="text-red-500 mb-2" size={32} />
        <p className="text-red-600 font-medium">Failed to load comparison history</p>
        <p className="text-sm text-gray-500 mt-1">{(error as Error).message}</p>
      </div>
    );
  }

  const comparisons = data?.comparisons || [];

  if (comparisons.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-3">
          <GitCompareArrows size={24} className="text-gray-400" />
        </div>
        <p className="text-gray-600 font-medium">No comparisons yet</p>
        <p className="text-sm text-gray-500 mt-1">
          This entry hasn&apos;t been included in any comparison batches yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {comparisons.map((comparison) => (
        <ComparisonCard key={comparison.batchId} comparison={comparison} entryId={entryId} />
      ))}
    </div>
  );
}
