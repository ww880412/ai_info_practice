'use client';

import { useState } from 'react';
import { BatchCard } from './BatchCard';

export interface SerializedBatch {
  id: string;
  createdAt: string; // ISO 8601 string
  sourceMode: string;
  targetMode: string;
  entryCount: number;
  status: string;
  progress: number;
  processedCount: number;
  winRate: number | null;
  avgScoreDiff: number | null;
  stats: any;
}

interface BatchHistoryListProps {
  initialBatches: SerializedBatch[];
  initialTotal: number;
}

export function BatchHistoryList({ initialBatches, initialTotal }: BatchHistoryListProps) {
  const [batches, setBatches] = useState<SerializedBatch[]>(initialBatches);
  const [total, setTotal] = useState(initialTotal);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const hasMore = batches.length < total;

  const loadMore = async () => {
    if (isLoading || !hasMore) return;

    setIsLoading(true);
    setError(null);

    // Exponential backoff: 1s, 2s, 4s, 8s
    const delay = Math.min(1000 * Math.pow(2, retryCount), 8000);

    try {
      await new Promise((resolve) => setTimeout(resolve, delay));

      const response = await fetch(
        `/api/comparison/batches?limit=10&offset=${batches.length}`
      );

      if (!response.ok) {
        throw new Error(`Failed to load more batches: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setBatches((prev) => [...prev, ...data.data.batches]);
      setTotal(data.data.total);
      setRetryCount(0); // Reset retry count on success
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      setRetryCount((prev) => prev + 1);
    } finally {
      setIsLoading(false);
    }
  };

  // Empty state
  if (batches.length === 0 && !isLoading) {
    return (
      <div className="text-center py-12">
        <p className="text-secondary text-lg">No comparison batches yet</p>
        <p className="text-secondary text-sm mt-2">
          Start a comparison from the Library page
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Batch cards */}
      <div className="grid gap-4">
        {batches.map((batch) => (
          <BatchCard key={batch.id} batch={batch} />
        ))}
      </div>

      {/* Load more button */}
      {hasMore && (
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={loadMore}
            disabled={isLoading}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Loading...' : 'Load More'}
          </button>

          {error && (
            <p className="text-sm text-red-500">
              {error}
              {retryCount > 0 && ` (Retry ${retryCount})`}
            </p>
          )}

          <p className="text-sm text-secondary">
            Showing {batches.length} of {total} batches
          </p>
        </div>
      )}
    </div>
  );
}
