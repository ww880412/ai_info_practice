"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEntries } from "@/hooks/useEntries";
import { useAddEntriesToGroup, useGroups } from "@/hooks/useGroups";
import { getGroupImportState } from "@/lib/library/group-import";
import { flattenGroupOptions } from "@/lib/library/group-options";
import { EntryCard } from "@/components/library/EntryCard";
import { EntryFilters } from "@/components/library/EntryFilters";
import GroupSidebar from "@/components/library/GroupSidebar";
import { TagSidebar } from "@/components/library/TagSidebar";
import { IngestDialog } from "@/components/ingest/IngestDialog";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import {
  ChevronDown,
  ChevronRight,
  LayoutPanelLeft,
  Plus,
  Trash2,
  X,
} from "lucide-react";

function parseTagParam(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

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

function ActiveFilterChip({
  label,
  onRemove,
  tone = "neutral",
}: {
  label: string;
  onRemove: () => void;
  tone?: "primary" | "neutral";
}) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs transition-colors ${
        tone === "primary"
          ? "bg-primary/10 text-primary hover:bg-primary/20"
          : "bg-accent text-secondary hover:bg-accent/80"
      }`}
      title={`Remove filter: ${label}`}
    >
      <span>{label}</span>
      <X size={12} />
    </button>
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
  const [knowledgeStatus, setKnowledgeStatus] = useState("");
  const urlSortBy = searchParams.get("sortBy") as "createdAt" | "updatedAt" | "title" | null;
  const urlSortOrder = searchParams.get("sortOrder") as "asc" | "desc" | null;

  const [sortBy, setSortBy] = useState<"createdAt" | "updatedAt" | "title">(urlSortBy || "createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(urlSortOrder || "desc");
  const [isPanelStackVisible, setIsPanelStackVisible] = useState(false);
  const [groupsExpanded, setGroupsExpanded] = useState(true);
  const [tagsExpanded, setTagsExpanded] = useState(true);
  const [targetGroupId, setTargetGroupId] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const selectedGroupId = searchParams.get("groupId");

  const selectedAiTags = useMemo(
    () => parseTagParam(searchParams.get("aiTagsAny")),
    [searchParams]
  );
  const selectedUserTags = useMemo(
    () => parseTagParam(searchParams.get("userTagsAny")),
    [searchParams]
  );

  const selectedTagCount = selectedAiTags.length + selectedUserTags.length;
  const shouldShowPanelStack = isPanelStackVisible || Boolean(selectedGroupId) || selectedTagCount > 0;

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
    knowledgeStatus: knowledgeStatus || undefined,
    aiTagsAny: selectedAiTags.length > 0 ? selectedAiTags : undefined,
    userTagsAny: selectedUserTags.length > 0 ? selectedUserTags : undefined,
    sortBy,
    sortOrder,
  });

  const entries: EntryCardEntry[] = (data?.data as EntryCardEntry[]) || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / 20);
  const entryIds = entries.map((entry) => entry.id);
  const selectedIdsOnPage = selectedIds.filter((id) => entryIds.includes(id));
  const selectedCount = selectedIdsOnPage.length;
  const allSelected = entryIds.length > 0 && selectedCount === entryIds.length;
  const { data: groups } = useGroups();
  const groupOptions = useMemo(() => flattenGroupOptions(groups ?? []), [groups]);
  const addEntriesToGroup = useAddEntriesToGroup();
  const groupImportState = getGroupImportState(targetGroupId || null, selectedCount);

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

  const applyQueryParams = (mutator: (params: URLSearchParams) => void) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    mutator(nextParams);
    router.replace(nextParams.toString() ? `/library?${nextParams.toString()}` : "/library");
    setPage(1);
    setSelectedIds([]);
  };

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
    setShowDeleteConfirm(true);
  };

  const confirmBatchDelete = () => {
    batchDeleteEntries.mutate([...selectedIdsOnPage]);
    setShowDeleteConfirm(false);
  };

  const handleImportToGroup = () => {
    if (!targetGroupId || selectedCount === 0 || addEntriesToGroup.isPending) return;
    addEntriesToGroup.mutate(
      {
        groupId: targetGroupId,
        entryIds: [...selectedIdsOnPage],
      },
      {
        onSuccess: () => {
          setSelectedIds([]);
          queryClient.invalidateQueries({ queryKey: ["entries"] });
          queryClient.invalidateQueries({ queryKey: ["groups"] });
        },
      }
    );
  };

  const handleAiTagsChange = (tags: string[]) => {
    applyQueryParams((nextParams) => {
      if (tags.length > 0) nextParams.set("aiTagsAny", tags.join(","));
      else nextParams.delete("aiTagsAny");
    });
  };

  const handleUserTagsChange = (tags: string[]) => {
    applyQueryParams((nextParams) => {
      if (tags.length > 0) nextParams.set("userTagsAny", tags.join(","));
      else nextParams.delete("userTagsAny");
    });
  };

  const handleGroupSelect = (groupId: string | null) => {
    applyQueryParams((nextParams) => {
      if (groupId) nextParams.set("groupId", groupId);
      else nextParams.delete("groupId");
    });
  };

  const handleSortChange = (newSortBy: "createdAt" | "updatedAt" | "title") => {
    setSortBy(newSortBy);
    setPage(1);
    setSelectedIds([]);
    applyQueryParams((nextParams) => {
      nextParams.set("sortBy", newSortBy);
      nextParams.set("sortOrder", sortOrder);
    });
  };

  const toggleSortOrder = () => {
    const newOrder = sortOrder === "desc" ? "asc" : "desc";
    setSortOrder(newOrder);
    setPage(1);
    setSelectedIds([]);
    applyQueryParams((nextParams) => {
      nextParams.set("sortBy", sortBy);
      nextParams.set("sortOrder", newOrder);
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Knowledge Base</h1>
          <p className="text-sm text-secondary mt-1">{total} entries collected</p>
        </div>
        <button
          onClick={() => setIngestOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-hover transition-colors"
        >
          <Plus size={16} />
          Add
        </button>
      </div>

      <div className="rounded-xl border border-border bg-card p-3 sm:p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-secondary">Search first, then narrow with groups and tags.</p>
          <button
            type="button"
            onClick={() => setIsPanelStackVisible((prev) => !prev)}
            className="xl:hidden inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-secondary hover:bg-accent"
            aria-expanded={shouldShowPanelStack}
          >
            <LayoutPanelLeft size={14} />
            {shouldShowPanelStack ? "Hide Panels" : "Show Panels"}
          </button>
        </div>

        <EntryFilters
          q={q}
          onQChange={(v) => {
            setQ(v);
            setPage(1);
            setSelectedIds([]);
          }}
          contentType={contentType}
          onContentTypeChange={(v) => {
            setContentType(v);
            setPage(1);
            setSelectedIds([]);
          }}
          techDomain={techDomain}
          onTechDomainChange={(v) => {
            setTechDomain(v);
            setPage(1);
            setSelectedIds([]);
          }}
          practiceValue={practiceValue}
          onPracticeValueChange={(v) => {
            setPracticeValue(v);
            setPage(1);
            setSelectedIds([]);
          }}
        />

        {/* Knowledge Status Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => {
              setKnowledgeStatus("");
              setPage(1);
              setSelectedIds([]);
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
              !knowledgeStatus
                ? "bg-primary text-white"
                : "bg-accent text-secondary hover:bg-accent/80"
            }`}
          >
            All
          </button>
          <button
            onClick={() => {
              setKnowledgeStatus("TO_REVIEW");
              setPage(1);
              setSelectedIds([]);
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
              knowledgeStatus === "TO_REVIEW"
                ? "bg-yellow-600 text-white dark:bg-yellow-700"
                : "bg-yellow-100 text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:hover:bg-yellow-900/50"
            }`}
          >
            To Review
          </button>
          <button
            onClick={() => {
              setKnowledgeStatus("ACTIVE");
              setPage(1);
              setSelectedIds([]);
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
              knowledgeStatus === "ACTIVE"
                ? "bg-green-600 text-white dark:bg-green-700"
                : "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50"
            }`}
          >
            Active
          </button>
          <button
            onClick={() => {
              setKnowledgeStatus("ARCHIVED");
              setPage(1);
              setSelectedIds([]);
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
              knowledgeStatus === "ARCHIVED"
                ? "bg-blue-600 text-white dark:bg-blue-700"
                : "bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50"
            }`}
          >
            Archived
          </button>
          <button
            onClick={() => {
              setKnowledgeStatus("DEPRECATED");
              setPage(1);
              setSelectedIds([]);
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
              knowledgeStatus === "DEPRECATED"
                ? "bg-red-600 text-white dark:bg-red-700"
                : "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
            }`}
          >
            Deprecated
          </button>
        </div>

        {/* Sort Controls */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-secondary">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => handleSortChange(e.target.value as "createdAt" | "updatedAt" | "title")}
            className="h-7 rounded-md border border-border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="createdAt">Created Date</option>
            <option value="updatedAt">Updated Date</option>
            <option value="title">Title</option>
          </select>
          <button
            type="button"
            onClick={toggleSortOrder}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-secondary hover:bg-accent transition-colors"
            title={sortOrder === "desc" ? "Descending" : "Ascending"}
          >
            {sortOrder === "desc" ? "↓" : "↑"}
            <span>{sortOrder === "desc" ? "Newest" : "Oldest"}</span>
          </button>
        </div>

        {(selectedGroupId || selectedTagCount > 0) && (
          <div className="flex flex-wrap items-center gap-2">
            {selectedGroupId && (
              <ActiveFilterChip
                label="Group filter"
                tone="primary"
                onRemove={() => handleGroupSelect(null)}
              />
            )}

            {selectedAiTags.map((tag) => (
              <ActiveFilterChip
                key={`active-ai-${tag}`}
                label={`AI: ${tag}`}
                tone="primary"
                onRemove={() => handleAiTagsChange(selectedAiTags.filter((item) => item !== tag))}
              />
            ))}

            {selectedUserTags.map((tag) => (
              <ActiveFilterChip
                key={`active-user-${tag}`}
                label={`User: ${tag}`}
                onRemove={() => handleUserTagsChange(selectedUserTags.filter((item) => item !== tag))}
              />
            ))}

            {selectedTagCount > 1 && (
              <button
                type="button"
                onClick={() => {
                  applyQueryParams((nextParams) => {
                    nextParams.delete("aiTagsAny");
                    nextParams.delete("userTagsAny");
                  });
                }}
                className="ml-auto text-xs text-secondary hover:text-primary"
              >
                Clear tag filters
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[290px_minmax(0,1fr)] gap-5 items-start">
        <aside
          className={`${shouldShowPanelStack ? "block" : "hidden"} xl:block space-y-3 xl:sticky xl:top-24`}
        >
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <button
              type="button"
              onClick={() => setGroupsExpanded((open) => !open)}
              className="w-full px-3 py-2.5 flex items-center justify-between text-sm font-medium hover:bg-accent/40 transition-colors"
              aria-expanded={groupsExpanded}
            >
              <span className="inline-flex items-center gap-2">Groups</span>
              <span className="inline-flex items-center gap-1 text-secondary">
                {selectedGroupId && (
                  <span className="inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[11px] text-primary leading-none">
                    1
                  </span>
                )}
                {groupsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
            </button>
            {groupsExpanded && (
              <div className="border-t border-border p-3">
                <GroupSidebar selectedGroupId={selectedGroupId} onGroupSelect={handleGroupSelect} />
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <button
              type="button"
              onClick={() => setTagsExpanded((open) => !open)}
              className="w-full px-3 py-2.5 flex items-center justify-between text-sm font-medium hover:bg-accent/40 transition-colors"
              aria-expanded={tagsExpanded}
            >
              <span className="inline-flex items-center gap-2">Tag Intelligence</span>
              <span className="inline-flex items-center gap-1 text-secondary">
                {selectedTagCount > 0 && (
                  <span className="inline-flex items-center rounded-full bg-accent px-1.5 py-0.5 text-[11px] leading-none">
                    {selectedTagCount}
                  </span>
                )}
                {tagsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
            </button>
            {tagsExpanded && (
              <div className="border-t border-border p-3">
                <TagSidebar
                  selectedAiTags={selectedAiTags}
                  selectedUserTags={selectedUserTags}
                  onAiTagsChange={handleAiTagsChange}
                  onUserTagsChange={handleUserTagsChange}
                />
              </div>
            )}
          </div>
        </aside>

        <section className="space-y-4 min-w-0">
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
                <select
                  value={targetGroupId}
                  onChange={(e) => setTargetGroupId(e.target.value)}
                  className="h-8 min-w-[170px] rounded-md border border-border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  aria-label="Select target group"
                >
                  <option value="">Target group...</option>
                  {groupOptions.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleImportToGroup}
                  disabled={!groupImportState.canImport || addEntriesToGroup.isPending}
                  title={groupImportState.reason}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 px-3 py-1.5 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-900/40 dark:text-blue-300 dark:hover:bg-blue-950/20"
                >
                  {addEntriesToGroup.isPending ? "Importing..." : "Import to selected group"}
                </button>
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
          {addEntriesToGroup.error && (
            <p className="text-sm text-danger">
              {addEntriesToGroup.error instanceof Error
                ? addEntriesToGroup.error.message
                : "Failed to import entries to group"}
            </p>
          )}

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <EntryCardSkeleton key={i} />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="rounded-xl border border-border bg-card py-20 text-center">
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

      <IngestDialog open={ingestOpen} onClose={() => setIngestOpen(false)} />

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete Entries"
        description={`Delete ${selectedCount} selected entr${selectedCount > 1 ? "ies" : "y"}? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        danger={true}
        onConfirm={confirmBatchDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}

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
