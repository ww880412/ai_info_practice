"use client";

import { useQuery } from "@tanstack/react-query";

export type ComparisonStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export interface ComparisonHistoryItem {
  batchId: string;
  batchCreatedAt: string;
  batchStatus: ComparisonStatus;
  originalMode?: "two-step" | "tool-calling";
  comparisonMode?: "two-step" | "tool-calling";
  resultId?: string;
  processedAt?: string;
  winner?: "original" | "comparison" | "tie";
  originalOverallScore?: number;
  comparisonOverallScore?: number;
  scoreDiff?: number;
}

export interface ComparisonHistoryResponse {
  comparisons: ComparisonHistoryItem[];
  pageInfo: {
    total: number;
    limit: number;
    offset: number;
    hasNext: boolean;
    nextOffset: number | null;
  };
}

export interface ComparisonHistoryFilters {
  status?: ComparisonStatus;
  limit?: number;
  offset?: number;
  sort?: "createdAt" | "processedAt";
  order?: "asc" | "desc";
  from?: string;
  to?: string;
}

export function useComparisonHistory(entryId: string, filters: ComparisonHistoryFilters = {}) {
  return useQuery({
    queryKey: ["comparison-history", entryId, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.status) params.set("status", filters.status);
      if (filters.limit) params.set("limit", filters.limit.toString());
      if (filters.offset) params.set("offset", filters.offset.toString());
      if (filters.sort) params.set("sort", filters.sort);
      if (filters.order) params.set("order", filters.order);
      if (filters.from) params.set("from", filters.from);
      if (filters.to) params.set("to", filters.to);

      const res = await fetch(`/api/entries/${entryId}/comparisons?${params}`);
      if (!res.ok) throw new Error("Failed to fetch comparison history");
      const json = await res.json();
      return json.data as ComparisonHistoryResponse;
    },
    enabled: !!entryId,
  });
}
