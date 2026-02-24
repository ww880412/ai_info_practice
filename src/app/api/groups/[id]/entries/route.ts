import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { entryIds } = body as { entryIds: string[] };

    if (!Array.isArray(entryIds) || entryIds.length === 0) {
      return NextResponse.json({ error: "entryIds must be a non-empty array" }, { status: 400 });
    }

    const group = await prisma.group.findUnique({ where: { id } });
    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    const updated = await prisma.group.update({
      where: { id },
      data: { entries: { connect: entryIds.map((eid) => ({ id: eid })) } },
      include: { _count: { select: { entries: true } } },
    });

    return NextResponse.json({ data: updated });
  } catch {
    return NextResponse.json({ error: "Failed to add entries to group" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { entryIds } = body as { entryIds: string[] };

    if (!Array.isArray(entryIds) || entryIds.length === 0) {
      return NextResponse.json({ error: "entryIds must be a non-empty array" }, { status: 400 });
    }

    const group = await prisma.group.findUnique({ where: { id } });
    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    const updated = await prisma.group.update({
      where: { id },
      data: { entries: { disconnect: entryIds.map((eid) => ({ id: eid })) } },
      include: { _count: { select: { entries: true } } },
    });

    return NextResponse.json({ data: updated });
  } catch {
    return NextResponse.json({ error: "Failed to remove entries from group" }, { status: 500 });
  }
}
