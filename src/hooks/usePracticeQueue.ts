"use client";

import { useQuery } from "@tanstack/react-query";

export function usePracticeQueue(filters?: { status?: string; difficulty?: string }) {
  return useQuery({
    queryKey: ["practice", filters],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (filters?.status) searchParams.set("status", filters.status);
      if (filters?.difficulty) searchParams.set("difficulty", filters.difficulty);

      const res = await fetch(`/api/practice?${searchParams}`);
      if (!res.ok) throw new Error("Failed to fetch practice queue");
      return res.json();
    },
  });
}
