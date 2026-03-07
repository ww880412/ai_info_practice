/**
 * QualityPanel - 质量评估面板
 * 展示 5 维度评分、置信度、手动覆盖、历史记录
 */

"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Gauge, History, RotateCcw, Save, X } from "lucide-react";
import { formatEntryDateTime } from "@/lib/entry/format-datetime";

type DimensionKey = "sourceTrust" | "timeliness" | "completeness" | "contentForm" | "difficulty";

interface QualityDimension {
  value: string;
  label: string;
}

interface QualityData {
  dimensions: Record<DimensionKey, QualityDimension>;
  confidence: number;
  confidenceDisplay: string;
  override: Record<string, unknown> | null;
  history: Array<{
    id: string;
    changedAt: string;
    changes: string[];
  }>;
}

// 维度配置
const dimensionConfig: Record<DimensionKey, { label: string; options: { value: string; label: string }[] }> = {
  sourceTrust: {
    label: "来源可信度",
    options: [
      { value: "HIGH", label: "高" },
      { value: "MEDIUM", label: "中" },
      { value: "LOW", label: "低" },
    ],
  },
  timeliness: {
    label: "时效性",
    options: [
      { value: "RECENT", label: "近期" },
      { value: "CLASSIC", label: "经典" },
      { value: "OUTDATED", label: "过时" },
    ],
  },
  completeness: {
    label: "完整度",
    options: [
      { value: "0.3", label: "30%" },
      { value: "0.5", label: "50%" },
      { value: "0.7", label: "70%" },
      { value: "0.85", label: "85%" },
      { value: "1", label: "100%" },
    ],
  },
  contentForm: {
    label: "内容形式",
    options: [
      { value: "TEXTUAL", label: "文本" },
      { value: "CODE_HEAVY", label: "代码" },
      { value: "VISUAL", label: "视觉" },
      { value: "MULTIMODAL", label: "多模态" },
    ],
  },
  difficulty: {
    label: "难度级别",
    options: [
      { value: "EASY", label: "简单" },
      { value: "MEDIUM", label: "中等" },
      { value: "HARD", label: "困难" },
    ],
  },
};

// 置信度颜色
function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.7) return "bg-green-500";
  if (confidence >= 0.4) return "bg-yellow-500";
  return "bg-red-500";
}

interface QualityPanelProps {
  entryId: string;
}

export function QualityPanel({ entryId }: QualityPanelProps) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [localOverride, setLocalOverride] = useState<Record<string, unknown>>({});
  const [reason, setReason] = useState("");

  // 获取质量评估数据
  const { data, isLoading, error } = useQuery<{ data: QualityData }>({
    queryKey: ["quality", entryId],
    queryFn: async () => {
      const res = await fetch(`/api/entries/${entryId}/quality`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  // 更新质量评估
  const updateQuality = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/entries/${entryId}/quality`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ override: localOverride, reason }),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quality", entryId] });
      setEditing(false);
      setLocalOverride({});
      setReason("");
    },
  });

  // 回滚到 AI 评估
  const resetToAI = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/entries/${entryId}/quality`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ override: null, reason: "Reset to AI assessment" }),
      });
      if (!res.ok) throw new Error("Failed to reset");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quality", entryId] });
      setEditing(false);
    },
  });

  if (isLoading) {
    return (
      <div className="border border-border rounded-lg p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-muted rounded w-1/4"></div>
          <div className="h-20 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !data?.data) {
    return (
      <div className="border border-border rounded-lg p-4 text-red-500">
        加载质量评估失败
      </div>
    );
  }

  const { dimensions, confidence, confidenceDisplay, override, history } = data.data;

  // 处理覆盖值
  const displayDimensions = override
    ? (Object.keys(dimensions) as DimensionKey[]).reduce((acc, key) => {
        const val = dimensions[key];
        acc[key] = override[key] ? { value: String(override[key]), label: val.label } : val;
        return acc;
      }, {} as Record<DimensionKey, QualityDimension>)
    : dimensions;

  return (
    <div className="border border-border rounded-lg p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gauge size={16} className="text-primary" />
          <h3 className="text-sm font-semibold">Quality Assessment</h3>
        </div>
        <div className="flex items-center gap-2">
          {override && (
            <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded dark:bg-purple-900/40 dark:text-purple-300">
              Manual
            </span>
          )}
        </div>
      </div>

      {/* 综合置信度 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-secondary">Confidence</span>
          <span className="font-medium">{confidenceDisplay}</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full ${getConfidenceColor(confidence)} transition-all`}
            style={{ width: confidenceDisplay }}
          ></div>
        </div>
      </div>

      {/* 5 维度评估 */}
      <div className="space-y-3">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 text-xs font-medium text-secondary">Dimension</th>
              <th className="text-center py-2 text-xs font-medium text-secondary">AI</th>
              <th className="text-center py-2 text-xs font-medium text-secondary">Override</th>
            </tr>
          </thead>
          <tbody>
            {(Object.keys(dimensionConfig) as DimensionKey[]).map((key) => (
              <tr key={key} className="border-b border-border/50">
                <td className="py-2">{dimensionConfig[key].label}</td>
                <td className="py-2 text-center text-secondary">{dimensions[key].label}</td>
                <td className="py-2 text-center">
                  {editing ? (
                    <select
                      className="text-xs border rounded px-1 py-0.5"
                      value={localOverride[key] as string || dimensions[key].value}
                      onChange={(e) => setLocalOverride({ ...localOverride, [key]: e.target.value })}
                    >
                      {dimensionConfig[key].options.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className={override ? "text-purple-600 font-medium" : "-"}>
                      {override ? displayDimensions[key].label : "-"}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center gap-2 pt-2">
        {editing ? (
          <>
            <button
              onClick={() => updateQuality.mutate()}
              disabled={updateQuality.isPending}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
            >
              <Save size={14} />
              {updateQuality.isPending ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs border rounded hover:bg-muted"
            >
              <X size={14} />
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs border rounded hover:bg-muted"
            >
              Override
            </button>
            {override && (
              <button
                onClick={() => resetToAI.mutate()}
                disabled={resetToAI.isPending}
                className="flex items-center gap-1 px-3 py-1.5 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20 disabled:opacity-50"
              >
                <RotateCcw size={14} />
                {resetToAI.isPending ? "Resetting..." : "Reset to AI"}
              </button>
            )}
          </>
        )}
      </div>

      {/* 历史记录 */}
      {history.length > 0 && (
        <div className="pt-2 border-t border-border">
          <div className="flex items-center gap-2 mb-2">
            <History size={14} className="text-secondary" />
            <span className="text-xs font-medium text-secondary">History</span>
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {history.map((h) => (
              <div key={h.id} className="text-xs text-secondary">
                <span className="text-primary">{formatEntryDateTime(h.changedAt)}</span>
                {h.changes.map((c, i) => (
                  <span key={i} className="ml-2">{c}</span>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
