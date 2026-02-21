"use client";

import { useState } from "react";
import { usePracticeQueue } from "@/hooks/usePracticeQueue";
import { PracticeCard } from "@/components/practice/PracticeCard";
import { Loader2 } from "lucide-react";

type StatusFilter = "" | "QUEUED" | "IN_PROGRESS" | "COMPLETED";

const statusTabs: { value: StatusFilter; label: string }[] = [
  { value: "", label: "All" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "QUEUED", label: "Queued" },
  { value: "COMPLETED", label: "Completed" },
];

export default function PracticePage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");

  const { data: tasks, isLoading } = usePracticeQueue({
    status: statusFilter || undefined,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Practice Queue</h1>
        <p className="text-sm text-secondary mt-1">
          Track your hands-on practice progress
        </p>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 bg-accent p-1 rounded-lg w-fit">
        {statusTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              statusFilter === tab.value
                ? "bg-card text-foreground shadow-sm"
                : "text-secondary hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tasks */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-primary" />
        </div>
      ) : !tasks || tasks.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-secondary">No practice tasks yet</p>
          <p className="text-xs text-secondary mt-1">
            Add actionable content to your knowledge base to generate practice tasks
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task: Record<string, unknown>) => (
            <PracticeCard key={task.id as string} task={task as PracticeCardTask} />
          ))}
        </div>
      )}
    </div>
  );
}

// Type helper
type PracticeCardTask = {
  id: string;
  title: string;
  summary: string;
  status: string;
  difficulty: string;
  estimatedTime: string;
  prerequisites: string[];
  steps: {
    id: string;
    order: number;
    title: string;
    description: string;
    status: string;
    note?: string | null;
  }[];
  entry: {
    id: string;
    title?: string | null;
    sourceType: string;
    techDomain?: string | null;
    aiTags: string[];
  };
};
