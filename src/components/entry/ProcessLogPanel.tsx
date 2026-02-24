/**
 * ProcessLogPanel - 处理日志面板
 * 展示处理尝试列表、失败原因、重试链路
 */

"use client";

import { useQuery } from "@tanstack/react-query";
import { Clock, AlertCircle, CheckCircle, Loader2, RotateCw, ChevronRight } from "lucide-react";

type AttemptStatus = "SUCCESS" | "FAILED" | "RUNNING";

interface ProcessAttempt {
  id: string;
  attemptNumber: number;
  status: AttemptStatus;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  inputSummary: string | null;
  error: string | null;
  retryAfterMs: number | null;
  previousAttemptId: string | null;
}

// 状态配置
const statusConfig: Record<AttemptStatus, { icon: React.ReactNode; label: string; color: string }> = {
  SUCCESS: {
    icon: <CheckCircle size={14} className="text-green-500" />,
    label: "成功",
    color: "text-green-600 dark:text-green-400",
  },
  FAILED: {
    icon: <AlertCircle size={14} className="text-red-500" />,
    label: "失败",
    color: "text-red-600 dark:text-red-400",
  },
  RUNNING: {
    icon: <Loader2 size={14} className="text-blue-500 animate-spin" />,
    label: "处理中",
    color: "text-blue-600 dark:text-blue-400",
  },
};

// 格式化时间
function formatDuration(ms: number | null): string {
  if (ms === null) return "-";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

// 格式化时间间隔
function formatRetryAfter(ms: number | null): string | null {
  if (ms === null) return null;
  if (ms < 60000) return `${Math.round(ms / 1000)}s 后重试`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}m 后重试`;
  return `${Math.round(ms / 3600000)}h 后重试`;
}

interface ProcessLogPanelProps {
  entryId: string;
}

export function ProcessLogPanel({ entryId }: ProcessLogPanelProps) {
  const { data, isLoading, error } = useQuery<{ data: { attempts: ProcessAttempt[] } }>({
    queryKey: ["processAttempts", entryId],
    queryFn: async () => {
      const res = await fetch(`/api/entries/${entryId}/process-attempts`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="border border-border rounded-lg p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-muted rounded w-1/4"></div>
          <div className="h-16 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !data?.data?.attempts?.length) {
    return (
      <div className="border border-border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Clock size={16} className="text-primary" />
          <h3 className="text-sm font-semibold">Process Logs</h3>
        </div>
        <p className="text-xs text-secondary">
          No process attempts recorded yet.
        </p>
      </div>
    );
  }

  const attempts = data.data.attempts;

  return (
    <div className="border border-border rounded-lg p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-primary" />
          <h3 className="text-sm font-semibold">Process Logs</h3>
        </div>
        <span className="text-xs text-secondary">{attempts.length} attempts</span>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border"></div>

        <div className="space-y-4">
          {attempts.map((attempt, index) => {
            const config = statusConfig[attempt.status];
            const retryAfter = formatRetryAfter(attempt.retryAfterMs);

            return (
              <div key={attempt.id} className="relative pl-10">
                {/* Timeline dot */}
                <div className="absolute left-2 top-4 w-4 h-4 rounded-full bg-background border-2 border-primary flex items-center justify-center">
                  {attempt.status === "RUNNING" ? (
                    <Loader2 size={10} className="animate-spin text-blue-500" />
                  ) : attempt.status === "SUCCESS" ? (
                    <CheckCircle size={10} className="text-green-500" />
                  ) : (
                    <AlertCircle size={10} className="text-red-500" />
                  )}
                </div>

                {/* Attempt card */}
                <div className="border border-border rounded-lg p-3 space-y-2 bg-card">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Attempt #{attempt.attemptNumber}</span>
                      <div className="flex items-center gap-1">
                        {config.icon}
                        <span className={`text-xs ${config.color}`}>{config.label}</span>
                      </div>
                    </div>
                    <span className="text-xs text-secondary">
                      {new Date(attempt.startedAt).toLocaleString()}
                    </span>
                  </div>

                  {/* Duration */}
                  <div className="flex items-center gap-4 text-xs text-secondary">
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {formatDuration(attempt.durationMs)}
                    </span>
                    {attempt.retryAfterMs && (
                      <span className="flex items-center gap-1 text-orange-600">
                        <RotateCw size={12} />
                        {retryAfter}
                      </span>
                    )}
                  </div>

                  {/* Error message */}
                  {attempt.error && (
                    <div className="p-2 bg-red-50 dark:bg-red-950/20 rounded text-xs text-red-600 dark:text-red-400">
                      <span className="font-medium">Error:</span> {attempt.error}
                    </div>
                  )}

                  {/* Input summary */}
                  {attempt.inputSummary && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-secondary hover:text-foreground">
                        View Input
                      </summary>
                      <pre className="mt-1 p-2 bg-muted rounded overflow-x-auto max-h-24">
                        {attempt.inputSummary}
                      </pre>
                    </details>
                  )}
                </div>

                {/* Retry arrow */}
                {attempt.previousAttemptId && index < attempts.length - 1 && (
                  <div className="absolute -bottom-3 left-6 text-muted-foreground">
                    <ChevronRight size={16} className="rotate-90" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
