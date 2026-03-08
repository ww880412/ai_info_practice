"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { useComparisonBatch } from "@/hooks/useComparisonBatch";

interface CompareModesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedEntryIds: string[];
  onSuccess?: () => void;
}

export function CompareModesDialog({
  open,
  onOpenChange,
  selectedEntryIds,
  onSuccess,
}: CompareModesDialogProps) {
  const router = useRouter();
  const [targetMode, setTargetMode] = useState<"two-step" | "tool-calling">("tool-calling");
  const { createBatch, createMutation } = useComparisonBatch();

  useEffect(() => {
    if (!open) return;

    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [open]);

  const handleClose = () => {
    if (createMutation.isPending) return;
    createMutation.reset();
    onOpenChange(false);
  };

  const handleSubmit = () => {
    if (selectedEntryIds.length === 0 || createMutation.isPending) return;

    createBatch(
      {
        entryIds: selectedEntryIds,
        targetMode,
      },
      {
        onSuccess: (data) => {
          onOpenChange(false);
          onSuccess?.();
          router.push(`/comparison/${data.batchId}`);
        },
      }
    );
  };

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
      <div className="relative w-full max-w-lg rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">模式对比</h2>
            <p className="text-sm text-secondary">
              选择要对比的目标模式，系统将重新处理所选的 {selectedEntryIds.length} 个条目。
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={createMutation.isPending}
            className="rounded-md p-1 text-secondary transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Close comparison dialog"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">目标模式</legend>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-accent/40">
              <input
                type="radio"
                name="target-mode"
                value="two-step"
                checked={targetMode === "two-step"}
                onChange={() => setTargetMode("two-step")}
                className="mt-1 h-4 w-4 border-border text-primary focus:ring-primary"
              />
              <div className="space-y-1">
                <p className="text-sm font-medium">Two-Step</p>
                <p className="text-xs text-secondary">先分类后深度分析，适合常规内容。</p>
              </div>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-accent/40">
              <input
                type="radio"
                name="target-mode"
                value="tool-calling"
                checked={targetMode === "tool-calling"}
                onChange={() => setTargetMode("tool-calling")}
                className="mt-1 h-4 w-4 border-border text-primary focus:ring-primary"
              />
              <div className="space-y-1">
                <p className="text-sm font-medium">Tool-Calling</p>
                <p className="text-xs text-secondary">分析过程中调用工具，适合复杂内容。</p>
              </div>
            </label>
          </fieldset>

          {createMutation.isError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
              创建对比任务失败
              {createMutation.error instanceof Error && createMutation.error.message
                ? `：${createMutation.error.message}`
                : ""}
            </div>
          )}

          {createMutation.data && (
            <div className="rounded-lg border border-border bg-accent/40 px-3 py-2 text-sm">
              预计处理时间：{createMutation.data.estimatedTime}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border px-5 py-4">
          <button
            type="button"
            onClick={handleClose}
            disabled={createMutation.isPending}
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={selectedEntryIds.length === 0 || createMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {createMutation.isPending && <Loader2 size={14} className="animate-spin" />}
            开始对比
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
