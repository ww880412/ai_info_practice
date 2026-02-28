"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface IngestLinkParams {
  url: string;
}

interface IngestFileParams {
  file: File;
}

interface IngestTextParams {
  text: string;
}

interface IngestResponse {
  entryId: string;
  status: string;
  message: string;
  similarEntries?: Array<{
    id: string;
    title: string | null;
    coreSummary: string | null;
    similarity: number;
  }>;
}

function getConfig() {
  if (typeof window === "undefined") return {};
  const saved = localStorage.getItem("ai-practice-config");
  if (!saved) return {};
  try {
    const parsed = JSON.parse(saved);
    return {
      geminiApiKey: parsed.geminiApiKey,
      geminiModel: parsed.geminiModel,
    };
  } catch {
    return {};
  }
}

export function useIngest() {
  const queryClient = useQueryClient();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [similarEntries, setSimilarEntries] = useState<IngestResponse["similarEntries"]>([]);

  const ingestLink = useMutation({
    mutationFn: async ({ url }: IngestLinkParams): Promise<IngestResponse> => {
      const config = getConfig();
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputType: "LINK", url, config }),
      });
      if (!res.ok) throw new Error("Failed to ingest link");
      return res.json();
    },
    onSuccess: (data) => {
      setProcessingId(data.entryId);
      if (data.similarEntries) {
        setSimilarEntries(data.similarEntries);
      }
      queryClient.invalidateQueries({ queryKey: ["entries"] });
    },
  });

  const ingestFile = useMutation({
    mutationFn: async ({ file }: IngestFileParams): Promise<IngestResponse> => {
      // Step 1: Upload file to R2 storage
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      if (!uploadRes.ok) {
        const err = await uploadRes.json();
        throw new Error(err.error || "Upload failed");
      }
      const { fileUrl } = await uploadRes.json();

      // Step 2: Ingest with fileUrl (stored in rawUrl field)
      const config = getConfig();
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputType: "PDF", fileKey: fileUrl, config }),
      });
      if (!res.ok) throw new Error("Failed to ingest file");
      return res.json();
    },
    onSuccess: (data) => {
      setProcessingId(data.entryId);
      if (data.similarEntries) {
        setSimilarEntries(data.similarEntries);
      }
      queryClient.invalidateQueries({ queryKey: ["entries"] });
    },
  });

  const ingestText = useMutation({
    mutationFn: async ({ text }: IngestTextParams): Promise<IngestResponse> => {
      const config = getConfig();
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputType: "TEXT", text, config }),
      });
      if (!res.ok) throw new Error("Failed to ingest text");
      return res.json();
    },
    onSuccess: (data) => {
      setProcessingId(data.entryId);
      if (data.similarEntries) {
        setSimilarEntries(data.similarEntries);
      }
      queryClient.invalidateQueries({ queryKey: ["entries"] });
    },
  });

  return {
    ingestLink,
    ingestFile,
    ingestText,
    processingId,
    clearProcessingId: () => {
      setProcessingId(null);
      setSimilarEntries([]);
    },
    similarEntries,
  };
}
