import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface GroupNode {
  id: string;
  name: string;
  parentId: string | null;
  entryCount: number;
  children: GroupNode[];
  createdAt: string;
  updatedAt: string;
}

async function fetchGroups(): Promise<GroupNode[]> {
  const res = await fetch("/api/groups");
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Failed to fetch groups");
  return json.data;
}

export function useGroups() {
  return useQuery({ queryKey: ["groups"], queryFn: fetchGroups });
}

export function useCreateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string; parentId?: string }) => {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to create group");
      return json.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["groups"] }),
  });
}

export function useRenameGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const res = await fetch(`/api/groups/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to rename group");
      return json.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["groups"] }),
  });
}

export function useDeleteGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/groups/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to delete group");
      return json.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["groups"] }),
  });
}

export function useAddEntriesToGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ groupId, entryIds }: { groupId: string; entryIds: string[] }) => {
      const res = await fetch(`/api/groups/${groupId}/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryIds }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to add entries");
      return json.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["groups"] }),
  });
}

export function useRemoveEntriesFromGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ groupId, entryIds }: { groupId: string; entryIds: string[] }) => {
      const res = await fetch(`/api/groups/${groupId}/entries`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryIds }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to remove entries");
      return json.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["groups"] }),
  });
}
