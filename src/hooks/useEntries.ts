"use client";

import { useQuery } from "@tanstack/react-query";

interface UseEntriesParams {
  page?: number;
  pageSize?: number;
  groupId?: string;
  q?: string;
  contentType?: string;
  techDomain?: string;
  practiceValue?: string;
  sourceType?: string;
  knowledgeStatus?: string;
  aiTagsAll?: string[];
  aiTagsAny?: string[];
  userTagsAll?: string[];
  userTagsAny?: string[];
  sort?: "createdAt" | "updatedAt" | "confidence" | "practiceValue" | "difficulty" | "smart";
  sortBy?: "createdAt" | "updatedAt" | "title";
  sortOrder?: "asc" | "desc";
}

export function useEntries(params: UseEntriesParams = {}) {
  const {
    page = 1,
    pageSize = 20,
    groupId,
    q,
    contentType,
    techDomain,
    practiceValue,
    sourceType,
    knowledgeStatus,
    aiTagsAll,
    aiTagsAny,
    userTagsAll,
    userTagsAny,
    sort,
    sortBy,
    sortOrder,
  } = params;

  return useQuery({
    queryKey: ["entries", params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      searchParams.set("page", String(page));
      searchParams.set("pageSize", String(pageSize));
      if (groupId) searchParams.set("groupId", groupId);
      if (q) searchParams.set("q", q);
      if (contentType) searchParams.set("contentType", contentType);
      if (techDomain) searchParams.set("techDomain", techDomain);
      if (practiceValue) searchParams.set("practiceValue", practiceValue);
      if (sourceType) searchParams.set("sourceType", sourceType);
      if (knowledgeStatus) searchParams.set("knowledgeStatus", knowledgeStatus);
      if (aiTagsAll && aiTagsAll.length > 0) searchParams.set("aiTagsAll", aiTagsAll.join(","));
      if (aiTagsAny && aiTagsAny.length > 0) searchParams.set("aiTagsAny", aiTagsAny.join(","));
      if (userTagsAll && userTagsAll.length > 0) searchParams.set("userTagsAll", userTagsAll.join(","));
      if (userTagsAny && userTagsAny.length > 0) searchParams.set("userTagsAny", userTagsAny.join(","));
      if (sort) searchParams.set("sort", sort);
      if (sortBy) searchParams.set("sortBy", sortBy);
      if (sortOrder) searchParams.set("sortOrder", sortOrder);

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
