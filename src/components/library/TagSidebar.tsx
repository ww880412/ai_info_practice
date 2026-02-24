"use client";

import { useQuery } from "@tanstack/react-query";
import { Tags, X } from "lucide-react";

interface TagStats {
  tag: string;
  count: number;
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
  onClick,
}: {
  tag: string;
  count: number;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full transition-colors ${
        selected
          ? "bg-primary text-white"
          : "bg-accent text-secondary hover:bg-accent-hover"
      }`}
    >
      <span>{tag}</span>
      <span className={selected ? "text-primary-foreground/70" : "text-secondary"}>
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
  const { data, isLoading } = useQuery<TagStatsResponse>({
    queryKey: ["tags", "stats", scope],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      searchParams.set("scope", scope);
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
                {data.data.aiTags.map(({ tag, count }) => (
                  <TagPill
                    key={tag}
                    tag={tag}
                    count={count}
                    selected={selectedAiTags.includes(tag)}
                    onClick={() => toggleAiTag(tag)}
                  />
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
                {data.data.userTags.map(({ tag, count }) => (
                  <TagPill
                    key={tag}
                    tag={tag}
                    count={count}
                    selected={selectedUserTags.includes(tag)}
                    onClick={() => toggleUserTag(tag)}
                  />
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
