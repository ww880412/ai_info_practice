import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/entries/[id]/notes - List notes for an entry.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const notes = await prisma.entryNote.findMany({
      where: { entryId: id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: notes });
  } catch (error) {
    console.error("Get notes error:", error);
    return NextResponse.json({ error: "Failed to get notes" }, { status: 500 });
  }
}

/**
 * POST /api/entries/[id]/notes - Create a note for an entry.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { content } = body;

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return NextResponse.json(
        { error: "content is required and must be a non-empty string" },
        { status: 400 }
      );
    }

    const note = await prisma.entryNote.create({
      data: {
        entryId: id,
        content: content.trim(),
      },
    });

    return NextResponse.json({ data: note });
  } catch (error) {
    console.error("Create note error:", error);
    return NextResponse.json({ error: "Failed to create note" }, { status: 500 });
  }
}
