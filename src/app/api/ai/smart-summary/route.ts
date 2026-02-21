import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateSmartSummary } from "@/lib/ai/smartSummary";

/**
 * POST /api/ai/smart-summary - Generate a smart summary for an entry.
 */
export async function POST(request: NextRequest) {
  try {
    const { entryId } = await request.json();

    if (!entryId) {
      return NextResponse.json({ error: "entryId is required" }, { status: 400 });
    }

    const entry = await prisma.entry.findUnique({
      where: { id: entryId },
    });

    if (!entry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    const content = entry.originalContent;
    if (!content) {
      return NextResponse.json(
        { error: "No content available for summary generation" },
        { status: 400 }
      );
    }

    const smartSummary = await generateSmartSummary(content);

    // Save to entry
    await prisma.entry.update({
      where: { id: entryId },
      data: {
        smartSummary: smartSummary.conciseSummary,
        keyInsights: smartSummary.keyInsights,
        tldr: smartSummary["tl;DR"],
      },
    });

    return NextResponse.json(smartSummary);
  } catch (error) {
    console.error("Smart summary error:", error);
    return NextResponse.json(
      { error: "Failed to generate summary" },
      { status: 500 }
    );
  }
}
