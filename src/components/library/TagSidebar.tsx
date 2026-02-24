"use client";

import { useQuery } from "@tanstack/react-query";
import { Tags, X } from "lucide-react";

interface TagStats {
  tag: string;
  count: number;
  aliases: { tag: string; count: number }[];
  filterTags: string[];
}

interface TagStatsResponse {
  data: {
    aiTags: TagStats[];
    userTags: TagStats[];
  };
}

interface TagSidebarProps {
  selectedAiTags: string[];
  selectedUserTags: string[];
  onAiTagsChange: (tags: string[]) => void;
  onUserTagsChange: (tags: string[]) => void;
  scope?: "all" | "recent30d";
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="animate-pulse space-y-2">
          <div className="h-4 w-20 bg-accent rounded" />
          <div className="flex flex-wrap gap-1.5">
            <div className="h-5 w-12 bg-accent rounded-full" />
            <div className="h-5 w-16 bg-accent rounded-full" />
            <div className="h-5 w-10 bg-accent rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

function TagPill({
  tag,
  count,
  selected,
  partial,
  onClick,
}: {
  tag: string;
  count: number;
  selected: boolean;
  partial?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`max-w-full inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full transition-colors ${
        selected
          ? "bg-primary text-white"
          : partial
          ? "bg-primary/15 text-primary hover:bg-primary/25"
          : "bg-accent text-secondary hover:bg-accent-hover"
      }`}
      title={tag}
    >
      <span className="max-w-[220px] truncate">{tag}</span>
      <span className={`shrink-0 ${selected ? "text-primary-foreground/70" : "text-secondary"}`}>
        {count}
      </span>
    </button>
  );
}

function AliasPill({
  parentTag,
  aliasTag,
  count,
  selected,
  onClick,
}: {
  parentTag: string;
  aliasTag: string;
  count: number;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full transition-colors ${
        selected
          ? "bg-primary/20 text-primary"
          : "bg-accent/50 text-secondary hover:bg-accent"
      }`}
      title={`${parentTag} / ${aliasTag}`}
    >
      <span className="max-w-[180px] truncate">{aliasTag}</span>
      <span className="shrink-0">
        {count}
      </span>
    </button>
  );
}

export function TagSidebar({
  selectedAiTags,
  selectedUserTags,
  onAiTagsChange,
  onUserTagsChange,
  scope = "all",
}: TagSidebarProps) {
  const tagLimit = 50;
  const minTagCount = 2;

  const { data, isLoading } = useQuery<TagStatsResponse>({
    queryKey: ["tags", "stats", scope],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      searchParams.set("scope", scope);
      searchParams.set("limit", String(tagLimit));
      searchParams.set("minCount", String(minTagCount));
      const res = await fetch(`/api/tags/stats?${searchParams}`);
      if (!res.ok) throw new Error("Failed to fetch tag stats");
      return res.json();
    },
  });

  const toggleAiTag = (tag: string) => {
    if (selectedAiTags.includes(tag)) {
      onAiTagsChange(selectedAiTags.filter((t) => t !== tag));
    } else {
      onAiTagsChange([...selectedAiTags, tag]);
    }
  };

  const toggleUserTag = (tag: string) => {
    if (selectedUserTags.includes(tag)) {
      onUserTagsChange(selectedUserTags.filter((t) => t !== tag));
    } else {
      onUserTagsChange([...selectedUserTags, tag]);
    }
  };

  const toggleAiTagGroup = (tags: string[]) => {
    if (tags.length === 0) return;
    const allSelected = tags.every((tag) => selectedAiTags.includes(tag));
    if (allSelected) {
      onAiTagsChange(selectedAiTags.filter((tag) => !tags.includes(tag)));
      return;
    }
    onAiTagsChange(Array.from(new Set([...selectedAiTags, ...tags])));
  };

  const toggleUserTagGroup = (tags: string[]) => {
    if (tags.length === 0) return;
    const allSelected = tags.every((tag) => selectedUserTags.includes(tag));
    if (allSelected) {
      onUserTagsChange(selectedUserTags.filter((tag) => !tags.includes(tag)));
      return;
    }
    onUserTagsChange(Array.from(new Set([...selectedUserTags, ...tags])));
  };

  const clearAiTags = () => onAiTagsChange([]);
  const clearUserTags = () => onUserTagsChange([]);

  const hasSelection = selectedAiTags.length > 0 || selectedUserTags.length > 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 text-sm font-medium">
        <Tags size={16} />
        <span>Tags</span>
        {hasSelection && (
          <button
            onClick={() => {
              clearAiTags();
              clearUserTags();
            }}
            className="ml-auto text-xs text-secondary hover:text-primary flex items-center gap-1"
          >
            <X size={12} />
            Clear
          </button>
        )}
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : (
        <>
          {/* AI Tags */}
          {data?.data.aiTags && data.data.aiTags.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-medium text-secondary uppercase tracking-wider">
                  AI Tags
                </h3>
                {selectedAiTags.length > 0 && (
                  <button
                    onClick={clearAiTags}
                    className="text-xs text-secondary hover:text-primary"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {data.data.aiTags.map(({ tag, count, aliases, filterTags }) => (
                  <div key={tag} className="space-y-1">
                    <TagPill
                      tag={tag}
                      count={count}
                      selected={filterTags.every((item) => selectedAiTags.includes(item))}
                      partial={
                        filterTags.some((item) => selectedAiTags.includes(item))
                        && !filterTags.every((item) => selectedAiTags.includes(item))
                      }
                      onClick={() => toggleAiTagGroup(filterTags)}
                    />
                    {aliases.length > 1 && (
                      <div className="ml-1 flex flex-wrap gap-1">
                        {aliases.map((alias) => (
                          <AliasPill
                            key={`${tag}-${alias.tag}`}
                            parentTag={tag}
                            aliasTag={alias.tag}
                            count={alias.count}
                            selected={selectedAiTags.includes(alias.tag)}
                            onClick={() => toggleAiTag(alias.tag)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* User Tags */}
          {data?.data.userTags && data.data.userTags.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-medium text-secondary uppercase tracking-wider">
                  User Tags
                </h3>
                {selectedUserTags.length > 0 && (
                  <button
                    onClick={clearUserTags}
                    className="text-xs text-secondary hover:text-primary"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {data.data.userTags.map(({ tag, count, aliases, filterTags }) => (
                  <div key={tag} className="space-y-1">
                    <TagPill
                      tag={tag}
                      count={count}
                      selected={filterTags.every((item) => selectedUserTags.includes(item))}
                      partial={
                        filterTags.some((item) => selectedUserTags.includes(item))
                        && !filterTags.every((item) => selectedUserTags.includes(item))
                      }
                      onClick={() => toggleUserTagGroup(filterTags)}
                    />
                    {aliases.length > 1 && (
                      <div className="ml-1 flex flex-wrap gap-1">
                        {aliases.map((alias) => (
                          <AliasPill
                            key={`${tag}-${alias.tag}`}
                            parentTag={tag}
                            aliasTag={alias.tag}
                            count={alias.count}
                            selected={selectedUserTags.includes(alias.tag)}
                            onClick={() => toggleUserTag(alias.tag)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!data?.data.aiTags?.length && !data?.data.userTags?.length && (
            <p className="text-sm text-secondary">No tags found</p>
          )}
        </>
      )}
    </div>
  );
}
