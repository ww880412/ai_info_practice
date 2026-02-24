"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Clock, CheckCircle, Database } from "lucide-react";

interface RecentEntry {
  id: string;
  title: string | null;
  sourceType: string;
  createdAt: string;
  processStatus: string;
}

interface DashboardStats {
  total: number;
  weekNew: number;
  processing: number;
  failed: number;
  recentEntries: RecentEntry[];
  topTags: {
    tag: string;
    count: number;
    aliases: { tag: string; count: number }[];
    filterTags: string[];
  }[];
  difficultyStats: { EASY: number; MEDIUM: number; HARD: number; unknown: number };
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}

const SOURCE_COLORS: Record<string, string> = {
  GITHUB: "bg-gray-800 text-gray-100",
  WEBPAGE: "bg-blue-100 text-blue-800",
  PDF: "bg-red-100 text-red-800",
  TEXT: "bg-green-100 text-green-800",
};

export default function DashboardPage() {
  const topTagLimit = 10;
  const minTagCount = 2;

  const { data, isLoading, isError } = useQuery<{ data: DashboardStats }>({
    queryKey: ["dashboard-stats", topTagLimit, minTagCount],
    queryFn: () =>
      fetch(`/api/dashboard/stats?topTagLimit=${topTagLimit}&minTagCount=${minTagCount}`).then((r) => r.json()),
    refetchInterval: 30000,
  });

  const stats = data?.data;

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-secondary text-sm">Loading dashboard...</div>
      </div>
    );
  }

  if (isError || !stats) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-red-500 text-sm">Failed to load dashboard stats.</div>
      </div>
    );
  }

  const maxTagCount = stats.topTags[0]?.count ?? 1;
  const diffTotal = stats.difficultyStats.EASY + stats.difficultyStats.MEDIUM + stats.difficultyStats.HARD + stats.difficultyStats.unknown;

  const diffBars = [
    { label: "Easy", value: stats.difficultyStats.EASY, color: "bg-green-500" },
    { label: "Medium", value: stats.difficultyStats.MEDIUM, color: "bg-yellow-500" },
    { label: "Hard", value: stats.difficultyStats.HARD, color: "bg-red-500" },
    { label: "Unknown", value: stats.difficultyStats.unknown, color: "bg-gray-400" },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-lg p-4 border-l-4 border-l-blue-500">
          <div className="flex items-center gap-2 text-secondary text-xs mb-1">
            <Database size={14} />
            Total Entries
          </div>
          <div className="text-3xl font-bold text-foreground">{stats.total}</div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4 border-l-4 border-l-green-500">
          <div className="flex items-center gap-2 text-secondary text-xs mb-1">
            <CheckCircle size={14} />
            This Week
          </div>
          <div className="text-3xl font-bold text-foreground">
            +{stats.weekNew}
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4 border-l-4 border-l-yellow-500">
          <div className="flex items-center gap-2 text-secondary text-xs mb-1">
            <Clock size={14} />
            Processing
          </div>
          <div className="text-3xl font-bold text-foreground">{stats.processing}</div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4 border-l-4 border-l-red-500">
          <div className="flex items-center gap-2 text-secondary text-xs mb-1">
            <AlertCircle size={14} />
            Failed
          </div>
          <div className="text-3xl font-bold text-foreground">{stats.failed}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tag cloud */}
        <div className="lg:col-span-2 bg-card border border-border rounded-lg p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">
            Top Tags
            <span className="ml-2 text-xs font-normal text-secondary">(Top {topTagLimit}, count ≥ {minTagCount})</span>
          </h2>
          {stats.topTags.length === 0 ? (
            <p className="text-secondary text-sm">No tags yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {stats.topTags.map(({ tag, count, aliases, filterTags }) => {
                const ratio = count / maxTagCount;
                const size = ratio > 0.7 ? "text-base" : ratio > 0.4 ? "text-sm" : "text-xs";
                const searchParams = new URLSearchParams();
                searchParams.set("aiTagsAny", filterTags.join(","));
                const href = `/library?${searchParams.toString()}`;
                const aliasPreview = aliases.slice(0, 6).map((alias) => alias.tag).join(", ");
                return (
                  <Link
                    key={tag}
                    href={href}
                    className={`inline-flex items-center bg-accent rounded-full px-3 py-1 text-foreground hover:bg-accent/80 transition-colors ${size}`}
                    title={aliases.length > 1 ? `${count} entries · includes: ${aliasPreview}` : `${count} entries`}
                  >
                    <span>{tag}</span>
                    <span className="text-secondary ml-1 text-xs">{count}</span>
                    {aliases.length > 1 && (
                      <span className="text-secondary ml-1 text-[10px]">+{aliases.length - 1}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Difficulty distribution */}
        <div className="bg-card border border-border rounded-lg p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Difficulty Distribution</h2>
          <div className="space-y-3">
            {diffBars.map(({ label, value, color }) => (
              <div key={label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-secondary">{label}</span>
                  <span className="text-foreground font-medium">{value}</span>
                </div>
                <div className="h-2 bg-accent rounded-full overflow-hidden">
                  <div
                    className={`h-full ${color} rounded-full transition-all`}
                    style={{ width: diffTotal > 0 ? `${(value / diffTotal) * 100}%` : "0%" }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent updates */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4">Recent Updates</h2>
        {stats.recentEntries.length === 0 ? (
          <p className="text-secondary text-sm">No entries yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {stats.recentEntries.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between py-2.5 hover:bg-accent rounded px-2 -mx-2 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`shrink-0 bg-accent rounded-full px-2 py-0.5 text-xs ${SOURCE_COLORS[entry.sourceType] ?? ""}`}>
                    {entry.sourceType}
                  </span>
                  <a href={`/entry/${entry.id}`} className="text-sm text-foreground truncate hover:text-primary transition-colors">
                    {entry.title ?? "Untitled"}
                  </a>
                </div>
                <span className="shrink-0 text-xs text-secondary ml-4">{timeAgo(entry.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
