"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useEntry } from "@/hooks/useEntries";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { StepTracker } from "@/components/practice/StepTracker";
import { ReasoningTraceView } from "@/components/agent/ReasoningTraceView";
import { DynamicSummary } from "@/components/entry/DynamicSummary";
import { MetadataPanel } from "@/components/entry/MetadataPanel";
import { QualityPanel } from "@/components/entry/QualityPanel";
import { StatusActions } from "@/components/entry/StatusActions";
import {
  ArrowLeft,
  ExternalLink,
  Loader2,
  RefreshCw,
  Github,
  Globe,
  FileText,
  Type,
  MessageCircle,
  Twitter,
  Sparkles,
  Brain,
  Info,
  FileTextIcon,
  Activity,
  Gauge,
} from "lucide-react";

const sourceIconMap: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  GITHUB: Github,
  WECHAT: MessageCircle,
  TWITTER: Twitter,
  WEBPAGE: Globe,
  PDF: FileText,
  TEXT: Type,
};

const contentTypeLabels: Record<string, string> = {
  TUTORIAL: "Tutorial",
  TOOL_RECOMMENDATION: "Tool Recommendation",
  TECH_PRINCIPLE: "Technical Principle",
  CASE_STUDY: "Case Study",
  OPINION: "Opinion",
};

const techDomainLabels: Record<string, string> = {
  PROMPT_ENGINEERING: "Prompt Engineering",
  AGENT: "Agent",
  RAG: "RAG",
  FINE_TUNING: "Fine-tuning",
  DEPLOYMENT: "Deployment",
  OTHER: "Other",
};

// Tab types
type TabType = "overview" | "summary" | "practice" | "related" | "trace" | "quality";

const tabs: { id: TabType; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { id: "overview", label: "Overview", icon: Info },
  { id: "summary", label: "Summary", icon: FileTextIcon },
  { id: "practice", label: "Practice", icon: Brain },
  { id: "related", label: "Related", icon: Sparkles },
  { id: "trace", label: "Trace", icon: Activity },
  { id: "quality", label: "Quality", icon: Gauge },
];

export default function EntryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = params.id as string;
  const { data: entry, isLoading } = useEntry(id);
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  const reprocess = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/ai/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId: id }),
      });
      if (!res.ok) throw new Error("Reprocess failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entry", id] });
    },
  });

  const deleteEntry = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/entries/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entries"] });
      router.push("/library");
    },
  });

  const generateSmartSummary = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/ai/smart-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId: id }),
      });
      if (!res.ok) throw new Error("Smart summary failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entry", id] });
    },
  });

  // Fetch related entries
  const { data: relatedData, isLoading: relatedLoading } = useQuery({
    queryKey: ["relatedEntries", id],
    queryFn: async () => {
      const res = await fetch(`/api/ai/related?entryId=${id}`);
      if (!res.ok) throw new Error("Failed to fetch related entries");
      return res.json();
    },
    enabled: !!id && entry?.processStatus === "DONE",
  });

  const refreshRelated = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/ai/related?entryId=${id}`);
      if (!res.ok) throw new Error("Failed to fetch related entries");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["relatedEntries", id], data);
    },
  });

  // Fetch reasoning trace
  const { data: traceData, isLoading: traceLoading } = useQuery({
    queryKey: ["entryTrace", id],
    queryFn: async () => {
      const res = await fetch(`/api/entries/${id}/trace`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!id && entry?.processStatus === "DONE",
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="text-center py-20">
        <p className="text-secondary">Entry not found</p>
      </div>
    );
  }

  const SourceIcon = sourceIconMap[entry.sourceType] || Globe;
  const isProcessing = ["PENDING", "PARSING", "AI_PROCESSING"].includes(entry.processStatus);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1 text-sm text-secondary hover:text-foreground transition-colors"
      >
        <ArrowLeft size={16} />
        Back
      </button>

      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <SourceIcon size={18} className="text-secondary" />
          <h1 className="text-xl font-bold">{entry.title || "Untitled"}</h1>
        </div>

        {/* Source link */}
        {entry.rawUrl && entry.inputType === "LINK" && (
          <a
            href={entry.rawUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <ExternalLink size={12} />
            {entry.rawUrl}
          </a>
        )}

        {/* Processing status */}
        {isProcessing && (
          <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
            <Loader2 size={16} className="animate-spin text-primary" />
            <span className="text-sm">
              {entry.processError?.trim()
                ? entry.processError
                : entry.processStatus === "PARSING"
                  ? "Parsing content..."
                  : "AI analyzing..."}
            </span>
          </div>
        )}

        {entry.processStatus === "FAILED" && (
          <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
            <p className="text-sm text-danger">{entry.processError || "Processing failed"}</p>
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      {entry.processStatus === "DONE" && (
        <div className="border-b border-border">
          <nav className="flex gap-1 -mb-px overflow-x-auto" aria-label="Tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    isActive
                      ? "border-primary text-primary"
                      : "border-transparent text-secondary hover:text-foreground hover:border-border"
                  }`}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      )}

      {/* Tab Content */}
      {entry.processStatus === "DONE" && (
        <div className="space-y-4">
          {/* Overview Tab */}
          {activeTab === "overview" && (
            <>
              {/* Status Actions */}
              <StatusActions entryId={id} currentStatus={entry.knowledgeStatus} />

              {/* Tags */}
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {entry.contentType && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-accent text-secondary font-medium">
                      {contentTypeLabels[entry.contentType] || entry.contentType}
                    </span>
                  )}
                  {entry.techDomain && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium">
                      {techDomainLabels[entry.techDomain] || entry.techDomain}
                    </span>
                  )}
                  {entry.practiceValue === "ACTIONABLE" && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium">
                      Actionable
                    </span>
                  )}
                  {entry.practiceValue === "KNOWLEDGE" && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-medium">
                      Knowledge
                    </span>
                  )}
                </div>

                {/* AI Tags */}
                {entry.aiTags?.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-secondary mb-2">AI Tags</p>
                    <div className="flex flex-wrap gap-1.5">
                      {entry.aiTags.map((tag: string) => (
                        <span key={tag} className="text-xs px-2 py-0.5 rounded bg-accent text-secondary">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Metadata Panel */}
              <MetadataPanel
                summaryStructure={entry.summaryStructure}
                coreSummary={null}
                keyPoints={entry.keyPointsNew ?? entry.keyPoints}
                boundaries={entry.boundaries}
                hasPracticeTask={!!entry.practiceTask}
                hasRelatedEntries={!!relatedData?.relatedEntries?.length}
                confidence={entry.confidence}
              />
            </>
          )}

          {/* Summary Tab */}
          {activeTab === "summary" && (
            <>
              {/* Dynamic Summary */}
              {(entry.summaryStructure || entry.keyPointsNew || entry.boundaries || entry.confidence) && (
                <div className="border border-border rounded-lg p-4 space-y-3">
                  <p className="text-xs font-medium text-secondary">Dynamic Summary</p>
                  <DynamicSummary
                    summaryStructure={entry.summaryStructure}
                    keyPoints={entry.keyPointsNew}
                    boundaries={entry.boundaries}
                    difficulty={entry.difficulty}
                    confidence={entry.confidence}
                  />
                </div>
              )}

              {/* Core summary (fallback if no dynamic summary) */}
              {!entry.summaryStructure && entry.coreSummary && (
                <div className="bg-accent p-4 rounded-lg">
                  <p className="text-xs font-medium text-secondary mb-1">Core Summary</p>
                  <p className="text-sm">{entry.coreSummary}</p>
                </div>
              )}

              {/* Key points (fallback if no keyPointsNew) */}
              {!entry.keyPointsNew && entry.keyPoints?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-secondary mb-2">Key Points</p>
                  <ul className="space-y-1">
                    {entry.keyPoints.map((point: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-primary mt-0.5">•</span>
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {/* Practice Tab */}
          {activeTab === "practice" && (
            <>
              {entry.practiceTask ? (
                <div className="border border-border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Practice Task</h3>
                    <span className="text-xs text-secondary">
                      {entry.practiceTask.difficulty} · {entry.practiceTask.estimatedTime}
                    </span>
                  </div>
                  <p className="text-xs text-secondary">{entry.practiceTask.summary}</p>

                  {entry.practiceTask.prerequisites?.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-secondary mb-1">Prerequisites</p>
                      <div className="flex flex-wrap gap-1.5">
                        {entry.practiceTask.prerequisites.map((p: string, i: number) => (
                          <span key={i} className="text-xs px-2 py-0.5 rounded bg-accent text-secondary">
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <StepTracker steps={entry.practiceTask.steps} />
                </div>
              ) : (
                <div className="border border-border rounded-lg p-4">
                  <p className="text-xs text-secondary">No practice task available for this entry.</p>
                </div>
              )}
            </>
          )}

          {/* Related Tab */}
          {activeTab === "related" && (
            <>
              {/* Smart Summary */}
              <div className="border border-primary/20 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold flex items-center gap-1.5">
                    <Sparkles size={14} className="text-primary" />
                    Smart Summary
                  </h3>
                  <button
                    onClick={() => generateSmartSummary.mutate()}
                    disabled={generateSmartSummary.isPending || !entry.originalContent}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-primary border border-primary/30 rounded hover:bg-primary/5 disabled:opacity-50 transition-colors"
                  >
                    <Sparkles size={12} className={generateSmartSummary.isPending ? "animate-spin" : ""} />
                    {entry.smartSummary ? "Regenerate" : "Generate"}
                  </button>
                </div>

                {generateSmartSummary.isPending && (
                  <div className="flex items-center gap-2 text-sm text-secondary">
                    <Loader2 size={14} className="animate-spin" />
                    Generating smart summary...
                  </div>
                )}

                {entry.tldr && (
                  <div className="bg-primary/5 p-3 rounded">
                    <p className="text-xs font-medium text-primary mb-1">TL;DR</p>
                    <p className="text-sm">{entry.tldr}</p>
                  </div>
                )}

                {entry.smartSummary && (
                  <div>
                    <p className="text-xs font-medium text-secondary mb-1">Concise Summary</p>
                    <p className="text-sm">{entry.smartSummary}</p>
                  </div>
                )}

                {entry.keyInsights && entry.keyInsights.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-secondary mb-2">Key Insights</p>
                    <ul className="space-y-1">
                      {entry.keyInsights.map((insight: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <span className="text-primary mt-0.5">•</span>
                          {insight}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {!entry.smartSummary && !generateSmartSummary.isPending && (
                  <p className="text-xs text-secondary">
                    Click &quot;Generate&quot; to create a smart summary with key insights.
                  </p>
                )}
              </div>

              {/* Related Entries */}
              <div className="border border-purple-200 dark:border-purple-800/30 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold flex items-center gap-1.5">
                    <Sparkles size={14} className="text-purple-500" />
                    Related Entries
                  </h3>
                  <button
                    onClick={() => refreshRelated.mutate()}
                    disabled={refreshRelated.isPending}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-purple-600 dark:text-purple-400 border border-purple-300/30 dark:border-purple-700/30 rounded hover:bg-purple-50 dark:hover:bg-purple-900/20 disabled:opacity-50 transition-colors"
                  >
                    <RefreshCw size={12} className={refreshRelated.isPending ? "animate-spin" : ""} />
                    Refresh
                  </button>
                </div>

                {relatedLoading && (
                  <div className="flex items-center gap-2 text-sm text-secondary">
                    <Loader2 size={14} className="animate-spin" />
                    Finding related entries...
                  </div>
                )}

                {relatedData?.relatedEntries?.length > 0 ? (
                  <div className="space-y-2">
                    {relatedData.relatedEntries.map((related: { id: string; title: string; summary: string; similarity: number; relationType: string }) => (
                      <Link
                        key={related.id}
                        href={`/entry/${related.id}`}
                        className="block p-3 rounded-lg bg-purple-50 dark:bg-purple-950/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{related.title}</p>
                            <p className="text-xs text-secondary line-clamp-2 mt-0.5">{related.summary}</p>
                          </div>
                          <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded ${
                            related.relationType === 'similar_topic' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                            related.relationType === 'builds_on' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                            related.relationType === 'complementary' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                            'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          }`}>
                            {related.relationType.replace('_', ' ')}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  !relatedLoading && (
                    <p className="text-xs text-secondary">
                      No related entries found yet.
                    </p>
                  )
                )}
              </div>
            </>
          )}

          {/* Trace Tab */}
          {activeTab === "trace" && (
            <div className="border border-border rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Brain size={16} className="text-primary" />
                <h3 className="text-sm font-semibold">AI Processing Trace</h3>
              </div>

              {traceLoading && (
                <div className="flex items-center gap-2 text-sm text-secondary">
                  <Loader2 size={14} className="animate-spin" />
                  Loading reasoning trace...
                </div>
              )}

              {traceData?.steps && traceData.steps.length > 0 ? (
                <ReasoningTraceView steps={traceData.steps} />
              ) : (
                !traceLoading && (
                  <p className="text-xs text-secondary">
                    No reasoning trace available yet.
                  </p>
                )
              )}
            </div>
          )}

          {activeTab === "quality" && <QualityPanel entryId={id} />}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t border-border">
        <button
          onClick={() => reprocess.mutate()}
          disabled={reprocess.isPending || isProcessing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-accent disabled:opacity-50 transition-colors"
        >
          <RefreshCw size={14} className={reprocess.isPending ? "animate-spin" : ""} />
          Re-process
        </button>
        <button
          onClick={() => {
            if (confirm("Delete this entry?")) deleteEntry.mutate();
          }}
          disabled={deleteEntry.isPending}
          className="px-3 py-1.5 text-sm text-danger border border-danger/30 rounded-lg hover:bg-danger/5 disabled:opacity-50 transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
