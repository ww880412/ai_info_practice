/**
 * MetadataPanel - 元数据面板
 * 展示 AI 提取的字段、置信度和来源
 */

"use client";

import { Info } from "lucide-react";

// 类型定义
type ConfidenceLevel = "high" | "medium" | "low";
type SourceType = "ai" | "user" | "system";

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
  // Legacy fields for fallback
  coreSummary?: string | null;
  keyPoints?: string[] | null;
  boundaries?: unknown | null;
  hasPracticeTask?: boolean;
  hasRelatedEntries?: boolean;
  confidence?: number | null;
}

// 标准字段定义
const STANDARD_FIELDS = [
  { key: "coreSummary", label: "Core Summary", legacyKey: "coreSummary" },
  { key: "keyPoints", label: "Key Points", legacyKey: "keyPoints" },
  { key: "summaryStructure", label: "Summary Structure", legacyKey: null },
  { key: "boundaries", label: "Boundaries", legacyKey: "boundaries" },
  { key: "practiceTask", label: "Practice Task", legacyKey: null },
  { key: "relatedEntries", label: "Related Entries", legacyKey: null },
  { key: "confidence", label: "Confidence", legacyKey: "confidence" },
];

// 置信度颜色映射
const confidenceColors: Record<ConfidenceLevel, string> = {
  high: "text-green-600 dark:text-green-400",
  medium: "text-yellow-600 dark:text-yellow-400",
  low: "text-red-600 dark:text-red-400",
};

// 置信度星级映射
const confidenceStars: Record<ConfidenceLevel, string> = {
  high: "⭐⭐⭐",
  medium: "⭐⭐",
  low: "⭐",
};

// 来源颜色映射
const sourceColors: Record<SourceType, string> = {
  ai: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  user: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  system: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

// 来源标签映射
const sourceLabels: Record<SourceType, string> = {
  ai: "AI",
  user: "User",
  system: "System",
};

// 解析 keyPointsNew 结构
function parseKeyPointsNew(keyPoints: unknown): boolean {
  if (!keyPoints) return false;
  if (Array.isArray(keyPoints)) return keyPoints.length > 0;
  if (typeof keyPoints === "object") {
    const kp = keyPoints as { core?: unknown[]; extended?: unknown[] };
    return (kp.core?.length ?? 0) > 0 || (kp.extended?.length ?? 0) > 0;
  }
  return false;
}

// 解析 boundaries 结构
function parseBoundaries(boundaries: unknown): boolean {
  if (!boundaries) return false;
  if (typeof boundaries === "object") {
    const b = boundaries as { applicable?: unknown[]; notApplicable?: unknown[] };
    return (b.applicable?.length ?? 0) > 0 || (b.notApplicable?.length ?? 0) > 0;
  }
  return false;
}

export function MetadataPanel({
  summaryStructure,
  coreSummary,
  keyPoints,
  boundaries,
  hasPracticeTask,
  hasRelatedEntries,
  confidence,
}: MetadataPanelProps) {
  // 从 summaryStructure.meta 获取元数据
  const meta = summaryStructure?.meta;
  const fieldConfidence = meta?.fieldConfidence || {};
  const fieldSourceMap = meta?.fieldSourceMap || {};

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const hasField = (key: string, _legacyKey?: string | null): boolean => {
    if (key === "coreSummary") {
      return !!(summaryStructure?.fields?.summary || coreSummary);
    }
    if (key === "keyPoints") {
      return parseKeyPointsNew(keyPoints);
    }
    if (key === "summaryStructure") {
      return !!summaryStructure?.type;
    }
    if (key === "boundaries") {
      return parseBoundaries(boundaries);
    }
    if (key === "practiceTask") {
      return !!hasPracticeTask;
    }
    if (key === "relatedEntries") {
      return !!hasRelatedEntries;
    }
    if (key === "confidence") {
      return confidence !== null && confidence !== undefined;
    }
    return false;
  };

  // 获取字段的置信度
  const getFieldConfidence = (key: string): ConfidenceLevel | null => {
    return fieldConfidence[key] || null;
  };

  // 获取字段的来源
  const getFieldSource = (key: string): SourceType => {
    return fieldSourceMap[key] || "ai";
  };

  // 计算来源统计
  const sourceStats: Record<SourceType, number> = { ai: 0, user: 0, system: 0 };
  STANDARD_FIELDS.forEach((field) => {
    if (hasField(field.key, field.legacyKey)) {
      sourceStats[getFieldSource(field.key)]++;
    }
  });

  // 渲染置信度显示
  const renderConfidence = (conf: ConfidenceLevel | null) => {
    if (conf === null) {
      return <span className="text-secondary text-xs">-</span>;
    }
    return (
      <span className={`text-xs ${confidenceColors[conf]}`}>
        {confidenceStars[conf]}
      </span>
    );
  };

  // 渲染来源标签
  const renderSource = (source: SourceType) => (
    <span className={`text-xs px-1.5 py-0.5 rounded ${sourceColors[source]}`}>
      {sourceLabels[source]}
    </span>
  );

  // 过滤出有内容的字段
  const displayedFields = STANDARD_FIELDS.filter((field) =>
    hasField(field.key, field.legacyKey)
  );

  // 如果没有字段，显示空状态
  if (displayedFields.length === 0) {
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

  return (
    <div className="border border-border rounded-lg p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Info size={16} className="text-primary" />
          <h3 className="text-sm font-semibold">Extracted Metadata</h3>
        </div>
        {meta?.model && (
          <span className="text-xs text-secondary">Model: {meta.model}</span>
        )}
      </div>

      {/* Field List Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-2 text-xs font-medium text-secondary">
                Field
              </th>
              <th className="text-center py-2 px-2 text-xs font-medium text-secondary w-20">
                Confidence
              </th>
              <th className="text-center py-2 px-2 text-xs font-medium text-secondary w-20">
                Source
              </th>
            </tr>
          </thead>
          <tbody>
            {displayedFields.map((field) => (
              <tr key={field.key} className="border-b border-border/50">
                <td className="py-2 px-2 font-medium">{field.label}</td>
                <td className="py-2 px-2 text-center">
                  {renderConfidence(getFieldConfidence(field.key))}
                </td>
                <td className="py-2 px-2 text-center">
                  {renderSource(getFieldSource(field.key))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Source Distribution */}
      <div className="flex items-center gap-4 text-xs text-secondary pt-2">
        <span className="font-medium">Source Distribution:</span>
        {sourceStats.ai > 0 && (
          <span className={sourceColors.ai + " px-2 py-0.5 rounded"}>
            AI({sourceStats.ai})
          </span>
        )}
        {sourceStats.user > 0 && (
          <span className={sourceColors.user + " px-2 py-0.5 rounded"}>
            User({sourceStats.user})
          </span>
        )}
        {sourceStats.system > 0 && (
          <span className={sourceColors.system + " px-2 py-0.5 rounded"}>
            System({sourceStats.system})
          </span>
        )}
      </div>

      {/* Extraction Info */}
      {meta?.extractedAt && (
        <div className="text-xs text-secondary pt-2 border-t border-border">
          Extracted at: {new Date(meta.extractedAt).toLocaleString()}
        </div>
      )}
    </div>
  );
}
