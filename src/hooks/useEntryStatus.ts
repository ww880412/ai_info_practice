"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { KnowledgeStatus } from "@prisma/client";

interface UpdateStatusParams {
  entryId: string;
  status: KnowledgeStatus;
  reason?: string;
}

export function useEntryStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ entryId, status, reason }: UpdateStatusParams) => {
      const res = await fetch(`/api/entries/${entryId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reason }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Failed to update status" }));
        throw new Error(error.error || "Failed to update status");
      }

      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["entries"] });
      queryClient.invalidateQueries({ queryKey: ["entry", variables.entryId] });
    },
  });
}
