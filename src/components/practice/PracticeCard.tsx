"use client";

import { StepTracker } from "./StepTracker";
import { Clock, Gauge, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

interface PracticeCardProps {
  task: {
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
}

const difficultyConfig: Record<string, { label: string; color: string }> = {
  EASY: { label: "Easy", color: "text-green-600" },
  MEDIUM: { label: "Medium", color: "text-yellow-600" },
  HARD: { label: "Hard", color: "text-red-600" },
};

const statusConfig: Record<string, { label: string; color: string }> = {
  QUEUED: { label: "Queued", color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
  IN_PROGRESS: { label: "In Progress", color: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" },
  COMPLETED: { label: "Completed", color: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" },
  SKIPPED: { label: "Skipped", color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
};

export function PracticeCard({ task }: PracticeCardProps) {
  const [expanded, setExpanded] = useState(task.status === "IN_PROGRESS");
  const difficulty = difficultyConfig[task.difficulty] || difficultyConfig.MEDIUM;
  const status = statusConfig[task.status] || statusConfig.QUEUED;

  const completedSteps = task.steps.filter(
    (s) => s.status === "COMPLETED" || s.status === "SKIPPED"
  ).length;
  const progress = task.steps.length > 0 ? (completedSteps / task.steps.length) * 100 : 0;

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div
        className="p-4 cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs px-2 py-0.5 rounded-full ${status.color}`}>
                {status.label}
              </span>
              <h3 className="text-sm font-medium truncate">{task.title}</h3>
            </div>
            <p className="text-xs text-secondary line-clamp-1">{task.summary}</p>
          </div>
          {expanded ? <ChevronUp size={16} className="text-secondary shrink-0" /> : <ChevronDown size={16} className="text-secondary shrink-0" />}
        </div>

        {/* Meta */}
        <div className="flex items-center gap-4 mt-2 text-xs text-secondary">
          <span className={`flex items-center gap-1 ${difficulty.color}`}>
            <Gauge size={12} />
            {difficulty.label}
          </span>
          <span className="flex items-center gap-1">
            <Clock size={12} />
            {task.estimatedTime}
          </span>
          <span>{completedSteps}/{task.steps.length} steps</span>
        </div>

        {/* Progress bar */}
        <div className="mt-2 w-full h-1.5 bg-accent rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Expanded: Prerequisites + Steps */}
      {expanded && (
        <div className="border-t border-border p-4 space-y-4">
          {/* Prerequisites */}
          {task.prerequisites.length > 0 && (
            <div>
              <p className="text-xs font-medium text-secondary mb-1.5">Prerequisites</p>
              <div className="flex flex-wrap gap-1.5">
                {task.prerequisites.map((prereq, i) => (
                  <span key={i} className="text-xs px-2 py-0.5 rounded bg-accent text-secondary">
                    {prereq}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Steps */}
          <StepTracker steps={task.steps} />
        </div>
      )}
    </div>
  );
}
