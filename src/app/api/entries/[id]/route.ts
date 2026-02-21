import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Only allow updating specific fields
    const allowedFields = [
      "title",
      "contentType",
      "techDomain",
      "practiceValue",
      "userTags",
      "smartSummary",
      "keyInsights",
      "tldr",
    ];
    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    const entry = await prisma.entry.update({
      where: { id },
      data: updateData,
      include: {
        practiceTask: {
          include: {
            steps: { orderBy: { order: "asc" } },
          },
        },
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
    await prisma.entry.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete entry error:", error);
    return NextResponse.json({ error: "Failed to delete entry" }, { status: 500 });
  }
}
