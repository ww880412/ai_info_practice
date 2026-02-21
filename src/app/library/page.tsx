"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useEntries } from "@/hooks/useEntries";
import { EntryCard } from "@/components/library/EntryCard";
import { EntryFilters } from "@/components/library/EntryFilters";
import { IngestDialog } from "@/components/ingest/IngestDialog";
import { Plus } from "lucide-react";

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
  const [ingestOpen, setIngestOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [contentType, setContentType] = useState("");
  const [techDomain, setTechDomain] = useState("");
  const [practiceValue, setPracticeValue] = useState("");

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
    q: debouncedQ,
    contentType: contentType || undefined,
    techDomain: techDomain || undefined,
    practiceValue: practiceValue || undefined,
  });

  const entries = data?.data || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / 20);

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

      {/* Filters */}
      <EntryFilters
        q={q}
        onQChange={(v) => { setQ(v); setPage(1); }}
        contentType={contentType}
        onContentTypeChange={(v) => { setContentType(v); setPage(1); }}
        techDomain={techDomain}
        onTechDomainChange={(v) => { setTechDomain(v); setPage(1); }}
        practiceValue={practiceValue}
        onPracticeValueChange={(v) => { setPracticeValue(v); setPage(1); }}
      />

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
          {entries.map((entry: Record<string, unknown>) => (
            <EntryCard
              key={entry.id as string}
              entry={entry as EntryCardEntry}
              onClick={(id) => router.push(`/entry/${id}`)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm border border-border rounded-lg disabled:opacity-50 hover:bg-accent transition-colors"
          >
            Previous
          </button>
          <span className="text-sm text-secondary">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 text-sm border border-border rounded-lg disabled:opacity-50 hover:bg-accent transition-colors"
          >
            Next
          </button>
        </div>
      )}

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
