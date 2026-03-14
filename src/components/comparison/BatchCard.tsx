'use client';

import Link from 'next/link';
import { Clock, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { SerializedBatch } from './BatchHistoryList';

interface BatchCardProps {
  batch: SerializedBatch;
}

const modeLabel = (mode: string) => {
  switch (mode) {
    case 'TWO_STEP': return 'Two-Step';
    case 'TOOL_CALLING': return 'Tool-Calling';
    default: return mode;
  }
};

export function BatchCard({ batch }: BatchCardProps) {
  const createdAt = new Date(batch.createdAt);
  const isCompleted = batch.status === 'COMPLETED';
  const isProcessing = batch.status === 'PROCESSING';
  const isFailed = batch.status === 'FAILED';

  // Format date
  const formattedDate = createdAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Status badge
  const statusColor = isCompleted
    ? 'bg-green-100 text-green-800'
    : isProcessing
    ? 'bg-blue-100 text-blue-800'
    : isFailed
    ? 'bg-red-100 text-red-800'
    : 'bg-gray-100 text-gray-800';

  // Win rate indicator
  const renderWinRateIndicator = () => {
    if (!isCompleted || batch.winRate === null) return null;

    const winRate = batch.winRate * 100;
    const Icon =
      winRate > 60 ? TrendingUp : winRate < 40 ? TrendingDown : Minus;
    const color =
      winRate > 60
        ? 'text-green-600'
        : winRate < 40
        ? 'text-red-600'
        : 'text-gray-600';

    return (
      <div className={`flex items-center gap-1 ${color}`}>
        <Icon size={16} />
        <span className="font-semibold">{winRate.toFixed(0)}%</span>
      </div>
    );
  };

  return (
    <Link
      href={`/comparison/${batch.id}`}
      className="block bg-card border border-border rounded-lg p-6 hover:border-primary transition-colors"
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">
            {modeLabel(batch.sourceMode)} vs {modeLabel(batch.targetMode)}
          </h3>
          <div className="flex items-center gap-2 mt-1 text-sm text-secondary">
            <Clock size={14} />
            <span>{formattedDate}</span>
          </div>
        </div>

        <span
          className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor}`}
        >
          {batch.status}
        </span>
      </div>

      {/* Progress bar */}
      {isProcessing && (
        <div className="mb-4">
          <div className="flex justify-between text-sm text-secondary mb-1">
            <span>Progress</span>
            <span>
              {batch.processedCount} / {batch.entryCount}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all"
              style={{ width: `${batch.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <p className="text-secondary">Entries</p>
          <p className="font-semibold">{batch.entryCount}</p>
        </div>

        {isCompleted && batch.winRate !== null && (
          <>
            <div>
              <p className="text-secondary">Win Rate</p>
              <div className="mt-1">{renderWinRateIndicator()}</div>
            </div>

            <div>
              <p className="text-secondary">Avg Score Diff</p>
              <p
                className={`font-semibold ${
                  batch.avgScoreDiff && batch.avgScoreDiff > 0
                    ? 'text-green-600'
                    : batch.avgScoreDiff && batch.avgScoreDiff < 0
                    ? 'text-red-600'
                    : 'text-gray-600'
                }`}
              >
                {batch.avgScoreDiff !== null
                  ? `${batch.avgScoreDiff > 0 ? '+' : ''}${batch.avgScoreDiff.toFixed(1)}`
                  : 'N/A'}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Entry previews + winner distribution — COMPLETED only */}
      {isCompleted && (batch.entryPreviews?.length ?? 0) > 0 && (
        <div className="mt-3 pt-3 border-t border-border space-y-2">
          <ul className="space-y-0.5">
            {batch.entryPreviews!.map((e, i) => (
              <li key={i} className="text-xs text-muted-foreground truncate">
                · {e.title ?? 'Untitled'}
              </li>
            ))}
            {batch.entryCount > (batch.entryPreviews?.length ?? 0) && (
              <li className="text-xs text-muted-foreground">
                · +{batch.entryCount - (batch.entryPreviews?.length ?? 0)} more
              </li>
            )}
          </ul>

          {batch.winnerDistribution && (
            <div className="flex gap-3 text-xs">
              <span className="text-green-600">
                Original wins {batch.winnerDistribution.source}
              </span>
              <span className="text-red-600">
                Comparison wins {batch.winnerDistribution.target}
              </span>
              <span className="text-gray-500">
                Ties {batch.winnerDistribution.tie}
              </span>
            </div>
          )}
        </div>
      )}
    </Link>
  );
}
