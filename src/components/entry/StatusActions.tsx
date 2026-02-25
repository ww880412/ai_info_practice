"use client";

import { useState } from "react";
import { KnowledgeStatus } from "@prisma/client";
import { useEntryStatus } from "@/hooks/useEntryStatus";
import { Check, Archive, AlertTriangle, RotateCcw } from "lucide-react";
import { useToast } from "@/components/common/Toast";

interface StatusActionsProps {
  entryId: string;
  currentStatus: KnowledgeStatus;
}

export function StatusActions({ entryId, currentStatus }: StatusActionsProps) {
  const updateStatus = useEntryStatus();
  const [deprecatedReason, setDeprecatedReason] = useState("");
  const [showReasonInput, setShowReasonInput] = useState(false);
  const { showToast } = useToast();

  const handleStatusChange = (newStatus: KnowledgeStatus, reason?: string) => {
    updateStatus.mutate({ entryId, status: newStatus, reason });
    setShowReasonInput(false);
    setDeprecatedReason("");
  };

  const handleDeprecate = () => {
    if (!deprecatedReason.trim()) {
      showToast("error", "Please provide a reason for marking as deprecated");
      return;
    }
    handleStatusChange("DEPRECATED", deprecatedReason);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-secondary">Status:</span>
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
          currentStatus === "PENDING" ? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" :
          currentStatus === "TO_REVIEW" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" :
          currentStatus === "ACTIVE" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
          currentStatus === "ARCHIVED" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
          "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
        }`}>
          {currentStatus}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {currentStatus === "TO_REVIEW" && (
          <button
            onClick={() => handleStatusChange("ACTIVE")}
            disabled={updateStatus.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-green-700 bg-green-100 rounded-lg hover:bg-green-200 disabled:opacity-50 transition-colors dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50"
          >
            <Check size={14} />
            Confirm
          </button>
        )}

        {currentStatus === "ACTIVE" && (
          <>
            <button
              onClick={() => handleStatusChange("ARCHIVED")}
              disabled={updateStatus.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-100 rounded-lg hover:bg-blue-200 disabled:opacity-50 transition-colors dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50"
            >
              <Archive size={14} />
              Archive
            </button>
            <button
              onClick={() => setShowReasonInput(true)}
              disabled={updateStatus.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-700 bg-red-100 rounded-lg hover:bg-red-200 disabled:opacity-50 transition-colors dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
            >
              <AlertTriangle size={14} />
              Mark as Deprecated
            </button>
          </>
        )}

        {currentStatus === "ARCHIVED" && (
          <button
            onClick={() => handleStatusChange("ACTIVE")}
            disabled={updateStatus.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-green-700 bg-green-100 rounded-lg hover:bg-green-200 disabled:opacity-50 transition-colors dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50"
          >
            <RotateCcw size={14} />
            Restore
          </button>
        )}
      </div>

      {showReasonInput && (
        <div className="space-y-2 p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
          <label className="block text-xs font-medium text-secondary">
            Reason for deprecation:
          </label>
          <input
            type="text"
            value={deprecatedReason}
            onChange={(e) => setDeprecatedReason(e.target.value)}
            placeholder="e.g., Outdated information, better alternative available"
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <div className="flex gap-2">
            <button
              onClick={handleDeprecate}
              disabled={updateStatus.isPending || !deprecatedReason.trim()}
              className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              Confirm
            </button>
            <button
              onClick={() => {
                setShowReasonInput(false);
                setDeprecatedReason("");
              }}
              className="px-3 py-1.5 text-sm font-medium text-secondary border border-border rounded-lg hover:bg-accent transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {updateStatus.error && (
        <p className="text-xs text-danger">
          {updateStatus.error instanceof Error ? updateStatus.error.message : "Failed to update status"}
        </p>
      )}
    </div>
  );
}
