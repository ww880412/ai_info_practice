import {
  Github,
  Globe,
  FileText,
  Type,
  MessageCircle,
  Twitter,
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
  TOOL_RECOMMENDATION: "Tool",
  TECH_PRINCIPLE: "Principle",
  CASE_STUDY: "Case Study",
  OPINION: "Opinion",
};

const techDomainLabels: Record<string, string> = {
  PROMPT_ENGINEERING: "Prompt",
  AGENT: "Agent",
  RAG: "RAG",
  FINE_TUNING: "Fine-tuning",
  DEPLOYMENT: "Deploy",
  OTHER: "Other",
};

const contentTypeColors: Record<string, string> = {
  TUTORIAL: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  TOOL_RECOMMENDATION: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  TECH_PRINCIPLE: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  CASE_STUDY: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  OPINION: "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300",
};

const statusColors: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  PARSING: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  AI_PROCESSING: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  DONE: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400",
  FAILED: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  PARTIAL: "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400",
};

const statusLabels: Record<string, string> = {
  PENDING: "Pending",
  PARSING: "Parsing",
  AI_PROCESSING: "Processing",
  DONE: "Done",
  FAILED: "Failed",
  PARTIAL: "Partial",
};

interface EntryCardProps {
  entry: {
    id: string;
    title?: string | null;
    sourceType: string;
    processStatus: string;
    processError?: string | null;
    contentType?: string | null;
    techDomain?: string | null;
    coreSummary?: string | null;
    practiceValue?: string | null;
    knowledgeStatus?: string;
    aiTags: string[];
    userTags: string[];
    createdAt: string;
  };
  onClick: (id: string) => void;
  showSelection?: boolean;
  selected?: boolean;
  onSelectChange?: (id: string, checked: boolean) => void;
}

export function EntryCard({
  entry,
  onClick,
  showSelection = false,
  selected = false,
  onSelectChange,
}: EntryCardProps) {
  const SourceIcon = sourceIconMap[entry.sourceType] || Globe;
  const isProcessingStatus =
    entry.processStatus === "PENDING" ||
    entry.processStatus === "PARSING" ||
    entry.processStatus === "AI_PROCESSING";
  const handleCardClick = () => {
    if (showSelection) {
      onSelectChange?.(entry.id, !selected);
      return;
    }
    onClick(entry.id);
  };

  return (
    <div
      onClick={handleCardClick}
      data-testid="entry-card"
      className={`bg-card border rounded-lg p-4 cursor-pointer transition-all duration-200 ${
        entry.knowledgeStatus === "TO_REVIEW"
          ? "border-yellow-300 dark:border-yellow-700"
          : entry.knowledgeStatus === "DEPRECATED"
            ? "border-red-300 dark:border-red-700"
            : "border-border"
      } ${
        showSelection
          ? selected
            ? "bg-primary/5 ring-2 ring-primary/30"
            : "hover:bg-accent/40"
          : "hover:border-primary/50 hover:shadow-md hover:scale-[1.02]"
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          {showSelection && (
            <input
              type="checkbox"
              checked={selected}
              aria-label={`Select entry ${entry.title || entry.id}`}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => onSelectChange?.(entry.id, e.target.checked)}
            />
          )}
          <SourceIcon size={16} className="text-secondary shrink-0" />
          <h3 className="text-sm font-medium truncate">
            {entry.title || "Untitled"}
          </h3>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 font-medium ${statusColors[entry.processStatus] || ""}`}>
          {statusLabels[entry.processStatus] || entry.processStatus}
        </span>
      </div>

      {/* Summary */}
      {entry.coreSummary && (
        <p className="text-xs text-secondary mb-3 line-clamp-2">
          {entry.coreSummary}
        </p>
      )}

      {isProcessingStatus && entry.processError && (
        <p className="text-xs text-secondary mb-3 line-clamp-2">
          {entry.processError}
        </p>
      )}

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5">
        {entry.knowledgeStatus === "TO_REVIEW" && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 font-medium">
            To Review
          </span>
        )}
        {entry.knowledgeStatus === "DEPRECATED" && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 font-medium">
            Deprecated
          </span>
        )}
        {entry.contentType && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${contentTypeColors[entry.contentType] || "bg-accent text-secondary"}`}>
            {contentTypeLabels[entry.contentType] || entry.contentType}
          </span>
        )}
        {entry.techDomain && (
          <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">
            {techDomainLabels[entry.techDomain] || entry.techDomain}
          </span>
        )}
        {entry.practiceValue === "ACTIONABLE" && (
          <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium">
            Actionable
          </span>
        )}
        {entry.aiTags.slice(0, 3).map((tag) => (
          <span key={tag} className="text-xs px-2 py-0.5 rounded bg-accent text-secondary">
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
