import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteEntryWithDependencies } from "@/lib/entries/delete";

/**
 * GET /api/entries/[id] - Get entry detail.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const entry = await prisma.entry.findUnique({
      where: { id },
      include: {
        practiceTask: {
          include: {
            steps: { orderBy: { order: "asc" } },
          },
        },
        // B2.1: Include new split tables
        aiResult: true,
        evaluation: true,
        smartSummaryRelation: true,
        notes: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!entry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    return NextResponse.json(entry);
  } catch (error) {
    console.error("Get entry error:", error);
    return NextResponse.json({ error: "Failed to get entry" }, { status: 500 });
  }
}

/**
 * PATCH /api/entries/[id] - Update entry (user corrections).
 * B2.1: Routes updates to appropriate tables based on field type.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Categorize fields by target table
    const entryFields = ["title", "userTags"];
    const aiResultFields = ["contentType", "techDomain", "practiceValue"];
    const smartSummaryFields = ["smartSummary", "keyInsights", "tldr"];

    const entryUpdate: Record<string, unknown> = {};
    const aiResultUpdate: Record<string, unknown> = {};
    const smartSummaryUpdate: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(body)) {
      if (entryFields.includes(key)) {
        entryUpdate[key] = value;
      } else if (aiResultFields.includes(key)) {
        aiResultUpdate[key] = value;
      } else if (smartSummaryFields.includes(key)) {
        smartSummaryUpdate[key] = value;
      }
    }

    // Execute updates in transaction
    await prisma.$transaction(async (tx) => {
      // Update Entry table
      if (Object.keys(entryUpdate).length > 0) {
        await tx.entry.update({
          where: { id },
          data: entryUpdate,
        });
      }

      // Update EntryAIResult table (dual-write to Entry for backward compat)
      if (Object.keys(aiResultUpdate).length > 0) {
        await tx.entry.update({
          where: { id },
          data: aiResultUpdate,
        });
        await tx.entryAIResult.update({
          where: { entryId: id },
          data: aiResultUpdate,
        }).catch(() => {
          // If EntryAIResult doesn't exist yet, create it
          return tx.entryAIResult.create({
            data: {
              entryId: id,
              ...aiResultUpdate,
            },
          });
        });
      }

      // Update EntrySmartSummary table (dual-write to Entry for backward compat)
      if (Object.keys(smartSummaryUpdate).length > 0) {
        await tx.entry.update({
          where: { id },
          data: smartSummaryUpdate,
        });
        await tx.entrySmartSummary.update({
          where: { entryId: id },
          data: smartSummaryUpdate,
        }).catch(() => {
          // If EntrySmartSummary doesn't exist yet, create it
          return tx.entrySmartSummary.create({
            data: {
              entryId: id,
              ...smartSummaryUpdate,
            },
          });
        });
      }
    });

    // Fetch updated entry with all relations
    const entry = await prisma.entry.findUnique({
      where: { id },
      include: {
        practiceTask: {
          include: {
            steps: { orderBy: { order: "asc" } },
          },
        },
        aiResult: true,
        evaluation: true,
        smartSummaryRelation: true,
        notes: { orderBy: { createdAt: "desc" } },
      },
    });

    return NextResponse.json(entry);
  } catch (error) {
    console.error("Update entry error:", error);
    return NextResponse.json({ error: "Failed to update entry" }, { status: 500 });
  }
}

/**
 * DELETE /api/entries/[id] - Delete entry and its practice task.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteEntryWithDependencies(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete entry error:", error);
    return NextResponse.json({ error: "Failed to delete entry" }, { status: 500 });
  }
}
