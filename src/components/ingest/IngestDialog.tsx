"use client";

import { useState, useCallback } from "react";
import { useIngest } from "@/hooks/useIngest";
import { useEntry } from "@/hooks/useEntries";
import { X, Link2, FileUp, Type, Loader2, CheckCircle2, AlertCircle, TriangleAlert } from "lucide-react";
import Link from "next/link";

type Tab = "link" | "file" | "text";

interface IngestDialogProps {
  open: boolean;
  onClose: () => void;
}

export function IngestDialog({ open, onClose }: IngestDialogProps) {
  const [tab, setTab] = useState<Tab>("link");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dismissedSimilarWarning, setDismissedSimilarWarning] = useState(false);

  const { ingestLink, ingestFile, ingestText, processingId, clearProcessingId, similarEntries } = useIngest();

  const { data: processingEntry } = useEntry(processingId || "");

  const isProcessing =
    ingestLink.isPending || ingestFile.isPending || ingestText.isPending;
  const isWatching = !!processingId;
  const isDone = processingEntry?.processStatus === "DONE";
  const isFailed = processingEntry?.processStatus === "FAILED";
  const hasSimilarEntries = (similarEntries?.length ?? 0) > 0;
  const showSimilarWarning = hasSimilarEntries && !dismissedSimilarWarning;

  const handleSubmit = useCallback(() => {
    setDismissedSimilarWarning(false);
    if (tab === "link" && url.trim()) {
      ingestLink.mutate({ url: url.trim() });
    } else if (tab === "file" && file) {
      ingestFile.mutate({ file });
    } else if (tab === "text" && text.trim()) {
      ingestText.mutate({ text: text.trim() });
    }
  }, [tab, url, file, text, ingestLink, ingestFile, ingestText]);

  const handleCloseWarning = useCallback(() => {
    setDismissedSimilarWarning(true);
  }, []);

  const handleClose = useCallback(() => {
    setUrl("");
    setText("");
    setFile(null);
    setDismissedSimilarWarning(false);
    clearProcessingId();
    ingestLink.reset();
    ingestFile.reset();
    ingestText.reset();
    onClose();
  }, [onClose, clearProcessingId, ingestLink, ingestFile, ingestText]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
      setTab("file");
    }
  }, []);

  if (!open) return null;

  const statusText = () => {
    if (isProcessing) return "Submitting...";
    if (!processingEntry) return "Processing...";
    if (
      processingEntry.processStatus !== "DONE" &&
      processingEntry.processStatus !== "FAILED" &&
      processingEntry.processError?.trim()
    ) {
      return processingEntry.processError;
    }
    switch (processingEntry.processStatus) {
      case "PENDING": return "Queued...";
      case "PARSING": return "Parsing content...";
      case "AI_PROCESSING": return "AI analyzing...";
      case "DONE": return "Done!";
      case "FAILED": return processingEntry.processError || "Processing failed";
      default: return "Processing...";
    }
  };

  // Progress percentage based on status
  const progressPercent = () => {
    if (isProcessing) return 10;
    if (!processingEntry) return 20;
    switch (processingEntry.processStatus) {
      case "PENDING": return 20;
      case "PARSING": return 50;
      case "AI_PROCESSING": return 80;
      case "DONE": return 100;
      case "FAILED": return 100;
      default: return 20;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={handleClose}>
      <div
        className="bg-card rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-lg font-semibold">Add Knowledge</h2>
          <button onClick={handleClose} className="p-1 rounded-md hover:bg-accent transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          {[
            { key: "link" as Tab, label: "Link", icon: Link2 },
            { key: "file" as Tab, label: "File", icon: FileUp },
            { key: "text" as Tab, label: "Text", icon: Type },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors ${
                tab === key
                  ? "text-primary border-b-2 border-primary"
                  : "text-secondary hover:text-foreground"
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-5" onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}>
          {/* Processing status */}
          {(isProcessing || isWatching) && (
            <div className={`flex flex-col gap-2 p-4 rounded-lg mb-4 ${
              isDone ? "bg-green-50 dark:bg-green-950/30" :
              isFailed ? "bg-red-50 dark:bg-red-950/30" :
              "bg-blue-50 dark:bg-blue-950/30"
            }`}>
              <div className="flex items-center gap-3">
                {isDone ? (
                  <CheckCircle2 size={20} className="text-success shrink-0" />
                ) : isFailed ? (
                  <AlertCircle size={20} className="text-danger shrink-0" />
                ) : (
                  <Loader2 size={20} className="text-primary animate-spin shrink-0" />
                )}
                <span className="text-sm">{statusText()}</span>
              </div>
              {/* Progress bar */}
              {!isDone && !isFailed && (
                <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${progressPercent()}%` }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Link input */}
          {tab === "link" && (
            <div className="space-y-3">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste a URL (GitHub, blog, etc.)"
                className="w-full px-3 py-2.5 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                disabled={isProcessing || isWatching}
              />
              <p className="text-xs text-secondary">
                Supports: GitHub repos, blog articles, general webpages. WeChat/Twitter links may need screenshots.
              </p>
            </div>
          )}

          {/* File upload */}
          {tab === "file" && (
            <div className="space-y-3">
              <label
                className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                  file
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50 hover:bg-accent"
                }`}
              >
                {file ? (
                  <div className="text-center">
                    <FileUp size={24} className="mx-auto mb-1 text-primary" />
                    <p className="text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-secondary">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <FileUp size={24} className="mx-auto mb-1 text-secondary" />
                    <p className="text-sm text-secondary">Click or drag to upload</p>
                    <p className="text-xs text-secondary mt-1">PDF, PNG, JPEG, WEBP (max 100MB)</p>
                  </div>
                )}
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.heic"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  disabled={isProcessing || isWatching}
                />
              </label>
            </div>
          )}

          {/* Text input */}
          {tab === "text" && (
            <div className="space-y-3">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste the content here..."
                rows={6}
                className="w-full px-3 py-2.5 border border-border rounded-lg bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                disabled={isProcessing || isWatching}
              />
            </div>
          )}

          {/* Similar entries warning */}
          {showSimilarWarning && similarEntries && similarEntries.length > 0 && (
            <div className="mt-4 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <div className="flex items-start gap-3">
                <TriangleAlert size={20} className="text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    Found {similarEntries.length} similar {similarEntries.length === 1 ? "entry" : "entries"}
                  </p>
                  <div className="mt-2 space-y-2 max-h-32 overflow-y-auto">
                    {similarEntries.map((entry) => (
                      <div key={entry.id} className="text-xs p-2 rounded bg-white/50 dark:bg-black/20">
                        <Link
                          href={`/entry/${entry.id}`}
                          className="font-medium text-amber-700 dark:text-amber-300 hover:underline"
                          target="_blank"
                        >
                          {entry.title || entry.coreSummary?.slice(0, 50) || "Untitled"} ({(entry.similarity * 100).toFixed(0)}% similar)
                        </Link>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                    The content has been added. You can review the similar entries above.
                  </p>
                </div>
                <button
                  onClick={handleCloseWarning}
                  className="p-1 rounded hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
                >
                  <X size={16} className="text-amber-600" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-5 py-4 border-t border-border">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-secondary hover:text-foreground rounded-lg hover:bg-accent transition-colors"
          >
            {isDone ? "Close" : "Cancel"}
          </button>
          {!isDone && !isFailed && (
            <button
              onClick={handleSubmit}
              disabled={
                isProcessing ||
                isWatching ||
                (tab === "link" && !url.trim()) ||
                (tab === "file" && !file) ||
                (tab === "text" && !text.trim())
              }
              className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isProcessing ? "Submitting..." : "Submit"}
            </button>
          )}
          {isFailed && (
            <button
              onClick={() => { clearProcessingId(); ingestLink.reset(); ingestFile.reset(); ingestText.reset(); }}
              className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-hover transition-colors"
            >
              Try Again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
