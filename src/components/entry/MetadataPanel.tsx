"use client";

import { Info } from "lucide-react";
import {
  buildMetadataRows,
  type ConfidenceLevel,
  type SourceType,
} from "@/lib/entry/metadata-display";

interface SummaryMeta {
  fieldConfidence?: Record<string, ConfidenceLevel>;
  fieldSourceMap?: Record<string, SourceType>;
  extractedAt?: string;
  model?: string;
}

interface SummaryStructure {
  type?: string;
  fields?: Record<string, unknown>;
  reasoning?: string;
  meta?: SummaryMeta;
}

interface MetadataPanelProps {
  summaryStructure?: SummaryStructure | null;
  coreSummary?: string | null;
  keyPoints?: unknown;
  boundaries?: unknown | null;
  hasPracticeTask?: boolean;
  hasRelatedEntries?: boolean;
  confidence?: number | null;
}

const confidenceColors: Record<ConfidenceLevel, string> = {
  high: "text-green-600 dark:text-green-400",
  medium: "text-yellow-600 dark:text-yellow-400",
  low: "text-red-600 dark:text-red-400",
};

const confidenceStars: Record<ConfidenceLevel, string> = {
  high: "⭐⭐⭐",
  medium: "⭐⭐",
  low: "⭐",
};

const sourceColors: Record<SourceType, string> = {
  ai: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  user: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  system: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

const sourceLabels: Record<SourceType, string> = {
  ai: "AI",
  user: "User",
  system: "System",
};

export function MetadataPanel({
  summaryStructure,
  coreSummary,
  keyPoints,
  boundaries,
  hasPracticeTask,
  hasRelatedEntries,
  confidence,
}: MetadataPanelProps) {
  const rows = buildMetadataRows({
    summaryStructure,
    coreSummary,
    keyPoints,
    boundaries,
    hasPracticeTask,
    hasRelatedEntries,
    confidence,
  });

  if (rows.length === 0) {
    return (
      <div className="border border-border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Info size={16} className="text-primary" />
          <h3 className="text-sm font-semibold">Extracted Metadata</h3>
        </div>
        <p className="text-xs text-secondary">No metadata available yet.</p>
      </div>
    );
  }

  const sourceStats: Record<SourceType, number> = { ai: 0, user: 0, system: 0 };
  rows.forEach((row) => {
    sourceStats[row.source]++;
  });

  const renderConfidence = (conf: ConfidenceLevel | null) => {
    if (conf === null) {
      return <span className="text-secondary text-xs">-</span>;
    }
    return <span className={`text-xs ${confidenceColors[conf]}`}>{confidenceStars[conf]}</span>;
  };

  const renderSource = (source: SourceType) => (
    <span className={`text-xs px-1.5 py-0.5 rounded ${sourceColors[source]}`}>
      {sourceLabels[source]}
    </span>
  );

  return (
    <div className="border border-border rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Info size={16} className="text-primary" />
          <h3 className="text-sm font-semibold">Extracted Metadata</h3>
        </div>
        {summaryStructure?.meta?.model && (
          <span className="text-xs text-secondary">Model: {summaryStructure.meta.model}</span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-2 text-xs font-medium text-secondary">Field</th>
              <th className="text-left py-2 px-2 text-xs font-medium text-secondary">Value</th>
              <th className="text-center py-2 px-2 text-xs font-medium text-secondary w-24">Confidence</th>
              <th className="text-center py-2 px-2 text-xs font-medium text-secondary w-20">Source</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-b border-border/50">
                <td className="py-2 px-2 font-medium whitespace-nowrap">{row.label}</td>
                <td className="py-2 px-2 text-sm align-top">
                  <span className="whitespace-pre-wrap break-words">
                    {row.value}
                  </span>
                </td>
                <td className="py-2 px-2 text-center">{renderConfidence(row.confidence)}</td>
                <td className="py-2 px-2 text-center">{renderSource(row.source)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-4 text-xs text-secondary pt-2">
        <span className="font-medium">Source Distribution:</span>
        {sourceStats.ai > 0 && (
          <span className={sourceColors.ai + " px-2 py-0.5 rounded"}>AI({sourceStats.ai})</span>
        )}
        {sourceStats.user > 0 && (
          <span className={sourceColors.user + " px-2 py-0.5 rounded"}>User({sourceStats.user})</span>
        )}
        {sourceStats.system > 0 && (
          <span className={sourceColors.system + " px-2 py-0.5 rounded"}>System({sourceStats.system})</span>
        )}
      </div>

      {summaryStructure?.meta?.extractedAt && (
        <div className="text-xs text-secondary pt-2 border-t border-border">
          Extracted at: {new Date(summaryStructure.meta.extractedAt).toLocaleString()}
        </div>
      )}
    </div>
  );
}
