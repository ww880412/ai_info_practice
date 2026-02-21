"use client";

import { useQuery } from "@tanstack/react-query";

interface UseEntriesParams {
  page?: number;
  pageSize?: number;
  q?: string;
  contentType?: string;
  techDomain?: string;
  practiceValue?: string;
  sourceType?: string;
}

export function useEntries(params: UseEntriesParams = {}) {
  const { page = 1, pageSize = 20, q, contentType, techDomain, practiceValue, sourceType } = params;

  return useQuery({
    queryKey: ["entries", params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      searchParams.set("page", String(page));
      searchParams.set("pageSize", String(pageSize));
      if (q) searchParams.set("q", q);
      if (contentType) searchParams.set("contentType", contentType);
      if (techDomain) searchParams.set("techDomain", techDomain);
      if (practiceValue) searchParams.set("practiceValue", practiceValue);
      if (sourceType) searchParams.set("sourceType", sourceType);

      const res = await fetch(`/api/entries?${searchParams}`);
      if (!res.ok) throw new Error("Failed to fetch entries");
      return res.json();
    },
  });
}

export function useEntry(id: string) {
  return useQuery({
    queryKey: ["entry", id],
    queryFn: async () => {
      const res = await fetch(`/api/entries/${id}`);
      if (!res.ok) throw new Error("Failed to fetch entry");
      return res.json();
    },
    enabled: !!id,
    refetchInterval: (query) => {
      const data = query.state.data;
      // Poll while processing
      if (data?.processStatus === "PENDING" || data?.processStatus === "PARSING" || data?.processStatus === "AI_PROCESSING") {
        return 2000;
      }
      return false;
    },
  });
}
