"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { GlobalComparisonItem } from "@/types/comparison";

export interface GlobalComparisonFilters {
  status?: "COMPLETED" | "FAILED";
  winner?: "original" | "comparison" | "tie";
  modePair?: string;
}

export function useGlobalComparisons(
  initialComparisons: GlobalComparisonItem[],
  initialTotal: number
) {
  const [comparisons, setComparisons] = useState(initialComparisons);
  const [total, setTotal] = useState(initialTotal);
  const [filters, setFilters] = useState<GlobalComparisonFilters>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Abort any in-flight request (including loadMore) when filters change
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const fetchFiltered = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("limit", "20");
        params.set("offset", "0");
        if (filters.status) params.set("status", filters.status);
        if (filters.winner) params.set("winner", filters.winner);
        if (filters.modePair) params.set("modePair", filters.modePair);

        const res = await fetch(`/api/comparisons?${params}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("Failed to fetch");
        const json = await res.json();
        setComparisons(json.data.comparisons);
        setTotal(json.data.pageInfo.total);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    };

    if (filters.status || filters.winner || filters.modePair) {
      fetchFiltered();
    } else {
      setComparisons(initialComparisons);
      setTotal(initialTotal);
    }

    return () => controller.abort();
  }, [filters, initialComparisons, initialTotal]);

  const loadMore = useCallback(async () => {
    if (isLoading) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("limit", "20");
      params.set("offset", comparisons.length.toString());
      if (filters.status) params.set("status", filters.status);
      if (filters.winner) params.set("winner", filters.winner);
      if (filters.modePair) params.set("modePair", filters.modePair);

      const res = await fetch(`/api/comparisons?${params}`, {
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("Failed to load more");
      const json = await res.json();
      setComparisons((prev) => [...prev, ...json.data.comparisons]);
      setTotal(json.data.pageInfo.total);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [comparisons.length, filters, isLoading]);

  const hasMore = comparisons.length < total;

  return {
    comparisons,
    total,
    isLoading,
    error,
    hasMore,
    loadMore,
    filters,
    setFilters,
  };
}
