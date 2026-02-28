import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { findSimilarEntries } from "@/lib/ai/deduplication";
import { inngest } from "@/lib/inngest/client";
import type { SourceType } from "@prisma/client";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { inputType, url, fileUrl, text } = body;

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
    if (inputType === "PDF" && !fileUrl) {
      return NextResponse.json({ error: "fileUrl is required for PDF input" }, { status: 400 });
    }
    if (inputType === "TEXT" && !text) {
      return NextResponse.json({ error: "text is required for TEXT input" }, { status: 400 });
    }

    // Validate fileUrl format for security (SSRF prevention)
    if (inputType === "PDF" && fileUrl && !fileUrl.startsWith('r2://')) {
      return NextResponse.json(
        { error: "Invalid fileUrl format. Only r2:// URLs are accepted." },
        { status: 400 }
      );
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
        rawUrl: inputType === "LINK" ? url : inputType === "PDF" ? fileUrl : null,
        rawText: inputType === "TEXT" ? text : null,
        sourceType,
        processStatus: "PENDING",
        processError: "任务已提交，等待处理...",
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

    // Trigger async processing via Inngest
    await inngest.send({
      name: 'entry/ingest',
      data: { entryId: entry.id, config },
    });

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
