import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { classifyAndExtract } from "@/lib/ai/classifier";
import { convertToPractice } from "@/lib/ai/practiceConverter";

/**
 * POST /api/ai/process - Manually trigger AI re-processing for an entry.
 */
export async function POST(request: NextRequest) {
  try {
    const { entryId } = await request.json();

    if (!entryId) {
      return NextResponse.json({ error: "entryId is required" }, { status: 400 });
    }

    const entry = await prisma.entry.findUnique({
      where: { id: entryId },
      include: { practiceTask: true },
    });

    if (!entry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    const content = entry.originalContent || entry.rawText;
    if (!content) {
      return NextResponse.json(
        { error: "No content available for processing" },
        { status: 400 }
      );
    }

    // Update status
    await prisma.entry.update({
      where: { id: entryId },
      data: { processStatus: "AI_PROCESSING", processError: null },
    });

    // Delete existing practice task if any
    if (entry.practiceTask) {
      await prisma.practiceTask.delete({
        where: { id: entry.practiceTask.id },
      });
    }

    // Re-run AI pipeline
    const aiResult = await classifyAndExtract(content);

    await prisma.entry.update({
      where: { id: entryId },
      data: {
        contentType: aiResult.contentType,
        techDomain: aiResult.techDomain,
        aiTags: aiResult.aiTags,
        coreSummary: aiResult.coreSummary,
        keyPoints: aiResult.keyPoints,
        practiceValue: aiResult.practiceValue,
      },
    });

    if (aiResult.practiceValue === "ACTIONABLE") {
      const practiceResult = await convertToPractice(content, aiResult.coreSummary);

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

    await prisma.entry.update({
      where: { id: entryId },
      data: { processStatus: "DONE" },
    });

    return NextResponse.json({ status: "DONE", message: "Re-processing complete" });
  } catch (error) {
    console.error("AI process error:", error);
    return NextResponse.json(
      { error: "AI processing failed" },
      { status: 500 }
    );
  }
}
