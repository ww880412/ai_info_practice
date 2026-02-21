"use client";

import { Search, X } from "lucide-react";

const contentTypes = [
  { value: "", label: "All Types" },
  { value: "TUTORIAL", label: "Tutorial" },
  { value: "TOOL_RECOMMENDATION", label: "Tool" },
  { value: "TECH_PRINCIPLE", label: "Principle" },
  { value: "CASE_STUDY", label: "Case Study" },
  { value: "OPINION", label: "Opinion" },
];

const techDomains = [
  { value: "", label: "All Domains" },
  { value: "PROMPT_ENGINEERING", label: "Prompt" },
  { value: "AGENT", label: "Agent" },
  { value: "RAG", label: "RAG" },
  { value: "FINE_TUNING", label: "Fine-tuning" },
  { value: "DEPLOYMENT", label: "Deploy" },
  { value: "OTHER", label: "Other" },
];

const practiceValues = [
  { value: "", label: "All" },
  { value: "KNOWLEDGE", label: "Knowledge" },
  { value: "ACTIONABLE", label: "Actionable" },
];

interface EntryFiltersProps {
  q: string;
  onQChange: (q: string) => void;
  contentType: string;
  onContentTypeChange: (v: string) => void;
  techDomain: string;
  onTechDomainChange: (v: string) => void;
  practiceValue: string;
  onPracticeValueChange: (v: string) => void;
}

export function EntryFilters({
  q,
  onQChange,
  contentType,
  onContentTypeChange,
  techDomain,
  onTechDomainChange,
  practiceValue,
  onPracticeValueChange,
}: EntryFiltersProps) {
  const hasFilters = q || contentType || techDomain || practiceValue;

  const clearAll = () => {
    onQChange("");
    onContentTypeChange("");
    onTechDomainChange("");
    onPracticeValueChange("");
  };

  return (
    <div className="space-y-2">
      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
        <input
          type="text"
          value={q}
          onChange={(e) => onQChange(e.target.value)}
          placeholder="Search knowledge base..."
          className="w-full pl-9 pr-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        />
      </div>

      {/* Filter pills - compact */}
      <div className="flex items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          <select
            value={contentType}
            onChange={(e) => onContentTypeChange(e.target.value)}
            className="px-2 py-1 text-xs border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[90px]"
          >
            {contentTypes.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <select
            value={techDomain}
            onChange={(e) => onTechDomainChange(e.target.value)}
            className="px-2 py-1 text-xs border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[85px]"
          >
            {techDomains.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <select
            value={practiceValue}
            onChange={(e) => onPracticeValueChange(e.target.value)}
            className="px-2 py-1 text-xs border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[70px]"
          >
            {practiceValues.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* Clear all button */}
        {hasFilters && (
          <button
            onClick={clearAll}
            className="flex items-center gap-1 px-2 py-1 text-xs text-secondary hover:text-foreground hover:bg-accent rounded-md transition-colors ml-auto"
          >
            <X size={12} />
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
