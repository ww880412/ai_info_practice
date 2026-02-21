import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseUrl, parseUploadedFile, type ParseResult } from "@/lib/parser";
import { classifyAndExtract } from "@/lib/ai/classifier";
import { convertToPractice } from "@/lib/ai/practiceConverter";
import { findSimilarEntries } from "@/lib/ai/deduplication";
import { ReActAgent } from "@/lib/ai/agent";
import { getAgentConfig } from "@/lib/ai/agent/get-config";
import { setServerConfig } from "@/lib/gemini";
import { readFile, unlink } from "fs/promises";
import { join } from "path";
import type { SourceType } from "@prisma/client";

/**
 * Async processing pipeline - runs after response is sent.
 */
async function asyncProcess(entryId: string, config: { geminiApiKey?: string; geminiModel?: string } = {}) {
  // Set server config for Gemini
  if (config.geminiApiKey || config.geminiModel) {
    setServerConfig(config);
  }

  try {
    const entry = await prisma.entry.findUnique({ where: { id: entryId } });
    if (!entry) return;

    let content = entry.originalContent || "";
    let title = entry.title || "";

    // Step 1: Parse content if needed
    if (entry.inputType === "LINK" && entry.rawUrl) {
      await prisma.entry.update({
        where: { id: entryId },
        data: { processStatus: "PARSING" },
      });

      try {
        const parsed = await parseUrl(entry.rawUrl);
        content = parsed.content;
        title = parsed.title;
        await prisma.entry.update({
          where: { id: entryId },
          data: {
            title,
            originalContent: content,
            sourceType: parsed.sourceType as SourceType,
          },
        });
      } catch (parseError) {
        await prisma.entry.update({
          where: { id: entryId },
          data: {
            processStatus: "FAILED",
            processError: `Content parsing failed: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
          },
        });
        return;
      }
    } else if (entry.inputType === "PDF") {
      await prisma.entry.update({
        where: { id: entryId },
        data: { processStatus: "PARSING" },
      });

      try {
        // rawUrl stores the fileKey for uploaded files
        const fileKey = entry.rawUrl;
        if (!fileKey) throw new Error("No file key found");

        const filePath = join(process.cwd(), "public", "uploads", fileKey);
        const buffer = await readFile(filePath);

        // Detect mime type from extension
        const ext = fileKey.split(".").pop()?.toLowerCase();
        const mimeMap: Record<string, string> = {
          pdf: "application/pdf",
          png: "image/png",
          jpg: "image/jpeg",
          jpeg: "image/jpeg",
          webp: "image/webp",
          heic: "image/heic",
        };
        const mimeType = mimeMap[ext || ""] || "application/pdf";

        const parsed = await parseUploadedFile(buffer, mimeType);
        content = parsed.content;
        title = parsed.title;

        await prisma.entry.update({
          where: { id: entryId },
          data: { title, originalContent: content },
        });

        // Clean up uploaded file
        await unlink(filePath).catch(() => {});
      } catch (parseError) {
        // Clean up uploaded file even on failure
        const fileKey = entry.rawUrl;
        if (fileKey) {
          const filePath = join(process.cwd(), "public", "uploads", fileKey);
          await unlink(filePath).catch(() => {});
        }
        await prisma.entry.update({
          where: { id: entryId },
          data: {
            processStatus: "FAILED",
            processError: `File parsing failed: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
          },
        });
        return;
      }
    } else if (entry.inputType === "TEXT") {
      content = entry.rawText || "";
      title = content.slice(0, 50);
    }

    if (!content) {
      await prisma.entry.update({
        where: { id: entryId },
        data: {
          processStatus: "FAILED",
          processError: "No content to process",
        },
      });
      return;
    }

    // Step 2: AI Classification + Extraction (L1 + L2)
    await prisma.entry.update({
      where: { id: entryId },
      data: { processStatus: "AI_PROCESSING" },
    });

    const aiResult = await classifyAndExtract(content);

    await prisma.entry.update({
      where: { id: entryId },
      data: {
        title: title || undefined,
        contentType: aiResult.contentType,
        techDomain: aiResult.techDomain,
        aiTags: aiResult.aiTags,
        coreSummary: aiResult.coreSummary,
        keyPoints: aiResult.keyPoints,
        practiceValue: aiResult.practiceValue,
      },
    });

    // Step 2.5: ReAct Agent processing
    try {
      const agentConfig = await getAgentConfig();
      const agent = new ReActAgent(agentConfig);
      const parseInput: ParseResult = {
        title: entry.title || title || '',
        content: content,
        sourceType: entry.sourceType,
      };
      const trace = await agent.process(entryId, parseInput);

      // Merge agent tags with existing AI tags
      const agentTags = trace.finalResult?.tags || [];
      if (agentTags.length > 0) {
        const currentEntry = await prisma.entry.findUnique({ where: { id: entryId } });
        const mergedTags = [...(currentEntry?.aiTags || []), ...agentTags];
        await prisma.entry.update({
          where: { id: entryId },
          data: { aiTags: [...new Set(mergedTags)] },
        });
      }
    } catch (agentError) {
      console.error('Agent processing error:', agentError);
      // Continue with L3 even if agent fails
    }

    // Step 3: Practice conversion (L3) - only for ACTIONABLE
    if (aiResult.practiceValue === "ACTIONABLE") {
      const practiceResult = await convertToPractice(
        content,
        aiResult.coreSummary
      );

      await prisma.practiceTask.create({
        data: {
          entryId,
          title: practiceResult.title,
          summary: practiceResult.summary,
          difficulty: practiceResult.difficulty,
          estimatedTime: practiceResult.estimatedTime,
          prerequisites: practiceResult.prerequisites,
          steps: {
            create: practiceResult.steps.map((step) => ({
              order: step.order,
              title: step.title,
              description: step.description,
            })),
          },
        },
      });
    }

    // Mark as done
    await prisma.entry.update({
      where: { id: entryId },
      data: { processStatus: "DONE" },
    });
  } catch (error) {
    console.error("Async processing error:", error);
    await prisma.entry.update({
      where: { id: entryId },
      data: {
        processStatus: "FAILED",
        processError: error instanceof Error ? error.message : String(error),
      },
    }).catch(() => {});
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { inputType, url, fileKey, text } = body;

    if (!inputType || !["LINK", "PDF", "TEXT"].includes(inputType)) {
      return NextResponse.json(
        { error: "Invalid inputType. Must be LINK, PDF, or TEXT." },
        { status: 400 }
      );
    }

    // Validate required fields
    if (inputType === "LINK" && !url) {
      return NextResponse.json({ error: "url is required for LINK input" }, { status: 400 });
    }
    if (inputType === "PDF" && !fileKey) {
      return NextResponse.json({ error: "fileKey is required for PDF input" }, { status: 400 });
    }
    if (inputType === "TEXT" && !text) {
      return NextResponse.json({ error: "text is required for TEXT input" }, { status: 400 });
    }

    // Determine source type
    let sourceType: SourceType = "WEBPAGE";
    if (inputType === "TEXT") sourceType = "TEXT";
    if (inputType === "PDF") sourceType = "PDF";
    if (inputType === "LINK" && url) {
      if (url.includes("github.com")) sourceType = "GITHUB";
      else if (url.includes("mp.weixin.qq.com")) sourceType = "WECHAT";
      else if (url.includes("twitter.com") || url.includes("x.com")) sourceType = "TWITTER";
    }

    // Create entry
    const entry = await prisma.entry.create({
      data: {
        inputType,
        rawUrl: inputType === "LINK" ? url : inputType === "PDF" ? fileKey : null,
        rawText: inputType === "TEXT" ? text : null,
        sourceType,
        processStatus: "PENDING",
      },
    });

    // Check for similar entries (only for TEXT type, as LINK/PDF content is parsed asynchronously)
    let similarEntries: Array<{
      id: string;
      title: string | null;
      coreSummary: string | null;
      similarity: number;
    }> = [];

    if (inputType === "TEXT" && text) {
      similarEntries = await findSimilarEntries(text, 0.5);
    }

    // Extract config from request body
    const config = body.config || {};

    // Trigger async processing (fire and forget) with config
    void asyncProcess(entry.id, config);

    return NextResponse.json({
      entryId: entry.id,
      status: "PENDING",
      message: "Content submitted for processing",
      similarEntries: similarEntries.length > 0 ? similarEntries : undefined,
    });
  } catch (error) {
    console.error("Ingest error:", error);
    return NextResponse.json(
      { error: "Failed to ingest content" },
      { status: 500 }
    );
  }
}
