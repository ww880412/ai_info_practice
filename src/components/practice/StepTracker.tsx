"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Circle, Clock, SkipForward, Play, MessageSquare } from "lucide-react";
import { useState } from "react";

interface Step {
  id: string;
  order: number;
  title: string;
  description: string;
  status: string;
  note?: string | null;
}

interface StepTrackerProps {
  steps: Step[];
  taskId: string;
}

export function StepTracker({ steps, taskId }: StepTrackerProps) {
  const queryClient = useQueryClient();
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const [noteInput, setNoteInput] = useState("");

  const updateStep = useMutation({
    mutationFn: async ({ stepId, status, note }: { stepId: string; status: string; note?: string }) => {
      const res = await fetch(`/api/practice/steps/${stepId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, note }),
      });
      if (!res.ok) throw new Error("Failed to update step");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["practice"] });
      queryClient.invalidateQueries({ queryKey: ["entry"] });
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return <CheckCircle2 size={18} className="text-success" />;
      case "IN_PROGRESS":
        return <Play size={18} className="text-primary" />;
      case "SKIPPED":
        return <SkipForward size={18} className="text-secondary" />;
      default:
        return <Circle size={18} className="text-border" />;
    }
  };

  const getNextAction = (status: string) => {
    switch (status) {
      case "PENDING":
        return { label: "Start", nextStatus: "IN_PROGRESS" };
      case "IN_PROGRESS":
        return { label: "Complete", nextStatus: "COMPLETED" };
      default:
        return null;
    }
  };

  return (
    <div className="space-y-1">
      {steps.map((step, index) => {
        const action = getNextAction(step.status);
        const isExpanded = expandedStep === step.id;
        const isLast = index === steps.length - 1;

        return (
          <div key={step.id} className="relative">
            {/* Connection line */}
            {!isLast && (
              <div className="absolute left-[8.5px] top-[30px] w-0.5 h-[calc(100%-14px)] bg-border" />
            )}

            <div className="flex gap-3">
              {/* Status icon */}
              <div className="shrink-0 mt-1">{getStatusIcon(step.status)}</div>

              {/* Content */}
              <div className="flex-1 min-w-0 pb-4">
                <div
                  className="flex items-start justify-between gap-2 cursor-pointer"
                  onClick={() => setExpandedStep(isExpanded ? null : step.id)}
                >
                  <div className="min-w-0">
                    <p className={`text-sm font-medium ${step.status === "COMPLETED" || step.status === "SKIPPED" ? "line-through text-secondary" : ""}`}>
                      {step.order}. {step.title}
                    </p>
                  </div>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="mt-2 space-y-3">
                    <p className="text-xs text-secondary whitespace-pre-wrap">
                      {step.description}
                    </p>

                    {/* Note */}
                    {step.note && (
                      <div className="flex items-start gap-1.5 text-xs bg-accent p-2 rounded">
                        <MessageSquare size={12} className="mt-0.5 shrink-0 text-secondary" />
                        <span>{step.note}</span>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2">
                      {action && (
                        <button
                          onClick={() => updateStep.mutate({ stepId: step.id, status: action.nextStatus })}
                          disabled={updateStep.isPending}
                          className="px-3 py-1 text-xs font-medium text-white bg-primary rounded hover:bg-primary-hover disabled:opacity-50 transition-colors"
                        >
                          {action.label}
                        </button>
                      )}
                      {step.status !== "SKIPPED" && step.status !== "COMPLETED" && (
                        <button
                          onClick={() => updateStep.mutate({ stepId: step.id, status: "SKIPPED" })}
                          disabled={updateStep.isPending}
                          className="px-3 py-1 text-xs font-medium text-secondary border border-border rounded hover:bg-accent disabled:opacity-50 transition-colors"
                        >
                          Skip
                        </button>
                      )}

                      {/* Add note */}
                      <div className="flex gap-1 flex-1">
                        <input
                          type="text"
                          value={noteInput}
                          onChange={(e) => setNoteInput(e.target.value)}
                          placeholder="Add note..."
                          className="flex-1 px-2 py-1 text-xs border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary/30"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && noteInput.trim()) {
                              updateStep.mutate({ stepId: step.id, status: step.status, note: noteInput.trim() });
                              setNoteInput("");
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
