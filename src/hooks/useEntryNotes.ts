import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface EntryNote {
  id: string;
  entryId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

async function fetchNotes(entryId: string): Promise<EntryNote[]> {
  const res = await fetch(`/api/entries/${entryId}/notes`);
  if (!res.ok) throw new Error("Failed to fetch notes");
  const json = await res.json();
  return json.data;
}

async function createNoteApi(entryId: string, content: string): Promise<EntryNote> {
  const res = await fetch(`/api/entries/${entryId}/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error("Failed to create note");
  const json = await res.json();
  return json.data;
}

export function useEntryNotes(entryId: string) {
  const queryClient = useQueryClient();

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["entryNotes", entryId],
    queryFn: () => fetchNotes(entryId),
  });

  const createNoteMutation = useMutation({
    mutationFn: (content: string) => createNoteApi(entryId, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entryNotes", entryId] });
      queryClient.invalidateQueries({ queryKey: ["entry", entryId] });
    },
  });

  return {
    notes,
    isLoading,
    createNote: createNoteMutation.mutateAsync,
  };
}
