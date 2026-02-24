"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEntries } from "@/hooks/useEntries";
import { EntryCard } from "@/components/library/EntryCard";
import { EntryFilters } from "@/components/library/EntryFilters";
import GroupSidebar from "@/components/library/GroupSidebar";
import { TagSidebar } from "@/components/library/TagSidebar";
import { IngestDialog } from "@/components/ingest/IngestDialog";
import { ChevronDown, ChevronRight, Plus, SlidersHorizontal, Trash2 } from "lucide-react";

function parseTagParam(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

// Skeleton component for loading state
function EntryCardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-lg p-4 animate-pulse">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-4 h-4 bg-accent rounded" />
          <div className="h-4 w-32 bg-accent rounded" />
        </div>
        <div className="h-5 w-14 bg-accent rounded-full" />
      </div>
      <div className="space-y-2 mb-3">
        <div className="h-3 w-full bg-accent rounded" />
        <div className="h-3 w-4/5 bg-accent rounded" />
      </div>
      <div className="flex gap-1.5">
        <div className="h-5 w-16 bg-accent rounded-full" />
        <div className="h-5 w-14 bg-accent rounded-full" />
        <div className="h-5 w-12 bg-accent rounded-full" />
      </div>
    </div>
  );
}

export default function LibraryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [ingestOpen, setIngestOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [contentType, setContentType] = useState("");
  const [techDomain, setTechDomain] = useState("");
  const [practiceValue, setPracticeValue] = useState("");
  const [tagFiltersExpanded, setTagFiltersExpanded] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const selectedGroupId = searchParams.get("groupId");
  const selectedAiTags = useMemo(
    () => parseTagParam(searchParams.get("aiTagsAny")),
    [searchParams]
  );
  const selectedUserTags = useMemo(
    () => parseTagParam(searchParams.get("userTagsAny")),
    [searchParams]
  );

  // Debounce search
  const [debouncedQ, setDebouncedQ] = useState("");
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedQ(q), 300);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [q]);

  const { data, isLoading } = useEntries({
    page,
    groupId: selectedGroupId || undefined,
    q: debouncedQ,
    contentType: contentType || undefined,
    techDomain: techDomain || undefined,
    practiceValue: practiceValue || undefined,
    aiTagsAny: selectedAiTags.length > 0 ? selectedAiTags : undefined,
    userTagsAny: selectedUserTags.length > 0 ? selectedUserTags : undefined,
  });

  const entries: EntryCardEntry[] = (data?.data as EntryCardEntry[]) || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / 20);
  const entryIds = entries.map((entry) => entry.id);
  const selectedIdsOnPage = selectedIds.filter((id) => entryIds.includes(id));
  const selectedCount = selectedIdsOnPage.length;
  const allSelected = entryIds.length > 0 && selectedCount === entryIds.length;

  const batchDeleteEntries = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await fetch("/api/entries", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });

      const payload = (await res.json().catch(() => null)) as
        | { error?: string; deletedCount?: number }
        | null;
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to batch delete entries");
      }
      return payload as { deletedCount: number };
    },
    onSuccess: (_data, ids) => {
      setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
      queryClient.invalidateQueries({ queryKey: ["entries"] });
      queryClient.invalidateQueries({ queryKey: ["practice"] });
    },
  });

  const toggleSelectAllOnPage = (checked: boolean) => {
    if (checked) {
      setSelectedIds(entryIds);
      return;
    }
    setSelectedIds([]);
  };

  const toggleSelectEntry = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      if (checked) {
        if (prev.includes(id)) return prev;
        return [...prev, id];
      }
      return prev.filter((item) => item !== id);
    });
  };

  const handleBatchDelete = () => {
    if (selectedCount === 0 || batchDeleteEntries.isPending) return;
    const confirmed = window.confirm(
      `Delete ${selectedCount} selected entr${selectedCount > 1 ? "ies" : "y"}? This action cannot be undone.`
    );
    if (!confirmed) return;
    batchDeleteEntries.mutate([...selectedIdsOnPage]);
  };

  const handleAiTagsChange = (tags: string[]) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    if (tags.length > 0) nextParams.set("aiTagsAny", tags.join(","));
    else nextParams.delete("aiTagsAny");
    router.replace(nextParams.toString() ? `/library?${nextParams.toString()}` : "/library");
    setPage(1);
    setSelectedIds([]);
  };

  const handleUserTagsChange = (tags: string[]) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    if (tags.length > 0) nextParams.set("userTagsAny", tags.join(","));
    else nextParams.delete("userTagsAny");
    router.replace(nextParams.toString() ? `/library?${nextParams.toString()}` : "/library");
    setPage(1);
    setSelectedIds([]);
  };

  const handleGroupSelect = (groupId: string | null) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    if (groupId) nextParams.set("groupId", groupId);
    else nextParams.delete("groupId");
    router.replace(nextParams.toString() ? `/library?${nextParams.toString()}` : "/library");
    setPage(1);
    setSelectedIds([]);
  };

  const selectedTagCount = selectedAiTags.length + selectedUserTags.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Knowledge Base</h1>
          <p className="text-sm text-secondary mt-1">
            {total} entries collected
          </p>
        </div>
        <button
          onClick={() => setIngestOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-hover transition-colors"
        >
          <Plus size={16} />
          Add
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[260px_minmax(0,1fr)] gap-6">
        <aside className="space-y-3">
          <div className="rounded-lg border border-border bg-card p-3">
            <GroupSidebar
              selectedGroupId={selectedGroupId}
              onGroupSelect={handleGroupSelect}
            />
          </div>
        </aside>

        <section className="space-y-4">
          {/* Filters */}
          <div className="space-y-3">
            <EntryFilters
              q={q}
              onQChange={(v) => { setQ(v); setPage(1); setSelectedIds([]); }}
              contentType={contentType}
              onContentTypeChange={(v) => { setContentType(v); setPage(1); setSelectedIds([]); }}
              techDomain={techDomain}
              onTechDomainChange={(v) => { setTechDomain(v); setPage(1); setSelectedIds([]); }}
              practiceValue={practiceValue}
              onPracticeValueChange={(v) => { setPracticeValue(v); setPage(1); setSelectedIds([]); }}
            />

            {(selectedGroupId || selectedTagCount > 0) && (
              <div className="flex flex-wrap items-center gap-2">
                {selectedGroupId && (
                  <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                    Group Filter Active
                  </span>
                )}
                {selectedTagCount > 0 && (
                  <span className="inline-flex items-center rounded-full bg-accent px-2 py-0.5 text-xs text-secondary">
                    {selectedTagCount} Tag Filter{selectedTagCount > 1 ? "s" : ""}
                  </span>
                )}
              </div>
            )}

            <div className="rounded-lg border border-border bg-card">
              <button
                type="button"
                onClick={() => setTagFiltersExpanded((open) => !open)}
                className="w-full px-3 py-2.5 flex items-center justify-between text-sm font-medium hover:bg-accent/40 transition-colors rounded-lg"
              >
                <span className="inline-flex items-center gap-2 text-foreground">
                  <SlidersHorizontal size={14} />
                  Advanced Tag Filters
                </span>
                <span className="inline-flex items-center gap-2 text-secondary">
                  {selectedTagCount > 0 && (
                    <span className="inline-flex items-center rounded-full bg-accent px-1.5 py-0.5 text-[11px] leading-none">
                      {selectedTagCount}
                    </span>
                  )}
                  {tagFiltersExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </span>
              </button>

              {tagFiltersExpanded && (
                <div className="border-t border-border px-3 py-3">
                  {(selectedAiTags.length > 0 || selectedUserTags.length > 0) && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {selectedAiTags.map((tag) => (
                        <span key={`selected-ai-${tag}`} className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                          {tag}
                        </span>
                      ))}
                      {selectedUserTags.map((tag) => (
                        <span key={`selected-user-${tag}`} className="inline-flex items-center rounded-full bg-accent px-2 py-0.5 text-xs text-secondary">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <TagSidebar
                    selectedAiTags={selectedAiTags}
                    selectedUserTags={selectedUserTags}
                    onAiTagsChange={handleAiTagsChange}
                    onUserTagsChange={handleUserTagsChange}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Batch actions */}
          {entries.length > 0 && (
            <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
              <label className="inline-flex items-center gap-2 text-sm text-secondary">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => toggleSelectAllOnPage(e.target.checked)}
                  disabled={batchDeleteEntries.isPending}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                Select all on this page
              </label>

              <div className="flex items-center gap-3">
                <span className="text-sm text-secondary">{selectedCount} selected</span>
                <button
                  onClick={handleBatchDelete}
                  disabled={selectedCount === 0 || batchDeleteEntries.isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/40 dark:text-red-400 dark:hover:bg-red-950/20"
                >
                  <Trash2 size={14} />
                  {batchDeleteEntries.isPending ? "Deleting..." : "Delete selected"}
                </button>
              </div>
            </div>
          )}

          {batchDeleteEntries.error && (
            <p className="text-sm text-danger">
              {batchDeleteEntries.error instanceof Error
                ? batchDeleteEntries.error.message
                : "Failed to batch delete entries"}
            </p>
          )}

          {/* Entries grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <EntryCardSkeleton key={i} />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-secondary">No entries yet</p>
              <button
                onClick={() => setIngestOpen(true)}
                className="mt-3 text-sm text-primary hover:underline"
              >
                Add your first knowledge entry
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {entries.map((entry) => (
                <EntryCard
                  key={entry.id}
                  entry={entry}
                  onClick={(id) => router.push(`/entry/${id}`)}
                  showSelection
                  selected={selectedIdsOnPage.includes(entry.id)}
                  onSelectChange={toggleSelectEntry}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => {
                  setSelectedIds([]);
                  setPage((p) => Math.max(1, p - 1));
                }}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm border border-border rounded-lg disabled:opacity-50 hover:bg-accent transition-colors"
              >
                Previous
              </button>
              <span className="text-sm text-secondary">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => {
                  setSelectedIds([]);
                  setPage((p) => Math.min(totalPages, p + 1));
                }}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-sm border border-border rounded-lg disabled:opacity-50 hover:bg-accent transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </section>
      </div>

      {/* Ingest Dialog */}
      <IngestDialog open={ingestOpen} onClose={() => setIngestOpen(false)} />
    </div>
  );
}

// Type helper to avoid importing from prisma in client component
type EntryCardEntry = {
  id: string;
  title?: string | null;
  sourceType: string;
  processStatus: string;
  contentType?: string | null;
  techDomain?: string | null;
  coreSummary?: string | null;
  practiceValue?: string | null;
  aiTags: string[];
  userTags: string[];
  createdAt: string;
};
