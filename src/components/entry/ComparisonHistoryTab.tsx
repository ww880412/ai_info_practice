"use client";

import { useState } from "react";
import { useComparisonHistory, ComparisonStatus } from "@/hooks/useComparisonHistory";
import { ComparisonCard } from "./ComparisonCard";
import { Loader2, Filter, ChevronLeft, ChevronRight, AlertCircle } from "lucide-react";

interface ComparisonHistoryTabProps {
  entryId: string;
}

export function ComparisonHistoryTab({ entryId }: ComparisonHistoryTabProps) {
  const [status, setStatus] = useState<ComparisonStatus | "ALL">("ALL");
  const [sort, setSort] = useState<"createdAt" | "processedAt">("createdAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [offset, setOffset] = useState(0);
  const limit = 10;

  const filters = {
    ...(status !== "ALL" && { status }),
    sort,
    order,
    limit,
    offset,
  };

  const { data, isLoading, error } = useComparisonHistory(entryId, filters);

  const handleStatusChange = (newStatus: ComparisonStatus | "ALL") => {
    setStatus(newStatus);
    setOffset(0);
  };

  const handleSortChange = (newSort: "createdAt" | "processedAt") => {
    setSort(newSort);
    setOffset(0);
  };

  const handleOrderToggle = () => {
    setOrder(order === "desc" ? "asc" : "desc");
    setOffset(0);
  };

  const handlePrevPage = () => {
    setOffset(Math.max(0, offset - limit));
  };

  const handleNextPage = () => {
    if (data?.pageInfo.hasNext) {
      setOffset(data.pageInfo.nextOffset || offset + limit);
    }
  };

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
  const pageInfo = data?.pageInfo;

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Filters:</span>
        </div>

        {/* Status Filter */}
        <select
          value={status}
          onChange={(e) => handleStatusChange(e.target.value as ComparisonStatus | "ALL")}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Filter by status"
        >
          <option value="ALL">All Status</option>
          <option value="PENDING">Pending</option>
          <option value="PROCESSING">Processing</option>
          <option value="COMPLETED">Completed</option>
          <option value="FAILED">Failed</option>
        </select>

        {/* Sort Field */}
        <select
          value={sort}
          onChange={(e) => handleSortChange(e.target.value as "createdAt" | "processedAt")}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Sort by"
        >
          <option value="createdAt">Created Date</option>
          <option value="processedAt">Processed Date</option>
        </select>

        {/* Sort Order */}
        <button
          onClick={handleOrderToggle}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Toggle sort order"
        >
          {order === "desc" ? "↓ Newest First" : "↑ Oldest First"}
        </button>

        {pageInfo && (
          <div className="ml-auto text-sm text-gray-600">
            {pageInfo.total} total
          </div>
        )}
      </div>

      {/* Comparison List */}
      {comparisons.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-3">
            <Filter size={24} className="text-gray-400" />
          </div>
          <p className="text-gray-600 font-medium">No comparisons found</p>
          <p className="text-sm text-gray-500 mt-1">
            This entry hasn't been included in any comparison batches yet.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {comparisons.map((comparison) => (
            <ComparisonCard key={comparison.batchId} comparison={comparison} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pageInfo && pageInfo.total > limit && (
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <button
            onClick={handlePrevPage}
            disabled={offset === 0}
            className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Previous page"
          >
            <ChevronLeft size={16} />
            Previous
          </button>

          <div className="text-sm text-gray-600">
            Showing {offset + 1}-{Math.min(offset + limit, pageInfo.total)} of {pageInfo.total}
          </div>

          <button
            onClick={handleNextPage}
            disabled={!pageInfo.hasNext}
            className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Next page"
          >
            Next
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
