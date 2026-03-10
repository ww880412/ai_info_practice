"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface CreateBatchRequest {
  entryIds: string[];
  targetMode: "two-step" | "tool-calling";
}

export interface CreateBatchResponse {
  batchId: string;
  entryCount: number;
  estimatedTime: string;
}

export interface ModeComparisonResult {
  entryId: string;
  entryTitle: string;
  originalMode: string;
  comparisonMode: string;
  winner: "original" | "comparison" | "tie";
  scoreDiff: number;
  originalDecision?: any; // JSON field from database
  comparisonDecision?: any; // JSON field from database
  originalScore?: any; // JSON field from database
  comparisonScore?: any; // JSON field from database
}

export interface BatchStats {
  originalWins: number;
  comparisonWins: number;
  ties: number;
  avgScoreDiff: number;
  dimensionBreakdown: {
    completeness: number;
    accuracy: number;
    relevance: number;
    clarity: number;
    actionability: number;
  };
}

export interface BatchStatus {
  batchId: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  entryCount: number;
  completedCount: number;
  results?: ModeComparisonResult[] | null;
  stats?: BatchStats;
}

interface ApiSuccess<T> {
  data: T;
}

interface ApiError {
  error?: string;
}

async function parseJson<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

export function useComparisonBatch(batchId?: string) {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (request: CreateBatchRequest): Promise<CreateBatchResponse> => {
      const response = await fetch("/api/entries/compare-modes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const error = await parseJson<ApiError>(response);
        throw new Error(error.error || "Failed to create comparison batch");
      }

      const data = await parseJson<ApiSuccess<CreateBatchResponse>>(response);
      return data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["comparison-batch", data.batchId] });
    },
  });

  const batchQuery = useQuery({
    queryKey: ["comparison-batch", batchId],
    queryFn: async (): Promise<BatchStatus> => {
      if (!batchId) {
        throw new Error("Batch ID is required");
      }

      const response = await fetch(`/api/entries/compare-modes/${batchId}`);

      if (!response.ok) {
        const error = await parseJson<ApiError>(response);
        throw new Error(error.error || "Failed to fetch batch status");
      }

      const data = await parseJson<ApiSuccess<BatchStatus>>(response);
      return data.data;
    },
    enabled: Boolean(batchId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "processing" || status === "pending" ? 2000 : false;
    },
  });

  return {
    createBatch: createMutation.mutate,
    createMutation,
    batchQuery,
    batchStatus: batchQuery.data,
    isLoading: batchQuery.isLoading,
    isProcessing: batchQuery.data?.status === "processing" || batchQuery.data?.status === "pending",
    isCompleted: batchQuery.data?.status === "completed",
    isFailed: batchQuery.data?.status === "failed",
  };
}
